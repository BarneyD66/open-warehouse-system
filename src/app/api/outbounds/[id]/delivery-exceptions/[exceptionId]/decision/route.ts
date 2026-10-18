import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customerAuth";
import {
  customerConfirmCoreOutboundDeliveryException,
  outboundCustomerExceptionDecisionLabel,
  type OutboundCustomerExceptionDecision,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const decisions = new Set<OutboundCustomerExceptionDecision>(["accepted", "redelivery_confirmed", "claim_question", "rejected"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; exceptionId: string }> }) {
  const session = await requireCustomerSession();
  const { id, exceptionId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const decision = clean(body.decision) as OutboundCustomerExceptionDecision;
  if (!decisions.has(decision)) return NextResponse.json({ error: "请选择有效的异常确认结果。" }, { status: 400 });

  const result = await customerConfirmCoreOutboundDeliveryException({
    id,
    exceptionId,
    customerCode: session.customerCode,
    decision,
    note: clean(body.note),
    actorName: session.username,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    order: result.order,
    exception: result.exception,
    message: outboundCustomerExceptionDecisionLabel[decision],
  });
}
