import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, RotateCcw, Search } from "lucide-react";
import { CustomerReturnDecisionPanel } from "@/app/components/CustomerReturnDecisionPanel";
import { CustomerReturnTrackingPanel } from "@/app/components/CustomerReturnTrackingPanel";
import { CustomerReturnForm } from "@/app/components/CustomerOperationForms";
import { CustomerWorkbenchShell } from "@/app/components/CustomerWorkbenchShell";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getWarehouseCoreDataForCustomer, returnOrderStatusLabel, returnResolutionLabel, type ReturnOrder } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "green" | "amber" | "blue" | "slate" | "rose";
type ReturnFilter = "all" | "active" | "needs-decision" | "done";

const toneClass: Record<Tone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-cyan-200 bg-cyan-50 text-cyan-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-semibold ${toneClass[tone]}`}>{children}</span>;
}

function statusTone(status: ReturnOrder["status"]): Tone {
  if (status === "restocked" || status === "closed") return "green";
  if (status === "exception" || status === "disposed") return "rose";
  if (status === "received" || status === "inspection" || status === "repair") return "amber";
  if (status === "label_sent" || status === "in_transit") return "blue";
  return "slate";
}

function isNeedsDecision(order: ReturnOrder) {
  return ["received", "inspection", "repair", "exception"].includes(order.status) && !order.customerResolutionDecision;
}

function isDone(order: ReturnOrder) {
  return ["restocked", "disposed", "closed"].includes(order.status);
}

function filterReturns(items: ReturnOrder[], filter: ReturnFilter, keyword: string) {
  const statusFiltered =
    filter === "active" ? items.filter((item) => !isDone(item)) : filter === "needs-decision" ? items.filter(isNeedsDecision) : filter === "done" ? items.filter(isDone) : items;
  const query = keyword.trim().toLowerCase();
  if (!query) return statusFiltered;
  return statusFiltered.filter((item) =>
    [item.id, item.platform, item.originalOrderNo, item.buyerReturnTracking, item.returnReason, ...item.skuLines.map((line) => line.skuCode)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

export default async function ReturnsPage({ searchParams }: { searchParams?: Promise<{ status?: string | string[]; q?: string | string[] }> }) {
  const params = await searchParams;
  const statusParam = Array.isArray(params?.status) ? params?.status[0] : params?.status;
  const keyword = Array.isArray(params?.q) ? params?.q[0] ?? "" : params?.q ?? "";
  const activeFilter: ReturnFilter = ["active", "needs-decision", "done"].includes(statusParam ?? "") ? (statusParam as ReturnFilter) : "all";
  const session = await requireCustomerSession();
  const [account, coreData] = await Promise.all([getCustomerAccountByCode(session.customerCode), getWarehouseCoreDataForCustomer(session.customerCode)]);
  const returns = [...coreData.returnOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
  const visibleReturns = filterReturns(returns, activeFilter, keyword);
  const activeCount = returns.filter((item) => !isDone(item)).length;
  const needsDecisionCount = returns.filter(isNeedsDecision).length;
  const doneCount = returns.filter(isDone).length;
  const exportParams = new URLSearchParams({ kind: "returns" });
  if (activeFilter !== "all") exportParams.set("status", activeFilter);
  if (keyword.trim()) exportParams.set("q", keyword.trim());

  return (
    <CustomerWorkbenchShell active="returns" customerCode={session.customerCode} customerCompany={account?.companyName ?? coreData.customer?.companyName} eyebrow="退货到仓、质检与处理" title="退货售后">
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="blue">退货预报</Pill>
                <Pill tone={needsDecisionCount ? "amber" : "slate"}>{needsDecisionCount ? "有待确认事项" : "暂无待确认"}</Pill>
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">提交退货信息，我们协助到仓识别和质检。</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                如果平台订单发生退货，您可以提交原订单号、退货追踪号、SKU 和处理偏好。退货到仓后，我们会更新质检结果；需要您确认处理方式时，系统会在这里提示。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" href="#create-return">
                  <RotateCcw size={16} />
                  提交退货预报
                </Link>
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/api/downloads?${exportParams.toString()}`}>
                  <Download size={16} />
                  导出退货记录
                </Link>
              </div>
            </div>
            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">当前退货进度</h3>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <span className="text-slate-600">处理中</span>
                  <Pill tone={activeCount ? "amber" : "slate"}>{activeCount} 单</Pill>
                </div>
                <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <span className="text-slate-600">待确认</span>
                  <Pill tone={needsDecisionCount ? "rose" : "green"}>{needsDecisionCount} 单</Pill>
                </div>
                <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <span className="text-slate-600">已完成</span>
                  <Pill tone="green">{doneCount} 单</Pill>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="scroll-mt-24" id="create-return">
            <CustomerReturnForm />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-700" size={18} />
              <h2 className="text-base font-semibold text-slate-950">退货怎么处理</h2>
            </div>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2">
              <p className="rounded-md bg-slate-50 p-3">1. 您提交退货预报，填写原订单号、SKU 和退货追踪号。</p>
              <p className="rounded-md bg-slate-50 p-3">2. 包裹到达英国仓后，我们按追踪号或 RMA 单号识别。</p>
              <p className="rounded-md bg-slate-50 p-3">3. 仓库完成质检后，会更新商品状态和处理建议。</p>
              <p className="rounded-md bg-slate-50 p-3">4. 如需您确认，我们会在退货记录里显示可选处理方式。</p>
            </div>
          </section>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">退货记录</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">这里会显示您提交的退货预报、到仓质检和处理结果。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "全部", href: "/returns", active: activeFilter === "all" },
                { label: "处理中", href: "/returns?status=active", active: activeFilter === "active" },
                { label: "待确认", href: "/returns?status=needs-decision", active: activeFilter === "needs-decision" },
                { label: "已完成", href: "/returns?status=done", active: activeFilter === "done" },
              ].map((item) => (
                <Link className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold ${item.active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <form action="/returns" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
            {activeFilter !== "all" ? <input name="status" type="hidden" value={activeFilter} /> : null}
            <label className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 focus-within:border-cyan-500">
              <Search size={16} className="text-slate-400" />
              <input className="min-h-8 flex-1 bg-transparent text-sm outline-none" defaultValue={keyword} name="q" placeholder="搜索 RMA、追踪号、原订单号或 SKU" />
            </label>
            <button className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" type="submit">搜索</button>
          </form>

          <div className="mt-4 space-y-3">
            {visibleReturns.length > 0 ? (
              visibleReturns.map((order) => (
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={order.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-slate-500">{order.id}</p>
                      <h3 className="mt-1 text-base font-semibold text-slate-950">{order.platform} / {order.originalOrderNo || "原订单号待补"}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{order.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join("，")}</p>
                    </div>
                    <Pill tone={statusTone(order.status)}>{returnOrderStatusLabel(order.status)}</Pill>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                    <p className="rounded-md bg-white p-2">退货追踪号：<span className="font-semibold text-slate-950">{order.buyerReturnTracking || "待补充"}</span></p>
                    <p className="rounded-md bg-white p-2">预计到仓：<span className="font-semibold text-slate-950">{order.expectedArrivalDate || "-"}</span></p>
                    <p className="rounded-md bg-white p-2">处理方式：<span className="font-semibold text-slate-950">{returnResolutionLabel(order.customerResolutionDecision ?? order.resolution)}</span></p>
                    <p className="rounded-md bg-white p-2">更新时间：<span className="font-semibold text-slate-950">{dateText(order.updatedAt ?? order.createdAt)}</span></p>
                  </div>
                  <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">退货原因：{order.returnReason}</p>
                  {order.inspectionResult ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">质检结果：{order.inspectionResult}</p> : null}
                  {!order.buyerReturnTracking && !isDone(order) ? <CustomerReturnTrackingPanel orderId={order.id} /> : null}
                  {isNeedsDecision(order) ? <CustomerReturnDecisionPanel currentDecision={order.resolution} orderId={order.id} /> : null}
                </article>
              ))
            ) : (
              <EmptyState title="暂无退货记录" body="提交退货预报后，这里会显示到仓、质检和处理进度。" />
            )}
          </div>
        </section>

        <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/workspace">
          返回订单处理工作台 <ArrowRight size={16} />
        </Link>
      </div>
    </CustomerWorkbenchShell>
  );
}
