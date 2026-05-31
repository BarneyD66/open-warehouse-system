import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";
import { AccountSettingsForms } from "../components/AccountSettingsForms";
import { LogoutButton } from "../components/LogoutButton";
import { PageShell } from "../components/MarketingShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AccountPage() {
  const session = await requireCustomerSession();
  const [account, coreData] = await Promise.all([getCustomerAccountByCode(session.customerCode), getWarehouseCoreDataForCustomer(session.customerCode)]);
  const fallbackCustomer = coreData.customer;
  const accountView = account
    ? {
        customerCode: account.customerCode,
        username: account.username,
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
      }
    : {
        customerCode: session.customerCode,
        username: session.username,
        companyName: fallbackCustomer?.companyName ?? "未完善公司资料",
        contactName: fallbackCustomer?.contactName ?? session.username,
        phone: fallbackCustomer?.phone ?? "",
        email: fallbackCustomer?.email,
        vatNumber: fallbackCustomer?.vatNumber,
        eoriNumber: fallbackCustomer?.eoriNumber,
        platforms: fallbackCustomer?.platforms,
        storeUrl: fallbackCustomer?.storeUrl,
        businessAddress: fallbackCustomer?.businessAddress,
        status: fallbackCustomer?.status ?? ("verified" as const),
      };

  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/portal">
              <ArrowLeft size={16} />
              返回客户工作台
            </Link>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  <ShieldCheck size={16} />
                  客户账号
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">账号与公司资料</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">维护公司、税务、平台和登录安全信息。认证状态会影响账期、合同价和正式入库权限。</p>
              </div>
              {!account ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">演示账号资料只读；请使用自注册账号体验保存。</p> : null}
              <LogoutButton nextPath="/login" />
            </div>
          </section>

          <AccountSettingsForms account={accountView} editable={Boolean(account)} />
        </div>
      </div>
    </PageShell>
  );
}
