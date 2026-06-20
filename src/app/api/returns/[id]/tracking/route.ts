import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { updateCustomerReturnTracking } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const result = await updateCustomerReturnTracking({
    id,
    customerCode: session.customerCode,
    buyerReturnTracking: clean(body.buyerReturnTracking),
    expectedArrivalDate: clean(body.expectedArrivalDate),
    customerNote: clean(body.customerNote),
  });

  if (result.error) return NextResponse.json({ error: result.error, order: result.order }, { status: result.order ? 400 : 404 });
  return NextResponse.json({ order: result.order });
}
