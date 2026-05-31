import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";
import { makeCustomerCode, updateWarehouseCustomerProfile, upsertWarehouseCustomer } from "./warehouseCoreStore";

export type CustomerAccountStatus = "unverified" | "verified" | "paused";

export type RegisteredCustomerAccount = {
  username: string;
  passwordHash: string;
  customerCode: string;
  companyName: string;
  contactName: string;
  phone: string;
  email?: string;
  vatNumber?: string;
  eoriNumber?: string;
  platforms?: string[];
  storeUrl?: string;
  businessAddress?: string;
  status: CustomerAccountStatus;
  createdAt: string;
  updatedAt?: string;
};

export type CustomerAccountView = Omit<RegisteredCustomerAccount, "passwordHash">;

type CustomerAccountData = {
  accounts: RegisteredCustomerAccount[];
};

const accountStorePath = process.env.VERCEL
  ? path.join("/tmp", "warehouse-system-data", "customer-accounts.json")
  : path.join(process.cwd(), ".local-data", "customer-accounts.json");

function now() {
  return new Date().toISOString();
}

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

function legacyHashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("scrypt$")) {
    const [, salt, hash] = storedHash.split("$");
    if (!salt || !hash) return false;
    const expected = Buffer.from(hash, "base64url");
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  return storedHash === legacyHashPassword(password);
}

async function readAccounts(): Promise<CustomerAccountData> {
  if (hasPostgresConfig()) {
    const sql = getSql();
    const rows = await sql<Array<{
      username: string;
      password_hash: string;
      customer_code: string;
      phone: string;
      email: string | null;
      status: CustomerAccountStatus | "active";
      created_at: Date | string;
      updated_at: Date | string | null;
      company_name: string | null;
      contact_name: string | null;
      vat_number: string | null;
      eori_number: string | null;
      platforms: string[] | null;
      store_url: string | null;
      business_address: string | null;
    }>>`
      select
        a.username,
        a.password_hash,
        a.customer_code,
        a.phone,
        a.email,
        a.status,
        a.created_at,
        a.updated_at,
        c.company_name,
        c.contact_name,
        c.vat_number,
        c.eori_number,
        c.platforms,
        c.store_url,
        c.business_address
      from warehouse_customer_accounts a
      left join warehouse_customers c on c.customer_code = a.customer_code
      order by a.created_at desc
    `;

    return {
      accounts: rows.map((row) => ({
        username: row.username,
        passwordHash: row.password_hash,
        customerCode: row.customer_code,
        companyName: row.company_name || row.customer_code,
        contactName: row.contact_name || "",
        phone: row.phone,
        email: row.email || undefined,
        vatNumber: row.vat_number || undefined,
        eoriNumber: row.eori_number || undefined,
        platforms: row.platforms || [],
        storeUrl: row.store_url || undefined,
        businessAddress: row.business_address || undefined,
        status: row.status === "active" ? "verified" : row.status,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      })),
    };
  }

  try {
    const raw = await readFile(accountStorePath, "utf8");
    const parsed = JSON.parse(raw) as { accounts?: Array<Omit<RegisteredCustomerAccount, "status"> & { status?: CustomerAccountStatus | "active" }> };
    return {
      accounts: Array.isArray(parsed.accounts)
        ? (parsed.accounts.map((account) => ({
            ...account,
            status: account.status === "active" ? "verified" : account.status,
          })) as RegisteredCustomerAccount[])
        : [],
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { accounts: [] };
    if (error instanceof SyntaxError) return { accounts: [] };
    throw error;
  }
}

async function writeAccounts(data: CustomerAccountData) {
  if (hasPostgresConfig()) {
    const sql = getSql();
    for (const account of data.accounts) {
      await upsertWarehouseCustomer({
        customerCode: account.customerCode,
        companyName: account.companyName,
        contactName: account.contactName,
        phone: account.phone,
        email: account.email,
        vatNumber: account.vatNumber,
        eoriNumber: account.eoriNumber,
        platforms: account.platforms,
        storeUrl: account.storeUrl,
        businessAddress: account.businessAddress,
        status: account.status,
      });

      await sql`
        insert into warehouse_customer_accounts (
          username, customer_code, password_hash, phone, email, status, created_at, updated_at
        ) values (
          ${account.username}, ${account.customerCode}, ${account.passwordHash}, ${account.phone}, ${account.email ?? null},
          ${account.status}, ${account.createdAt}, ${account.updatedAt ?? null}
        )
        on conflict (username) do update set
          customer_code = excluded.customer_code,
          password_hash = excluded.password_hash,
          phone = excluded.phone,
          email = excluded.email,
          status = excluded.status,
          updated_at = excluded.updated_at
      `;
    }
    return;
  }

  await mkdir(path.dirname(accountStorePath), { recursive: true });
  await writeFile(accountStorePath, JSON.stringify(data, null, 2), "utf8");
}

export async function findRegisteredCustomer(username: string, password: string) {
  const data = await readAccounts();
  const normalized = normalizeLogin(username);
  return (
    data.accounts.find(
      (account) =>
        canLogin(account.status) &&
        verifyPassword(password, account.passwordHash) &&
        (account.username === normalized || account.phone === username.trim() || account.email?.toLowerCase() === normalized),
    ) ?? null
  );
}

function canLogin(status: RegisteredCustomerAccount["status"] | "active") {
  return status === "unverified" || status === "verified" || status === "active";
}

export async function checkCustomerAccountAvailability({ phone, email }: { phone?: string; email?: string }) {
  const data = await readAccounts();
  const cleanedPhone = phone?.trim();
  const cleanedEmail = email?.trim().toLowerCase();
  return {
    phoneTaken: Boolean(cleanedPhone && data.accounts.some((account) => account.phone === cleanedPhone)),
    emailTaken: Boolean(cleanedEmail && data.accounts.some((account) => account.email?.toLowerCase() === cleanedEmail || account.username === cleanedEmail)),
  };
}

export async function getCustomerAccountByCode(customerCode: string) {
  const data = await readAccounts();
  return data.accounts.find((account) => account.customerCode === customerCode) ?? null;
}

function toCustomerAccountView(account: RegisteredCustomerAccount): CustomerAccountView {
  const { passwordHash, ...view } = account;
  void passwordHash;
  return view;
}

export async function getCustomerAccounts() {
  const data = await readAccounts();
  return data.accounts.map(toCustomerAccountView);
}

export async function updateCustomerAccountStatus(customerCode: string, status: CustomerAccountStatus) {
  const data = await readAccounts();
  const index = data.accounts.findIndex((account) => account.customerCode === customerCode);
  if (index < 0) return null;

  const updated: RegisteredCustomerAccount = {
    ...data.accounts[index],
    status,
    updatedAt: now(),
  };

  data.accounts[index] = updated;
  await writeAccounts(data);
  await updateWarehouseCustomerProfile(customerCode, { status });
  return toCustomerAccountView(updated);
}

export async function registerCustomerAccount({
  companyName,
  contactName,
  phone,
  email,
  password,
}: {
  companyName: string;
  contactName: string;
  phone: string;
  email?: string;
  password: string;
}) {
  const cleanedCompany = companyName.trim();
  const cleanedContact = contactName.trim();
  const cleanedPhone = phone.trim();
  const cleanedEmail = email?.trim().toLowerCase() || undefined;
  const username = cleanedEmail || cleanedPhone;

  if (!cleanedCompany || !cleanedContact || !cleanedPhone || !password) return null;
  if (password.length < 6) throw new Error("PASSWORD_TOO_SHORT");

  const data = await readAccounts();
  const hasDuplicate = data.accounts.some((account) => account.username === username || account.phone === cleanedPhone || (cleanedEmail && account.email?.toLowerCase() === cleanedEmail));
  if (hasDuplicate) throw new Error("CUSTOMER_ALREADY_EXISTS");

  const account: RegisteredCustomerAccount = {
    username,
    passwordHash: hashPassword(password),
    customerCode: makeCustomerCode(),
    companyName: cleanedCompany,
    contactName: cleanedContact,
    phone: cleanedPhone,
    email: cleanedEmail,
    status: "unverified",
    createdAt: now(),
  };

  data.accounts.unshift(account);
  await writeAccounts(data);
  await upsertWarehouseCustomer({
    customerCode: account.customerCode,
    companyName: account.companyName,
    contactName: account.contactName,
    phone: account.phone,
    email: account.email,
    status: "unverified",
  });

  return account;
}

export async function updateCustomerAccountProfile({
  customerCode,
  companyName,
  contactName,
  phone,
  email,
  vatNumber,
  eoriNumber,
  platforms,
  storeUrl,
  businessAddress,
}: {
  customerCode: string;
  companyName: string;
  contactName: string;
  phone: string;
  email?: string;
  vatNumber?: string;
  eoriNumber?: string;
  platforms?: string[];
  storeUrl?: string;
  businessAddress?: string;
}) {
  const data = await readAccounts();
  const index = data.accounts.findIndex((account) => account.customerCode === customerCode);
  if (index < 0) return null;

  const cleanedEmail = email?.trim().toLowerCase() || undefined;
  const cleanedPhone = phone.trim();
  const duplicate = data.accounts.some(
    (account, accountIndex) =>
      accountIndex !== index &&
      (account.phone === cleanedPhone || (cleanedEmail && (account.email?.toLowerCase() === cleanedEmail || account.username === cleanedEmail))),
  );
  if (duplicate) throw new Error("CUSTOMER_ALREADY_EXISTS");

  const current = data.accounts[index];
  const username = cleanedEmail || cleanedPhone;
  const updated: RegisteredCustomerAccount = {
    ...current,
    username,
    companyName: companyName.trim(),
    contactName: contactName.trim(),
    phone: cleanedPhone,
    email: cleanedEmail,
    vatNumber: vatNumber?.trim() || undefined,
    eoriNumber: eoriNumber?.trim() || undefined,
    platforms: platforms?.map((item) => item.trim()).filter(Boolean) ?? [],
    storeUrl: storeUrl?.trim() || undefined,
    businessAddress: businessAddress?.trim() || undefined,
    updatedAt: now(),
  };

  data.accounts[index] = updated;
  await writeAccounts(data);
  if (hasPostgresConfig() && current.username !== updated.username) {
    const sql = getSql();
    await sql`delete from warehouse_customer_accounts where username = ${current.username}`;
  }
  await updateWarehouseCustomerProfile(customerCode, {
    companyName: updated.companyName,
    contactName: updated.contactName,
    phone: updated.phone,
    email: updated.email,
    vatNumber: updated.vatNumber,
    eoriNumber: updated.eoriNumber,
    platforms: updated.platforms,
    storeUrl: updated.storeUrl,
    businessAddress: updated.businessAddress,
  });
  return updated;
}

export async function changeCustomerPassword(customerCode: string, currentPassword: string, newPassword: string) {
  if (newPassword.length < 6) throw new Error("PASSWORD_TOO_SHORT");
  const data = await readAccounts();
  const index = data.accounts.findIndex((account) => account.customerCode === customerCode);
  if (index < 0) return null;
  if (!verifyPassword(currentPassword, data.accounts[index].passwordHash)) throw new Error("INVALID_CURRENT_PASSWORD");

  data.accounts[index] = { ...data.accounts[index], passwordHash: hashPassword(newPassword), updatedAt: now() };
  await writeAccounts(data);
  return toCustomerAccountView(data.accounts[index]);
}

export async function resetCustomerPassword(login: string, newPassword: string) {
  if (newPassword.length < 6) throw new Error("PASSWORD_TOO_SHORT");
  const data = await readAccounts();
  const normalized = normalizeLogin(login);
  const index = data.accounts.findIndex((account) => account.username === normalized || account.phone === login.trim() || account.email?.toLowerCase() === normalized);
  if (index < 0) return null;

  data.accounts[index] = { ...data.accounts[index], passwordHash: hashPassword(newPassword), updatedAt: now() };
  await writeAccounts(data);
  return toCustomerAccountView(data.accounts[index]);
}
