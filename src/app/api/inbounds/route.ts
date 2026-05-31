import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { addInbound } from "@/lib/localStore";

export const runtime = "nodejs";

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
      const [skuCode = "", productName = "", qty = "", cartons = ""] = line.split(/[,，\t|]/).map((part) => part.trim());
      return {
        skuCode,
        productName,
        expectedQty: positiveInt(qty) || undefined,
        cartonCount: positiveInt(cartons) || undefined,
      };
    })
    .filter((line) => line.skuCode);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) {
    return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  }

  const contact = clean(body.contact);
  const phone = clean(body.phone);
  const eta = clean(body.eta);
  const transport = clean(body.transport);
  const cartons = positiveInt(body.cartons);
  const skuCount = positiveInt(body.skuCount);
  const productName = clean(body.productName);
  const skuLines = parseSkuLines(body.skuLines);
  const attachmentNames = Array.isArray(body.attachmentNames)
    ? body.attachmentNames.map((name) => clean(name)).filter(Boolean)
    : [];

  if (!contact || !phone || !eta || !transport || cartons <= 0 || skuCount <= 0 || !productName) {
    return NextResponse.json({ error: "缺少必填字段或数量不合法" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (eta < today) {
    return NextResponse.json({ error: "预计到仓日期不能早于今天" }, { status: 400 });
  }

  const submission = await addInbound({
    customerCode: session.customerCode,
    customer: clean(body.customer),
    contact,
    phone,
    platform: clean(body.platform),
    eta,
    transport,
    tracking: clean(body.tracking),
    cartons,
    skuCount,
    skuLines,
    productName,
    service: clean(body.service),
    attribute: clean(body.attribute),
    attachmentNames,
  });

  return NextResponse.json({ id: submission.id, status: submission.status });
}
