import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { respondToInquiryQuote } from "@/lib/localStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) {
    return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const decision = clean(body.decision);

  if (decision !== "accepted" && decision !== "question") {
    return NextResponse.json({ error: "请选择确认报价或提出问题" }, { status: 400 });
  }

  const updated = await respondToInquiryQuote({
    id,
    decision,
    message: clean(body.message),
    customerCode: session.customerCode,
  });

  if (!updated) {
    return NextResponse.json({ error: "未找到可确认的报价方案" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    quoteResponse: updated.quoteResponse,
    updatedAt: updated.updatedAt,
  });
}
