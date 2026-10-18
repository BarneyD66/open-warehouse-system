import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import {
  approvalRuleForTrigger,
  approvalRuleNote,
  getOpsExpansionData,
  type CustomerWorkOrder,
} from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import {
  billingStatusLabel,
  getWarehouseCoreData,
  type BillingAdjustmentKind,
  type BillingRecord,
  type WarehouseCoreData,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type FinanceAdjustmentRisk = "高风险" | "关注" | "正常";

type FinanceAdjustmentRow = {
  rowId: string;
  rowType: "待复核工单" | "费用调账账单" | "赔付抵扣账单";
  riskLevel: FinanceAdjustmentRisk;
  customerCode: string;
  companyName: string;
  workOrderId: string;
  billingId: string;
  sourceBillingId: string;
  adjustmentKind: string;
  approvalStatus: string;
  approvalRule: string;
  approvalRuleNote: string;
  attachmentStatus: string;
  amount: number;
  currency: "GBP" | "";
  status: string;
  approvalHint: string;
  missingRequirement: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  nextAction: string;
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

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function workOrderStatusLabel(status: CustomerWorkOrder["status"]) {
  const labels: Record<CustomerWorkOrder["status"], string> = {
    open: "待处理",
    processing: "处理中",
    waiting_customer: "待客户补充",
    resolved: "已解决",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function adjustmentLabel(kind?: BillingAdjustmentKind) {
  if (kind === "fee_adjustment") return "费用调账";
  if (kind === "compensation") return "赔付抵扣";
  return "";
}

function adjustmentApprovalStatusLabel(record: BillingRecord) {
  const value = record.adjustmentApprovalStatus;
  if (value === "pending_approval") return "待审批";
  if (value === "approved") return "已审批";
  if (value === "posted") return "已入账";
  if (value === "rejected") return "已驳回/有争议";
  if (value === "paid") return "已核销";
  if (record.status === "paid") return "已核销";
  if (record.status === "confirmed") return "已入账";
  if (record.status === "payment_submitted") return "待核销";
  if (record.status === "disputed") return "已驳回/有争议";
  return "已审批";
}

function attachmentStatusLabel(record: BillingRecord) {
  if (record.adjustmentAttachmentStatus === "archived") return "附件已归档";
  if (record.adjustmentAttachmentStatus === "confirmed") return "人工确认已归档";
  if (record.adjustmentAttachmentStatus === "missing") return "缺少附件";
  if (record.adjustmentAttachmentStatus === "not_required") return "不要求附件";
  return "";
}

function triggerFor(kind?: BillingAdjustmentKind) {
  return kind === "compensation" ? "claim_approval" : "manual_fee_adjustment";
}

function workOrderRisk(item: CustomerWorkOrder): FinanceAdjustmentRisk {
  if (item.priority === "urgent" || item.riskTag === "logistics_fee_review") return "高风险";
  if (item.financeReviewRequired || item.riskTag === "billing_dispute") return "关注";
  return "正常";
}

function billingRisk(record: BillingRecord, approvalHint: string): FinanceAdjustmentRisk {
  const amount = Math.abs(record.amount);
  if (amount >= 100 || approvalHint.includes("必须上传附件")) return "高风险";
  if (amount > 0 || record.status === "disputed") return "关注";
  return "正常";
}

function customerName(data: WarehouseCoreData, customerCode: string) {
  return data.customers.find((item) => item.customerCode === customerCode)?.companyName ?? "";
}

function buildRows(coreData: WarehouseCoreData, expansionData: Awaited<ReturnType<typeof getOpsExpansionData>>): FinanceAdjustmentRow[] {
  const pendingWorkOrders = expansionData.selfServiceWorkOrders
    .filter((item) => item.financeReviewRequired && item.status !== "resolved" && item.status !== "cancelled")
    .map((item) => {
      const riskLevel = workOrderRisk(item);
      const approvalHint = "等待财务选择维持原账单、同意调账或赔付抵扣；若命中审批规则，需要按角色、原因、附件和二次确认处理。";
      return {
        rowId: `WO-${item.id}`,
        rowType: "待复核工单" as const,
        riskLevel,
        customerCode: item.customerCode,
        companyName: customerName(coreData, item.customerCode),
        workOrderId: item.id,
        billingId: item.referenceNo ?? "",
        sourceBillingId: "",
        adjustmentKind: "",
        approvalStatus: riskLevel === "高风险" ? "待优先复核" : "待财务复核",
        approvalRule: "",
        approvalRuleNote: "",
        attachmentStatus: "",
        amount: 0,
        currency: "" as const,
        status: workOrderStatusLabel(item.status),
        approvalHint,
        missingRequirement: "等待复核结论；如需调账/赔付，需要填写金额、说明和二次确认，命中规则时需归档审批附件。",
        note: item.internalNote || item.description || "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        nextAction: riskLevel === "高风险" ? "财务或管理员优先复核，确认是否产生调账/赔付。" : "按工单队列完成账单争议复核。",
      };
    });

  const adjustmentBills = coreData.billingRecords
    .filter((record) => record.adjustmentKind)
    .map((record) => {
      const rule = approvalRuleForTrigger(expansionData, triggerFor(record.adjustmentKind), Math.abs(record.amount), 1);
      const approvalHint = approvalRuleNote(rule);
      const riskLevel = billingRisk(record, approvalHint);
      const sourceRecord = record.adjustmentSourceRecordId ? coreData.billingRecords.find((item) => item.id === record.adjustmentSourceRecordId) : undefined;
      const missing = [
        record.workOrderId ? "" : "缺少来源工单",
        record.adjustmentSourceRecordId ? "" : "缺少来源账单",
        sourceRecord || !record.adjustmentSourceRecordId ? "" : "来源账单未找到",
      ].filter(Boolean);
      return {
        rowId: `BILL-${record.id}`,
        rowType: record.adjustmentKind === "compensation" ? ("赔付抵扣账单" as const) : ("费用调账账单" as const),
        riskLevel,
        customerCode: record.customerCode,
        companyName: customerName(coreData, record.customerCode),
        workOrderId: record.workOrderId ?? "",
        billingId: record.id,
        sourceBillingId: record.adjustmentSourceRecordId ?? "",
        adjustmentKind: adjustmentLabel(record.adjustmentKind),
        approvalStatus: adjustmentApprovalStatusLabel(record),
        approvalRule: record.adjustmentApprovalRuleName ?? rule?.name ?? "",
        approvalRuleNote: record.adjustmentApprovalRuleNote ?? approvalHint,
        attachmentStatus: attachmentStatusLabel(record),
        amount: money(record.amount),
        currency: record.currency,
        status: billingStatusLabel(record.status),
        approvalHint,
        missingRequirement: missing.join("；") || "已生成调账/赔付账单记录",
        note: record.note ?? "",
        createdAt: record.createdAt,
        updatedAt: record.generatedAt ?? record.createdAt,
        nextAction: record.status === "paid" ? "已核销，保留审计追溯。" : "跟进客户账单确认、月结抵扣或付款核销。",
      };
    });

  return [...pendingWorkOrders, ...adjustmentBills];
}

function applyFilters(rows: FinanceAdjustmentRow[], url: URL) {
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const kind = clean(url.searchParams.get("kind"));
  const risk = clean(url.searchParams.get("risk"));
  const status = clean(url.searchParams.get("status"));
  const approvalStatus = clean(url.searchParams.get("approvalStatus"));
  const attachmentStatus = clean(url.searchParams.get("attachmentStatus"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();

  return rows
    .filter((row) => (!customerCode || row.customerCode.toLowerCase().includes(customerCode)))
    .filter((row) => {
      if (!kind || kind === "all") return true;
      if (kind === "work_order") return row.rowType === "待复核工单";
      if (kind === "fee_adjustment") return row.adjustmentKind === "费用调账";
      if (kind === "compensation") return row.adjustmentKind === "赔付抵扣";
      return row.rowType === kind || row.adjustmentKind === kind;
    })
    .filter((row) => (!risk || risk === "all" || row.riskLevel === risk))
    .filter((row) => (!status || status === "all" || row.status === status || row.rowType === status))
    .filter((row) => (!approvalStatus || approvalStatus === "all" || row.approvalStatus === approvalStatus))
    .filter((row) => {
      if (!attachmentStatus || attachmentStatus === "all") return true;
      if (attachmentStatus === "附件已确认") return row.attachmentStatus === "人工确认已归档" || row.attachmentStatus === "附件已确认";
      if (attachmentStatus === "附件待补") return row.attachmentStatus === "缺少附件" || row.attachmentStatus === "附件待补";
      if (attachmentStatus === "无需附件") return row.attachmentStatus === "不要求附件" || row.attachmentStatus === "无需附件";
      return row.attachmentStatus === attachmentStatus;
    })
    .filter((row) => {
      if (!keyword) return true;
      return [
        row.rowId,
        row.customerCode,
        row.companyName,
        row.workOrderId,
        row.billingId,
        row.sourceBillingId,
        row.adjustmentKind,
        row.approvalStatus,
        row.approvalRule,
        row.approvalRuleNote,
        row.attachmentStatus,
        row.status,
        row.approvalHint,
        row.missingRequirement,
        row.note,
        row.nextAction,
      ].some((value) => value.toLowerCase().includes(keyword));
    });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出财务调账/赔付审批报表。" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(coreData, expansionData), url).sort((left, right) => {
    const riskOrder: Record<FinanceAdjustmentRisk, number> = { 高风险: 3, 关注: 2, 正常: 1 };
    return riskOrder[right.riskLevel] - riskOrder[left.riskLevel] || right.createdAt.localeCompare(left.createdAt) || left.customerCode.localeCompare(right.customerCode);
  });

  if (!["saved_view", "scheduled_report"].includes(url.searchParams.get("auditSource") ?? "")) {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "finance-adjustments",
      summary: "导出财务调账/赔付审批报表",
      note: `行数：${rows.length}`,
      after: {
        customerCode: url.searchParams.get("customerCode") ?? "",
        kind: url.searchParams.get("kind") ?? "all",
        risk: url.searchParams.get("risk") ?? "all",
        status: url.searchParams.get("status") ?? "all",
        approvalStatus: url.searchParams.get("approvalStatus") ?? "all",
        attachmentStatus: url.searchParams.get("attachmentStatus") ?? "all",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("财务调账赔付审批报表.csv", [
    [
      "记录编号",
      "记录类型",
      "风险等级",
      "客户编号",
      "公司名称",
      "来源工单",
      "账单编号",
      "来源账单",
      "调账/赔付类型",
      "审批/入账状态",
      "审批规则",
      "审批规则说明",
      "附件状态",
      "金额",
      "币种",
      "状态",
      "审批提示",
      "待补要求",
      "备注",
      "创建时间",
      "更新时间",
      "下一步处理",
    ],
    ...rows.map((row) => [
      row.rowId,
      row.rowType,
      row.riskLevel,
      row.customerCode,
      row.companyName,
      row.workOrderId,
      row.billingId,
      row.sourceBillingId,
      row.adjustmentKind,
      row.approvalStatus,
      row.approvalRule,
      row.approvalRuleNote,
      row.attachmentStatus,
      row.amount,
      row.currency,
      row.status,
      row.approvalHint,
      row.missingRequirement,
      row.note,
      row.createdAt,
      row.updatedAt,
      row.nextAction,
    ]),
  ]);
}
