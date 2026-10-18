import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import {
  createInboundReceivingException,
  resolveInboundReceivingException,
  type InboundReceivingExceptionStatus,
  type InboundReceivingExceptionType,
} from "@/lib/localStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const exceptionTypes = new Set<InboundReceivingExceptionType>(["short_received", "over_received", "damaged", "sku_mismatch", "label_issue", "missing_document", "manual"]);
const statuses = new Set<InboundReceivingExceptionStatus>(["open", "investigating", "resolved", "ignored"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: unknown) {
  const text = clean(value);
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

export async function POST(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const type = clean(body.type) as InboundReceivingExceptionType;
  const severity = clean(body.severity) === "warning" ? "warning" : "critical";
  const operator = staff.displayName || staff.username;

  if (!exceptionTypes.has(type)) return NextResponse.json({ error: "请选择有效的收货差异类型" }, { status: 400 });

  const result = await createInboundReceivingException({
    id,
    type,
    severity,
    skuCode: clean(body.skuCode),
    cartonNo: clean(body.cartonNo),
    expectedQty: optionalNumber(body.expectedQty),
    actualQty: optionalNumber(body.actualQty),
    message: clean(body.message),
    operator,
  });

  if (result.error || !result.task) return NextResponse.json({ error: result.error || "入库差异创建失败" }, { status: 404 });

  await recordAuditLog({
    action: "inbound_exception_create",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "inbound",
    targetId: result.task.id,
    customerCode: result.task.customerCode,
    summary: "入库收货差异已记录",
    note: result.exception?.message,
    after: { status: result.task.status, exception: result.exception },
  });

  return NextResponse.json({ task: result.task, exception: result.exception });
}

export async function PATCH(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const exceptionId = clean(body.exceptionId);
  const status = clean(body.status) as InboundReceivingExceptionStatus;
  const note = clean(body.note);
  const operator = staff.displayName || staff.username;

  if (!exceptionId) return NextResponse.json({ error: "请选择需要处理的入库异常" }, { status: 400 });
  if (!statuses.has(status)) return NextResponse.json({ error: "不支持的异常处理状态" }, { status: 400 });

  const result = await resolveInboundReceivingException({ id, exceptionId, status, note, operator });
  if (result.error || !result.task) return NextResponse.json({ error: result.error || "入库异常处理失败", task: result.task }, { status: result.task ? 400 : 404 });

  await recordAuditLog({
    action: "inbound_exception_update",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "inbound",
    targetId: result.task.id,
    customerCode: result.task.customerCode,
    summary: status === "resolved" ? "入库异常已处理" : status === "ignored" ? "入库异常已忽略" : "入库异常处理中",
    note,
    after: { status: result.task.status, exceptions: result.task.receivingExceptions },
  });

  return NextResponse.json({ task: result.task });
}
