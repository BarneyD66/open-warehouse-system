import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";
import type { StaffRole } from "./staffAuth";

export type ManagedStaffStatus = "invited" | "active" | "disabled";
export type StaffRoleChangeStatus = "pending" | "approved" | "rejected";

export type StaffRoleChangeRequest = {
  currentRole: StaffRole;
  requestedRole: StaffRole;
  status: StaffRoleChangeStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type ManagedStaffAccount = {
  username: string;
  displayName: string;
  role: StaffRole;
  status: ManagedStaffStatus;
  passwordHash: string;
  invitedBy: string;
  invitedAt: string;
  updatedAt: string;
  disabledReason?: string;
  failedLoginCount?: number;
  lastFailedLoginAt?: string;
  lastFailedLoginReason?: string;
  lockedUntil?: string;
  lastLoginAt?: string;
  pendingRoleChange?: StaffRoleChangeRequest;
};

export type ManagedStaffAccountView = Omit<ManagedStaffAccount, "passwordHash">;

const storePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "staff-accounts.json") : path.join(process.cwd(), ".local-data", "staff-accounts.json");
const validRoles: StaffRole[] = ["admin", "ops", "warehouse", "finance"];

function now() {
  return new Date().toISOString();
}

export async function unlockManagedStaffAccount(username: string) {
  const accounts = await readAccounts();
  const account = accounts.find((item) => item.username === username.trim());
  if (!account) return { account: null, error: "未找到员工账号。" };
  if (account.status === "disabled") return { account: null, error: "账号已禁用，请先确认禁用原因后再重新设置密码激活。" };
  account.failedLoginCount = 0;
  account.lastFailedLoginReason = undefined;
  account.lockedUntil = undefined;
  account.updatedAt = now();
  await writeAccounts(accounts);
  return { account, error: null };
}

function hashPassword(password: string, salt = randomBytes(12).toString("hex")) {
  const digest = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return `${salt}:${digest}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const next = hashPassword(password, salt).split(":")[1];
  const left = Buffer.from(next);
  const right = Buffer.from(digest);
  return left.length === right.length && timingSafeEqual(left, right);
}

function passwordPolicyError(password: string) {
  const value = password.trim();
  if (value.length < 8) return "新密码至少需要 8 位。";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "新密码需要同时包含字母和数字。";
  return "";
}

async function ensureStaffAccountsTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_staff_accounts (
      username text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
}

async function readPostgresAccounts(): Promise<ManagedStaffAccount[]> {
  await ensureStaffAccountsTable();
  const sql = getSql();
  const rows = await sql<{ payload: ManagedStaffAccount }[]>`
    select payload from warehouse_staff_accounts order by updated_at desc
  `;
  return rows.map((row) => row.payload).filter((item) => item?.username);
}

async function writePostgresAccounts(accounts: ManagedStaffAccount[]) {
  await ensureStaffAccountsTable();
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`delete from warehouse_staff_accounts`;
    for (const account of accounts) {
      await tx`
        insert into warehouse_staff_accounts (username, payload, updated_at)
        values (${account.username}, ${tx.json(account)}, now())
        on conflict (username) do update set
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `;
    }
  });
}

async function readAccounts(): Promise<ManagedStaffAccount[]> {
  if (hasPostgresConfig()) return readPostgresAccounts();
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as ManagedStaffAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: ManagedStaffAccount[]) {
  if (hasPostgresConfig()) {
    await writePostgresAccounts(accounts);
    return;
  }
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(accounts, null, 2), "utf8");
}

export function publicStaffAccount(account: ManagedStaffAccount): ManagedStaffAccountView {
  return {
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    status: account.status,
    invitedBy: account.invitedBy,
    invitedAt: account.invitedAt,
    updatedAt: account.updatedAt,
    disabledReason: account.disabledReason,
    failedLoginCount: account.failedLoginCount,
    lastFailedLoginAt: account.lastFailedLoginAt,
    lastFailedLoginReason: account.lastFailedLoginReason,
    lockedUntil: account.lockedUntil,
    lastLoginAt: account.lastLoginAt,
    pendingRoleChange: account.pendingRoleChange,
  };
}

export async function getManagedStaffAccounts() {
  const accounts = await readAccounts();
  return accounts.map(publicStaffAccount);
}

export async function authenticateManagedStaff(username: string, password: string) {
  const accounts = await readAccounts();
  const account = accounts.find((item) => item.username === username.trim());
  if (!account || account.status !== "active") return null;
  const timestamp = now();
  if (account.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now()) {
    account.lastFailedLoginAt = timestamp;
    account.lastFailedLoginReason = "账号已被临时锁定";
    account.updatedAt = timestamp;
    await writeAccounts(accounts);
    return null;
  }
  if (!verifyPassword(password, account.passwordHash)) {
    const failedLoginCount = (account.failedLoginCount ?? 0) + 1;
    account.failedLoginCount = failedLoginCount;
    account.lastFailedLoginAt = timestamp;
    account.lastFailedLoginReason = failedLoginCount >= 5 ? "连续登录失败，账号临时锁定 30 分钟" : "密码错误";
    account.lockedUntil = failedLoginCount >= 5 ? new Date(Date.now() + 30 * 60_000).toISOString() : undefined;
    account.updatedAt = timestamp;
    await writeAccounts(accounts);
    return null;
  }
  account.lastLoginAt = timestamp;
  account.failedLoginCount = 0;
  account.lastFailedLoginReason = undefined;
  account.lockedUntil = undefined;
  account.updatedAt = account.lastLoginAt;
  await writeAccounts(accounts);
  return account;
}

export async function upsertManagedStaffAccount(input: {
  username: string;
  displayName: string;
  role: StaffRole;
  password?: string;
  invitedBy: string;
}) {
  const accounts = await readAccounts();
  const cleanUsername = input.username.trim();
  const cleanPassword = input.password?.trim();
  const timestamp = now();
  if (!cleanUsername) return { account: null, error: "请填写员工账号。" };
  if (!validRoles.includes(input.role)) return { account: null, error: "员工角色不正确。" };
  if (cleanPassword) {
    const policyError = passwordPolicyError(cleanPassword);
    if (policyError) return { account: null, error: policyError };
  }

  const existing = accounts.find((item) => item.username === cleanUsername);
  if (existing) {
    existing.displayName = input.displayName.trim() || existing.displayName;
    if (existing.role !== input.role) {
      existing.pendingRoleChange = {
        currentRole: existing.role,
        requestedRole: input.role,
        status: "pending",
        requestedBy: input.invitedBy,
        requestedAt: timestamp,
      };
    }
    if (cleanPassword) {
      existing.status = "active";
      existing.disabledReason = undefined;
      existing.passwordHash = hashPassword(cleanPassword);
    }
    existing.updatedAt = timestamp;
    await writeAccounts(accounts);
    return { account: existing, error: null };
  }

  const account: ManagedStaffAccount = {
    username: cleanUsername,
    displayName: input.displayName.trim() || cleanUsername,
    role: input.role,
    status: cleanPassword ? "active" : "invited",
    passwordHash: hashPassword(cleanPassword || randomBytes(18).toString("hex")),
    invitedBy: input.invitedBy,
    invitedAt: timestamp,
    updatedAt: timestamp,
  };
  accounts.unshift(account);
  await writeAccounts(accounts);
  return { account, error: null };
}

export async function reviewManagedStaffRoleChange(input: {
  username: string;
  decision: "approve" | "reject";
  reviewedBy: string;
  note?: string;
}) {
  const accounts = await readAccounts();
  const account = accounts.find((item) => item.username === input.username.trim());
  if (!account) return { account: null, error: "未找到员工账号。" };
  if (!account.pendingRoleChange || account.pendingRoleChange.status !== "pending") return { account: null, error: "该员工没有待审批的角色变更。" };

  const timestamp = now();
  account.pendingRoleChange.status = input.decision === "approve" ? "approved" : "rejected";
  account.pendingRoleChange.reviewedBy = input.reviewedBy;
  account.pendingRoleChange.reviewedAt = timestamp;
  account.pendingRoleChange.reviewNote = input.note?.trim();
  if (input.decision === "approve") account.role = account.pendingRoleChange.requestedRole;
  account.updatedAt = timestamp;
  await writeAccounts(accounts);
  return { account, error: null };
}

export async function changeManagedStaffPassword(input: {
  username: string;
  currentPassword: string;
  newPassword: string;
}) {
  const accounts = await readAccounts();
  const account = accounts.find((item) => item.username === input.username.trim());
  if (!account) return { account: null, error: "该账号来自员工白名单，请到环境变量或员工管理后台重置密码。" };
  if (account.status !== "active") return { account: null, error: "该员工账号当前不可用。" };
  if (!verifyPassword(input.currentPassword, account.passwordHash)) return { account: null, error: "当前密码不正确。" };
  const policyError = passwordPolicyError(input.newPassword);
  if (policyError) return { account: null, error: policyError };
  account.passwordHash = hashPassword(input.newPassword.trim());
  account.updatedAt = now();
  await writeAccounts(accounts);
  return { account, error: null };
}

export async function disableManagedStaffAccount(username: string, reason: string) {
  const accounts = await readAccounts();
  const account = accounts.find((item) => item.username === username.trim());
  if (!account) return { account: null, error: "未找到员工账号。" };
  account.status = "disabled";
  account.disabledReason = reason.trim() || "管理员禁用。";
  account.updatedAt = now();
  await writeAccounts(accounts);
  return { account, error: null };
}
