import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getSubmissions, type InboundReceivingException, type InboundSubmission } from "@/lib/localStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { billingStatusLabel, getWarehouseCoreData, returnOrderStatusLabel, type BillingRecord, type CoreOutboundOrder, type InventoryBalance, type OutboundExceptionRecord, type ReturnOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type ExceptionRow = {
  module: string;
  exceptionId: string;
  sourceId: string;
  customerCode: string;
  type: string;
  status: string;
  severity: "提醒" | "严重";
  summary: string;
  owner: string;
  nextAction: string;
  createdAt?: string;
  resolvedAt?: string;
};

const inboundExceptionTypeLabel: Record<InboundReceivingException["type"], string> = {
  short_received: "少收",
  over_received: "多收",
  damaged: "破损",
  sku_mismatch: "SKU不符",
  label_issue: "标签异常",
  missing_document: "资料缺失",
  manual: "人工异常",
};

const exceptionStatusLabel = {
  open: "待处理",
  investigating: "处理中",
  resolved: "已处理",
  ignored: "已忽略",
} as const;

const outboundExceptionTypeLabel: Record<OutboundExceptionRecord["type"], string> = {
  wrong_sku: "SKU扫描不符",
  duplicate_scan: "重复扫描",
  over_scan: "超量扫描",
  missing_task: "未匹配任务",
  intercept_blocked: "截单阻塞",
  delivery_failed: "派送失败",
  address_issue: "地址异常",
  customer_absent: "收件人不在",
  damaged: "物流破损",
  lost: "疑似丢件",
  return_to_sender: "退回发件人",
  claim: "赔付处理",
  proof_uploaded: "签收证明",
  manual: "人工异常",
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

function inboundRows(inbounds: InboundSubmission[]): ExceptionRow[] {
  return inbounds.flatMap((inbound) => {
    const customerCode = inbound.customerCode || inbound.customer || "";
    const receivingRows = (inbound.receivingExceptions ?? []).map((exception) => ({
      module: "入库",
      exceptionId: exception.id,
      sourceId: inbound.id,
      customerCode,
      type: inboundExceptionTypeLabel[exception.type] ?? exception.type,
      status: exceptionStatusLabel[exception.status],
      severity: exception.severity === "critical" ? "严重" as const : "提醒" as const,
      summary: exception.message,
      owner: exception.operator,
      nextAction: exception.status === "resolved" || exception.status === "ignored" ? exception.resolutionNote ?? "已关闭" : "核对实收、照片和客户资料，必要时同步客户确认",
      createdAt: exception.createdAt,
      resolvedAt: exception.resolvedAt,
    }));

    if (!inbound.exceptionNote || !["exception", "on_hold"].includes(inbound.status)) return receivingRows;
    return [
      ...receivingRows,
      {
        module: "入库",
        exceptionId: `${inbound.id}-STATUS`,
        sourceId: inbound.id,
        customerCode,
        type: "入库状态异常",
        status: inbound.status === "on_hold" ? "暂缓处理" : "异常处理中",
        severity: "提醒" as const,
        summary: inbound.exceptionNote,
        owner: "运营/仓库",
        nextAction: "补齐资料、预约或差异处理后推进状态",
        createdAt: inbound.updatedAt ?? inbound.createdAt,
      },
    ];
  });
}

function outboundRows(outbounds: CoreOutboundOrder[]): ExceptionRow[] {
  return outbounds.flatMap((order) =>
    (order.exceptions ?? []).map((exception) => ({
      module: exception.deliveryExceptionType ? "物流" : "出库",
      exceptionId: exception.id,
      sourceId: order.id,
      customerCode: order.customerCode,
      type: outboundExceptionTypeLabel[exception.type] ?? exception.type,
      status: exceptionStatusLabel[exception.status],
      severity: exception.severity === "critical" ? "严重" as const : "提醒" as const,
      summary: exception.message,
      owner: exception.operator,
      nextAction:
        exception.status === "resolved" || exception.status === "ignored"
          ? exception.resolutionNote ?? "已关闭"
          : exception.redeliveryRequired
            ? `需要改派：${exception.redeliveryNote || "等待客户确认"}`
            : exception.claimStatus && exception.claimStatus !== "not_required"
              ? `赔付状态：${exception.claimStatus}`
              : "继续处理异常并同步客户/承运商",
      createdAt: exception.createdAt,
      resolvedAt: exception.resolvedAt,
    })),
  );
}

function returnRows(returns: ReturnOrder[]): ExceptionRow[] {
  return returns
    .filter((item) => item.status === "exception" || (["received", "inspection", "repair"].includes(item.status) && !item.customerResolutionDecision))
    .map((item) => ({
      module: "退货/RMA",
      exceptionId: `${item.id}-${item.status}`,
      sourceId: item.id,
      customerCode: item.customerCode,
      type: item.status === "exception" ? "退货异常" : "客户待确认",
      status: returnOrderStatusLabel(item.status),
      severity: item.status === "exception" ? "严重" as const : "提醒" as const,
      summary: item.inspectionResult || item.returnReason,
      owner: "售后/仓库",
      nextAction: item.customerResolutionDecision ? "按客户确认方式处理" : "等待客户确认重新上架、维修、报废或转寄",
      createdAt: item.updatedAt ?? item.createdAt,
      resolvedAt: item.closedAt,
    }));
}

function inventoryRows(balances: InventoryBalance[]): ExceptionRow[] {
  return balances
    .filter((item) => item.availableQty < item.alertQty || item.frozenQty > 0 || item.defectiveQty > 0 || item.agingDays >= 120)
    .map((item) => {
      const reasons = [
        item.availableQty < item.alertQty ? "低于预警库存" : "",
        item.frozenQty > 0 ? `冻结 ${item.frozenQty}` : "",
        item.defectiveQty > 0 ? `残次品 ${item.defectiveQty}` : "",
        item.agingDays >= 120 ? `库龄 ${item.agingDays} 天` : "",
      ].filter(Boolean);
      return {
        module: "库存",
        exceptionId: `INV-${item.customerCode}-${item.skuCode}-${item.locationCode || item.warehouseCode}`,
        sourceId: item.skuCode,
        customerCode: item.customerCode,
        type: "库存风险",
        status: "待处理",
        severity: item.availableQty < 0 || item.agingDays >= 365 ? "严重" as const : "提醒" as const,
        summary: `${item.warehouseCode}/${item.locationCode || "-"}：${reasons.join("；")}`,
        owner: "仓库/运营",
        nextAction: "发起补货、移库、盘点、冻结解除或残次品处理",
        createdAt: item.updatedAt,
      };
    });
}

function billingRows(records: BillingRecord[], outbounds: CoreOutboundOrder[], nowMs: number): ExceptionRow[] {
  const billingExceptions = records
    .filter((item) => item.dueDate && new Date(item.dueDate).getTime() < nowMs && item.status !== "paid")
    .map((item) => ({
      module: "费用/账单",
      exceptionId: `${item.id}-OVERDUE`,
      sourceId: item.id,
      customerCode: item.customerCode,
      type: "账单逾期",
      status: billingStatusLabel(item.status),
      severity: "严重" as const,
      summary: `到期日 ${item.dueDate}，金额 £${item.amount.toFixed(2)}`,
      owner: "财务",
      nextAction: "联系客户付款或登记争议/核销记录",
      createdAt: item.updatedAt ?? item.createdAt,
    }));

  const freightExceptions = outbounds
    .filter((item) => typeof item.shippingFee === "number" && typeof item.actualShippingFee === "number" && Math.abs(item.actualShippingFee - item.shippingFee) >= 1)
    .map((item) => ({
      module: "费用/账单",
      exceptionId: `${item.id}-FREIGHT-DIFF`,
      sourceId: item.id,
      customerCode: item.customerCode,
      type: "运费差异",
      status: "待核对",
      severity: Math.abs((item.actualShippingFee ?? 0) - (item.shippingFee ?? 0)) >= 5 ? "严重" as const : "提醒" as const,
      summary: `预估 £${item.shippingFee?.toFixed(2)}，实际 £${item.actualShippingFee?.toFixed(2)}`,
      owner: "财务/物流",
      nextAction: "核对承运商账单并生成差异费用或调整记录",
      createdAt: item.shippingFeeCheckedAt ?? item.updatedAt ?? item.createdAt,
    }));

  return [...billingExceptions, ...freightExceptions];
}

function applyFilters(rows: ExceptionRow[], url: URL) {
  const moduleFilter = url.searchParams.get("module")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const severity = url.searchParams.get("severity")?.trim();
  const customerCode = url.searchParams.get("customerCode")?.trim().toUpperCase();
  const keyword = url.searchParams.get("keyword")?.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.module, row.exceptionId, row.sourceId, row.customerCode, row.type, row.status, row.severity, row.summary, row.owner, row.nextAction].join(" ").toLowerCase();
    return (
      (!moduleFilter || moduleFilter === "all" || row.module === moduleFilter) &&
      (!status || status === "all" || row.status === status) &&
      (!severity || severity === "all" || row.severity === severity) &&
      (!customerCode || row.customerCode.toUpperCase() === customerCode) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出异常报表" }, { status: 403 });

  const url = new URL(request.url);
  const [submissions, coreData] = await Promise.all([getSubmissions(), getWarehouseCoreData()]);
  const inbounds = submissions.filter((item): item is InboundSubmission => item.type === "inbound");
  const rows = applyFilters(
    [
      ...inboundRows(inbounds),
      ...outboundRows(coreData.outboundOrders),
      ...returnRows(coreData.returnOrders),
      ...inventoryRows(coreData.inventoryBalances),
      ...billingRows(coreData.billingRecords, coreData.outboundOrders, Date.now()),
    ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()),
    url,
  );

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName,
      targetType: "report",
      targetId: "exception-center",
      summary: "导出异常中心报表",
      note: "跨入库、出库、物流、退货、库存和费用汇总",
      after: {
        module: url.searchParams.get("module") ?? "all",
        status: url.searchParams.get("status") ?? "all",
        severity: url.searchParams.get("severity") ?? "all",
        customerCode: url.searchParams.get("customerCode") ?? "",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  return csvResponse("运营异常中心报表.csv", [
    ["模块", "异常编号", "关联单号/SKU", "客户编号", "异常类型", "状态", "严重程度", "异常说明", "负责人", "下一步动作", "创建时间", "关闭时间"],
    ...rows.map((row) => [row.module, row.exceptionId, row.sourceId, row.customerCode, row.type, row.status, row.severity, row.summary, row.owner, row.nextAction, row.createdAt ?? "", row.resolvedAt ?? ""]),
  ]);
}
