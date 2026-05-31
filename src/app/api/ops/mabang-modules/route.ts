import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import {
  confirmOrderImportDraft,
  carrierBillTemplateRows,
  createBatchOperationPlan,
  exportOpsExpansionRows,
  getOrderImportBatchById,
  getOpsExpansionData,
  importPlatformOrdersCsv,
  importCarrierBillCsv,
  orderImportBatchIssueReportRows,
  orderImportTemplateRows,
  previewPlatformOrdersCsv,
  saveOrderImportDraft,
  saveReportView,
  updateBatchOperationStatus,
  updateCustomerWorkOrder,
  updateSelfServiceConfig,
  upsertBillingRule,
  upsertLogisticsChannel,
  upsertPlatformConnection,
  upsertRolePermissions,
  upsertWmsPolicy,
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

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function GET(request: Request) {
  await requireStaffSession();
  const url = new URL(request.url);
  if (url.searchParams.get("template") === "orders") {
    return csvResponse("平台订单导入模板.csv", orderImportTemplateRows());
  }
  if (url.searchParams.get("template") === "carrier-bill") {
    return csvResponse("承运商账单导入模板.csv", carrierBillTemplateRows());
  }
  const batchId = clean(url.searchParams.get("batchId"));
  if (batchId && url.searchParams.get("report") === "issues") {
    const batch = await getOrderImportBatchById(batchId);
    if (!batch) return NextResponse.json({ error: "未找到导入批次" }, { status: 404 });
    return csvResponse(`订单导入异常报告-${batch.id}.csv`, orderImportBatchIssueReportRows(batch));
  }
  const exportKind = url.searchParams.get("export") as OpsExpansionExportKind | null;
  if (exportKind) {
    return csvResponse(`运营导出-${exportKind}.csv`, await exportOpsExpansionRows(exportKind));
  }
  const data = await getOpsExpansionData();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action);

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

  if (action === "update_work_order") {
    const result = await updateCustomerWorkOrder({
      id: clean(body.id),
      status: clean(body.status) as CustomerWorkOrderStatus,
      internalNote: clean(body.internalNote) || `${staff.displayName || staff.username} updated this work order.`,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
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

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}
