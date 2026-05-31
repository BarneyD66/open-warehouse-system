import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { createCustomerWorkOrder, getCustomerWorkOrders } from "@/lib/opsExpansionStore";

export const runtime = "nodejs";

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台。" }, { status: 401 });
  const workOrders = await getCustomerWorkOrders(session.customerCode);
  return NextResponse.json({ workOrders });
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台。" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const category = clean(body.category);
  const title = clean(body.title);
  const description = clean(body.description);
  if (!category || !title || !description) return NextResponse.json({ error: "请选择工单类型，并填写标题和说明。" }, { status: 400 });

  const workOrder = await createCustomerWorkOrder({
    customerCode: session.customerCode,
    category,
    title,
    priority: clean(body.priority) === "urgent" ? "urgent" : "normal",
    referenceNo: clean(body.referenceNo),
    description,
    customerContact: clean(body.customerContact),
  });
  return NextResponse.json({ workOrder });
}
