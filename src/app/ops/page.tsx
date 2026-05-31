import type { ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Download,
  FileText,
  Flame,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { buildInboundDocumentChecklist, getSubmissions, type InboundSubmission, type InquirySubmission } from "@/lib/localStore";
import { documentCategoryLabel, documentRefLabel, getDocuments, type DocumentRecord } from "@/lib/documentStore";
import { getStaffNotifications } from "@/lib/notificationStore";
import {
  getOpsWorkbenchData,
  labelForOpsStatus,
  type InventoryWatch,
  type LogisticsIssue,
  type OpsKind,
  type OutboundTask,
} from "@/lib/opsStore";
import { OpsInboundWorkflow } from "../components/OpsInboundWorkflow";
import { OpsInquiryWorkflow } from "../components/OpsInquiryWorkflow";
import { OpsItemWorkflow } from "../components/OpsItemWorkflow";
import { OpsLogisticsControlPanel, type LogisticsControlRow } from "../components/OpsLogisticsControlPanel";
import { OpsReplenishmentPlanner } from "../components/OpsReplenishmentPlanner";
import { OpsStocktakePanel, type StocktakeCandidate } from "../components/OpsStocktakePanel";
import { OpsTransferLifecyclePanel } from "../components/OpsTransferLifecyclePanel";
import { OpsBillingWorkflow } from "../components/OpsBillingWorkflow";
import { OpsBillingGenerator } from "../components/OpsBillingGenerator";
import { OpsBillingStatementLockPanel } from "../components/OpsBillingStatementLockPanel";
import { OpsCoreOutboundWorkflow } from "../components/OpsCoreOutboundWorkflow";
import { OpsInvoiceWorkflow } from "../components/OpsInvoiceWorkflow";
import { OpsOutboundBatchPanel } from "../components/OpsOutboundBatchPanel";
import { OpsShipmentPanel } from "../components/OpsShipmentPanel";
import { OpsInventoryAdjustmentForm } from "../components/OpsInventoryAdjustmentForm";
import { OpsInventoryLotPanel } from "../components/OpsInventoryLotPanel";
import { OpsMabangModulePanel } from "../components/OpsMabangModulePanel";
import { OpsReturnWorkflow } from "../components/OpsReturnWorkflow";
import { WarehouseInventoryMovePanel } from "../components/WarehouseInventoryMovePanel";
import { PageShell } from "../components/MarketingShell";
import { NotificationCenter } from "../components/NotificationCenter";
import { InboundExceptionActions } from "../components/InboundExceptionActions";
import { LogoutButton } from "../components/LogoutButton";
import { OutboundExceptionActions } from "../components/OutboundExceptionActions";
import { OpsCustomerStatusWorkflow } from "../components/OpsCustomerStatusWorkflow";
import { getAuditLogs, type AuditLogRecord } from "@/lib/auditLogStore";
import { billingMonthLabel, summarizeBillingMonths } from "@/lib/billingUtils";
import { getCustomerAccounts, type CustomerAccountStatus, type CustomerAccountView } from "@/lib/customerAccountStore";
import { evaluateLaunchReadiness, type LaunchCheckStatus, type LaunchReadiness } from "@/lib/launchReadiness";
import { canReviewInventoryAdjustment, requireStaffSession } from "@/lib/staffAuth";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { billingInvoiceStatusLabel, billingStatusLabel, buildReplenishmentSuggestions, buildStocktakeCandidates, getWarehouseCoreData, outboundWorkModeLabel, returnOrderStatusLabel, suggestCarrierServiceForOutbound, type BillingRecord, type CoreOutboundOrder, type CustomerProfile, type InventoryAdjustmentRequest, type InventoryBalance, type InventoryLot, type InventoryMovement, type ReturnOrder, type WarehouseLocation } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneClasses: Record<Tone, { soft: string; text: string; pill: string }> = {
  slate: { soft: "bg-slate-50", text: "text-slate-700", pill: "border-slate-200 bg-slate-50 text-slate-700" },
  cyan: { soft: "bg-cyan-50", text: "text-cyan-800", pill: "border-cyan-200 bg-cyan-50 text-cyan-800" },
  emerald: { soft: "bg-emerald-50", text: "text-emerald-800", pill: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  amber: { soft: "bg-amber-50", text: "text-amber-800", pill: "border-amber-200 bg-amber-50 text-amber-800" },
  rose: { soft: "bg-rose-50", text: "text-rose-800", pill: "border-rose-200 bg-rose-50 text-rose-800" },
  violet: { soft: "bg-violet-50", text: "text-violet-800", pill: "border-violet-200 bg-violet-50 text-violet-800" },
};

const domainNav = [
  { id: "overview", label: "总览", icon: LayoutDashboard },
  { id: "inquiry", label: "询盘", icon: FileText },
  { id: "inbound", label: "入库", icon: PackageCheck },
  { id: "inventory", label: "库存", icon: Warehouse },
  { id: "outbound", label: "出库", icon: Boxes },
  { id: "logistics", label: "物流", icon: Truck },
  { id: "billing", label: "账单", icon: ReceiptText },
];

const logisticsOptions = [
  { value: "open", label: "待处理" },
  { value: "investigating", label: "处理中" },
  { value: "waiting_customer", label: "待客户确认" },
  { value: "resolved", label: "已解决" },
];

const outboundOptions = [
  { value: "pending_review", label: "待审核" },
  { value: "picking", label: "待配货" },
  { value: "label_pending", label: "待获取面单" },
  { value: "packing_check", label: "包装验货" },
  { value: "handover", label: "待交运" },
  { value: "shipped", label: "已发货" },
  { value: "blocked", label: "异常阻塞" },
];

const inventoryOptions = [
  { value: "normal", label: "正常" },
  { value: "low_stock", label: "低于安全库存" },
  { value: "aging", label: "库龄偏高" },
  { value: "replenishment_pending", label: "待预约送仓" },
  { value: "sync_issue", label: "同步异常" },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function statusPill(label: string, tone: Tone = "slate") {
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone].pill}`}>{label}</span>;
}

function displayText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  if (!text || text.includes("?") || text.includes("？")) return fallback;
  return text;
}

const customerStatusLabels: Record<CustomerAccountStatus, string> = {
  unverified: "未认证",
  verified: "已认证",
  paused: "暂停",
};

const customerStatusTones: Record<CustomerAccountStatus, Tone> = {
  unverified: "amber",
  verified: "emerald",
  paused: "rose",
};

function money(value?: number) {
  return typeof value === "number" ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}` : "待填写";
}

function inquiryStatus(item: InquirySubmission) {
  const labels: Record<InquirySubmission["status"], { label: string; tone: Tone }> = {
    new: { label: "新询盘", tone: "emerald" },
    contacted: { label: "已联系", tone: "cyan" },
    quoted: { label: "已报价", tone: "cyan" },
    waiting_customer: { label: "待客户确认", tone: "amber" },
    quote_accepted: { label: "客户已确认", tone: "emerald" },
    quote_question: { label: "报价疑问", tone: "amber" },
    converted_to_inbound: { label: "已转入库", tone: "violet" },
    closed: { label: "已关闭", tone: "slate" },
  };
  return labels[item.status] ?? labels.new;
}

function inboundStatus(item: InboundSubmission) {
  const checklist = buildInboundDocumentChecklist(item);
  if (item.status === "exception") return { label: "异常处理中", tone: "rose" as Tone };
  if (item.status === "on_hold") return { label: "暂缓处理", tone: "amber" as Tone };
  if (item.status === "closed") return { label: "已关闭", tone: "slate" as Tone };
  if (item.status === "cancelled") return { label: "已取消", tone: "slate" as Tone };
  if (checklist.missingRequired.length > 0) return { label: "待补资料", tone: "amber" as Tone };
  if (!item.tracking) return { label: "待补追踪号", tone: "rose" as Tone };

  const labels: Record<InboundSubmission["status"], { label: string; tone: Tone }> = {
    pending_review: { label: "待审核", tone: "cyan" },
    submitted: { label: "已提交", tone: "cyan" },
    docs_review: { label: "资料审核中", tone: "cyan" },
    docs_review_passed: { label: "资料已通过", tone: "emerald" },
    appointment_confirmed: { label: "已预约入仓", tone: "violet" },
    arrived: { label: "已到仓", tone: "violet" },
    receiving: { label: "收货验收中", tone: "violet" },
    received: { label: "已收货", tone: "emerald" },
    putaway_completed: { label: "已上架", tone: "emerald" },
    closed: { label: "已关闭", tone: "slate" },
    on_hold: { label: "暂缓处理", tone: "amber" },
    exception: { label: "异常处理中", tone: "rose" },
    cancelled: { label: "已取消", tone: "slate" },
  };
  return labels[item.status] ?? labels.submitted;
}

function openInboundReceivingExceptionRows(inbounds: InboundSubmission[]) {
  return inbounds.flatMap((task) =>
    (task.receivingExceptions ?? [])
      .filter((exception) => exception.status === "open" || exception.status === "investigating")
      .map((exception) => ({ task, exception })),
  );
}

function inquirySegment(item: InquirySubmission) {
  const text = [item.platform, item.service, item.volume, item.leadIntent, item.note, item.quoteEstimate, item.followUpNote, item.quoteDraft?.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (item.quoteEstimate) return { label: "费用预估线索", priority: "高", tone: "cyan" as Tone };
  if (text.includes("fba") || text.includes("fnsku")) return { label: "FBA 补货", priority: "中", tone: "violet" as Tone };
  if (text.includes("退货") || text.includes("rma")) return { label: "退货处理", priority: "中", tone: "amber" as Tone };
  if (text.includes("tiktok") || text.includes("fulfillment") || text.includes("一件代发")) return { label: "一件代发", priority: "中", tone: "emerald" as Tone };
  if (item.status === "new") return { label: "新客户试仓", priority: "高", tone: "emerald" as Tone };
  return { label: "常规报价", priority: "常规", tone: "slate" as Tone };
}

function isDueFollowUp(item: InquirySubmission) {
  if (!item.nextFollowUpAt || item.status === "closed" || item.status === "converted_to_inbound") return false;
  return item.nextFollowUpAt <= new Date().toISOString().slice(0, 10);
}

function isHotInquiry(item: InquirySubmission) {
  const segment = inquirySegment(item);
  return item.status === "new" && (segment.priority === "高" || Boolean(item.quoteEstimate));
}

function latestEvent(item: InquirySubmission | InboundSubmission) {
  return item.events
    ?.slice()
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
}

function opsStatusTone(kind: OpsKind, status: string): Tone {
  if (kind === "logistics") {
    if (status === "resolved") return "emerald";
    if (status === "waiting_customer") return "amber";
    if (status === "investigating") return "cyan";
    return "rose";
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

function outboundRequiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function outboundScannedQty(progress?: Record<string, number>) {
  return Object.values(progress ?? {}).reduce((sum, value) => sum + value, 0);
}

function outboundScanSummary(order: CoreOutboundOrder) {
  return {
    total: outboundRequiredQty(order),
    picked: outboundScannedQty(order.scanProgress?.pickedQtyBySku),
    sorted: outboundScannedQty(order.scanProgress?.sortedQtyBySku),
    packed: outboundScannedQty(order.scanProgress?.packedQtyBySku),
    latest: order.scanProgress?.lastScans?.[0],
  };
}

const scanActionLabels = {
  pick: "拣货",
  sort: "配货",
  pack: "复核",
  ship: "签出",
  intercept: "截单",
} as const;

const outboundExceptionStatusLabels = {
  open: "待处理",
  investigating: "处理中",
  resolved: "已处理",
  ignored: "已忽略",
} as const;

function openOutboundScanExceptions(rows: CoreOutboundOrder[]) {
  return rows.flatMap((order) =>
    (order.exceptions ?? [])
      .filter((exception) => exception.status === "open" || exception.status === "investigating")
      .map((exception) => ({ order, exception })),
  );
}

function outboundExceptionTone(severity: "warning" | "critical"): Tone {
  return severity === "critical" ? "rose" : "amber";
}

function progressText(value: number, total: number) {
  return total > 0 ? `${value}/${total}` : "-";
}

function MetricTile({ icon: Icon, label, value, caption, tone }: { icon: LucideIcon; label: string; value: string | number; caption: string; tone: Tone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${toneClasses[tone].soft} ${toneClasses[tone].text}`}>
          <Icon size={18} />
        </span>
        <span className="text-xs font-semibold text-slate-400">{caption}</span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function QueueColumn({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: Array<{ label: string; count: number; tone: Tone }> }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon size={16} />
        </span>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="mt-4 grid gap-2">
        {rows.map((row) => (
          <div className="flex min-h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm" key={row.label}>
            <span className="text-slate-600">{row.label}</span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${toneClasses[row.tone].soft} ${toneClasses[row.tone].text}`}>{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DomainHeading({ eyebrow, title, body, icon: Icon }: { eyebrow: string; title: string; body: string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase text-cyan-700">{eyebrow}</p>
        <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-950">
          <Icon size={18} className="text-cyan-700" />
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </div>
  );
}

function WorkbenchTable({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Icon size={16} className="text-[#0E7490]" />
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const launchStatusTone: Record<LaunchCheckStatus, Tone> = {
  pass: "emerald",
  warn: "amber",
  fail: "rose",
};

const launchStatusLabel: Record<LaunchCheckStatus, string> = {
  pass: "可上线",
  warn: "需关注",
  fail: "阻塞",
};

function LaunchReadinessPanel({ readiness }: { readiness: LaunchReadiness }) {
  const blockingChecks = readiness.checks.filter((check) => check.status !== "pass");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <ShieldCheck size={18} className="text-[#0E7490]" />
              上线体检
            </h2>
            {statusPill(launchStatusLabel[readiness.status], launchStatusTone[readiness.status])}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            当前上线评分 {readiness.score}/100，环境 {readiness.environment}。这里专门盯数据持久化、域名、账号和关键业务闭环。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">客户</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{readiness.metrics.customers}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">账单</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{readiness.metrics.billingRecords}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">资料</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{readiness.metrics.documents}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {(blockingChecks.length > 0 ? blockingChecks : readiness.checks.slice(0, 4)).map((check) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={check.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">{check.label}</p>
              {statusPill(`${check.owner} / ${launchStatusLabel[check.status]}`, launchStatusTone[check.status])}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildLogisticsControlRows(rows: CoreOutboundOrder[]): LogisticsControlRow[] {
  const staleThreshold = Date.now() - 1000 * 60 * 60 * 24 * 3;

  return rows.map((row) => {
    const suggested = suggestCarrierServiceForOutbound(row);
    const riskLabels: string[] = [];
    const updatedAt = new Date(row.updatedAt ?? row.createdAt).getTime();

    if (!row.carrierServiceCode || row.labelStatus === "not_requested") riskLabels.push("待匹配渠道");
    if (row.labelStatus === "failed") riskLabels.push("面单失败");
    if (!row.trackingNumber && ["handover", "shipped"].includes(row.status)) riskLabels.push("缺追踪号");
    if (row.trackingNumber && row.status !== "shipped" && updatedAt < staleThreshold) riskLabels.push("轨迹超时");
    if (typeof row.shippingFee === "number" && typeof row.actualShippingFee === "number" && Math.abs(row.actualShippingFee - row.shippingFee) >= 1) riskLabels.push("费用差异");

    const openExceptions = (row.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
    if (openExceptions.length > 0) riskLabels.push(`异常待处理 ${openExceptions.length}`);

    return {
      id: row.id,
      customerCode: row.customerCode,
      channel: row.channel,
      status: row.status,
      labelStatus: row.labelStatus,
      trackingNumber: row.trackingNumber,
      shippingFee: row.shippingFee,
      actualShippingFee: row.actualShippingFee,
      carrierName: row.carrierName,
      carrierServiceName: row.carrierServiceName,
      trackingEvents: row.trackingEvents,
      exceptions: row.exceptions,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      suggestedServiceCode: suggested.serviceCode,
      suggestedServiceName: `${suggested.carrierName} ${suggested.serviceName}`,
      riskLabels,
    };
  });
}

function InboundQueueTable({ inbounds }: { inbounds: InboundSubmission[] }) {
  return (
    <WorkbenchTable icon={PackageCheck} title="入库预报队列">
      <table className="min-w-[860px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">ASN</th>
            <th className="px-4 py-3">客户</th>
            <th className="px-4 py-3">预计到仓</th>
            <th className="px-4 py-3">箱数 / SKU</th>
            <th className="px-4 py-3">资料</th>
            <th className="px-4 py-3">状态</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {inbounds.slice(0, 6).map((item) => {
            const checklist = buildInboundDocumentChecklist(item);
            const status = inboundStatus(item);
            const openExceptions = openInboundReceivingExceptionRows([item]);
            return (
              <tr key={item.id}>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-950">{item.id}</td>
                <td className="px-4 py-3 text-slate-700">{displayText(item.customer || item.contact, "未命名客户")}</td>
                <td className="px-4 py-3 text-slate-600">{item.eta}</td>
                <td className="px-4 py-3 text-slate-600">
                  {item.cartons} / {item.skuCount}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {checklist.requiredReady}/{checklist.requiredTotal}
                </td>
                <td className="px-4 py-3">
                  <div className="grid gap-2">
                    {statusPill(status.label, status.tone)}
                    {openExceptions.length ? statusPill(`收货差异 ${openExceptions.length}`, openExceptions.some(({ exception }) => exception.severity === "critical") ? "rose" : "amber") : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {inbounds.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                暂无入库预报
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function InboundReceivingExceptionPanel({ inbounds }: { inbounds: InboundSubmission[] }) {
  const rows = openInboundReceivingExceptionRows(inbounds);
  const critical = rows.filter(({ exception }) => exception.severity === "critical").length;

  return (
    <WorkbenchTable icon={AlertTriangle} title="入库收货差异处理">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        少货、多货、破损、SKU 不符、标签异常和资料缺失会进入这里，运营可先处理差异，再让仓库继续上架。
      </div>
      <div className="grid gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">待处理差异</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{rows.length}</p>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold text-rose-700">严重异常</p>
            <p className="mt-1 text-2xl font-semibold text-rose-900">{critical}</p>
          </div>
          <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
            <p className="text-xs font-semibold text-cyan-800">影响 ASN</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-950">{new Set(rows.map(({ task }) => task.id)).size}</p>
          </div>
        </div>
        {rows.map(({ task, exception }) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={exception.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-slate-500">{task.id} / {task.customerCode || "未绑定客户"}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950">{exception.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  SKU {exception.skuCode || "-"} / 箱号 {exception.cartonNo || "-"} / 预报 {exception.expectedQty ?? "-"} / 实收 {exception.actualQty ?? "-"} / {formatDateTime(exception.createdAt)}
                </p>
              </div>
              {statusPill(exception.severity === "critical" ? "严重异常" : "提醒", exception.severity === "critical" ? "rose" : "amber")}
            </div>
            <InboundExceptionActions exception={exception} inboundId={task.id} mode="resolve" />
          </div>
        ))}
        {rows.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">暂无待处理入库收货差异</p> : null}
      </div>
    </WorkbenchTable>
  );
}

function LogisticsTable({ rows }: { rows: LogisticsIssue[] }) {
  return (
    <WorkbenchTable icon={Truck} title="物流异常">
      <table className="min-w-[940px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">单号</th>
            <th className="px-4 py-3">客户 / 渠道</th>
            <th className="px-4 py-3">问题</th>
            <th className="px-4 py-3">截止</th>
            <th className="px-4 py-3">状态推进</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-semibold text-slate-950">{row.id}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{row.trackingNo}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.customer}</p>
                <p className="mt-1 text-xs text-slate-500">{row.channel}</p>
              </td>
              <td className="px-4 py-3">{statusPill(row.issue, opsStatusTone("logistics", row.status))}</td>
              <td className="px-4 py-3 text-slate-600">{row.deadline}</td>
              <td className="px-4 py-3">
                <OpsItemWorkflow id={row.id} kind="logistics" note={row.note} options={logisticsOptions} owner={row.owner} status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function InventoryTable({ rows }: { rows: InventoryWatch[] }) {
  return (
    <WorkbenchTable icon={Warehouse} title="库存观察">
      <table className="min-w-[920px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">库存</th>
            <th className="px-4 py-3">库龄</th>
            <th className="px-4 py-3">风险</th>
            <th className="px-4 py-3">状态推进</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-semibold text-slate-950">{row.sku}</p>
                <p className="mt-1 text-xs text-slate-500">{row.product}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p>可用 {row.available}</p>
                <p className="mt-1 text-xs text-slate-500">占用 {row.reserved} / 警戒 {row.alert}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{row.agingDays} 天</td>
              <td className="px-4 py-3">{statusPill(labelForOpsStatus("inventory", row.status), opsStatusTone("inventory", row.status))}</td>
              <td className="px-4 py-3">
                <OpsItemWorkflow id={row.id} kind="inventory" note={row.note} options={inventoryOptions} owner={row.owner} status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function CoreInventoryTable({ balances, lots, movements, adjustments, locations, canReviewAdjustments }: { balances: InventoryBalance[]; lots: InventoryLot[]; movements: InventoryMovement[]; adjustments: InventoryAdjustmentRequest[]; locations: WarehouseLocation[]; canReviewAdjustments: boolean }) {
  const frozenTotal = balances.reduce((sum, item) => sum + (item.frozenQty ?? 0), 0);
  const defectiveTotal = balances.reduce((sum, item) => sum + (item.defectiveQty ?? 0), 0);
  const reservedTotal = balances.reduce((sum, item) => sum + item.reservedQty, 0);
  const controlledSkuCount = balances.filter((item) => (item.frozenQty ?? 0) > 0 || (item.defectiveQty ?? 0) > 0).length;

  return (
    <section className="grid gap-4">
      <OpsInventoryAdjustmentForm adjustments={adjustments} balances={balances} canReview={canReviewAdjustments} />
      <OpsInventoryLotPanel balances={balances} lots={lots} />
      <WarehouseInventoryMovePanel adjustments={adjustments} balances={balances} canReview={canReviewAdjustments} locations={locations} />
      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["销售占用", reservedTotal, "客户出库已预占，签出后释放。"],
          ["冻结库存", frozenTotal, "破损待判定、异常拦截或人工冻结。"],
          ["残次品库存", defectiveTotal, "质检不合格，不能直接销售出库。"],
          ["受控 SKU", controlledSkuCount, "存在冻结或残次数量的 SKU。"],
        ].map(([label, value, hint]) => (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={label}>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
          </div>
        ))}
      </section>
      <WorkbenchTable icon={Warehouse} title="正式库存底表">
        <table className="min-w-[1080px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">客户 / SKU</th>
              <th className="px-4 py-3">仓库 / 库位</th>
              <th className="px-4 py-3">库存分类</th>
              <th className="px-4 py-3">预警 / 库龄</th>
              <th className="px-4 py-3">最近更新</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {balances.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">{row.customerCode}</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-slate-950">{row.skuCode}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{row.warehouseCode}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.locationCode || "-"}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>可用 {row.availableQty}</p>
                  <p className="mt-1 text-xs text-slate-500">占用 {row.reservedQty} / 冻结 {row.frozenQty ?? 0} / 残次 {row.defectiveQty ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-500">在途 {row.inboundQty} / 合计 {row.availableQty + row.reservedQty + (row.frozenQty ?? 0) + (row.defectiveQty ?? 0)}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>预警 {row.alertQty}</p>
                  <p className="mt-1 text-xs text-slate-500">库龄 {row.agingDays} 天</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WorkbenchTable>
      <WorkbenchTable icon={ClipboardCheck} title="最近库存流水">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">客户 / SKU</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">数量</th>
              <th className="px-4 py-3">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {movements.slice(0, 8).map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(row.occurredAt)}</td>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">{row.customerCode}</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-slate-950">{row.skuCode}</p>
                </td>
                <td className="px-4 py-3">{statusPill(row.movementType, row.movementType === "adjust" ? "amber" : "cyan")}</td>
                <td className="px-4 py-3 text-slate-600">{row.quantity}</td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{row.note || "-"}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{row.refType} / {row.refId}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </WorkbenchTable>
    </section>
  );
}

function OutboundTable({ rows }: { rows: OutboundTask[] }) {
  return (
    <WorkbenchTable icon={Boxes} title="出库作业">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">批次</th>
            <th className="px-4 py-3">客户</th>
            <th className="px-4 py-3">渠道 / 订单</th>
            <th className="px-4 py-3">截止</th>
            <th className="px-4 py-3">状态推进</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-950">{row.id}</td>
              <td className="px-4 py-3 text-slate-600">{row.customer}</td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.channel}</p>
                <p className="mt-1 text-xs text-slate-500">{row.orderCount} 单</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{row.deadline}</td>
              <td className="px-4 py-3">
                <OpsItemWorkflow id={row.id} kind="outbound" note={row.note} options={outboundOptions} owner={row.owner} status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function billingStatusTone(status: BillingRecord["status"]): Tone {
  if (status === "paid") return "emerald";
  if (status === "confirmed") return "cyan";
  if (status === "payment_submitted" || status === "pending_confirmation") return "amber";
  if (status === "disputed") return "rose";
  return "slate";
}

function BillingStatementPanel({ rows, customers }: { rows: BillingRecord[]; customers: CustomerProfile[] }) {
  const monthlySummaries = summarizeBillingMonths(rows);
  const currentMonth = monthlySummaries[0]?.month;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ReceiptText size={18} className="text-[#0E7490]" />
            月结对账导出
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">按账单到期月份汇总全部客户费用，财务可导出 CSV 核对、开票和月结归档。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentMonth ? (
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800" href={`/api/ops/billing/export?month=${currentMonth}`}>
              导出最近月份
            </Link>
          ) : null}
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/billing/export">
            导出全部账单
          </Link>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">月份</th>
              <th className="px-4 py-3">账单数</th>
              <th className="px-4 py-3">总额</th>
              <th className="px-4 py-3">待结算</th>
              <th className="px-4 py-3">已支付</th>
              <th className="px-4 py-3">争议</th>
              <th className="px-4 py-3">锁账/开票</th>
              <th className="px-4 py-3">导出</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {monthlySummaries.slice(0, 6).map((item) => (
              <tr key={item.month}>
                <td className="px-4 py-3 font-semibold text-slate-950">{billingMonthLabel(item.month)}</td>
                <td className="px-4 py-3 text-slate-600">{item.count}</td>
                <td className="px-4 py-3 font-semibold text-slate-950">£{item.totalAmount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-amber-800">£{item.payableAmount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-emerald-800">£{item.paidAmount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-rose-800">£{item.disputedAmount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-slate-600">{item.lockedCount} 锁 / {item.invoiceIssuedCount} 票</td>
                <td className="px-4 py-3">
                  <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/api/ops/billing/export?month=${item.month}`}>
                    CSV
                  </Link>
                </td>
              </tr>
            ))}
            {monthlySummaries.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                  暂无可导出的账单
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <OpsBillingStatementLockPanel customers={customers} records={rows} />
    </section>
  );
}

function BillingReviewTable({ rows }: { rows: BillingRecord[] }) {
  return (
    <WorkbenchTable icon={ReceiptText} title="账单复核">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">账单</th>
            <th className="px-4 py-3">客户 / 业务</th>
            <th className="px-4 py-3">金额</th>
            <th className="px-4 py-3">客户动作</th>
            <th className="px-4 py-3">复核推进</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-semibold text-slate-950">{row.id}</p>
                <p className="mt-1 text-xs text-slate-500">{row.title}</p>
                {row.feeLines?.length ? (
                  <p className="mt-1 text-xs text-cyan-700">
                    {row.feeLines.map((line) => `${line.label} ${line.quantity}${line.unitLabel} x £${line.unitPrice}`).join(" / ")}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusPill(billingStatusLabel(row.status), billingStatusTone(row.status))}
                  {statusPill(billingInvoiceStatusLabel(row.invoiceStatus), row.invoiceStatus === "issued" ? "emerald" : row.invoiceStatus === "requested" ? "amber" : row.invoiceStatus === "voided" ? "rose" : "slate")}
                  {row.statementStatus === "locked" ? statusPill("已锁账", "emerald") : null}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.customerCode}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{row.refType} / {row.refId}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p className="font-semibold text-slate-950">£{row.amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</p>
                <p className="mt-1 text-xs text-slate-500">到期 {row.dueDate || "-"}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.customerMessage ? <p className="max-w-xs leading-6">{row.customerMessage}</p> : <p className="text-slate-400">暂无说明</p>}
                {row.paymentReference ? <p className="mt-2 font-mono text-xs font-semibold text-cyan-800">付款参考 {row.paymentReference}</p> : null}
                {row.paymentNote ? <p className="mt-1 text-xs leading-5 text-slate-500">{row.paymentNote}</p> : null}
              </td>
              <td className="px-4 py-3">
                <OpsBillingWorkflow id={row.id} reviewNote={row.reviewNote} status={row.status} />
                <OpsInvoiceWorkflow id={row.id} invoiceNote={row.invoiceNote} invoiceStatus={row.invoiceStatus} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                暂无账单记录
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function returnStatusTone(status: ReturnOrder["status"]): Tone {
  if (status === "restocked" || status === "closed") return "emerald";
  if (status === "exception" || status === "disposed") return "rose";
  if (status === "received" || status === "inspection" || status === "repair") return "amber";
  if (status === "label_sent" || status === "in_transit") return "cyan";
  return "slate";
}

function ReturnOrdersTable({ rows }: { rows: ReturnOrder[] }) {
  return (
    <WorkbenchTable icon={RotateCcw} title="退货 / RMA 处理">
      <table className="min-w-[1040px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">退货单</th>
            <th className="px-4 py-3">客户 / 平台</th>
            <th className="px-4 py-3">SKU 明细</th>
            <th className="px-4 py-3">质检与处理</th>
            <th className="px-4 py-3">状态推进</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-semibold text-slate-950">{row.id}</p>
                <div className="mt-2">{statusPill(returnOrderStatusLabel(row.status), returnStatusTone(row.status))}</div>
                <p className="mt-2 text-xs text-slate-500">预计到仓 {row.expectedArrivalDate || "-"}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.customerCode}</p>
                <p className="mt-1 text-xs text-slate-500">{row.platform} / {row.originalOrderNo || "订单号待补"}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{row.buyerReturnTracking || "追踪号待补"}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.skuLines.map((line) => (
                  <p className="font-mono text-xs" key={`${row.id}-${line.skuCode}`}>{line.skuCode} x {line.quantity}</p>
                ))}
                <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{row.returnReason}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p className="max-w-xs leading-6">{row.inspectionResult || "待质检"}</p>
                {row.customerNote ? <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">客户偏好：{row.customerNote}</p> : null}
                {row.locationCode ? <p className="mt-2 font-mono text-xs text-cyan-800">库位 {row.locationCode}</p> : null}
              </td>
              <td className="px-4 py-3">
                <OpsReturnWorkflow id={row.id} inspectionResult={row.inspectionResult} locationCode={row.locationCode} opsNote={row.opsNote} resolution={row.resolution} status={row.status} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                暂无退货预报
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function CoreOutboundRequestsTable({ rows }: { rows: CoreOutboundOrder[] }) {
  return (
    <WorkbenchTable icon={Boxes} title="客户出库申请">
      <table className="min-w-[1260px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">申请</th>
            <th className="px-4 py-3">客户 / 渠道</th>
            <th className="px-4 py-3">仓库作业</th>
            <th className="px-4 py-3">扫码进度</th>
            <th className="px-4 py-3">SKU 明细</th>
            <th className="px-4 py-3">要求</th>
            <th className="px-4 py-3">状态推进</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => {
            const scan = outboundScanSummary(row);
            const openExceptions = (row.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
            return (
            <tr key={row.id}>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-950">{row.id}</td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.customerCode}</p>
                <p className="mt-1 text-xs text-slate-500">{row.channel} / {row.orderCount} 单</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p className="font-semibold text-slate-900">{outboundWorkModeLabel(row.workMode)}</p>
                <p className="mt-1 font-mono text-xs">波次：{row.pickWaveNo || "待生成"}</p>
                <p className="mt-1 text-xs">拣货员：{row.assignedPicker || "-"}</p>
                <p className="mt-1 text-xs">篮号：{row.basketNo || "-"}</p>
                {row.interceptStatus && row.interceptStatus !== "none" ? <p className="mt-2 text-xs font-semibold text-rose-700">截单：{row.interceptStatus}</p> : null}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <div className="grid gap-1 font-mono text-xs">
                  <span>拣货 {progressText(scan.picked, scan.total)}</span>
                  <span>配货 {progressText(scan.sorted, scan.total)}</span>
                  <span>复核 {progressText(scan.packed, scan.total)}</span>
                </div>
                {scan.latest ? (
                  <p className="mt-2 max-w-[12rem] truncate text-xs text-slate-500">
                    最近：{scanActionLabels[scan.latest.action] ?? scan.latest.action} / {scan.latest.operator} / {formatDateTime(scan.latest.scannedAt)}
                  </p>
                ) : <p className="mt-2 text-xs text-slate-400">暂无扫码</p>}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.skuLines?.length ? row.skuLines.map((line) => (
                  <p className="font-mono text-xs" key={`${row.id}-${line.skuCode}`}>{line.skuCode} x {line.quantity}</p>
                )) : <p className="text-slate-400">待补 SKU</p>}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.requestedShipDate ? <p>期望 {row.requestedShipDate}</p> : null}
                {row.deliveryAddress ? <p className="mt-1 max-w-xs truncate">{row.deliveryAddress}</p> : null}
                {row.note ? <p className="mt-1 text-xs text-slate-500">{row.note}</p> : null}
              </td>
              <td className="px-4 py-3">
                <div className="mb-2">{statusPill(labelForOpsStatus("outbound", row.status), opsStatusTone("outbound", row.status))}</div>
                {openExceptions.length ? (
                  <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 p-2">
                    <p className="text-xs font-semibold text-rose-800">未处理扫码异常 {openExceptions.length} 条</p>
                    {openExceptions.slice(0, 2).map((exception) => (
                      <p className="mt-1 truncate text-xs text-rose-700" key={exception.id}>
                        {exception.severity === "critical" ? "严重" : "提醒"} / {exception.message}
                      </p>
                    ))}
                  </div>
                ) : null}
                <OpsCoreOutboundWorkflow id={row.id} note={row.note} status={row.status} />
                <div className="mt-2">
                  <OpsShipmentPanel order={row} />
                </div>
                {row.operationLogs?.length ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-500">最近时间线</p>
                    {row.operationLogs.slice(0, 3).map((log) => (
                      <p className="mt-1 truncate text-xs text-slate-600" key={log.id}>
                        {formatDateTime(log.occurredAt)} / {log.label} / {log.operator}
                      </p>
                    ))}
                  </div>
                ) : null}
              </td>
            </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                暂无客户出库申请
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function londonDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function OutboundScanOperationsPanel({ rows }: { rows: CoreOutboundOrder[] }) {
  const todayKey = londonDateKey(new Date().toISOString());
  const scanRows = rows.flatMap((order) =>
    (order.scanProgress?.lastScans ?? []).map((scan) => ({
      ...scan,
      orderId: order.id,
      customerCode: order.customerCode,
      status: order.status,
      workMode: outboundWorkModeLabel(order.workMode),
    })),
  );
  const todayScans = scanRows.filter((scan) => londonDateKey(scan.scannedAt) === todayKey);
  const workerStats = Array.from(
    todayScans.reduce((map, scan) => {
      const current = map.get(scan.operator) ?? { operator: scan.operator, scans: 0, ship: 0, intercept: 0 };
      current.scans += 1;
      if (scan.action === "ship") current.ship += 1;
      if (scan.action === "intercept") current.intercept += 1;
      map.set(scan.operator, current);
      return map;
    }, new Map<string, { operator: string; scans: number; ship: number; intercept: number }>()),
  ).map(([, value]) => value).sort((a, b) => b.scans - a.scans);
  const pendingWaves = rows.filter((order) => order.status !== "shipped" && (order.pickWaveNo || order.scanProgress?.lastScans?.length));
  const openExceptions = openOutboundScanExceptions(rows);
  const criticalExceptions = openExceptions.filter(({ exception }) => exception.severity === "critical");

  return (
    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ScanLine size={18} className="text-[#0E7490]" />
            今日扫码作业监控
          </h2>
          {statusPill(`${todayScans.length} 次扫码`, todayScans.length > 0 ? "cyan" : "slate")}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">今日扫码</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{todayScans.length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">签出扫描</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{todayScans.filter((scan) => scan.action === "ship").length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">截单/异常</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{todayScans.filter((scan) => scan.action === "intercept").length}</p>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold text-rose-700">待处理异常</p>
            <p className="mt-2 text-2xl font-semibold text-rose-900">{openExceptions.length}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {workerStats.slice(0, 5).map((worker) => (
            <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm" key={worker.operator}>
              <span className="font-semibold text-slate-800">{worker.operator}</span>
              <span className="text-xs text-slate-500">扫码 {worker.scans} / 签出 {worker.ship} / 截单 {worker.intercept}</span>
            </div>
          ))}
          {workerStats.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-sm text-slate-500">今天暂无扫码作业记录</p> : null}
        </div>
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500">扫码异常队列</p>
            {statusPill(`严重 ${criticalExceptions.length}`, criticalExceptions.length > 0 ? "rose" : "emerald")}
          </div>
          <div className="mt-2 grid gap-2">
            {openExceptions.slice(0, 4).map(({ order, exception }) => (
              <div className="rounded-md border border-slate-200 bg-white p-3" key={exception.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-slate-500">{order.id} / {order.customerCode}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-950">{exception.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {outboundExceptionStatusLabels[exception.status]} / {exception.operator} / {formatDateTime(exception.createdAt)}
                    </p>
                  </div>
                  {statusPill(exception.severity === "critical" ? "严重异常" : "提醒", outboundExceptionTone(exception.severity))}
                </div>
                <OutboundExceptionActions exception={exception} orderId={order.id} />
              </div>
            ))}
            {openExceptions.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-center text-sm text-slate-500">暂无待处理扫码异常</p> : null}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">出库作业时间线</h2>
          {statusPill(`${pendingWaves.length} 个未完成波次`, pendingWaves.length > 0 ? "amber" : "emerald")}
        </div>
        <div className="mt-4 grid gap-2">
          {scanRows.slice(0, 8).map((scan) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={scan.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs font-semibold text-slate-950">{scan.orderId}</p>
                <span className="text-xs text-slate-500">{formatDateTime(scan.scannedAt)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-800">{scanActionLabels[scan.action] ?? scan.action} / {scan.skuCode || scan.code}</p>
              <p className="mt-1 text-xs text-slate-500">{scan.operator} / {scan.workMode} / {scan.customerCode}</p>
            </div>
          ))}
          {scanRows.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-sm text-slate-500">暂无出库扫码时间线</p> : null}
        </div>
      </div>
    </section>
  );
}

function DocumentReviewTable({ rows }: { rows: DocumentRecord[] }) {
  return (
    <WorkbenchTable icon={FileText} title="资料中心">
      <table className="min-w-[940px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">文件</th>
            <th className="px-4 py-3">客户 / 关联业务</th>
            <th className="px-4 py-3">类型</th>
            <th className="px-4 py-3">上传</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.slice(0, 12).map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <p className="max-w-xs truncate font-semibold text-slate-950">{row.originalName}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{row.id}</p>
                {row.note ? <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{row.note}</p> : null}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.customerCode}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{documentRefLabel(row.refType)} / {row.refId}</p>
              </td>
              <td className="px-4 py-3">{statusPill(documentCategoryLabel(row.category), row.category === "payment_proof" ? "emerald" : "cyan")}</td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.uploadedByRole === "customer" ? "客户" : "员工"} / {row.uploadedBy}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.uploadedAt)}</p>
              </td>
              <td className="px-4 py-3">
                <Link
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  href={`/api/documents/${row.id}/download`}
                >
                  <Download size={14} />
                  下载
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                暂无上传资料
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function CustomerReviewTable({ accounts, auditLogs }: { accounts: CustomerAccountView[]; auditLogs: AuditLogRecord[] }) {
  const sortedAccounts = [...accounts].sort((a, b) => {
    const statusScore = (item: CustomerAccountView) => (item.status === "unverified" ? 3 : item.status === "paused" ? 2 : 1);
    return statusScore(b) - statusScore(a) || new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
  });
  const recentLogs = auditLogs.filter((log) => log.action === "customer_status_update" || log.action === "customer_register" || log.action === "customer_profile_update").slice(0, 8);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <WorkbenchTable icon={UserCheck} title="客户认证审核">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">客户账号</th>
              <th className="px-4 py-3">公司资料</th>
              <th className="px-4 py-3">平台 / 税号</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">审核动作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedAccounts.map((account) => (
              <tr key={account.customerCode}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950">{displayText(account.companyName, "未命名客户")}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{account.customerCode}</p>
                  <p className="mt-1 text-xs text-slate-500">注册：{formatDateTime(account.createdAt)}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{displayText(account.contactName, "待完善联系人")} / {displayText(account.phone, "待完善手机")}</p>
                  <p className="mt-1 text-xs">{displayText(account.email, "未填写邮箱")}</p>
                  {account.businessAddress ? <p className="mt-1 max-w-xs truncate text-xs">{account.businessAddress}</p> : null}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{account.platforms?.length ? account.platforms.join(" / ") : "平台待完善"}</p>
                  <p className="mt-1 text-xs">VAT：{account.vatNumber || "-"} / EORI：{account.eoriNumber || "-"}</p>
                  {account.storeUrl ? <p className="mt-1 max-w-xs truncate text-xs">{account.storeUrl}</p> : null}
                </td>
                <td className="px-4 py-3">{statusPill(customerStatusLabels[account.status], customerStatusTones[account.status])}</td>
                <td className="px-4 py-3">
                  <OpsCustomerStatusWorkflow customerCode={account.customerCode} status={account.status} />
                </td>
              </tr>
            ))}
            {sortedAccounts.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                  暂无客户注册账号
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </WorkbenchTable>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#0E7490]" />
          <h2 className="text-base font-semibold text-slate-950">账号操作留痕</h2>
        </div>
        <div className="mt-4 space-y-3">
          {recentLogs.map((log) => (
            <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={log.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[11px] text-slate-500">{log.customerCode || log.targetId}</p>
                {statusPill(log.actorRole === "staff" ? "员工" : log.actorRole === "customer" ? "客户" : "系统", log.actorRole === "staff" ? "cyan" : "slate")}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-950">{log.summary}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {log.actorName} / {formatDateTime(log.createdAt)}
              </p>
              {log.note ? <p className="mt-2 text-xs leading-5 text-slate-600">{log.note}</p> : null}
            </article>
          ))}
          {recentLogs.length === 0 ? <EmptyState text="暂无账号审核记录" /> : null}
        </div>
      </div>
    </section>
  );
}

function InquiryCard({ item }: { item: InquirySubmission }) {
  const status = inquiryStatus(item);
  const segment = inquirySegment(item);
  const event = latestEvent(item);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500">{item.id}</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">{displayText(item.company, "未命名客户")}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {displayText(item.platform, "平台待确认")} / {displayText(item.volume, "货量待确认")} / {displayText(item.service, "服务待确认")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusPill(segment.label, segment.tone)}
          {statusPill(`优先级：${segment.priority}`, segment.priority === "高" ? "rose" : "slate")}
          {statusPill(status.label, status.tone)}
          {isDueFollowUp(item) ? statusPill("今日跟进", "rose") : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
        <p>联系人：{displayText(item.contact, "待确认")}</p>
        <p>电话：{item.phone || "-"}</p>
        <p>提交：{formatDateTime(item.createdAt)}</p>
        {item.nextFollowUpAt ? <p>下次跟进：{item.nextFollowUpAt}</p> : null}
        {item.quoteDraft ? <p>月度报价：{money(item.quoteDraft.monthlyFee)}</p> : null}
        {item.quoteDraft?.validUntil ? <p>有效期：{item.quoteDraft.validUntil}</p> : null}
      </div>

      {event ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">最近记录</p>
          <p className="mt-1">{event.messageInternal || event.messageCustomer}</p>
        </div>
      ) : null}
      {item.note ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">{item.note}</p> : null}
      {item.followUpNote ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">客服备注：{item.followUpNote}</p> : null}

      <OpsInquiryWorkflow
        id={item.id}
        status={item.status}
        followUpNote={item.followUpNote}
        nextFollowUpAt={item.nextFollowUpAt}
        quoteDraft={item.quoteDraft}
        suggestedFollowUpNote="先确认平台、SKU 数、首批箱数、预计到仓时间和是否需要尾程渠道，再输出报价口径。"
        suggestedQuoteNotes="报价按入库、仓储、出库、包材、尾程面单和增值服务拆分，最终费用以仓库复核和实际面单为准。"
      />
    </article>
  );
}

function InboundCard({ item }: { item: InboundSubmission }) {
  const status = inboundStatus(item);
  const event = latestEvent(item);
  const checklist = buildInboundDocumentChecklist(item);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500">{item.id}</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">{displayText(item.customer || item.contact, "未命名客户")}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {displayText(item.productName, "货品待确认")} / {displayText(item.transport, "运输方式待确认")} / 预计 {item.eta}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusPill(status.label, status.tone)}
          {statusPill(`资料 ${checklist.requiredReady}/${checklist.requiredTotal}`, checklist.missingRequired.length > 0 ? "amber" : "emerald")}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-4">
        <p>联系人：{displayText(item.contact, "待确认")}</p>
        <p>电话：{item.phone}</p>
        <p>箱数：{item.cartons}</p>
        <p>SKU：{item.skuCount}</p>
        <p>追踪号：{item.tracking || "待补充"}</p>
        <p>附件：{item.attachmentNames.length} 个</p>
        {item.appointmentAt ? <p>预约：{item.appointmentAt.replace("T", " ")}</p> : null}
        <p>提交：{formatDateTime(item.createdAt)}</p>
      </div>

      {checklist.missingRequired.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          缺少资料：{checklist.missingRequired.join("、")}
        </div>
      ) : null}
      {event ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">最近记录</p>
          <p className="mt-1">{event.messageInternal || event.messageCustomer}</p>
        </div>
      ) : null}
      {item.exceptionNote ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-900">异常说明：{item.exceptionNote}</p> : null}
      {item.opsNote ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">运营备注：{item.opsNote}</p> : null}

      <OpsInboundWorkflow
        appointmentAt={item.appointmentAt}
        exceptionNote={item.exceptionNote}
        id={item.id}
        missingRequired={checklist.missingRequired}
        opsNote={item.opsNote}
        status={item.status}
      />
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}

type OpsPageProps = {
  searchParams?: Promise<{ section?: string | string[] }>;
};

export default async function OpsPage({ searchParams }: OpsPageProps) {
  const params = await searchParams;
  const sectionParam = Array.isArray(params?.section) ? params?.section[0] : params?.section;
  const activeSection = domainNav.some((item) => item.id === sectionParam) ? sectionParam ?? "overview" : "overview";
  const activeDomain = domainNav.find((item) => item.id === activeSection) ?? domainNav[0];

  const [staff, submissions, opsData, coreData, documents, customerAccounts, auditLogs, launchReadiness, expansionData] = await Promise.all([
    requireStaffSession(),
    getSubmissions(),
    getOpsWorkbenchData(),
    getWarehouseCoreData(),
    getDocuments(),
    getCustomerAccounts(),
    getAuditLogs({ limit: 80 }),
    evaluateLaunchReadiness(),
    getOpsExpansionData(),
  ]);
  const inquiries = submissions.filter((item): item is InquirySubmission => item.type === "inquiry");
  const inbounds = submissions.filter((item): item is InboundSubmission => item.type === "inbound");

  const missingDocs = inbounds.filter((item) => buildInboundDocumentChecklist(item).missingRequired.length > 0).length;
  const missingTracking = inbounds.filter((item) => !item.tracking).length;
  const openInquiries = inquiries.filter((item) => item.status !== "closed").length;
  const hotInquiries = inquiries.filter(isHotInquiry).length;
  const inboundExceptions = inbounds.filter((item) => item.status === "exception" || item.status === "on_hold").length;
  const openInboundReceivingExceptions = openInboundReceivingExceptionRows(inbounds);
  const openLogistics = opsData.logistics.filter((item) => item.status !== "resolved").length;
  const openOutbound = opsData.outbound.filter((item) => item.status !== "shipped").length;
  const openScanExceptions = openOutboundScanExceptions(coreData.outboundOrders);
  const inventoryRisks = opsData.inventory.filter((item) => item.status !== "normal").length;
  const unverifiedCustomers = customerAccounts.filter((item) => item.status === "unverified").length;
  const staffNotifications = await getStaffNotifications({ submissions, opsData, coreData, documents });
  const todoCount = staffNotifications.length || openInquiries + missingDocs + missingTracking + openInboundReceivingExceptions.length + openLogistics + openOutbound + openScanExceptions.length + inventoryRisks + unverifiedCustomers;
  const pendingBilling = coreData.billingRecords.filter((item) => item.status === "draft" || item.status === "pending_confirmation").length;
  const lowStockBalances = coreData.inventoryBalances.filter((item) => item.availableQty < item.alertQty).length;
  const agingBalances = coreData.inventoryBalances.filter((item) => item.agingDays >= 120).length;
  const logisticsControlRows = buildLogisticsControlRows([...coreData.outboundOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()));
  const replenishmentSuggestions = buildReplenishmentSuggestions(coreData);
  const stocktakeCandidates = buildStocktakeCandidates(coreData) as StocktakeCandidate[];
  const nowLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date());

  const sortedInquiries = [...inquiries].sort((a, b) => {
    const score = (item: InquirySubmission) => (isHotInquiry(item) ? 4 : 0) + (isDueFollowUp(item) ? 3 : 0) + (item.status === "new" ? 2 : 0);
    return score(b) - score(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const ActiveDomainIcon = activeDomain.icon;

  return (
    <PageShell surface="admin">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto flex max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <aside className="hidden w-20 shrink-0 lg:block">
            <nav className="sticky top-28 grid gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm" aria-label="运营模块导航">
              {domainNav.map(({ id, label, icon: Icon }) => (
                <Link
                  aria-current={activeSection === id ? "page" : undefined}
                  className={`flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
                    activeSection === id ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  href={`/ops?section=${id}`}
                  key={id}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 space-y-5">
            <section id="overview" className="scroll-mt-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusPill("英国仓配运营后台", "cyan")}
                    {statusPill(`${staff.displayName} / ${staff.role}`, "emerald")}
                    {statusPill(`伦敦时间 ${nowLabel}`, "slate")}
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                      <ActiveDomainIcon size={13} />
                      当前模块：{activeDomain.label}
                    </span>
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">仓储物流工作台</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    询盘、入库、库存、出库、物流和账单统一进入任务调度台，先处理异常，再推进作业。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/warehouse">
                      <Warehouse size={16} />
                      仓库作业台
                    </Link>
                    <LogoutButton nextPath="/ops-login" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[430px]">
                  <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-800">异常优先</span>
                  <span className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-center text-xs font-semibold text-cyan-800">队列驱动</span>
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800">状态留痕</span>
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">费用可查</span>
                </div>
              </div>
            </section>

            <nav className="ops-mobile-domain-nav sticky top-[6.8rem] z-30 flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur lg:hidden" aria-label="运营模块导航">
              {domainNav.map(({ id, label, icon: Icon }) => (
                <Link
                  aria-current={activeSection === id ? "page" : undefined}
                  className={`flex min-h-12 min-w-[4.25rem] flex-col items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold transition ${
                    activeSection === id ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  href={`/ops?section=${id}`}
                  key={id}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </nav>

            {activeSection === "overview" ? (
              <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <MetricTile caption="待办" icon={ClipboardCheck} label="总待办" tone="cyan" value={todoCount} />
              <MetricTile caption="账号" icon={UserCheck} label="客户待认证" tone={unverifiedCustomers > 0 ? "amber" : "emerald"} value={unverifiedCustomers} />
              <MetricTile caption="线索" icon={Flame} label="高优先线索" tone="rose" value={hotInquiries} />
              <MetricTile caption="入库" icon={PackageCheck} label="入库待处理" tone="amber" value={missingDocs + missingTracking + inboundExceptions + openInboundReceivingExceptions.length} />
              <MetricTile caption="物流" icon={Truck} label="物流异常" tone="rose" value={openLogistics} />
              <MetricTile caption="扫码" icon={ScanLine} label="扫码异常" tone={openScanExceptions.length > 0 ? "rose" : "emerald"} value={openScanExceptions.length} />
            </section>

            <NotificationCenter emptyText="暂无运营待办" items={staffNotifications} title="运营待办中心" />

              <OutboundScanOperationsPanel rows={coreData.outboundOrders} />

              <LaunchReadinessPanel readiness={launchReadiness} />

              <OpsMabangModulePanel data={expansionData} module="overview" />

            <section className="grid gap-4 xl:grid-cols-4">
              <QueueColumn
                icon={PackageCheck}
                rows={[
                  { label: "待补资料", count: missingDocs, tone: missingDocs > 0 ? "amber" : "emerald" },
                  { label: "待补追踪号", count: missingTracking, tone: missingTracking > 0 ? "rose" : "emerald" },
                  { label: "预约确认", count: inbounds.filter((item) => item.status === "docs_review_passed").length, tone: "cyan" },
                  { label: "到仓验收", count: inbounds.filter((item) => ["arrived", "receiving"].includes(item.status)).length, tone: "violet" },
                  { label: "收货差异", count: openInboundReceivingExceptions.length, tone: openInboundReceivingExceptions.length > 0 ? "rose" : "emerald" },
                ]}
                title="入库"
              />
              <QueueColumn
                icon={Warehouse}
                rows={[
                  { label: "低于安全库存", count: opsData.inventory.filter((row) => row.status === "low_stock").length, tone: "rose" },
                  { label: "库龄偏高", count: opsData.inventory.filter((row) => row.status === "aging").length, tone: "amber" },
                  { label: "待预约送仓", count: opsData.inventory.filter((row) => row.status === "replenishment_pending").length, tone: "cyan" },
                  { label: "同步异常", count: opsData.inventory.filter((row) => row.status === "sync_issue").length, tone: "rose" },
                ]}
                title="库存"
              />
              <QueueColumn
                icon={Boxes}
                rows={[
                  { label: "待审核", count: opsData.outbound.filter((row) => row.status === "pending_review").length, tone: "cyan" },
                  { label: "待配货", count: opsData.outbound.filter((row) => row.status === "picking").length, tone: "amber" },
                  { label: "待获取面单", count: opsData.outbound.filter((row) => row.status === "label_pending").length, tone: "rose" },
                  { label: "包装验货", count: opsData.outbound.filter((row) => row.status === "packing_check").length, tone: "violet" },
                ]}
                title="出库"
              />
              <QueueColumn
                icon={Truck}
                rows={[
                  { label: "待处理", count: opsData.logistics.filter((row) => row.status === "open").length, tone: "rose" },
                  { label: "处理中", count: opsData.logistics.filter((row) => row.status === "investigating").length, tone: "cyan" },
                  { label: "待客户确认", count: opsData.logistics.filter((row) => row.status === "waiting_customer").length, tone: "amber" },
                  { label: "已解决", count: opsData.logistics.filter((row) => row.status === "resolved").length, tone: "emerald" },
                ]}
                title="物流"
              />
            </section>

            <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["客户档案", coreData.customers.length, "cyan" as Tone],
                ["SKU 档案", coreData.skus.length, "slate" as Tone],
                ["库存底表", coreData.inventoryBalances.length, lowStockBalances > 0 ? "amber" as Tone : "emerald" as Tone],
                ["库存流水", coreData.inventoryMovements.length, "violet" as Tone],
                ["出库订单", coreData.outboundOrders.length, "cyan" as Tone],
                ["待确认账单", pendingBilling, pendingBilling > 0 ? "amber" as Tone : "emerald" as Tone],
              ].map(([label, value, tone]) => (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" key={label}>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
                    {statusPill(String(label).includes("库存") && agingBalances > 0 ? `库龄 ${agingBalances}` : "已接入", tone as Tone)}
                  </div>
                </div>
              ))}
            </section>
              </>
            ) : null}

            {activeSection === "inquiry" ? (
            <section id="inquiry" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="Leads" title="询盘与客户" body="新客户认证、报价线索和跟进记录集中处理，运营可以先确认客户资料，再推进合作需求。" icon={FileText} />
              <CustomerReviewTable accounts={customerAccounts} auditLogs={auditLogs} />
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <FileText size={18} className="text-[#0E7490]" />
                    询盘报价处理
                  </h2>
                  {statusPill(`${openInquiries} 条未关闭`, "cyan")}
                </div>
                <div className="grid gap-4">
                  {sortedInquiries.length > 0 ? sortedInquiries.slice(0, 5).map((item) => <InquiryCard item={item} key={item.id} />) : <EmptyState text="暂无合作询盘" />}
                </div>
              </div>
            </section>
            ) : null}

            {activeSection === "inbound" ? (
            <section id="inbound" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="入库" title="入库管理" body="入库预报、资料补齐、追踪号、预约到仓和验收异常统一在这里处理。" icon={PackageCheck} />
              <OpsMabangModulePanel data={expansionData} module="inbound" />
              <InboundQueueTable inbounds={inbounds} />
              <InboundReceivingExceptionPanel inbounds={inbounds} />
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <AlertTriangle size={18} className="text-amber-700" />
                    入库审核处理
                  </h2>
                  {statusPill(`${inbounds.length} 条 ASN`, "amber")}
                </div>
                <div className="grid gap-4">
                  {inbounds.length > 0 ? inbounds.slice(0, 5).map((item) => <InboundCard item={item} key={item.id} />) : <EmptyState text="暂无入库预报" />}
                </div>
              </div>
            </section>
            ) : null}

            {activeSection === "inventory" ? (
            <section id="inventory" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="库存" title="库存与库内作业" body="库位库存、安全库存、补货调拨、盘点和库存调整集中管理，方便仓库按异常优先级处理。" icon={Warehouse} />
              <OpsMabangModulePanel data={expansionData} module="inventory" />
              <OpsReplenishmentPlanner plans={coreData.replenishmentPlans} suggestions={replenishmentSuggestions} transferOrders={coreData.transferOrders} />
              <OpsTransferLifecyclePanel rows={[...coreData.transferOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
              <OpsStocktakePanel batches={coreData.stocktakeBatches} candidates={stocktakeCandidates} />
              <InventoryTable rows={opsData.inventory} />
              <CoreInventoryTable
                adjustments={[...coreData.inventoryAdjustments].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())}
                balances={coreData.inventoryBalances}
                canReviewAdjustments={canReviewInventoryAdjustment(staff.role)}
                locations={coreData.locations}
                lots={coreData.inventoryLots}
                movements={[...coreData.inventoryMovements].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())}
              />
            </section>
            ) : null}

            {activeSection === "outbound" ? (
            <section id="outbound" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="出库" title="出库作业" body="出库审核、批量拣货、面单打印、交运和退货入库按作业链路分组，避免订单散落在不同页面。" icon={Boxes} />
              <OpsMabangModulePanel data={expansionData} module="outbound" />
              <OutboundScanOperationsPanel rows={coreData.outboundOrders} />
              <OutboundTable rows={opsData.outbound} />
              <OpsOutboundBatchPanel rows={coreData.outboundOrders.map(({ id, customerCode, channel, orderCount, status }) => ({ id, customerCode, channel, orderCount, status }))} />
              <CoreOutboundRequestsTable rows={[...coreData.outboundOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
              <ReturnOrdersTable rows={[...coreData.returnOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
            </section>
            ) : null}

            {activeSection === "logistics" ? (
            <section id="logistics" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="Logistics" title="物流与承运商" body="物流异常、承运商匹配、运费估算和追踪回传集中处理，便于运营持续闭环。" icon={Truck} />
              <OpsMabangModulePanel data={expansionData} module="logistics" />
              <LogisticsTable rows={opsData.logistics} />
              <OpsLogisticsControlPanel rows={logisticsControlRows} />
            </section>
            ) : null}

            {activeSection === "billing" ? (
            <section id="billing" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="Billing" title="账单与资料审核" body="客户账单、费用生成、账单复核和资料审核放在同一组，方便财务和运营协作确认。" icon={ReceiptText} />
              <OpsMabangModulePanel data={expansionData} module="billing" />
              <BillingStatementPanel customers={coreData.customers} rows={coreData.billingRecords} />
              <OpsBillingGenerator customers={coreData.customers} inboundSubmissions={inbounds} outboundOrders={coreData.outboundOrders} returnOrders={coreData.returnOrders} />
              <BillingReviewTable rows={[...coreData.billingRecords].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
              <DocumentReviewTable rows={[...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())} />
            </section>
            ) : null}

            {activeSection === "overview" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <Search size={18} className="text-[#0E7490]" />
                MVP 完成路径
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  ["已完成", "内部工作台、询盘报价、入库审核、物流/库存/出库状态更新。"],
                  ["下一步", "客户门户同步展示订单、库存、物流异常和费用确认。"],
                  ["上线前", "补权限、导入导出、真实面单渠道和账单复核。"],
                ].map(([phase, text]) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={phase}>
                    <p className="text-xs font-semibold text-slate-500">{phase}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
                  </div>
                ))}
              </div>
            </section>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
