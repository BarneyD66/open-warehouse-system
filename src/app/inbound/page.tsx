import Link from "next/link";
import { ArrowRight, ClipboardCheck, PackageCheck, Truck, Warehouse } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { getSubmissionsForCustomer, type InboundSubmission } from "@/lib/localStore";
import { CustomerInboundForm } from "../components/CustomerMvpForms";
import { CustomerInboundHistory } from "../components/CustomerInboundHistory";
import { CustomerWorkbenchShell } from "../components/CustomerWorkbenchShell";
import { warehouseAddress } from "../components/MarketingShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function InboundPage() {
  const session = await requireCustomerSession();
  const [submissions, account] = await Promise.all([getSubmissionsForCustomer(session.customerCode), getCustomerAccountByCode(session.customerCode)]);
  const contactEmail = account?.email || (session.username.includes("@") ? session.username : "");
  const inbounds = submissions.filter((item): item is InboundSubmission => item.type === "inbound");

  return (
    <CustomerWorkbenchShell
      actions={<Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800" href="#history">已提交 {inbounds.length} 条</Link>}
      active="inbound"
      customerCode={session.customerCode}
      title="入库预报"
    >
      <div className="text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <aside className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">入库预报</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">提交到仓信息</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">发货到英国仓前先提交货件信息，仓库可以提前识别店铺、商品、箱数、追踪号和资料。</p>
            </section>
            <section className="grid gap-3">
              {[
                { icon: PackageCheck, title: "登记货件", body: "填写预计到仓、箱数、商品编码和运输方式。" },
                { icon: ClipboardCheck, title: "补齐资料", body: "装箱单、商品清单、外箱标签越完整，审核越快。" },
                { icon: Truck, title: "到仓识别", body: "追踪号或承运商信息可帮助仓库提前识别批次。" },
              ].map(({ icon: Icon, title, body }) => (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={title}>
                  <Icon className="text-[#0E7490]" size={20} />
                  <h2 className="mt-3 text-sm font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Warehouse size={16} className="text-[#0E7490]" />
                英国仓地址
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{warehouseAddress.full}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">送货、提货和到访请提前预约。</p>
            </section>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/workspace">
              返回订单处理工作台 <ArrowRight size={16} />
            </Link>
          </aside>
          <div>
            <CustomerInboundForm contactEmail={contactEmail} />
          </div>
          <div className="lg:col-span-2">
            <CustomerInboundHistory items={inbounds} />
          </div>
        </div>
      </div>
    </CustomerWorkbenchShell>
  );
}
