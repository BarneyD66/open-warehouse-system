import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { createReplenishmentPlanFromBalance, createTransferOrderFromBalance, getWarehouseCoreData, buildReplenishmentSuggestions, progressTransferOrder, type TransferLifecycleAction } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

export async function GET() {
  await requireStaffSession();
  const data = await getWarehouseCoreData();

  return NextResponse.json({
    suggestions: buildReplenishmentSuggestions(data),
    plans: data.replenishmentPlans,
    transferOrders: data.transferOrders,
  });
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    action?: "create_plan" | "create_transfer" | "progress_transfer";
    balanceId?: string;
    transferId?: string;
    transferAction?: TransferLifecycleAction;
    plannedQty?: number;
    quantity?: number;
    fromWarehouseCode?: string;
    toWarehouseCode?: string;
    carrierName?: string;
    trackingNumber?: string;
    relatedPlanId?: string;
    note?: string;
  };

  const operator = staff.displayName || staff.username;

  if (body.action === "create_plan") {
    if (!body.balanceId) return NextResponse.json({ error: "缺少库存记录" }, { status: 400 });
    const result = await createReplenishmentPlanFromBalance({
      balanceId: body.balanceId,
      plannedQty: body.plannedQty,
      note: body.note,
      createdBy: operator,
    });
    if (!result.plan) return NextResponse.json({ error: result.error || "补货计划创建失败" }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "create_transfer") {
    if (!body.balanceId) return NextResponse.json({ error: "缺少库存记录" }, { status: 400 });
    const result = await createTransferOrderFromBalance({
      balanceId: body.balanceId,
      fromWarehouseCode: body.fromWarehouseCode,
      toWarehouseCode: body.toWarehouseCode,
      quantity: body.quantity,
      relatedPlanId: body.relatedPlanId,
      note: body.note,
      createdBy: operator,
    });
    if (!result.transfer) return NextResponse.json({ error: result.error || "调拨单创建失败" }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "progress_transfer") {
    if (!body.transferId || !body.transferAction) return NextResponse.json({ error: "缺少调拨单号或调拨操作" }, { status: 400 });
    const result = await progressTransferOrder({
      id: body.transferId,
      action: body.transferAction,
      quantity: body.quantity,
      carrierName: body.carrierName,
      trackingNumber: body.trackingNumber,
      note: body.note,
      operator,
    });
    if (!result.transfer || result.error) return NextResponse.json({ error: result.error || "调拨状态推进失败" }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "不支持的补货调拨操作" }, { status: 400 });
}
