import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { billingInvoiceStatusLabel, billingStatusLabel, getWarehouseCoreData, type BillingFeeLine, type BillingRecord, type WarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type ChargeEventRow = {
  eventId: string;
  billingId: string;
  customerCode: string;
  companyName: string;
  month: string;
  sourceType: string;
  sourceId: string;
  sourceSummary: string;
  adjustmentType: string;
  sourceWorkOrderId: string;
  sourceBillingId: string;
  feeCode: string;
  feeName: string;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  amount: number;
  currency: string;
  billingTitle: string;
  billingStatus: string;
  invoiceStatus: string;
  statementStatus: string;
  statementId: string;
  dueDate: string;
  createdAt: string;
  note: string;
  nextAction: string;
};

const refTypeLabels: Record<string, string> = {
  quote: "报价",
  inbound: "入库",
  outbound: "出库",
  logistics: "物流",
  storage: "仓租",
  return: "退货",
  manual: "手工费用",
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

function defaultLine(record: BillingRecord): BillingFeeLine {
  return {
    feeCode: "manual_service",
    label: record.title,
    unitLabel: "项",
    unitPrice: record.amount,
    quantity: 1,
    amount: record.amount,
    note: record.note,
  };
}

function statementStatusLabel(record: BillingRecord) {
  return record.statementStatus === "locked" ? "已锁定" : "未锁定";
}

function nextActionFor(record: BillingRecord) {
  if (record.status === "draft") return "运营确认费用来源后提交客户确认。";
  if (record.status === "pending_confirmation") return "等待客户确认费用，必要时由客服提醒。";
  if (record.status === "confirmed") return "等待客户付款或纳入月结核销。";
  if (record.status === "payment_submitted") return "财务复核付款凭证并核销到账。";
  if (record.status === "disputed") return "优先处理争议原因，确认后重新进入收款流程。";
  if (record.status === "paid") return "已核销，保留审计追溯。";
  return "按账单状态继续处理。";
}

function sourceSummary(record: BillingRecord, data: WarehouseCoreData) {
  if (record.refType === "outbound") {
    const order = data.outboundOrders.find((item) => item.id === record.refId);
    if (order) return `${order.platformOrderNo || order.id} / ${order.channel || "未填渠道"} / ${order.status}`;
  }
  if (record.refType === "return") {
    const order = data.returnOrders.find((item) => item.id === record.refId);
    if (order) return `${order.id} / ${order.status}`;
  }
  if (record.refType === "storage") {
    const balance = data.inventoryBalances.find((item) => record.refId.includes(item.id));
    if (balance) return `${balance.skuCode} / 可用 ${balance.availableQty} / 库龄 ${balance.agingDays || 0} 天`;
  }
  if (record.refType === "inbound") {
    const receipt = data.purchaseReceipts.find((item) => item.id === record.refId);
    if (receipt) return `${receipt.id} / ${receipt.status}`;
  }
  return record.refId;
}

function adjustmentTypeLabel(record: BillingRecord) {
  if (record.adjustmentKind === "fee_adjustment") return "费用调账";
  if (record.adjustmentKind === "compensation") return "赔付抵扣";
  return "";
}

function buildRows(data: WarehouseCoreData): ChargeEventRow[] {
  const customerByCode = new Map(data.customers.map((item) => [item.customerCode, item]));
  return data.billingRecords.flatMap((record) => {
    const lines = record.feeLines?.length ? record.feeLines : [defaultLine(record)];
    return lines.map((line, index) => ({
      eventId: `CHG-${record.id}-${index + 1}`,
      billingId: record.id,
      customerCode: record.customerCode,
      companyName: customerByCode.get(record.customerCode)?.companyName ?? "",
      month: monthKey(record),
      sourceType: refTypeLabels[record.refType] ?? record.refType,
      sourceId: record.refId,
      sourceSummary: sourceSummary(record, data),
      adjustmentType: adjustmentTypeLabel(record),
      sourceWorkOrderId: record.workOrderId ?? "",
      sourceBillingId: record.adjustmentSourceRecordId ?? "",
      feeCode: line.feeCode,
      feeName: line.label,
      quantity: line.quantity,
      unitLabel: line.unitLabel,
      unitPrice: money(line.unitPrice),
      amount: money(line.amount),
      currency: record.currency,
      billingTitle: record.title,
      billingStatus: billingStatusLabel(record.status),
      invoiceStatus: billingInvoiceStatusLabel(record.invoiceStatus),
      statementStatus: statementStatusLabel(record),
      statementId: record.statementId ?? "",
      dueDate: record.dueDate ?? "",
      createdAt: record.createdAt,
      note: line.note || record.note || "",
      nextAction: nextActionFor(record),
    }));
  });
}

function applyFilters(rows: ChargeEventRow[], url: URL) {
  const month = clean(url.searchParams.get("month"));
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const sourceType = clean(url.searchParams.get("sourceType"));
  const feeCode = clean(url.searchParams.get("feeCode"));
  const status = clean(url.searchParams.get("status"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();

  return rows
    .filter((row) => (!month || row.month === month))
    .filter((row) => (!customerCode || row.customerCode.toLowerCase().includes(customerCode)))
    .filter((row) => (!sourceType || sourceType === "all" || row.sourceType === sourceType || row.sourceId === sourceType))
    .filter((row) => (!feeCode || feeCode === "all" || row.feeCode === feeCode || row.feeName === feeCode))
    .filter((row) => (!status || status === "all" || row.billingStatus === status))
    .filter((row) => {
      if (!keyword) return true;
      return [row.eventId, row.billingId, row.customerCode, row.companyName, row.sourceId, row.sourceSummary, row.adjustmentType, row.sourceWorkOrderId, row.sourceBillingId, row.feeName, row.note].some((value) => value.toLowerCase().includes(keyword));
    });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出费用事件台账。" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData), url).sort((left, right) => {
    return right.month.localeCompare(left.month) || right.createdAt.localeCompare(left.createdAt) || left.customerCode.localeCompare(right.customerCode);
  });

  if (!["saved_view", "scheduled_report"].includes(url.searchParams.get("auditSource") ?? "")) {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "charge-events",
      summary: "导出费用事件台账",
      note: `行数：${rows.length}`,
      after: {
        month: url.searchParams.get("month") ?? "",
        customerCode: url.searchParams.get("customerCode") ?? "",
        sourceType: url.searchParams.get("sourceType") ?? "all",
        feeCode: url.searchParams.get("feeCode") ?? "all",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("费用事件台账.csv", [
    [
      "费用事件号",
      "账单号",
      "客户编号",
      "公司名称",
      "月份",
      "业务类型",
      "关联单据",
      "业务摘要",
      "调账/赔付类型",
      "来源工单",
      "来源账单",
      "费用编码",
      "费用名称",
      "数量",
      "单位",
      "单价",
      "金额",
      "币种",
      "账单标题",
      "账单状态",
      "开票状态",
      "月结状态",
      "月结单号",
      "到期日",
      "创建时间",
      "备注",
      "下一步处理",
    ],
    ...rows.map((row) => [
      row.eventId,
      row.billingId,
      row.customerCode,
      row.companyName,
      row.month,
      row.sourceType,
      row.sourceId,
      row.sourceSummary,
      row.adjustmentType,
      row.sourceWorkOrderId,
      row.sourceBillingId,
      row.feeCode,
      row.feeName,
      row.quantity,
      row.unitLabel,
      row.unitPrice,
      row.amount,
      row.currency,
      row.billingTitle,
      row.billingStatus,
      row.invoiceStatus,
      row.statementStatus,
      row.statementId,
      row.dueDate,
      row.createdAt,
      row.note,
      row.nextAction,
    ]),
  ]);
}
