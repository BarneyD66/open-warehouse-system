import Link from "next/link";
import { ArrowRight, Download, RotateCcw, Search, ShieldCheck, Warehouse } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getDocumentsForCustomer, signDocumentToken } from "@/lib/documentStore";
import { getWarehouseCoreDataForCustomer, returnOrderStatusLabel, type ReturnOrder } from "@/lib/warehouseCoreStore";
import { CustomerReturnForm } from "../components/CustomerOperationForms";
import { CustomerReturnDecisionPanel } from "../components/CustomerReturnDecisionPanel";
import { CustomerReturnTrackingBulkPanel } from "../components/CustomerReturnTrackingBulkPanel";
import { CustomerReturnTrackingPanel } from "../components/CustomerReturnTrackingPanel";
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

function signedDocumentDownloadHref(id: string) {
  const token = signDocumentToken(id, Date.now() + 30 * 60 * 1000);
  return `/api/documents/${encodeURIComponent(id)}/download?token=${encodeURIComponent(token)}`;
}

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

type ReturnFilter = "all" | "submitted" | "in-transit" | "inspection" | "needs-decision" | "done";

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function filterReturns(items: ReturnOrder[], filter: ReturnFilter, keyword = "") {
  const byStatus =
    filter === "submitted"
      ? items.filter((item) => item.status === "requested" || item.status === "label_sent")
      : filter === "in-transit"
        ? items.filter((item) => item.status === "in_transit")
        : filter === "inspection"
          ? items.filter((item) => item.status === "received" || item.status === "inspection")
          : filter === "needs-decision"
            ? items.filter((item) => ["received", "inspection", "repair", "exception"].includes(item.status) && !item.customerResolutionDecision)
            : filter === "done"
              ? items.filter((item) => item.status === "restocked" || item.status === "disposed" || item.status === "closed")
              : items;
  const query = keyword.trim().toLowerCase();
  if (!query) return byStatus;
  return byStatus.filter((item) =>
    [item.id, item.platform, item.originalOrderNo, item.buyerReturnTracking, item.returnReason, ...item.skuLines.map((line) => line.skuCode)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

export default async function ReturnsPage({ searchParams }: { searchParams?: Promise<{ status?: string | string[]; q?: string | string[] }> }) {
  const params = await searchParams;
  const statusParam = Array.isArray(params?.status) ? params?.status[0] : params?.status;
  const keyword = Array.isArray(params?.q) ? params?.q[0] ?? "" : params?.q ?? "";
  const activeFilter: ReturnFilter = ["submitted", "in-transit", "inspection", "needs-decision", "done"].includes(statusParam ?? "") ? (statusParam as ReturnFilter) : "all";
  const session = await requireCustomerSession();
  const [coreData, documents] = await Promise.all([getWarehouseCoreDataForCustomer(session.customerCode), getDocumentsForCustomer(session.customerCode)]);
  const returns = [...coreData.returnOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
  const visibleReturns = filterReturns(returns, activeFilter, keyword);
  const exportParams = new URLSearchParams({ kind: "returns" });
  if (activeFilter !== "all") exportParams.set("status", activeFilter);
  if (keyword.trim()) exportParams.set("q", keyword.trim());
  const returnExportHref = `/api/downloads?${exportParams.toString()}`;
  const summaryItems = [
    { label: "已提交", href: "/returns?status=submitted", filter: "submitted" as ReturnFilter, value: returns.filter((item) => item.status === "requested" || item.status === "label_sent").length, tone: "slate" as Tone },
    { label: "运输中", href: "/returns?status=in-transit", filter: "in-transit" as ReturnFilter, value: returns.filter((item) => item.status === "in_transit").length, tone: "cyan" as Tone },
    { label: "质检中", href: "/returns?status=inspection", filter: "inspection" as ReturnFilter, value: returns.filter((item) => item.status === "received" || item.status === "inspection").length, tone: "amber" as Tone },
    { label: "待确认", href: "/returns?status=needs-decision", filter: "needs-decision" as ReturnFilter, value: returns.filter((item) => ["received", "inspection", "repair", "exception"].includes(item.status) && !item.customerResolutionDecision).length, tone: "rose" as Tone },
    { label: "已完成", href: "/returns?status=done", filter: "done" as ReturnFilter, value: returns.filter((item) => item.status === "restocked" || item.status === "disposed" || item.status === "closed").length, tone: "emerald" as Tone },
  ];

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
            <CustomerReturnTrackingBulkPanel />
            <section className="grid gap-2 sm:grid-cols-5">
              {summaryItems.map((item) => (
                <Link className={`rounded-lg border bg-white p-3 shadow-sm transition hover:bg-white ${toneClass[item.tone]} ${activeFilter === item.filter ? "ring-2 ring-cyan-300" : ""}`} href={item.href} key={item.label}>
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                </Link>
              ))}
            </section>
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <RotateCcw size={17} className="text-[#0E7490]" />
                <h2 className="text-base font-semibold text-slate-950">我的退货预报</h2>
                <Link className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={returnExportHref}>
                  <Download size={14} />
                  导出当前筛选
                </Link>
                {activeFilter !== "all" ? <Link className="text-xs font-semibold text-cyan-700 hover:text-cyan-900" href="/returns">查看全部</Link> : null}
              </div>
              <form className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row" action="/returns">
                {activeFilter !== "all" ? <input name="status" type="hidden" value={activeFilter} /> : null}
                <label className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 focus-within:border-cyan-500">
                  <Search size={16} className="text-slate-400" />
                  <input className="min-h-8 flex-1 bg-transparent text-sm outline-none" defaultValue={keyword} name="q" placeholder="搜索 RMA、追踪号、原订单号或 SKU" />
                </label>
                <button className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" type="submit">搜索</button>
              </form>
              <div className="divide-y divide-slate-200">
                {visibleReturns.length > 0 ? (
                  visibleReturns.map((order) => (
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
                        <Link className="mt-2 inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/returns/print/rma/${encodeURIComponent(order.id)}`}>
                          打印 RMA 标签
                        </Link>
                        {!order.buyerReturnTracking && !["restocked", "disposed", "closed"].includes(order.status) ? <CustomerReturnTrackingPanel orderId={order.id} /> : null}
                        <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{order.returnReason}</p>
                        {order.inspectionResult ? <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">质检：{order.inspectionResult}</p> : null}
                        {order.customerResolutionDecision ? (
                          <p className="mt-2 rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
                            已确认处理方式：{order.customerResolutionDecision === "restock" ? "重新上架" : order.customerResolutionDecision === "repair" ? "维修翻新" : order.customerResolutionDecision === "dispose" ? "报废销毁" : "转寄"}{order.customerResolutionNote ? `；备注：${order.customerResolutionNote}` : ""}
                          </p>
                        ) : order.inspectionResult || order.status === "inspection" || order.status === "received" || order.status === "repair" || order.status === "exception" ? (
                          <CustomerReturnDecisionPanel currentDecision={order.resolution} disabled={order.status === "closed" || order.status === "disposed" || order.status === "restocked"} orderId={order.id} />
                        ) : null}
                        {documents.some((document) => document.refType === "return" && document.refId === order.id) ? (
                          <div className="mt-2 rounded-md border border-cyan-100 bg-cyan-50 p-3">
                            <p className="text-xs font-semibold text-cyan-900">质检照片/附件</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {documents
                                .filter((document) => document.refType === "return" && document.refId === order.id)
                                .map((document) => (
                                  <Link className="rounded-md border border-cyan-200 bg-white px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-50" href={signedDocumentDownloadHref(document.id)} key={document.id}>
                                    {document.originalName}
                                  </Link>
                                ))}
                            </div>
                          </div>
                        ) : null}
                        {order.workOrderId ? <p className="mt-2 rounded-md bg-cyan-50 p-3 font-mono text-xs font-semibold text-cyan-800">售后工单：{order.workOrderId}，可在工作台待办中继续沟通。</p> : null}
                      </div>
                      {pill(returnOrderStatusLabel(order.status), statusTone(order.status))}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">当前筛选下暂无退货预报</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
