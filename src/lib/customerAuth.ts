import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

export type CustomerSession = {
  customerCode: string;
  username: string;
};

export const demoCustomers: Array<{ username: string; password: string; customerCode: string; companyName: string }> = [];

export function isDemoLoginEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_LOGIN === "true";
}

export function findDemoCustomer(username: string, password: string) {
  if (!isDemoLoginEnabled()) return undefined;
  return demoCustomers.find((account) => account.username === username && account.password === password);
}

export function serializeCustomerSession(session: CustomerSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `v1.${payload}.${signPayload(payload)}`;
}

export function parseCustomerSession(value?: string): CustomerSession | null {
  if (!value) return null;
  if (value === "1") return null;

  try {
    const payload = verifySignedValue(value);
    if (!payload) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<CustomerSession>;
    if (!parsed.customerCode || !parsed.username) return null;
    return {
      customerCode: parsed.customerCode,
      username: parsed.username,
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

export async function requireCustomerSession() {
  const cookieStore = await cookies();
  const session = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  if (!session) redirect("/login");
  return session;
}
