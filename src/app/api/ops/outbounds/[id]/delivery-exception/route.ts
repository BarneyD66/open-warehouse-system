import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { hasDocumentForRef } from "@/lib/documentStore";
import { approvalRuleForTrigger, approvalRuleNote, getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import {
  createCoreOutboundDeliveryException,
  getWarehouseCoreData,
  updateCoreOutboundDeliveryException,
  type OutboundClaimStatus,
  type OutboundDeliveryExceptionType,
  type OutboundExceptionStatus,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const exceptionTypes = new Set<OutboundDeliveryExceptionType>([
  "delivery_failed",
  "address_issue",
  "customer_absent",
  "damaged",
  "lost",
  "return_to_sender",
  "claim",
  "proof_uploaded",
  "manual",
]);
const exceptionStatuses = new Set<OutboundExceptionStatus>(["open", "investigating", "resolved", "ignored"]);
const claimStatuses = new Set<OutboundClaimStatus>(["not_required", "draft", "submitted", "approved", "rejected", "paid"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function needsClaimApproval(claimStatus: OutboundClaimStatus, claimAmount?: number) {
  return Boolean(claimAmount && claimAmount > 0) || ["submitted", "approved", "paid"].includes(claimStatus);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const exceptionType = clean(body.exceptionType) as OutboundDeliveryExceptionType;
  const claimStatus = clean(body.claimStatus) as OutboundClaimStatus;
  const claimAmount = cleanNumber(body.claimAmount);
  const operator = staff.displayName || staff.username;
  const outboundId = decodeURIComponent(id);

  if (!exceptionTypes.has(exceptionType)) {
    return NextResponse.json({ error: "请选择有效的物流异常类型" }, { status: 400 });
  }
  if (needsClaimApproval(claimStatus, claimAmount)) {
    const coreData = await getWarehouseCoreData();
    const order = coreData.outboundOrders.find((item) => item.id === outboundId);
    if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });
    const approvalRule = approvalRuleForTrigger(await getOpsExpansionData(), "claim_approval", claimAmount ?? 0, 1);
    if (approvalRule && !approvalRule.approverRoles.includes(staff.role)) return NextResponse.json({ error: `当前审批规则要求 ${approvalRule.approverRoles.join("、")} 审批` }, { status: 403 });
    if (approvalRule?.requireReason && !clean(body.claimNote) && !clean(body.message)) return NextResponse.json({ error: "当前审批规则要求填写赔付审批原因" }, { status: 400 });
    if (approvalRule?.requireAttachment) {
      const hasAttachment = await hasDocumentForRef({ customerCode: order.customerCode, refType: "approval", refId: `claim:${outboundId}` });
      if (!hasAttachment) return NextResponse.json({ error: "当前审批规则要求先上传赔付审批附件" }, { status: 400 });
    }
    body.claimNote = [clean(body.claimNote), approvalRule ? approvalRuleNote(approvalRule) : ""].filter(Boolean).join(" / ");
  }

  const result = await createCoreOutboundDeliveryException({
    id: outboundId,
    exceptionType,
    message: clean(body.message),
    severity: body.severity === "warning" ? "warning" : "critical",
    redeliveryRequired: Boolean(body.redeliveryRequired),
    redeliveryNote: clean(body.redeliveryNote),
    proofUrl: clean(body.proofUrl),
    claimAmount,
    claimStatus: claimStatuses.has(claimStatus) ? claimStatus : undefined,
    claimNote: clean(body.claimNote),
    operator,
  });

  if (result.error) return NextResponse.json({ error: result.error, order: result.order }, { status: result.order ? 400 : 404 });
  if (!result.order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

  await recordAuditLog({
    action: "outbound_delivery_exception_create",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "outbound",
    targetId: result.order.id,
    customerCode: result.order.customerCode,
    summary: "新增物流异常处理记录",
    note: clean(body.message),
    after: { status: result.order.status, exception: result.exception },
  });

  return NextResponse.json({ order: result.order, exception: result.exception });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const exceptionId = clean(body.exceptionId);
  const status = clean(body.status) as OutboundExceptionStatus;
  const claimStatus = clean(body.claimStatus) as OutboundClaimStatus;
  const claimAmount = cleanNumber(body.claimAmount);
  const operator = staff.displayName || staff.username;
  const outboundId = decodeURIComponent(id);

  if (!exceptionId) return NextResponse.json({ error: "请选择需要更新的异常记录" }, { status: 400 });
  if (needsClaimApproval(claimStatus, claimAmount)) {
    const coreData = await getWarehouseCoreData();
    const order = coreData.outboundOrders.find((item) => item.id === outboundId);
    if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });
    const approvalRule = approvalRuleForTrigger(await getOpsExpansionData(), "claim_approval", claimAmount ?? 0, 1);
    if (approvalRule && !approvalRule.approverRoles.includes(staff.role)) return NextResponse.json({ error: `当前审批规则要求 ${approvalRule.approverRoles.join("、")} 审批` }, { status: 403 });
    if (approvalRule?.requireReason && !clean(body.claimNote) && !clean(body.note)) return NextResponse.json({ error: "当前审批规则要求填写赔付审批原因" }, { status: 400 });
    if (approvalRule?.requireAttachment) {
      const hasAttachment = await hasDocumentForRef({ customerCode: order.customerCode, refType: "approval", refId: `claim:${exceptionId}` });
      if (!hasAttachment) return NextResponse.json({ error: "当前审批规则要求先上传赔付审批附件" }, { status: 400 });
    }
    body.claimNote = [clean(body.claimNote), approvalRule ? approvalRuleNote(approvalRule) : ""].filter(Boolean).join(" / ");
  }

  const result = await updateCoreOutboundDeliveryException({
    id: outboundId,
    exceptionId,
    status: exceptionStatuses.has(status) ? status : undefined,
    redeliveryRequired: typeof body.redeliveryRequired === "boolean" ? body.redeliveryRequired : undefined,
    redeliveryNote: clean(body.redeliveryNote),
    proofUrl: clean(body.proofUrl),
    claimAmount,
    claimStatus: claimStatuses.has(claimStatus) ? claimStatus : undefined,
    claimNote: clean(body.claimNote),
    note: clean(body.note),
    operator,
  });

  if (result.error) return NextResponse.json({ error: result.error, order: result.order }, { status: result.order ? 400 : 404 });
  if (!result.order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

  await recordAuditLog({
    action: "outbound_delivery_exception_update",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "outbound",
    targetId: result.order.id,
    customerCode: result.order.customerCode,
    summary: "更新物流异常处理记录",
    note: clean(body.note),
    after: { status: result.order.status, exception: result.exception },
  });

  return NextResponse.json({ order: result.order, exception: result.exception });
}
