import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { changeManagedStaffPassword } from "@/lib/staffAccountStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-staff-password"), 8, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "密码修改尝试过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) return NextResponse.json({ error: "请填写当前密码、新密码和确认密码。" }, { status: 400 });
  if (newPassword !== confirmPassword) return NextResponse.json({ error: "两次输入的新密码不一致。" }, { status: 400 });

  const result = await changeManagedStaffPassword({
    username: staff.username,
    currentPassword,
    newPassword,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditLog({
    action: "staff_account_update",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "staff_account",
    targetId: staff.username,
    summary: "员工自助修改密码",
  });

  return NextResponse.json({ ok: true });
}
