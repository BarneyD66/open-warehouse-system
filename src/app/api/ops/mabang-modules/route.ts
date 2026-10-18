import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { hasDocumentForRef } from "@/lib/documentStore";
import { recordApiError } from "@/lib/productionErrorStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule, canPerformSensitiveAction, secondConfirmationError, type OpsPermissionModule } from "@/lib/staffPermissions";
import {
  addCustomerWorkOrderMessage,
  approvalRuleForTrigger,
  approvalRuleNote,
  cancelOrderImportDraft,
  confirmOrderImportDraft,
  carrierBillTemplateRows,
  carrierBillDetailRows,
  createBatchOperationPlan,
  exportOpsExpansionRows,
  getOrderImportBatchById,
  getOpsExpansionData,
  importPlatformOrdersCsv,
  importCarrierBillCsv,
  importPaymentReconciliationCsv,
  orderImportMappingGuideRows,
  orderImportBatchIssueReportRows,
  orderImportTemplateRows,
  paymentReconciliationDetailRows,
  paymentReconciliationTemplateRows,
  previewPlatformOrdersCsv,
  saveOrderImportDraft,
  saveReportView,
  syncPlatformConnection,
  updateBatchOperationStatus,
  updateCustomerWorkOrder,
  updateSelfServiceConfig,
  upsertApprovalRule,
  upsertBillingRule,
  upsertLogisticsChannel,
  upsertPlatformConnection,
  upsertRolePermissions,
  upsertWmsPolicy,
  type ApprovalRuleConfig,
  type ApprovalRuleTrigger,
  type BatchOperationKind,
  type BatchOperationPlan,
  type BillingRuleConfig,
  type CustomerWorkOrderStatus,
  type IntegrationStatus,
  type OpsExpansionExportKind,
  type PlatformConnection,
  type PlatformConnectionStatus,
  type PlatformKind,
  type RolePermissionConfig,
  type SavedReportView,
  type WmsPolicyStatus,
} from "@/lib/opsExpansionStore";
import { createManualBillingAdjustmentRecord, createPurchaseReceiptOrder, getWarehouseCoreData, importOutboundWeightsCsv, importPurchaseReceiptsCsv, outboundWeightImportTemplateRows, purchaseReceiptTemplateRows, putawayPurchaseReceiptOrder, receivePurchaseReceiptOrder, updateStaffBillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function moneyValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(clean(value).replace(/[£,]/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : undefined;
}

function splitList(value: unknown) {
  return clean(value)
    .split(/[,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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

function moduleForAction(action: string): OpsPermissionModule {
  if (["upsert_platform", "sync_platform_connection", "import_orders_csv", "preview_orders_csv", "save_order_import_draft", "confirm_order_import_draft", "cancel_order_import_draft", "create_batch_plan", "update_batch_status", "import_outbound_weights_csv"].includes(action)) return "outbound";
  if (["create_purchase_receipt", "import_purchase_receipts_csv", "receive_purchase_receipt", "putaway_purchase_receipt"].includes(action)) return "inbound";
  if (action === "upsert_wms_policy") return "inventory";
  if (["upsert_logistics_channel", "import_carrier_bill_csv"].includes(action)) return "logistics";
  if (["upsert_billing_rule", "import_payment_reconciliation_csv", "review_finance_work_order"].includes(action)) return "billing";
  if (["save_report_view"].includes(action)) return "reports";
  if (["update_work_order", "add_work_order_message"].includes(action)) return "overview";
  if (["upsert_role_permissions", "upsert_approval_rule"].includes(action)) return "permissions";
  return "overview";
}

async function findLinkedBillingRecordForWorkOrder(input: { explicitBillingRecordId?: string; workOrderId: string; referenceNo?: string; title?: string; description?: string; customerCode?: string }) {
  const explicitBillingRecordId = input.explicitBillingRecordId?.trim();
  const coreData = await getWarehouseCoreData();
  if (explicitBillingRecordId) return coreData.billingRecords.find((record) => record.id === explicitBillingRecordId) ?? null;

  const referenceNo = input.referenceNo?.trim();
  if (referenceNo) {
    const byReference = coreData.billingRecords.find(
      (record) =>
        record.id === referenceNo ||
        record.refId === referenceNo ||
        record.statementId === referenceNo ||
        record.workOrderId === input.workOrderId,
    );
    if (byReference) return byReference;
  }

  const haystack = [input.title, input.description, input.referenceNo].filter(Boolean).join(" ");
  if (!haystack) return null;
  return (
    coreData.billingRecords.find((record) => {
      if (input.customerCode && record.customerCode !== input.customerCode) return false;
      return [record.id, record.refId, record.statementId].filter(Boolean).some((token) => haystack.includes(String(token)));
    }) ?? null
  );
}

function sensitiveActionForAction(action: string) {
  if (action === "upsert_role_permissions" || action === "upsert_approval_rule") return "权限配置";
  if (action === "upsert_billing_rule" || action === "import_carrier_bill_csv" || action === "import_payment_reconciliation_csv") return "账单锁定";
  if (action === "upsert_wms_policy") return "库存调整审批";
  return "";
}

async function handleGet(request: Request) {
  await requireStaffSession();
  const url = new URL(request.url);
  if (url.searchParams.get("template") === "orders") {
    return csvResponse("平台订单导入模板.csv", orderImportTemplateRows());
  }
  if (url.searchParams.get("template") === "order-mapping") {
    return csvResponse("平台订单字段映射说明.csv", orderImportMappingGuideRows());
  }
  if (url.searchParams.get("template") === "carrier-bill") {
    return csvResponse("承运商账单导入模板.csv", carrierBillTemplateRows());
  }
  if (url.searchParams.get("template") === "payment-reconciliation") {
    return csvResponse("银行流水核销导入模板.csv", paymentReconciliationTemplateRows());
  }
  if (url.searchParams.get("template") === "outbound-weight") {
    return csvResponse("出库批量称重模板.csv", outboundWeightImportTemplateRows());
  }
  if (url.searchParams.get("template") === "purchase-receipt") {
    return csvResponse("采购到货签收模板.csv", purchaseReceiptTemplateRows());
  }
  const batchId = clean(url.searchParams.get("batchId"));
  if (batchId && url.searchParams.get("report") === "issues") {
    const batch = await getOrderImportBatchById(batchId);
    if (!batch) return NextResponse.json({ error: "未找到导入批次" }, { status: 404 });
    return csvResponse(`订单导入异常报告-${batch.id}.csv`, orderImportBatchIssueReportRows(batch));
  }
  if (batchId && url.searchParams.get("report") === "carrier-bill-detail") {
    const data = await getOpsExpansionData();
    const batch = data.carrierBillImportBatches.find((item) => item.id === batchId);
    if (!batch) return NextResponse.json({ error: "未找到承运商账单批次" }, { status: 404 });
    return csvResponse(`承运商账单核对明细-${batch.id}.csv`, carrierBillDetailRows(batch));
  }
  if (batchId && url.searchParams.get("report") === "payment-reconciliation-detail") {
    const data = await getOpsExpansionData();
    const batch = data.paymentReconciliationImportBatches.find((item) => item.id === batchId);
    if (!batch) return NextResponse.json({ error: "未找到银行流水核销批次" }, { status: 404 });
    return csvResponse(`银行流水核销明细-${batch.id}.csv`, paymentReconciliationDetailRows(batch));
  }
  if (batchId && url.searchParams.get("report") === "payment-reconciliation-json") {
    const data = await getOpsExpansionData();
    const batch = data.paymentReconciliationImportBatches.find((item) => item.id === batchId);
    if (!batch) return NextResponse.json({ error: "未找到银行流水核销批次" }, { status: 404 });
    return NextResponse.json({
      batchId: batch.id,
      fileName: batch.fileName,
      createdBy: batch.createdBy,
      createdAt: batch.createdAt,
      summary: {
        totalRows: batch.totalRows,
        matchedRows: batch.matchedRows,
        skippedRows: batch.skippedRows,
        statementRows: batch.statementRows,
        totalAmount: batch.totalAmount,
        matchedAmount: batch.matchedAmount,
        reviewAmount: Math.round((batch.totalAmount - batch.matchedAmount) * 100) / 100,
      },
      reviewRows: batch.rows.filter((row) => row.status === "skipped"),
      matchedRows: batch.rows.filter((row) => row.status !== "skipped"),
    });
  }
  const exportKind = url.searchParams.get("export") as OpsExpansionExportKind | null;
  if (exportKind) {
    return csvResponse(`运营导出-${exportKind}.csv`, await exportOpsExpansionRows(exportKind));
  }
  const data = await getOpsExpansionData();
  return NextResponse.json(data);
}

export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (error) {
    const event = await recordApiError({ request, route: "/api/ops/mabang-modules", error });
    return NextResponse.json({ error: "系统异常已记录，请联系运营负责人处理。", errorId: event.id }, { status: 500 });
  }
}

async function handlePost(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action);
  const expansionData = await getOpsExpansionData();
  const targetModule = moduleForAction(action);
  if (!canAccessOpsModule(staff, targetModule, expansionData)) {
    return NextResponse.json({ error: "当前角色无权操作该模块" }, { status: 403 });
  }
  const sensitiveAction = sensitiveActionForAction(action);
  if (sensitiveAction && !canPerformSensitiveAction(staff, sensitiveAction, expansionData)) {
    return NextResponse.json({ error: `当前角色无权执行敏感操作：${sensitiveAction}` }, { status: 403 });
  }

  if (action === "upsert_platform") {
    const record = await upsertPlatformConnection({
      platform: clean(body.platform) as PlatformKind,
      storeName: clean(body.storeName),
      customerCode: clean(body.customerCode),
      status: (clean(body.status) || "draft") as PlatformConnectionStatus,
      syncMode: (clean(body.syncMode) || "manual_csv") as PlatformConnection["syncMode"],
      mappingText: clean(body.mappingText),
      note: clean(body.note),
    });
    return NextResponse.json({ record });
  }

  if (action === "sync_platform_connection") {
    const result = await syncPlatformConnection({
      id: clean(body.id),
      operator: staff.displayName || staff.username,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ job: result.job, batch: result.batch });
  }

  if (action === "import_orders_csv") {
    const batch = await importPlatformOrdersCsv({
      csv: clean(body.csv),
      source: (clean(body.source) || "csv") as PlatformKind,
      fileName: clean(body.fileName),
      operator: staff.displayName || staff.username,
    });
    return NextResponse.json({ batch });
  }

  if (action === "preview_orders_csv") {
    const preview = await previewPlatformOrdersCsv({
      csv: clean(body.csv),
      source: (clean(body.source) || "csv") as PlatformKind,
    });
    return NextResponse.json({ preview });
  }

  if (action === "save_order_import_draft") {
    const preview = await previewPlatformOrdersCsv({
      csv: clean(body.csv),
      source: (clean(body.source) || "csv") as PlatformKind,
    });
    const batch = await saveOrderImportDraft({
      preview,
      source: (clean(body.source) || "csv") as PlatformKind,
      fileName: clean(body.fileName),
      operator: staff.displayName || staff.username,
    });
    return NextResponse.json({ batch });
  }

  if (action === "confirm_order_import_draft") {
    const result = await confirmOrderImportDraft({
      id: clean(body.id),
      operator: staff.displayName || staff.username,
    });
    if (result.error) return NextResponse.json({ error: result.error, batch: result.batch }, { status: result.batch ? 409 : 404 });
    return NextResponse.json({ batch: result.batch });
  }

  if (action === "cancel_order_import_draft") {
    const result = await cancelOrderImportDraft({
      id: clean(body.id),
      operator: staff.displayName || staff.username,
      reason: clean(body.reason),
    });
    if (result.error) return NextResponse.json({ error: result.error, batch: result.batch }, { status: result.batch ? 409 : 404 });
    return NextResponse.json({ batch: result.batch });
  }

  if (action === "create_batch_plan") {
    const plan = await createBatchOperationPlan({
      kind: clean(body.kind) as BatchOperationKind,
      title: clean(body.title),
      targetModule: clean(body.targetModule) as BatchOperationPlan["targetModule"],
      recordCount: Number(body.recordCount) || 0,
      templateName: clean(body.templateName),
      note: clean(body.note),
      createdBy: staff.displayName || staff.username,
    });
    return NextResponse.json({ plan });
  }

  if (action === "update_batch_status") {
    const result = await updateBatchOperationStatus({
      id: clean(body.id),
      status: clean(body.status) as BatchOperationPlan["status"],
      note: clean(body.note),
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ plan: result.plan });
  }

  if (action === "import_outbound_weights_csv") {
    const result = await importOutboundWeightsCsv({
      csv: clean(body.csv),
      operator: staff.displayName || staff.username,
      carrierConfigs: expansionData.logisticsChannels,
    });
    await recordAuditLog({
      action: "outbound_batch_weighing",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "outbound",
      targetId: "batch-weighing",
      summary: `批量称重导入：更新 ${result.updatedRows} 单，跳过 ${result.skippedRows} 行`,
      note: result.issues.slice(0, 5).map((issue) => `第 ${issue.row} 行：${issue.message}`).join("；"),
      after: {
        totalRows: result.totalRows,
        updatedRows: result.updatedRows,
        skippedRows: result.skippedRows,
        issues: result.issues,
      },
    });
    return NextResponse.json({ result });
  }

  if (action === "create_purchase_receipt") {
    const result = await createPurchaseReceiptOrder({
      customerCode: clean(body.customerCode),
      supplierName: clean(body.supplierName),
      warehouseCode: clean(body.warehouseCode) || "SHEFFIELD-MAIN",
      expectedArrivalDate: clean(body.expectedArrivalDate),
      trackingNumber: clean(body.trackingNumber),
      lines: [
        {
          skuCode: clean(body.skuCode),
          productName: clean(body.productName),
          expectedQty: Number(body.expectedQty) || 0,
          locationCode: clean(body.locationCode),
          lotNo: clean(body.lotNo),
          expiryDate: clean(body.expiryDate),
          note: clean(body.lineNote),
        },
      ],
      note: clean(body.note),
      operator: staff.displayName || staff.username,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    await recordAuditLog({
      action: "inbound_putaway",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "inbound",
      targetId: result.order?.id ?? "purchase-receipt",
      summary: `创建采购到货单：${result.order?.id ?? ""}`,
      note: result.order?.note,
      after: result.order,
    });
    return NextResponse.json({ order: result.order });
  }

  if (action === "import_purchase_receipts_csv") {
    const result = await importPurchaseReceiptsCsv({
      csv: clean(body.csv),
      operator: staff.displayName || staff.username,
    });
    await recordAuditLog({
      action: "inbound_putaway",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "inbound",
      targetId: "purchase-receipt-import",
      summary: `批量导入采购到货单：创建 ${result.createdRows} 单，跳过 ${result.skippedRows} 行`,
      note: result.issues.slice(0, 5).map((issue) => `第 ${issue.row} 行：${issue.message}`).join("；"),
      after: result,
    });
    return NextResponse.json({ result });
  }

  if (action === "receive_purchase_receipt") {
    const result = await receivePurchaseReceiptOrder({
      id: clean(body.id),
      locationCode: clean(body.locationCode),
      note: clean(body.note),
      operator: staff.displayName || staff.username,
    });
    if (result.error) return NextResponse.json({ error: result.error, order: result.order }, { status: result.order ? 409 : 404 });
    await recordAuditLog({
      action: "inbound_putaway",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "inbound",
      targetId: result.order?.id ?? "purchase-receipt",
      summary: `采购到货签收：${result.postedQty ?? 0} 件进入待上架库存`,
      note: result.order?.note,
      after: result.order,
    });
    return NextResponse.json({ order: result.order, postedQty: result.postedQty });
  }

  if (action === "putaway_purchase_receipt") {
    const result = await putawayPurchaseReceiptOrder({
      id: clean(body.id),
      locationCode: clean(body.locationCode),
      note: clean(body.note),
      operator: staff.displayName || staff.username,
    });
    if (result.error) return NextResponse.json({ error: result.error, order: result.order }, { status: result.order ? 409 : 404 });
    await recordAuditLog({
      action: "inbound_putaway",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "inbound",
      targetId: result.order?.id ?? "purchase-receipt",
      summary: `采购到货上架：${result.postedQty ?? 0} 件转为可售库存`,
      note: result.order?.note,
      after: result.order,
    });
    return NextResponse.json({ order: result.order, postedQty: result.postedQty });
  }

  if (action === "update_work_order") {
    const result = await updateCustomerWorkOrder({
      id: clean(body.id),
      status: clean(body.status) as CustomerWorkOrderStatus,
      internalNote: clean(body.internalNote) || `${staff.displayName || staff.username} updated this work order.`,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ workOrder: result.workOrder });
  }

  if (action === "review_finance_work_order") {
    const id = clean(body.id);
    const status = clean(body.status) as CustomerWorkOrderStatus;
    if (!["processing", "waiting_customer", "resolved"].includes(status)) {
      return NextResponse.json({ error: "不支持的财务复核状态。" }, { status: 400 });
    }
    const operator = staff.displayName || staff.username;
    const defaultNote =
      status === "processing"
        ? "财务已接单复核费用差异。"
        : status === "waiting_customer"
          ? "费用复核需要客户补充凭证或说明。"
          : "费用复核已完成，工单关闭。";
    const note = clean(body.note) || defaultNote;
    const reviewConclusion = clean(body.reviewConclusion) || "keep_bill";
    const adjustmentAmount = moneyValue(body.adjustmentAmount);
    if (!["keep_bill", "fee_adjustment", "compensation"].includes(reviewConclusion)) {
      return NextResponse.json({ error: "不支持的财务复核结论。" }, { status: 400 });
    }
    if (status === "resolved" && ["fee_adjustment", "compensation"].includes(reviewConclusion) && (!adjustmentAmount || adjustmentAmount <= 0)) {
      return NextResponse.json({ error: "请填写大于 0 的调账/赔付金额。" }, { status: 400 });
    }
    const sourceWorkOrder = expansionData.selfServiceWorkOrders.find((item) => item.id === id);
    const adjustmentTrigger = reviewConclusion === "compensation" ? "claim_approval" : reviewConclusion === "fee_adjustment" ? "manual_fee_adjustment" : undefined;
    let financeApprovalNote = "";
    let financeApprovalRule: ReturnType<typeof approvalRuleForTrigger> | undefined;
    let financeAttachmentStatus: "not_required" | "archived" | "confirmed" | "missing" = "not_required";
    if (status === "resolved" && adjustmentTrigger && adjustmentAmount) {
      const sensitiveAction = "账单锁定";
      if (!canPerformSensitiveAction(staff, sensitiveAction, expansionData)) return NextResponse.json({ error: "当前角色无权生成调账/赔付账单。" }, { status: 403 });
      const secondConfirmError = secondConfirmationError({
        staff,
        action: sensitiveAction,
        confirmation: clean(body.confirmation),
        expected: id,
        data: expansionData,
      });
      if (secondConfirmError) return NextResponse.json({ error: secondConfirmError }, { status: 400 });

      financeApprovalRule = approvalRuleForTrigger(expansionData, adjustmentTrigger, adjustmentAmount, 1);
      if (financeApprovalRule && !financeApprovalRule.approverRoles.includes(staff.role)) return NextResponse.json({ error: `当前审批规则要求 ${financeApprovalRule.approverRoles.join("、")} 审批。` }, { status: 403 });
      if (financeApprovalRule?.requireReason && !clean(body.note)) return NextResponse.json({ error: "当前审批规则要求填写调账/赔付原因。" }, { status: 400 });
      if (financeApprovalRule?.requireAttachment) {
        const hasAttachment = sourceWorkOrder ? await hasDocumentForRef({ customerCode: sourceWorkOrder.customerCode, refType: "approval", refId: id }) : false;
        if (!hasAttachment && body.approvalAttachmentConfirmed !== true) return NextResponse.json({ error: "当前审批规则要求先上传或确认已归档审批附件。" }, { status: 400 });
        financeAttachmentStatus = hasAttachment ? "archived" : "confirmed";
      }
      financeApprovalNote = approvalRuleNote(financeApprovalRule);
    }

    let messageResult: Awaited<ReturnType<typeof addCustomerWorkOrderMessage>> | null = null;
    if (status === "waiting_customer" || status === "resolved") {
      messageResult = await addCustomerWorkOrderMessage({
        id,
        authorRole: "ops",
        authorName: operator,
        body: note,
        visibleToCustomer: true,
        nextStatus: status === "waiting_customer" ? "waiting_customer" : undefined,
      });
      if (messageResult.error) return NextResponse.json({ error: messageResult.error }, { status: 400 });
    }

    const result = await updateCustomerWorkOrder({
      id,
      status,
      internalNote: `财务复核：${note}`,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });

    let linkedBillingRecord: Awaited<ReturnType<typeof updateStaffBillingRecord>> | null = null;
    let adjustmentBillingRecord: Awaited<ReturnType<typeof createManualBillingAdjustmentRecord>>["record"] | null = null;
    if (status === "resolved" && sourceWorkOrder) {
      const matchedBillingRecord = await findLinkedBillingRecordForWorkOrder({
        explicitBillingRecordId: clean(body.billingRecordId),
        workOrderId: id,
        referenceNo: sourceWorkOrder.referenceNo,
        title: sourceWorkOrder.title,
        description: sourceWorkOrder.description,
        customerCode: sourceWorkOrder.customerCode,
      });
      if (matchedBillingRecord) {
        linkedBillingRecord = await updateStaffBillingRecord({
          id: matchedBillingRecord.id,
          action: "resolve_dispute",
          reviewer: operator,
          reviewNote: `来自财务复核工单 ${id}：${note}`,
          workOrderId: id,
        });
        await recordAuditLog({
          action: "billing_payment_review",
          actorRole: "staff",
          actorName: operator,
          targetType: "billing",
          targetId: matchedBillingRecord.id,
          customerCode: matchedBillingRecord.customerCode,
          summary: `财务复核工单 ${id} 已回写账单`,
          note,
          before: matchedBillingRecord,
          after: linkedBillingRecord,
        });
      }
      if (["fee_adjustment", "compensation"].includes(reviewConclusion) && adjustmentAmount) {
        const adjustment = await createManualBillingAdjustmentRecord({
          customerCode: sourceWorkOrder.customerCode,
          amount: -adjustmentAmount,
          title: reviewConclusion === "compensation" ? `赔付抵扣 - ${sourceWorkOrder.id}` : `费用调账 - ${sourceWorkOrder.id}`,
          note: [`财务复核结论：${reviewConclusion === "compensation" ? "赔付抵扣" : "同意调账"}；${note}`, financeApprovalNote].filter(Boolean).join(" / "),
          reviewer: operator,
          workOrderId: id,
          sourceRecordId: matchedBillingRecord?.id,
          adjustmentKind: reviewConclusion === "compensation" ? "compensation" : "fee_adjustment",
          approvalRuleId: financeApprovalRule?.id,
          approvalRuleName: financeApprovalRule?.name,
          approvalRuleNote: financeApprovalNote,
          attachmentStatus: financeAttachmentStatus,
          status: "confirmed",
        });
        if (adjustment.error) return NextResponse.json({ error: adjustment.error }, { status: 400 });
        adjustmentBillingRecord = adjustment.record;
        await recordAuditLog({
          action: "billing_record_review",
          actorRole: "staff",
          actorName: operator,
          targetType: "billing",
          targetId: adjustment.record?.id ?? id,
          customerCode: sourceWorkOrder.customerCode,
          summary: reviewConclusion === "compensation" ? `财务复核工单 ${id} 生成赔付抵扣` : `财务复核工单 ${id} 生成费用调账`,
          note: `金额：-£${adjustmentAmount.toFixed(2)}；${note}`,
          before: matchedBillingRecord,
          after: adjustment.record,
        });
      }
    }

    return NextResponse.json({ workOrder: result.workOrder ?? messageResult?.workOrder, linkedBillingRecord, adjustmentBillingRecord });
  }

  if (action === "add_work_order_message") {
    const result = await addCustomerWorkOrderMessage({
      id: clean(body.id),
      authorRole: "ops",
      authorName: staff.displayName || staff.username,
      body: clean(body.body),
      visibleToCustomer: true,
      nextStatus: clean(body.nextStatus) === "waiting_customer" ? "waiting_customer" : undefined,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ workOrder: result.workOrder });
  }

  if (action === "upsert_wms_policy") {
    const policy = await upsertWmsPolicy({
      warehouseCode: clean(body.warehouseCode),
      name: clean(body.name),
      status: (clean(body.status) || "draft") as WmsPolicyStatus,
      zonePath: clean(body.zonePath),
      capacityRule: clean(body.capacityRule),
      stockControls: splitList(body.stockControls),
      batchControls: splitList(body.batchControls),
    });
    return NextResponse.json({ policy });
  }

  if (action === "upsert_logistics_channel") {
    const channel = await upsertLogisticsChannel({
      carrierName: clean(body.carrierName),
      serviceName: clean(body.serviceName),
      status: (clean(body.status) || "draft") as IntegrationStatus,
      apiMode: (clean(body.apiMode) || "manual") as "manual" | "sandbox" | "live",
      enabledFeatures: splitList(body.enabledFeatures),
      surchargeRules: splitList(body.surchargeRules),
      credentialRef: clean(body.credentialRef),
      trackingWebhook: clean(body.trackingWebhook),
    });
    return NextResponse.json({ channel });
  }

  if (action === "import_carrier_bill_csv") {
    const batch = await importCarrierBillCsv({
      csv: clean(body.csv),
      fileName: clean(body.fileName),
      operator: staff.displayName || staff.username,
    });
    return NextResponse.json({ batch });
  }

  if (action === "import_payment_reconciliation_csv") {
    const batch = await importPaymentReconciliationCsv({
      csv: clean(body.csv),
      fileName: clean(body.fileName),
      operator: staff.displayName || staff.username,
    });
    await recordAuditLog({
      action: "billing_payment_import",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "billing",
      targetId: batch.id,
      after: batch,
      summary: `导入银行流水核销：自动核销 ${batch.matchedRows} 行，待人工复核 ${batch.skippedRows} 行。`,
    });
    return NextResponse.json({ batch });
  }

  if (action === "upsert_billing_rule") {
    const rule = await upsertBillingRule({
      feeName: clean(body.feeName),
      feeType: clean(body.feeType) as BillingRuleConfig["feeType"],
      status: (clean(body.status) || "draft") as BillingRuleConfig["status"],
      unitLabel: clean(body.unitLabel),
      unitPrice: Number(body.unitPrice) || 0,
      settlementCycle: (clean(body.settlementCycle) || "monthly") as BillingRuleConfig["settlementCycle"],
      customerScope: (clean(body.customerScope) || "all") as BillingRuleConfig["customerScope"],
    });
    return NextResponse.json({ rule });
  }

  if (action === "update_self_service") {
    const selfService = await updateSelfServiceConfig({
      enabledDownloads: splitList(body.enabledDownloads),
      workOrderCategories: splitList(body.workOrderCategories),
      messageCenterEnabled: body.messageCenterEnabled !== false,
    });
    return NextResponse.json({ selfService });
  }

  if (action === "save_report_view") {
    const filters = Object.fromEntries(
      splitList(body.filters).map((item) => {
        const [key, value] = item.split(/[:=]/).map((part) => part.trim());
        return [key, value || ""];
      }),
    );
    const view = await saveReportView({
      name: clean(body.name),
      module: clean(body.module) as SavedReportView["module"],
      filters,
      metrics: splitList(body.metrics),
      ownerRole: clean(body.ownerRole) || staff.role,
    });
    return NextResponse.json({ view });
  }

  if (action === "upsert_role_permissions") {
    const permissions = await upsertRolePermissions({
      role: clean(body.role) as RolePermissionConfig["role"],
      allowedModules: splitList(body.allowedModules),
      sensitiveActions: splitList(body.sensitiveActions),
      requireSecondConfirm: body.requireSecondConfirm === true,
    });
    return NextResponse.json({ permissions });
  }

  if (action === "upsert_approval_rule") {
    const rule = await upsertApprovalRule({
      name: clean(body.name),
      status: (clean(body.status) || "draft") as ApprovalRuleConfig["status"],
      trigger: clean(body.trigger) as ApprovalRuleTrigger,
      minAmount: Number(body.minAmount) || undefined,
      minQuantity: Number(body.minQuantity) || undefined,
      approverRoles: splitList(body.approverRoles) as ApprovalRuleConfig["approverRoles"],
      slaHours: Number(body.slaHours) || 24,
      escalationRole: (clean(body.escalationRole) || undefined) as ApprovalRuleConfig["escalationRole"],
      requireReason: body.requireReason === true,
      requireAttachment: body.requireAttachment === true,
    });
    return NextResponse.json({ rule });
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    const event = await recordApiError({ request, route: "/api/ops/mabang-modules", error });
    return NextResponse.json({ error: "系统异常已记录，请联系运营负责人处理。", errorId: event.id }, { status: 500 });
  }
}
