import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { billingStatusLabel, getWarehouseCoreData, type BillingRecord, type CustomerProfile } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type ReconciliationStatus = "已核销" | "待财务复核" | "争议处理中" | "已驳回待重提" | "已确认待付款" | "待客户确认" | "草稿待确认";
type ReconciliationRisk = "正常" | "关注" | "高风险";

type PaymentReconciliationRow = {
  reconciliationId: string;
  customerCode: string;
  companyName: string;
  billingCycle: string;
  paymentTermDays: number;
  creditLimit: number;
  billingId: string;
  statementId: string;
  month: string;
  title: string;
  amount: number;
  outstandingAmount: number;
  dueDate: string;
  overdueDays: number;
  billingStatus: string;
  reconciliationStatus: ReconciliationStatus;
  paymentReference: string;
  paymentSubmittedAt: string;
  paidAt: string;
  reviewedBy: string;
  rejectedAt: string;
  rejectionNote: string;
  disputeNote: string;
  riskLevel: ReconciliationRisk;
  nextAction: string;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function attachmentHeader(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download.csv";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function csvResponse(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\ufeff${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentHeader(filename),
    },
  });
}

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function monthKey(record: BillingRecord) {
  return (record.statementMonth || record.dueDate || record.createdAt).slice(0, 7);
}

function billingCycleLabel(value?: CustomerProfile["billingCycle"]) {
  if (value === "prepaid") return "预付";
  if (value === "weekly") return "周结";
  if (value === "monthly") return "月结";
  return "未设置";
}

function overdueDays(record: BillingRecord, nowMs: number) {
  if (!record.dueDate || record.status === "paid") return 0;
  const dueMs = new Date(`${record.dueDate}T23:59:59`).getTime();
  if (!Number.isFinite(dueMs) || dueMs >= nowMs) return 0;
  return Math.floor((nowMs - dueMs) / 86_400_000);
}

function reconciliationStatus(record: BillingRecord): ReconciliationStatus {
  if (record.status === "paid") return "已核销";
  if (record.status === "payment_submitted") return "待财务复核";
  if (record.status === "disputed") return "争议处理中";
  if (record.paymentRejectedAt || record.statementPaymentRejectedAt) return "已驳回待重提";
  if (record.status === "confirmed") return "已确认待付款";
  if (record.status === "pending_confirmation") return "待客户确认";
  return "草稿待确认";
}

function riskLevel(status: ReconciliationStatus, days: number, customer: CustomerProfile | undefined, openAmount: number): ReconciliationRisk {
  if (status === "争议处理中" || days > 30) return "高风险";
  if (customer?.creditLimit && openAmount > customer.creditLimit) return "高风险";
  if (status === "已驳回待重提" || status === "待财务复核" || days > 0) return "关注";
  return "正常";
}

function nextActionFor(row: PaymentReconciliationRow) {
  if (row.reconciliationStatus === "已核销") return "已完成收款核销，保留审计记录。";
  if (row.reconciliationStatus === "待财务复核") return "核对银行流水和付款参考号，确认无误后标记到账。";
  if (row.reconciliationStatus === "争议处理中") return "先处理账单争议，确认费用口径后再进入收款核销。";
  if (row.reconciliationStatus === "已驳回待重提") return "等待客户重新提交付款凭证，必要时由客服提醒。";
  if (row.overdueDays > 30) return "高优先级催收，并评估是否暂停高风险客户出库。";
  if (row.overdueDays > 0) return "提醒客户付款或提交付款参考号。";
  if (row.reconciliationStatus === "已确认待付款") return "等待客户付款，到款后由财务核销。";
  return "等待客户确认费用。";
}

function buildRows(records: BillingRecord[], customers: CustomerProfile[]): PaymentReconciliationRow[] {
  const nowMs = Date.now();
  const customerByCode = new Map(customers.map((customer) => [customer.customerCode, customer]));
  const openAmountByCustomer = new Map<string, number>();

  for (const record of records) {
    if (record.status === "paid") continue;
    openAmountByCustomer.set(record.customerCode, (openAmountByCustomer.get(record.customerCode) ?? 0) + record.amount);
  }

  return records.map((record) => {
    const customer = customerByCode.get(record.customerCode);
    const days = overdueDays(record, nowMs);
    const status = reconciliationStatus(record);
    const row: PaymentReconciliationRow = {
      reconciliationId: record.statementId ? `${record.statementId}-${record.id}` : `PAY-${record.id}`,
      customerCode: record.customerCode,
      companyName: customer?.companyName ?? "",
      billingCycle: billingCycleLabel(customer?.billingCycle),
      paymentTermDays: customer?.paymentTermDays ?? 7,
      creditLimit: customer?.creditLimit ?? 0,
      billingId: record.id,
      statementId: record.statementId ?? "",
      month: monthKey(record),
      title: record.title,
      amount: money(record.amount),
      outstandingAmount: record.status === "paid" ? 0 : money(record.amount),
      dueDate: record.dueDate ?? "",
      overdueDays: days,
      billingStatus: billingStatusLabel(record.status),
      reconciliationStatus: status,
      paymentReference: record.paymentReference ?? record.statementPaymentReference ?? "",
      paymentSubmittedAt: record.paymentSubmittedAt ?? record.statementPaymentSubmittedAt ?? "",
      paidAt: record.statementPaidAt ?? (record.status === "paid" ? record.reviewedAt ?? "" : ""),
      reviewedBy: record.statementPaidBy ?? record.reviewedBy ?? "",
      rejectedAt: record.paymentRejectedAt ?? record.statementPaymentRejectedAt ?? "",
      rejectionNote: record.paymentRejectionNote ?? record.statementPaymentRejectionNote ?? "",
      disputeNote: record.status === "disputed" ? record.customerMessage ?? record.statementCustomerMessage ?? "" : "",
      riskLevel: "正常",
      nextAction: "",
    };
    row.riskLevel = riskLevel(status, days, customer, openAmountByCustomer.get(record.customerCode) ?? 0);
    row.nextAction = nextActionFor(row);
    return row;
  });
}

function applyFilters(rows: PaymentReconciliationRow[], url: URL) {
  const month = clean(url.searchParams.get("month"));
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const status = clean(url.searchParams.get("status"));
  const risk = clean(url.searchParams.get("risk"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();

  return rows
    .filter((row) => (!month || row.month === month))
    .filter((row) => (!customerCode || row.customerCode.toLowerCase().includes(customerCode)))
    .filter((row) => (!status || status === "all" || row.reconciliationStatus === status || row.billingStatus === status))
    .filter((row) => (!risk || risk === "all" || row.riskLevel === risk))
    .filter((row) => (!keyword || [row.reconciliationId, row.billingId, row.statementId, row.companyName, row.title, row.paymentReference].some((value) => value.toLowerCase().includes(keyword))));
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出收款核销台账。" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData.billingRecords, coreData.customers), url).sort((left, right) => {
    const riskRank: Record<ReconciliationRisk, number> = { 高风险: 0, 关注: 1, 正常: 2 };
    const statusRank: Record<ReconciliationStatus, number> = { 待财务复核: 0, 争议处理中: 1, 已驳回待重提: 2, 已确认待付款: 3, 待客户确认: 4, 草稿待确认: 5, 已核销: 6 };
    return riskRank[left.riskLevel] - riskRank[right.riskLevel] || statusRank[left.reconciliationStatus] - statusRank[right.reconciliationStatus] || right.overdueDays - left.overdueDays;
  });

  if (!["saved_view", "scheduled_report"].includes(url.searchParams.get("auditSource") ?? "")) {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "payment-reconciliation",
      summary: "导出收款核销台账",
      note: `行数：${rows.length}`,
      after: {
        month: url.searchParams.get("month") ?? "",
        customerCode: url.searchParams.get("customerCode") ?? "",
        status: url.searchParams.get("status") ?? "all",
        risk: url.searchParams.get("risk") ?? "all",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("收款核销台账.csv", [
    [
      "核销编号",
      "客户编号",
      "公司名称",
      "结算周期",
      "账期天数",
      "信用额度GBP",
      "账单编号",
      "月结单号",
      "月份",
      "账单名称",
      "账单金额GBP",
      "未核销金额GBP",
      "到期日",
      "逾期天数",
      "账单状态",
      "核销状态",
      "付款参考号",
      "提交付款时间",
      "核销时间",
      "复核人",
      "驳回时间",
      "驳回原因",
      "争议说明",
      "风险等级",
      "下一步处理",
    ],
    ...rows.map((row) => [
      row.reconciliationId,
      row.customerCode,
      row.companyName,
      row.billingCycle,
      row.paymentTermDays,
      row.creditLimit,
      row.billingId,
      row.statementId,
      row.month,
      row.title,
      row.amount,
      row.outstandingAmount,
      row.dueDate,
      row.overdueDays,
      row.billingStatus,
      row.reconciliationStatus,
      row.paymentReference,
      row.paymentSubmittedAt,
      row.paidAt,
      row.reviewedBy,
      row.rejectedAt,
      row.rejectionNote,
      row.disputeNote,
      row.riskLevel,
      row.nextAction,
    ]),
  ]);
}
