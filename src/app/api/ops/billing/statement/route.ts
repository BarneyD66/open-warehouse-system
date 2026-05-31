import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { updateBillingStatementLock, updateStaffBillingStatement } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const actions = new Set(["lock", "unlock", "mark_paid", "issue_invoice", "void_invoice", "reopen"]);

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    customerCode?: string;
    month?: string;
    action?: "lock" | "unlock" | "mark_paid" | "issue_invoice" | "void_invoice" | "reopen";
    paymentReference?: string;
    reviewNote?: string;
  };

  if (!body.customerCode?.trim()) return NextResponse.json({ error: "请选择客户" }, { status: 400 });
  if (!body.month?.trim() || !/^\d{4}-\d{2}$/.test(body.month)) return NextResponse.json({ error: "请选择正确的账单月份" }, { status: 400 });
  if (!body.action || !actions.has(body.action)) return NextResponse.json({ error: "不支持的月结操作" }, { status: 400 });

  const reviewer = staff.displayName || staff.username;
  const { records, error } = body.action === "lock" || body.action === "unlock"
    ? await updateBillingStatementLock({
        customerCode: body.customerCode.trim(),
        month: body.month.trim(),
        action: body.action,
        reviewer,
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
