import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { createCustomerReturnOrder, getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function parseSkuLines(value: unknown) {
  const raw = clean(value);
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [skuCode = "", quantity = ""] = line.split(/[,，\t|]/).map((part) => part.trim());
      return { skuCode, quantity: positiveInt(quantity) };
    })
    .filter((line) => line.skuCode && line.quantity > 0);
}

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  return NextResponse.json({ returnOrders: data.returnOrders });
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const platform = clean(body.platform);
  const returnReason = clean(body.returnReason);
  const skuLines = Array.isArray(body.skuLines)
    ? body.skuLines
        .map((item) => (typeof item === "object" && item ? item : {}) as Record<string, unknown>)
        .map((item) => ({ skuCode: clean(item.skuCode), quantity: positiveInt(item.quantity) }))
        .filter((item) => item.skuCode && item.quantity > 0)
    : parseSkuLines(body.skuLines);

  if (!platform || !returnReason || skuLines.length === 0) {
    return NextResponse.json({ error: "请填写平台、退货原因和退货 SKU 明细" }, { status: 400 });
  }

  const order = await createCustomerReturnOrder({
    customerCode: session.customerCode,
    platform,
    originalOrderNo: clean(body.originalOrderNo),
    buyerReturnTracking: clean(body.buyerReturnTracking),
    returnReason,
    expectedArrivalDate: clean(body.expectedArrivalDate),
    skuLines,
    customerNote: clean(body.customerNote),
  });

  if (!order) return NextResponse.json({ error: "退货 SKU 无效，请先维护 SKU 档案" }, { status: 400 });
  return NextResponse.json({ order });
}
