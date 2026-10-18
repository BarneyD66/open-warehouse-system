import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { parseCustomerInboundInput } from "@/lib/inboundInput";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { inboundStatusLabel, updateInboundByCustomer } from "@/lib/localStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) {
    return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const account = await getCustomerAccountByCode(session.customerCode);
  const parsed = parseCustomerInboundInput(body, account?.email || (session.username.includes("@") ? session.username : ""));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { id } = await context.params;
  const result = await updateInboundByCustomer({
    id,
    customerCode: session.customerCode,
    input: parsed.input,
  });

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "未找到该入库预报，或该记录不属于当前账号" }, { status: 404 });
  }
  if (result.outcome === "locked") {
    return NextResponse.json(
      { error: `当前状态为“${inboundStatusLabel(result.inbound.status)}”，仓库已开始处理；如需修改请联系服务团队。` },
      { status: 409 },
    );
  }

  return NextResponse.json({
    id: result.inbound.id,
    status: result.inbound.status,
    updatedAt: result.inbound.updatedAt,
  });
}
