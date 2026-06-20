import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, updateBillingInvoiceStatus, updateStaffBillingRecord, type BillingInvoiceStatus, type BillingPaymentReviewAction, type BillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const staffStatuses = new Set(["pending_confirmation", "confirmed", "payment_submitted", "paid", "disputed"]);
const invoiceStatuses = new Set(["not_requested", "requested", "issued", "voided"]);
const paymentActions = new Set(["mark_paid", "reject_payment", "resolve_dispute", "reopen"]);

const paymentActionLabels: Record<BillingPaymentReviewAction, string> = {
  mark_paid: "确认到账",
  reject_payment: "驳回付款凭证",
  resolve_dispute: "解除费用异议",
  reopen: "重新打开账单",
};

const invoiceStatusLabels: Record<BillingInvoiceStatus, string> = {
  not_requested: "未申请开票",
  requested: "已申请开票",
  issued: "已开票",
  voided: "已作废",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: BillingPaymentReviewAction;
    status?: BillingRecord["status"];
    reviewNote?: string;
    paymentReference?: string;
    invoiceStatus?: BillingInvoiceStatus;
    invoiceNote?: string;
  };
  const actorName = staff.displayName || staff.username;
  const beforeRecord = (await getWarehouseCoreData()).billingRecords.find((item) => item.id === id);
  if (!beforeRecord) return NextResponse.json({ error: "未找到账单记录" }, { status: 404 });

  if (body.invoiceStatus) {
    if (!invoiceStatuses.has(body.invoiceStatus)) return NextResponse.json({ error: "不支持的开票状态" }, { status: 400 });

    const record = await updateBillingInvoiceStatus({
      id,
      invoiceStatus: body.invoiceStatus,
      reviewer: actorName,
      invoiceNote: body.invoiceNote,
    });

    if (!record) return NextResponse.json({ error: "未找到账单记录" }, { status: 404 });
    await recordAuditLog({
      action: "billing_invoice_review",
      actorRole: "staff",
      actorName,
      targetType: "billing",
      targetId: id,
      customerCode: record.customerCode,
      summary: `账单开票状态更新为 ${invoiceStatusLabels[body.invoiceStatus]}`,
      note: body.invoiceNote?.trim(),
      before: beforeRecord,
      after: record,
    });
    return NextResponse.json({ record });
  }

  if (body.action) {
    if (!paymentActions.has(body.action)) return NextResponse.json({ error: "不支持的账单复核动作" }, { status: 400 });
    if (body.action === "reject_payment" && beforeRecord.status !== "payment_submitted") {
      return NextResponse.json({ error: "只有付款待复核的账单可以驳回付款凭证" }, { status: 400 });
    }

    const record = await updateStaffBillingRecord({
      id,
      action: body.action,
      reviewer: actorName,
      reviewNote: body.reviewNote,
      paymentReference: body.paymentReference,
    });

    if (!record) return NextResponse.json({ error: "未找到账单记录" }, { status: 404 });
    await recordAuditLog({
      action: "billing_payment_review",
      actorRole: "staff",
      actorName,
      targetType: "billing",
      targetId: id,
      customerCode: record.customerCode,
      summary: paymentActionLabels[body.action],
      note: body.reviewNote?.trim(),
      before: beforeRecord,
      after: record,
    });
    return NextResponse.json({ record });
  }

  if (!body.status || !staffStatuses.has(body.status)) return NextResponse.json({ error: "不支持的账单状态" }, { status: 400 });

  const record = await updateStaffBillingRecord({
    id,
    status: body.status,
    reviewer: actorName,
    reviewNote: body.reviewNote,
  });

  if (!record) return NextResponse.json({ error: "未找到账单记录" }, { status: 404 });
  await recordAuditLog({
    action: "billing_record_review",
    actorRole: "staff",
    actorName,
    targetType: "billing",
    targetId: id,
    customerCode: record.customerCode,
    summary: `账单状态更新为 ${body.status}`,
    note: body.reviewNote?.trim(),
    before: beforeRecord,
    after: record,
  });
  return NextResponse.json({ record });
}
