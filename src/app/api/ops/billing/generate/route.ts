import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { createOpsBillingRecordFromRule, type BillingFeeCode, type BillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const allowedStatuses = new Set<BillingRecord["status"]>(["draft", "pending_confirmation"]);

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    customerCode?: string;
    feeCode?: BillingFeeCode;
    quantity?: number;
    refId?: string;
    note?: string;
    dueDate?: string;
    status?: BillingRecord["status"];
  };

  if (!body.customerCode?.trim()) return NextResponse.json({ error: "请选择客户" }, { status: 400 });
  if (!body.feeCode) return NextResponse.json({ error: "请选择费用规则" }, { status: 400 });
  if (!body.quantity || !Number.isFinite(Number(body.quantity)) || Number(body.quantity) <= 0) {
    return NextResponse.json({ error: "费用数量必须大于 0" }, { status: 400 });
  }
  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "不支持的账单状态" }, { status: 400 });
  }

  const { record, error } = await createOpsBillingRecordFromRule({
    customerCode: body.customerCode.trim(),
    feeCode: body.feeCode,
    quantity: Number(body.quantity),
    refId: body.refId,
    note: body.note,
    dueDate: body.dueDate,
    status: body.status || "pending_confirmation",
    reviewer: staff.displayName || staff.username,
  });

  if (error || !record) return NextResponse.json({ error: error || "账单生成失败" }, { status: 400 });
  return NextResponse.json({ record });
}
