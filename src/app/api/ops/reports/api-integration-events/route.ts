import { NextResponse } from "next/server";
import { getAuditLogs, recordAuditLog, type AuditLogRecord } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWebhookEvents, type WebhookEventRecord, type WebhookEventStatus } from "@/lib/webhookEventStore";

export const runtime = "nodejs";

type ApiIntegrationEventRow = {
  sourceType: string;
  sourceTypeCode: string;
  category: string;
  provider: string;
  eventId: string;
  status: string;
  statusCode: string;
  targetType: string;
  targetId: string;
  customerCode: string;
  actor: string;
  summary: string;
  error: string;
  occurredAt: string;
  updatedAt: string;
  nextAction: string;
};

const integrationAuditActions = new Set<AuditLogRecord["action"]>([
  "integration_probe",
  "outbound_shipping_label_update",
  "carrier_label_retry_due",
  "carrier_tracking_sync_due",
  "platform_orders_sync_due",
  "platform_cancellation_review_due",
  "platform_fulfillment_retry_due",
  "automation_run_due",
  "automation_task_update",
]);

const actionLabel: Partial<Record<AuditLogRecord["action"], string>> = {
  integration_probe: "接口探测",
  outbound_shipping_label_update: "面单下单/取消",
  carrier_label_retry_due: "承运商面单重试",
  carrier_tracking_sync_due: "承运商轨迹/POD 同步",
  platform_orders_sync_due: "平台订单拉取",
  platform_cancellation_review_due: "平台取消复核",
  platform_fulfillment_retry_due: "平台发货回传",
  automation_run_due: "自动任务运行",
  automation_task_update: "自动任务配置",
};

const webhookStatusLabel: Record<WebhookEventStatus, string> = {
  processing: "处理中",
  processed: "已处理",
  ignored: "已忽略",
  failed: "失败",
};

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function attachmentHeader(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download.csv";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function csvResponse(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\ufeff${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentHeader(filename),
    },
  });
}

function isRiskAudit(log: AuditLogRecord) {
  const text = [log.summary, log.note, JSON.stringify(log.after ?? ""), JSON.stringify(log.before ?? "")].join(" ").toLowerCase();
  return /失败|异常|错误|failed|error|blocked|missing/.test(text);
}

function webhookNextAction(event: WebhookEventRecord) {
  if (event.status === "failed") return event.targetId ? "检查关联单据处理结果，必要时重新投递或人工补录。" : "补齐单号匹配规则后让对方重推 webhook。";
  if (event.status === "processing") return "确认是否卡住，超过 10 分钟建议重新投递或查看系统日志。";
  if (event.status === "ignored") return "无需处理，保留幂等记录用于排查重复回调。";
  return "已完成，可作为轨迹、POD、取消订单闭环证据。";
}

function auditNextAction(log: AuditLogRecord) {
  if (isRiskAudit(log)) return "进入对应业务模块处理失败原因，处理后再次触发同步或重试。";
  if (log.action === "integration_probe") return "如探测未覆盖正式密钥，请补齐生产环境变量后再次探测。";
  if (log.action === "automation_task_update") return "确认任务频率、密钥和告警订阅是否符合生产节奏。";
  return "保留为接口闭环审计记录。";
}

function webhookRows(events: WebhookEventRecord[]): ApiIntegrationEventRow[] {
  return events.map((event) => ({
    sourceType: "Webhook 回调",
    sourceTypeCode: "webhook",
    category: event.kind === "carrier" ? "承运商" : "平台",
    provider: event.provider,
    eventId: event.eventId,
    status: webhookStatusLabel[event.status],
    statusCode: event.status,
    targetType: event.kind === "carrier" ? "出库/物流" : "平台订单",
    targetId: event.targetId ?? "",
    customerCode: "",
    actor: `${event.provider}-webhook`,
    summary: event.summary ?? "",
    error: event.error ?? "",
    occurredAt: event.receivedAt,
    updatedAt: event.updatedAt,
    nextAction: webhookNextAction(event),
  }));
}

function auditRows(logs: AuditLogRecord[]): ApiIntegrationEventRow[] {
  return logs
    .filter((log) => integrationAuditActions.has(log.action))
    .map((log) => ({
      sourceType: "操作审计",
      sourceTypeCode: "audit",
      category: actionLabel[log.action] ?? log.action,
      provider: providerFromLog(log),
      eventId: log.id,
      status: isRiskAudit(log) ? "需处理" : "已记录",
      statusCode: isRiskAudit(log) ? "risk" : "recorded",
      targetType: log.targetType,
      targetId: log.targetId,
      customerCode: log.customerCode ?? "",
      actor: log.actorName,
      summary: log.summary,
      error: isRiskAudit(log) ? log.note ?? "" : "",
      occurredAt: log.createdAt,
      updatedAt: log.createdAt,
      nextAction: auditNextAction(log),
    }));
}

function providerFromLog(log: AuditLogRecord) {
  const payload = (log.after ?? log.before ?? {}) as Record<string, unknown>;
  const direct = payload.provider || payload.platform || payload.carrier || payload.carrierProvider || payload.connectionId || payload.channel;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (log.action.startsWith("carrier_") || log.action === "outbound_shipping_label_update") return "承运商";
  if (log.action.startsWith("platform_")) return "平台";
  if (log.action === "integration_probe") return "接口探测";
  return "系统";
}

function applyFilters(rows: ApiIntegrationEventRow[], url: URL) {
  const source = clean(url.searchParams.get("source")).toLowerCase();
  const status = clean(url.searchParams.get("status")).toLowerCase();
  const provider = clean(url.searchParams.get("provider")).toLowerCase();
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  return rows.filter((row) => {
    const haystack = [
      row.sourceType,
      row.sourceTypeCode,
      row.category,
      row.provider,
      row.eventId,
      row.status,
      row.statusCode,
      row.targetType,
      row.targetId,
      row.customerCode,
      row.actor,
      row.summary,
      row.error,
      row.nextAction,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!source || source === "all" || row.sourceTypeCode === source || row.category.toLowerCase().includes(source)) &&
      (!status || status === "all" || row.statusCode === status || row.status.toLowerCase().includes(status)) &&
      (!provider || row.provider.toLowerCase().includes(provider)) &&
      (!customerCode || row.customerCode.toLowerCase().includes(customerCode)) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "api-integration-events-report"), 40, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "导出过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData) && !canAccessOpsModule(staff, "logistics", expansionData) && !canAccessOpsModule(staff, "outbound", expansionData)) {
    return NextResponse.json({ error: "当前角色无权导出 API 联调事件台账。" }, { status: 403 });
  }

  const url = new URL(request.url);
  const [webhookEvents, auditLogs] = await Promise.all([getWebhookEvents(1000), getAuditLogs({ limit: 500 })]);
  const rows = applyFilters([...webhookRows(webhookEvents), ...auditRows(auditLogs)], url).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "api-integration-events",
      summary: "导出 API 联调事件台账",
      note: `来源：${url.searchParams.get("source") ?? "全部"}；状态：${url.searchParams.get("status") ?? "全部"}；供应商/平台：${url.searchParams.get("provider") ?? "全部"}；行数：${rows.length}`,
      after: {
        source: url.searchParams.get("source") ?? "all",
        status: url.searchParams.get("status") ?? "all",
        provider: url.searchParams.get("provider") ?? "",
        customerCode: url.searchParams.get("customerCode") ?? "",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("API联调事件台账.csv", [
    ["来源", "来源代码", "分类", "供应商/平台", "事件编号", "状态", "状态代码", "关联类型", "关联单号", "客户编号", "执行人/来源", "摘要", "错误信息", "发生时间", "更新时间", "下一步处理"],
    ...rows.map((row) => [
      row.sourceType,
      row.sourceTypeCode,
      row.category,
      row.provider,
      row.eventId,
      row.status,
      row.statusCode,
      row.targetType,
      row.targetId,
      row.customerCode,
      row.actor,
      row.summary,
      row.error,
      row.occurredAt,
      row.updatedAt,
      row.nextAction,
    ]),
  ]);
}
