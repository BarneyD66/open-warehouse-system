import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { buildStocktakeCandidates, countStocktakeBatchItem, createStocktakeBatch, getWarehouseCoreData, submitStocktakeBatch } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

export async function GET() {
  await requireStaffSession();
  const data = await getWarehouseCoreData();
  return NextResponse.json({
    candidates: buildStocktakeCandidates(data),
    batches: data.stocktakeBatches,
  });
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    action?: "create_batch" | "count_item" | "submit_batch";
    batchId?: string;
    balanceId?: string;
    countedAvailableQty?: number;
    warehouseCode?: string;
    customerCode?: string;
    balanceIds?: string[];
    note?: string;
  };
  const operator = staff.displayName || staff.username;

  if (body.action === "create_batch") {
    const result = await createStocktakeBatch({
      warehouseCode: body.warehouseCode,
      customerCode: body.customerCode,
      balanceIds: Array.isArray(body.balanceIds) ? body.balanceIds : undefined,
      note: body.note,
      createdBy: operator,
    });
    if (!result.batch) return NextResponse.json({ error: result.error || "盘点批次创建失败" }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "count_item") {
    if (!body.batchId || !body.balanceId) return NextResponse.json({ error: "缺少盘点批次或库存记录" }, { status: 400 });
    const result = await countStocktakeBatchItem({
      batchId: body.batchId,
      balanceId: body.balanceId,
      countedAvailableQty: Number(body.countedAvailableQty),
      note: body.note,
      countedBy: operator,
    });
    if (!result.batch || result.error) return NextResponse.json({ error: result.error || "盘点数量保存失败" }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "submit_batch") {
    if (!body.batchId) return NextResponse.json({ error: "缺少盘点批次" }, { status: 400 });
    const result = await submitStocktakeBatch({
      batchId: body.batchId,
      submittedBy: operator,
    });
    if (!result.batch || result.error) return NextResponse.json({ error: result.error || "盘点批次提交失败" }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "不支持的盘点操作" }, { status: 400 });
}
