import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import {
  disableManagedStaffAccount,
  getManagedStaffAccounts,
  publicStaffAccount,
  reviewManagedStaffRoleChange,
  unlockManagedStaffAccount,
  upsertManagedStaffAccount,
} from "@/lib/staffAccountStore";
import { requireStaffSession, type StaffRole } from "@/lib/staffAuth";
import { secondConfirmationError } from "@/lib/staffPermissions";

export const runtime = "nodejs";

function assertAdmin(role: StaffRole) {
  return role === "admin";
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const staff = await requireStaffSession();
  if (!assertAdmin(staff.role)) return NextResponse.json({ error: "只有系统管理员可以查看员工账号。" }, { status: 403 });
  const accounts = await getManagedStaffAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  if (!assertAdmin(staff.role)) return NextResponse.json({ error: "只有系统管理员可以维护员工账号。" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    action?: "upsert" | "disable" | "unlock" | "review_role_change";
    username?: string;
    displayName?: string;
    role?: StaffRole;
    password?: string;
    reason?: string;
    decision?: "approve" | "reject";
    note?: string;
    confirmation?: string;
  };
  const targetUsername = clean(body.username);
  const expansionData = await getOpsExpansionData();

  const permissionConfirmError = secondConfirmationError({
    staff,
    action: "权限配置",
    confirmation: clean(body.confirmation),
    expected: targetUsername,
    data: expansionData,
  });
  if (permissionConfirmError) return NextResponse.json({ error: permissionConfirmError }, { status: 400 });

  if (body.action === "disable") {
    if (targetUsername === staff.username) return NextResponse.json({ error: "不能禁用当前登录的管理员账号。" }, { status: 400 });
    const result = await disableManagedStaffAccount(targetUsername, clean(body.reason));
    if (result.error || !result.account) return NextResponse.json({ error: result.error ?? "员工账号禁用失败。" }, { status: 400 });
    const account = publicStaffAccount(result.account);
    await recordAuditLog({
      action: "staff_account_update",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "staff_account",
      targetId: targetUsername,
      summary: "员工账号已禁用",
      note: clean(body.reason),
      after: account,
    });
    return NextResponse.json({ account });
  }

  if (body.action === "unlock") {
    if (targetUsername === staff.username) return NextResponse.json({ error: "不能直接解锁当前登录的管理员账号，请使用改密或重新登录流程处理。" }, { status: 400 });
    const result = await unlockManagedStaffAccount(targetUsername);
    if (result.error || !result.account) return NextResponse.json({ error: result.error ?? "员工账号解锁失败。" }, { status: 400 });
    const account = publicStaffAccount(result.account);
    await recordAuditLog({
      action: "staff_account_update",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "staff_account",
      targetId: targetUsername,
      summary: "员工账号登录锁定已解除",
      after: account,
    });
    return NextResponse.json({ account });
  }

  if (body.action === "review_role_change") {
    const result = await reviewManagedStaffRoleChange({
      username: targetUsername,
      decision: body.decision === "reject" ? "reject" : "approve",
      reviewedBy: staff.username,
      note: clean(body.note),
    });
    if (result.error || !result.account) return NextResponse.json({ error: result.error ?? "角色变更审批失败。" }, { status: 400 });
    const account = publicStaffAccount(result.account);
    await recordAuditLog({
      action: "staff_role_change_review",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "staff_account",
      targetId: targetUsername,
      summary: body.decision === "reject" ? "员工角色变更已驳回" : "员工角色变更已审批通过",
      note: clean(body.note),
      after: account,
    });
    return NextResponse.json({ account });
  }

  const role = body.role ?? "ops";
  if (targetUsername === staff.username && role !== staff.role) {
    return NextResponse.json({ error: "不能直接修改当前登录管理员自己的角色。" }, { status: 400 });
  }
  const result = await upsertManagedStaffAccount({
    username: targetUsername,
    displayName: clean(body.displayName),
    role,
    password: clean(body.password),
    invitedBy: staff.username,
  });
  if (result.error || !result.account) return NextResponse.json({ error: result.error ?? "员工账号保存失败。" }, { status: 400 });

  const account = publicStaffAccount(result.account);
  await recordAuditLog({
    action: "staff_account_update",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "staff_account",
    targetId: account.username,
    summary: account.pendingRoleChange?.status === "pending" ? "员工角色变更已提交审批" : account.status === "invited" ? "员工账号已邀请，等待设置密码激活" : "员工账号已保存",
    after: account,
  });
  return NextResponse.json({ account });
}
