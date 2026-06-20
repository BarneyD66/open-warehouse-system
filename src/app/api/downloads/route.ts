import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customerAuth";
import { billingExportRows } from "@/lib/billingUtils";
import { buildCustomerSelfServiceCenterData, customerSelfServiceActionCsvRows } from "@/lib/customerSelfServiceCenter";
import { documentCategoryLabel, documentRefLabel, documentScanStatusLabel, documentStorageProviderLabel, getDocumentsForCustomer, signDocumentToken } from "@/lib/documentStore";
import { getSubmissionsForCustomer, type InboundReceivingException, type InboundSubmission } from "@/lib/localStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import {
  billingStatusLabel,
  getWarehouseCoreDataForCustomer,
  outboundClaimStatusLabel,
  outboundCustomerExceptionDecisionLabel,
  outboundDeliveryExceptionTypeLabel,
  returnOrderStatusLabel,
  returnResolutionLabel,
  type ReturnOrder,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const outboundStatusLabel: Record<string, string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待面单",
  packing_check: "打包复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
};

const labelStatusLabel: Record<string, string> = {
  not_requested: "未申请",
  pending: "待生成",
  rated: "已计费",
  generated: "已生成",
  failed: "生成失败",
};

const exceptionStatusLabel: Record<string, string> = {
  open: "待处理",
  investigating: "处理中",
  resolved: "已处理",
  ignored: "已忽略",
};

const movementTypeLabel: Record<string, string> = {
  in: "入库",
  out: "出库",
  reserve: "预占",
  release: "释放",
  adjust: "调整",
};

const movementRefTypeLabel: Record<string, string> = {
  inbound: "入库单",
  outbound: "出库单",
  adjustment: "库存调整",
  stocktake: "盘点",
  replenishment: "补货",
  transfer: "调拨",
};

const lotStatusLabel: Record<string, string> = {
  active: "可用",
  reserved: "已预留",
  blocked: "已冻结",
  expired: "已过期",
  consumed: "已用完",
};

const inboundExceptionTypeLabel: Record<InboundReceivingException["type"], string> = {
  short_received: "少收",
  over_received: "多收",
  damaged: "破损",
  sku_mismatch: "SKU 不符",
  label_issue: "标签异常",
  missing_document: "资料缺失",
  manual: "人工异常",
};

const selfServiceDownloadCatalog = [
  { name: "自助操作清单", kind: "self-service-actions", description: "汇总待确认、待付款、异常确认、可下载面单、签收证明和工单下一步。" },
  { name: "资料归档清单", kind: "documents", description: "查看已上传和运营归档的资料文件、关联单号、分类和下载入口。" },
  { name: "库存报表", kind: "inventory", description: "查看 SKU 当前可用、占用、冻结、残次和在途库存。" },
  { name: "库龄分析", kind: "inventory-aging", description: "按库龄分组查看库存风险，辅助补货和清仓判断。" },
  { name: "库存流水", kind: "inventory-movements", description: "查看入库、出库、预占、释放和调整记录。" },
  { name: "进销存报表", kind: "inventory-turnover", description: "查看期初估算、本期入库、本期出库和期末库存。" },
  { name: "批次效期库存", kind: "inventory-lots", description: "查看批次号、效期、库位和序列号明细。" },
  { name: "出库明细", kind: "outbound", description: "查看出库单、SKU 明细、收件信息、追踪号和轨迹。" },
  { name: "出库复核状态", kind: "outbound-review", description: "查看拣货、分拣、复核、截单、称重和异常进度。" },
  { name: "费用明细", kind: "billing", description: "查看仓租、操作费、物流费、退货费和账单状态。" },
  { name: "付款核销记录", kind: "payment-reconciliation", description: "查看付款参考号、到账核销、驳回和争议处理记录。" },
  { name: "面单列表", kind: "labels", description: "查看已生成面单的出库单和面单下载入口。" },
  { name: "签收证明", kind: "proofs", description: "查看已签收订单和签收证明入口。" },
  { name: "物流证据包", kind: "logistics-evidence", description: "一表汇总面单、签收证明、轨迹、异常、赔付和运费差异说明。" },
  { name: "我的异常中心", kind: "exceptions", description: "汇总入库、库存、出库、物流、退货和账单异常。" },
  { name: "物流异常与赔付", kind: "delivery-exceptions", description: "查看派送失败、改派、签收证明、赔付和客户确认结果。" },
  { name: "退货质检明细", kind: "returns", description: "查看退货 RMA、质检结果、处理方式和售后工单。" },
] as const;

type CustomerReturnFilter = "all" | "submitted" | "in-transit" | "inspection" | "needs-decision" | "done";

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

function signedDocumentDownloadHref(id: string) {
  const token = signDocumentToken(id, Date.now() + 30 * 60 * 1000);
  return `/api/documents/${encodeURIComponent(id)}/download?token=${encodeURIComponent(token)}`;
}

function balanceTotal(item: { availableQty: number; reservedQty: number; frozenQty?: number; defectiveQty?: number; inboundQty: number }) {
  return item.availableQty + item.reservedQty + (item.frozenQty ?? 0) + (item.defectiveQty ?? 0) + item.inboundQty;
}

function outboundRequiredQty(item: Awaited<ReturnType<typeof getWarehouseCoreDataForCustomer>>["outboundOrders"][number]) {
  return item.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function outboundScannedQty(values?: Record<string, number>) {
  return Object.values(values ?? {}).reduce((sum, value) => sum + value, 0);
}

function outboundReviewResult(item: Awaited<ReturnType<typeof getWarehouseCoreDataForCustomer>>["outboundOrders"][number]) {
  const required = outboundRequiredQty(item);
  const picked = outboundScannedQty(item.scanProgress?.pickedQtyBySku);
  const sorted = outboundScannedQty(item.scanProgress?.sortedQtyBySku);
  const packed = outboundScannedQty(item.scanProgress?.packedQtyBySku);
  const openExceptions = (item.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
  if (item.interceptStatus === "requested" || item.interceptStatus === "restock_pending") return "截单处理中";
  if (item.interceptStatus === "completed") return "已截单回库";
  if (item.status === "handover" && !item.packageWeightKg) return "待称重签出";
  if (openExceptions.some((exception) => exception.severity === "critical")) return "严重异常待处理";
  if (required > 0 && (picked < required || sorted < required || packed < required)) return "复核数量缺口";
  if (item.status === "pending_review") return "待审核";
  if (item.status === "shipped") return "已发货";
  return "正常处理中";
}

function outboundNextAction(result: string) {
  if (result === "截单处理中") return "等待运营审批截单并更新库存";
  if (result === "待称重签出") return "等待仓库完成称重并交接承运商";
  if (result === "复核数量缺口" || result === "严重异常待处理") return "等待仓库/运营复核异常并反馈处理结果";
  if (result === "已发货") return "可查看轨迹或下载签收证明";
  return "等待仓库继续处理";
}

function normalizeCustomerReturnFilter(value: string | null): CustomerReturnFilter {
  if (value === "submitted" || value === "in-transit" || value === "inspection" || value === "needs-decision" || value === "done") return value;
  return "all";
}

function filterCustomerReturns(items: ReturnOrder[], filter: CustomerReturnFilter, keyword = "") {
  const byStatus =
    filter === "submitted"
      ? items.filter((item) => item.status === "requested" || item.status === "label_sent")
      : filter === "in-transit"
        ? items.filter((item) => item.status === "in_transit")
        : filter === "inspection"
          ? items.filter((item) => item.status === "received" || item.status === "inspection")
          : filter === "needs-decision"
            ? items.filter((item) => ["received", "inspection", "repair", "exception"].includes(item.status) && !item.customerResolutionDecision)
            : filter === "done"
              ? items.filter((item) => item.status === "restocked" || item.status === "disposed" || item.status === "closed")
              : items;
  const query = keyword.trim().toLowerCase();
  if (!query) return byStatus;
  return byStatus.filter((item) =>
    [item.id, item.platform, item.originalOrderNo, item.buyerReturnTracking, item.returnReason, ...item.skuLines.map((line) => line.skuCode)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function isCustomerInbound(item: Awaited<ReturnType<typeof getSubmissionsForCustomer>>[number]): item is InboundSubmission {
  return item.type === "inbound";
}

export async function GET(request: Request) {
  const session = await requireCustomerSession();
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "inventory";
  const orderId = url.searchParams.get("orderId")?.trim();
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  const documents = await getDocumentsForCustomer(session.customerCode);
  const scopedOutboundOrders = orderId ? data.outboundOrders.filter((item) => item.id === orderId) : data.outboundOrders;

  if (kind === "self-service-actions") {
    const [submissions, expansionData] = await Promise.all([getSubmissionsForCustomer(session.customerCode), getOpsExpansionData()]);
    const workOrders = expansionData.selfServiceWorkOrders.filter((item) => item.customerCode === session.customerCode);
    const center = buildCustomerSelfServiceCenterData({
      customerCode: session.customerCode,
      submissions,
      coreData: data,
      documents,
      workOrders,
    });
    return csvResponse(`客户自助操作清单-${session.customerCode}.csv`, customerSelfServiceActionCsvRows(center));
  }

  if (kind === "self-service-index") {
    const expansionData = await getOpsExpansionData();
    const submissions = await getSubmissionsForCustomer(session.customerCode);
    const workOrders = expansionData.selfServiceWorkOrders.filter((item) => item.customerCode === session.customerCode);
    const center = buildCustomerSelfServiceCenterData({
      customerCode: session.customerCode,
      submissions,
      coreData: data,
      documents,
      workOrders,
    });
    const counts: Record<string, number> = {
      "self-service-actions": center.actions.length,
      inventory: data.inventoryBalances.length,
      "inventory-aging": data.inventoryBalances.length,
      "inventory-movements": data.inventoryMovements.length,
      "inventory-turnover": data.inventoryBalances.length,
      "inventory-lots": data.inventoryLots.length,
      outbound: data.outboundOrders.length,
      "outbound-review": data.outboundOrders.length,
      billing: data.billingRecords.length,
      "payment-reconciliation": data.billingRecords.filter((item) => item.paymentReference || item.statementPaymentReference || item.status === "paid" || item.status === "payment_submitted" || item.paymentRejectedAt || item.statementPaymentRejectedAt).length,
      labels: data.outboundOrders.filter((item) => item.labelStatus === "generated").length,
      proofs: data.outboundOrders.filter((item) => item.trackingEvents?.some((event) => event.status === "delivered") || item.exceptions?.some((exception) => exception.proofUrl)).length,
      "logistics-evidence": data.outboundOrders.filter((item) => item.labelStatus === "generated" || item.trackingNumber || item.trackingEvents?.length || item.exceptions?.length || typeof item.actualShippingFee === "number").length,
      exceptions: data.outboundOrders.filter((item) => item.exceptions?.length).length + data.returnOrders.filter((item) => item.status === "exception").length + data.inventoryBalances.filter((item) => item.availableQty < item.alertQty || (item.frozenQty ?? 0) > 0 || (item.defectiveQty ?? 0) > 0).length,
      "delivery-exceptions": data.outboundOrders.reduce((sum, item) => sum + (item.exceptions?.length ?? 0), 0),
      returns: data.returnOrders.length,
      documents: documents.length,
    };
    const reportRows = selfServiceDownloadCatalog.map((item) => ["业务报表", item.name, item.description, `/api/downloads?kind=${item.kind}`, counts[item.kind] > 0 ? `已有 ${counts[item.kind]} 条相关数据` : "暂无数据，也可下载空表结构", "客户登录后仅能导出自己客户编号下的数据"]);
    const templateRows = expansionData.selfService.templates.map((item) => ["模板文件", item.name, item.description, item.href, "可下载", "用于整理并批量提交业务资料"]);

    return csvResponse(`自助下载资料索引-${session.customerCode}.csv`, [
      ["类型", "名称", "说明", "下载地址", "当前状态", "备注"],
      ...reportRows,
      ...templateRows,
      ["工单服务", "客户工单", "提交异常、售后、资料补充、账单争议和物流问题。", "/portal#work-orders", "可使用", `可选类型：${expansionData.selfService.workOrderCategories.join("、")}`],
    ]);
  }

  if (kind === "inventory") {
    return csvResponse(`库存报表-${session.customerCode}.csv`, [
      ["客户编号", "SKU 编码", "仓库编号", "库位编码", "可用库存", "销售占用", "冻结库存", "残次品库存", "在途入库", "库存合计", "预警库存", "库龄天数", "更新时间"],
      ...data.inventoryBalances.map((item) => [item.customerCode, item.skuCode, item.warehouseCode, item.locationCode ?? "", item.availableQty, item.reservedQty, item.frozenQty ?? 0, item.defectiveQty ?? 0, item.inboundQty, balanceTotal(item), item.alertQty, item.agingDays, item.updatedAt]),
    ]);
  }

  if (kind === "documents") {
    return csvResponse(`资料归档清单-${session.customerCode}.csv`, [
      ["文件编号", "文件名", "业务类型", "关联单号", "资料分类", "文件大小", "存储位置", "安全状态", "安全说明", "上传来源", "上传人", "上传时间", "可预览", "预览链接", "下载链接", "备注"],
      ...documents.map((item) => [
        item.id,
        item.originalName,
        documentRefLabel(item.refType),
        item.refId,
        documentCategoryLabel(item.category),
        item.size,
        documentStorageProviderLabel(item.storageProvider),
        documentScanStatusLabel(item.scanStatus),
        item.scanNote ?? "",
        item.uploadedByRole === "customer" ? "客户上传" : "运营上传",
        item.uploadedBy,
        item.uploadedAt,
        item.previewAllowed && item.scanStatus === "clean" ? "是" : "否",
        item.previewAllowed && item.scanStatus === "clean" ? `/api/documents/${item.id}/preview` : "",
        item.scanStatus === "clean" ? signedDocumentDownloadHref(item.id) : "",
        item.note ?? "",
      ]),
    ]);
  }

  if (kind === "inventory-aging") {
    return csvResponse(`库龄分析-${session.customerCode}.csv`, [
      ["客户编号", "SKU 编码", "仓库编号", "库位编码", "库存合计", "可用库存", "冻结库存", "残次品库存", "库龄天数", "库龄分组", "风险提示", "更新时间"],
      ...data.inventoryBalances.map((item) => {
        const bucket = item.agingDays >= 365 ? "365 天以上" : item.agingDays >= 180 ? "180-365 天" : item.agingDays >= 90 ? "90-180 天" : item.agingDays >= 30 ? "30-90 天" : "0-30 天";
        const risk = [item.availableQty < item.alertQty ? "低于预警库存" : "", item.agingDays >= 120 ? "库龄偏高" : "", (item.frozenQty ?? 0) > 0 ? "存在冻结库存" : "", (item.defectiveQty ?? 0) > 0 ? "存在残次品库存" : ""].filter(Boolean).join("；");
        return [item.customerCode, item.skuCode, item.warehouseCode, item.locationCode ?? "", balanceTotal(item), item.availableQty, item.frozenQty ?? 0, item.defectiveQty ?? 0, item.agingDays, bucket, risk || "正常", item.updatedAt];
      }),
    ]);
  }

  if (kind === "inventory-movements") {
    return csvResponse(`库存流水-${session.customerCode}.csv`, [
      ["流水编号", "客户编号", "SKU 编码", "业务类型", "关联单号", "变动类型", "变动数量", "变动前库存", "变动后库存", "备注", "操作人", "发生时间"],
      ...data.inventoryMovements.map((item) => [item.id, item.customerCode, item.skuCode, movementRefTypeLabel[item.refType] ?? item.refType, item.refId, movementTypeLabel[item.movementType] ?? item.movementType, item.quantity, item.beforeQty ?? "", item.afterQty ?? "", item.note ?? "", item.operator, item.occurredAt]),
    ]);
  }

  if (kind === "inventory-turnover") {
    const movementMap = new Map<string, { inbound: number; outbound: number; adjustment: number; release: number }>();
    data.inventoryMovements.forEach((movement) => {
      const key = `${movement.customerCode}:${movement.skuCode}`;
      const current = movementMap.get(key) ?? { inbound: 0, outbound: 0, adjustment: 0, release: 0 };
      if (movement.movementType === "in") current.inbound += movement.quantity;
      else if (movement.movementType === "out") current.outbound += movement.quantity;
      else if (movement.movementType === "adjust") current.adjustment += movement.quantity;
      else if (movement.movementType === "release") current.release += movement.quantity;
      movementMap.set(key, current);
    });
    return csvResponse(`进销存报表-${session.customerCode}.csv`, [
      ["客户编号", "SKU 编码", "仓库编号", "库位编码", "期初估算库存", "本期入库", "本期出库", "调整/释放", "期末库存", "可用库存", "占用库存", "在途库存"],
      ...data.inventoryBalances.map((item) => {
        const movement = movementMap.get(`${item.customerCode}:${item.skuCode}`) ?? { inbound: 0, outbound: 0, adjustment: 0, release: 0 };
        const adjustment = movement.adjustment + movement.release;
        const ending = balanceTotal(item);
        return [item.customerCode, item.skuCode, item.warehouseCode, item.locationCode ?? "", ending - movement.inbound + movement.outbound - adjustment, movement.inbound, movement.outbound, adjustment, ending, item.availableQty, item.reservedQty, item.inboundQty];
      }),
    ]);
  }

  if (kind === "inventory-lots") {
    return csvResponse(`批次效期库存-${session.customerCode}.csv`, [
      ["客户编号", "SKU 编码", "仓库编号", "库位编码", "批次号", "效期", "状态", "批次数量", "可用数量", "预留数量", "序列号数量", "序列号", "备注", "更新时间"],
      ...data.inventoryLots.map((item) => [item.customerCode, item.skuCode, item.warehouseCode, item.locationCode ?? "", item.lotNo, item.expiryDate ?? "", lotStatusLabel[item.status] ?? item.status, item.quantity, item.availableQty, item.reservedQty, item.serialNumbers?.length ?? 0, item.serialNumbers?.join(" | ") ?? "", item.note ?? "", item.updatedAt]),
    ]);
  }

  if (kind === "outbound") {
    return csvResponse(`出库明细-${session.customerCode}.csv`, [
      ["出库单号", "物流渠道", "订单数", "状态", "收件人", "追踪号", "承运商", "服务名称", "预计运费", "最新轨迹", "创建时间", "SKU 明细", "收件地址"],
      ...scopedOutboundOrders.map((item) => {
        const latest = item.trackingEvents?.[0];
        return [item.id, item.channel, item.orderCount, outboundStatusLabel[item.status] ?? item.status, item.recipientName ?? "", item.trackingNumber ?? "", item.carrierName ?? "", item.carrierServiceName ?? "", item.shippingFee ?? "", latest ? `${latest.label}${latest.detail ? `；${latest.detail}` : ""}` : "", item.createdAt, (item.skuLines ?? []).map((line) => `${line.skuCode} x ${line.quantity}`).join(" | "), item.deliveryAddress ?? ""];
      }),
    ]);
  }

  if (kind === "outbound-review") {
    return csvResponse(`出库复核状态-${session.customerCode}.csv`, [
      ["出库单号", "物流渠道", "状态", "复核结果", "应拣数量", "已拣数量", "已分拣数量", "已复核数量", "拣货缺口", "分拣缺口", "复核缺口", "未处理异常数", "严重异常数", "截单状态", "包裹重量KG", "包裹数", "追踪号", "客户可见下一步", "更新时间"],
      ...scopedOutboundOrders.map((item) => {
        const required = outboundRequiredQty(item);
        const picked = outboundScannedQty(item.scanProgress?.pickedQtyBySku);
        const sorted = outboundScannedQty(item.scanProgress?.sortedQtyBySku);
        const packed = outboundScannedQty(item.scanProgress?.packedQtyBySku);
        const openExceptions = (item.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
        const criticalExceptions = openExceptions.filter((exception) => exception.severity === "critical");
        const result = outboundReviewResult(item);
        return [item.id, item.channel, outboundStatusLabel[item.status] ?? item.status, result, required, picked, sorted, packed, Math.max(0, required - picked), Math.max(0, required - sorted), Math.max(0, required - packed), openExceptions.length, criticalExceptions.length, item.interceptStatus ?? "无", item.packageWeightKg ?? "", item.packageCount ?? "", item.trackingNumber ?? "", outboundNextAction(result), item.updatedAt ?? item.createdAt];
      }),
    ]);
  }

  if (kind === "billing") return csvResponse(`费用明细-${session.customerCode}.csv`, billingExportRows(data.billingRecords));

  if (kind === "payment-reconciliation") {
    return csvResponse(`付款核销记录-${session.customerCode}.csv`, [
      ["账单编号", "月结单号", "账单名称", "账单金额 GBP", "到期日", "账单状态", "核销状态", "付款参考号", "提交付款时间", "核销时间", "复核人", "驳回时间", "驳回原因", "争议说明", "下一步处理"],
      ...data.billingRecords.map((item) => {
        const status = item.status === "paid" ? "已核销" : item.status === "payment_submitted" ? "待财务复核" : item.status === "disputed" ? "争议处理中" : item.paymentRejectedAt || item.statementPaymentRejectedAt ? "已驳回待重提" : item.status === "confirmed" ? "已确认待付款" : item.status === "pending_confirmation" ? "待客户确认" : "草稿待确认";
        const nextAction = status === "已核销" ? "已完成，无需处理" : status === "待财务复核" ? "等待财务核对到账" : status === "争议处理中" ? "等待运营复核费用争议" : status === "已驳回待重提" ? "请重新提交付款参考号或凭证" : status === "已确认待付款" ? "请安排付款并提交付款参考号" : "请先确认费用";
        return [item.id, item.statementId ?? "", item.title, item.amount, item.dueDate ?? "", billingStatusLabel(item.status), status, item.paymentReference ?? item.statementPaymentReference ?? "", item.paymentSubmittedAt ?? item.statementPaymentSubmittedAt ?? "", item.statementPaidAt ?? (item.status === "paid" ? item.reviewedAt ?? "" : ""), item.statementPaidBy ?? item.reviewedBy ?? "", item.paymentRejectedAt ?? item.statementPaymentRejectedAt ?? "", item.paymentRejectionNote ?? item.statementPaymentRejectionNote ?? "", item.status === "disputed" ? item.customerMessage ?? item.statementCustomerMessage ?? "" : "", nextAction];
      }),
    ]);
  }

  if (kind === "labels") {
    return csvResponse(`面单列表-${session.customerCode}.csv`, [
      ["出库单号", "面单状态", "追踪号", "承运商", "服务名称", "收件人", "创建时间", "面单链接"],
      ...scopedOutboundOrders.map((item) => [item.id, labelStatusLabel[item.labelStatus ?? "not_requested"] ?? item.labelStatus ?? "未申请", item.trackingNumber ?? "", item.carrierName ?? "", item.carrierServiceName ?? "", item.recipientName ?? "", item.createdAt, item.labelStatus === "generated" ? `/api/outbounds/${item.id}/label` : ""]),
    ]);
  }

  if (kind === "proofs") {
    return csvResponse(`签收证明-${session.customerCode}.csv`, [
      ["出库单号", "追踪号", "签收状态", "签收证明链接", "最新节点", "最新说明", "最新地点", "发生时间"],
      ...scopedOutboundOrders.map((item) => {
        const delivered = item.trackingEvents?.find((event) => event.status === "delivered");
        const latest = item.trackingEvents?.[0];
        const proofException = item.exceptions?.find((event) => event.proofUrl);
        return [item.id, item.trackingNumber ?? "", delivered ? "已签收" : "待签收", proofException?.proofUrl ? `/api/outbounds/${item.id}/proof` : "", delivered?.label ?? latest?.label ?? "", delivered?.detail ?? latest?.detail ?? "", delivered?.location ?? latest?.location ?? "", delivered?.occurredAt ?? latest?.occurredAt ?? ""];
      }),
    ]);
  }

  if (kind === "logistics-evidence") {
    return csvResponse(`物流证据包-${session.customerCode}.csv`, [
      ["出库单号", "平台", "平台订单号", "物流渠道", "承运商", "服务", "追踪号", "面单状态", "面单链接", "签收状态", "签收证明链接", "最新轨迹", "轨迹说明", "轨迹地点", "轨迹时间", "物流异常数", "未处理异常数", "异常摘要", "赔付金额", "赔付状态", "客户确认", "预估运费GBP", "实际运费GBP", "运费差异GBP", "费用差异说明", "下一步处理", "更新时间"],
      ...scopedOutboundOrders.map((item) => {
        const latest = item.trackingEvents?.[0];
        const delivered = item.trackingEvents?.find((event) => event.status === "delivered");
        const proofException = item.exceptions?.find((event) => event.proofUrl);
        const exceptions = item.exceptions ?? [];
        const openExceptions = exceptions.filter((exception) => exception.status === "open" || exception.status === "investigating");
        const claimExceptions = exceptions.filter((exception) => exception.claimStatus && exception.claimStatus !== "not_required");
        const estimatedFee = typeof item.shippingFee === "number" ? item.shippingFee : undefined;
        const actualFee = typeof item.actualShippingFee === "number" ? item.actualShippingFee : undefined;
        const feeDiff = typeof estimatedFee === "number" && typeof actualFee === "number" ? Math.round((actualFee - estimatedFee) * 100) / 100 : undefined;
        const feeNote = typeof feeDiff === "number" && Math.abs(feeDiff) >= 1
          ? `预估 £${estimatedFee?.toFixed(2)}，实际 £${actualFee?.toFixed(2)}，差异 £${feeDiff.toFixed(2)}。${item.shippingFeeNote || "请以月结账单复核结果为准。"}`
          : item.shippingFeeNote || "";
        const nextAction = openExceptions.length > 0
          ? "等待运营处理物流异常，必要时请在工作台工单中确认方案。"
          : proofException?.proofUrl
            ? "可下载签收证明留档。"
            : delivered
              ? "已签收，等待承运商回传可下载签收证明。"
              : item.labelStatus === "generated"
                ? "等待承运商轨迹更新。"
                : "等待仓库生成面单并交接承运商。";
        return [
          item.id,
          item.platform ?? "",
          item.platformOrderNo ?? "",
          item.channel,
          item.carrierName ?? "",
          item.carrierServiceName ?? "",
          item.trackingNumber ?? "",
          labelStatusLabel[item.labelStatus ?? "not_requested"] ?? item.labelStatus ?? "未申请",
          item.labelStatus === "generated" ? `/api/outbounds/${item.id}/label` : "",
          delivered ? "已签收" : "待签收",
          proofException?.proofUrl ? `/api/outbounds/${item.id}/proof` : "",
          latest?.label ?? "",
          latest?.detail ?? "",
          latest?.location ?? "",
          latest?.occurredAt ?? "",
          exceptions.length,
          openExceptions.length,
          exceptions.map((exception) => `${exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : outboundDeliveryExceptionTypeLabel.manual}：${exception.message}`).join(" | "),
          claimExceptions.reduce((sum, exception) => sum + (exception.claimAmount ?? 0), 0) || "",
          claimExceptions.map((exception) => (exception.claimStatus ? outboundClaimStatusLabel[exception.claimStatus] : "")).filter(Boolean).join(" | "),
          exceptions.map((exception) => (exception.customerDecision ? outboundCustomerExceptionDecisionLabel[exception.customerDecision] : "")).filter(Boolean).join(" | "),
          estimatedFee ?? "",
          actualFee ?? "",
          feeDiff ?? "",
          feeNote,
          nextAction,
          item.updatedAt ?? item.createdAt,
        ];
      }),
    ]);
  }

  if (kind === "delivery-exceptions") {
    return csvResponse(`物流异常与赔付-${session.customerCode}.csv`, [
      ["出库单号", "追踪号", "异常类型", "异常状态", "严重程度", "异常说明", "改派要求", "签收证明链接", "赔付金额", "赔付状态", "赔付备注", "客户确认结果", "客户确认备注", "客户确认时间", "创建时间", "处理时间"],
      ...scopedOutboundOrders.flatMap((item) =>
        (item.exceptions ?? []).map((exception) => [item.id, item.trackingNumber ?? "", exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : outboundDeliveryExceptionTypeLabel.manual, exceptionStatusLabel[exception.status] ?? exception.status, exception.severity === "critical" ? "严重" : "提醒", exception.message, exception.redeliveryRequired ? exception.redeliveryNote ?? "需要改派" : "", exception.proofUrl ? `/api/outbounds/${item.id}/proof` : "", exception.claimAmount ?? "", exception.claimStatus ? outboundClaimStatusLabel[exception.claimStatus] : "", exception.claimNote ?? "", exception.customerDecision ? outboundCustomerExceptionDecisionLabel[exception.customerDecision] : "", exception.customerDecisionNote ?? "", exception.customerDecisionAt ?? "", exception.createdAt, exception.resolvedAt ?? ""]),
      ),
    ]);
  }

  if (kind === "exceptions") {
    const submissions = await getSubmissionsForCustomer(session.customerCode);
    const inbounds = submissions.filter(isCustomerInbound);
    const rows = [
      ...inbounds.flatMap((inbound) =>
        (inbound.receivingExceptions ?? []).map((exception) => ["入库", exception.id, inbound.id, inboundExceptionTypeLabel[exception.type] ?? exception.type, exceptionStatusLabel[exception.status], exception.severity === "critical" ? "严重" : "提醒", exception.message, exception.status === "resolved" || exception.status === "ignored" ? exception.resolutionNote ?? "已关闭" : "等待仓库/运营核对后反馈处理结果", "", exception.createdAt, exception.resolvedAt ?? ""]),
      ),
      ...inbounds
        .filter((inbound) => inbound.exceptionNote && ["exception", "on_hold"].includes(inbound.status))
        .map((inbound) => ["入库", `${inbound.id}-STATUS`, inbound.id, "入库状态异常", inbound.status === "on_hold" ? "暂缓处理" : "异常处理中", "提醒", inbound.exceptionNote ?? "", "等待运营确认资料、预约或差异处理方案", "", inbound.updatedAt ?? inbound.createdAt, ""]),
      ...scopedOutboundOrders.flatMap((order) =>
        (order.exceptions ?? []).map((exception) => [exception.deliveryExceptionType ? "物流" : "出库", exception.id, order.id, exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : "出库作业异常", exceptionStatusLabel[exception.status], exception.severity === "critical" ? "严重" : "提醒", exception.message, exception.redeliveryRequired ? exception.redeliveryNote ?? "等待确认改派要求" : exception.claimStatus && exception.claimStatus !== "not_required" ? `赔付状态：${outboundClaimStatusLabel[exception.claimStatus]}` : exception.resolutionNote ?? "运营处理中", exception.customerDecision ? `客户确认：${outboundCustomerExceptionDecisionLabel[exception.customerDecision]}${exception.customerDecisionNote ? `；${exception.customerDecisionNote}` : ""}` : "", exception.createdAt, exception.resolvedAt ?? ""]),
      ),
      ...data.returnOrders
        .filter((item) => item.status === "exception" || (["received", "inspection", "repair"].includes(item.status) && !item.customerResolutionDecision))
        .map((item) => ["退货/RMA", `${item.id}-${item.status}`, item.id, item.status === "exception" ? "退货异常" : "退货处理待确认", returnOrderStatusLabel(item.status), item.status === "exception" ? "严重" : "提醒", item.inspectionResult || item.returnReason, item.customerResolutionDecision ? "已确认处理方式" : "请确认重新上架、维修、报废或转寄", item.customerResolutionDecision ? `${returnResolutionLabel(item.customerResolutionDecision)}${item.customerResolutionNote ? `；${item.customerResolutionNote}` : ""}` : "", item.updatedAt ?? item.createdAt, item.closedAt ?? ""]),
      ...data.inventoryBalances
        .filter((item) => item.availableQty < item.alertQty || (item.frozenQty ?? 0) > 0 || (item.defectiveQty ?? 0) > 0 || item.agingDays >= 120)
        .map((item) => {
          const reasons = [item.availableQty < item.alertQty ? "低于预警库存" : "", (item.frozenQty ?? 0) > 0 ? `冻结 ${item.frozenQty}` : "", (item.defectiveQty ?? 0) > 0 ? `残次品 ${item.defectiveQty}` : "", item.agingDays >= 120 ? `库龄 ${item.agingDays} 天` : ""].filter(Boolean);
          return ["库存", `INV-${item.customerCode}-${item.skuCode}-${item.locationCode || item.warehouseCode}`, item.skuCode, "库存风险", "待处理", item.availableQty < 0 || item.agingDays >= 365 ? "严重" : "提醒", `${item.warehouseCode}/${item.locationCode || "-"}；${reasons.join("；")}`, "可联系运营确认补货、移库、盘点或残次品处理", "", item.updatedAt, ""];
        }),
      ...data.billingRecords
        .filter((item) => item.dueDate && new Date(item.dueDate).getTime() < Date.now() && item.status !== "paid")
        .map((item) => ["费用/账单", `${item.id}-OVERDUE`, item.id, "账单逾期", billingStatusLabel(item.status), "严重", `到期日 ${item.dueDate}，金额 £${item.amount.toFixed(2)}`, "请确认付款、上传凭证或提交账单争议工单", "", item.updatedAt ?? item.createdAt, ""]),
    ].sort((a, b) => new Date(String(b[9] || 0)).getTime() - new Date(String(a[9] || 0)).getTime());

    return csvResponse(`我的异常中心-${session.customerCode}.csv`, [
      ["模块", "异常编号", "关联单号/SKU", "异常类型", "状态", "严重程度", "异常说明", "下一步动作", "客户确认", "创建时间", "关闭时间"],
      ...rows,
    ]);
  }

  if (kind === "returns") {
    const filter = normalizeCustomerReturnFilter(url.searchParams.get("status"));
    const keyword = url.searchParams.get("q") ?? "";
    const returns = filterCustomerReturns(data.returnOrders, filter, keyword);
    return csvResponse(`退货质检明细-${session.customerCode}.csv`, [
      ["退货单号", "平台", "原订单号", "买家退货追踪号", "退货原因", "SKU 明细", "状态", "质检结果", "处理方式", "客户确认方式", "客户确认备注", "客户确认时间", "处理库位", "售后工单号", "质检附件数", "质检附件名称", "预计到仓", "到仓时间", "质检时间", "关闭时间", "创建时间", "更新时间"],
      ...returns.map((item) => {
        const returnDocuments = documents.filter((document) => document.refType === "return" && document.refId === item.id);
        return [item.id, item.platform, item.originalOrderNo ?? "", item.buyerReturnTracking ?? "", item.returnReason, item.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join(" | "), returnOrderStatusLabel(item.status), item.inspectionResult ?? "", item.resolution ? returnResolutionLabel(item.resolution) : "", item.customerResolutionDecision ? returnResolutionLabel(item.customerResolutionDecision) : "", item.customerResolutionNote ?? "", item.customerResolutionConfirmedAt ?? "", item.locationCode ?? "", item.workOrderId ?? "", returnDocuments.length, returnDocuments.map((document) => document.originalName).join(" | "), item.expectedArrivalDate ?? "", item.receivedAt ?? "", item.inspectedAt ?? "", item.closedAt ?? "", item.createdAt, item.updatedAt ?? ""];
      }),
    ]);
  }

  return NextResponse.json({ error: "不支持的下载类型。" }, { status: 400 });
}
