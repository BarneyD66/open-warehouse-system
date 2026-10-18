import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { parseCustomerInboundInput } from "@/lib/inboundInput";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { addInbound } from "@/lib/localStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) {
    return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const account = await getCustomerAccountByCode(session.customerCode);
  const parsed = parseCustomerInboundInput(body, account?.email || (session.username.includes("@") ? session.username : ""));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const submission = await addInbound({
    customerCode: session.customerCode,
    ...parsed.input,
  });

  return NextResponse.json({ id: submission.id, status: submission.status });
}
