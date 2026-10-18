import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { decideInboundReceivingException, type InboundExceptionCustomerDecision } from "@/lib/localStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; exceptionId: string }>;
};

const decisions = new Set<InboundExceptionCustomerDecision>(["accept_actual", "request_recount", "request_reship", "return_excess", "dispose_damaged"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, context: RouteContext) {
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const decision = clean(body.decision) as InboundExceptionCustomerDecision;
  if (!decisions.has(decision)) return NextResponse.json({ error: "请选择有效的处理方案" }, { status: 400 });

  const { id, exceptionId } = await context.params;
  const result = await decideInboundReceivingException({
    id: decodeURIComponent(id),
    exceptionId: decodeURIComponent(exceptionId),
    customerCode: session.customerCode,
    decision,
    note: clean(body.note),
    operator: session.username,
  });
  if (result.error || !result.task) return NextResponse.json({ error: result.error || "保存失败" }, { status: result.task ? 409 : 404 });
  return NextResponse.json({ id: result.task.id, updatedAt: result.task.updatedAt });
}
