import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getLocationUtilization, getWarehouseCoreData, warehouseLocationStatusLabel, warehouseLocationZoneTypeLabel, type WarehouseLocation } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type LocationRisk = "接近满仓" | "已超容量" | "未设置容量" | "库位停用" | "预留库位" | "混 SKU 风险" | "空库位" | "正常";

type LocationReportRow = {
  warehouseCode: string;
  locationCode: string;
  zone: string;
  zoneType: string;
  status: string;
  capacityQty?: number;
  usedQty: number;
  remainingQty?: number;
  occupancyRate?: number;
  skuCount: number;
  allowMixedSku: boolean;
  risks: LocationRisk[];
  updatedAt: string;
  note?: string;
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

function occupancyText(rate?: number) {
  if (typeof rate !== "number") return "";
  return `${Math.round(rate * 1000) / 10}%`;
}

function locationRisks(location: WarehouseLocation, usedQty: number, skuCount: number, occupancyRate?: number): LocationRisk[] {
  const risks: LocationRisk[] = [];
  if (location.status === "blocked") risks.push("库位停用");
  if (location.status === "reserved") risks.push("预留库位");
  if (typeof location.capacityQty !== "number" || location.capacityQty <= 0) risks.push("未设置容量");
  if (typeof location.capacityQty === "number" && location.capacityQty > 0 && usedQty > location.capacityQty) risks.push("已超容量");
  if (typeof occupancyRate === "number" && occupancyRate >= 0.9 && usedQty <= (location.capacityQty ?? Number.POSITIVE_INFINITY)) risks.push("接近满仓");
  if (location.allowMixedSku === false && skuCount > 1) risks.push("混 SKU 风险");
  if (location.status === "active" && usedQty === 0) risks.push("空库位");
  return risks.length ? risks : ["正常"];
}

function buildRows(data: Awaited<ReturnType<typeof getWarehouseCoreData>>) {
  return data.locations.map<LocationReportRow>((location) => {
    const utilization = getLocationUtilization(data, location.locationCode);
    const risks = locationRisks(location, utilization.usedQty, utilization.skuCount, utilization.occupancyRate);
    return {
      warehouseCode: location.warehouseCode,
      locationCode: location.locationCode,
      zone: location.zone,
      zoneType: warehouseLocationZoneTypeLabel(location.zoneType),
      status: warehouseLocationStatusLabel(location.status),
      capacityQty: utilization.capacityQty,
      usedQty: utilization.usedQty,
      remainingQty: utilization.remainingQty,
      occupancyRate: utilization.occupancyRate,
      skuCount: utilization.skuCount,
      allowMixedSku: location.allowMixedSku !== false,
      risks,
      updatedAt: location.updatedAt,
      note: location.note,
    };
  });
}

function applyFilters(rows: LocationReportRow[], url: URL) {
  const warehouseCode = url.searchParams.get("warehouseCode")?.trim().toUpperCase() || url.searchParams.get("warehouse")?.trim().toUpperCase();
  const zone = url.searchParams.get("zone")?.trim().toLowerCase();
  const zoneType = url.searchParams.get("zoneType")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const risk = url.searchParams.get("risk")?.trim();
  const keyword = url.searchParams.get("keyword")?.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.warehouseCode, row.locationCode, row.zone, row.zoneType, row.status, row.risks.join(" "), row.note].join(" ").toLowerCase();
    return (
      (!warehouseCode || row.warehouseCode.toUpperCase() === warehouseCode) &&
      (!zone || row.zone.toLowerCase().includes(zone)) &&
      (!zoneType || zoneType === "all" || row.zoneType === zoneType) &&
      (!status || status === "all" || row.status === status) &&
      (!risk || risk === "all" || row.risks.includes(risk as LocationRisk)) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出库位利用率报表" }, { status: 403 });

  const url = new URL(request.url);
  const data = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(data), url).sort((a, b) => b.usedQty - a.usedQty || a.locationCode.localeCompare(b.locationCode));

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "location-utilization",
      summary: "导出库位利用率报表",
      note: "覆盖库位容量、占用、空库位、满仓和混 SKU 风险",
      after: {
        warehouseCode: url.searchParams.get("warehouseCode") ?? url.searchParams.get("warehouse") ?? "",
        zone: url.searchParams.get("zone") ?? "",
        zoneType: url.searchParams.get("zoneType") ?? "",
        status: url.searchParams.get("status") ?? "",
        risk: url.searchParams.get("risk") ?? "",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  return csvResponse("库位利用率报表.csv", [
    ["仓库", "库位", "区域", "库区类型", "状态", "容量件数", "已占用件数", "剩余件数", "利用率", "SKU 数", "是否允许混 SKU", "风险提示", "更新时间", "备注"],
    ...rows.map((row) => [
      row.warehouseCode,
      row.locationCode,
      row.zone,
      row.zoneType,
      row.status,
      row.capacityQty ?? "",
      row.usedQty,
      row.remainingQty ?? "",
      occupancyText(row.occupancyRate),
      row.skuCount,
      row.allowMixedSku ? "允许" : "不允许",
      row.risks.join("；"),
      row.updatedAt,
      row.note ?? "",
    ]),
  ]);
}
