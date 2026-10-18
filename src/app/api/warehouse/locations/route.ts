import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, importWarehouseLocationsCsv, upsertWarehouseLocation, type WarehouseLocation } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET() {
  await requireStaffSession();
  const data = await getWarehouseCoreData();
  return NextResponse.json({ locations: data.locations });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "warehouse-location-write"), 80, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "库位维护过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const operator = staff.displayName || staff.username;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    const result = await importWarehouseLocationsCsv(await request.text());
    await recordAuditLog({
      action: "warehouse_location_update",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "warehouse_location",
      targetId: "location-csv-import",
      summary: "批量导入仓库库位",
      note: `成功 ${result.imported ?? 0} 条，异常 ${result.errors?.length ?? 0} 条。`,
      after: result,
    });
    return NextResponse.json(result);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const locationCode = clean(body.locationCode).toUpperCase();
  const status = clean(body.status) || "active";
  const allowMixedSku = body.allowMixedSku === undefined ? true : Boolean(body.allowMixedSku);
  if (!locationCode) return NextResponse.json({ error: "请填写库位编码。" }, { status: 400 });
  if (!["active", "blocked", "reserved"].includes(status)) return NextResponse.json({ error: "库位状态无效。" }, { status: 400 });

  const location = await upsertWarehouseLocation({
    locationCode,
    warehouseCode: clean(body.warehouseCode).toUpperCase() || "SHEFFIELD-MAIN",
    zone: clean(body.zone).toUpperCase() || "MAIN",
    zoneType: clean(body.zoneType) as WarehouseLocation["zoneType"],
    status: status as WarehouseLocation["status"],
    capacityCbm: positiveNumber(body.capacityCbm),
    capacityQty: positiveNumber(body.capacityQty),
    allowMixedSku,
    note: clean(body.note),
  });

  if (!location) return NextResponse.json({ error: "库位信息不完整。" }, { status: 400 });
  await recordAuditLog({
    action: "warehouse_location_update",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "warehouse_location",
    targetId: location.locationCode,
    summary: "新增/更新仓库库位",
    note: `库区 ${location.zone}，状态 ${location.status}，容量 ${location.capacityQty ?? "-"} 件。`,
    after: location,
  });

  return NextResponse.json({ location });
}
