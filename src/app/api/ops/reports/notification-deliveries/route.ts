import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getNotificationDeliveries, type NotificationDelivery } from "@/lib/notificationStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationDeliveryReportRow = {
  deliveryId: string;
  notificationId: string;
  audience: string;
  customerCode: string;
  channel: string;
  source: string;
  sourceId: string;
  title: string;
  status: string;
  attempts: number;
  lastError: string;
  nextRetryAt: string;
  deliveredAt: string;
  createdAt: string;
  updatedAt: string;
  nextAction: string;
};

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

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function audienceLabel(value: NotificationDelivery["audience"]) {
  return value === "customer" ? "客户" : "员工";
}

function channelLabel(value: string) {
  if (value === "邮件" || value.includes("閭")) return "邮件";
  if (value === "短信" || value.includes("鐭")) return "短信";
  if (value === "微信" || value.includes("寰")) return "微信";
  return value || "未知渠道";
}

function sourceLabel(value: NotificationDelivery["source"]) {
  const labels: Record<NotificationDelivery["source"], string> = {
    inquiry: "询价",
    inbound: "入库",
    billing: "账单",
    inventory: "库存",
    outbound: "出库",
    returns: "退货",
    logistics: "物流",
    document: "文件",
    work_order: "工单",
    approval: "审批",
    system: "系统",
  };
  return labels[value] ?? value;
}

function statusLabel(value: NotificationDelivery["status"]) {
  if (value === "queued") return "待投递";
  if (value === "sent") return "已送达";
  if (value === "failed") return "投递失败";
  return "配置阻断";
}

function nextActionFor(delivery: NotificationDelivery) {
  if (delivery.status === "sent") return "无需处理。";
  if (delivery.status === "blocked") return "补齐对应通知渠道 webhook 配置后重新投递。";
  if (delivery.status === "queued") return "等待系统投递；紧急通知可在后台手动重试。";
  if (delivery.nextRetryAt) return "按建议重试时间再次投递，并检查供应商返回错误。";
  return "立即重试；如仍失败，检查通知供应商配置和收件人信息。";
}

function buildRows(deliveries: NotificationDelivery[]): NotificationDeliveryReportRow[] {
  return deliveries.map((delivery) => ({
    deliveryId: delivery.id,
    notificationId: delivery.notificationId,
    audience: audienceLabel(delivery.audience),
    customerCode: delivery.customerCode ?? "",
    channel: channelLabel(delivery.channel),
    source: sourceLabel(delivery.source),
    sourceId: delivery.sourceId,
    title: delivery.title,
    status: statusLabel(delivery.status),
    attempts: delivery.attempts,
    lastError: delivery.lastError ?? "",
    nextRetryAt: delivery.nextRetryAt ?? "",
    deliveredAt: delivery.deliveredAt ?? "",
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    nextAction: nextActionFor(delivery),
  }));
}

function applyFilters(rows: NotificationDeliveryReportRow[], url: URL) {
  const status = clean(url.searchParams.get("status"));
  const channel = clean(url.searchParams.get("channel"));
  const audience = clean(url.searchParams.get("audience"));
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();

  return rows
    .filter((row) => !status || status === "all" || row.status === status)
    .filter((row) => !channel || channel === "all" || row.channel === channel)
    .filter((row) => !audience || audience === "all" || row.audience === audience || row.audience.toLowerCase() === audience.toLowerCase())
    .filter((row) => !customerCode || row.customerCode.toLowerCase().includes(customerCode))
    .filter((row) => {
      if (!keyword) return true;
      const haystack = [row.deliveryId, row.notificationId, row.customerCode, row.channel, row.source, row.sourceId, row.title, row.status, row.lastError, row.nextAction]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) {
    return NextResponse.json({ error: "当前角色无权导出通知投递台账。" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rows = applyFilters(buildRows(await getNotificationDeliveries(1000)), url);

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "notification-deliveries",
      summary: "导出通知投递台账",
      note: `行数：${rows.length}`,
      after: {
        status: url.searchParams.get("status") ?? "all",
        channel: url.searchParams.get("channel") ?? "all",
        audience: url.searchParams.get("audience") ?? "all",
        customerCode: url.searchParams.get("customerCode") ?? "",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });
  }

  return csvResponse("通知投递台账报表.csv", [
    ["投递编号", "通知编号", "接收对象", "客户编号", "渠道", "来源模块", "来源单号", "标题", "状态", "尝试次数", "最后错误", "建议重试时间", "送达时间", "创建时间", "更新时间", "下一步处理"],
    ...rows.map((row) => [
      row.deliveryId,
      row.notificationId,
      row.audience,
      row.customerCode,
      row.channel,
      row.source,
      row.sourceId,
      row.title,
      row.status,
      row.attempts,
      row.lastError,
      row.nextRetryAt,
      row.deliveredAt,
      row.createdAt,
      row.updatedAt,
      row.nextAction,
    ]),
  ]);
}
