import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

export type StaffRole = "admin" | "ops" | "warehouse" | "finance";

export type StaffSession = {
  username: string;
  displayName: string;
  role: StaffRole;
};

export const staffRoleLabels: Record<StaffRole, string> = {
  admin: "系统管理员",
  ops: "运营",
  warehouse: "仓库",
  finance: "财务",
};

export function canRequestInventoryAdjustment(role: StaffRole) {
  return role === "admin" || role === "ops" || role === "warehouse";
}

export function canReviewInventoryAdjustment(role: StaffRole) {
  return role === "admin" || role === "ops";
}

export const staffCookieName = "uk-warehouse-staff-session";

export const defaultStaffWhitelist = [
  {
    username: "ops",
    password: "Ops@2026Test",
    displayName: "运营主管",
    role: "ops" as StaffRole,
  },
  {
    username: "warehouse",
    password: "Warehouse@2026Test",
    displayName: "仓库操作",
    role: "warehouse" as StaffRole,
  },
  {
    username: "admin",
    password: "Admin@2026Test",
    displayName: "系统管理员",
    role: "admin" as StaffRole,
  },
];

export function getStaffWhitelist() {
  const configured = process.env.STAFF_WHITELIST_JSON;
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as typeof defaultStaffWhitelist;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }

  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_STAFF_LOGIN === "true") return defaultStaffWhitelist;
  return [];
}

export function findWhitelistedStaff(username: string, password: string) {
  return getStaffWhitelist().find((account) => account.username === username && account.password === password);
}

export function findDemoStaff(username: string, password: string) {
  return findWhitelistedStaff(username, password);
}

export function serializeStaffSession(session: StaffSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `v1.${payload}.${signPayload(payload)}`;
}

export function parseStaffSession(value?: string): StaffSession | null {
  if (!value) return null;

  try {
    const payload = verifySignedValue(value);
    if (!payload) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<StaffSession>;
    if (!parsed.username || !parsed.displayName || !parsed.role) return null;
    if (!["admin", "ops", "warehouse", "finance"].includes(parsed.role)) return null;
    return {
      username: parsed.username,
      displayName: parsed.displayName,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

function sessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.STAFF_WHITELIST_JSON ||
    "local-development-session-secret"
  );
}

function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function verifySignedValue(value: string) {
  const [version, payload, signature] = value.split(".");
  if (version !== "v1" || !payload || !signature) return null;

  const expected = signPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  return payload;
}

export async function requireStaffSession() {
  const cookieStore = await cookies();
  const session = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!session) redirect("/ops-login");
  return session;
}
