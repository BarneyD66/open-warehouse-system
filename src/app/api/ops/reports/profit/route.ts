import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, type BillingRecord, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type ProfitRow = {
  month: string;
  customerCode: string;
  billingCount: number;
  revenue: number;
  paid: number;
  pending: number;
  disputed: number;
  feeAdjustments: number;
  compensations: number;
  estimatedCarrierCost: number;
  actualCarrierCost: number;
  grossProfit: number;
  grossMargin: number;
  outboundCount: number;
  shippedCount: number;
};

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

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function billingMonth(record: BillingRecord) {
  return (record.statementMonth || record.dueDate || record.createdAt).slice(0, 7);
}

function outboundMonth(order: CoreOutboundOrder) {
  return (order.shippedAt || order.updatedAt || order.createdAt).slice(0, 7);
}

function applyBillingFilters(records: BillingRecord[], month: string, customerCode: string) {
  return records.filter((record) => (!month || billingMonth(record) === month) && (!customerCode || record.customerCode.toUpperCase() === customerCode));
}

function applyOutboundFilters(orders: CoreOutboundOrder[], month: string, customerCode: string) {
  return orders.filter((order) => (!month || outboundMonth(order) === month) && (!customerCode || order.customerCode.toUpperCase() === customerCode));
}

function buildProfitRows(records: BillingRecord[], orders: CoreOutboundOrder[]) {
  const rows = new Map<string, ProfitRow>();

  function getRow(customerCode: string, month: string) {
    const key = `${customerCode}:${month}`;
    const existing = rows.get(key);
    if (existing) return existing;
    const created: ProfitRow = {
      month,
      customerCode,
      billingCount: 0,
      revenue: 0,
      paid: 0,
      pending: 0,
      disputed: 0,
      feeAdjustments: 0,
      compensations: 0,
      estimatedCarrierCost: 0,
      actualCarrierCost: 0,
      grossProfit: 0,
      grossMargin: 0,
      outboundCount: 0,
      shippedCount: 0,
    };
    rows.set(key, created);
    return created;
  }

  records.forEach((record) => {
    const row = getRow(record.customerCode, billingMonth(record));
    row.billingCount += 1;
    row.revenue += record.amount;
    if (record.adjustmentKind === "fee_adjustment") row.feeAdjustments += record.amount;
    if (record.adjustmentKind === "compensation") row.compensations += record.amount;
    if (record.status === "paid") row.paid += record.amount;
    else if (record.status === "disputed") row.disputed += record.amount;
    else row.pending += record.amount;
  });

  orders.forEach((order) => {
    const row = getRow(order.customerCode, outboundMonth(order));
    row.outboundCount += 1;
    if (order.status === "shipped") row.shippedCount += 1;
    row.estimatedCarrierCost += order.shippingFee ?? 0;
    row.actualCarrierCost += order.actualShippingFee ?? order.shippingFee ?? 0;
  });

  return Array.from(rows.values())
    .map((row) => {
      const revenue = money(row.revenue);
      const actualCarrierCost = money(row.actualCarrierCost);
      const grossProfit = money(revenue - actualCarrierCost);
      return {
        ...row,
        revenue,
        paid: money(row.paid),
        pending: money(row.pending),
        disputed: money(row.disputed),
        feeAdjustments: money(row.feeAdjustments),
        compensations: money(row.compensations),
        estimatedCarrierCost: money(row.estimatedCarrierCost),
        actualCarrierCost,
        grossProfit,
        grossMargin: revenue > 0 ? grossProfit / revenue : 0,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month) || a.customerCode.localeCompare(b.customerCode));
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出利润/成本报表。" }, { status: 403 });

  const url = new URL(request.url);
  const month = (url.searchParams.get("month") ?? "").trim();
  const customerCode = (url.searchParams.get("customerCode") ?? "").trim().toUpperCase();
  const coreData = await getWarehouseCoreData();
  const records = applyBillingFilters(coreData.billingRecords, month, customerCode);
  const orders = applyOutboundFilters(coreData.outboundOrders, month, customerCode);
  const rows = buildProfitRows(records, orders);

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "profit",
      summary: "导出利润/成本报表",
      note: `月份：${month || "全部"}；客户：${customerCode || "全部"}；行数：${rows.length}`,
    });
  }

  return csvResponse("利润与成本报表.csv", [
    ["月份", "客户编号", "账单数", "账单收入", "已收款", "待收款", "争议金额", "费用调账", "赔付抵扣", "预估承运商成本", "实际承运商成本", "毛利", "毛利率", "出库单数", "已发货单数"],
    ...rows.map((row) => [
      row.month,
      row.customerCode,
      row.billingCount,
      row.revenue,
      row.paid,
      row.pending,
      row.disputed,
      row.feeAdjustments,
      row.compensations,
      row.estimatedCarrierCost,
      row.actualCarrierCost,
      row.grossProfit,
      percent(row.grossMargin),
      row.outboundCount,
      row.shippedCount,
    ]),
  ]);
}
