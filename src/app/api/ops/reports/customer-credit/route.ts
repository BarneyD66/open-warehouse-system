import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { evaluateCustomerCreditRisk, getWarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

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

function billingCycleLabel(value?: string) {
  const labels: Record<string, string> = {
    prepaid: "预付",
    weekly: "周结",
    monthly: "月结",
  };
  return value ? labels[value] ?? value : "未配置";
}

function customerStatusLabel(value: string) {
  const labels: Record<string, string> = {
    unverified: "未认证",
    verified: "已认证",
    paused: "已暂停",
  };
  return labels[value] ?? value;
}

function riskStatusLabel(value: string) {
  const labels: Record<string, string> = {
    clear: "正常",
    warning: "提醒",
    blocked: "已拦截",
  };
  return labels[value] ?? value;
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出客户信用风险报表。" }, { status: 403 });

  const url = new URL(request.url);
  const customerCode = (url.searchParams.get("customerCode") ?? "").trim().toUpperCase();
  const status = (url.searchParams.get("status") ?? "").trim();
  const format = (url.searchParams.get("format") ?? "csv").trim().toLowerCase();
  const coreData = await getWarehouseCoreData();

  const rows = coreData.customers
    .filter((customer) => !customerCode || customer.customerCode.toUpperCase() === customerCode)
    .map((customer) => {
      const risk = evaluateCustomerCreditRisk(coreData, customer.customerCode);
      const openBillingRecords = coreData.billingRecords.filter((record) => record.customerCode === customer.customerCode && record.status !== "paid");
      const latestDueDate = openBillingRecords
        .map((record) => record.dueDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(0);
      return {
        customerCode: customer.customerCode,
        companyName: customer.companyName,
        customerStatus: customer.status,
        riskStatus: risk.status,
        billingCycle: customer.billingCycle,
        paymentTermDays: customer.paymentTermDays ?? "",
        creditLimit: risk.creditLimit ?? "",
        creditRemaining: risk.creditRemaining ?? "",
        outstandingAmount: risk.outstandingAmount,
        overdueAmount: risk.overdueAmount,
        overdueCount: risk.overdueCount,
        openBillingCount: openBillingRecords.length,
        latestDueDate: latestDueDate ?? "",
        reasons: risk.reasons,
        checkedAt: risk.checkedAt,
      };
    })
    .filter((row) => !status || row.riskStatus === status)
    .sort((a, b) => {
      const rank: Record<string, number> = { blocked: 0, warning: 1, clear: 2 };
      return rank[a.riskStatus] - rank[b.riskStatus] || b.overdueAmount - a.overdueAmount || b.outstandingAmount - a.outstandingAmount;
    });

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "customer-credit",
      summary: "导出客户信用风险报表",
      note: `状态：${status || "全部"}；客户：${customerCode || "全部"}；行数：${rows.length}`,
    });
  }

  if (format === "json") return NextResponse.json({ rows });

  return csvResponse("客户信用风险报表.csv", [
    ["客户编号", "公司名称", "客户状态", "风险状态", "结算方式", "账期天数", "信用额度", "额度剩余", "未结金额", "逾期金额", "逾期笔数", "未结账单数", "最近到期日", "风险原因", "检查时间"],
    ...rows.map((row) => [
      row.customerCode,
      row.companyName,
      customerStatusLabel(row.customerStatus),
      riskStatusLabel(row.riskStatus),
      billingCycleLabel(row.billingCycle),
      row.paymentTermDays,
      row.creditLimit,
      row.creditRemaining,
      row.outstandingAmount,
      row.overdueAmount,
      row.overdueCount,
      row.openBillingCount,
      row.latestDueDate,
      row.reasons.join("；"),
      row.checkedAt,
    ]),
  ]);
}
