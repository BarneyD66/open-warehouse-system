import { NextResponse } from "next/server";
import { getAutomationRuns, type AutomationRunRecord, type AutomationTaskRunRecord } from "@/lib/automationRunStore";
import { getAuditLogs, type AuditLogRecord } from "@/lib/auditLogStore";
import { getOpsExpansionData, type BatchOperationPlan } from "@/lib/opsExpansionStore";
import { getProductionErrorEvents, type ProductionErrorEvent } from "@/lib/productionErrorStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getSystemAlerts, type SystemAlert } from "@/lib/systemAlertStore";
import { getWebhookEvents, type WebhookEventRecord } from "@/lib/webhookEventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpsLogLevel = "critical" | "warning" | "info";
type OpsLogSource = "alert" | "job" | "audit" | "webhook" | "automation" | "error";

type OpsSystemLogEntry = {
  id: string;
  level: OpsLogLevel;
  source: OpsLogSource;
  category: string;
  title: string;
  detail: string;
  refId?: string;
  customerCode?: string;
  actorName?: string;
  actionHref?: string;
  createdAt: string;
};

const sourceLabels: Record<OpsLogSource, string> = {
  alert: "系统告警",
  job: "任务队列",
  audit: "操作审计",
  webhook: "Webhook 回调",
  automation: "自动化调度",
  error: "生产错误",
};

const levelLabels: Record<OpsLogLevel, string> = {
  critical: "严重",
  warning: "提醒",
  info: "信息",
};

function clean(value: string | null) {
  return value?.trim() || "";
}

function inDateRange(createdAt: string, dateFrom: string, dateTo: string) {
  const day = createdAt.slice(0, 10);
  return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
}

function matchesKeyword(entry: OpsSystemLogEntry, keyword: string) {
  if (!keyword) return true;
  const haystack = [entry.id, entry.category, entry.title, entry.detail, entry.refId, entry.customerCode, entry.actorName].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(keyword.toLowerCase());
}

function alertEntry(alert: SystemAlert): OpsSystemLogEntry {
  return {
    id: alert.id,
    level: alert.severity,
    source: "alert",
    category: alert.source,
    title: alert.title,
    detail: alert.detail,
    refId: alert.id.split(":").slice(1).join(":") || alert.id,
    actionHref: alert.actionHref,
    createdAt: alert.createdAt,
  };
}

function jobLevel(plan: BatchOperationPlan): OpsLogLevel {
  if (plan.status === "exception") return "critical";
  if (plan.status === "processing" && plan.nextRunAt && new Date(plan.nextRunAt).getTime() < Date.now()) return "warning";
  return "info";
}

function jobEntry(plan: BatchOperationPlan): OpsSystemLogEntry {
  return {
    id: `job-log:${plan.id}`,
    level: jobLevel(plan),
    source: "job",
    category: plan.kind,
    title: `批量任务：${plan.title}`,
    detail: [plan.status, `记录数 ${plan.recordCount}`, `尝试 ${plan.attempts ?? 0}/${plan.maxAttempts ?? 3}`, plan.lastError ? `错误：${plan.lastError}` : "", plan.note ? `备注：${plan.note}` : ""].filter(Boolean).join("；"),
    refId: plan.id,
    actorName: plan.createdBy,
    actionHref: "/ops?section=logistics",
    createdAt: plan.updatedAt || plan.createdAt,
  };
}

function auditEntry(log: AuditLogRecord): OpsSystemLogEntry {
  return {
    id: `audit-log:${log.id}`,
    level: log.actorRole === "system" ? "info" : "info",
    source: "audit",
    category: log.action,
    title: log.summary,
    detail: log.note || `${log.targetType} / ${log.targetId}`,
    refId: log.targetId,
    customerCode: log.customerCode,
    actorName: log.actorName,
    createdAt: log.createdAt,
  };
}

function webhookLevel(event: WebhookEventRecord): OpsLogLevel {
  if (event.status === "failed") return "critical";
  if (event.status === "processing") return "warning";
  return "info";
}

function webhookEntry(event: WebhookEventRecord): OpsSystemLogEntry {
  return {
    id: `webhook-log:${event.id}`,
    level: webhookLevel(event),
    source: "webhook",
    category: `${event.kind}/${event.provider}`,
    title: `${event.kind === "carrier" ? "承运商" : "平台"} webhook：${event.summary || event.status}`,
    detail: [event.error ? `错误：${event.error}` : "", event.targetId ? `关联单号：${event.targetId}` : "", `事件号：${event.eventId}`].filter(Boolean).join("；") || "Webhook 已记录。",
    refId: event.targetId || event.eventId,
    actionHref: "/ops?section=overview",
    createdAt: event.updatedAt || event.receivedAt,
  };
}

function automationTaskLevel(task: AutomationTaskRunRecord): OpsLogLevel {
  if (task.status === "failed") return "critical";
  if (task.status === "unauthorized") return "warning";
  return "info";
}

function automationEntry(run: AutomationRunRecord, task: AutomationTaskRunRecord): OpsSystemLogEntry {
  return {
    id: `automation-log:${run.id}:${task.key}`,
    level: automationTaskLevel(task),
    source: "automation",
    category: task.key,
    title: `自动化任务：${task.name}`,
    detail: [`状态：${task.status}`, `HTTP：${task.httpStatus}`, task.summary, task.handlingStatus ? `处理状态：${task.handlingStatus}` : "", task.lastRetrySummary ? `最近重试：${task.lastRetrySummary}` : ""].filter(Boolean).join("；"),
    refId: run.id,
    actorName: run.actorName,
    actionHref: "/ops?section=overview",
    createdAt: run.finishedAt || run.startedAt,
  };
}

function productionErrorEntry(event: ProductionErrorEvent): OpsSystemLogEntry {
  return {
    id: `error-log:${event.id}`,
    level: event.severity,
    source: "error",
    category: event.source,
    title: `生产错误：${event.route}`,
    detail: [event.message, event.refId ? `业务关联：${event.refId}` : "", event.requestId ? `请求编号：${event.requestId}` : "", event.handlingStatus !== "open" ? `处理状态：${event.handlingStatus}` : ""].filter(Boolean).join("；"),
    refId: event.id,
    actorName: event.actorName,
    actionHref: "/ops?section=overview",
    createdAt: event.createdAt,
  };
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

export async function GET(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-system-logs"), 60, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "生产日志查询过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "permissions", expansionData) && !canAccessOpsModule(staff, "overview", expansionData)) {
    return NextResponse.json({ error: "当前账号无权查看生产日志" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = clean(searchParams.get("keyword"));
  const level = clean(searchParams.get("level")) as OpsLogLevel | "";
  const source = clean(searchParams.get("source")) as OpsLogSource | "";
  const dateFrom = clean(searchParams.get("dateFrom"));
  const dateTo = clean(searchParams.get("dateTo"));
  const limit = Math.max(1, Math.min(1000, Number(searchParams.get("limit") || 300)));
  const format = clean(searchParams.get("format"));

  const [alerts, auditLogs, webhookEvents, automationRuns, productionErrors] = await Promise.all([
    getSystemAlerts(),
    getAuditLogs({ keyword: keyword || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 500 }),
    getWebhookEvents(300),
    getAutomationRuns({ limit: 100 }),
    getProductionErrorEvents({ limit: 300 }),
  ]);

  const entries = [
    ...alerts.map(alertEntry),
    ...expansionData.batchOperationPlans.map(jobEntry),
    ...auditLogs.map(auditEntry),
    ...webhookEvents.filter((event) => event.status === "failed" || event.status === "processing").map(webhookEntry),
    ...automationRuns.flatMap((run) => run.results.filter((task) => task.status !== "completed").map((task) => automationEntry(run, task))),
    ...productionErrors.map(productionErrorEntry),
  ]
    .filter((entry) => (!level || entry.level === level) && (!source || entry.source === source))
    .filter((entry) => inDateRange(entry.createdAt, dateFrom, dateTo))
    .filter((entry) => matchesKeyword(entry, keyword))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);

  const summary = {
    total: entries.length,
    critical: entries.filter((entry) => entry.level === "critical").length,
    warning: entries.filter((entry) => entry.level === "warning").length,
    info: entries.filter((entry) => entry.level === "info").length,
  };

  if (format === "csv") {
    return csvResponse("生产日志检索.csv", [
      ["日志编号", "发生时间", "级别", "来源", "分类", "标题", "详情", "关联编号", "客户编号", "操作人", "处理入口"],
      ...entries.map((entry) => [
        entry.id,
        entry.createdAt,
        levelLabels[entry.level],
        sourceLabels[entry.source],
        entry.category,
        entry.title,
        entry.detail,
        entry.refId ?? "",
        entry.customerCode ?? "",
        entry.actorName ?? "",
        entry.actionHref ?? "",
      ]),
    ]);
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, entries });
}
