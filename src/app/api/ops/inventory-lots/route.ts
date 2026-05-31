import { NextResponse } from "next/server";
import { recordAuditLog, type AuditAction } from "@/lib/auditLogStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { createInventoryLot, getWarehouseCoreData, updateInventoryLot } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const auditActions: Record<string, AuditAction> = {
  reserve: "inventory_lot_reserve",
  release: "inventory_lot_release",
  consume: "inventory_lot_consume",
  block: "inventory_lot_block",
  activate: "inventory_lot_activate",
  update: "inventory_lot_update",
};

export async function GET() {
  await requireStaffSession();
  const data = await getWarehouseCoreData();
  return NextResponse.json({ lots: data.inventoryLots });
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action) || "create";

  if (action === "create") {
    const result = await createInventoryLot({
      customerCode: clean(body.customerCode),
      skuCode: clean(body.skuCode),
      warehouseCode: clean(body.warehouseCode),
      locationCode: clean(body.locationCode),
      lotNo: clean(body.lotNo),
      expiryDate: clean(body.expiryDate),
      serialNumbers: clean(body.serialNumbers),
      quantity: Number(body.quantity),
      note: clean(body.note),
      createdBy: staff.displayName || staff.username,
    });
    if (!result.lot) return NextResponse.json({ error: result.error || "库存批次创建失败" }, { status: 400 });
    await recordAuditLog({
      action: "inventory_lot_create",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "inventory_lot",
      targetId: result.lot.id,
      customerCode: result.lot.customerCode,
      summary: `登记库存批次：${result.lot.skuCode} / ${result.lot.lotNo}`,
      note: result.lot.note,
      after: result.lot,
    });
    return NextResponse.json({ lot: result.lot });
  }

  const result = await updateInventoryLot({
    id: clean(body.id),
    action: action as "reserve" | "release" | "consume" | "block" | "activate" | "update",
    quantity: Number(body.quantity),
    locationCode: body.locationCode === undefined ? undefined : clean(body.locationCode),
    expiryDate: body.expiryDate === undefined ? undefined : clean(body.expiryDate),
    note: clean(body.note),
    operator: staff.displayName || staff.username,
  });
  if (!result.lot) return NextResponse.json({ error: result.error || "未找到库存批次" }, { status: 404 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditLog({
    action: auditActions[action] ?? "inventory_lot_update",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "inventory_lot",
    targetId: result.lot.id,
    customerCode: result.lot.customerCode,
    summary: `更新库存批次：${result.lot.skuCode} / ${result.lot.lotNo}`,
    note: clean(body.note),
    after: result.lot,
  });

  return NextResponse.json({ lot: result.lot });
}
