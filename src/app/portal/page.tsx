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
import { buildCustomerSelfServiceCenterData } from "@/lib/customerSelfServiceCenter";
import { getWarehouseCoreDataForCustomer, outboundCustomerExceptionDecisionLabel, returnOrderStatusLabel, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";
import { PageShell } from "../components/MarketingShell";
import { NotificationCenter } from "../components/NotificationCenter";
import { LogoutButton } from "../components/LogoutButton";
import { CustomerWorkOrderPanel } from "../components/CustomerWorkOrderPanel";
import { CustomerExceptionDecisionActions } from "../components/CustomerExceptionDecisionActions";
import { CustomerSelfServiceActionPanel } from "../components/CustomerSelfServiceActionPanel";
import { CustomerSelfServiceSummaryPanel } from "../components/CustomerSelfServiceSummaryPanel";
import { documentCategoryLabel, documentRefLabel, getDocumentsForCustomer, signDocumentToken, type DocumentRecord } from "@/lib/documentStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";

type CustomerExceptionRow = {
  key: string;
  module: string;
  sourceId: string;
  title: string;
  status: string;
  tone: Tone;
  nextAction: string;
  occurredAt?: string;
  orderId?: string;
  exceptionId?: string;
  redeliveryRequired?: boolean;
  hasClaim?: boolean;
  hasProof?: boolean;
  currentDecision?: string;
};

type CustomerDownloadCategory = "资料索引" | "库存报表" | "出库物流" | "费用账单" | "异常售后";

type CustomerDownloadCard = {
  label: string;
  kind: string;
  category: CustomerDownloadCategory;
  description: string;
  href: string;
  count: number;
  status: string;
  tone: Tone;
};

type CustomerFeeDifferenceRow = {
  id: string;
  channel: string;
  trackingNumber: string;
  estimatedFee: number;
  actualFee: number;
  difference: number;
  note: string;
  updatedAt?: string;
};

const customerDownloadDefinitions = [
  { label: "资料包索引", kind: "self-service-index", category: "资料索引", tone: "slate", description: "汇总全部可下载报表、模板和工单服务入口。" },
  { label: "自助操作清单", kind: "self-service-actions", category: "资料索引", tone: "amber", description: "汇总待确认、待付款、异常确认、可下载资料和工单下一步。" },
  { label: "资料归档清单", kind: "documents", category: "资料索引", tone: "cyan", description: "导出已上传和运营归档的资料文件、业务单号、分类和下载入口。" },
  { label: "库存报表", kind: "inventory", category: "库存报表", tone: "cyan", description: "查看 SKU 可用、占用、冻结、残次和在途库存。" },
  { label: "库龄分析", kind: "inventory-aging", category: "库存报表", tone: "amber", description: "按库龄识别滞销、清仓和补货风险。" },
  { label: "库存流水", kind: "inventory-movements", category: "库存报表", tone: "cyan", description: "追溯入库、出库、预占、释放和调整记录。" },
  { label: "进销存报表", kind: "inventory-turnover", category: "库存报表", tone: "emerald", description: "查看期初估算、本期入库、本期出库和期末库存。" },
  { label: "批次效期库存", kind: "inventory-lots", category: "库存报表", tone: "violet", description: "查看批次号、效期、库位和序列号明细。" },
  { label: "出库明细", kind: "outbound", category: "出库物流", tone: "cyan", description: "查看出库单、SKU、收件信息、追踪号和轨迹。" },
  { label: "出库复核状态", kind: "outbound-review", category: "出库物流", tone: "amber", description: "查看拣货、分拣、复核、截单、称重和异常进度。" },
  { label: "面单列表", kind: "labels", category: "出库物流", tone: "violet", description: "查看已生成面单的出库单和面单下载入口。" },
  { label: "签收证明", kind: "proofs", category: "出库物流", tone: "emerald", description: "查看已签收订单和签收证明入口。" },
  { label: "物流证据包", kind: "logistics-evidence", category: "出库物流", tone: "cyan", description: "一表汇总面单、签收证明、轨迹、异常、赔付和运费差异说明。" },
  { label: "费用明细", kind: "billing", category: "费用账单", tone: "amber", description: "查看仓租、操作费、物流费、退货费和账单状态。" },
  { label: "付款核销记录", kind: "payment-reconciliation", category: "费用账单", tone: "emerald", description: "查看付款参考号、到账核销、驳回和争议处理记录。" },
  { label: "我的异常中心", kind: "exceptions", category: "异常售后", tone: "rose", description: "汇总入库、库存、出库、物流、退货和账单异常。" },
  { label: "物流异常与赔付", kind: "delivery-exceptions", category: "异常售后", tone: "rose", description: "查看派送失败、改派、签收证明、赔付和客户确认结果。" },
  { label: "退货质检明细", kind: "returns", category: "异常售后", tone: "violet", description: "查看退货 RMA、质检结果、处理方式和售后工单。" },
] as const satisfies ReadonlyArray<Omit<CustomerDownloadCard, "href" | "count" | "status">>;

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

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

function signedDocumentDownloadHref(id: string) {
  const token = signDocumentToken(id, Date.now() + 30 * 60 * 1000);
  return `/api/documents/${encodeURIComponent(id)}/download?token=${encodeURIComponent(token)}`;
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

function coreOutboundStatusMeta(status: CoreOutboundOrder["status"]): { label: string; tone: Tone } {
  const labels: Record<CoreOutboundOrder["status"], { label: string; tone: Tone }> = {
    pending_review: { label: "待审核", tone: "cyan" },
    picking: { label: "拣货中", tone: "amber" },
    label_pending: { label: "待生成面单", tone: "rose" },
    packing_check: { label: "打包复核", tone: "violet" },
    handover: { label: "待交运", tone: "violet" },
    shipped: { label: "已发货", tone: "emerald" },
    blocked: { label: "异常阻塞", tone: "rose" },
  };
  return labels[status] ?? labels.pending_review;
}

function returnTone(status: string): Tone {
  if (status === "restocked" || status === "closed") return "emerald";
  if (status === "exception" || status === "disposed") return "rose";
  return "amber";
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

function CustomerLogisticsFeeDifferencePanel({ rows }: { rows: CustomerFeeDifferenceRow[] }) {
  if (rows.length === 0) return null;
  const totalDifference = rows.reduce((sum, row) => sum + row.difference, 0);
  const topRows = rows.slice(0, 5);

  return (
    <Panel className="p-0">
      <SectionTitle
        eyebrow="费用复核"
        title="物流费用差异"
        action={
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-100 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/downloads?kind=logistics-evidence">
            下载证据包
            <Download size={14} />
          </Link>
        }
      />
      <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">待复核出库单</p>
          <p className="mt-2 text-3xl font-semibold text-amber-950">{rows.length}</p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            合计差异 £{totalDifference.toFixed(2)}。如差异来自偏远费、燃油费、超尺寸或承运商复核重量，可下载证据包后在账单页或工单中继续确认。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800" href="/billing">
              查看账单
            </Link>
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-800 hover:bg-amber-50"
              href={`/portal?workOrderCategory=${encodeURIComponent("账单争议")}&workOrderTitle=${encodeURIComponent("物流费用差异复核")}&workOrderDescription=${encodeURIComponent("请协助复核以下出库单的物流费用差异，已下载物流证据包作为对账依据。")}#work-orders`}
            >
              提交复核工单
            </Link>
          </div>
        </div>
        <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
          {topRows.map((row) => (
            <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]" key={row.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {pill(row.difference >= 5 ? "严重差异" : "待复核", row.difference >= 5 ? "rose" : "amber")}
                  <span className="font-mono text-xs font-semibold text-slate-500">{row.id}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-950">{row.channel} / {row.trackingNumber || "追踪号待回传"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{row.note || "暂无运营说明，请以物流证据包和月结账单复核为准。"}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold text-slate-950">£{row.estimatedFee.toFixed(2)} → £{row.actualFee.toFixed(2)}</p>
                <p className={`mt-1 text-xs font-semibold ${row.difference >= 0 ? "text-rose-700" : "text-emerald-700"}`}>差异 £{row.difference.toFixed(2)}</p>
                <p className="mt-1 text-xs text-slate-400">{dateText(row.updatedAt)}</p>
              </div>
            </div>
          ))}
          {rows.length > topRows.length ? <p className="p-3 text-xs font-semibold text-slate-500">还有 {rows.length - topRows.length} 条差异，请下载物流证据包查看完整列表。</p> : null}
        </div>
      </div>
    </Panel>
  );
}

function SelfServiceDownloadCenter({
  downloadCards,
  templates,
  workOrderCategories,
}: {
  downloadCards: CustomerDownloadCard[];
  templates: Array<{ id: string; name: string; description: string; href: string }>;
  workOrderCategories: string[];
}) {
  const categories = Array.from(new Set(downloadCards.map((item) => item.category)));
  const totalAvailable = downloadCards.reduce((sum, item) => sum + item.count, 0);

  return (
    <Panel className="p-0">
      <SectionTitle eyebrow="自助服务" title="客户自助下载中心" action={<FileText size={18} className="text-slate-400" />} />
      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">可下载报表</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{downloadCards.length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">当前关联数据</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{totalAvailable}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">模板文件</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{templates.length}</p>
          </div>
        </div>

        {categories.map((category) => (
          <div className="space-y-3" key={category}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">{category}</h3>
              <span className="text-xs text-slate-400">{downloadCards.filter((item) => item.category === category).length} 项</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {downloadCards
                .filter((item) => item.category === category)
                .map((item) => (
                  <Link className="group grid min-h-28 gap-3 rounded-md border border-slate-200 bg-white p-3 transition hover:border-cyan-200 hover:bg-cyan-50/40" href={item.href} key={item.kind}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                          {pill(item.status, item.count > 0 ? item.tone : "slate")}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition group-hover:bg-cyan-100 group-hover:text-cyan-800">
                        <Download size={15} />
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        ))}

        <div className="grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">模板文件</h3>
              <span className="text-xs text-slate-400">用于批量整理和提交资料</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {templates.map((item) => (
                <Link className="rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-200 hover:bg-white" href={item.href} key={item.id}>
                  <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">工单类型</h3>
              <span className="text-xs text-slate-400">异常和售后可直接提交</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{workOrderCategories.map((item) => pill(item, "slate"))}</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CustomerDocumentArchivePanel({ documents }: { documents: DocumentRecord[] }) {
  const recentDocuments = documents
    .filter((item) => item.scanStatus === "clean")
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 8);
  const blockedCount = documents.filter((item) => item.scanStatus === "blocked").length;
  const previewableCount = documents.filter((item) => item.previewAllowed && item.scanStatus === "clean").length;

  return (
    <Panel className="p-0">
      <SectionTitle
        eyebrow="资料归档"
        title="我的业务资料"
        action={<span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{documents.length} 个文件</span>}
      />
      <div className="grid gap-4 p-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">已归档资料</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{documents.length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">可在线预览</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{previewableCount}</p>
          </div>
          <div className={`rounded-md border p-3 ${blockedCount > 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className={`text-xs font-semibold ${blockedCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>安全拦截</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{blockedCount}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-slate-50">
          {recentDocuments.length > 0 ? (
            recentDocuments.map((item) => (
              <div className="grid gap-3 px-3 py-3 md:grid-cols-[1fr_auto]" key={item.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {pill(documentRefLabel(item.refType), "slate")}
                    {pill(documentCategoryLabel(item.category), "cyan")}
                    <span className="font-mono text-xs font-semibold text-slate-500">{item.refId}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-950">{item.originalName}</p>
                  <p className="mt-1 text-xs text-slate-500">上传时间 {dateText(item.uploadedAt)} / {item.uploadedByRole === "customer" ? "客户上传" : "运营上传"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {item.previewAllowed && item.scanStatus === "clean" ? (
                    <Link className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/api/documents/${item.id}/preview`} target="_blank">
                      预览
                    </Link>
                  ) : null}
                  <Link className="inline-flex min-h-8 items-center rounded-md border border-cyan-200 bg-cyan-50 px-2.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href={signedDocumentDownloadHref(item.id)}>
                    下载
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="暂无已归档资料，提交需求、入库预报、退货或补资料后会自动沉淀到这里" />
          )}
        </div>
      </div>
    </Panel>
  );
}

function accountStatusMeta(status: CustomerAccountStatus | undefined): { label: string; tone: Tone; body: string } {
  if (status === "verified") return { label: "\u5df2\u8ba4\u8bc1", tone: "emerald", body: "\u8d26\u53f7\u5df2\u5b8c\u6210\u8ba4\u8bc1\uff0c\u53ef\u6309\u6b63\u5f0f\u5ba2\u6237\u6d41\u7a0b\u4f7f\u7528\u5165\u5e93\u3001\u5e93\u5b58\u3001\u51fa\u5e93\u3001\u7269\u6d41\u548c\u8d26\u5355\u80fd\u529b\u3002" };
  if (status === "paused") return { label: "\u6682\u505c", tone: "rose", body: "\u8d26\u53f7\u5df2\u6682\u505c\uff0c\u8bf7\u8054\u7cfb\u8fd0\u8425\u786e\u8ba4\u6062\u590d\u539f\u56e0\u548c\u4e0b\u4e00\u6b65\u5904\u7406\u3002" };
  return { label: "\u672a\u8ba4\u8bc1", tone: "amber", body: "\u8bf7\u5148\u5b8c\u5584\u516c\u53f8\u8d44\u6599\u3001VAT\u3001EORI \u548c\u5e73\u53f0\u5e97\u94fa\u4fe1\u606f\uff0c\u8fd0\u8425\u5ba1\u6838\u540e\u4f1a\u66f4\u65b0\u8ba4\u8bc1\u72b6\u6001\u3002" };
}

export default async function PortalPage() {
  const session = await requireCustomerSession();
  const [submissions, opsData, coreData, expansionData, account, documents] = await Promise.all([
    getSubmissionsForCustomer(session.customerCode),
    getOpsWorkbenchData(),
    getWarehouseCoreDataForCustomer(session.customerCode),
    getOpsExpansionData(),
    getCustomerAccountByCode(session.customerCode),
    getDocumentsForCustomer(session.customerCode),
  ]);
  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);
  const customerLogistics = opsData.logistics.filter((item) => item.customerCode === session.customerCode);
  const customerOutbound = opsData.outbound.filter((item) => item.customerCode === session.customerCode);
  const customerWorkOrders = expansionData.selfServiceWorkOrders.filter((item) => item.customerCode === session.customerCode);
  const customerCoreOutbound = coreData.outboundOrders;
  const customerReturns = coreData.returnOrders;
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
  const currentTimeMs = new Date().getTime();
  const customerExceptionRows: CustomerExceptionRow[] = [
    ...inbounds.flatMap((inbound) =>
      (inbound.receivingExceptions ?? [])
        .filter((exception) => exception.status === "open" || exception.status === "investigating")
        .map((exception) => ({
          key: exception.id,
          module: "入库",
          sourceId: inbound.id,
          title: exception.message,
          status: exception.status === "open" ? "待处理" : "处理中",
          tone: exception.severity === "critical" ? "rose" as Tone : "amber" as Tone,
          nextAction: "等待仓库/运营核对后反馈处理结果",
          occurredAt: exception.createdAt,
        })),
    ),
    ...inbounds
      .filter((inbound) => inbound.exceptionNote && ["exception", "on_hold"].includes(inbound.status))
      .map((inbound) => ({
        key: `${inbound.id}-status`,
        module: "入库",
        sourceId: inbound.id,
        title: inbound.exceptionNote || "入库状态异常",
        status: inbound.status === "on_hold" ? "暂缓处理" : "异常处理中",
        tone: "amber" as Tone,
        nextAction: "等待运营确认资料、预约或差异处理方案",
        occurredAt: inbound.updatedAt ?? inbound.createdAt,
      })),
    ...customerCoreOutbound.flatMap((order) =>
      (order.exceptions ?? [])
        .filter((exception) => exception.status === "open" || exception.status === "investigating")
        .map((exception) => ({
          key: exception.id,
          module: exception.deliveryExceptionType ? "物流" : "出库",
          sourceId: order.id,
          title: exception.message,
          status: exception.status === "open" ? "待处理" : "处理中",
          tone: exception.severity === "critical" ? "rose" as Tone : "amber" as Tone,
          nextAction: exception.redeliveryRequired ? "请留意改派确认" : exception.claimStatus && exception.claimStatus !== "not_required" ? "运营正在跟进赔付" : "运营正在处理",
          occurredAt: exception.createdAt,
          orderId: order.id,
          exceptionId: exception.id,
          redeliveryRequired: exception.redeliveryRequired,
          hasClaim: Boolean(exception.claimAmount || (exception.claimStatus && exception.claimStatus !== "not_required")),
          hasProof: Boolean(exception.proofUrl || exception.deliveryExceptionType === "proof_uploaded"),
          currentDecision: exception.customerDecision ? outboundCustomerExceptionDecisionLabel[exception.customerDecision] : "",
        })),
    ),
    ...customerReturns
      .filter((item) => item.status === "exception" || (["received", "inspection", "repair"].includes(item.status) && !item.customerResolutionDecision))
      .map((item) => ({
        key: `${item.id}-${item.status}`,
        module: "退货/RMA",
        sourceId: item.id,
        title: item.inspectionResult || item.returnReason,
        status: item.status === "exception" ? "异常" : "待您确认",
        tone: item.status === "exception" ? "rose" as Tone : "amber" as Tone,
        nextAction: item.customerResolutionDecision ? "已确认处理方式" : "请确认重新上架、维修、报废或转寄",
        occurredAt: item.updatedAt ?? item.createdAt,
      })),
    ...customerInventory
      .filter((item) => item.status !== "normal" || item.frozen > 0 || item.defective > 0)
      .map((item) => ({
        key: `${item.id}-inventory-risk`,
        module: "库存",
        sourceId: item.sku,
        title: [item.status === "low_stock" ? "低于预警库存" : "", item.status === "aging" ? `库龄 ${item.agingDays} 天` : "", item.frozen > 0 ? `冻结 ${item.frozen}` : "", item.defective > 0 ? `残次品 ${item.defective}` : ""].filter(Boolean).join("；"),
        status: "待关注",
        tone: item.status === "low_stock" ? "rose" as Tone : "amber" as Tone,
        nextAction: "可联系运营确认补货、移库、盘点或残次品处理",
        occurredAt: undefined,
      })),
    ...coreData.billingRecords
      .filter((item) => item.dueDate && new Date(item.dueDate).getTime() < currentTimeMs && item.status !== "paid")
      .map((item) => ({
        key: `${item.id}-overdue`,
        module: "费用/账单",
        sourceId: item.id,
        title: `账单逾期 £${item.amount.toFixed(2)}`,
        status: "逾期",
        tone: "rose" as Tone,
        nextAction: "请确认付款、上传凭证或提交账单争议工单",
        occurredAt: item.updatedAt ?? item.createdAt,
      })),
  ].sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime());
  const deliveryExceptionCount = customerCoreOutbound.reduce((sum, item) => sum + (item.exceptions?.filter((exception) => exception.deliveryExceptionType).length ?? 0), 0);
  const logisticsFeeDifferenceRows: CustomerFeeDifferenceRow[] = customerCoreOutbound
    .filter((order) => typeof order.shippingFee === "number" && typeof order.actualShippingFee === "number" && Math.abs(order.actualShippingFee - order.shippingFee) >= 1)
    .map((order) => ({
      id: order.id,
      channel: order.carrierName ? `${order.carrierName} ${order.carrierServiceName ?? ""}`.trim() : order.channel,
      trackingNumber: order.trackingNumber ?? "",
      estimatedFee: order.shippingFee ?? 0,
      actualFee: order.actualShippingFee ?? 0,
      difference: Math.round(((order.actualShippingFee ?? 0) - (order.shippingFee ?? 0)) * 100) / 100,
      note: order.shippingFeeNote ?? "",
      updatedAt: order.shippingFeeCheckedAt ?? order.updatedAt ?? order.createdAt,
    }))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  const selfServiceCenter = buildCustomerSelfServiceCenterData({
    customerCode: session.customerCode,
    submissions,
    coreData,
    documents,
    workOrders: customerWorkOrders,
  });
  const customerDownloadCards: CustomerDownloadCard[] = customerDownloadDefinitions.map((item) => {
    const count =
      item.kind === "self-service-index"
        ? customerDownloadDefinitions.length + expansionData.selfService.templates.length + expansionData.selfService.workOrderCategories.length
        : item.kind === "self-service-actions"
          ? selfServiceCenter.actions.length
        : item.kind === "documents"
          ? documents.length
        : item.kind === "inventory" || item.kind === "inventory-aging" || item.kind === "inventory-turnover"
          ? coreData.inventoryBalances.length
          : item.kind === "inventory-movements"
            ? coreData.inventoryMovements.length
            : item.kind === "inventory-lots"
              ? coreData.inventoryLots.length
              : item.kind === "outbound" || item.kind === "outbound-review"
                ? customerCoreOutbound.length
                : item.kind === "labels"
                  ? customerCoreOutbound.filter((order) => order.labelStatus === "generated").length
                  : item.kind === "proofs"
                    ? customerCoreOutbound.filter((order) => order.trackingEvents?.some((event) => event.status === "delivered") || order.exceptions?.some((exception) => exception.proofUrl)).length
                    : item.kind === "logistics-evidence"
                      ? customerCoreOutbound.filter((order) => order.labelStatus === "generated" || order.trackingNumber || order.trackingEvents?.length || order.exceptions?.length || typeof order.actualShippingFee === "number").length
                    : item.kind === "billing"
                      ? coreData.billingRecords.length
                      : item.kind === "payment-reconciliation"
                        ? coreData.billingRecords.filter((record) => record.paymentReference || record.statementPaymentReference || record.status === "paid" || record.status === "payment_submitted" || record.paymentRejectedAt || record.statementPaymentRejectedAt).length
                      : item.kind === "delivery-exceptions"
                        ? deliveryExceptionCount
                        : item.kind === "returns"
                          ? customerReturns.length
                          : customerExceptionRows.length;

    return {
      ...item,
      href: `/api/downloads?kind=${item.kind}`,
      count,
      status: count > 0 ? `${count} 条` : "空表",
    };
  });
  const customerDownloadRecordCount = customerDownloadCards.reduce((sum, item) => sum + item.count, 0);
  const notifications = await getCustomerNotifications({ customerCode: session.customerCode, submissions, opsData, coreData, documents, workOrders: customerWorkOrders });
  const todoCount = notifications.length || docsMissing + trackingMissing + quoteReady + logisticsOpen + inventoryRisk + customerExceptionRows.length;
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

          <CustomerSelfServiceActionPanel data={selfServiceCenter} />

          <CustomerSelfServiceSummaryPanel
            availableRecordCount={customerDownloadRecordCount}
            downloadReportCount={customerDownloadCards.length}
            summary={selfServiceCenter.summary}
            templateCount={expansionData.selfService.templates.length}
          />

          <CustomerLogisticsFeeDifferencePanel rows={logisticsFeeDifferenceRows} />

          <Panel className="p-0">
            <SectionTitle
              eyebrow="异常中心"
              title="我的异常中心"
              action={
                <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-100 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/downloads?kind=exceptions">
                  下载明细
                  <Download size={14} />
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {customerExceptionRows.length > 0 ? (
                customerExceptionRows.slice(0, 6).map((row) => (
                  <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]" key={row.key}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {pill(row.module, row.tone)}
                        <span className="font-mono text-xs font-semibold text-slate-500">{row.sourceId}</span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-slate-950">{row.title || "异常待处理"}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">下一步：{row.nextAction}</p>
                      {row.orderId && row.exceptionId ? (
                        <CustomerExceptionDecisionActions
                          currentDecision={row.currentDecision}
                          exceptionId={row.exceptionId}
                          hasClaim={row.hasClaim}
                          hasProof={row.hasProof}
                          orderId={row.orderId}
                          redeliveryRequired={row.redeliveryRequired}
                        />
                      ) : null}
                    </div>
                    <div className="text-left md:text-right">
                      {pill(row.status, row.tone)}
                      <p className="mt-2 text-xs text-slate-400">{dateText(row.occurredAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="当前没有需要您处理或关注的异常" />
              )}
            </div>
          </Panel>

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <Panel className="p-0"><SectionTitle eyebrow="下一步" title={"\u4e0b\u4e00\u6b65\u5efa\u8bae"} action={<Clock3 size={18} className="text-slate-400" />} /><div className="grid gap-3 p-5">{nextSteps.length > 0 ? nextSteps.map((item) => (<Link className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:bg-white" href={item.href} key={item.title}><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{item.body}</p></div>{pill("\u53bb\u5904\u7406", item.tone)}</Link>)) : <EmptyState text={"\u5f53\u524d\u6ca1\u6709\u9700\u8981\u7acb\u5373\u5904\u7406\u7684\u4e8b\u9879"} />}</div></Panel>
              <NotificationCenter compact emptyText={"\u6682\u65e0\u5ba2\u6237\u5f85\u529e"} items={notifications} title={"\u6211\u7684\u5f85\u529e"} />
            </div>
            <SelfServiceDownloadCenter downloadCards={customerDownloadCards} templates={expansionData.selfService.templates} workOrderCategories={expansionData.selfService.workOrderCategories} />
          </section>

          <CustomerDocumentArchivePanel documents={documents} />

          <CustomerWorkOrderPanel categories={expansionData.selfService.workOrderCategories} workOrders={customerWorkOrders} />

          <section className="grid gap-5 xl:grid-cols-3">
            <Panel className="p-0"><SectionTitle eyebrow="需求报价" title={"\u9700\u6c42\u4e0e\u62a5\u4ef7"} action={<ReceiptText size={18} className="text-slate-400" />} /><div className="divide-y divide-slate-100">{inquiries.length > 0 ? inquiries.slice(0, 4).map((item) => { const status = inquiryStatus(item); return (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{displayText(item.company, "\u672a\u547d\u540d\u9700\u6c42")}</h3><div className="mt-2">{pill(status.label, status.tone)}</div></div>); }) : <EmptyState text={"\u6682\u65e0\u9700\u6c42\u8bb0\u5f55"} />}</div></Panel>
            <Panel className="p-0"><SectionTitle eyebrow="入库" title={"\u5165\u5e93\u8d27\u4ef6"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/inbound">{"\u65b0\u589e"}</Link>} /><div className="divide-y divide-slate-100">{inbounds.length > 0 ? inbounds.slice(0, 4).map((item) => { const status = inboundStatus(item); return (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{displayText(item.productName, "\u5165\u5e93\u8d27\u4ef6")}</h3><p className="mt-2 text-sm text-slate-600">{item.cartons} {"\u7bb1"} / {item.skuCount} SKU / ETA {item.eta || "-"}</p><div className="mt-2">{pill(status.label, status.tone)}</div></div>); }) : <EmptyState text={"\u6682\u65e0\u5165\u5e93\u9884\u62a5"} />}</div></Panel>
            <Panel className="p-0"><SectionTitle eyebrow="出库物流" title={"\u51fa\u5e93\u4e0e\u7269\u6d41"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/outbound">{"\u521b\u5efa\u51fa\u5e93"}</Link>} /><div className="divide-y divide-slate-100">{customerCoreOutbound.length + customerOutbound.length > 0 ? (<>{customerCoreOutbound.slice(0, 4).map((item) => { const status = coreOutboundStatusMeta(item.status); return (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.channel} / {item.orderCount} {"\u5355"}</h3><p className="mt-2 text-sm text-slate-600">{item.recipientName || "\u6536\u4ef6\u4eba\u5f85\u8865"}</p><div className="mt-2">{pill(status.label, status.tone)}</div></div>); })}{customerOutbound.slice(0, Math.max(0, 4 - customerCoreOutbound.length)).map((item) => (<div className="px-5 py-4" key={item.id}><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.channel} / {item.orderCount} {"\u5355"}</h3><div className="mt-2">{pill(labelForOpsStatus("outbound", item.status), opsTone("outbound", item.status))}</div></div>))}</>) : <EmptyState text={"\u6682\u65e0\u51fa\u5e93\u7533\u8bf7"} />}</div></Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Panel className="p-0"><SectionTitle eyebrow="库存" title={"\u5e93\u5b58\u89c2\u5bdf"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/skus">{"\u7ba1\u7406 SKU"}</Link>} /><div className="divide-y divide-slate-100">{customerInventory.length > 0 ? customerInventory.slice(0, 6).map((item) => (<div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]" key={item.id}><div><p className="font-mono text-xs font-semibold text-slate-500">{item.sku}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.product}</h3><p className="mt-2 text-sm text-slate-600">{"\u53ef\u7528"} {item.available} / {"\u5360\u7528"} {item.reserved} / {"\u51bb\u7ed3"} {item.frozen} / {"\u6b8b\u6b21"} {item.defective} / {"\u5e93\u9f84"} {item.agingDays} {"\u5929"}</p></div>{pill(labelForOpsStatus("inventory", item.status), opsTone("inventory", item.status))}</div>)) : <EmptyState text={"\u6682\u65e0\u5e93\u5b58\u8bb0\u5f55"} />}</div></Panel>
            <Panel className="p-0"><SectionTitle eyebrow="退货" title={"\u9000\u8d27 / RMA"} action={<Link className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="/returns">{"\u63d0\u4ea4\u9000\u8d27"}</Link>} /><div className="divide-y divide-slate-100">{customerReturns.length > 0 ? customerReturns.slice(0, 5).map((item) => (<div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]" key={item.id}><div><p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{item.platform} / {item.originalOrderNo || "\u8ba2\u5355\u53f7\u5f85\u8865"}</h3><p className="mt-2 text-sm text-slate-600">{item.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join(" / ")}</p></div>{pill(returnOrderStatusLabel(item.status), returnTone(item.status))}</div>)) : <EmptyState text={"\u6682\u65e0\u9000\u8d27\u9884\u62a5"} />}</div></Panel>
          </section>

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-950"><ShieldCheck size={16} />{"\u5ba2\u6237\u53ef\u89c1\u8303\u56f4"}</p><p className="mt-2 text-sm leading-6 text-emerald-900">{"\u8fd9\u91cc\u5c55\u793a\u7684\u662f\u5ba2\u6237\u53ef\u76f4\u63a5\u67e5\u770b\u548c\u64cd\u4f5c\u7684\u4e1a\u52a1\u4fe1\u606f\u3002\u5185\u90e8\u5ba1\u6279\u3001\u5458\u5de5\u5907\u6ce8\u3001\u6210\u672c\u89c4\u5219\u548c\u8c03\u62e8\u6765\u6e90\u4ecd\u4fdd\u7559\u5728\u8fd0\u8425\u540e\u53f0\u3002"}</p></section>
        </div>
      </div>
    </PageShell>
  );
}
