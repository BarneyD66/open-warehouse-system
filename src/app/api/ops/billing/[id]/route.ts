import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { updateBillingInvoiceStatus, updateStaffBillingRecord, type BillingInvoiceStatus, type BillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const staffStatuses = new Set(["pending_confirmation", "confirmed", "payment_submitted", "paid", "disputed"]);
const invoiceStatuses = new Set(["not_requested", "requested", "issued", "voided"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: BillingRecord["status"];
    reviewNote?: string;
    invoiceStatus?: BillingInvoiceStatus;
    invoiceNote?: string;
  };

  if (body.invoiceStatus) {
    if (!invoiceStatuses.has(body.invoiceStatus)) {
      return NextResponse.json({ error: "不支持的开票状态" }, { status: 400 });
    }

    const record = await updateBillingInvoiceStatus({
      id,
      invoiceStatus: body.invoiceStatus,
      reviewer: staff.displayName || staff.username,
      invoiceNote: body.invoiceNote,
    });

    if (!record) return NextResponse.json({ error: "未找到账单记录" }, { status: 404 });
    return NextResponse.json({ record });
  }

  if (!body.status || !staffStatuses.has(body.status)) {
    return NextResponse.json({ error: "不支持的账单状态" }, { status: 400 });
  }

  const record = await updateStaffBillingRecord({
    id,
    status: body.status,
    reviewer: staff.displayName || staff.username,
    reviewNote: body.reviewNote,
  });

  if (!record) return NextResponse.json({ error: "未找到账单记录" }, { status: 404 });
  return NextResponse.json({ record });
}
