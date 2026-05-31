import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { addInquiry } from "@/lib/localStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  const company = clean(body.company);
  const contact = clean(body.contact);
  const phone = clean(body.phone);
  const email = clean(body.email);
  const platform = clean(body.platform);
  const volume = clean(body.volume);
  const service = clean(body.service);

  if (!company || !contact || (!phone && !email) || !platform || !volume || !service) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const submission = await addInquiry({
    customerCode: session?.customerCode,
    company,
    contact,
    phone,
    email,
    platform,
    volume,
    service,
    leadIntent: clean(body.leadIntent),
    origin: clean(body.origin),
    tailDeliveryNeed: clean(body.tailDeliveryNeed),
    note: clean(body.note),
    quoteEstimate: clean(body.quoteEstimate),
  });

  return NextResponse.json({ id: submission.id, status: submission.status });
}
