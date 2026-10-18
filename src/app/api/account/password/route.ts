import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordAuditLog } from "@/lib/auditLogStore";
import { changeCustomerPassword, getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { parseCustomerSession } from "@/lib/customerAuth";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const session = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { currentPassword?: string; newPassword?: string };
  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: "请填写当前密码和新密码。" }, { status: 400 });
  }

  try {
    const updated = await changeCustomerPassword(session.customerCode, body.currentPassword, body.newPassword);
    if (!updated) return NextResponse.json({ error: "未找到账号资料" }, { status: 404 });
    const account = await getCustomerAccountByCode(session.customerCode);
    await recordAuditLog({
      action: "customer_password_change",
      actorRole: "customer",
      actorName: account?.username ?? session.username,
      targetType: "customer_account",
      targetId: session.customerCode,
      customerCode: session.customerCode,
      summary: "客户修改了登录密码",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PASSWORD_TOO_SHORT") return NextResponse.json({ error: "新密码至少需要 6 位。" }, { status: 400 });
    if (error instanceof Error && error.message === "INVALID_CURRENT_PASSWORD") return NextResponse.json({ error: "当前密码不正确。" }, { status: 400 });
    throw error;
  }
}
