import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customerAuth";
import { updateCustomerBillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const customerActions = new Set(["confirm", "dispute", "submit_payment", "request_invoice"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCustomerSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    message?: string;
    paymentReference?: string;
  };

  if (!body.action || !customerActions.has(body.action)) {
    return NextResponse.json({ error: "不支持的账单操作" }, { status: 400 });
  }

  if (body.action === "dispute" && !body.message?.trim()) {
    return NextResponse.json({ error: "请填写账单争议说明" }, { status: 400 });
  }

  if (body.action === "submit_payment" && !body.paymentReference?.trim()) {
    return NextResponse.json({ error: "请填写付款参考号" }, { status: 400 });
  }

  const record = await updateCustomerBillingRecord({
    id,
    customerCode: session.customerCode,
    action: body.action as "confirm" | "dispute" | "submit_payment" | "request_invoice",
    message: body.message,
    paymentReference: body.paymentReference,
  });

  if (!record) return NextResponse.json({ error: "未找到账单记录" }, { status: 404 });
  return NextResponse.json({ record });
}
