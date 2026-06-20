import type { ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  Cable,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Flame,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  RadioTower,
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
import { documentCategoryLabel, documentRefLabel, documentScanStatusLabel, documentStorageProviderLabel, getDocuments, signDocumentToken, type DocumentRecord } from "@/lib/documentStore";
import { getNotificationDeliveries, getNotificationProviderHealth, getStaffNotifications } from "@/lib/notificationStore";
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
import { OpsCarrierHealthPanel } from "../components/OpsCarrierHealthPanel";
import { OpsReplenishmentPlanner } from "../components/OpsReplenishmentPlanner";
import { OpsSlaReportPanel } from "../components/OpsSlaReportPanel";
import { OpsSlaEscalationPanel } from "../components/OpsSlaEscalationPanel";
import { OpsCustomerSelfServicePanel } from "../components/OpsCustomerSelfServicePanel";
import { OpsReportCenterPanel } from "../components/OpsReportCenterPanel";
import { OpsStocktakePanel, type StocktakeCandidate } from "../components/OpsStocktakePanel";
import { OpsTransferLifecyclePanel } from "../components/OpsTransferLifecyclePanel";
import { OpsBillingWorkflow } from "../components/OpsBillingWorkflow";
import { OpsBillingGenerator } from "../components/OpsBillingGenerator";
import { OpsBillingStatementLockPanel } from "../components/OpsBillingStatementLockPanel";
import { OpsBillingDisputePanel } from "../components/OpsBillingDisputePanel";
import { OpsFinanceControlPanel } from "../components/OpsFinanceControlPanel";
import { OpsCoreOutboundWorkflow } from "../components/OpsCoreOutboundWorkflow";
import { OpsInvoiceWorkflow } from "../components/OpsInvoiceWorkflow";
import { OpsOutboundBatchPanel } from "../components/OpsOutboundBatchPanel";
import { OpsPlatformSyncHealthPanel } from "../components/OpsPlatformSyncHealthPanel";
import { OpsShipmentPanel } from "../components/OpsShipmentPanel";
import { OpsInventoryAdjustmentForm } from "../components/OpsInventoryAdjustmentForm";
import { OpsInventoryLotPanel } from "../components/OpsInventoryLotPanel";
import { OpsWmsRuleCompliancePanel } from "../components/OpsWmsRuleCompliancePanel";
import { OpsMabangModulePanel } from "../components/OpsMabangModulePanel";
import { OpsAuditLogPanel } from "../components/OpsAuditLogPanel";
import { OpsBackupRestorePanel } from "../components/OpsBackupRestorePanel";
import { OpsSystemLogPanel } from "../components/OpsSystemLogPanel";
import { OpsLaunchGuardPanel } from "../components/OpsLaunchGuardPanel";
import { OpsApiIntegrationLedgerPanel } from "../components/OpsApiIntegrationLedgerPanel";
import { OpsReturnWorkflow } from "../components/OpsReturnWorkflow";
import { OpsReturnTrackingUploadButton } from "../components/OpsReturnTrackingUploadButton";
import { IntegrationProbeButton } from "../components/IntegrationProbeButton";
import { StaffPasswordChangeForm } from "../components/StaffPasswordChangeForm";
import { DocumentUploadPanel } from "../components/DocumentUploadPanel";
import { OpsDocumentSecurityHealthPanel } from "../components/OpsDocumentSecurityHealthPanel";
import { DocumentSecurityActions } from "../components/DocumentSecurityActions";
import { WarehouseInventoryMovePanel } from "../components/WarehouseInventoryMovePanel";
import { PageShell } from "../components/MarketingShell";
import { NotificationCenter } from "../components/NotificationCenter";
import { InboundExceptionActions } from "../components/InboundExceptionActions";
import { LogoutButton } from "../components/LogoutButton";
import { OutboundExceptionActions } from "../components/OutboundExceptionActions";
import { OpsCustomerStatusWorkflow } from "../components/OpsCustomerStatusWorkflow";
import { SystemAlertActions } from "../components/SystemAlertActions";
import { getAutomationRuns } from "@/lib/automationRunStore";
import { getAuditLogs, type AuditLogRecord } from "@/lib/auditLogStore";
import { billingMonthLabel, summarizeBillingMonths } from "@/lib/billingUtils";
import { getCustomerAccounts, type CustomerAccountStatus, type CustomerAccountView } from "@/lib/customerAccountStore";
import { evaluateLaunchReadiness, type LaunchCheckStatus, type LaunchReadiness } from "@/lib/launchReadiness";
import { canReviewInventoryAdjustment, getStaffWhitelistView, requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getManagedStaffAccounts } from "@/lib/staffAccountStore";
import { getSlaNotificationRules } from "@/lib/slaRuleStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getLatestIntegrationProbeMap, type IntegrationProbeRecord, type IntegrationProbeStatus } from "@/lib/integrationProbeStore";
import { evaluateOpsSystemHealth, type OpsSystemHealth, type OpsSystemHealthStatus } from "@/lib/opsSystemHealth";
import { evaluateProductionIntegrationReadiness, type IntegrationReadinessStatus, type ProductionIntegrationReadiness } from "@/lib/productionIntegrationReadiness";
import { buildCustomerSelfServiceOpsReport } from "@/lib/customerSelfServiceOpsReport";
import { buildReportCenterData } from "@/lib/reportCenter";
import { getSystemAlerts, type SystemAlert, type SystemAlertSeverity } from "@/lib/systemAlertStore";
import { billingInvoiceStatusLabel, billingStatusLabel, buildReplenishmentSuggestions, buildStocktakeCandidates, getLocationUtilization, getWarehouseCoreData, outboundWorkModeLabel, returnOrderStatusLabel, returnResolutionLabel, suggestCarrierServiceForOutbound, warehouseLocationStatusLabel, warehouseLocationZoneTypeLabel, type BillingRecord, type CoreOutboundOrder, type CustomerProfile, type InventoryAdjustmentRequest, type InventoryBalance, type InventoryLot, type InventoryMovement, type ReturnOrder, type WarehouseLocation } from "@/lib/warehouseCoreStore";
import { getWebhookEvents, type WebhookEventRecord, type WebhookEventStatus } from "@/lib/webhookEventStore";

export const dynamic = "force-dynamic";

function signedDocumentDownloadHref(id: string) {
  const token = signDocumentToken(id, Date.now() + 30 * 60 * 1000);
  return `/api/documents/${encodeURIComponent(id)}/download?token=${encodeURIComponent(token)}`;
}

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
  { id: "permissions", label: "审计", icon: ShieldCheck },
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

function documentScanTone(status?: DocumentRecord["scanStatus"]): Tone {
  if (status === "blocked") return "rose";
  if (status === "clean") return "emerald";
  return "amber";
}

function DocumentQuickLinks({ documents, emptyText = "暂无资料" }: { documents: DocumentRecord[]; emptyText?: string }) {
  if (documents.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {documents.slice(0, 3).map((document) => (
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between" key={document.id}>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{document.originalName}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {documentCategoryLabel(document.category)} / {documentScanStatusLabel(document.scanStatus)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {document.previewAllowed && document.scanStatus === "clean" ? (
              <Link className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/api/documents/${encodeURIComponent(document.id)}/preview`} target="_blank">
                <Eye size={13} />
                预览
              </Link>
            ) : null}
            {document.scanStatus === "clean" ? (
              <Link className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href={signedDocumentDownloadHref(document.id)}>
                <Download size={13} />
                下载
              </Link>
            ) : null}
          </div>
        </div>
      ))}
      {documents.length > 3 ? <p className="text-xs font-semibold text-slate-500">还有 {documents.length - 3} 个资料，可在资料中心继续查看。</p> : null}
    </div>
  );
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

function OpsExceptionCenterPanel({
  inbounds,
  outbounds,
  returns,
  balances,
  billingRecords,
  nowMs,
}: {
  inbounds: InboundSubmission[];
  outbounds: CoreOutboundOrder[];
  returns: ReturnOrder[];
  balances: InventoryBalance[];
  billingRecords: BillingRecord[];
  nowMs: number;
}) {
  const rows = [
    ...openInboundReceivingExceptionRows(inbounds).map(({ task, exception }) => ({
      key: exception.id,
      module: "入库",
      sourceId: task.id,
      customerCode: task.customerCode || task.customer || "",
      title: exception.message,
      status: exception.status === "open" ? "待处理" : exception.status === "investigating" ? "处理中" : "已处理",
      tone: exception.severity === "critical" ? "rose" as Tone : "amber" as Tone,
      nextAction: "核对实收、照片和客户资料",
      occurredAt: exception.createdAt,
    })),
    ...inbounds
      .filter((item) => item.exceptionNote && ["exception", "on_hold"].includes(item.status))
      .map((item) => ({
        key: `${item.id}-status`,
        module: "入库",
        sourceId: item.id,
        customerCode: item.customerCode || item.customer || "",
        title: item.exceptionNote || "入库状态异常",
        status: item.status === "on_hold" ? "暂缓处理" : "异常处理中",
        tone: "amber" as Tone,
        nextAction: "确认资料、预约或差异处理方案",
        occurredAt: item.updatedAt ?? item.createdAt,
      })),
    ...outbounds.flatMap((order) =>
      (order.exceptions ?? [])
        .filter((exception) => exception.status === "open" || exception.status === "investigating")
        .map((exception) => ({
          key: exception.id,
          module: exception.deliveryExceptionType ? "物流" : "出库",
          sourceId: order.id,
          customerCode: order.customerCode,
          title: exception.message,
          status: exception.status === "open" ? "待处理" : "处理中",
          tone: exception.severity === "critical" ? "rose" as Tone : "amber" as Tone,
          nextAction: exception.redeliveryRequired ? "等待改派确认" : exception.claimStatus && exception.claimStatus !== "not_required" ? "跟进赔付" : "继续处理异常",
          occurredAt: exception.createdAt,
        })),
    ),
    ...returns
      .filter((item) => item.status === "exception" || (["received", "inspection", "repair"].includes(item.status) && !item.customerResolutionDecision))
      .map((item) => ({
        key: `${item.id}-${item.status}`,
        module: "退货/RMA",
        sourceId: item.id,
        customerCode: item.customerCode,
        title: item.inspectionResult || item.returnReason,
        status: item.status === "exception" ? "异常" : "客户待确认",
        tone: item.status === "exception" ? "rose" as Tone : "amber" as Tone,
        nextAction: "确认重新上架、维修、报废或转寄",
        occurredAt: item.updatedAt ?? item.createdAt,
      })),
    ...balances
      .filter((item) => item.availableQty < item.alertQty || item.frozenQty > 0 || item.defectiveQty > 0 || item.agingDays >= 120)
      .map((item) => ({
        key: `${item.customerCode}-${item.skuCode}-${item.locationCode || item.warehouseCode}`,
        module: "库存",
        sourceId: item.skuCode,
        customerCode: item.customerCode,
        title: [item.availableQty < item.alertQty ? "低于预警库存" : "", item.frozenQty > 0 ? `冻结 ${item.frozenQty}` : "", item.defectiveQty > 0 ? `残次品 ${item.defectiveQty}` : "", item.agingDays >= 120 ? `库龄 ${item.agingDays} 天` : ""].filter(Boolean).join("；"),
        status: "待处理",
        tone: item.availableQty < 0 || item.agingDays >= 365 ? "rose" as Tone : "amber" as Tone,
        nextAction: "补货、移库、盘点或残次处理",
        occurredAt: item.updatedAt,
      })),
    ...billingRecords
      .filter((item) => item.dueDate && new Date(item.dueDate).getTime() < nowMs && item.status !== "paid")
      .map((item) => ({
        key: `${item.id}-overdue`,
        module: "费用/账单",
        sourceId: item.id,
        customerCode: item.customerCode,
        title: `账单逾期 £${item.amount.toFixed(2)}`,
        status: "逾期",
        tone: "rose" as Tone,
        nextAction: "确认付款、争议或核销",
        occurredAt: item.updatedAt ?? item.createdAt,
      })),
  ].sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime());

  const criticalCount = rows.filter((row) => row.tone === "rose").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <AlertTriangle size={18} className="text-rose-700" />
            异常中心
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">入库、出库、物流、退货、库存和账单风险集中查看，先处理严重异常。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusPill(`${rows.length} 条异常`, rows.length > 0 ? "amber" : "emerald")}
          {statusPill(`${criticalCount} 条严重`, criticalCount > 0 ? "rose" : "emerald")}
          <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/exceptions">
            导出异常中心
          </Link>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.slice(0, 8).map((row) => (
          <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto]" key={row.key}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {statusPill(row.module, row.tone)}
                <span className="font-mono text-xs font-semibold text-slate-500">{row.sourceId}</span>
                <span className="text-xs text-slate-500">{row.customerCode || "未绑定客户"}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-950">{row.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">下一步：{row.nextAction}</p>
            </div>
            <div className="text-left md:text-right">
              {statusPill(row.status, row.tone)}
              <p className="mt-2 text-xs text-slate-400">{row.occurredAt ? formatDateTime(row.occurredAt) : "-"}</p>
            </div>
          </div>
        ))}
        {rows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-500">暂无跨模块异常</div> : null}
      </div>
    </section>
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

const integrationStatusTone: Record<IntegrationReadinessStatus, Tone> = {
  ready: "emerald",
  partial: "amber",
  blocked: "rose",
};

const integrationStatusLabel: Record<IntegrationReadinessStatus, string> = {
  ready: "可上线",
  partial: "待补齐",
  blocked: "阻塞",
};

const integrationProbeTone: Record<IntegrationProbeStatus, Tone> = {
  passed: "emerald",
  failed: "rose",
  blocked: "amber",
};

const integrationProbeLabel: Record<IntegrationProbeStatus, string> = {
  passed: "探测通过",
  failed: "探测失败",
  blocked: "无法探测",
};

const opsSystemHealthTone: Record<OpsSystemHealthStatus, Tone> = {
  healthy: "emerald",
  degraded: "amber",
  critical: "rose",
};

const opsSystemHealthLabel: Record<OpsSystemHealthStatus, string> = {
  healthy: "健康",
  degraded: "需关注",
  critical: "严重",
};

const systemAlertTone: Record<SystemAlertSeverity, Tone> = {
  critical: "rose",
  warning: "amber",
  info: "slate",
};

const systemAlertLabel: Record<SystemAlertSeverity, string> = {
  critical: "严重",
  warning: "提醒",
  info: "信息",
};

const systemAlertHandlingLabel: Record<SystemAlert["handlingStatus"], string> = {
  open: "待处理",
  acknowledged: "已确认",
  snoozed: "已搁置",
  resolved: "已关闭",
};

function systemAlertHandlingTone(status: SystemAlert["handlingStatus"]): Tone {
  if (status === "acknowledged") return "cyan";
  if (status === "snoozed") return "amber";
  if (status === "resolved") return "emerald";
  return "slate";
}

function SystemAlertPanel({ alerts }: { alerts: SystemAlert[] }) {
  const critical = alerts.filter((item) => item.severity === "critical").length;
  const warning = alerts.filter((item) => item.severity === "warning").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <AlertTriangle size={18} className="text-[#0E7490]" />
            系统告警中心
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">集中查看上线体检、任务队列、平台同步、面单回传、账单争议、库位容量和文件安全异常。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/system/logs?format=csv&limit=500">
            <Download size={14} />
            导出生产日志
          </Link>
          {statusPill(`严重 ${critical}`, critical > 0 ? "rose" : "emerald")}
          {statusPill(`提醒 ${warning}`, warning > 0 ? "amber" : "emerald")}
        </div>
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {alerts.length > 0 ? (
          alerts.slice(0, 8).map((alert) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={alert.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-950">{alert.title}</p>
                <div className="flex flex-wrap gap-2">
                  {statusPill(`${systemAlertLabel[alert.severity]} / ${alert.source}`, systemAlertTone[alert.severity])}
                  {statusPill(systemAlertHandlingLabel[alert.handlingStatus], systemAlertHandlingTone(alert.handlingStatus))}
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{alert.detail}</p>
              {alert.handlingNote ? <p className="mt-2 rounded-md bg-white p-2 text-xs leading-5 text-slate-500">处理备注：{alert.handlingNote}</p> : null}
              {alert.snoozedUntil ? <p className="mt-1 text-xs font-semibold text-amber-700">搁置到：{new Date(alert.snoozedUntil).toLocaleString("zh-CN", { hour12: false })}</p> : null}
              {alert.actionHref ? (
                <Link className="mt-2 inline-flex text-xs font-semibold text-cyan-800 hover:text-cyan-950" href={alert.actionHref}>
                  去处理
                </Link>
              ) : null}
              <SystemAlertActions alert={alert} />
            </div>
          ))
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">当前没有系统级告警。</div>
        )}
      </div>
    </section>
  );
}

function OpsSystemHealthPanel({ health }: { health: OpsSystemHealth }) {
  const priorityChecks = [...health.checks].sort((a, b) => {
    const rank: Record<OpsSystemHealthStatus, number> = { critical: 0, degraded: 1, healthy: 2 };
    return rank[a.status] - rank[b.status] || a.label.localeCompare(b.label);
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <ShieldCheck size={18} className="text-[#0E7490]" />
              生产健康检查
            </h2>
            {statusPill(opsSystemHealthLabel[health.status], opsSystemHealthTone[health.status])}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            汇总数据库、外部集成、文件安全、任务队列、员工账号、审计日志和系统告警，适合发版前或每天开工前巡检。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/system/health?format=csv">
            <Download size={14} />
            导出健康检查
          </Link>
          {statusPill(`评分 ${health.score}`, opsSystemHealthTone[health.status])}
          {statusPill(`严重 ${health.summary.critical}`, health.summary.critical > 0 ? "rose" : "emerald")}
          {statusPill(`关注 ${health.summary.degraded}`, health.summary.degraded > 0 ? "amber" : "emerald")}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["客户", health.metrics.customers],
          ["出库单", health.metrics.outboundOrders],
          ["开放告警", health.metrics.openAlerts],
          ["生产错误", health.metrics.openProductionErrors],
          ["集成风险", health.metrics.failedIntegrationProbes],
        ].map(([label, value]) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={label}>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {priorityChecks.slice(0, 6).map((check) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={check.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">{check.label}</p>
              {statusPill(`${check.owner} / ${opsSystemHealthLabel[check.status]}`, opsSystemHealthTone[check.status])}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
            {check.actionHref ? (
              <Link className="mt-2 inline-flex text-xs font-semibold text-cyan-800 hover:text-cyan-950" href={check.actionHref}>
                去处理
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

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
        <div className="flex flex-col gap-3 sm:min-w-[330px]">
          <Link className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/launch-readiness?format=csv">
            <Download size={14} />
            导出体检表
          </Link>
          <div className="grid grid-cols-3 gap-2 text-center">
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
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">库位</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{readiness.metrics.locations}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">渠道</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{readiness.metrics.activeLogisticsChannels}</p>
          </div>
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

const integrationGroupLabel: Record<ProductionIntegrationReadiness["items"][number]["group"], string> = {
  carrier: "承运商 API",
  platform: "平台订单 API",
  storage: "文件存储",
  notification: "消息通知",
  reporting: "报表投递",
  security: "安全运维",
};

function ProductionIntegrationPanel({ readiness, probeMap }: { readiness: ProductionIntegrationReadiness; probeMap: Map<string, IntegrationProbeRecord> }) {
  const priorityItems = [...readiness.items].sort((a, b) => {
    const rank: Record<IntegrationReadinessStatus, number> = { blocked: 0, partial: 1, ready: 2 };
    return rank[a.status] - rank[b.status] || a.group.localeCompare(b.group);
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Cable size={18} className="text-[#0E7490]" />
              生产集成配置向导
            </h2>
            {statusPill(integrationStatusLabel[readiness.status], integrationStatusTone[readiness.status])}
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            把承运商、平台、对象存储、外部通知、定时报表和安全密钥拆成可检查项。页面只展示变量名和是否已配置，不展示密钥内容。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/integrations/readiness?format=csv">
              <Download size={14} />
              导出配置清单
            </Link>
            <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/integrations/readiness" target="_blank">
              查看 JSON
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[360px]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">评分</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{readiness.score}</p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-700">可上线</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900">{readiness.summary.ready}</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">待补齐</p>
            <p className="mt-1 text-lg font-semibold text-amber-900">{readiness.summary.partial}</p>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold text-rose-700">阻塞</p>
            <p className="mt-1 text-lg font-semibold text-rose-900">{readiness.summary.blocked}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {priorityItems.slice(0, 10).map((item) => {
          const missingEnv = item.env.filter((env) => !env.present);
          const latestProbe = probeMap.get(item.id);
          return (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{integrationGroupLabel[item.group]}</span>
                  {item.mode ? <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{item.mode}</span> : null}
                  <p className="font-semibold text-slate-950">{item.name}</p>
                </div>
                {statusPill(integrationStatusLabel[item.status], integrationStatusTone[item.status])}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
              {missingEnv.length > 0 ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-white p-2">
                  <p className="text-xs font-semibold text-amber-900">待配置变量</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingEnv.slice(0, 6).map((env) => (
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600" key={`${item.id}-${env.name}`}>
                        {env.name || "无变量"}{env.required ? "" : "（建议）"}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-slate-500">最近联调</p>
                      {latestProbe ? statusPill(integrationProbeLabel[latestProbe.status], integrationProbeTone[latestProbe.status]) : statusPill("未探测", "slate")}
                    </div>
                    {latestProbe ? (
                      <>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{latestProbe.message}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(latestProbe.finishedAt).toLocaleString("zh-CN", { hour12: false })} / {latestProbe.checkedBy}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs leading-5 text-slate-500">配置补齐后可执行 dry-run 探测，结果会留痕并写入审计。</p>
                    )}
                  </div>
                  <IntegrationProbeButton itemId={item.id} disabled={item.id.endsWith(":none")} />
                </div>
              </div>
              {item.nextActions.length > 0 ? <p className="mt-2 text-xs leading-5 text-slate-500">下一步：{item.nextActions.slice(0, 3).join("；")}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
const webhookEventStatusTone: Record<WebhookEventStatus, Tone> = {
  processing: "amber",
  processed: "emerald",
  ignored: "slate",
  failed: "rose",
};

const webhookEventStatusLabel: Record<WebhookEventStatus, string> = {
  processing: "处理中",
  processed: "已处理",
  ignored: "已忽略",
  failed: "失败",
};

function WebhookEventPanel({ events }: { events: WebhookEventRecord[] }) {
  const counts = {
    processed: events.filter((event) => event.status === "processed").length,
    failed: events.filter((event) => event.status === "failed").length,
    ignored: events.filter((event) => event.status === "ignored").length,
    processing: events.filter((event) => event.status === "processing").length,
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <RadioTower size={18} className="text-[#0E7490]" />
            Webhook 回调台账
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            记录承运商轨迹/POD 回传和平台取消订单回传的幂等处理结果，避免重复回调造成重复截单、重复异常或重复轨迹。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusPill(`已处理 ${counts.processed}`, counts.processed > 0 ? "emerald" : "slate")}
          {statusPill(`失败 ${counts.failed}`, counts.failed > 0 ? "rose" : "emerald")}
          {statusPill(`处理中 ${counts.processing}`, counts.processing > 0 ? "amber" : "slate")}
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {events.length > 0 ? (
          events.slice(0, 8).map((event) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={event.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {statusPill(event.kind === "carrier" ? "承运商" : "平台", event.kind === "carrier" ? "cyan" : "violet")}
                  {statusPill(webhookEventStatusLabel[event.status], webhookEventStatusTone[event.status])}
                </div>
                <span className="text-xs text-slate-400">{new Date(event.updatedAt).toLocaleString("zh-CN", { hour12: false })}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-950">{event.provider} / {event.targetId || "未匹配目标"}</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">{event.eventId}</p>
              {event.summary ? <p className="mt-2 text-xs leading-5 text-slate-600">{event.summary}</p> : null}
              {event.error ? <p className="mt-2 rounded-md border border-rose-200 bg-white p-2 text-xs font-semibold text-rose-700">{event.error}</p> : null}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 lg:col-span-2">
            暂无承运商或平台 webhook 回调记录。
          </div>
        )}
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

function CoreInventoryTable({ balances, lots, movements, adjustments, locations, documents, canReviewAdjustments }: { balances: InventoryBalance[]; lots: InventoryLot[]; movements: InventoryMovement[]; adjustments: InventoryAdjustmentRequest[]; locations: WarehouseLocation[]; documents: DocumentRecord[]; canReviewAdjustments: boolean }) {
  const frozenTotal = balances.reduce((sum, item) => sum + (item.frozenQty ?? 0), 0);
  const defectiveTotal = balances.reduce((sum, item) => sum + (item.defectiveQty ?? 0), 0);
  const reservedTotal = balances.reduce((sum, item) => sum + item.reservedQty, 0);
  const controlledSkuCount = balances.filter((item) => (item.frozenQty ?? 0) > 0 || (item.defectiveQty ?? 0) > 0).length;

  return (
    <section className="grid gap-4">
      <OpsInventoryAdjustmentForm adjustments={adjustments} balances={balances} canReview={canReviewAdjustments} documents={documents} />
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

function LocationUtilizationPanel({ balances, locations }: { balances: InventoryBalance[]; locations: WarehouseLocation[] }) {
  const data = { inventoryBalances: balances, locations };
  const rows = locations
    .map((location) => {
      const utilization = getLocationUtilization(data, location.locationCode);
      const occupancyRate = utilization.occupancyRate ?? 0;
      const risks = [
        location.status !== "active" ? warehouseLocationStatusLabel(location.status) : "",
        typeof location.capacityQty !== "number" || location.capacityQty <= 0 ? "未设容量" : "",
        typeof location.capacityQty === "number" && location.capacityQty > 0 && utilization.usedQty > location.capacityQty ? "已超容量" : "",
        occupancyRate >= 0.9 && utilization.usedQty <= (location.capacityQty ?? Number.POSITIVE_INFINITY) ? "接近满仓" : "",
        location.allowMixedSku === false && utilization.skuCount > 1 ? "混 SKU 风险" : "",
        location.status === "active" && utilization.usedQty === 0 ? "空库位" : "",
      ].filter(Boolean);
      const tone: Tone = risks.some((risk) => ["已超容量", "混 SKU 风险", "停用"].includes(risk)) ? "rose" : risks.length ? "amber" : "emerald";
      return { location, utilization, occupancyRate, risks: risks.length ? risks : ["正常"], tone };
    })
    .sort((a, b) => b.occupancyRate - a.occupancyRate || b.utilization.usedQty - a.utilization.usedQty);
  const fullCount = rows.filter((row) => row.risks.includes("接近满仓") || row.risks.includes("已超容量")).length;
  const emptyCount = rows.filter((row) => row.risks.includes("空库位")).length;
  const noCapacityCount = rows.filter((row) => row.risks.includes("未设容量")).length;
  const mixedRiskCount = rows.filter((row) => row.risks.includes("混 SKU 风险")).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Warehouse size={18} className="text-cyan-700" />
            库位利用率
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">按库位查看容量、占用、空位和混放风险，适合做移库、补货和盘点前检查。</p>
        </div>
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/locations">
          <Download size={14} />
          导出报表
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["接近满仓", fullCount, "amber" as Tone],
          ["空库位", emptyCount, "cyan" as Tone],
          ["未设容量", noCapacityCount, "rose" as Tone],
          ["混放风险", mixedRiskCount, "rose" as Tone],
        ].map(([label, value, tone]) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={label}>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${toneClasses[tone as Tone].text}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {rows.slice(0, 8).map(({ location, utilization, occupancyRate, risks, tone }) => (
          <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm lg:grid-cols-[1.1fr_1fr_1fr_auto]" key={location.locationCode}>
            <div>
              <p className="font-mono text-xs font-semibold text-slate-950">{location.locationCode}</p>
              <p className="mt-1 text-xs text-slate-500">{location.zone} / {warehouseLocationZoneTypeLabel(location.zoneType)}</p>
            </div>
            <div className="text-slate-600">
              <p>已占用 {utilization.usedQty}{typeof utilization.capacityQty === "number" ? ` / ${utilization.capacityQty} 件` : " 件"}</p>
              <p className="mt-1 text-xs text-slate-500">SKU {utilization.skuCount} 个，剩余 {utilization.remainingQty ?? "-"} 件</p>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${occupancyRate >= 1 ? "bg-rose-500" : occupancyRate >= 0.9 ? "bg-amber-500" : "bg-cyan-500"}`} style={{ width: `${Math.min(100, Math.round(occupancyRate * 100))}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">利用率 {typeof utilization.occupancyRate === "number" ? `${Math.round(utilization.occupancyRate * 1000) / 10}%` : "未配置容量"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {risks.map((risk) => (
                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone].pill}`} key={risk}>{risk}</span>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 ? <EmptyState text="暂无库位数据。可先到仓库工作台维护库区、货架和库位容量。" /> : null}
      </div>
    </div>
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

function billingOverdueDays(row: BillingRecord) {
  if (!row.dueDate || row.status === "paid") return 0;
  const dueMs = new Date(row.dueDate).getTime();
  if (!Number.isFinite(dueMs)) return 0;
  return Math.max(0, Math.ceil((Date.now() - dueMs) / (24 * 60 * 60 * 1000)));
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
                {billingOverdueDays(row) > 0 ? <p className="mt-1 text-xs font-semibold text-rose-700">逾期 {billingOverdueDays(row)} 天</p> : null}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.customerMessage ? <p className="max-w-xs leading-6">{row.customerMessage}</p> : <p className="text-slate-400">暂无说明</p>}
                {row.paymentReference ? <p className="mt-2 font-mono text-xs font-semibold text-cyan-800">付款参考 {row.paymentReference}</p> : null}
                {row.paymentNote ? <p className="mt-1 text-xs leading-5 text-slate-500">{row.paymentNote}</p> : null}
                {row.paymentRejectionNote ? <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-900">付款驳回：{row.paymentRejectionNote}</p> : null}
              </td>
              <td className="px-4 py-3">
                <OpsBillingWorkflow id={row.id} paymentReference={row.paymentReference} reviewNote={row.reviewNote} status={row.status} />
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

function ReturnOrdersTable({ rows, documents, activeFilter = "all", keyword = "" }: { rows: ReturnOrder[]; documents: DocumentRecord[]; activeFilter?: string; keyword?: string }) {
  const query = keyword.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    if (activeFilter === "missing-tracking") return !row.buyerReturnTracking && !["closed", "disposed", "restocked"].includes(row.status);
    if (activeFilter === "awaiting") return ["requested", "label_sent", "in_transit"].includes(row.status);
    if (activeFilter === "inspection") return row.status === "received" || row.status === "inspection";
    if (activeFilter === "needs-decision") return ["received", "inspection", "repair", "exception"].includes(row.status) && !row.customerResolutionDecision;
    if (activeFilter === "confirmed") return Boolean(row.customerResolutionDecision);
    if (activeFilter === "open") return !["closed", "disposed", "restocked"].includes(row.status);
    return true;
  }).filter((row) => {
    if (!query) return true;
    return [row.id, row.customerCode, row.platform, row.originalOrderNo, row.buyerReturnTracking, row.returnReason, ...row.skuLines.map((line) => line.skuCode)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const printableIds = rows
    .filter((row) => !["closed", "disposed", "restocked"].includes(row.status))
    .slice(0, 50)
    .map((row) => encodeURIComponent(row.id))
    .join(",");
  const exportParams = new URLSearchParams();
  if (activeFilter !== "all") exportParams.set("returnStatus", activeFilter);
  if (keyword.trim()) exportParams.set("returnQuery", keyword.trim());
  const returnsExportHref = `/api/ops/reports/returns${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;
  const summaryItems = [
    { label: "未补追踪", filter: "missing-tracking", value: rows.filter((row) => !row.buyerReturnTracking && !["closed", "disposed", "restocked"].includes(row.status)).length, tone: "amber" as Tone },
    { label: "待到仓", filter: "awaiting", value: rows.filter((row) => ["requested", "label_sent", "in_transit"].includes(row.status)).length, tone: "cyan" as Tone },
    { label: "质检中", filter: "inspection", value: rows.filter((row) => row.status === "received" || row.status === "inspection").length, tone: "violet" as Tone },
    { label: "客户待确认", filter: "needs-decision", value: rows.filter((row) => ["received", "inspection", "repair", "exception"].includes(row.status) && !row.customerResolutionDecision).length, tone: "rose" as Tone },
    { label: "客户已确认", filter: "confirmed", value: rows.filter((row) => row.customerResolutionDecision).length, tone: "emerald" as Tone },
    { label: "待结束", filter: "open", value: rows.filter((row) => !["closed", "disposed", "restocked"].includes(row.status)).length, tone: "slate" as Tone },
  ];

  return (
    <WorkbenchTable icon={RotateCcw} title="退货 / RMA 处理">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">到仓、质检和客户确认后的退货处理集中在这里。</p>
        <div className="flex flex-wrap gap-2">
          <OpsReturnTrackingUploadButton />
          <Link className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={returnsExportHref}>
            <Download size={14} />
            导出当前筛选
          </Link>
          {printableIds ? (
            <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/warehouse/print/return-rma/batch?ids=${printableIds}`}>
              批量打印 RMA 标签
            </Link>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-3 xl:grid-cols-6">
        {summaryItems.map((item) => (
          <Link className={`rounded-md border px-3 py-2 transition hover:bg-white ${toneClasses[item.tone].pill} ${activeFilter === item.filter ? "ring-2 ring-cyan-300" : ""}`} href={`/ops?section=outbound&returnStatus=${item.filter}`} key={item.label}>
            <p className="text-[11px] font-semibold">{item.label}</p>
            <p className="mt-1 text-xl font-semibold">{item.value}</p>
          </Link>
        ))}
      </div>
      <form className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row" action="/ops">
        <input name="section" type="hidden" value="outbound" />
        {activeFilter !== "all" ? <input name="returnStatus" type="hidden" value={activeFilter} /> : null}
        <label className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 focus-within:border-cyan-500">
          <Search size={16} className="text-slate-400" />
          <input className="min-h-8 flex-1 bg-transparent text-sm outline-none" defaultValue={keyword} name="returnQuery" placeholder="搜索 RMA、客户、追踪号、原订单号或 SKU" />
        </label>
        <button className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" type="submit">搜索</button>
      </form>
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
          {visibleRows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-semibold text-slate-950">{row.id}</p>
                <div className="mt-2">{statusPill(returnOrderStatusLabel(row.status), returnStatusTone(row.status))}</div>
                <p className="mt-2 text-xs text-slate-500">预计到仓 {row.expectedArrivalDate || "-"}</p>
                {row.workOrderId ? <p className="mt-2 font-mono text-xs font-semibold text-cyan-700">客户工单：{row.workOrderId}</p> : null}
                <Link className="mt-2 inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/warehouse/print/return-rma/${encodeURIComponent(row.id)}`}>
                  打印 RMA 标签
                </Link>
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
                {row.resolution ? <p className="mt-2 text-xs font-semibold text-slate-700">处理方式：{returnResolutionLabel(row.resolution)}</p> : null}
                {row.customerResolutionDecision ? (
                  <p className="mt-2 rounded-md bg-emerald-50 p-2 text-xs font-semibold leading-5 text-emerald-800">
                    客户确认：{returnResolutionLabel(row.customerResolutionDecision)}
                    {row.customerResolutionNote ? `；${row.customerResolutionNote}` : ""}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <OpsReturnWorkflow id={row.id} inspectionResult={row.inspectionResult} locationCode={row.locationCode} opsNote={row.opsNote} resolution={row.resolution} status={row.status} />
                <DocumentUploadPanel
                  category="exception_photo"
                  customerCode={row.customerCode}
                  documents={documents.filter((document) => document.refType === "return" && document.refId === row.id)}
                  refId={row.id}
                  refType="return"
                  title="退货质检照片/附件"
                  uploadEndpoint="/api/ops/documents"
                />
              </td>
            </tr>
          ))}
          {visibleRows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                当前筛选下暂无退货预报
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
  const cleanCount = rows.filter((row) => row.scanStatus === "clean").length;
  const blockedCount = rows.filter((row) => row.scanStatus === "blocked").length;
  const pendingCount = rows.filter((row) => !row.scanStatus || row.scanStatus === "pending").length;
  const objectCount = rows.filter((row) => row.storageProvider === "object").length;

  return (
    <WorkbenchTable icon={FileText} title="资料中心">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {statusPill(`已通过 ${cleanCount}`, "emerald")}
          {statusPill(`待扫描 ${pendingCount}`, pendingCount > 0 ? "amber" : "slate")}
          {statusPill(`已拦截 ${blockedCount}`, blockedCount > 0 ? "rose" : "slate")}
          {statusPill(`对象存储 ${objectCount}`, "cyan")}
        </div>
        <Link
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          href="/api/ops/reports/documents-security"
        >
          <Download size={14} />
          导出文件安全台账
        </Link>
      </div>
      <table className="min-w-[940px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">文件</th>
            <th className="px-4 py-3">客户 / 关联业务</th>
            <th className="px-4 py-3">类型</th>
            <th className="px-4 py-3">安全 / 存储</th>
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
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {statusPill(documentScanStatusLabel(row.scanStatus), documentScanTone(row.scanStatus))}
                  {statusPill(documentStorageProviderLabel(row.storageProvider), row.storageProvider === "object" ? "cyan" : "slate")}
                  {row.previewAllowed ? statusPill("可预览", "emerald") : statusPill("仅下载", "slate")}
                </div>
                {row.scanStatus === "blocked" && row.scanNote ? <p className="mt-2 max-w-xs text-xs font-semibold leading-5 text-rose-700">{row.scanNote}</p> : null}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p>{row.uploadedByRole === "customer" ? "客户" : "员工"} / {row.uploadedBy}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.uploadedAt)}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {row.previewAllowed && row.scanStatus === "clean" ? (
                    <Link
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      href={`/api/documents/${encodeURIComponent(row.id)}/preview`}
                      target="_blank"
                    >
                      <Eye size={14} />
                      预览
                    </Link>
                  ) : null}
                  {row.scanStatus === "clean" ? (
                    <Link
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                      href={signedDocumentDownloadHref(row.id)}
                    >
                      <Download size={14} />
                      下载
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-9 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800">待安全放行</span>
                  )}
                  <DocumentSecurityActions documentId={row.id} scanStatus={row.scanStatus} />
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                暂无上传资料
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WorkbenchTable>
  );
}

function CustomerReviewTable({ accounts, auditLogs, documents, customerProfiles }: { accounts: CustomerAccountView[]; auditLogs: AuditLogRecord[]; documents: DocumentRecord[]; customerProfiles: CustomerProfile[] }) {
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
                  <OpsCustomerStatusWorkflow
                    billingCycle={customerProfiles.find((item) => item.customerCode === account.customerCode)?.billingCycle}
                    creditLimit={customerProfiles.find((item) => item.customerCode === account.customerCode)?.creditLimit}
                    customerCode={account.customerCode}
                    documents={documents}
                    paymentTermDays={customerProfiles.find((item) => item.customerCode === account.customerCode)?.paymentTermDays}
                    status={account.status}
                  />
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

function InquiryCard({ item, documents }: { item: InquirySubmission; documents: DocumentRecord[] }) {
  const status = inquiryStatus(item);
  const segment = inquirySegment(item);
  const event = latestEvent(item);
  const inquiryDocuments = documents.filter((document) => document.refType === "inquiry" && document.refId === item.id);

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
          {inquiryDocuments.length > 0 ? statusPill(`资料 ${inquiryDocuments.length}`, "cyan") : null}
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

      <DocumentQuickLinks documents={inquiryDocuments} emptyText="该询盘暂无上传资料" />

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

function InboundCard({ item, documents }: { item: InboundSubmission; documents: DocumentRecord[] }) {
  const status = inboundStatus(item);
  const event = latestEvent(item);
  const checklist = buildInboundDocumentChecklist(item);
  const inboundDocuments = documents.filter((document) => document.refType === "inbound" && document.refId === item.id);

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

      <DocumentQuickLinks documents={inboundDocuments} emptyText="该入库预报暂无上传资料" />

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
  searchParams?: Promise<{ section?: string | string[]; returnStatus?: string | string[]; returnQuery?: string | string[] }>;
};

export default async function OpsPage({ searchParams }: OpsPageProps) {
  const params = await searchParams;
  const sectionParam = Array.isArray(params?.section) ? params?.section[0] : params?.section;
  const returnStatusParam = Array.isArray(params?.returnStatus) ? params?.returnStatus[0] : params?.returnStatus;
  const returnQuery = Array.isArray(params?.returnQuery) ? params?.returnQuery[0] ?? "" : params?.returnQuery ?? "";
  const requestedSection = domainNav.some((item) => item.id === sectionParam) ? sectionParam ?? "overview" : "overview";
  const activeReturnStatus = ["missing-tracking", "awaiting", "inspection", "needs-decision", "confirmed", "open"].includes(returnStatusParam ?? "") ? returnStatusParam : "all";

  const [staff, submissions, opsData, coreData, documents, customerAccounts, auditLogs, launchReadiness, expansionData, systemAlerts, managedStaffAccounts, automationRuns, webhookEvents, slaRules] = await Promise.all([
    requireStaffSession(),
    getSubmissions(),
    getOpsWorkbenchData(),
    getWarehouseCoreData(),
    getDocuments(),
    getCustomerAccounts(),
    getAuditLogs({ limit: 300 }),
    evaluateLaunchReadiness(),
    getOpsExpansionData(),
    getSystemAlerts(),
    getManagedStaffAccounts(),
    getAutomationRuns({ limit: 20 }),
    getWebhookEvents(50),
    getSlaNotificationRules(),
  ]);
  const inquiries = submissions.filter((item): item is InquirySubmission => item.type === "inquiry");
  const staffWhitelist = getStaffWhitelistView();
  const permittedDomainNav = domainNav.filter((item) => canAccessOpsModule(staff, item.id as Parameters<typeof canAccessOpsModule>[1], expansionData));
  const activeSection = permittedDomainNav.some((item) => item.id === requestedSection) ? requestedSection : "overview";
  const activeDomain = permittedDomainNav.find((item) => item.id === activeSection) ?? permittedDomainNav[0] ?? domainNav[0];
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
  const staffNotifications = await getStaffNotifications({ submissions, opsData, coreData, documents, expansionData, workOrders: expansionData.selfServiceWorkOrders, systemAlerts });
  const notificationDeliveries = await getNotificationDeliveries(100);
  const notificationProviderHealth = getNotificationProviderHealth();
  const productionIntegrationReadiness = await evaluateProductionIntegrationReadiness();
  const integrationProbeMap = await getLatestIntegrationProbeMap();
  const opsSystemHealth = await evaluateOpsSystemHealth();
  const customerSelfServiceOpsReport = buildCustomerSelfServiceOpsReport({
    submissions,
    coreData,
    documents,
    workOrders: expansionData.selfServiceWorkOrders,
  });
  const reportCenterData = buildReportCenterData({ expansionData, auditLogs, coreData, notificationDeliveries, automationRuns, customerSelfServiceReport: customerSelfServiceOpsReport, documents });
  const todoCount = staffNotifications.length || openInquiries + missingDocs + missingTracking + openInboundReceivingExceptions.length + openLogistics + openOutbound + openScanExceptions.length + inventoryRisks + unverifiedCustomers;
  const pendingBilling = coreData.billingRecords.filter((item) => item.status === "draft" || item.status === "pending_confirmation").length;
  const lowStockBalances = coreData.inventoryBalances.filter((item) => item.availableQty < item.alertQty).length;
  const agingBalances = coreData.inventoryBalances.filter((item) => item.agingDays >= 120).length;
  const logisticsControlRows = buildLogisticsControlRows([...coreData.outboundOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()));
  const replenishmentSuggestions = buildReplenishmentSuggestions(coreData);
  const stocktakeCandidates = buildStocktakeCandidates(coreData) as StocktakeCandidate[];
  const now = new Date();
  const nowMs = now.getTime();
  const nowLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(now);

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
              {permittedDomainNav.map(({ id, label, icon: Icon }) => (
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
                    <StaffPasswordChangeForm />
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
              {permittedDomainNav.map(({ id, label, icon: Icon }) => (
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

            <OpsLaunchGuardPanel alerts={systemAlerts} integrationReadiness={productionIntegrationReadiness} launchReadiness={launchReadiness} systemHealth={opsSystemHealth} />

            <OpsSlaReportPanel billingRecords={coreData.billingRecords} inbounds={inbounds} nowMs={new Date().getTime()} outbounds={coreData.outboundOrders} workOrders={expansionData.selfServiceWorkOrders} />

            <OpsCustomerSelfServicePanel report={customerSelfServiceOpsReport} />

            <OpsReportCenterPanel data={reportCenterData} />

            <OpsExceptionCenterPanel balances={coreData.inventoryBalances} billingRecords={coreData.billingRecords} inbounds={inbounds} nowMs={nowMs} outbounds={coreData.outboundOrders} returns={coreData.returnOrders} />

            <OpsSlaEscalationPanel items={staffNotifications} />

            <NotificationCenter emptyText="暂无运营待办" items={staffNotifications} title="运营待办中心" />

              <OutboundScanOperationsPanel rows={coreData.outboundOrders} />

              <SystemAlertPanel alerts={systemAlerts} />

              <OpsSystemLogPanel />

              <OpsSystemHealthPanel health={opsSystemHealth} />

              <OpsBackupRestorePanel recentLogs={auditLogs} />

              <LaunchReadinessPanel readiness={launchReadiness} />

              <ProductionIntegrationPanel readiness={productionIntegrationReadiness} probeMap={integrationProbeMap} />

              <WebhookEventPanel events={webhookEvents} />

              <OpsApiIntegrationLedgerPanel webhookEvents={webhookEvents} auditLogs={auditLogs} />

              <OpsMabangModulePanel automationRuns={automationRuns} data={expansionData} module="overview" />

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
              <CustomerReviewTable accounts={customerAccounts} auditLogs={auditLogs} customerProfiles={coreData.customers} documents={documents} />
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <FileText size={18} className="text-[#0E7490]" />
                    询盘报价处理
                  </h2>
                  {statusPill(`${openInquiries} 条未关闭`, "cyan")}
                </div>
                <div className="grid gap-4">
                  {sortedInquiries.length > 0 ? sortedInquiries.slice(0, 5).map((item) => <InquiryCard documents={documents} item={item} key={item.id} />) : <EmptyState text="暂无合作询盘" />}
                </div>
              </div>
            </section>
            ) : null}

            {activeSection === "inbound" ? (
            <section id="inbound" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="入库" title="入库管理" body="入库预报、资料补齐、追踪号、预约到仓和验收异常统一在这里处理。" icon={PackageCheck} />
              <OpsMabangModulePanel data={expansionData} module="inbound" purchaseReceipts={[...coreData.purchaseReceipts].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
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
                  {inbounds.length > 0 ? inbounds.slice(0, 5).map((item) => <InboundCard documents={documents} item={item} key={item.id} />) : <EmptyState text="暂无入库预报" />}
                </div>
              </div>
            </section>
            ) : null}

            {activeSection === "inventory" ? (
            <section id="inventory" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="库存" title="库存与库内作业" body="库位库存、安全库存、补货调拨、盘点和库存调整集中管理，方便仓库按异常优先级处理。" icon={Warehouse} />
              <OpsMabangModulePanel data={expansionData} module="inventory" />
              <OpsWmsRuleCompliancePanel balances={coreData.inventoryBalances} locations={coreData.locations} lots={coreData.inventoryLots} outboundOrders={coreData.outboundOrders} policies={expansionData.wmsPolicies} />
              <OpsReplenishmentPlanner plans={coreData.replenishmentPlans} suggestions={replenishmentSuggestions} transferOrders={coreData.transferOrders} />
              <OpsTransferLifecyclePanel documents={documents} rows={[...coreData.transferOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
              <OpsStocktakePanel batches={coreData.stocktakeBatches} candidates={stocktakeCandidates} />
              <LocationUtilizationPanel balances={coreData.inventoryBalances} locations={coreData.locations} />
              <InventoryTable rows={opsData.inventory} />
              <CoreInventoryTable
                adjustments={[...coreData.inventoryAdjustments].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())}
                balances={coreData.inventoryBalances}
                canReviewAdjustments={canReviewInventoryAdjustment(staff.role)}
                documents={documents}
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
              <OpsPlatformSyncHealthPanel data={expansionData} outbounds={coreData.outboundOrders} probeRecords={Array.from(integrationProbeMap.values()).filter((probe) => probe.group === "platform")} />
              <OutboundScanOperationsPanel rows={coreData.outboundOrders} />
              <OutboundTable rows={opsData.outbound} />
              <OpsOutboundBatchPanel rows={coreData.outboundOrders.map(({ id, customerCode, channel, orderCount, status }) => ({ id, customerCode, channel, orderCount, status }))} />
              <CoreOutboundRequestsTable rows={[...coreData.outboundOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
              <ReturnOrdersTable activeFilter={activeReturnStatus} documents={documents} keyword={returnQuery} rows={[...coreData.returnOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
            </section>
            ) : null}

            {activeSection === "logistics" ? (
            <section id="logistics" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="Logistics" title="物流与承运商" body="物流异常、承运商匹配、运费估算和追踪回传集中处理，便于运营持续闭环。" icon={Truck} />
              <OpsMabangModulePanel data={expansionData} module="logistics" />
              <OpsCarrierHealthPanel channels={expansionData.logisticsChannels} outbounds={coreData.outboundOrders} />
              <LogisticsTable rows={opsData.logistics} />
              <OpsLogisticsControlPanel documents={documents} rows={logisticsControlRows} />
            </section>
            ) : null}

            {activeSection === "billing" ? (
            <section id="billing" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="Billing" title="账单与资料审核" body="客户账单、费用生成、账单复核和资料审核放在同一组，方便财务和运营协作确认。" icon={ReceiptText} />
              <OpsMabangModulePanel data={expansionData} module="billing" />
              <BillingStatementPanel customers={coreData.customers} rows={coreData.billingRecords} />
              <OpsFinanceControlPanel customers={coreData.customers} records={coreData.billingRecords} workOrders={expansionData.selfServiceWorkOrders} />
              <OpsBillingDisputePanel customers={coreData.customers} documents={documents} records={coreData.billingRecords} workOrders={expansionData.selfServiceWorkOrders} />
              <OpsBillingGenerator customers={coreData.customers} documents={documents} inboundSubmissions={inbounds} outboundOrders={coreData.outboundOrders} returnOrders={coreData.returnOrders} />
              <BillingReviewTable rows={[...coreData.billingRecords].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())} />
              <OpsDocumentSecurityHealthPanel documents={documents} auditLogs={auditLogs} />
              <DocumentReviewTable rows={[...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())} />
            </section>
            ) : null}

            {activeSection === "permissions" ? (
            <section id="permissions" className="scroll-mt-28 space-y-4">
              <DomainHeading eyebrow="Audit" title="权限与操作审计" body="关键账号、库存、仓库、物流和出库动作集中留痕，支持按操作人、客户、单号和业务类型快速追溯。" icon={ShieldCheck} />
              <OpsMabangModulePanel data={expansionData} managedStaffAccounts={managedStaffAccounts} module="permissions" notificationDeliveries={notificationDeliveries} notificationProviderHealth={notificationProviderHealth} slaRules={slaRules} staffWhitelist={staffWhitelist} />
              <OpsAuditLogPanel logs={auditLogs} />
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
