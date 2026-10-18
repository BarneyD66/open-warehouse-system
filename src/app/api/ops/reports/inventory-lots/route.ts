import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, type InventoryLot } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type InventoryLotReportRow = {
  lotId: string;
  customerCode: string;
  skuCode: string;
  warehouseCode: string;
  locationCode: string;
  lotNo: string;
  expiryDate: string;
  daysUntilExpiry: number | "";
  status: string;
  quantity: number;
  availableQty: number;
  reservedQty: number;
  serialTotal: number;
  serialActive: number;
  serialReserved: number;
  serialConsumed: number;
  serialBlocked: number;
  riskLevel: "正常" | "关注" | "高风险";
  riskReason: string;
  fefoPriority: string;
  updatedAt: string;
  note: string;
};

const statusLabels: Record<string, string> = {
  active: "可用",
  reserved: "已预留",
  blocked: "已冻结",
  expired: "已过期",
  depleted: "已耗尽",
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

function daysUntil(expiryDate?: string) {
  if (!expiryDate) return "";
  const expiry = new Date(`${expiryDate}T00:00:00`).getTime();
  if (!Number.isFinite(expiry)) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today.getTime()) / 86_400_000);
}

function riskForLot(lot: InventoryLot, days: number | "") {
  const reasons: string[] = [];
  if (lot.status === "blocked") reasons.push("批次已冻结");
  if (lot.status === "expired" || (typeof days === "number" && days < 0)) reasons.push("批次已过期");
  if (typeof days === "number" && days >= 0 && days <= 30) reasons.push("30 天内临期");
  if (lot.availableQty <= 0 && lot.reservedQty > 0) reasons.push("仅剩预留库存");
  if ((lot.serialNumberStatuses ?? []).some((item) => item.status === "blocked")) reasons.push("存在冻结序列号");
  if (lot.status === "depleted") reasons.push("批次已耗尽");

  const high = reasons.some((item) => item.includes("过期") || item.includes("冻结"));
  const level: InventoryLotReportRow["riskLevel"] = high ? "高风险" : reasons.length > 0 ? "关注" : "正常";
  return { level, reason: reasons.join("；") || "无明显风险" };
}

function serialCounts(lot: InventoryLot) {
  const records = lot.serialNumberStatuses ?? [];
  return {
    total: lot.serialNumbers?.length ?? records.length,
    active: records.filter((item) => item.status === "active").length,
    reserved: records.filter((item) => item.status === "reserved").length,
    consumed: records.filter((item) => item.status === "consumed").length,
    blocked: records.filter((item) => item.status === "blocked").length,
  };
}

function buildRows(lots: InventoryLot[]): InventoryLotReportRow[] {
  const activeBySku = new Map<string, InventoryLot[]>();
  for (const lot of lots) {
    if (lot.availableQty <= 0 || ["blocked", "expired", "depleted"].includes(lot.status)) continue;
    const key = `${lot.customerCode}::${lot.skuCode}`;
    activeBySku.set(key, [...(activeBySku.get(key) ?? []), lot]);
  }
  for (const rows of activeBySku.values()) {
    rows.sort((left, right) => (left.expiryDate || "9999-12-31").localeCompare(right.expiryDate || "9999-12-31") || left.createdAt.localeCompare(right.createdAt));
  }

  return lots.map((lot) => {
    const days = daysUntil(lot.expiryDate);
    const risk = riskForLot(lot, days);
    const serial = serialCounts(lot);
    const fefoIndex = (activeBySku.get(`${lot.customerCode}::${lot.skuCode}`) ?? []).findIndex((item) => item.id === lot.id);
    return {
      lotId: lot.id,
      customerCode: lot.customerCode,
      skuCode: lot.skuCode,
      warehouseCode: lot.warehouseCode,
      locationCode: lot.locationCode || "",
      lotNo: lot.lotNo,
      expiryDate: lot.expiryDate || "",
      daysUntilExpiry: days,
      status: statusLabels[lot.status] ?? lot.status,
      quantity: lot.quantity,
      availableQty: lot.availableQty,
      reservedQty: lot.reservedQty,
      serialTotal: serial.total,
      serialActive: serial.active,
      serialReserved: serial.reserved,
      serialConsumed: serial.consumed,
      serialBlocked: serial.blocked,
      riskLevel: risk.level,
      riskReason: risk.reason,
      fefoPriority: fefoIndex >= 0 ? `第 ${fefoIndex + 1} 顺位` : "不参与 FEFO",
      updatedAt: lot.updatedAt || lot.createdAt,
      note: lot.note ?? "",
    };
  });
}

function applyFilters(rows: InventoryLotReportRow[], url: URL) {
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const skuCode = clean(url.searchParams.get("skuCode")).toLowerCase();
  const status = clean(url.searchParams.get("status"));
  const risk = clean(url.searchParams.get("risk"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.lotId, row.customerCode, row.skuCode, row.warehouseCode, row.locationCode, row.lotNo, row.status, row.riskReason, row.note].join(" ").toLowerCase();
    return (
      (!customerCode || row.customerCode.toLowerCase().includes(customerCode)) &&
      (!skuCode || row.skuCode.toLowerCase().includes(skuCode)) &&
      (!status || status === "all" || row.status === status || row.status.toLowerCase() === status.toLowerCase()) &&
      (!risk || risk === "all" || row.riskLevel === risk || row.riskReason.includes(risk)) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出库存批次风险报表。" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData.inventoryLots), url).sort((left, right) => {
    const riskOrder = { 高风险: 0, 关注: 1, 正常: 2 };
    return riskOrder[left.riskLevel] - riskOrder[right.riskLevel] || String(left.daysUntilExpiry || 99999).localeCompare(String(right.daysUntilExpiry || 99999)) || left.skuCode.localeCompare(right.skuCode);
  });

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "inventory-lots",
      summary: "导出库存批次风险报表",
      note: `行数：${rows.length}`,
      after: {
        customerCode: url.searchParams.get("customerCode") ?? "",
        skuCode: url.searchParams.get("skuCode") ?? "",
        status: url.searchParams.get("status") ?? "all",
        risk: url.searchParams.get("risk") ?? "all",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("库存批次风险报表.csv", [
    ["批次ID", "客户编号", "SKU", "仓库", "库位", "批次号", "效期", "距到期天数", "状态", "批次数量", "可用数量", "预留数量", "序列号总数", "可用序列号", "预留序列号", "已消耗序列号", "冻结序列号", "风险等级", "风险原因", "FEFO建议", "更新时间", "备注"],
    ...rows.map((row) => [
      row.lotId,
      row.customerCode,
      row.skuCode,
      row.warehouseCode,
      row.locationCode,
      row.lotNo,
      row.expiryDate,
      row.daysUntilExpiry,
      row.status,
      row.quantity,
      row.availableQty,
      row.reservedQty,
      row.serialTotal,
      row.serialActive,
      row.serialReserved,
      row.serialConsumed,
      row.serialBlocked,
      row.riskLevel,
      row.riskReason,
      row.fefoPriority,
      row.updatedAt,
      row.note,
    ]),
  ]);
}
