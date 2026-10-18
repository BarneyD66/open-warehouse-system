import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { billingInvoiceStatusLabel, billingStatusLabel, getWarehouseCoreData, type BillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type PaymentReviewRow = {
  billingId: string;
  customerCode: string;
  companyName: string;
  title: string;
  refType: string;
  refId: string;
  amount: number;
  dueDate: string;
  overdueDays: number;
  statusCode: BillingRecord["status"];
  status: string;
  invoiceStatus: string;
  paymentReference: string;
  paymentNote: string;
  paymentSubmittedAt: string;
  paymentRejectedAt: string;
  paymentRejectedBy: string;
  paymentRejectionNote: string;
  reviewedBy: string;
  reviewedAt: string;
  statementId: string;
  statementStatus: string;
  riskLevel: "待复核" | "已驳回" | "逾期" | "争议" | "正常";
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

function overdueDays(record: BillingRecord, nowMs: number) {
  if (!record.dueDate || record.status === "paid") return 0;
  const dueMs = new Date(`${record.dueDate}T23:59:59`).getTime();
  if (!Number.isFinite(dueMs) || dueMs >= nowMs) return 0;
  return Math.floor((nowMs - dueMs) / 86_400_000);
}

function riskFor(record: BillingRecord, days: number): PaymentReviewRow["riskLevel"] {
  if (record.status === "payment_submitted") return "待复核";
  if (record.paymentRejectedAt || record.paymentRejectionNote) return "已驳回";
  if (record.status === "disputed") return "争议";
  if (days > 0) return "逾期";
  return "正常";
}

function nextActionFor(row: Pick<PaymentReviewRow, "riskLevel" | "overdueDays">) {
  if (row.riskLevel === "待复核") return "核对银行流水或付款凭证，确认无误后点击确认到账。";
  if (row.riskLevel === "已驳回") return "等待客户重新提交付款参考号，必要时由客服提醒。";
  if (row.riskLevel === "争议") return "先处理账单争议，确认费用口径后再核销。";
  if (row.riskLevel === "逾期") return row.overdueDays >= 30 ? "高优先级催收，并评估是否暂停高风险客户出库。" : "提醒客户付款或提交付款凭证。";
  return "无需处理。";
}

function buildRows(records: BillingRecord[], customers: Awaited<ReturnType<typeof getWarehouseCoreData>>["customers"]): PaymentReviewRow[] {
  const nowMs = Date.now();
  return records.map((record) => {
    const days = overdueDays(record, nowMs);
    const riskLevel = riskFor(record, days);
    const customer = customers.find((item) => item.customerCode === record.customerCode);
    const row: PaymentReviewRow = {
      billingId: record.id,
      customerCode: record.customerCode,
      companyName: customer?.companyName ?? "",
      title: record.title,
      refType: record.refType,
      refId: record.refId,
      amount: money(record.amount),
      dueDate: record.dueDate ?? "",
      overdueDays: days,
      statusCode: record.status,
      status: billingStatusLabel(record.status),
      invoiceStatus: billingInvoiceStatusLabel(record.invoiceStatus),
      paymentReference: record.paymentReference ?? record.statementPaymentReference ?? "",
      paymentNote: record.paymentNote ?? record.statementPaymentNote ?? "",
      paymentSubmittedAt: record.paymentSubmittedAt ?? record.statementPaymentSubmittedAt ?? "",
      paymentRejectedAt: record.paymentRejectedAt ?? record.statementPaymentRejectedAt ?? "",
      paymentRejectedBy: record.paymentRejectedBy ?? record.statementPaymentRejectedBy ?? "",
      paymentRejectionNote: record.paymentRejectionNote ?? record.statementPaymentRejectionNote ?? "",
      reviewedBy: record.reviewedBy ?? "",
      reviewedAt: record.reviewedAt ?? "",
      statementId: record.statementId ?? "",
      statementStatus: record.statementStatus === "locked" ? "已锁定" : "未锁定",
      riskLevel,
      nextAction: "",
    };
    row.nextAction = nextActionFor(row);
    return row;
  });
}

function applyFilters(rows: PaymentReviewRow[], url: URL) {
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const risk = clean(url.searchParams.get("risk"));
  const status = clean(url.searchParams.get("status"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  return rows
    .filter((row) => (!customerCode || row.customerCode.toLowerCase().includes(customerCode)))
    .filter((row) => (!risk || risk === "all" || row.riskLevel === risk))
    .filter((row) => (!status || status === "all" || row.statusCode === status || row.status === status))
    .filter((row) => (!keyword || [row.billingId, row.companyName, row.title, row.refId, row.paymentReference].some((value) => value.toLowerCase().includes(keyword))));
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出付款复核清单。" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData.billingRecords, coreData.customers), url).sort((left, right) => {
    const rank = { 待复核: 0, 已驳回: 1, 争议: 2, 逾期: 3, 正常: 4 };
    return rank[left.riskLevel] - rank[right.riskLevel] || right.overdueDays - left.overdueDays || right.amount - left.amount;
  });

  if (!["saved_view", "scheduled_report"].includes(url.searchParams.get("auditSource") ?? "")) {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "payment-review",
      summary: "导出付款复核清单",
      note: `行数：${rows.length}`,
      after: {
        customerCode: url.searchParams.get("customerCode") ?? "",
        risk: url.searchParams.get("risk") ?? "all",
        status: url.searchParams.get("status") ?? "all",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("付款复核清单.csv", [
    ["账单编号", "客户编号", "公司名称", "账单名称", "业务类型", "关联单号", "金额GBP", "到期日", "逾期天数", "账单状态", "开票状态", "付款参考号", "付款说明", "提交付款时间", "驳回时间", "驳回人", "驳回原因", "复核人", "复核时间", "月结单号", "月结状态", "风险等级", "下一步处理"],
    ...rows.map((row) => [
      row.billingId,
      row.customerCode,
      row.companyName,
      row.title,
      row.refType,
      row.refId,
      row.amount,
      row.dueDate,
      row.overdueDays,
      row.status,
      row.invoiceStatus,
      row.paymentReference,
      row.paymentNote,
      row.paymentSubmittedAt,
      row.paymentRejectedAt,
      row.paymentRejectedBy,
      row.paymentRejectionNote,
      row.reviewedBy,
      row.reviewedAt,
      row.statementId,
      row.statementStatus,
      row.riskLevel,
      row.nextAction,
    ]),
  ]);
}
