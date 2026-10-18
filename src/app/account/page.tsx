import { ShieldCheck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";
import { AccountSettingsForms } from "../components/AccountSettingsForms";
import { CustomerWorkbenchShell } from "../components/CustomerWorkbenchShell";

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
        wechat: account.wechat,
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
        companyName: fallbackCustomer?.companyName ?? "",
        contactName: fallbackCustomer?.contactName ?? session.username,
        phone: fallbackCustomer?.phone ?? "",
        wechat: fallbackCustomer?.wechat,
        email: fallbackCustomer?.email ?? (session.username.includes("@") ? session.username : undefined),
        vatNumber: fallbackCustomer?.vatNumber,
        eoriNumber: fallbackCustomer?.eoriNumber,
        platforms: fallbackCustomer?.platforms,
        storeUrl: fallbackCustomer?.storeUrl,
        businessAddress: fallbackCustomer?.businessAddress,
        status: fallbackCustomer?.status ?? ("verified" as const),
  };

  return (
    <CustomerWorkbenchShell active="account" customerCode={session.customerCode} customerCompany={accountView.companyName} title="店铺资料">
      <div className="px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                <ShieldCheck size={16} />
                客户账号
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">联系人与店铺信息</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">可选填写，方便我们联系您。默认使用登录邮箱，保存后可以随时修改。</p>
              </div>
            </div>
          </section>

          <AccountSettingsForms account={accountView} editable />
        </div>
      </div>
    </CustomerWorkbenchShell>
  );
}
