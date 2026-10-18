import { buildCustomerSelfServiceCenterData, type CustomerSelfServiceAction, type CustomerSelfServiceCenterData } from "./customerSelfServiceCenter";
import type { DocumentRecord } from "./documentStore";
import type { Submission } from "./localStore";
import type { CustomerWorkOrder } from "./opsExpansionStore";
import type { WarehouseCoreData } from "./warehouseCoreStore";

export type CustomerSelfServiceOpsRisk = "正常" | "关注" | "高风险";

export type CustomerSelfServiceOpsRow = {
  customerCode: string;
  companyName: string;
  riskLevel: CustomerSelfServiceOpsRisk;
  actionCount: number;
  urgentCount: number;
  overdueCount: number;
  nearDueCount: number;
  downloadableCount: number;
  billingDue: number;
  returnsNeedDecision: number;
  openExceptions: number;
  workOrders: number;
  financeReviewWorkOrders: number;
  topActionTitle: string;
  topActionModule: string;
  topActionStatus: string;
  topActionSeverity: string;
  topActionDueAt: string;
  topActionHref: string;
  reminderChannels: string;
  lastUpdatedAt: string;
  center: CustomerSelfServiceCenterData;
};

export type CustomerSelfServiceOpsReport = {
  generatedAt: string;
  summary: {
    customers: number;
    activeCustomers: number;
    highRiskCustomers: number;
    overdueCustomers: number;
    urgentActions: number;
    overdueActions: number;
    nearDueActions: number;
    downloadableItems: number;
    financeReviewWorkOrders: number;
  };
  rows: CustomerSelfServiceOpsRow[];
};

type BuildInput = {
  submissions: Submission[];
  coreData: WarehouseCoreData;
  documents: DocumentRecord[];
  workOrders: CustomerWorkOrder[];
};

function actionTime(action: CustomerSelfServiceAction) {
  return action.dueAt || action.createdAt || "";
}

function riskFor(center: CustomerSelfServiceCenterData): CustomerSelfServiceOpsRisk {
  if (center.actions.some((item) => item.slaLevel === "overdue" || item.severity === "紧急")) return "高风险";
  if (center.actions.some((item) => item.slaLevel === "near_due" || item.severity === "待处理")) return "关注";
  return "正常";
}

function uniqueCustomerCodes(input: BuildInput) {
  return Array.from(
    new Set(
      [
        ...input.coreData.customers.map((item) => item.customerCode),
        ...input.submissions.map((item) => item.customerCode).filter((value): value is string => Boolean(value)),
        ...input.documents.map((item) => item.customerCode),
        ...input.workOrders.map((item) => item.customerCode),
        ...input.coreData.inventoryBalances.map((item) => item.customerCode),
        ...input.coreData.outboundOrders.map((item) => item.customerCode),
        ...input.coreData.returnOrders.map((item) => item.customerCode),
        ...input.coreData.billingRecords.map((item) => item.customerCode),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort();
}

export function buildCustomerSelfServiceOpsReport(input: BuildInput): CustomerSelfServiceOpsReport {
  const rows = uniqueCustomerCodes(input).map((customerCode): CustomerSelfServiceOpsRow => {
    const customer = input.coreData.customers.find((item) => item.customerCode === customerCode);
    const customerWorkOrders = input.workOrders.filter((item) => item.customerCode === customerCode);
    const financeReviewWorkOrders = customerWorkOrders.filter((item) => item.financeReviewRequired && item.status !== "resolved" && item.status !== "cancelled").length;
    const center = buildCustomerSelfServiceCenterData({
      customerCode,
      submissions: input.submissions.filter((item) => item.customerCode === customerCode),
      coreData: {
        billingRecords: input.coreData.billingRecords.filter((item) => item.customerCode === customerCode),
        inventoryBalances: input.coreData.inventoryBalances.filter((item) => item.customerCode === customerCode),
        outboundOrders: input.coreData.outboundOrders.filter((item) => item.customerCode === customerCode),
        returnOrders: input.coreData.returnOrders.filter((item) => item.customerCode === customerCode),
      },
      documents: input.documents.filter((item) => item.customerCode === customerCode),
      workOrders: customerWorkOrders,
    });
    const actionable = center.actions.filter((item) => item.severity !== "正常" || item.slaLevel === "near_due" || item.slaLevel === "overdue");
    const topAction = actionable[0] ?? center.actions[0];
    const overdueCount = center.actions.filter((item) => item.slaLevel === "overdue").length;
    const nearDueCount = center.actions.filter((item) => item.slaLevel === "near_due").length;

    return {
      customerCode,
      companyName: customer?.companyName || customer?.contactName || "未命名客户",
      riskLevel: riskFor(center),
      actionCount: actionable.length,
      urgentCount: center.actions.filter((item) => item.severity === "紧急").length,
      overdueCount,
      nearDueCount,
      downloadableCount: center.summary.downloadableCount,
      billingDue: center.summary.billingDue,
      returnsNeedDecision: center.summary.returnsNeedDecision,
      openExceptions: center.summary.openExceptions,
      workOrders: center.summary.workOrders,
      financeReviewWorkOrders,
      topActionTitle: topAction?.title ?? "",
      topActionModule: topAction?.module ?? "",
      topActionStatus: topAction?.status ?? "",
      topActionSeverity: topAction?.severity ?? "",
      topActionDueAt: topAction?.dueAt ?? "",
      topActionHref: topAction?.href ?? "",
      reminderChannels: topAction?.reminderChannels?.join("、") ?? "",
      lastUpdatedAt: actionTime(topAction) || center.generatedAt,
      center,
    };
  });

  const sortedRows = rows.sort((left, right) => {
    const riskRank: Record<CustomerSelfServiceOpsRisk, number> = { 高风险: 3, 关注: 2, 正常: 1 };
    return (
      riskRank[right.riskLevel] - riskRank[left.riskLevel] ||
      right.overdueCount - left.overdueCount ||
      right.urgentCount - left.urgentCount ||
      right.actionCount - left.actionCount ||
      new Date(right.lastUpdatedAt || 0).getTime() - new Date(left.lastUpdatedAt || 0).getTime()
    );
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      customers: sortedRows.length,
      activeCustomers: sortedRows.filter((item) => item.actionCount > 0 || item.downloadableCount > 0).length,
      highRiskCustomers: sortedRows.filter((item) => item.riskLevel === "高风险").length,
      overdueCustomers: sortedRows.filter((item) => item.overdueCount > 0).length,
      urgentActions: sortedRows.reduce((sum, item) => sum + item.urgentCount, 0),
      overdueActions: sortedRows.reduce((sum, item) => sum + item.overdueCount, 0),
      nearDueActions: sortedRows.reduce((sum, item) => sum + item.nearDueCount, 0),
      downloadableItems: sortedRows.reduce((sum, item) => sum + item.downloadableCount, 0),
      financeReviewWorkOrders: sortedRows.reduce((sum, item) => sum + item.financeReviewWorkOrders, 0),
    },
    rows: sortedRows,
  };
}

export function customerSelfServiceOpsSummaryCsvRows(report: CustomerSelfServiceOpsReport) {
  return [
    ["客户编号", "公司名称", "风险等级", "待处理事项", "紧急事项", "已超时", "即将超时", "可下载资料", "账单待处理", "退货待确认", "异常/风险", "未关闭工单", "财务复核工单", "优先事项", "优先模块", "优先状态", "截止时间", "建议通知渠道", "处理入口", "更新时间"],
    ...report.rows.map((row) => [
      row.customerCode,
      row.companyName,
      row.riskLevel,
      row.actionCount,
      row.urgentCount,
      row.overdueCount,
      row.nearDueCount,
      row.downloadableCount,
      row.billingDue,
      row.returnsNeedDecision,
      row.openExceptions,
      row.workOrders,
      row.financeReviewWorkOrders,
      row.topActionTitle,
      row.topActionModule,
      row.topActionStatus,
      row.topActionDueAt,
      row.reminderChannels,
      row.topActionHref,
      row.lastUpdatedAt,
    ]),
  ];
}

export function customerSelfServiceOpsDetailCsvRows(report: CustomerSelfServiceOpsReport) {
  return [
    ["客户编号", "公司名称", "模块", "关联单号/SKU", "事项", "状态", "紧急程度", "SLA状态", "截止时间", "超时小时", "建议通知渠道", "下一步动作", "处理入口", "下载入口", "创建/更新时间"],
    ...report.rows.flatMap((row) =>
      row.center.actions.map((item) => [
        row.customerCode,
        row.companyName,
        item.module,
        item.sourceId,
        item.title,
        item.status,
        item.severity,
        item.slaLevel === "overdue" ? "已超时" : item.slaLevel === "near_due" ? "即将超时" : item.slaLevel === "normal" ? "正常跟进" : "",
        item.dueAt ?? "",
        item.overdueHours ?? "",
        item.reminderChannels?.join("、") ?? "",
        item.nextAction,
        item.href,
        item.downloadableHref ?? "",
        item.createdAt ?? "",
      ]),
    ),
  ];
}
