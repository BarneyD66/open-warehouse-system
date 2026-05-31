import { NextResponse } from "next/server";
import { findWhitelistedStaff, serializeStaffSession, staffCookieName } from "@/lib/staffAuth";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const body = isFormPost
    ? (Object.fromEntries(await request.formData()) as { username?: string; password?: string })
    : ((await request.json().catch(() => ({}))) as { username?: string; password?: string });
  const account = findWhitelistedStaff(String(body.username ?? "").trim(), String(body.password ?? ""));

  if (!account) {
    if (isFormPost) return NextResponse.redirect(new URL("/ops-login?error=1", request.url), { status: 303 });
    return NextResponse.json({ ok: false, message: "员工账号未在白名单内或密码不正确" }, { status: 401 });
  }

  const landingPath = account.role === "warehouse" ? "/warehouse" : "/ops";
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
