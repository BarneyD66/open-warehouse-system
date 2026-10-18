import { NextResponse } from "next/server";
import { hasDocumentForRef } from "@/lib/documentStore";
import { approvalRuleForTrigger, approvalRuleNote, getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { createOpsBillingRecordFromRule, getWarehouseCoreData, type BillingFeeCode, type BillingRecord } from "@/lib/warehouseCoreStore";

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
  const approvalRule = body.feeCode === "manual_service" ? approvalRuleForTrigger(await getOpsExpansionData(), "manual_fee_adjustment", Number(body.quantity), 1) : undefined;
  if (approvalRule && !approvalRule.approverRoles.includes(staff.role)) return NextResponse.json({ error: `当前审批规则要求 ${approvalRule.approverRoles.join("、")} 审批` }, { status: 403 });
  if (approvalRule?.requireReason && !body.note?.trim()) return NextResponse.json({ error: "当前审批规则要求填写手工费用调整原因" }, { status: 400 });
  if (approvalRule?.requireAttachment) {
    const hasAttachment = await hasDocumentForRef({ customerCode: body.customerCode.trim(), refType: "approval", refId: `manual-fee:${body.customerCode.trim()}` });
    if (!hasAttachment) return NextResponse.json({ error: "当前审批规则要求先上传手工费用审批附件" }, { status: 400 });
  }

  if (body.refId && ["return_inspection", "return_restock", "return_disposal"].includes(body.feeCode)) {
    const coreData = await getWarehouseCoreData();
    const returnOrder = coreData.returnOrders.find((item) => item.id === body.refId && item.customerCode === body.customerCode?.trim());
    if (!returnOrder) return NextResponse.json({ error: "未找到该客户的退货单" }, { status: 400 });
    if (body.feeCode === "return_inspection" && !["received", "inspection", "restocked", "repair", "disposed", "closed", "exception"].includes(returnOrder.status)) {
      return NextResponse.json({ error: "退货单尚未到仓或质检，不能生成退货质检费" }, { status: 400 });
    }
    if (body.feeCode === "return_restock" && returnOrder.status !== "restocked" && returnOrder.resolution !== "restock") {
      return NextResponse.json({ error: "退货单未标记重新上架，不能生成退货上架费" }, { status: 400 });
    }
    if (body.feeCode === "return_disposal" && returnOrder.status !== "disposed" && returnOrder.resolution !== "dispose") {
      return NextResponse.json({ error: "退货单未标记报废，不能生成退货销毁费" }, { status: 400 });
    }
  }

  const { record, error } = await createOpsBillingRecordFromRule({
    customerCode: body.customerCode.trim(),
    feeCode: body.feeCode,
    quantity: Number(body.quantity),
    refId: body.refId,
    note: [body.note, approvalRule ? approvalRuleNote(approvalRule) : ""].filter(Boolean).join(" / "),
    dueDate: body.dueDate,
    status: body.status || "pending_confirmation",
    reviewer: staff.displayName || staff.username,
  });

  if (error || !record) return NextResponse.json({ error: error || "账单生成失败" }, { status: 400 });
  return NextResponse.json({ record });
}
