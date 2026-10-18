import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { resetCustomerPassword } from "@/lib/customerAccountStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { login?: string; newPassword?: string; resetToken?: string };
  const login = body.login?.trim() ?? "";
  const newPassword = body.newPassword ?? "";
  if (!login || !newPassword) return NextResponse.json({ error: "请填写手机/邮箱和新密码。" }, { status: 400 });

  const configuredToken = process.env.CUSTOMER_PASSWORD_RESET_TOKEN?.trim();
  const submittedToken = body.resetToken?.trim();
  if (!configuredToken || submittedToken !== configuredToken) {
    return NextResponse.json(
      {
        ok: true,
        requiresVerification: true,
        message: "已收到重置申请。为保护账号安全，请联系运营核验后完成密码重置。",
      },
      { status: 202 },
    );
  }

  try {
    const updated = await resetCustomerPassword(login, newPassword);
    if (!updated) return NextResponse.json({ error: "没有找到对应账号。" }, { status: 404 });
    await recordAuditLog({
      action: "customer_password_reset",
      actorRole: "customer",
      actorName: updated.username,
      targetType: "customer_account",
      targetId: updated.customerCode,
      customerCode: updated.customerCode,
      summary: "客户通过安全校验重置了登录密码",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PASSWORD_TOO_SHORT") return NextResponse.json({ error: "新密码至少需要 6 位。" }, { status: 400 });
    throw error;
  }
}
