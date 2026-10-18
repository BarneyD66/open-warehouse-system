import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, outboundWorkModeLabel, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type OutboundReviewResult = "正常" | "需复核" | "待称重" | "截单待审" | "已截单" | "未开始";

type OutboundReviewRow = {
  outboundId: string;
  customerCode: string;
  status: string;
  result: OutboundReviewResult;
  channel: string;
  workMode: string;
  pickWaveNo: string;
  pickListNo: string;
  basketNo: string;
  requiredQty: number;
  pickedQty: number;
  sortedQty: number;
  packedQty: number;
  pickGap: number;
  sortGap: number;
  packGap: number;
  openExceptionCount: number;
  criticalExceptionCount: number;
  interceptStatus: string;
  packageWeightKg: string | number;
  packageCount: string | number;
  latestScanAt: string;
  latestException: string;
  nextAction: string;
  updatedAt: string;
};

const statusLabel: Record<CoreOutboundOrder["status"], string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待生成面单",
  packing_check: "包装复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
};

const interceptLabel: Record<string, string> = {
  none: "未截单",
  requested: "已申请截单",
  restock_pending: "回库待处理",
  completed: "已截单回库",
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

function sumQty(values?: Record<string, number>) {
  return Object.values(values ?? {}).reduce((sum, value) => sum + value, 0);
}

function requiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function latestScanAt(order: CoreOutboundOrder) {
  return (order.scanProgress?.lastScans ?? [])
    .map((scan) => scan.scannedAt)
    .sort()
    .at(-1);
}

function latestOpenException(order: CoreOutboundOrder) {
  return (order.exceptions ?? [])
    .filter((exception) => exception.status === "open" || exception.status === "investigating")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function rowResult(order: CoreOutboundOrder, required: number, picked: number, sorted: number, packed: number, criticalExceptionCount: number): OutboundReviewResult {
  if (order.interceptStatus === "completed") return "已截单";
  if (order.interceptStatus === "requested" || order.interceptStatus === "restock_pending") return "截单待审";
  if (criticalExceptionCount > 0 || picked > required || sorted > required || packed > required) return "需复核";
  if (order.status === "handover" && !order.packageWeightKg) return "待称重";
  if (picked === 0 && sorted === 0 && packed === 0 && order.status !== "shipped") return "未开始";
  if (picked < required || sorted < required || packed < required) return "需复核";
  return "正常";
}

function nextAction(row: Pick<OutboundReviewRow, "result" | "pickGap" | "sortGap" | "packGap" | "criticalExceptionCount" | "openExceptionCount" | "interceptStatus">) {
  if (row.interceptStatus === "已截单回库") return "确认库存已回库，必要时通知客户重新下单。";
  if (row.result === "截单待审") return "按审批规则复核原因、附件和权限，通过后执行截单回库。";
  if (row.criticalExceptionCount > 0) return "先处理严重扫码异常，再继续复核或签出。";
  if (row.openExceptionCount > 0) return "复核异常原因并关闭或升级处理。";
  if (row.pickGap > 0) return "继续拣货并扫描 SKU。";
  if (row.sortGap > 0) return "继续二次分拣或格口复核。";
  if (row.packGap > 0) return "继续打包复核，确保 SKU 和数量一致。";
  if (row.result === "待称重") return "补录包裹重量和包裹数后再签出。";
  return "可继续交运或归档。";
}

function buildRows(orders: CoreOutboundOrder[]): OutboundReviewRow[] {
  return orders.map((order) => {
    const required = requiredQty(order);
    const picked = sumQty(order.scanProgress?.pickedQtyBySku);
    const sorted = sumQty(order.scanProgress?.sortedQtyBySku);
    const packed = sumQty(order.scanProgress?.packedQtyBySku);
    const openExceptions = (order.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
    const criticalExceptionCount = openExceptions.filter((exception) => exception.severity === "critical").length;
    const latestException = latestOpenException(order);
    const result = rowResult(order, required, picked, sorted, packed, criticalExceptionCount);
    const interceptStatus = interceptLabel[order.interceptStatus ?? "none"] ?? (order.interceptStatus ?? "未截单");
    const row: OutboundReviewRow = {
      outboundId: order.id,
      customerCode: order.customerCode,
      status: statusLabel[order.status] ?? order.status,
      result,
      channel: order.channel,
      workMode: order.workMode ? outboundWorkModeLabel(order.workMode) : "未分配",
      pickWaveNo: order.pickWaveNo ?? "",
      pickListNo: order.pickListNo ?? "",
      basketNo: order.basketNo ?? "",
      requiredQty: required,
      pickedQty: picked,
      sortedQty: sorted,
      packedQty: packed,
      pickGap: Math.max(0, required - picked),
      sortGap: Math.max(0, required - sorted),
      packGap: Math.max(0, required - packed),
      openExceptionCount: openExceptions.length,
      criticalExceptionCount,
      interceptStatus,
      packageWeightKg: order.packageWeightKg ?? "",
      packageCount: order.packageCount ?? "",
      latestScanAt: latestScanAt(order) ?? "",
      latestException: latestException ? `${latestException.severity === "critical" ? "严重" : "提醒"}：${latestException.message}` : "",
      nextAction: "",
      updatedAt: order.updatedAt ?? order.createdAt,
    };
    return { ...row, nextAction: nextAction(row) };
  });
}

function applyFilters(rows: OutboundReviewRow[], url: URL) {
  const customerCode = url.searchParams.get("customerCode")?.trim().toUpperCase();
  const status = url.searchParams.get("status")?.trim();
  const result = url.searchParams.get("result")?.trim();
  const keyword = url.searchParams.get("keyword")?.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.outboundId, row.customerCode, row.status, row.result, row.channel, row.workMode, row.pickWaveNo, row.pickListNo, row.basketNo, row.latestException, row.nextAction].join(" ").toLowerCase();
    return (
      (!customerCode || row.customerCode.toUpperCase() === customerCode) &&
      (!status || status === "all" || row.status === status) &&
      (!result || result === "all" || row.result === result) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出出库复核差异报表。" }, { status: 403 });

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").trim().toLowerCase();
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData.outboundOrders), url).sort((a, b) => {
    const rank: Record<OutboundReviewResult, number> = { 需复核: 0, 截单待审: 1, 已截单: 2, 待称重: 3, 未开始: 4, 正常: 5 };
    return rank[a.result] - rank[b.result] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "outbound-review",
      summary: "导出出库复核差异报表",
      note: `客户：${url.searchParams.get("customerCode") || "全部"}；结果：${url.searchParams.get("result") || "全部"}；行数：${rows.length}`,
    });
  }

  if (format === "json") return NextResponse.json({ rows });

  return csvResponse("出库复核差异报表.csv", [
    ["出库单号", "客户编号", "状态", "复核结果", "物流渠道", "作业模式", "波次号", "拣货单号", "篮号/格口", "应拣数量", "已拣数量", "已分拣数量", "已复核数量", "拣货缺口", "分拣缺口", "复核缺口", "未处理异常数", "严重异常数", "截单状态", "重量KG", "包裹数", "最近扫码时间", "最近异常", "下一步动作", "更新时间"],
    ...rows.map((row) => [
      row.outboundId,
      row.customerCode,
      row.status,
      row.result,
      row.channel,
      row.workMode,
      row.pickWaveNo,
      row.pickListNo,
      row.basketNo,
      row.requiredQty,
      row.pickedQty,
      row.sortedQty,
      row.packedQty,
      row.pickGap,
      row.sortGap,
      row.packGap,
      row.openExceptionCount,
      row.criticalExceptionCount,
      row.interceptStatus,
      row.packageWeightKg,
      row.packageCount,
      row.latestScanAt,
      row.latestException,
      row.nextAction,
      row.updatedAt,
    ]),
  ]);
}
