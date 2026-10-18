import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { authenticateManagedStaff, getManagedStaffAccounts } from "@/lib/staffAccountStore";
import { findWhitelistedStaff, getStaffWhitelist, serializeStaffSession, staffCookieName, staffWhitelistSource } from "@/lib/staffAuth";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function userAgentSummary(request: Request) {
  return (request.headers.get("user-agent") || "unknown").slice(0, 160);
}

function loginFailureMessage(input: {
  username: string;
  managedAccount?: Awaited<ReturnType<typeof getManagedStaffAccounts>>[number];
  whitelisted: boolean;
  whitelistSource: string;
}) {
  if (!input.username) return "请输入员工账号和密码。";
  if (input.managedAccount?.lockedUntil) return "该员工账号已临时锁定，请稍后再试或联系管理员解锁。";
  if (input.managedAccount?.status === "disabled") return "该员工账号已停用，请联系管理员。";
  if (input.managedAccount) return input.managedAccount.lastFailedLoginReason || "员工账号存在，但密码不正确。";
  if (input.whitelisted) return "账号在员工白名单内，但密码不正确。";
  return `账号不在员工白名单内。当前白名单来源：${input.whitelistSource}。`;
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "staff-login"), 10, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, message: "登录尝试过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const contentType = request.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const body = isFormPost
    ? (Object.fromEntries(await request.formData()) as { username?: string; password?: string })
    : ((await request.json().catch(() => ({}))) as { username?: string; password?: string });
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const account = (await authenticateManagedStaff(username, password)) ?? findWhitelistedStaff(username, password);

  if (!account) {
    const [managedAccounts, whitelist] = await Promise.all([getManagedStaffAccounts(), Promise.resolve(getStaffWhitelist())]);
    const managedAccount = managedAccounts.find((item) => item.username === username);
    const whitelisted = whitelist.some((item) => item.username === username);
    const message = loginFailureMessage({ username, managedAccount, whitelisted, whitelistSource: staffWhitelistSource() });
    await recordAuditLog({
      action: "staff_login_failed",
      actorRole: "system",
      actorName: "员工登录接口",
      targetType: "staff_account",
      targetId: username || "unknown",
      summary: managedAccount?.lockedUntil ? "员工登录失败，账号已触发临时锁定" : "员工登录失败",
      note: message,
      after: {
        status: managedAccount?.lockedUntil ? "locked" : "failed",
        failedLoginCount: managedAccount?.failedLoginCount ?? 0,
        lockedUntil: managedAccount?.lockedUntil,
        whitelistSource: staffWhitelistSource(),
        whitelisted,
        ip: clientIp(request),
        userAgent: userAgentSummary(request),
      },
    });
    if (isFormPost) return NextResponse.redirect(new URL(`/ops-login?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
    return NextResponse.json({ ok: false, message, diagnostic: { whitelisted, whitelistSource: staffWhitelistSource(), accountKnown: Boolean(managedAccount || whitelisted) } }, { status: 401 });
  }

  const landingPath = account.role === "warehouse" ? "/warehouse" : "/ops";
  await recordAuditLog({
    action: "staff_login_success",
    actorRole: "staff",
    actorName: `${account.displayName} / ${account.role}`,
    targetType: "staff_account",
    targetId: account.username,
    summary: "员工登录成功",
    note: `进入 ${landingPath}`,
    after: {
      role: account.role,
      nextPath: landingPath,
      whitelistSource: staffWhitelistSource(),
      ip: clientIp(request),
      userAgent: userAgentSummary(request),
    },
  });
  const response = isFormPost ? NextResponse.redirect(new URL(landingPath, request.url), { status: 303 }) : NextResponse.json({ ok: true, role: account.role, nextPath: landingPath });
  response.cookies.set(
    staffCookieName,
    serializeStaffSession({
      username: account.username,
      displayName: account.displayName,
      role: account.role,
    }),
    {
      httpOnly: true,
      maxAge: 60 * 60 * 12,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );

  return response;
}
