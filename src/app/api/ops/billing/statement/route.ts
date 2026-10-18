import { NextResponse } from "next/server";
import { hasDocumentForRef } from "@/lib/documentStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { approvalRuleForTrigger, approvalRuleNote, getOpsExpansionData } from "@/lib/opsExpansionStore";
import { secondConfirmationError } from "@/lib/staffPermissions";
import { getWarehouseCoreData, updateBillingStatementLock, updateStaffBillingStatement } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const actions = new Set(["lock", "unlock", "mark_paid", "issue_invoice", "void_invoice", "reopen", "resolve_dispute", "reject_payment"]);

function billingMonth(record: { dueDate?: string; createdAt: string }) {
  return (record.dueDate || record.createdAt).slice(0, 7);
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    customerCode?: string;
    month?: string;
    action?: "lock" | "unlock" | "mark_paid" | "issue_invoice" | "void_invoice" | "reopen" | "resolve_dispute" | "reject_payment";
    paymentReference?: string;
    reviewNote?: string;
    confirmation?: string;
  };

  if (!body.customerCode?.trim()) return NextResponse.json({ error: "请选择客户" }, { status: 400 });
  if (!body.month?.trim() || !/^\d{4}-\d{2}$/.test(body.month)) return NextResponse.json({ error: "请选择正确的账单月份" }, { status: 400 });
  if (!body.action || !actions.has(body.action)) return NextResponse.json({ error: "不支持的月结操作" }, { status: 400 });

  const reviewer = staff.displayName || staff.username;
  let approvalNote = body.reviewNote?.trim() ?? "";
  const expansionData = await getOpsExpansionData();
  if (body.action === "lock" || body.action === "unlock") {
    const expectedConfirmation = `${body.customerCode.trim()}-${body.month.trim()}`;
    const secondConfirmError = secondConfirmationError({
      staff,
      action: "账单锁定",
      confirmation: body.confirmation,
      expected: expectedConfirmation,
      data: expansionData,
    });
    if (secondConfirmError) return NextResponse.json({ error: secondConfirmError }, { status: 400 });
  }
  if (body.action === "lock") {
    const coreData = await getWarehouseCoreData();
    const amount = coreData.billingRecords
      .filter((item) => item.customerCode === body.customerCode?.trim() && billingMonth(item) === body.month?.trim())
      .reduce((sum, item) => sum + item.amount, 0);
    const approvalRule = approvalRuleForTrigger(expansionData, "billing_lock", amount, 0);
    if (approvalRule && !approvalRule.approverRoles.includes(staff.role)) return NextResponse.json({ error: `当前审批规则要求 ${approvalRule.approverRoles.join("、")} 审批` }, { status: 403 });
    if (approvalRule?.requireReason && !approvalNote) return NextResponse.json({ error: "当前审批规则要求填写锁账原因" }, { status: 400 });
    if (approvalRule?.requireAttachment) {
      const statementId = `STMT-${body.customerCode.trim()}-${body.month.trim()}`;
      const hasAttachment = await hasDocumentForRef({ customerCode: body.customerCode.trim(), refType: "billing", refId: statementId });
      if (!hasAttachment) return NextResponse.json({ error: "当前审批规则要求先上传账单审批附件" }, { status: 400 });
    }
    approvalNote = [approvalNote, approvalRuleNote(approvalRule)].filter(Boolean).join(" / ");
  }
  const { records, error } = body.action === "lock" || body.action === "unlock"
    ? await updateBillingStatementLock({
        customerCode: body.customerCode.trim(),
        month: body.month.trim(),
        action: body.action,
        reviewer,
        reviewNote: approvalNote,
      })
    : await updateStaffBillingStatement({
        customerCode: body.customerCode.trim(),
        month: body.month.trim(),
        action: body.action,
        reviewer,
        paymentReference: body.paymentReference,
        reviewNote: body.reviewNote,
      });

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ records });
}
