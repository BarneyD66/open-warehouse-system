import { NextResponse } from "next/server";
import { getOpsExpansionData, listRunnableBatchOperationPlans, retryBatchOperationPlan, updateBatchOperationStatus } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireStaffSession();
  const url = new URL(request.url);
  if (url.searchParams.get("runnable") === "1") {
    const plans = await listRunnableBatchOperationPlans();
    return NextResponse.json({ plans });
  }
  const data = await getOpsExpansionData();
  return NextResponse.json({ plans: data.batchOperationPlans });
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    action?: "retry" | "mark_processing" | "mark_completed" | "mark_exception";
    id?: string;
    note?: string;
    error?: string;
  };
  if (!body.id) return NextResponse.json({ error: "缺少任务编号" }, { status: 400 });

  if (body.action === "retry") {
    const result = await retryBatchOperationPlan({ id: body.id, operator: staff.displayName || staff.username });
    if (result.error) return NextResponse.json({ error: result.error, plan: result.plan }, { status: 400 });
    return NextResponse.json({ plan: result.plan });
  }

  const status =
    body.action === "mark_processing"
      ? "processing"
      : body.action === "mark_completed"
        ? "completed"
        : body.action === "mark_exception"
          ? "exception"
          : null;
  if (!status) return NextResponse.json({ error: "不支持的任务动作" }, { status: 400 });

  const result = await updateBatchOperationStatus({ id: body.id, status, note: body.note, error: body.error });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ plan: result.plan });
}

