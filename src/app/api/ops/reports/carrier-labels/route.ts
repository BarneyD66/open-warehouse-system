import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, type CoreOutboundOrder, type OutboundLabelStatus } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type CarrierLabelRow = {
  outboundId: string;
  customerCode: string;
  channel: string;
  labelStatus: string;
  labelStatusCode: string;
  carrierName: string;
  carrierServiceName: string;
  gatewayMode: string;
  gatewayModeCode: string;
  carrierProvider: string;
  trackingNumber: string;
  carrierShipmentId: string;
  labelFormat: string;
  shippingFee: string | number;
  actualShippingFee: string | number;
  retryCount: number;
  lastTriedAt: string;
  lastTriedBy: string;
  nextRetryAt: string;
  failureReason: string;
  fallbackNote: string;
  platform: string;
  platformOrderNo: string;
  fulfillmentStatus: string;
  fulfillmentStatusCode: string;
  fulfillmentError: string;
  createdAt: string;
  updatedAt: string;
};

const labelStatusLabels: Record<OutboundLabelStatus | "unknown", string> = {
  not_requested: "未申请",
  rated: "已计费待购买",
  generated: "已生成",
  failed: "生成失败",
  unknown: "未知",
};

const gatewayModeLabels: Record<string, string> = {
  internal: "内部/人工",
  sandbox: "沙箱",
  live: "正式",
};

const fulfillmentLabels: Record<string, string> = {
  not_required: "无需回传",
  pending: "待回传",
  synced: "已回传",
  failed: "回传失败",
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

function labelStatus(order: CoreOutboundOrder) {
  return labelStatusLabels[order.labelStatus ?? "not_requested"] ?? order.labelStatus ?? labelStatusLabels.unknown;
}

function gatewayMode(order: CoreOutboundOrder) {
  return gatewayModeLabels[order.carrierGatewayMode ?? "internal"] ?? order.carrierGatewayMode ?? "内部/人工";
}

function fulfillmentStatus(order: CoreOutboundOrder) {
  return fulfillmentLabels[order.platformFulfillmentStatus ?? "not_required"] ?? order.platformFulfillmentStatus ?? "无需回传";
}

function buildRows(orders: CoreOutboundOrder[]) {
  return orders.map((order): CarrierLabelRow => ({
    outboundId: order.id,
    customerCode: order.customerCode,
    channel: order.channel,
    labelStatus: labelStatus(order),
    labelStatusCode: order.labelStatus ?? "not_requested",
    carrierName: order.carrierName ?? "",
    carrierServiceName: order.carrierServiceName ?? "",
    gatewayMode: gatewayMode(order),
    gatewayModeCode: order.carrierGatewayMode ?? "internal",
    carrierProvider: order.carrierProvider ?? "",
    trackingNumber: order.trackingNumber ?? "",
    carrierShipmentId: order.carrierShipmentId ?? "",
    labelFormat: order.labelFormat ?? "",
    shippingFee: order.shippingFee ?? "",
    actualShippingFee: order.actualShippingFee ?? "",
    retryCount: order.labelRetryCount ?? 0,
    lastTriedAt: order.labelLastTriedAt ?? "",
    lastTriedBy: order.labelLastTriedBy ?? "",
    nextRetryAt: order.labelNextRetryAt ?? "",
    failureReason: order.labelFailureReason ?? "",
    fallbackNote: order.labelFallbackNote ?? "",
    platform: order.platform ?? "",
    platformOrderNo: order.platformOrderNo ?? "",
    fulfillmentStatus: fulfillmentStatus(order),
    fulfillmentStatusCode: order.platformFulfillmentStatus ?? "not_required",
    fulfillmentError: order.platformFulfillmentError ?? "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt ?? order.createdAt,
  }));
}

function applyFilters(rows: CarrierLabelRow[], url: URL) {
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const status = clean(url.searchParams.get("status"));
  const mode = clean(url.searchParams.get("mode"));
  const provider = clean(url.searchParams.get("provider")).toLowerCase();
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.outboundId, row.customerCode, row.channel, row.carrierName, row.carrierServiceName, row.trackingNumber, row.carrierShipmentId, row.failureReason, row.fallbackNote, row.platformOrderNo].join(" ").toLowerCase();
    return (
      (!customerCode || row.customerCode.toLowerCase().includes(customerCode)) &&
      (!status || status === "all" || row.labelStatusCode === status || row.labelStatus === status) &&
      (!mode || mode === "all" || row.gatewayModeCode === mode || row.gatewayMode === mode) &&
      (!provider || row.carrierProvider.toLowerCase().includes(provider) || row.carrierName.toLowerCase().includes(provider)) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出承运商面单生命周期报表。" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData.outboundOrders), url).sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""));

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "carrier-labels",
      summary: "导出承运商面单生命周期报表",
      note: `行数：${rows.length}`,
      after: {
        customerCode: url.searchParams.get("customerCode") ?? "",
        status: url.searchParams.get("status") ?? "all",
        mode: url.searchParams.get("mode") ?? "all",
        provider: url.searchParams.get("provider") ?? "",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("承运商面单生命周期报表.csv", [
    ["出库单号", "客户编号", "物流渠道", "面单状态", "面单状态代码", "承运商", "服务", "网关模式", "网关模式代码", "承运商标识", "追踪号", "承运商运单ID", "面单格式", "预估运费", "实际运费", "重试次数", "最近尝试时间", "最近尝试人", "下次重试时间", "失败原因", "内部面单说明", "平台", "平台订单号", "平台回传状态", "平台回传状态代码", "平台回传错误", "创建时间", "更新时间"],
    ...rows.map((row) => [
      row.outboundId,
      row.customerCode,
      row.channel,
      row.labelStatus,
      row.labelStatusCode,
      row.carrierName,
      row.carrierServiceName,
      row.gatewayMode,
      row.gatewayModeCode,
      row.carrierProvider,
      row.trackingNumber,
      row.carrierShipmentId,
      row.labelFormat,
      row.shippingFee,
      row.actualShippingFee,
      row.retryCount,
      row.lastTriedAt,
      row.lastTriedBy,
      row.nextRetryAt,
      row.failureReason,
      row.fallbackNote,
      row.platform,
      row.platformOrderNo,
      row.fulfillmentStatus,
      row.fulfillmentStatusCode,
      row.fulfillmentError,
      row.createdAt,
      row.updatedAt,
    ]),
  ]);
}
