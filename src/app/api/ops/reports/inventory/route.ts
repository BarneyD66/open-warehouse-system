import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, type InventoryBalance, type InventoryMovement } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type InventoryReportKind = "aging" | "turnover" | "reconcile";

type InventoryReportFilters = {
  customerCode?: string;
  warehouseCode?: string;
  locationCode?: string;
  skuCode?: string;
  risk?: string;
  keyword?: string;
};

const reportKindLabels: Record<InventoryReportKind, string> = {
  aging: "库龄分析",
  turnover: "进销存",
  reconcile: "库存对账",
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

function normalizeKind(value: string | null): InventoryReportKind {
  if (value === "turnover" || value === "reconcile") return value;
  return "aging";
}

function totalQty(item: InventoryBalance) {
  return item.availableQty + item.reservedQty + item.frozenQty + item.defectiveQty + item.inboundQty;
}

function balanceRisk(item: InventoryBalance) {
  return [item.availableQty < item.alertQty ? "低于预警" : "", item.agingDays >= 120 ? "库龄偏高" : "", item.frozenQty > 0 ? "存在冻结" : "", item.defectiveQty > 0 ? "存在残次品" : ""].filter(Boolean);
}

function applyFilters(balances: InventoryBalance[], filters: InventoryReportFilters) {
  const customerCode = filters.customerCode?.toUpperCase();
  const warehouseCode = filters.warehouseCode?.toUpperCase();
  const locationCode = filters.locationCode?.toUpperCase();
  const skuCode = filters.skuCode?.toUpperCase();
  const keyword = filters.keyword?.toLowerCase();
  return balances.filter((item) => {
    const risks = balanceRisk(item);
    const haystack = [item.customerCode, item.warehouseCode, item.locationCode, item.skuCode, risks.join(" "), totalQty(item)].join(" ").toLowerCase();
    return (
      (!customerCode || item.customerCode.toUpperCase() === customerCode) &&
      (!warehouseCode || item.warehouseCode.toUpperCase() === warehouseCode) &&
      (!locationCode || (item.locationCode ?? "").toUpperCase() === locationCode) &&
      (!skuCode || item.skuCode.toUpperCase() === skuCode) &&
      (!filters.risk || filters.risk === "all" || risks.includes(filters.risk)) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

function movementBuckets(movements: InventoryMovement[]) {
  const map = new Map<string, { inbound: number; outbound: number; adjustment: number; release: number }>();
  movements.forEach((movement) => {
    const current = map.get(`${movement.customerCode}:${movement.skuCode}`) ?? { inbound: 0, outbound: 0, adjustment: 0, release: 0 };
    if (movement.movementType === "in") current.inbound += movement.quantity;
    else if (movement.movementType === "out") current.outbound += movement.quantity;
    else if (movement.movementType === "adjust") current.adjustment += movement.quantity;
    else if (movement.movementType === "release") current.release += movement.quantity;
    map.set(`${movement.customerCode}:${movement.skuCode}`, current);
  });
  return map;
}

function agingBucket(days: number) {
  if (days >= 365) return "365 天以上";
  if (days >= 180) return "180-365 天";
  if (days >= 90) return "90-180 天";
  if (days >= 30) return "30-90 天";
  return "0-30 天";
}

function agingRows(balances: InventoryBalance[]) {
  return [
    ["客户编号", "仓库", "库位", "SKU 编码", "可用库存", "占用库存", "冻结库存", "残次品库存", "在途库存", "库存合计", "库龄天数", "库龄分组", "风险"],
    ...balances.map((item) => {
      const risk = balanceRisk(item).join("；");
      return [item.customerCode, item.warehouseCode, item.locationCode ?? "", item.skuCode, item.availableQty, item.reservedQty, item.frozenQty, item.defectiveQty, item.inboundQty, totalQty(item), item.agingDays, agingBucket(item.agingDays), risk || "正常"];
    }),
  ];
}

function turnoverRows(balances: InventoryBalance[], movements: InventoryMovement[]) {
  const buckets = movementBuckets(movements);
  return [
    ["客户编号", "仓库", "库位", "SKU 编码", "期初估算库存", "本期入库", "本期出库", "调整/释放", "期末库存", "可用库存", "占用库存", "在途库存"],
    ...balances.map((item) => {
      const movement = buckets.get(`${item.customerCode}:${item.skuCode}`) ?? { inbound: 0, outbound: 0, adjustment: 0, release: 0 };
      const ending = totalQty(item);
      const adjustment = movement.adjustment + movement.release;
      const openingEstimate = ending - movement.inbound + movement.outbound - adjustment;
      return [item.customerCode, item.warehouseCode, item.locationCode ?? "", item.skuCode, openingEstimate, movement.inbound, movement.outbound, adjustment, ending, item.availableQty, item.reservedQty, item.inboundQty];
    }),
  ];
}

function reconcileRows(balances: InventoryBalance[], movements: InventoryMovement[]) {
  const movementCount = new Map<string, number>();
  movements.forEach((movement) => {
    const key = `${movement.customerCode}:${movement.skuCode}`;
    movementCount.set(key, (movementCount.get(key) ?? 0) + 1);
  });
  return [
    ["客户编号", "仓库", "库位", "SKU 编码", "库存合计", "流水条数", "对账结果", "处理建议"],
    ...balances.map((item) => {
      const qty = totalQty(item);
      const count = movementCount.get(`${item.customerCode}:${item.skuCode}`) ?? 0;
      const result = qty < 0 ? "库存为负" : count === 0 && qty > 0 ? "缺少流水" : "正常";
      const suggestion = result === "库存为负" ? "请发起库存调整审批" : result === "缺少流水" ? "请核对初始化库存来源" : "";
      return [item.customerCode, item.warehouseCode, item.locationCode ?? "", item.skuCode, qty, count, result, suggestion];
    }),
  ];
}

async function recordReportExport(input: { staffName: string; kind: InventoryReportKind; filters: InventoryReportFilters; rowCount: number; direct: boolean }) {
  if (!input.direct) return;
  await recordAuditLog({
    action: "report_export",
    actorRole: "staff",
    actorName: input.staffName,
    targetType: "report",
    targetId: `inventory-${input.kind}`,
    summary: `导出库存报表：${reportKindLabels[input.kind]}`,
    note: "直接从运营报表按钮导出",
    after: {
      module: "inventory",
      kind: input.kind,
      filters: input.filters,
      rowCount: input.rowCount,
    },
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出报表" }, { status: 403 });

  const url = new URL(request.url);
  const kind = normalizeKind(url.searchParams.get("kind"));
  const filters: InventoryReportFilters = {
    customerCode: clean(url.searchParams.get("customerCode")),
    warehouseCode: clean(url.searchParams.get("warehouseCode") || url.searchParams.get("warehouse")),
    locationCode: clean(url.searchParams.get("locationCode") || url.searchParams.get("location")),
    skuCode: clean(url.searchParams.get("skuCode") || url.searchParams.get("sku")),
    risk: clean(url.searchParams.get("risk")),
    keyword: clean(url.searchParams.get("keyword")),
  };

  const coreData = await getWarehouseCoreData();
  const balances = applyFilters(coreData.inventoryBalances, filters);
  const balanceKeys = new Set(balances.map((item) => `${item.customerCode}:${item.skuCode}`));
  const movements = coreData.inventoryMovements.filter((item) => balanceKeys.has(`${item.customerCode}:${item.skuCode}`));
  const rows = kind === "turnover" ? turnoverRows(balances, movements) : kind === "reconcile" ? reconcileRows(balances, movements) : agingRows(balances);

  await recordReportExport({
    staffName: staff.displayName || staff.username,
    kind,
    filters,
    rowCount: Math.max(0, rows.length - 1),
    direct: url.searchParams.get("auditSource") !== "saved_view",
  });

  return csvResponse(`${reportKindLabels[kind]}报表.csv`, rows);
}
