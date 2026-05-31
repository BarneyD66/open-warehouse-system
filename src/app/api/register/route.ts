import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { registerCustomerAccount } from "@/lib/customerAccountStore";
import { serializeCustomerSession } from "@/lib/customerAuth";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyName = clean(body.companyName);
  const contactName = clean(body.contactName);
  const phone = clean(body.phone);
  const email = clean(body.email);
  const password = String(body.password ?? "");

  if (!companyName || !contactName || !phone || !password) {
    return NextResponse.json({ ok: false, message: "请填写公司名称、联系人、手机和密码。" }, { status: 400 });
  }

  try {
    const account = await registerCustomerAccount({
      companyName,
      contactName,
      phone,
      email,
      password,
    });
    if (!account) return NextResponse.json({ ok: false, message: "注册信息不完整。" }, { status: 400 });

    await recordAuditLog({
      action: "customer_register",
      actorRole: "customer",
      actorName: account.username,
      targetType: "customer_account",
      targetId: account.customerCode,
      customerCode: account.customerCode,
      summary: "客户自助注册账号",
      after: {
        companyName: account.companyName,
        contactName: account.contactName,
        phone: account.phone,
        email: account.email,
        status: account.status,
      },
    });

    const response = NextResponse.json({ ok: true, customerCode: account.customerCode });
    response.cookies.set("uk-warehouse-session", serializeCustomerSession({ customerCode: account.customerCode, username: account.username }), {
      httpOnly: true,
      maxAge: 60 * 60 * 24,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "PASSWORD_TOO_SHORT") {
      return NextResponse.json({ ok: false, message: "密码至少需要 6 位。" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "CUSTOMER_ALREADY_EXISTS") {
      return NextResponse.json({ ok: false, message: "该手机或邮箱已注册，请直接登录。" }, { status: 409 });
    }
    throw error;
  }
}
