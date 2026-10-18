import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, type BillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type BillingAgingRisk = "正常" | "关注" | "高风险";

type BillingAgingRow = {
  customerCode: string;
  companyName: string;
  openCount: number;
  openAmount: number;
  dueSoonAmount: number;
  overdueAmount: number;
  overdue0To7: number;
  overdue8To30: number;
  overdue31To60: number;
  overdueOver60: number;
  paymentSubmittedAmount: number;
  disputedAmount: number;
  lockedStatementCount: number;
  latestDueDate: string;
  riskLevel: BillingAgingRisk;
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

function daysOverdue(record: BillingRecord, todayMs: number) {
  if (!record.dueDate) return 0;
  const dueMs = new Date(`${record.dueDate}T23:59:59`).getTime();
  if (!Number.isFinite(dueMs) || dueMs >= todayMs) return 0;
  return Math.floor((todayMs - dueMs) / 86_400_000);
}

function riskFor(row: Pick<BillingAgingRow, "overdueAmount" | "overdue31To60" | "overdueOver60" | "paymentSubmittedAmount" | "disputedAmount">): BillingAgingRisk {
  if (row.overdueOver60 > 0 || row.overdue31To60 > 0 || row.disputedAmount > 0) return "高风险";
  if (row.overdueAmount > 0 || row.paymentSubmittedAmount > 0) return "关注";
  return "正常";
}

function nextActionFor(row: BillingAgingRow) {
  if (row.disputedAmount > 0) return "优先复核账单争议，确认后再催收或核销。";
  if (row.paymentSubmittedAmount > 0) return "复核客户付款凭证，合格后核销收款。";
  if (row.overdueOver60 > 0 || row.overdue31To60 > 0) return "高优先级催收，必要时暂停高风险客户出库。";
  if (row.overdueAmount > 0) return "提醒客户付款或提交付款凭证。";
  if (row.dueSoonAmount > 0) return "关注即将到期账单，提前提醒客户。";
  return "无需处理。";
}

function buildRows(records: BillingRecord[], customers: Awaited<ReturnType<typeof getWarehouseCoreData>>["customers"]): BillingAgingRow[] {
  const todayMs = Date.now();
  const openRecords = records.filter((record) => record.status !== "paid");
  const grouped = new Map<string, BillingRecord[]>();
  for (const record of openRecords) grouped.set(record.customerCode, [...(grouped.get(record.customerCode) ?? []), record]);

  return Array.from(grouped.entries()).map(([customerCode, rows]) => {
    const customer = customers.find((item) => item.customerCode === customerCode);
    const base: BillingAgingRow = {
      customerCode,
      companyName: customer?.companyName ?? "",
      openCount: rows.length,
      openAmount: money(rows.reduce((sum, record) => sum + record.amount, 0)),
      dueSoonAmount: 0,
      overdueAmount: 0,
      overdue0To7: 0,
      overdue8To30: 0,
      overdue31To60: 0,
      overdueOver60: 0,
      paymentSubmittedAmount: money(rows.filter((record) => record.status === "payment_submitted").reduce((sum, record) => sum + record.amount, 0)),
      disputedAmount: money(rows.filter((record) => record.status === "disputed").reduce((sum, record) => sum + record.amount, 0)),
      lockedStatementCount: rows.filter((record) => record.statementStatus === "locked").length,
      latestDueDate: rows
        .map((record) => record.dueDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(0) ?? "",
      riskLevel: "正常",
      nextAction: "",
    };

    for (const record of rows) {
      const overdue = daysOverdue(record, todayMs);
      if (overdue <= 0) {
        const dueMs = record.dueDate ? new Date(`${record.dueDate}T23:59:59`).getTime() : Number.NaN;
        if (Number.isFinite(dueMs) && dueMs - todayMs <= 7 * 86_400_000) base.dueSoonAmount += record.amount;
        continue;
      }
      base.overdueAmount += record.amount;
      if (overdue <= 7) base.overdue0To7 += record.amount;
      else if (overdue <= 30) base.overdue8To30 += record.amount;
      else if (overdue <= 60) base.overdue31To60 += record.amount;
      else base.overdueOver60 += record.amount;
    }

    base.dueSoonAmount = money(base.dueSoonAmount);
    base.overdueAmount = money(base.overdueAmount);
    base.overdue0To7 = money(base.overdue0To7);
    base.overdue8To30 = money(base.overdue8To30);
    base.overdue31To60 = money(base.overdue31To60);
    base.overdueOver60 = money(base.overdueOver60);
    base.riskLevel = riskFor(base);
    base.nextAction = nextActionFor(base);
    return base;
  });
}

function applyFilters(rows: BillingAgingRow[], url: URL) {
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const risk = clean(url.searchParams.get("risk"));
  return rows.filter((row) => (!customerCode || row.customerCode.toLowerCase().includes(customerCode)) && (!risk || risk === "all" || row.riskLevel === risk));
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出应收账龄报表。" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData.billingRecords, coreData.customers), url).sort((left, right) => {
    const rank: Record<BillingAgingRisk, number> = { 高风险: 0, 关注: 1, 正常: 2 };
    return rank[left.riskLevel] - rank[right.riskLevel] || right.overdueAmount - left.overdueAmount || right.openAmount - left.openAmount;
  });

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "billing-aging",
      summary: "导出应收账龄报表",
      note: `行数：${rows.length}`,
      after: {
        customerCode: url.searchParams.get("customerCode") ?? "",
        risk: url.searchParams.get("risk") ?? "all",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("应收账龄报表.csv", [
    [
      "客户编号",
      "公司名称",
      "未结笔数",
      "未结金额",
      "7天内到期",
      "逾期金额",
      "逾期0-7天",
      "逾期8-30天",
      "逾期31-60天",
      "逾期60天以上",
      "付款待复核",
      "争议金额",
      "已锁定月结单数",
      "最近到期日",
      "风险等级",
      "下一步处理",
    ],
    ...rows.map((row) => [
      row.customerCode,
      row.companyName,
      row.openCount,
      row.openAmount,
      row.dueSoonAmount,
      row.overdueAmount,
      row.overdue0To7,
      row.overdue8To30,
      row.overdue31To60,
      row.overdueOver60,
      row.paymentSubmittedAmount,
      row.disputedAmount,
      row.lockedStatementCount,
      row.latestDueDate,
      row.riskLevel,
      row.nextAction,
    ]),
  ]);
}
