import type { BillingRecord } from "./warehouseCoreStore";

export type BillingMonthSummary = {
  month: string;
  count: number;
  totalAmount: number;
  payableAmount: number;
  paidAmount: number;
  disputedAmount: number;
  lockedCount: number;
  invoiceRequestedCount: number;
  invoiceIssuedCount: number;
};

export function billingMonthKey(record: BillingRecord) {
  return (record.dueDate || record.createdAt).slice(0, 7);
}

export function billingMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  if (!year || !monthNumber) return month;
  return `${year} 年 ${Number(monthNumber)} 月`;
}

export function summarizeBillingMonths(records: BillingRecord[]) {
  const map = new Map<string, BillingMonthSummary>();

  records.forEach((record) => {
    const month = billingMonthKey(record);
    const current = map.get(month) ?? {
      month,
      count: 0,
      totalAmount: 0,
      payableAmount: 0,
      paidAmount: 0,
      disputedAmount: 0,
      lockedCount: 0,
      invoiceRequestedCount: 0,
      invoiceIssuedCount: 0,
    };

    current.count += 1;
    current.totalAmount += record.amount;
    if (record.status === "paid") current.paidAmount += record.amount;
    if (record.status === "disputed") current.disputedAmount += record.amount;
    if (record.statementStatus === "locked") current.lockedCount += 1;
    if (record.invoiceStatus === "requested") current.invoiceRequestedCount += 1;
    if (record.invoiceStatus === "issued") current.invoiceIssuedCount += 1;
    if (["draft", "pending_confirmation", "confirmed", "payment_submitted"].includes(record.status)) {
      current.payableAmount += record.amount;
    }

    map.set(month, current);
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      totalAmount: roundMoney(item.totalAmount),
      payableAmount: roundMoney(item.payableAmount),
      paidAmount: roundMoney(item.paidAmount),
      disputedAmount: roundMoney(item.disputedAmount),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function filterBillingRecords(records: BillingRecord[], options: { month?: string | null; customerCode?: string | null; status?: string | null }) {
  return records.filter((record) => {
    if (options.month && billingMonthKey(record) !== options.month) return false;
    if (options.customerCode && record.customerCode !== options.customerCode) return false;
    if (options.status && record.status !== options.status) return false;
    return true;
  });
}

const statementStatusLabels: Record<string, string> = {
  open: "未锁定",
  locked: "已锁定",
};

const invoiceStatusLabels: Record<string, string> = {
  not_requested: "未申请",
  requested: "已申请",
  issued: "已开票",
};

const billingStatusLabels: Record<string, string> = {
  draft: "草稿",
  pending_confirmation: "待客户确认",
  confirmed: "客户已确认",
  payment_submitted: "已提交付款",
  paid: "已付款",
  disputed: "争议中",
  void: "已作废",
};

const refTypeLabels: Record<string, string> = {
  inbound: "入库",
  outbound: "出库",
  return: "退货",
  storage: "仓租",
  adjustment: "调整",
  manual: "手工费用",
};

function adjustmentLabel(record: BillingRecord) {
  if (record.adjustmentKind === "fee_adjustment") return "费用调账";
  if (record.adjustmentKind === "compensation") return "赔付抵扣";
  return "";
}

function adjustmentApprovalStatusLabel(record: BillingRecord) {
  if (record.adjustmentApprovalStatus === "pending_approval") return "待审批";
  if (record.adjustmentApprovalStatus === "approved") return "已审批";
  if (record.adjustmentApprovalStatus === "posted") return "已入账";
  if (record.adjustmentApprovalStatus === "rejected") return "已驳回/有争议";
  if (record.adjustmentApprovalStatus === "paid") return "已核销";
  if (record.status === "paid") return "已核销";
  if (record.status === "confirmed") return "已入账";
  if (record.status === "disputed") return "已驳回/有争议";
  return record.adjustmentKind ? "已审批" : "";
}

function adjustmentAttachmentStatusLabel(record: BillingRecord) {
  if (record.adjustmentAttachmentStatus === "archived") return "附件已归档";
  if (record.adjustmentAttachmentStatus === "confirmed") return "附件已确认";
  if (record.adjustmentAttachmentStatus === "missing") return "附件待补";
  if (record.adjustmentAttachmentStatus === "not_required") return "无需附件";
  return "";
}

function latestTimelineSummary(record: BillingRecord) {
  const latest = [...(record.approvalTimeline ?? [])].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0];
  if (!latest) return "";
  return `${latest.label} / ${latest.actor} / ${latest.occurredAt}${latest.note ? ` / ${latest.note}` : ""}`;
}

export function billingExportRows(records: BillingRecord[]) {
  return [
    ["账单号", "客户编号", "月份", "月结状态", "月结单号", "开票状态", "业务类型", "关联单据", "调账/赔付类型", "调账/赔付状态", "审批规则", "审批规则说明", "附件状态", "来源工单", "来源账单", "标题", "状态", "币种", "金额", "到期日", "费用明细", "客户说明", "付款参考号", "运营备注", "最近处理进度", "创建时间"],
    ...records.map((record) => [
      record.id,
      record.customerCode,
      billingMonthLabel(billingMonthKey(record)),
      statementStatusLabels[record.statementStatus || "open"] ?? record.statementStatus ?? "未锁定",
      record.statementId || "",
      invoiceStatusLabels[record.invoiceStatus || "not_requested"] ?? record.invoiceStatus ?? "未申请",
      refTypeLabels[record.refType] ?? record.refType,
      record.refId,
      adjustmentLabel(record),
      adjustmentApprovalStatusLabel(record),
      record.adjustmentApprovalRuleName || "",
      record.adjustmentApprovalRuleNote || "",
      adjustmentAttachmentStatusLabel(record),
      record.workOrderId || "",
      record.adjustmentSourceRecordId || "",
      record.title,
      billingStatusLabels[record.status] ?? record.status,
      record.currency,
      record.amount,
      record.dueDate || "",
      record.feeLines?.map((line) => `${line.label} ${line.quantity}${line.unitLabel} x ${line.unitPrice} = ${line.amount}`).join("; ") || "",
      record.customerMessage || "",
      record.paymentReference || "",
      record.reviewNote || "",
      latestTimelineSummary(record),
      record.createdAt,
    ]),
  ];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
