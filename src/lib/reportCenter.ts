import type { AuditLogRecord } from "./auditLogStore";
import type { AutomationRunRecord } from "./automationRunStore";
import type { CustomerSelfServiceOpsReport } from "./customerSelfServiceOpsReport";
import type { DocumentRecord } from "./documentStore";
import type { GuardTask } from "./launchGuard";
import type { NotificationDelivery } from "./notificationStore";
import type { OpsExpansionData, SavedReportView } from "./opsExpansionStore";
import type { WarehouseCoreData } from "./warehouseCoreStore";

export type ReportCenterRisk = "正常" | "关注" | "高风险";

export type ReportCenterModuleRow = {
  module: SavedReportView["module"];
  label: string;
  description: string;
  viewCount: number;
  activeScheduleCount: number;
  pausedScheduleCount: number;
  failedScheduleCount: number;
  recentExportCount: number;
  lastExportAt: string;
  riskLevel: ReportCenterRisk;
  riskReason: string;
  href: string;
};

export type ReportCenterSummary = {
  savedViews: number;
  activeSchedules: number;
  pausedSchedules: number;
  archivedSchedules: number;
  failedSchedules: number;
  recentExports: number;
  highRiskModules: number;
  failedNotificationDeliveries: number;
  failedAutomationRuns: number;
  overdueBillingRecords: number;
};

export type ReportCenterData = {
  generatedAt: string;
  summary: ReportCenterSummary;
  modules: ReportCenterModuleRow[];
  recentExports: Array<{
    id: string;
    reportName: string;
    actorName: string;
    createdAt: string;
    note: string;
  }>;
  scheduleRows: Array<{
    id: string;
    viewId: string;
    name: string;
    viewName: string;
    moduleLabel: string;
    cadence: string;
    cadenceValue: "daily" | "weekly" | "monthly";
    recipients: string;
    recipientList: string[];
    status: string;
    statusValue: "active" | "paused" | "archived";
    lastRunAt: string;
    lastDeliveryStatus: string;
    lastDeliveryNote: string;
  }>;
};

const reportModules: Array<Pick<ReportCenterModuleRow, "module" | "label" | "description" | "href">> = [
  { module: "warehouse", label: "库存与库龄", description: "SKU 库存、库龄、冻结、残次、在途和低库存预警。", href: "/api/ops/reports/inventory" },
  { module: "locations", label: "库位利用率", description: "库区、货架、库位容量、占用率和高风险库位。", href: "/api/ops/reports/locations" },
  { module: "inventory_lots", label: "批次效期库存", description: "批次号、效期、序列号、FIFO/FEFO 风险。", href: "/api/ops/reports/inventory-lots" },
  { module: "outbound_review", label: "出库复核差异", description: "拣货、分拣、复核、称重和出库异常缺口。", href: "/api/ops/reports/outbound-review" },
  { module: "pick_waves", label: "拣货波次效率", description: "波次分组、空闲时长、库区策略和拣货效率。", href: "/api/ops/reports/pick-waves" },
  { module: "carrier_labels", label: "承运商面单生命周期", description: "面单购买、取消、重试、真实标签和轨迹回传。", href: "/api/ops/reports/carrier-labels" },
  { module: "platform_sync", label: "平台订单同步", description: "平台拉单、取消同步、异常校验和发货回传。", href: "/api/ops/reports/platform-sync" },
  { module: "charge_events", label: "费用事件台账", description: "仓储、出库、贴标、偏远、燃油、退货和手工费用。", href: "/api/ops/reports/charge-events" },
  { module: "billing_aging", label: "应收账龄", description: "逾期账单、即将到期、付款待复核和争议金额。", href: "/api/ops/reports/billing-aging" },
  { module: "payment_reconciliation", label: "收款核销", description: "付款参考号、到账复核、驳回、争议和核销状态。", href: "/api/ops/reports/payment-reconciliation" },
  { module: "finance_adjustments", label: "财务调账/赔付审批", description: "待复核工单、费用调账、赔付抵扣、审批规则和来源账单留痕。", href: "/api/ops/reports/finance-adjustments" },
  { module: "profit", label: "利润/成本", description: "客户利润、物流成本、操作成本和毛利风险。", href: "/api/ops/reports/profit" },
  { module: "returns", label: "退货/RMA", description: "退货追踪、质检、上架、销毁、客户确认和退货费用。", href: "/api/ops/reports/returns" },
  { module: "exceptions", label: "异常中心", description: "入库、库存、出库、物流、退货和账单异常聚合。", href: "/api/ops/reports/exceptions" },
  { module: "scans", label: "扫码留痕", description: "收货、上架、拣货、分拣、复核、称重和退货扫描。", href: "/api/ops/reports/scans" },
  { module: "sla", label: "SLA 与异常", description: "入库、出库、物流、费用、账单和工单 SLA。", href: "/api/ops/reports/sla" },
  { module: "customer_credit", label: "客户信用风险", description: "账期、信用额度、逾期金额和暂停建议。", href: "/api/ops/reports/customer-credit" },
  { module: "customer_self_service", label: "客户自助待办", description: "客户资料、账单确认、物流异常、退货处理和工单 SLA。", href: "/api/ops/reports/customer-self-service" },
  { module: "documents_security", label: "文件安全台账", description: "上传资料、病毒扫描、预览权限、存储方式和安全下载。", href: "/api/ops/reports/documents-security" },
  { module: "data_quality", label: "数据质量巡检", description: "缺字段、缺追踪、缺费用、缺资料和导入异常。", href: "/api/ops/reports/data-quality" },
  { module: "staff_performance", label: "员工绩效", description: "扫码次数、作业动作、账单复核、报表导出和审计动作。", href: "/api/ops/reports/staff-performance" },
  { module: "automation_runs", label: "自动化运行记录", description: "定时任务、重试、失败原因和处理动作。", href: "/api/ops/reports/automation-runs" },
  { module: "notification_deliveries", label: "通知投递", description: "邮件、短信、微信通知投递、失败和重试。", href: "/api/ops/reports/notification-deliveries" },
  { module: "launch_guard", label: "上线复核包", description: "上线体检、生产集成、系统健康和系统告警的老板视角责任清单。", href: "/api/ops/launch-guard?format=csv" },
];

reportModules.splice(3, 0, {
  module: "outbound_lot_allocation",
  label: "出库批次分配",
  description: "待出库订单的 FEFO 批次建议、库位、临期批次和缺货缺口。",
  href: "/api/ops/reports/outbound-lot-allocation",
});

function cadenceLabel(value: string) {
  if (value === "daily") return "每日";
  if (value === "weekly") return "每周";
  if (value === "monthly") return "每月";
  return value || "-";
}

function scheduleStatusLabel(value: string) {
  if (value === "active") return "启用";
  if (value === "paused") return "暂停";
  if (value === "archived") return "已归档";
  return value || "-";
}

function deliveryStatusLabel(value?: string) {
  if (value === "sent") return "已发送";
  if (value === "skipped") return "待配置";
  if (value === "failed") return "失败";
  return "未执行";
}

function targetReportName(log: AuditLogRecord) {
  return log.summary.replace(/^导出保存视图：/, "").replace(/^导出/, "") || log.targetId;
}

function reportRisk(
  module: SavedReportView["module"],
  coreData: WarehouseCoreData,
  deliveries: NotificationDelivery[],
  automationRuns: AutomationRunRecord[],
  customerSelfServiceReport?: Pick<CustomerSelfServiceOpsReport, "summary">,
  documents: DocumentRecord[] = [],
  opsData?: Pick<OpsExpansionData, "selfServiceWorkOrders">,
  launchGuardTasks: GuardTask[] = [],
): { riskLevel: ReportCenterRisk; riskReason: string } {
  const nowMs = Date.now();
  const overdueBilling = coreData.billingRecords.filter((item) => item.dueDate && new Date(`${item.dueDate}T23:59:59`).getTime() < Date.now() && item.status !== "paid").length;
  const paymentSubmitted = coreData.billingRecords.filter((item) => item.status === "payment_submitted").length;
  const disputedBilling = coreData.billingRecords.filter((item) => item.status === "disputed").length;
  const lowStock = coreData.inventoryBalances.filter((item) => item.availableQty < item.alertQty).length;
  const qtyByLocation = new Map<string, number>();
  coreData.inventoryBalances.forEach((item) => {
    if (!item.locationCode) return;
    qtyByLocation.set(item.locationCode, (qtyByLocation.get(item.locationCode) ?? 0) + item.availableQty + item.reservedQty + item.frozenQty + item.defectiveQty);
  });
  const locationRisk = coreData.locations.filter((item) => item.status !== "active" || (item.capacityQty ? (qtyByLocation.get(item.locationCode) ?? 0) > item.capacityQty : false)).length;
  const lotRisk = coreData.inventoryLots.filter((item) => {
    const expiryMs = item.expiryDate ? new Date(`${item.expiryDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const daysUntilExpiry = Number.isFinite(expiryMs) ? Math.ceil((expiryMs - nowMs) / 86_400_000) : Number.POSITIVE_INFINITY;
    return item.status === "blocked" || item.status === "expired" || daysUntilExpiry <= 30;
  }).length;
  const outboundRisk = coreData.outboundOrders.filter((item) => item.status !== "shipped" && (item.status === "blocked" || item.labelStatus === "failed" || (item.exceptions ?? []).some((exception) => exception.status !== "resolved"))).length;
  const outboundLotShortage = coreData.outboundOrders
    .filter((order) => order.status !== "shipped")
    .reduce((count, order) => {
      const hasShortage = (order.skuLines ?? []).some((line) => {
        const availableQty = coreData.inventoryLots
          .filter((lot) => lot.customerCode === order.customerCode && lot.skuCode === line.skuCode && lot.availableQty > 0 && lot.status === "active")
          .reduce((sum, lot) => sum + lot.availableQty, 0);
        return availableQty < line.quantity;
      });
      return count + (hasShortage ? 1 : 0);
    }, 0);
  const carrierRisk = coreData.outboundOrders.filter((item) => item.labelStatus === "failed" || (item.trackingEvents ?? []).some((event) => event.status === "exception")).length;
  const returnRisk = coreData.returnOrders.filter((item) => item.status === "exception" || (["received", "inspection", "repair"].includes(item.status) && !item.customerResolutionDecision)).length;
  const failedDeliveries = deliveries.filter((item) => item.status === "failed" || item.status === "blocked").length;
  const failedRuns = automationRuns.filter((item) => item.status === "failed" || item.status === "partial_failed" || item.summary.failed > 0 || item.results.some((task) => task.status === "failed")).length;
  const selfServiceRisk = (customerSelfServiceReport?.summary.overdueActions ?? 0) + (customerSelfServiceReport?.summary.urgentActions ?? 0);
  const documentSecurityRisk = documents.filter((item) => item.scanStatus === "blocked" || item.scanStatus === "pending" || !item.scanStatus).length;
  const launchGuardBlocked = launchGuardTasks.filter((item) => item.status === "blocked").length;
  const launchGuardWarning = launchGuardTasks.filter((item) => item.status === "warning").length;
  const pendingFinanceReviews = (opsData?.selfServiceWorkOrders ?? []).filter((item) => item.financeReviewRequired && item.status !== "resolved" && item.status !== "cancelled").length;
  const adjustmentBillingAttention = coreData.billingRecords.filter(
    (item) =>
      item.adjustmentKind &&
      (item.status === "disputed" ||
        item.status === "payment_submitted" ||
        item.adjustmentApprovalStatus === "pending_approval" ||
        item.adjustmentApprovalStatus === "rejected" ||
        item.adjustmentAttachmentStatus === "missing"),
  ).length;

  const riskMap: Partial<Record<SavedReportView["module"], { count: number; reason: string }>> = {
    warehouse: { count: lowStock, reason: `低库存 ${lowStock} 条` },
    locations: { count: locationRisk, reason: `库位风险 ${locationRisk} 条` },
    inventory_lots: { count: lotRisk, reason: `批次/效期风险 ${lotRisk} 条` },
    outbound_lot_allocation: { count: outboundLotShortage, reason: `出库批次缺口 ${outboundLotShortage} 单` },
    outbound_review: { count: outboundRisk, reason: `出库复核风险 ${outboundRisk} 单` },
    pick_waves: { count: outboundRisk, reason: `待优化出库队列 ${outboundRisk} 单` },
    carrier_labels: { count: carrierRisk, reason: `承运商面单/轨迹风险 ${carrierRisk} 单` },
    platform_sync: { count: failedRuns, reason: `自动化失败 ${failedRuns} 次` },
    charge_events: { count: overdueBilling + disputedBilling, reason: `逾期/争议账单 ${overdueBilling + disputedBilling} 条` },
    billing_aging: { count: overdueBilling, reason: `逾期账单 ${overdueBilling} 条` },
    payment_reconciliation: { count: paymentSubmitted + disputedBilling, reason: `待复核/争议 ${paymentSubmitted + disputedBilling} 条` },
    finance_adjustments: { count: pendingFinanceReviews + adjustmentBillingAttention, reason: `财务复核/调账赔付待处理 ${pendingFinanceReviews + adjustmentBillingAttention} 条` },
    profit: { count: overdueBilling + carrierRisk, reason: `费用和物流风险 ${overdueBilling + carrierRisk} 条` },
    returns: { count: returnRisk, reason: `退货待处理 ${returnRisk} 单` },
    exceptions: { count: outboundRisk + carrierRisk + returnRisk + lowStock, reason: `综合异常 ${outboundRisk + carrierRisk + returnRisk + lowStock} 条` },
    scans: { count: outboundRisk + returnRisk, reason: `作业留痕待复核 ${outboundRisk + returnRisk} 条` },
    sla: { count: outboundRisk + overdueBilling + returnRisk, reason: `SLA 风险 ${outboundRisk + overdueBilling + returnRisk} 条` },
    customer_credit: { count: overdueBilling + disputedBilling, reason: `客户信用风险 ${overdueBilling + disputedBilling} 条` },
    data_quality: { count: lowStock + outboundRisk + returnRisk, reason: `数据质量风险 ${lowStock + outboundRisk + returnRisk} 条` },
    staff_performance: { count: failedRuns, reason: `自动化/任务失败 ${failedRuns} 次` },
    automation_runs: { count: failedRuns, reason: `自动化失败 ${failedRuns} 次` },
    notification_deliveries: { count: failedDeliveries, reason: `通知失败/阻塞 ${failedDeliveries} 条` },
    customer_self_service: { count: selfServiceRisk, reason: `客户自助超时/紧急 ${selfServiceRisk} 条` },
    documents_security: { count: documentSecurityRisk, reason: `文件待扫描/阻塞 ${documentSecurityRisk} 个` },
    launch_guard: { count: launchGuardBlocked * 5 + launchGuardWarning, reason: `上线阻塞 ${launchGuardBlocked} 项，关注 ${launchGuardWarning} 项` },
  };

  const risk = riskMap[module] ?? { count: 0, reason: "暂无异常信号" };
  if (risk.count >= 5) return { riskLevel: "高风险", riskReason: risk.reason };
  if (risk.count > 0) return { riskLevel: "关注", riskReason: risk.reason };
  return { riskLevel: "正常", riskReason: risk.reason };
}

export function buildReportCenterData(input: {
  expansionData: Pick<OpsExpansionData, "savedViews" | "reportSchedules" | "selfServiceWorkOrders">;
  auditLogs: AuditLogRecord[];
  coreData: WarehouseCoreData;
  notificationDeliveries: NotificationDelivery[];
  automationRuns: AutomationRunRecord[];
  customerSelfServiceReport?: Pick<CustomerSelfServiceOpsReport, "summary">;
  documents?: DocumentRecord[];
  launchGuardTasks?: GuardTask[];
}): ReportCenterData {
  const recentReportExports = input.auditLogs
    .filter((item) => item.action === "report_export")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const exportCountByTarget = new Map<string, number>();
  const lastExportByModule = new Map<SavedReportView["module"], string>();

  recentReportExports.forEach((log) => {
    exportCountByTarget.set(log.targetId, (exportCountByTarget.get(log.targetId) ?? 0) + 1);
    const matchedView = input.expansionData.savedViews.find((view) => view.id === log.targetId || log.note?.includes(view.module));
    if (matchedView && !lastExportByModule.has(matchedView.module)) lastExportByModule.set(matchedView.module, log.createdAt);
  });

  const modules = reportModules.map((module) => {
    const views = input.expansionData.savedViews.filter((view) => view.module === module.module);
    const schedules = input.expansionData.reportSchedules.filter((schedule) => schedule.status !== "archived" && views.some((view) => view.id === schedule.viewId));
    const failedScheduleCount = schedules.filter((schedule) => schedule.lastDeliveryStatus === "failed").length;
    const risk = reportRisk(module.module, input.coreData, input.notificationDeliveries, input.automationRuns, input.customerSelfServiceReport, input.documents, input.expansionData, input.launchGuardTasks);
    const recentExportCount = views.reduce((sum, view) => sum + (exportCountByTarget.get(view.id) ?? 0), 0);
    return {
      ...module,
      viewCount: views.length,
      activeScheduleCount: schedules.filter((schedule) => schedule.status === "active").length,
      pausedScheduleCount: schedules.filter((schedule) => schedule.status === "paused").length,
      failedScheduleCount,
      recentExportCount,
      lastExportAt: lastExportByModule.get(module.module) ?? "",
      riskLevel: failedScheduleCount > 0 ? "高风险" : risk.riskLevel,
      riskReason: failedScheduleCount > 0 ? `定时报表失败 ${failedScheduleCount} 个` : risk.riskReason,
    };
  });

  const visibleSchedules = input.expansionData.reportSchedules.filter((item) => item.status !== "archived");
  const failedSchedules = visibleSchedules.filter((item) => item.lastDeliveryStatus === "failed").length;
  const failedNotificationDeliveries = input.notificationDeliveries.filter((item) => item.status === "failed" || item.status === "blocked").length;
  const failedAutomationRuns = input.automationRuns.filter((item) => item.status === "failed" || item.status === "partial_failed" || item.summary.failed > 0 || item.results.some((task) => task.status === "failed")).length;
  const overdueBillingRecords = input.coreData.billingRecords.filter((item) => item.dueDate && new Date(`${item.dueDate}T23:59:59`).getTime() < Date.now() && item.status !== "paid").length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      savedViews: input.expansionData.savedViews.length,
      activeSchedules: input.expansionData.reportSchedules.filter((item) => item.status === "active").length,
      pausedSchedules: input.expansionData.reportSchedules.filter((item) => item.status === "paused").length,
      archivedSchedules: input.expansionData.reportSchedules.filter((item) => item.status === "archived").length,
      failedSchedules,
      recentExports: recentReportExports.length,
      highRiskModules: modules.filter((item) => item.riskLevel === "高风险").length,
      failedNotificationDeliveries,
      failedAutomationRuns,
      overdueBillingRecords,
    },
    modules,
    recentExports: recentReportExports.slice(0, 8).map((log) => ({
      id: log.id,
      reportName: targetReportName(log),
      actorName: log.actorName,
      createdAt: log.createdAt,
      note: log.note ?? "",
    })),
    scheduleRows: visibleSchedules.slice(0, 12).map((schedule) => {
      const view = input.expansionData.savedViews.find((item) => item.id === schedule.viewId);
      return {
        id: schedule.id,
        viewId: schedule.viewId,
        name: schedule.name,
        viewName: view?.name ?? "视图不存在",
        moduleLabel: reportModules.find((item) => item.module === view?.module)?.label ?? view?.module ?? "-",
        cadence: cadenceLabel(schedule.cadence),
        cadenceValue: schedule.cadence,
        recipients: schedule.recipients.join("、") || "未配置",
        recipientList: schedule.recipients,
        status: scheduleStatusLabel(schedule.status),
        statusValue: schedule.status,
        lastRunAt: schedule.lastRunAt ?? "",
        lastDeliveryStatus: deliveryStatusLabel(schedule.lastDeliveryStatus),
        lastDeliveryNote: schedule.lastDeliveryNote ?? "",
      };
    }),
  };
}

export function reportCenterCsvRows(data: ReportCenterData) {
  return [
    ["模块", "说明", "保存视图", "启用计划", "暂停计划", "失败计划", "最近导出", "最近导出时间", "风险等级", "风险原因", "下载地址"],
    ...data.modules.map((item) => [
      item.label,
      item.description,
      item.viewCount,
      item.activeScheduleCount,
      item.pausedScheduleCount,
      item.failedScheduleCount,
      item.recentExportCount,
      item.lastExportAt,
      item.riskLevel,
      item.riskReason,
      item.href,
    ]),
  ];
}
