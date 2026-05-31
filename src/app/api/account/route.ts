import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordAuditLog } from "@/lib/auditLogStore";
import { parseCustomerSession } from "@/lib/customerAuth";
import { getCustomerAccountByCode, updateCustomerAccountProfile } from "@/lib/customerAccountStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanPlatforms(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return clean(value)
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function customerSession() {
  const cookieStore = await cookies();
  return parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
}

function safeAccount<T extends { passwordHash: string }>(account: T) {
  const { passwordHash, ...rest } = account;
  void passwordHash;
  return rest;
}

export async function GET() {
  const session = await customerSession();
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const account = await getCustomerAccountByCode(session.customerCode);
  if (!account) return NextResponse.json({ error: "未找到账号资料" }, { status: 404 });

  return NextResponse.json({ account: safeAccount(account) });
}

export async function PATCH(request: Request) {
  const session = await customerSession();
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const companyName = clean(body.companyName);
  const contactName = clean(body.contactName);
  const phone = clean(body.phone);
  if (!companyName || !contactName || !phone) {
    return NextResponse.json({ error: "请填写公司名称、联系人和手机。" }, { status: 400 });
  }

  try {
    const before = await getCustomerAccountByCode(session.customerCode);
    const account = await updateCustomerAccountProfile({
      customerCode: session.customerCode,
      companyName,
      contactName,
      phone,
      email: clean(body.email),
      vatNumber: clean(body.vatNumber),
      eoriNumber: clean(body.eoriNumber),
      platforms: cleanPlatforms(body.platforms),
      storeUrl: clean(body.storeUrl),
      businessAddress: clean(body.businessAddress),
    });
    if (!account) return NextResponse.json({ error: "未找到账号资料" }, { status: 404 });
    await recordAuditLog({
      action: "customer_profile_update",
      actorRole: "customer",
      actorName: account.username,
      targetType: "customer_profile",
      targetId: account.customerCode,
      customerCode: account.customerCode,
      summary: "客户更新了账号资料",
      before: before
        ? {
            companyName: before.companyName,
            contactName: before.contactName,
            phone: before.phone,
            email: before.email,
            vatNumber: before.vatNumber,
            eoriNumber: before.eoriNumber,
            platforms: before.platforms,
            storeUrl: before.storeUrl,
            businessAddress: before.businessAddress,
          }
        : undefined,
      after: {
        companyName: account.companyName,
        contactName: account.contactName,
        phone: account.phone,
        email: account.email,
        vatNumber: account.vatNumber,
        eoriNumber: account.eoriNumber,
        platforms: account.platforms,
        storeUrl: account.storeUrl,
        businessAddress: account.businessAddress,
      },
    });
    return NextResponse.json({ account: safeAccount(account) });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_ALREADY_EXISTS") {
      return NextResponse.json({ error: "该手机或邮箱已被其他账号使用。" }, { status: 409 });
    }
    throw error;
  }
}
