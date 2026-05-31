import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, importWarehouseLocationsCsv, upsertWarehouseLocation, type WarehouseLocation } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  await requireStaffSession();
  const data = await getWarehouseCoreData();
  return NextResponse.json({ locations: data.locations });
}

export async function POST(request: Request) {
  await requireStaffSession();
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    const result = await importWarehouseLocationsCsv(await request.text());
    return NextResponse.json(result);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const locationCode = clean(body.locationCode);
  const status = clean(body.status) || "active";
  const allowMixedSku = body.allowMixedSku === undefined ? true : Boolean(body.allowMixedSku);
  if (!locationCode) return NextResponse.json({ error: "请填写库位编码" }, { status: 400 });
  if (!["active", "blocked", "reserved"].includes(status)) return NextResponse.json({ error: "库位状态无效" }, { status: 400 });

  const location = await upsertWarehouseLocation({
    locationCode,
    warehouseCode: clean(body.warehouseCode) || "SHEFFIELD-MAIN",
    zone: clean(body.zone) || "MAIN",
    zoneType: clean(body.zoneType) as WarehouseLocation["zoneType"],
    status: status as WarehouseLocation["status"],
    capacityCbm: Number(body.capacityCbm) || undefined,
    capacityQty: Number(body.capacityQty) || undefined,
    allowMixedSku,
    note: clean(body.note),
  });

  if (!location) return NextResponse.json({ error: "库位信息不完整" }, { status: 400 });
  return NextResponse.json({ location });
}
