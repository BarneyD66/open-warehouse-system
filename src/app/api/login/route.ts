import { NextResponse } from "next/server";
import { findDemoCustomer, serializeCustomerSession } from "@/lib/customerAuth";
import { findRegisteredCustomer } from "@/lib/customerAccountStore";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const body = isFormPost
    ? (Object.fromEntries(await request.formData()) as { username?: string; password?: string })
    : ((await request.json().catch(() => ({}))) as { username?: string; password?: string });
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const account = (await findRegisteredCustomer(username, password)) ?? findDemoCustomer(username, password);

  if (!account) {
    if (isFormPost) return NextResponse.redirect(new URL("/login?error=1", request.url), { status: 303 });
    return NextResponse.json({ ok: false, message: "账号或密码不正确" }, { status: 401 });
  }

  const response = isFormPost ? NextResponse.redirect(new URL("/portal", request.url), { status: 303 }) : NextResponse.json({ ok: true });
  response.cookies.set("uk-warehouse-session", serializeCustomerSession({ customerCode: account.customerCode, username: account.username }), {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
