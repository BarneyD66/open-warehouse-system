import Link from "next/link";
import { ArrowRight, RotateCcw, Search, ShieldCheck, Warehouse } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getWarehouseCoreDataForCustomer, returnOrderStatusLabel, type ReturnOrder } from "@/lib/warehouseCoreStore";
import { CustomerReturnForm } from "../components/CustomerOperationForms";
import { PageShell } from "../components/MarketingShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneClass: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
};

function statusTone(status: ReturnOrder["status"]): Tone {
  if (status === "restocked" || status === "closed") return "emerald";
  if (status === "exception" || status === "disposed") return "rose";
  if (status === "received" || status === "inspection" || status === "repair") return "amber";
  if (status === "label_sent" || status === "in_transit") return "cyan";
  return "slate";
}

function pill(label: string, tone: Tone = "slate") {
  return <span className={`inline-flex h-fit rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>{label}</span>;
}

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function ReturnsPage() {
  const session = await requireCustomerSession();
  const coreData = await getWarehouseCoreDataForCustomer(session.customerCode);
  const returns = [...coreData.returnOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());

  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <aside className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">退货 / RMA</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">创建退货预报与质检处理</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">把平台退货、买家追踪号、SKU 和处理偏好提交给仓库。到仓后运营会更新质检结果，并按重新上架、维修、报废或转寄处理。</p>
            </section>
            <section className="grid gap-3">
              {[
                { icon: Search, title: "退货识别", body: "用平台订单号、追踪号和 SKU 对应到客户退货单。" },
                { icon: ShieldCheck, title: "质检留痕", body: "记录外观、包装、缺件、破损等检查结果。" },
                { icon: Warehouse, title: "重新上架", body: "可售商品确认后写入库存流水和库位。" },
              ].map(({ icon: Icon, title, body }) => (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={title}>
                  <Icon className="text-[#0E7490]" size={20} />
                  <h2 className="mt-3 text-sm font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </section>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/portal">
              返回客户工作台 <ArrowRight size={16} />
            </Link>
          </aside>

          <div className="space-y-5">
            <CustomerReturnForm />
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <RotateCcw size={17} className="text-[#0E7490]" />
                <h2 className="text-base font-semibold text-slate-950">我的退货预报</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {returns.length > 0 ? (
                  returns.map((order) => (
                    <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={order.id}>
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-500">{order.id}</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">{order.platform} / {order.originalOrderNo || "订单号待补"}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{order.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join("，")}</p>
                        <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-500">
                          <p>买家追踪号：{order.buyerReturnTracking || "待补"}</p>
                          <p>预计到仓：{order.expectedArrivalDate || "-"}</p>
                          <p>最近更新：{dateText(order.updatedAt ?? order.createdAt)}</p>
                        </div>
                        <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{order.returnReason}</p>
                        {order.inspectionResult ? <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">质检：{order.inspectionResult}</p> : null}
                      </div>
                      {pill(returnOrderStatusLabel(order.status), statusTone(order.status))}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">暂无退货预报</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
