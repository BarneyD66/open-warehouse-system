import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getCustomerAccountByCode, updateCustomerAccountStatus, type CustomerAccountStatus } from "@/lib/customerAccountStore";
import { hasDocumentForRef } from "@/lib/documentStore";
import { approvalRuleForTrigger, approvalRuleNote, getOpsExpansionData } from "@/lib/opsExpansionStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { canPerformSensitiveAction, requiresSecondConfirmation } from "@/lib/staffPermissions";
import { updateWarehouseCustomerProfile } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ customerCode: string }>;
};

const allowedStatuses: CustomerAccountStatus[] = ["unverified", "verified", "paused"];

const statusLabels: Record<CustomerAccountStatus, string> = {
  unverified: "未认证",
  verified: "已认证",
  paused: "暂停",
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalPositiveNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function staffSessionFromCookie(request: Request) {
  return parseStaffSession(request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${staffCookieName}=([^;]+)`))?.[1]);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = staffSessionFromCookie(request);
  if (!session) return NextResponse.json({ error: "请先登录运营后台" }, { status: 401 });

  const { customerCode: rawCustomerCode } = await context.params;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = clean(body.status) as CustomerAccountStatus;
  const note = clean(body.note);
  const confirmation = clean(body.confirmation);

  if (!allowedStatuses.includes(status)) return NextResponse.json({ error: "无效的客户账号状态" }, { status: 400 });

  const before = await getCustomerAccountByCode(customerCode);
  if (!before) return NextResponse.json({ error: "未找到客户账号" }, { status: 404 });

  const expansionData = await getOpsExpansionData();
  const isPauseOperation = status === "paused" || before.status === "paused";
  if (isPauseOperation) {
    const sensitiveAction = "客户暂停/解封";
    if (!canPerformSensitiveAction(session, sensitiveAction, expansionData)) return NextResponse.json({ error: "当前角色无权暂停或恢复客户账号" }, { status: 403 });
    if (!note) return NextResponse.json({ error: status === "paused" ? "暂停客户账号必须填写原因" : "恢复客户账号必须填写原因" }, { status: 400 });
    if (requiresSecondConfirmation(session, sensitiveAction, expansionData) && confirmation !== customerCode) {
      return NextResponse.json({ error: `该敏感操作需要二次确认，请输入客户编号 ${customerCode}` }, { status: 400 });
    }
  }

  const approvalRule = approvalRuleForTrigger(expansionData, "customer_status", 0, 1);
  if (approvalRule && !approvalRule.approverRoles.includes(session.role)) return NextResponse.json({ error: `当前审批规则要求 ${approvalRule.approverRoles.join("、")} 审批` }, { status: 403 });
  if (approvalRule?.requireReason && !note) return NextResponse.json({ error: "当前审批规则要求填写客户状态变更原因" }, { status: 400 });
  if (approvalRule?.requireAttachment) {
    const hasAttachment = await hasDocumentForRef({ customerCode, refType: "approval", refId: `customer-status:${customerCode}` });
    if (!hasAttachment) return NextResponse.json({ error: "当前审批规则要求先上传客户状态审批附件" }, { status: 400 });
  }

  const account = await updateCustomerAccountStatus(customerCode, status);
  if (!account) return NextResponse.json({ error: "未找到客户账号" }, { status: 404 });
  const paymentTermDays = optionalPositiveNumber(body.paymentTermDays);
  const creditLimit = optionalPositiveNumber(body.creditLimit);
  const billingCycle = clean(body.billingCycle);
  if (paymentTermDays !== undefined || creditLimit !== undefined || billingCycle) {
    const billingProfile: Parameters<typeof updateWarehouseCustomerProfile>[1] = {};
    if (paymentTermDays !== undefined) billingProfile.paymentTermDays = Math.floor(paymentTermDays);
    if (creditLimit !== undefined) billingProfile.creditLimit = Math.round(creditLimit * 100) / 100;
    if (billingCycle === "prepaid" || billingCycle === "weekly" || billingCycle === "monthly") billingProfile.billingCycle = billingCycle;
    await updateWarehouseCustomerProfile(customerCode, billingProfile);
  }

  await recordAuditLog({
    action: "customer_status_update",
    actorRole: "staff",
    actorName: `${session.displayName} / ${session.role}`,
    targetType: "customer_account",
    targetId: customerCode,
    customerCode,
    summary: `客户账号状态更新为${statusLabels[status]}`,
    note: [note, approvalRuleNote(approvalRule)].filter(Boolean).join(" / "),
    before: { status: before.status },
    after: { status: account.status, paymentTermDays, creditLimit, billingCycle },
  });

  return NextResponse.json({ account });
}
