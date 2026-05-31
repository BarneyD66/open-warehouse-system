import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { resolveCoreOutboundException, type OutboundExceptionStatus } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statuses = new Set<OutboundExceptionStatus>(["open", "investigating", "resolved", "ignored"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const exceptionId = clean(body.exceptionId);
  const status = clean(body.status) as OutboundExceptionStatus;
  const note = clean(body.note);
  const operator = staff.displayName || staff.username;

  if (!exceptionId) return NextResponse.json({ error: "请选择需要处理的异常记录" }, { status: 400 });
  if (!statuses.has(status)) return NextResponse.json({ error: "不支持的异常处理状态" }, { status: 400 });

  const result = await resolveCoreOutboundException({ id, exceptionId, status, note, operator });
  if (result.error) return NextResponse.json({ error: result.error, order: result.order }, { status: result.order ? 400 : 404 });
  if (!result.order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

  await recordAuditLog({
    action: "outbound_exception_update",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "outbound",
    targetId: result.order.id,
    customerCode: result.order.customerCode,
    summary: status === "resolved" ? "出库异常已处理" : status === "ignored" ? "出库异常已忽略" : "出库异常处理中",
    note,
    after: { status: result.order.status, exceptions: result.order.exceptions },
  });

  return NextResponse.json({ order: result.order });
}
