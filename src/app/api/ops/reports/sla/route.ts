import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getSubmissions, inboundStatusLabel, type InboundSubmission } from "@/lib/localStore";
import { getOpsExpansionData, type CustomerWorkOrder } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { billingStatusLabel, getWarehouseCoreData, type BillingRecord, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type SlaModuleLabel = "入库" | "出库" | "物流" | "费用" | "账单" | "工单" | "财务复核";

type SlaReportFilters = {
  module?: string;
  customerCode?: string;
  result?: string;
  status?: string;
  range?: string;
  keyword?: string;
};

type SlaReportRow = {
  module: SlaModuleLabel;
  id: string;
  customerCode: string;
  status: string;
  metric: string;
  result: string;
  rule: string;
  occurredAt?: string;
};

const moduleAliases: Record<string, SlaModuleLabel[]> = {
  inbound: ["入库"],
  warehouse: ["入库", "出库"],
  outbound: ["出库"],
  orders: ["出库"],
  logistics: ["物流", "费用"],
  billing: ["账单", "财务复核"],
  profit: ["费用", "账单", "财务复核"],
  finance_review: ["财务复核"],
  work_order: ["工单"],
  work_orders: ["工单"],
  customer_service: ["工单"],
  sla: ["入库", "出库", "物流", "费用", "账单", "工单", "财务复核"],
  all: ["入库", "出库", "物流", "费用", "账单", "工单", "财务复核"],
};

const outboundStatusLabels: Record<CoreOutboundOrder["status"], string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待生成面单",
  packing_check: "打包复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
};

const workOrderStatusLabels: Record<CustomerWorkOrder["status"], string> = {
  open: "待处理",
  processing: "处理中",
  waiting_customer: "待客户补充",
  resolved: "已解决",
  cancelled: "已取消",
};

function hoursSince(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (Date.now() - time) / 36e5);
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

function inRange(value: string | undefined, range: string | undefined) {
  if (!range || range === "all") return true;
  const time = value ? new Date(value).getTime() : 0;
  if (!Number.isFinite(time) || time <= 0) return true;
  const ageHours = Math.max(0, (Date.now() - time) / 36e5);
  if (range === "today") return ageHours <= 24;
  if (range === "last_7_days") return ageHours <= 24 * 7;
  if (range === "last_30_days") return ageHours <= 24 * 30;
  return true;
}

function applyFilters(rows: SlaReportRow[], filters: SlaReportFilters) {
  const allowedModules = moduleAliases[(filters.module ?? "all").toLowerCase()] ?? moduleAliases.all;
  const customerCode = filters.customerCode?.toUpperCase();
  const keyword = filters.keyword?.toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.module, row.id, row.customerCode, row.status, row.metric, row.result, row.rule].join(" ").toLowerCase();
    return (
      allowedModules.includes(row.module) &&
      (!customerCode || row.customerCode.toUpperCase() === customerCode) &&
      (!filters.result || filters.result === "all" || row.result === filters.result) &&
      (!filters.status || filters.status === "all" || row.status === filters.status) &&
      (!keyword || haystack.includes(keyword)) &&
      inRange(row.occurredAt, filters.range)
    );
  });
}

function inboundRows(inbounds: InboundSubmission[]): SlaReportRow[] {
  return inbounds
    .filter((item) => !["closed", "cancelled"].includes(item.status))
    .map((item): SlaReportRow => {
      const hours = Math.round(hoursSince(item.createdAt));
      const overdue = hours > 48 && !["putaway_completed", "closed"].includes(item.status);
      return {
        module: "入库",
        id: item.id,
        customerCode: item.customerCode || item.customer || "",
        status: inboundStatusLabel(item.status),
        metric: `${hours} 小时`,
        result: overdue ? "超时" : "正常",
        rule: "提交后 48 小时内完成上架或关闭",
        occurredAt: item.createdAt,
      };
    });
}

function outboundRows(outbounds: CoreOutboundOrder[]): SlaReportRow[] {
  return outbounds
    .filter((item) => item.status !== "shipped")
    .map((item) => {
      const hours = Math.round(hoursSince(item.createdAt));
      const overdue = hours > 24 && item.status !== "shipped";
      return {
        module: "出库",
        id: item.id,
        customerCode: item.customerCode,
        status: outboundStatusLabels[item.status] ?? item.status,
        metric: `${hours} 小时`,
        result: overdue ? "超时" : "正常",
        rule: "创建后 24 小时内完成发货",
        occurredAt: item.createdAt,
      };
    });
}

function logisticsRows(outbounds: CoreOutboundOrder[]): SlaReportRow[] {
  return outbounds
    .filter((item) => (item.exceptions ?? []).some((exception) => exception.status === "open" || exception.status === "investigating") || (item.trackingEvents ?? [])[0]?.status === "exception")
    .map((item) => ({
      module: "物流",
      id: item.id,
      customerCode: item.customerCode,
      status: item.trackingNumber || outboundStatusLabels[item.status] || item.status,
      metric: "",
      result: "异常",
      rule: "追踪异常、派送失败、改派或赔付未关闭",
      occurredAt: item.updatedAt ?? item.createdAt,
    }));
}

function feeRows(outbounds: CoreOutboundOrder[]): SlaReportRow[] {
  return outbounds
    .filter((item) => typeof item.shippingFee === "number" && typeof item.actualShippingFee === "number" && Math.abs(item.actualShippingFee - item.shippingFee) >= 1)
    .map((item) => ({
      module: "费用",
      id: item.id,
      customerCode: item.customerCode,
      status: item.trackingNumber || outboundStatusLabels[item.status] || item.status,
      metric: `£${item.shippingFee?.toFixed(2)} / £${item.actualShippingFee?.toFixed(2)}`,
      result: "差异",
      rule: "实际运费与预估运费差异达到 £1",
      occurredAt: item.updatedAt ?? item.createdAt,
    }));
}

function billingRows(records: BillingRecord[]): SlaReportRow[] {
  return records
    .filter((item) => item.dueDate && new Date(item.dueDate).getTime() < Date.now() && item.status !== "paid")
    .map((item) => ({
      module: "账单",
      id: item.id,
      customerCode: item.customerCode,
      status: billingStatusLabel(item.status),
      metric: item.dueDate || "",
      result: "逾期",
      rule: "账单到期但未支付",
      occurredAt: item.dueDate ?? item.createdAt,
    }));
}

function latestVisibleMessage(item: CustomerWorkOrder) {
  return (item.messages ?? []).filter((message) => message.visibleToCustomer).at(-1);
}

function workOrderRows(workOrders: CustomerWorkOrder[]): SlaReportRow[] {
  return workOrders
    .filter((item) => !["resolved", "cancelled"].includes(item.status))
    .map((item): SlaReportRow => {
      const hours = Math.round(hoursSince(item.updatedAt));
      const latest = latestVisibleMessage(item);
      const customerReplied = latest?.authorRole === "customer";
      const overdue = (item.status === "open" && hours > 24) || (item.status === "processing" && hours > 48);
      const waitingCustomer = item.status === "waiting_customer";
      const isFinanceReview = item.financeReviewRequired;
      return {
        module: isFinanceReview ? "财务复核" : "工单",
        id: item.id,
        customerCode: item.customerCode,
        status: workOrderStatusLabels[item.status] ?? item.status,
        metric: `${hours} 小时`,
        result: customerReplied ? "客户已回复" : overdue ? "超时" : waitingCustomer ? "待客户" : "正常",
        rule: isFinanceReview ? "财务复核待处理 24 小时、处理中 48 小时未推进视为超时；客户回复后优先处理" : "客户回复立即处理；运营待处理 24 小时、处理中 48 小时未推进视为超时",
        occurredAt: item.updatedAt ?? item.createdAt,
      };
    })
    .filter((item) => item.result !== "正常");
}

async function recordReportExport(input: { staffName: string; filters: SlaReportFilters; rowCount: number; direct: boolean }) {
  if (!input.direct) return;
  await recordAuditLog({
    action: "report_export",
    actorRole: "staff",
    actorName: input.staffName,
    targetType: "report",
    targetId: `sla-${input.filters.module || "all"}`,
    summary: "导出 SLA 与异常报表",
    note: "直接从运营报表按钮导出",
    after: {
      module: "sla",
      filters: input.filters,
      rowCount: input.rowCount,
    },
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出报表" }, { status: 403 });

  const url = new URL(request.url);
  const filters: SlaReportFilters = {
    module: clean(url.searchParams.get("module")),
    customerCode: clean(url.searchParams.get("customerCode")),
    result: clean(url.searchParams.get("result")),
    status: clean(url.searchParams.get("status")),
    range: clean(url.searchParams.get("range")),
    keyword: clean(url.searchParams.get("keyword")),
  };
  const [submissions, coreData] = await Promise.all([getSubmissions(), getWarehouseCoreData()]);
  const inbounds = submissions.filter((item): item is InboundSubmission => item.type === "inbound");
  const rows = applyFilters(
    [
      ...inboundRows(inbounds),
      ...outboundRows(coreData.outboundOrders),
      ...logisticsRows(coreData.outboundOrders),
      ...feeRows(coreData.outboundOrders),
      ...billingRows(coreData.billingRecords),
      ...workOrderRows(expansionData.selfServiceWorkOrders),
    ],
    filters,
  );

  await recordReportExport({
    staffName: staff.displayName || staff.username,
    filters,
    rowCount: rows.length,
    direct: url.searchParams.get("auditSource") !== "saved_view",
  });

  return csvResponse("SLA与异常报表.csv", [
    ["模块", "单号", "客户编号", "状态/追踪", "耗时/金额", "结果", "口径"],
    ...rows.map((row) => [row.module, row.id, row.customerCode, row.status, row.metric, row.result, row.rule]),
  ]);
}
