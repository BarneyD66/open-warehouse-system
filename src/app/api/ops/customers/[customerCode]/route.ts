import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getCustomerAccountByCode, updateCustomerAccountStatus, type CustomerAccountStatus } from "@/lib/customerAccountStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

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

  if (!allowedStatuses.includes(status)) return NextResponse.json({ error: "无效的客户账号状态" }, { status: 400 });

  const before = await getCustomerAccountByCode(customerCode);
  if (!before) return NextResponse.json({ error: "未找到客户账号" }, { status: 404 });

  const account = await updateCustomerAccountStatus(customerCode, status);
  if (!account) return NextResponse.json({ error: "未找到客户账号" }, { status: 404 });

  await recordAuditLog({
    action: "customer_status_update",
    actorRole: "staff",
    actorName: `${session.displayName} / ${session.role}`,
    targetType: "customer_account",
    targetId: customerCode,
    customerCode,
    summary: `客户账号状态更新为${statusLabels[status]}`,
    note,
    before: { status: before.status },
    after: { status: account.status },
  });

  return NextResponse.json({ account });
}
