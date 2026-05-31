import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customerAuth";
import { updateCustomerBillingStatement } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const actions = new Set(["confirm", "dispute", "submit_payment", "request_invoice"]);

export async function PATCH(request: Request) {
  const session = await requireCustomerSession();
  const body = (await request.json().catch(() => ({}))) as {
    month?: string;
    action?: "confirm" | "dispute" | "submit_payment" | "request_invoice";
    message?: string;
    paymentReference?: string;
  };

  if (!body.month?.trim() || !/^\d{4}-\d{2}$/.test(body.month)) return NextResponse.json({ error: "请选择正确的账单月份" }, { status: 400 });
  if (!body.action || !actions.has(body.action)) return NextResponse.json({ error: "不支持的月结操作" }, { status: 400 });
  if (body.action === "dispute" && !body.message?.trim()) return NextResponse.json({ error: "请填写账单争议说明" }, { status: 400 });
  if (body.action === "submit_payment" && !body.paymentReference?.trim()) return NextResponse.json({ error: "请填写付款参考号" }, { status: 400 });

  const { records, error } = await updateCustomerBillingStatement({
    customerCode: session.customerCode,
    month: body.month.trim(),
    action: body.action,
    message: body.message,
    paymentReference: body.paymentReference,
  });

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ records });
}
