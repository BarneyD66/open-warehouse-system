import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, outboundWorkModeLabel, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PickWaveReportRow = {
  waveNo: string;
  workMode: string;
  assignedPicker: string;
  orderCount: number;
  customerCount: number;
  skuCount: number;
  requiredQty: number;
  pickedQty: number;
  sortedQty: number;
  packedQty: number;
  pickGap: number;
  sortGap: number;
  packGap: number;
  pickRate: string;
  sortRate: string;
  packRate: string;
  shippedOrders: number;
  pendingWeightOrders: number;
  exceptionCount: number;
  severeExceptionCount: number;
  carrierSummary: string;
  latestScanAt: string;
  idleHours: number | "";
  status: string;
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

function sumRecord(record?: Record<string, number>) {
  return Object.values(record ?? {}).reduce((sum, value) => sum + value, 0);
}

function requiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? order.orderCount;
}

function latestScanAt(orders: CoreOutboundOrder[]) {
  return orders
    .flatMap((order) => order.scanProgress?.lastScans ?? [])
    .map((scan) => scan.scannedAt)
    .sort()
    .at(-1) ?? "";
}

function rate(done: number, required: number) {
  if (required <= 0) return "100%";
  return `${Math.min(100, Math.round((done / required) * 1000) / 10)}%`;
}

function idleHours(latestAt: string, orders: CoreOutboundOrder[]): number | "" {
  const base = latestAt || orders.map((order) => order.updatedAt || order.createdAt).sort().at(-1) || "";
  const timestamp = new Date(base).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return Math.max(0, Math.round(((Date.now() - timestamp) / 3_600_000) * 10) / 10);
}

function waveStatus(input: {
  orders: CoreOutboundOrder[];
  pickGap: number;
  sortGap: number;
  packGap: number;
  pendingWeightOrders: number;
  exceptionCount: number;
  idleHours: number | "";
}) {
  if (input.orders.every((order) => order.status === "shipped")) return "已完成";
  if (input.exceptionCount > 0 || input.orders.some((order) => order.status === "blocked" || order.labelStatus === "failed")) return "有异常";
  if (typeof input.idleHours === "number" && input.idleHours >= 4 && !input.orders.every((order) => order.status === "shipped")) return "疑似卡住";
  if (input.pendingWeightOrders > 0) return "待称重";
  if (input.packGap > 0) return "复核中";
  if (input.sortGap > 0) return "分拣中";
  if (input.pickGap > 0) return "拣货中";
  if (input.orders.some((order) => order.status === "handover")) return "待交接";
  return "待开始";
}

function nextAction(status: string, row: Pick<PickWaveReportRow, "pickGap" | "sortGap" | "packGap" | "pendingWeightOrders" | "severeExceptionCount">) {
  if (status === "有异常") return row.severeExceptionCount > 0 ? "先处理严重异常，再继续复核或交接。" : "处理波次内未关闭异常。";
  if (status === "疑似卡住") return "复核最新扫码记录，确认拣货员、库位或缺货问题。";
  if (row.pendingWeightOrders > 0) return "先完成称重校验，再生成或复核面单。";
  if (row.pickGap > 0) return "继续扫码拣货，补齐未拣数量。";
  if (row.sortGap > 0) return "继续二次分拣，补齐未分拣数量。";
  if (row.packGap > 0) return "继续打包复核，补齐复核数量。";
  if (status === "待交接") return "打印交接清单并完成承运商交接。";
  if (status === "已完成") return "无需处理。";
  return "启动波次作业或重新分配拣货员。";
}

function buildRows(orders: CoreOutboundOrder[]): PickWaveReportRow[] {
  const groups = new Map<string, CoreOutboundOrder[]>();
  orders
    .filter((order) => order.pickWaveNo || order.pickListNo)
    .forEach((order) => {
      const waveNo = order.pickWaveNo || order.pickListNo || "未生成波次";
      groups.set(waveNo, [...(groups.get(waveNo) ?? []), order]);
    });

  return Array.from(groups.entries()).map(([waveNo, groupOrders]) => {
    const skuCodes = new Set(groupOrders.flatMap((order) => order.skuLines?.map((line) => line.skuCode) ?? []));
    const customers = new Set(groupOrders.map((order) => order.customerCode));
    const carriers = new Set(groupOrders.map((order) => order.carrierServiceName || order.carrierName || order.channel).filter(Boolean));
    const exceptions = groupOrders.flatMap((order) => order.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
    const workModes = new Set(groupOrders.map((order) => (order.workMode ? outboundWorkModeLabel(order.workMode) : "")));
    const pickers = new Set(groupOrders.map((order) => order.assignedPicker || "").filter(Boolean));
    const required = groupOrders.reduce((sum, order) => sum + requiredQty(order), 0);
    const picked = groupOrders.reduce((sum, order) => sum + sumRecord(order.scanProgress?.pickedQtyBySku), 0);
    const sorted = groupOrders.reduce((sum, order) => sum + sumRecord(order.scanProgress?.sortedQtyBySku), 0);
    const packed = groupOrders.reduce((sum, order) => sum + sumRecord(order.scanProgress?.packedQtyBySku), 0);
    const latest = latestScanAt(groupOrders);
    const idle = idleHours(latest, groupOrders);
    const pendingWeightOrders = groupOrders.filter((order) => !order.packageWeightKg || order.packageWeightKg <= 0).length;
    const rowBase = {
      pickGap: Math.max(0, required - picked),
      sortGap: Math.max(0, required - sorted),
      packGap: Math.max(0, required - packed),
      pendingWeightOrders,
      severeExceptionCount: exceptions.filter((exception) => exception.severity === "critical").length,
    };
    const status = waveStatus({ orders: groupOrders, exceptionCount: exceptions.length, idleHours: idle, ...rowBase });

    return {
      waveNo,
      workMode: Array.from(workModes).filter(Boolean).join(" / ") || "未分配",
      assignedPicker: Array.from(pickers).join(" / ") || "未分配",
      orderCount: groupOrders.length,
      customerCount: customers.size,
      skuCount: skuCodes.size,
      requiredQty: required,
      pickedQty: picked,
      sortedQty: sorted,
      packedQty: packed,
      pickGap: rowBase.pickGap,
      sortGap: rowBase.sortGap,
      packGap: rowBase.packGap,
      pickRate: rate(picked, required),
      sortRate: rate(sorted, required),
      packRate: rate(packed, required),
      shippedOrders: groupOrders.filter((order) => order.status === "shipped").length,
      pendingWeightOrders,
      exceptionCount: exceptions.length,
      severeExceptionCount: rowBase.severeExceptionCount,
      carrierSummary: Array.from(carriers).join(" / ") || "未匹配",
      latestScanAt: latest,
      idleHours: idle,
      status,
      nextAction: nextAction(status, rowBase),
    };
  }).sort((left, right) => {
    const rank: Record<string, number> = { 有异常: 0, 疑似卡住: 1, 待称重: 2, 复核中: 3, 分拣中: 4, 拣货中: 5, 待交接: 6, 待开始: 7, 已完成: 8 };
    return (rank[left.status] ?? 9) - (rank[right.status] ?? 9) || right.latestScanAt.localeCompare(left.latestScanAt);
  });
}

function applyFilters(rows: PickWaveReportRow[], url: URL, orders: CoreOutboundOrder[]) {
  const customerCode = clean(url.searchParams.get("customerCode")).toUpperCase();
  const status = clean(url.searchParams.get("status"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  return rows
    .filter((row) => !status || status === "all" || row.status === status)
    .filter((row) => {
      if (!customerCode) return true;
      return orders.some((order) => (order.pickWaveNo || order.pickListNo) === row.waveNo && order.customerCode === customerCode);
    })
    .filter((row) => {
      if (!keyword) return true;
      const haystack = [row.waveNo, row.workMode, row.assignedPicker, row.carrierSummary, row.status, row.nextAction].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData) && !canAccessOpsModule(staff, "outbound", expansionData)) {
    return NextResponse.json({ error: "当前角色无权导出波次执行报表。" }, { status: 403 });
  }

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData.outboundOrders), url, coreData.outboundOrders);

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "report",
      targetId: "pick-waves",
      summary: "导出波次执行报表",
      note: `行数：${rows.length}`,
      after: {
        customerCode: url.searchParams.get("customerCode") ?? "",
        status: url.searchParams.get("status") ?? "all",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("波次执行效率报表.csv", [
    ["波次号", "作业模式", "拣货员", "订单数", "客户数", "SKU数", "应拣数量", "已拣数量", "已分拣数量", "已复核数量", "拣货缺口", "分拣缺口", "复核缺口", "拣货完成率", "分拣完成率", "复核完成率", "已发货订单", "待称重订单", "未处理异常", "严重异常", "承运商/渠道", "最新扫码时间", "停滞小时", "波次状态", "下一步处理"],
    ...rows.map((row) => [
      row.waveNo,
      row.workMode,
      row.assignedPicker,
      row.orderCount,
      row.customerCount,
      row.skuCount,
      row.requiredQty,
      row.pickedQty,
      row.sortedQty,
      row.packedQty,
      row.pickGap,
      row.sortGap,
      row.packGap,
      row.pickRate,
      row.sortRate,
      row.packRate,
      row.shippedOrders,
      row.pendingWeightOrders,
      row.exceptionCount,
      row.severeExceptionCount,
      row.carrierSummary,
      row.latestScanAt,
      row.idleHours,
      row.status,
      row.nextAction,
    ]),
  ]);
}
