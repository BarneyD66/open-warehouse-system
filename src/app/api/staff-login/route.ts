import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { authenticateManagedStaff, getManagedStaffAccounts } from "@/lib/staffAccountStore";
import { findWhitelistedStaff, serializeStaffSession, staffCookieName } from "@/lib/staffAuth";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function userAgentSummary(request: Request) {
  return (request.headers.get("user-agent") || "unknown").slice(0, 160);
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "staff-login"), 10, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, message: "登录尝试过于频繁，请稍后再试" }, { status: 429 });

  const contentType = request.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const body = isFormPost
    ? (Object.fromEntries(await request.formData()) as { username?: string; password?: string })
    : ((await request.json().catch(() => ({}))) as { username?: string; password?: string });
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const account = (await authenticateManagedStaff(username, password)) ?? findWhitelistedStaff(username, password);

  if (!account) {
    const managedAccount = (await getManagedStaffAccounts()).find((item) => item.username === username);
    await recordAuditLog({
      action: "staff_login_failed",
      actorRole: "system",
      actorName: "员工登录接口",
      targetType: "staff_account",
      targetId: username || "unknown",
      summary: managedAccount?.lockedUntil ? "员工登录失败，账号已触发临时锁定" : "员工登录失败",
      note: managedAccount?.lastFailedLoginReason || "账号不存在、未启用或密码错误",
      after: {
        status: managedAccount?.lockedUntil ? "locked" : "failed",
        failedLoginCount: managedAccount?.failedLoginCount ?? 0,
        lockedUntil: managedAccount?.lockedUntil,
        ip: clientIp(request),
        userAgent: userAgentSummary(request),
      },
    });
    if (isFormPost) return NextResponse.redirect(new URL("/ops-login?error=1", request.url), { status: 303 });
    return NextResponse.json({ ok: false, message: "员工账号未在白名单内或密码不正确" }, { status: 401 });
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
