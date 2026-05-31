import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock3,
  Download,
  FileText,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getCustomerAccountByCode, type CustomerAccountStatus } from "@/lib/customerAccountStore";
import { buildInboundDocumentChecklist, getSubmissionsForCustomer, type InboundSubmission, type InquirySubmission, type Submission } from "@/lib/localStore";
import { getCustomerNotifications } from "@/lib/notificationStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getOpsWorkbenchData, labelForOpsStatus } from "@/lib/opsStore";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";
import { PageShell } from "../components/MarketingShell";
import { NotificationCenter } from "../components/NotificationCenter";
import { LogoutButton } from "../components/LogoutButton";
import { CustomerWorkOrderPanel } from "../components/CustomerWorkOrderPanel";

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

const iconTone: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  cyan: "bg-cyan-50 text-cyan-800",
  emerald: "bg-emerald-50 text-emerald-800",
  amber: "bg-amber-50 text-amber-800",
  rose: "bg-rose-50 text-rose-800",
  violet: "bg-violet-50 text-violet-800",
};

function isInbound(item: Submission): item is InboundSubmission {
  return item.type === "inbound";
}

function isInquiry(item: Submission): item is InquirySubmission {
  return item.type === "inquiry";
}

function displayText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  if (!text || text.includes("?") || text.includes("閿?")) return fallback;
  return text;
}

function pill(label: string, tone: Tone = "slate") {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>{label}</span>;
}

function inquiryStatus(item: InquirySubmission) {
  const labels: Record<InquirySubmission["status"], { label: string; tone: Tone }> = {
    new: { label: "待方案评估", tone: "cyan" },
    contacted: { label: "客服已联系", tone: "cyan" },
    quoted: { label: "报价待确认", tone: "amber" },
    waiting_customer: { label: "待您确认", tone: "amber" },
    quote_accepted: { label: "已确认报价", tone: "emerald" },
    quote_question: { label: "报价疑问处理中", tone: "amber" },
    converted_to_inbound: { label: "已转入库", tone: "violet" },
    closed: { label: "已关闭", tone: "slate" },
  };
  return labels[item.status] ?? labels.new;
}

function inboundStatus(item: InboundSubmission) {
  const checklist = buildInboundDocumentChecklist(item);
  if (item.status === "exception") return { label: "异常处理中", tone: "rose" as Tone };
  if (item.status === "on_hold") return { label: "暂缓处理", tone: "amber" as Tone };
  if (checklist.missingRequired.length > 0) return { label: "待补资料", tone: "amber" as Tone };
  if (!item.tracking) return { label: "待补追踪号", tone: "rose" as Tone };
  if (item.status === "putaway_completed") return { label: "已上架", tone: "emerald" as Tone };
  if (["arrived", "receiving", "received"].includes(item.status)) return { label: "仓库处理中", tone: "violet" as Tone };
  return { label: "处理中", tone: "cyan" as Tone };
}

function opsTone(kind: "logistics" | "outbound" | "inventory", status: string): Tone {
  if (kind === "logistics") {
    if (status === "resolved") return "emerald";
    if (status === "open") return "rose";
    if (status === "waiting_customer") return "amber";
    return "cyan";
  }
  if (kind === "outbound") {
    if (status === "shipped") return "emerald";
    if (status === "blocked" || status === "label_pending") return "rose";
    if (status === "packing_check" || status === "handover") return "violet";
    return "cyan";
  }
  if (status === "normal") return "emerald";
  if (status === "low_stock" || status === "sync_issue") return "rose";
  if (status === "aging") return "amber";
  return "cyan";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${className}`}>{children}</section>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-5">
      <div>
        <p className="text-[11px] font-semibold uppercase text-cyan-700">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold text-slate-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone, caption }: { icon: LucideIcon; label: string; value: string | number; tone: Tone; caption: string }) {
  return (
    <div className="portal-metric-card rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${iconTone[tone]}`}>
          <Icon size={18} />
        </span>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">{caption}</span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ActionLink({ href, icon: Icon, title, body, primary = false }: { href: string; icon: LucideIcon; title: string; body: string; primary?: boolean }) {
  return (
    <Link
      className={`portal-action-card group flex min-h-32 flex-col justify-between rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)] ${
        primary ? "border-cyan-200 bg-cyan-50/70" : "border-slate-200 bg-white"
      }`}
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${primary ? "bg-white text-cyan-800" : "bg-slate-100 text-slate-700 group-hover:bg-cyan-50 group-hover:text-cyan-800"}`}>
          <Icon size={18} />
        </span>
        <ArrowRight className="text-slate-300 transition group-hover:text-cyan-700" size={16} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Sparkles size={17} />
      </div>
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function accountStatusMeta(status: CustomerAccountStatus | undefined): { label: string; tone: Tone; body: string } {
  if (status === "verified") return { label: "\u5df2\u8ba4\u8bc1", tone: "emerald", body: "\u8d26\u53f7\u5df2\u5b8c\u6210\u8ba4\u8bc1\uff0c\u53ef\u6309\u6b63\u5f0f\u5ba2\u6237\u6d41\u7a0b\u4f7f\u7528\u5165\u5e93\u3001\u5e93\u5b58\u3001\u51fa\u5e93\u3001\u7269\u6d41\u548c\u8d26\u5355\u80fd\u529b\u3002" };
  if (status === "paused") return { label: "\u6682\u505c", tone: "rose", body: "\u8d26\u53f7\u5df2\u6682\u505c\uff0c\u8bf7\u8054\u7cfb\u8fd0\u8425\u786e\u8ba4\u6062\u590d\u539f\u56e0\u548c\u4e0b\u4e00\u6b65\u5904\u7406\u3002" };
  return { label: "\u672a\u8ba4\u8bc1", tone: "amber", body: "\u8bf7\u5148\u5b8c\u5584\u516c\u53f8\u8d44\u6599\u3001VAT\u3001EORI \u548c\u5e73\u53f0\u5e97\u94fa\u4fe1\u606f\uff0c\u8fd0\u8425\u5ba1\u6838\u540e\u4f1a\u66f4\u65b0\u8ba4\u8bc1\u72b6\u6001\u3002" };
}

function downloadHref(label: string) {
  if (label.includes("\u7269\u6d41") || label.includes("\u5f02\u5e38") || label.includes("\u8d54\u4ed8")) return "/api/downloads?kind=delivery-exceptions";
  if (label.includes("\u5e93\u5b58")) return "/api/downloads?kind=inventory";
  if (label.includes("\u51fa\u5e93")) return "/api/downloads?kind=outbound";
  if (label.includes("\u8d39\u7528") || label.includes("\u8d26\u5355")) return "/api/downloads?kind=billing";
  if (label.includes("\u9762\u5355")) return "/api/downloads?kind=labels";
  if (label.includes("\u7b7e\u6536")) return "/api/downloads?kind=proofs";
  return "/api/downloads?kind=inventory";
}

export default async function PortalPage() {
  const session = await requireCustomerSession();
  const [submissions, opsData, coreData, expansionData, account] = await Promise.all([getSubmissionsForCustomer(session.customerCode), getOpsWorkbenchData(), getWarehouseCoreDataForCustomer(session.customerCode), getOpsExpansionData(), getCustomerAccountByCode(session.customerCode)]);
  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);
  const customerLogistics = opsData.logistics.filter((item) => item.customerCode === session.customerCode);
  const customerOutbound = opsData.outbound.filter((item) => item.customerCode === session.customerCode);
  const customerWorkOrders = expansionData.selfServiceWorkOrders.filter((item) => item.customerCode === session.customerCode);
  const customerCoreOutbound = coreData.outboundOrders;
  const customerReturns = coreData.returnOrders;
  const selfServiceDownloads = Array.from(new Set([...expansionData.selfService.enabledDownloads, "\u7269\u6d41\u5f02\u5e38\u4e0e\u8d54\u4ed8"]));
  const skuNameMap = new Map(coreData.skus.map((item) => [item.skuCode, item.productName]));
  const formalInventory = coreData.inventoryBalances.map((item) => ({
    id: item.id,
    sku: item.skuCode,
    product: skuNameMap.get(item.skuCode) ?? item.skuCode,
    available: item.availableQty,
    reserved: item.reservedQty,
    frozen: item.frozenQty ?? 0,
    defective: item.defectiveQty ?? 0,
    alert: item.alertQty,
    agingDays: item.agingDays,
    status: item.availableQty < item.alertQty ? "low_stock" : item.agingDays >= 120 ? "aging" : "normal",
  }));
  const customerInventory =
    formalInventory.length > 0
      ? formalInventory
      : opsData.inventory
          .filter((item) => item.customerCode === session.customerCode)
          .map((item) => ({
            id: item.id,
            sku: item.sku,
            product: item.product,
            available: item.available,
            reserved: item.reserved,
            frozen: 0,
            defective: 0,
            alert: item.alert,
            agingDays: item.agingDays,
            status: item.status,
          }));

  const docsMissing = inbounds.filter((item) => buildInboundDocumentChecklist(item).missingRequired.length > 0).length;
  const trackingMissing = inbounds.filter((item) => !item.tracking).length;
  const quoteReady = inquiries.filter((item) => item.status === "quoted" || item.status === "waiting_customer" || item.quoteDraft).length;
  const logisticsOpen = customerLogistics.filter((item) => item.status !== "resolved").length;
  const inventoryRisk = customerInventory.filter((item) => item.status !== "normal").length;
  const notifications = await getCustomerNotifications({ customerCode: session.customerCode, submissions, opsData, coreData });
  const todoCount = notifications.length || docsMissing + trackingMissing + quoteReady + logisticsOpen + inventoryRisk;
  const nextSteps = [
    account?.status !== "verified" ? { title: "\u5b8c\u5584\u8ba4\u8bc1\u8d44\u6599", body: "\u8865\u9f50\u516c\u53f8\u3001VAT\u3001EORI\u3001\u5e73\u53f0\u5e97\u94fa\u548c\u7ecf\u8425\u5730\u5740\uff0c\u65b9\u4fbf\u8fd0\u8425\u5ba1\u6838\u3002", href: "/account", tone: "amber" as Tone } : null,
    quoteReady > 0 ? { title: "\u786e\u8ba4\u62a5\u4ef7", body: "\u5df2\u6709\u62a5\u4ef7\u6216\u65b9\u6848\u7b49\u5f85\u60a8\u786e\u8ba4\u3002", href: "/billing", tone: "amber" as Tone } : null,
    docsMissing + trackingMissing > 0 ? { title: "\u8865\u9f50\u5165\u5e93\u8d44\u6599", body: "\u5b8c\u5584\u8ffd\u8e2a\u53f7\u3001\u88c5\u7bb1\u5355\u6216\u5916\u7bb1\u6807\u7b7e\u3002", href: "/supplement", tone: "rose" as Tone } : null,
    inventoryRisk > 0 ? { title: "\u67e5\u770b\u5e93\u5b58\u98ce\u9669", body: "\u5173\u6ce8\u4f4e\u5e93\u5b58\u6216\u5e93\u9f84\u504f\u9ad8 SKU\u3002", href: "/skus", tone: "amber" as Tone } : null,
  ].filter(Boolean) as Array<{ title: string; body: string; href: string; tone: Tone }>;
  const accountStatus = accountStatusMeta(account?.status);

  return (
    <PageShell surface="customer">
      <div className="portal-mobile-main min-h-screen bg-[#F4F7FB] pt-24 text-slate-950">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <section className="portal-hero-card rounded-lg bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-md border border-cyan-300/35 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">{"\u5ba2\u6237\u7f16\u53f7"} {session.customerCode}</span>
                  <span className="inline-flex rounded-md border border-amber-300/35 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100">{"\u8d26\u53f7\u72b6\u6001"} {accountStatus.label}</span>
                  <span className="inline-flex rounded-md border border-emerald-300/35 bg-emerald-300/10 px-2 py-1 text-xs font-semibold text-emerald-100">{todoCount > 0 ? `${todoCount} ${"\u9879\u5f85\u5904\u7406"}` : "\u6682\u65e0\u7d27\u6025\u5f85\u529e"}</span>
                </div>
                <p className="mt-6 text-sm font-semibold text-cyan-200">{"\u82f1\u56fd\u4ed3\u914d\u4e1a\u52a1\u63a7\u5236\u53f0"}</p>
                <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{"\u5ba2\u6237\u5de5\u4f5c\u53f0"}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{"\u96c6\u4e2d\u67e5\u770b\u9700\u6c42\u3001\u5165\u5e93\u3001SKU\u3001\u5e93\u5b58\u3001\u51fa\u5e93\u3001\u7269\u6d41\u3001\u8d39\u7528\u548c\u5f85\u529e\u3002\u5148\u770b\u8d26\u53f7\u72b6\u6001\u548c\u4e0b\u4e00\u6b65\u5efa\u8bae\uff0c\u518d\u5904\u7406\u65e5\u5e38\u4f5c\u4e1a\u3002"}</p>
              </div>
              <div className="portal-hero-actions flex flex-wrap gap-3">
                <Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300" href="/inbound">{"\u521b\u5efa\u5165\u5e93\u9884\u62a5"} <ArrowRight size={16} /></Link>
                <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10" href="/outbound">{"\u63d0\u4ea4\u51fa\u5e93\u7533\u8bf7"} <Boxes size={16} /></Link>
                <LogoutButton nextPath="/login" />
              </div>
            </div>
          </section>

          {account?.status !== "verified" ? (
            <section className={`rounded-lg border p-4 ${toneClass[accountStatus.tone]}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{"\u8d26\u53f7\u72b6\u6001\uff1a"}{accountStatus.label}</p>
                  <p className="mt-1 text-sm leading-6">{accountStatus.body}</p>
                </div>
                <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50" href="/account">{"\u5b8c\u5584\u8d26\u53f7\u8d44\u6599"}</Link>
              </div>
            </section>
          ) : null}

          <section className="portal-action-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionLink body={"\u586b\u5199\u5e73\u53f0\u3001\u8d27\u91cf\u3001SKU \u548c\u670d\u52a1\u9700\u6c42\u3002"} href="/inquiry" icon={FileText} primary title={"\u63d0\u4ea4\u9700\u6c42"} />
            <ActionLink body={"\u767b\u8bb0\u7bb1\u6570\u3001SKU\u3001\u8ffd\u8e2a\u53f7\u548c\u5165\u5e93\u8d44\u6599\u3002"} href="/inbound" icon={PackageCheck} primary title={"\u5165\u5e93\u9884\u62a5"} />
            <ActionLink body={"\u7ef4\u62a4\u5546\u54c1\u7f16\u7801\u3001\u6761\u7801\u548c\u5e93\u5b58\u9884\u8b66\u3002"} href="/skus" icon={Tags} title={"SKU \u6863\u6848"} />
            <ActionLink body={"\u63d0\u4ea4 SKU\u3001\u6570\u91cf\u3001\u6e20\u9053\u548c\u53d1\u8d27\u8981\u6c42\u3002"} href="/outbound" icon={Boxes} title={"\u51fa\u5e93\u7533\u8bf7"} />
          </section>

          <section className="portal-metric-grid grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Metric caption="待办" icon={AlertTriangle} label={"\u5f85\u5904\u7406\u4e8b\u9879"} tone={todoCount > 0 ? "amber" : "emerald"} value={todoCount} />
            <Metric caption="入库" icon={PackageCheck} label={"\u5165\u5e93\u8d27\u4ef6"} tone="cyan" value={inbounds.length} />
            <Metric caption="SKU" icon={Tags} label={"SKU \u6863\u6848"} tone="cyan" value={coreData.skus.length} />
            <Metric caption="物流" icon={Truck} label={"\u7269\u6d41\u5f02\u5e38"} tone={logisticsOpen > 0 ? "rose" : "emerald"} value={logisticsOpen} />
            <Metric caption="库存" icon={Warehouse} label={"\u5e93\u5b58\u98ce\u9669"} tone={inventoryRisk > 0 ? "amber" : "emerald"} value={inventoryRisk} />
            <Metric caption="报价" icon={ReceiptText} label={"\u62a5\u4ef7\u5f85\u786e\u8ba4"} tone={quoteReady > 0 ? "amber" : "slate"} value={quoteReady} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <Panel className="p-0"><SectionTitle eyebrow="下一步" title={"\u4e0b\u4e00\u6b65\u5efa\u8bae"} action={<Clock3 size={18} className="text-slate-400" />} /><div className="grid gap-3 p-5">{nextSteps.length > 0 ? nextSteps.map((item) => (<Link className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:bg-white" href={item.href} key={item.title}><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{item.body}</p></div>{pill("\u53bb\u5904\u7406", item.tone)}</Link>)) : <EmptyState text={"\u5f53\u524d\u6ca1\u6709\u9700\u8981\u7acb\u5373\u5904\u7406\u7684\u4e8b\u9879"} />}</div></Panel>
              <NotificationCenter compact emptyText={"\u6682\u65e0\u5ba2\u6237\u5f85\u529e"} items={notifications} title={"\u6211\u7684\u5f85\u529e"} />
            </div>
            <Panel className="p-0"><SectionTitle eyebrow="自助服务" title={"\u81ea\u52a9\u6a21\u677f\u4e0e\u670d\u52a1\u8d44\u6599"} action={<FileText size={18} className="text-slate-400" />} /><div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]"><div><p className="text-sm leading-6 text-slate-600">{"\u4e0b\u8f7d\u6807\u51c6\u6a21\u677f\u540e\u53ef\u76f4\u63a5\u6574\u7406 SKU\u3001\u51fa\u5e93\u8ba2\u5355\u548c\u8d44\u6599\u660e\u7ec6\u3002\u5982\u9700\u5904\u7406\u5f02\u5e38\uff0c\u53ef\u6309\u53f3\u4fa7\u5de5\u5355\u7c7b\u578b\u63d0\u4ea4\u7ed9\u8fd0\u8425\u3002"}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{expansionData.selfService.templates.map((item) => (<Link className="rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:bg-white" href={item.href} key={item.id}><p className="text-sm font-semibold text-slate-950">{item.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></Link>))}</div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-950">{"\u53ef\u4e0b\u8f7d\u5185\u5bb9"}</p><div className="mt-2 grid gap-2">{selfServiceDownloads.map((item) => (<Link className="inline-flex min-h-9 items-center justify-between gap-2 rounded-md border border-cyan-100 bg-white px-2 text-xs font-semibold text-cyan-800 transition hover:border-cyan-200 hover:bg-cyan-50" href={downloadHref(item)} key={item}><span>{item}</span><Download size={14} /></Link>))}</div></div><div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-950">{"\u5de5\u5355\u7c7b\u578b"}</p><div className="mt-2 flex flex-wrap gap-2">{expansionData.selfService.workOrderCategories.map((item) => pill(item, "slate"))}</div></div></div></div></Panel>
          </section>

          <CustomerWorkOrderPanel categories={expansionData.selfService.workOrderCategories} workOrders={customerWorkOrders} />

          <section className="grid gap-5 xl:grid-cols-3">
            <Panel className="p-0"><SectionTitle eyebrow="需求报价" title={"\u9700\u6c42\u4e0e\u62a5\u4ef7"} action={<ReceiptText size={18} className="text-slate-400" />} /><div className="divide-y divide-slate-100">{inquiries.length > 0 ? inquiries.slice(0, 4).map((item) => { const status = inquiryStatus(item); return (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{displayText(item.company, "\u672a\u547d\u540d\u9700\u6c42")}</h3><div className="mt-2">{pill(status.label, status.tone)}</div></div>); }) : <EmptyState text={"\u6682\u65e0\u9700\u6c42\u8bb0\u5f55"} />}</div></Panel>
            <Panel className="p-0"><SectionTitle eyebrow="入库" title={"\u5165\u5e93\u8d27\u4ef6"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/inbound">{"\u65b0\u589e"}</Link>} /><div className="divide-y divide-slate-100">{inbounds.length > 0 ? inbounds.slice(0, 4).map((item) => { const status = inboundStatus(item); return (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{displayText(item.productName, "\u5165\u5e93\u8d27\u4ef6")}</h3><p className="mt-2 text-sm text-slate-600">{item.cartons} {"\u7bb1"} / {item.skuCount} SKU / ETA {item.eta || "-"}</p><div className="mt-2">{pill(status.label, status.tone)}</div></div>); }) : <EmptyState text={"\u6682\u65e0\u5165\u5e93\u9884\u62a5"} />}</div></Panel>
            <Panel className="p-0"><SectionTitle eyebrow="出库物流" title={"\u51fa\u5e93\u4e0e\u7269\u6d41"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/outbound">{"\u521b\u5efa\u51fa\u5e93"}</Link>} /><div className="divide-y divide-slate-100">{customerCoreOutbound.length + customerOutbound.length > 0 ? (<>{customerCoreOutbound.slice(0, 4).map((item) => (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.channel} / {item.orderCount} {"\u5355"}</h3><p className="mt-2 text-sm text-slate-600">{item.recipientName || "\u6536\u4ef6\u4eba\u5f85\u8865"}</p><div className="mt-2">{pill(item.status, item.status === "shipped" ? "emerald" : item.status === "blocked" ? "rose" : "amber")}</div></div>))}{customerOutbound.slice(0, Math.max(0, 4 - customerCoreOutbound.length)).map((item) => (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.channel} / {item.orderCount} {"\u5355"}</h3><div className="mt-2">{pill(labelForOpsStatus("outbound", item.status), opsTone("outbound", item.status))}</div></div>))}</>) : <EmptyState text={"\u6682\u65e0\u51fa\u5e93\u7533\u8bf7"} />}</div></Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Panel className="p-0"><SectionTitle eyebrow="库存" title={"\u5e93\u5b58\u89c2\u5bdf"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/skus">{"\u7ba1\u7406 SKU"}</Link>} /><div className="divide-y divide-slate-100">{customerInventory.length > 0 ? customerInventory.slice(0, 6).map((item) => (<div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]" key={item.id}><div><p className="font-mono text-xs font-semibold text-slate-500">{item.sku}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.product}</h3><p className="mt-2 text-sm text-slate-600">{"\u53ef\u7528"} {item.available} / {"\u5360\u7528"} {item.reserved} / {"\u51bb\u7ed3"} {item.frozen} / {"\u6b8b\u6b21"} {item.defective} / {"\u5e93\u9f84"} {item.agingDays} {"\u5929"}</p></div>{pill(labelForOpsStatus("inventory", item.status), opsTone("inventory", item.status))}</div>)) : <EmptyState text={"\u6682\u65e0\u5e93\u5b58\u8bb0\u5f55"} />}</div></Panel>
            <Panel className="p-0"><SectionTitle eyebrow="退货" title={"\u9000\u8d27 / RMA"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/returns">{"\u63d0\u4ea4\u9000\u8d27"}</Link>} /><div className="divide-y divide-slate-100">{customerReturns.length > 0 ? customerReturns.slice(0, 5).map((item) => (<div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]" key={item.id}><div><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.platform} / {item.originalOrderNo || "\u8ba2\u5355\u53f7\u5f85\u8865"}</h3><p className="mt-2 text-sm text-slate-600">{item.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join(" / ")}</p></div>{pill(item.status, item.status === "restocked" ? "emerald" : item.status === "exception" ? "rose" : "amber")}</div>)) : <EmptyState text={"\u6682\u65e0\u9000\u8d27\u9884\u62a5"} />}</div></Panel>
          </section>

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-950"><ShieldCheck size={16} />{"\u5ba2\u6237\u53ef\u89c1\u8303\u56f4"}</p><p className="mt-2 text-sm leading-6 text-emerald-900">{"\u8fd9\u91cc\u5c55\u793a\u7684\u662f\u5ba2\u6237\u53ef\u76f4\u63a5\u67e5\u770b\u548c\u64cd\u4f5c\u7684\u4e1a\u52a1\u4fe1\u606f\u3002\u5185\u90e8\u5ba1\u6279\u3001\u5458\u5de5\u5907\u6ce8\u3001\u6210\u672c\u89c4\u5219\u548c\u8c03\u62e8\u6765\u6e90\u4ecd\u4fdd\u7559\u5728\u8fd0\u8425\u540e\u53f0\u3002"}</p></section>
        </div>
      </div>
    </PageShell>
  );
}
