import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";
import { pullPlatformOrders } from "./platformGateway";
import {
  cancelCoreOutboundShippingLabel,
  createCoreOutboundDeliveryException,
  createCustomerOutboundOrder,
  getLocationUtilization,
  getWarehouseCoreData,
  reconcileCoreOutboundShippingFee,
  requestCoreOutboundIntercept,
  updateStaffBillingRecord,
  updateStaffBillingStatement,
  type BillingRecord,
  type CoreOutboundOrder,
  type InventoryLot,
  type WarehouseLocation,
  updateInventoryLot,
} from "./warehouseCoreStore";

export type PlatformKind = "amazon" | "tiktok_shop" | "shopify" | "ebay" | "csv";
export type PlatformConnectionStatus = "draft" | "connected" | "paused" | "error";
export type BatchOperationKind = "sku_import" | "inbound_import" | "location_move" | "picking_wave" | "weighing" | "tracking_upload" | "export";
export type BatchOperationStatus = "draft" | "queued" | "processing" | "completed" | "exception";
export type WmsPolicyStatus = "draft" | "active" | "paused";
export type IntegrationStatus = "draft" | "sandbox" | "active" | "paused";
export type ApprovalRuleTrigger =
  | "inventory_adjustment"
  | "stocktake_difference"
  | "transfer_order"
  | "billing_lock"
  | "carrier_fee_diff"
  | "customer_status"
  | "manual_inbound_outbound"
  | "manual_fee_adjustment"
  | "outbound_intercept"
  | "claim_approval";
export type OpsExpansionExportKind = "order-imports" | "platforms" | "platform-sync-jobs" | "batch-plans" | "wms-policies" | "logistics-channels" | "carrier-bills" | "payment-imports" | "billing-rules" | "work-orders" | "report-views" | "permissions" | "approval-rules";

export type PlatformConnection = {
  id: string;
  platform: PlatformKind;
  storeName: string;
  customerCode: string;
  status: PlatformConnectionStatus;
  syncMode: "manual_csv" | "api_sandbox" | "api_live";
  fieldMapping: Record<string, string>;
  lastSyncAt?: string;
  note?: string;
  updatedAt: string;
};

export type PlatformCancelledOrderSyncRecord = {
  orderNo: string;
  customerCode: string;
  rawStatus?: string;
  reason?: string;
  cancelledAt?: string;
  matchedOutboundId?: string;
  outboundStatus?: string;
};

export type PlatformSyncJob = {
  id: string;
  platformConnectionId: string;
  platform: PlatformKind;
  storeName: string;
  customerCode: string;
  syncMode: PlatformConnection["syncMode"];
  status: "completed" | "failed";
  pulledRows: number;
  readyOrders: number;
  skippedRows: number;
  issueCount: number;
  cancelledRows?: number;
  cancelledOrders?: PlatformCancelledOrderSyncRecord[];
  orderImportBatchId?: string;
  error?: string;
  createdBy: string;
  createdAt: string;
};

export type PlatformCancellationReviewResult = {
  jobId: string;
  platform: PlatformKind;
  storeName: string;
  customerCode: string;
  orderNo: string;
  outboundId?: string;
  workOrderId?: string;
  status: "intercept_requested" | "delivery_exception" | "work_order_created" | "already_handled" | "unmatched" | "failed";
  message: string;
  labelCancelError?: string;
};

export type InventoryLotRiskReviewResult = {
  lotId: string;
  customerCode: string;
  skuCode: string;
  lotNo: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  status: "expired_marked" | "work_order_created" | "already_handled" | "skipped" | "failed";
  riskLevel: "关注" | "高风险";
  riskReason: string;
  workOrderId?: string;
  message: string;
};

export type WarehouseLocationRiskReviewResult = {
  locationCode: string;
  warehouseCode: string;
  zone: string;
  zoneType?: WarehouseLocation["zoneType"];
  usedQty: number;
  capacityQty?: number;
  occupancyRate?: number;
  skuCount: number;
  impactedCustomers: string[];
  riskLevel: "关注" | "高风险";
  riskReason: string;
  workOrderId?: string;
  status: "work_order_created" | "already_handled" | "skipped" | "failed";
  message: string;
};

export type ImportedOrderIssue = {
  row: number;
  level: "warning" | "error";
  message: string;
};

export type ImportedOrderRow = {
  row: number;
  platform: string;
  orderNo: string;
  customerCode: string;
  skuCode: string;
  quantity: number;
  channel: string;
  recipientName?: string;
  deliveryAddress?: string;
  requestedShipDate?: string;
  note?: string;
  status: "ready" | "created" | "skipped";
  outboundId?: string;
  issue?: string;
};

export type OrderImportPreview = {
  totalRows: number;
  readyRows: number;
  readyOrders: number;
  skippedRows: number;
  issues: ImportedOrderIssue[];
  rows: ImportedOrderRow[];
};

export type OrderImportBatch = {
  id: string;
  source: PlatformKind;
  status?: "draft" | "created" | "cancelled";
  fileName: string;
  totalRows: number;
  readyRows?: number;
  readyOrders?: number;
  createdOrders: number;
  skippedRows: number;
  issues: ImportedOrderIssue[];
  rows: ImportedOrderRow[];
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
};

export type BatchOperationPlan = {
  id: string;
  kind: BatchOperationKind;
  title: string;
  targetModule: "inbound" | "inventory" | "outbound" | "logistics" | "billing";
  status: BatchOperationStatus;
  recordCount: number;
  templateName?: string;
  note?: string;
  attempts?: number;
  maxAttempts?: number;
  lastError?: string;
  nextRunAt?: string;
  completedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
};

export type WmsPolicy = {
  id: string;
  warehouseCode: string;
  name: string;
  status: WmsPolicyStatus;
  zonePath: string;
  capacityRule: string;
  stockControls: string[];
  batchControls: string[];
  updatedAt: string;
};

export type LogisticsChannelConfig = {
  id: string;
  carrierName: string;
  serviceName: string;
  status: IntegrationStatus;
  apiMode: "manual" | "sandbox" | "live";
  enabledFeatures: string[];
  surchargeRules: string[];
  credentialRef?: string;
  trackingWebhook?: string;
  updatedAt: string;
};

export type CarrierBillImportRow = {
  row: number;
  trackingNumber: string;
  outboundId?: string;
  customerCode?: string;
  carrierName: string;
  serviceName?: string;
  billedAmount: number;
  expectedAmount?: number;
  diffAmount?: number;
  currency: string;
  billDate?: string;
  status: "matched" | "skipped";
  issue?: string;
};

export type CarrierBillImportBatch = {
  id: string;
  fileName: string;
  carrierName: string;
  totalRows: number;
  matchedRows: number;
  skippedRows: number;
  diffRows: number;
  totalBilledAmount: number;
  totalDiffAmount: number;
  rows: CarrierBillImportRow[];
  createdBy: string;
  createdAt: string;
};

export type PaymentReconciliationImportRow = {
  row: number;
  bankReference: string;
  paymentReference?: string;
  billingId?: string;
  statementId?: string;
  customerCode?: string;
  amount: number;
  currency: string;
  paidAt?: string;
  payerName?: string;
  status: "matched_bill" | "matched_statement" | "skipped";
  matchedBillingIds: string[];
  issue?: string;
};

export type PaymentReconciliationImportBatch = {
  id: string;
  fileName: string;
  totalRows: number;
  matchedRows: number;
  skippedRows: number;
  statementRows: number;
  totalAmount: number;
  matchedAmount: number;
  rows: PaymentReconciliationImportRow[];
  createdBy: string;
  createdAt: string;
};

export type BillingRuleConfig = {
  id: string;
  feeName: string;
  status: "draft" | "active" | "paused";
  feeType: "storage" | "operation" | "labeling" | "return" | "oversize" | "remote_area" | "fuel" | "manual";
  unitLabel: string;
  unitPrice: number;
  settlementCycle: "realtime" | "weekly" | "monthly";
  customerScope: "all" | "verified" | "custom";
  updatedAt: string;
};

export type CustomerWorkOrderStatus = "open" | "processing" | "waiting_customer" | "resolved" | "cancelled";

export type CustomerWorkOrderMessage = {
  id: string;
  authorRole: "customer" | "ops" | "system";
  authorName: string;
  body: string;
  visibleToCustomer: boolean;
  createdAt: string;
};

export type CustomerWorkOrder = {
  id: string;
  customerCode: string;
  category: string;
  title: string;
  priority: "normal" | "urgent";
  status: CustomerWorkOrderStatus;
  referenceNo?: string;
  description: string;
  customerContact?: string;
  internalNote?: string;
  riskTag?: "billing_dispute" | "logistics_fee_review";
  linkedDownloadHref?: string;
  financeReviewRequired?: boolean;
  messages?: CustomerWorkOrderMessage[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerSelfServiceConfig = {
  templates: Array<{ id: string; name: string; href: string; description: string }>;
  enabledDownloads: string[];
  workOrderCategories: string[];
  messageCenterEnabled: boolean;
  updatedAt: string;
};

export type SavedReportView = {
  id: string;
  name: string;
  module:
    | "orders"
    | "warehouse"
    | "logistics"
    | "billing"
    | "charge_events"
    | "automation_runs"
    | "billing_aging"
    | "payment_review"
    | "payment_reconciliation"
    | "finance_adjustments"
    | "profit"
    | "sla"
    | "returns"
    | "exceptions"
    | "scans"
    | "locations"
    | "inventory_lots"
    | "outbound_lot_allocation"
    | "data_quality"
    | "staff_performance"
    | "outbound_review"
    | "pick_waves"
    | "customer_credit"
    | "carrier_labels"
    | "carrier_claims"
    | "platform_sync"
    | "customer_self_service"
    | "documents_security"
    | "notification_deliveries";
  filters: Record<string, string>;
  metrics: string[];
  ownerRole: string;
  updatedAt: string;
};

export type ReportScheduleConfig = {
  id: string;
  viewId: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  recipients: string[];
  status: "active" | "paused" | "archived";
  lastSentAt?: string;
  lastRunAt?: string;
  lastDeliveryStatus?: "sent" | "skipped" | "failed";
  lastDeliveryNote?: string;
  updatedAt: string;
};

export type RolePermissionConfig = {
  role: "admin" | "ops" | "warehouse" | "finance";
  allowedModules: string[];
  sensitiveActions: string[];
  requireSecondConfirm: boolean;
  updatedAt: string;
};

export type ApprovalRuleConfig = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused";
  trigger: ApprovalRuleTrigger;
  minAmount?: number;
  minQuantity?: number;
  approverRoles: RolePermissionConfig["role"][];
  slaHours: number;
  escalationRole?: RolePermissionConfig["role"];
  requireReason: boolean;
  requireAttachment: boolean;
  updatedAt: string;
};

export type OpsExpansionData = {
  platformConnections: PlatformConnection[];
  platformSyncJobs: PlatformSyncJob[];
  orderImportBatches: OrderImportBatch[];
  batchOperationPlans: BatchOperationPlan[];
  wmsPolicies: WmsPolicy[];
  logisticsChannels: LogisticsChannelConfig[];
  carrierBillImportBatches: CarrierBillImportBatch[];
  paymentReconciliationImportBatches: PaymentReconciliationImportBatch[];
  billingRules: BillingRuleConfig[];
  selfServiceWorkOrders: CustomerWorkOrder[];
  selfService: CustomerSelfServiceConfig;
  savedViews: SavedReportView[];
  reportSchedules: ReportScheduleConfig[];
  rolePermissions: RolePermissionConfig[];
  approvalRules: ApprovalRuleConfig[];
};

const storePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "ops-expansion.json") : path.join(process.cwd(), ".local-data", "ops-expansion.json");
const postgresStoreKey = "ops-expansion-v1";
const systemViewUpdatedAt = "2026-06-20T00:00:00.000Z";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${yyyymm}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function systemDefaultSavedViews(): SavedReportView[] {
  return [
    {
      id: "SYS-VIEW-FINANCE-PENDING-APPROVAL",
      name: "财务调账/赔付-待审批",
      module: "finance_adjustments",
      filters: { approvalStatus: "待审批" },
      metrics: ["审批状态", "审批规则", "附件状态", "金额"],
      ownerRole: "finance",
      updatedAt: systemViewUpdatedAt,
    },
    {
      id: "SYS-VIEW-FINANCE-MISSING-ATTACHMENT",
      name: "财务调账/赔付-附件待补",
      module: "finance_adjustments",
      filters: { attachmentStatus: "附件待补" },
      metrics: ["附件状态", "审批规则", "来源工单", "金额"],
      ownerRole: "finance",
      updatedAt: systemViewUpdatedAt,
    },
    {
      id: "SYS-VIEW-FINANCE-DISPUTED",
      name: "财务调账/赔付-争议待复核",
      module: "finance_adjustments",
      filters: { approvalStatus: "已驳回/有争议" },
      metrics: ["审批状态", "客户编号", "来源账单", "下一步处理"],
      ownerRole: "finance",
      updatedAt: systemViewUpdatedAt,
    },
    {
      id: "SYS-VIEW-FINANCE-PAYMENT-REVIEW",
      name: "财务调账/赔付-付款待核销",
      module: "finance_adjustments",
      filters: { approvalStatus: "待核销" },
      metrics: ["审批状态", "金额", "客户编号", "下一步处理"],
      ownerRole: "finance",
      updatedAt: systemViewUpdatedAt,
    },
  ];
}

function withSystemSavedViews(views: SavedReportView[]) {
  const byId = new Set(views.map((item) => item.id));
  const byNameAndModule = new Set(views.map((item) => `${item.module}:${item.name}`));
  const defaults = systemDefaultSavedViews().filter((item) => !byId.has(item.id) && !byNameAndModule.has(`${item.module}:${item.name}`));
  return [...defaults, ...views];
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitList(value: unknown) {
  return clean(value)
    .split(/[,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsv(csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [] as string[], rows: [] as Record<string, string>[] };

  const split = (line: string) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  const headers = split(lines[0]).map((item) => item.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
  return { headers, rows };
}

function rowValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const found = Object.entries(row).find(([header]) => header.trim().toLowerCase() === key.trim().toLowerCase());
    if (found) return found[1];
  }
  return "";
}

function seedData(): OpsExpansionData {
  const updatedAt = now();
  return {
    platformConnections: [],
    platformSyncJobs: [],
    orderImportBatches: [],
    batchOperationPlans: [],
    wmsPolicies: [],
    logisticsChannels: [],
    carrierBillImportBatches: [],
    paymentReconciliationImportBatches: [],
    billingRules: [],
    selfServiceWorkOrders: [],
    selfService: {
      templates: [
        { id: "TPL-OUTBOUND", name: "\u51fa\u5e93\u8ba2\u5355\u5bfc\u5165\u6a21\u677f", href: "/api/outbounds?format=template", description: "\u6279\u91cf\u4e0a\u4f20\u5e73\u53f0\u8ba2\u5355\u3001\u6536\u4ef6\u4eba\u3001\u5730\u5740\u548c SKU \u660e\u7ec6\u3002" },
        { id: "TPL-SKU", name: "SKU \u6279\u91cf\u5bfc\u5165\u6a21\u677f", href: "/api/skus?format=template", description: "\u6279\u91cf\u7ef4\u62a4\u5546\u54c1\u7f16\u7801\u3001\u6761\u7801\u3001\u5206\u7c7b\u548c\u5e93\u5b58\u9884\u8b66\u3002" },
      ],
      enabledDownloads: ["\u5e93\u5b58\u62a5\u8868", "\u5e93\u9f84\u5206\u6790", "\u5e93\u5b58\u6d41\u6c34", "\u8fdb\u9500\u5b58\u62a5\u8868", "\u51fa\u5e93\u660e\u7ec6", "\u7269\u6d41\u5f02\u5e38\u4e0e\u8d54\u4ed8", "\u8d39\u7528\u660e\u7ec6", "\u9762\u5355", "\u7b7e\u6536\u8bc1\u660e"],
      workOrderCategories: ["\u5165\u5e93\u5dee\u5f02", "\u7269\u6d41\u5f02\u5e38", "\u5e93\u5b58\u8c03\u6574", "\u8d26\u5355\u4e89\u8bae", "\u9000\u8d27\u552e\u540e", "\u8d44\u6599\u8865\u5145"],
      messageCenterEnabled: true,
      updatedAt,
    },
    savedViews: systemDefaultSavedViews(),
    reportSchedules: [],
    rolePermissions: [],
    approvalRules: [],
  };
}

function normalizeSelfServiceConfig(value: Partial<CustomerSelfServiceConfig> | undefined, seed: CustomerSelfServiceConfig): CustomerSelfServiceConfig {
  const templates =
    Array.isArray(value?.templates) &&
    value.templates.length > 0 &&
    value.templates.every((item) => item.name && item.description && !item.name.includes("?") && !item.description.includes("?"))
      ? value.templates
      : seed.templates;
  const enabledDownloads = Array.isArray(value?.enabledDownloads) && value.enabledDownloads.some((item) => item && !item.includes("?")) ? value.enabledDownloads : seed.enabledDownloads;
  const workOrderCategories = Array.from(new Set([...(Array.isArray(value?.workOrderCategories) && value.workOrderCategories.some((item) => item && !item.includes("?")) ? value.workOrderCategories : seed.workOrderCategories), "\u5165\u5e93\u5dee\u5f02"]));
  return {
    templates: templates.map((item) => (item.id === "TPL-OUTBOUND" ? { ...item, href: "/api/outbounds?format=template" } : item)),
    enabledDownloads,
    workOrderCategories,
    messageCenterEnabled: value?.messageCenterEnabled ?? seed.messageCenterEnabled,
    updatedAt: value?.updatedAt ?? seed.updatedAt,
  };
}

function normalizeData(parsed: Partial<OpsExpansionData> | undefined): OpsExpansionData {
  const seed = seedData();
  return {
    platformConnections: Array.isArray(parsed?.platformConnections) ? parsed.platformConnections : seed.platformConnections,
    platformSyncJobs: Array.isArray(parsed?.platformSyncJobs) ? parsed.platformSyncJobs : seed.platformSyncJobs,
    orderImportBatches: Array.isArray(parsed?.orderImportBatches) ? parsed.orderImportBatches : seed.orderImportBatches,
    batchOperationPlans: Array.isArray(parsed?.batchOperationPlans) ? parsed.batchOperationPlans : seed.batchOperationPlans,
    wmsPolicies: Array.isArray(parsed?.wmsPolicies) ? parsed.wmsPolicies : seed.wmsPolicies,
    logisticsChannels: Array.isArray(parsed?.logisticsChannels) ? parsed.logisticsChannels : seed.logisticsChannels,
    carrierBillImportBatches: Array.isArray(parsed?.carrierBillImportBatches) ? parsed.carrierBillImportBatches : seed.carrierBillImportBatches,
    paymentReconciliationImportBatches: Array.isArray(parsed?.paymentReconciliationImportBatches) ? parsed.paymentReconciliationImportBatches : seed.paymentReconciliationImportBatches,
    billingRules: Array.isArray(parsed?.billingRules) ? parsed.billingRules : seed.billingRules,
    selfServiceWorkOrders: Array.isArray(parsed?.selfServiceWorkOrders) ? parsed.selfServiceWorkOrders : seed.selfServiceWorkOrders,
    selfService: normalizeSelfServiceConfig(parsed?.selfService, seed.selfService),
    savedViews: withSystemSavedViews(Array.isArray(parsed?.savedViews) ? parsed.savedViews : seed.savedViews),
    reportSchedules: Array.isArray(parsed?.reportSchedules) ? parsed.reportSchedules : seed.reportSchedules,
    rolePermissions: Array.isArray(parsed?.rolePermissions) ? parsed.rolePermissions : seed.rolePermissions,
    approvalRules: Array.isArray(parsed?.approvalRules) ? parsed.approvalRules : seed.approvalRules,
  };
}

async function ensurePostgresStoreTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_ops_expansion_store (
      store_key text primary key,
      payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;
}

async function readPostgresData(): Promise<OpsExpansionData> {
  await ensurePostgresStoreTable();
  const sql = getSql();
  const rows = await sql<{ payload: Partial<OpsExpansionData> }[]>`
    select payload from warehouse_ops_expansion_store where store_key = ${postgresStoreKey} limit 1
  `;
  const data = normalizeData(rows[0]?.payload);
  if (rows.length === 0) await writePostgresData(data);
  return data;
}

async function writePostgresData(data: OpsExpansionData) {
  await ensurePostgresStoreTable();
  const sql = getSql();
  await sql`
    insert into warehouse_ops_expansion_store (store_key, payload, updated_at)
    values (${postgresStoreKey}, ${sql.json(data)}, now())
    on conflict (store_key) do update set
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `;
}

async function readFileData(): Promise<OpsExpansionData> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<OpsExpansionData>;
    return normalizeData(parsed);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return seedData();
    if (error instanceof SyntaxError) return seedData();
    throw error;
  }
}

async function readData(): Promise<OpsExpansionData> {
  if (hasPostgresConfig()) return readPostgresData();
  return readFileData();
}

async function writeData(data: OpsExpansionData) {
  if (hasPostgresConfig()) {
    await writePostgresData(data);
    return;
  }
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

export async function getOpsExpansionData() {
  const data = await readData();
  await writeData(data);
  return data;
}

export async function restoreOpsExpansionData(data: OpsExpansionData) {
  const normalized = normalizeData(data);
  await writeData(normalized);
  return normalized;
}

export async function getOrderImportBatchById(id: string) {
  const data = await getOpsExpansionData();
  return data.orderImportBatches.find((item) => item.id === id) ?? null;
}

export function orderImportBatchIssueReportRows(batch: OrderImportBatch) {
  const issueByRow = new Map(batch.issues.map((issue) => [issue.row, `${issue.level === "error" ? "错误" : "提醒"}：${issue.message}`]));
  return [
    ["批次号", "行号", "来源", "订单号", "客户编号", "SKU 编码", "数量", "物流渠道", "收件人", "收件地址", "要求发货日期", "行状态", "异常/提醒", "关联出库单"],
    ...batch.rows.map((row) => [
      batch.id,
      row.row,
      batch.source,
      row.orderNo,
      row.customerCode,
      row.skuCode,
      row.quantity,
      row.channel,
      row.recipientName ?? "",
      row.deliveryAddress ?? "",
      row.requestedShipDate ?? "",
      row.status === "ready" ? "可导入" : row.status === "created" ? "已创建" : "需处理",
      row.issue ?? issueByRow.get(row.row) ?? "",
      row.outboundId ?? "",
    ]),
    ...batch.issues
      .filter((issue) => !batch.rows.some((row) => row.row === issue.row))
      .map((issue) => [batch.id, issue.row, batch.source, "", "", "", "", "", "", "", "", issue.level === "error" ? "错误" : "提醒", issue.message, ""]),
  ];
}

export async function upsertPlatformConnection(input: {
  platform: PlatformKind;
  storeName: string;
  customerCode: string;
  status?: PlatformConnectionStatus;
  syncMode?: PlatformConnection["syncMode"];
  mappingText?: string;
  note?: string;
}) {
  const data = await getOpsExpansionData();
  const updatedAt = now();
  const fieldMapping = Object.fromEntries(
    splitList(input.mappingText).map((pair) => {
      const [left, right] = pair.split(/[:=]/).map((item) => item.trim());
      return [left, right || left];
    }),
  );
  const existing = data.platformConnections.find((item) => item.platform === input.platform && item.customerCode === input.customerCode && item.storeName === input.storeName);
  const record: PlatformConnection = {
    id: existing?.id ?? makeId("PLAT"),
    platform: input.platform,
    storeName: input.storeName.trim(),
    customerCode: input.customerCode.trim().toUpperCase(),
    status: input.status ?? existing?.status ?? "draft",
    syncMode: input.syncMode ?? existing?.syncMode ?? "manual_csv",
    fieldMapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : existing?.fieldMapping ?? {},
    note: input.note?.trim() || existing?.note,
    lastSyncAt: existing?.lastSyncAt,
    updatedAt,
  };
  if (existing) Object.assign(existing, record);
  else data.platformConnections.unshift(record);
  await writeData(data);
  return record;
}

function rowsToCsv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

function platformOrdersToCsv(rows: Array<{
  platform: string;
  orderNo: string;
  customerCode: string;
  skuCode: string;
  quantity: number;
  channel: string;
  recipientName?: string;
  deliveryAddress?: string;
  requestedShipDate?: string;
  note?: string;
}>) {
  return rowsToCsv([
    ["销售平台", "平台订单号", "客户编号", "SKU 编码", "数量", "物流渠道", "收件人", "收件地址", "要求发货日期", "备注"],
    ...rows.map((row) => [
      row.platform,
      row.orderNo,
      row.customerCode,
      row.skuCode,
      row.quantity,
      row.channel,
      row.recipientName ?? "",
      row.deliveryAddress ?? "",
      row.requestedShipDate ?? "",
      row.note ?? "",
    ]),
  ]);
}

async function createPlatformSyncFailure(data: OpsExpansionData, connection: PlatformConnection, operator: string, error: string) {
  const timestamp = now();
  const job: PlatformSyncJob = {
    id: makeId("SYNC"),
    platformConnectionId: connection.id,
    platform: connection.platform,
    storeName: connection.storeName,
    customerCode: connection.customerCode,
    syncMode: connection.syncMode,
    status: "failed",
    pulledRows: 0,
    readyOrders: 0,
    skippedRows: 0,
    issueCount: 1,
    error,
    createdBy: operator,
    createdAt: timestamp,
  };
  connection.status = "error";
  connection.note = error;
  connection.lastSyncAt = timestamp;
  connection.updatedAt = timestamp;
  data.platformSyncJobs.unshift(job);
  await writeData(data);
  return job;
}

function platformEnvPrefix(platform: PlatformKind) {
  return platform.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function platformCredentialConfigured(connection: PlatformConnection) {
  if (/(credentialRef|apiKey|token)=/i.test(connection.note ?? "")) return true;
  const prefix = platformEnvPrefix(connection.platform);
  return Boolean(process.env[`${prefix}_API_TOKEN`] || process.env[`${prefix}_ACCESS_TOKEN`]);
}

export async function syncPlatformConnection(input: { id: string; operator: string }) {
  const data = await getOpsExpansionData();
  const connection = data.platformConnections.find((item) => item.id === input.id);
  if (!connection) return { job: null, batch: null, error: "未找到平台连接" };
  if (connection.status === "paused") return { job: await createPlatformSyncFailure(data, connection, input.operator, "平台连接已暂停，请恢复后再同步。"), batch: null, error: null };
  if (connection.syncMode === "manual_csv") return { job: await createPlatformSyncFailure(data, connection, input.operator, "当前连接是 CSV 手工导入，请使用导入模板或切换为 API 沙箱/正式。"), batch: null, error: null };
  if (connection.syncMode === "api_live" && !platformCredentialConfigured(connection)) {
    return { job: await createPlatformSyncFailure(data, connection, input.operator, "正式 API 尚未配置凭证，请维护 credentialRef=xxx，或配置平台默认 API_TOKEN / ACCESS_TOKEN 环境变量后再同步。"), batch: null, error: null };
  }

  const coreData = await getWarehouseCoreData();
  const balances = coreData.inventoryBalances.filter((item) => item.customerCode === connection.customerCode && item.availableQty > 0);
  const skuCode = balances[0]?.skuCode ?? coreData.skus.find((item) => item.customerCode === connection.customerCode)?.skuCode;
  if (!skuCode) return { job: await createPlatformSyncFailure(data, connection, input.operator, "该客户暂无可同步 SKU，请先维护 SKU 档案。"), batch: null, error: null };

  const pullResult = await pullPlatformOrders(connection);
  if (!pullResult.ok) {
    return { job: await createPlatformSyncFailure(data, connection, input.operator, pullResult.error || "平台订单同步失败。"), batch: null, error: null };
  }
  const cancelledOrders = (pullResult.cancelledOrders ?? []).map((item) => {
    const matchedOutbound = coreData.outboundOrders.find(
      (order) =>
        order.customerCode === item.customerCode &&
        order.platform === item.platform &&
        order.platformOrderNo === item.orderNo &&
        (!order.platformStoreName || order.platformStoreName === connection.storeName),
    );
    return {
      orderNo: item.orderNo,
      customerCode: item.customerCode,
      rawStatus: item.rawStatus,
      reason: item.reason,
      cancelledAt: item.cancelledAt,
      matchedOutboundId: matchedOutbound?.id,
      outboundStatus: matchedOutbound?.status,
    };
  });
  const pulledOrders = pullResult.orders.length > 0 ? pullResult.orders : [];
  if (connection.syncMode === "api_sandbox" && pulledOrders[0]?.skuCode === "请填写SKU编码") pulledOrders[0].skuCode = skuCode;
  const prepared = await preparePlatformOrdersCsv({ csv: platformOrdersToCsv(pulledOrders), source: connection.platform });
  const timestamp = now();
  const batch: OrderImportBatch = {
    id: makeId("DRAFT"),
    source: connection.platform,
    status: "draft",
    fileName: `平台同步预检-${connection.storeName}.csv`,
    totalRows: prepared.totalRows,
    readyRows: prepared.readyRows,
    readyOrders: prepared.readyOrders,
    createdOrders: 0,
    skippedRows: prepared.skippedRows,
    issues: prepared.issues,
    rows: prepared.rows,
    createdBy: input.operator,
    createdAt: timestamp,
  };
  const job: PlatformSyncJob = {
    id: makeId("SYNC"),
    platformConnectionId: connection.id,
    platform: connection.platform,
    storeName: connection.storeName,
    customerCode: connection.customerCode,
    syncMode: connection.syncMode,
    status: "completed",
    pulledRows: prepared.totalRows + cancelledOrders.length,
    readyOrders: prepared.readyOrders,
    skippedRows: prepared.skippedRows,
    issueCount: prepared.issues.length,
    cancelledRows: cancelledOrders.length,
    cancelledOrders,
    orderImportBatchId: batch.id,
    createdBy: input.operator,
    createdAt: timestamp,
  };

  data.orderImportBatches.unshift(batch);
  data.platformSyncJobs.unshift(job);
  Object.assign(connection, { status: "connected" as PlatformConnectionStatus, lastSyncAt: timestamp, updatedAt: timestamp, note: pullResult.raw ? "平台 API 同步完成，已生成导入预检草稿。" : connection.note });
  await writeData(data);
  return { job, batch, error: null };
}

function findOpenPlatformCancellationWorkOrder(data: OpsExpansionData, customerCode: string, referenceNo: string) {
  return data.selfServiceWorkOrders.find(
    (item) =>
      item.customerCode === customerCode &&
      item.category === "平台取消订单" &&
      item.referenceNo === referenceNo &&
      item.status !== "resolved" &&
      item.status !== "cancelled",
  );
}

function createPlatformCancellationWorkOrder(
  data: OpsExpansionData,
  input: {
    customerCode: string;
    referenceNo: string;
    title: string;
    description: string;
    operator: string;
    priority?: CustomerWorkOrder["priority"];
  },
) {
  const existing = findOpenPlatformCancellationWorkOrder(data, input.customerCode, input.referenceNo);
  if (existing) return existing;
  const timestamp = now();
  const workOrder: CustomerWorkOrder = {
    id: makeId("WO"),
    customerCode: input.customerCode,
    category: "平台取消订单",
    title: input.title,
    priority: input.priority ?? "normal",
    status: "open",
    referenceNo: input.referenceNo,
    description: input.description,
    internalNote: "由平台订单取消复核任务自动生成，运营需确认截单、面单取消、库存释放或售后处理结果。",
    messages: [
      {
        id: makeId("MSG"),
        authorRole: "system",
        authorName: input.operator || "系统",
        body: input.description,
        visibleToCustomer: false,
        createdAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.selfServiceWorkOrders.unshift(workOrder);
  return workOrder;
}

function matchCancelledPlatformOutbound(coreOrders: CoreOutboundOrder[], job: PlatformSyncJob, record: PlatformCancelledOrderSyncRecord) {
  if (record.matchedOutboundId) {
    const matched = coreOrders.find((order) => order.id === record.matchedOutboundId);
    if (matched) return matched;
  }
  const platform = job.platform.toLowerCase();
  const orderNo = record.orderNo.trim().toLowerCase();
  const storeName = job.storeName.trim().toLowerCase();
  return coreOrders.find((order) => {
    if (order.customerCode !== record.customerCode) return false;
    if ((order.platform ?? "").toLowerCase() !== platform) return false;
    if ((order.platformOrderNo ?? "").trim().toLowerCase() !== orderNo) return false;
    if (storeName && order.platformStoreName && order.platformStoreName.toLowerCase() !== storeName) return false;
    return true;
  });
}

export async function reviewPlatformCancelledOrders(input: { operator: string; limit?: number }) {
  const limit = Math.min(200, Math.max(1, Math.floor(input.limit ?? 50)));
  const operator = input.operator.trim() || "平台取消订单复核任务";
  const data = await getOpsExpansionData();
  const coreData = await getWarehouseCoreData();
  const results: PlatformCancellationReviewResult[] = [];

  const jobs = data.platformSyncJobs
    .filter((job) => job.status === "completed" && (job.cancelledOrders?.length ?? 0) > 0)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  for (const job of jobs) {
    for (const record of job.cancelledOrders ?? []) {
      if (results.length >= limit) break;
      const outbound = matchCancelledPlatformOutbound(coreData.outboundOrders, job, record);
      const customerCode = record.customerCode || job.customerCode;
      const reason = record.reason || record.rawStatus || "平台订单已取消或作废";
      const baseDescription = `平台 ${job.platform} / 店铺 ${job.storeName} 推送订单取消：${record.orderNo}。原因：${reason}。同步任务：${job.id}。`;

      if (!outbound) {
        const workOrder = createPlatformCancellationWorkOrder(data, {
          customerCode,
          referenceNo: `${job.platform}:${record.orderNo}`,
          title: "平台取消订单未匹配出库单",
          description: `${baseDescription}系统未匹配到已生成的出库单，请运营确认是否无需发货，或检查平台订单号/客户编号映射。`,
          operator,
          priority: "normal",
        });
        results.push({
          jobId: job.id,
          platform: job.platform,
          storeName: job.storeName,
          customerCode,
          orderNo: record.orderNo,
          workOrderId: workOrder.id,
          status: "unmatched",
          message: "未匹配到出库单，已生成运营核查工单。",
        });
        continue;
      }

      const referenceNo = outbound.id;
      const existingWorkOrder = findOpenPlatformCancellationWorkOrder(data, outbound.customerCode, referenceNo);
      const workOrder =
        existingWorkOrder ??
        createPlatformCancellationWorkOrder(data, {
          customerCode: outbound.customerCode,
          referenceNo,
          title: outbound.status === "shipped" ? "平台取消订单已发货待售后处理" : "平台取消订单待截单处理",
          description:
            outbound.status === "shipped"
              ? `${baseDescription}匹配出库单 ${outbound.id} 已发货，请跟进退回、签收证明、客户沟通或赔付。`
              : `${baseDescription}匹配出库单 ${outbound.id} 当前状态 ${outbound.status}，请复核截单、面单取消和库存释放。`,
          operator,
          priority: outbound.status === "shipped" ? "urgent" : "normal",
        });

      if (outbound.status === "shipped") {
        const existingException = (outbound.exceptions ?? []).find((item) => item.status !== "resolved" && item.message.includes(record.orderNo));
        if (existingException) {
          results.push({
            jobId: job.id,
            platform: job.platform,
            storeName: job.storeName,
            customerCode: outbound.customerCode,
            orderNo: record.orderNo,
            outboundId: outbound.id,
            workOrderId: workOrder.id,
            status: "already_handled",
            message: "出库单已存在未关闭的平台取消异常，已跳过重复创建。",
          });
          continue;
        }
        const exceptionResult = await createCoreOutboundDeliveryException({
          id: outbound.id,
          exceptionType: "return_to_sender",
          message: `${baseDescription}出库单已发货，需运营跟进退回或售后处理。`,
          severity: "critical",
          redeliveryRequired: false,
          operator,
        });
        results.push({
          jobId: job.id,
          platform: job.platform,
          storeName: job.storeName,
          customerCode: outbound.customerCode,
          orderNo: record.orderNo,
          outboundId: outbound.id,
          workOrderId: workOrder.id,
          status: exceptionResult.error ? "failed" : "delivery_exception",
          message: exceptionResult.error || "出库单已发货，已创建派送/退回异常和运营工单。",
        });
        continue;
      }

      if (outbound.interceptStatus === "requested" || outbound.interceptStatus === "restock_pending" || outbound.interceptStatus === "completed") {
        results.push({
          jobId: job.id,
          platform: job.platform,
          storeName: job.storeName,
          customerCode: outbound.customerCode,
          orderNo: record.orderNo,
          outboundId: outbound.id,
          workOrderId: workOrder.id,
          status: "already_handled",
          message: "出库单已经进入截单流程，已跳过重复申请。",
        });
        continue;
      }

      let labelCancelError: string | undefined;
      if (outbound.labelStatus === "generated" || outbound.trackingNumber) {
        const labelResult = await cancelCoreOutboundShippingLabel({
          id: outbound.id,
          operator,
          carrierConfigs: data.logisticsChannels,
          reason: `平台取消订单自动取消面单：${reason}`,
        });
        labelCancelError = labelResult.error ?? undefined;
      }

      const interceptResult = await requestCoreOutboundIntercept({
        id: outbound.id,
        reason: `平台取消订单：${reason}`,
        operator,
      });
      results.push({
        jobId: job.id,
        platform: job.platform,
        storeName: job.storeName,
        customerCode: outbound.customerCode,
        orderNo: record.orderNo,
        outboundId: outbound.id,
        workOrderId: workOrder.id,
        status: interceptResult.error ? "failed" : "intercept_requested",
        message: interceptResult.error || "已申请截单；如已有面单，已尝试取消面单。",
        labelCancelError,
      });
    }
    if (results.length >= limit) break;
  }

  await writeData(data);
  return {
    limit,
    scannedJobs: jobs.length,
    reviewed: results.length,
    intercepts: results.filter((item) => item.status === "intercept_requested").length,
    deliveryExceptions: results.filter((item) => item.status === "delivery_exception").length,
    workOrders: results.filter((item) => item.workOrderId).length,
    unmatched: results.filter((item) => item.status === "unmatched").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
}

function daysUntilLotExpiry(expiryDate?: string) {
  if (!expiryDate) return undefined;
  const expiry = new Date(`${expiryDate}T00:00:00`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  if (!Number.isFinite(expiry) || !Number.isFinite(today)) return undefined;
  return Math.ceil((expiry - today) / 86_400_000);
}

function inventoryLotRisk(lot: InventoryLot, expiryWarningDays: number) {
  const days = daysUntilLotExpiry(lot.expiryDate);
  const reasons: string[] = [];
  if (lot.status === "blocked") reasons.push("批次已冻结");
  if (lot.status === "expired" || (typeof days === "number" && days < 0)) reasons.push("批次已过期");
  if (typeof days === "number" && days >= 0 && days <= expiryWarningDays && lot.status !== "depleted") reasons.push(`${expiryWarningDays} 天内临期`);
  if ((lot.serialNumberStatuses ?? []).some((item) => item.status === "blocked")) reasons.push("存在冻结序列号");
  if (lot.availableQty <= 0 && lot.reservedQty > 0) reasons.push("仅剩预留库存");
  if (reasons.length === 0 || lot.status === "depleted") return null;
  return {
    days,
    level: reasons.some((item) => item.includes("过期") || item.includes("冻结")) ? ("高风险" as const) : ("关注" as const),
    reason: reasons.join("；"),
  };
}

function findOpenInventoryLotRiskWorkOrder(data: OpsExpansionData, customerCode: string, lotId: string) {
  return data.selfServiceWorkOrders.find(
    (item) =>
      item.customerCode === customerCode &&
      item.category === "库存批次风险" &&
      item.referenceNo === lotId &&
      item.status !== "resolved" &&
      item.status !== "cancelled",
  );
}

function createInventoryLotRiskWorkOrder(
  data: OpsExpansionData,
  input: {
    lot: InventoryLot;
    title: string;
    description: string;
    operator: string;
    priority: CustomerWorkOrder["priority"];
  },
) {
  const existing = findOpenInventoryLotRiskWorkOrder(data, input.lot.customerCode, input.lot.id);
  if (existing) return existing;
  const timestamp = now();
  const workOrder: CustomerWorkOrder = {
    id: makeId("WO"),
    customerCode: input.lot.customerCode,
    category: "库存批次风险",
    title: input.title,
    priority: input.priority,
    status: "open",
    referenceNo: input.lot.id,
    description: input.description,
    internalNote: "由库存批次风险巡检自动生成，运营需确认临期处理、冻结原因、退供、销毁、换标或客户确认方案。",
    messages: [
      {
        id: makeId("MSG"),
        authorRole: "system",
        authorName: input.operator || "系统",
        body: input.description,
        visibleToCustomer: false,
        createdAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.selfServiceWorkOrders.unshift(workOrder);
  return workOrder;
}

export async function reviewInventoryLotRisks(input: { operator: string; limit?: number; expiryWarningDays?: number }) {
  const limit = Math.min(200, Math.max(1, Math.floor(input.limit ?? 80)));
  const expiryWarningDays = Math.min(180, Math.max(1, Math.floor(input.expiryWarningDays ?? 45)));
  const operator = input.operator.trim() || "库存批次风险巡检任务";
  const data = await getOpsExpansionData();
  const coreData = await getWarehouseCoreData();
  const results: InventoryLotRiskReviewResult[] = [];

  const riskyLots = [...coreData.inventoryLots]
    .map((lot) => ({ lot, risk: inventoryLotRisk(lot, expiryWarningDays) }))
    .filter((item): item is { lot: InventoryLot; risk: NonNullable<ReturnType<typeof inventoryLotRisk>> } => Boolean(item.risk))
    .sort((left, right) => {
      const level = (value: "关注" | "高风险") => (value === "高风险" ? 0 : 1);
      return level(left.risk.level) - level(right.risk.level) || (left.risk.days ?? 9999) - (right.risk.days ?? 9999);
    })
    .slice(0, limit);

  for (const { lot, risk } of riskyLots) {
    let currentLot = lot;
    const shouldMarkExpired = typeof risk.days === "number" && risk.days < 0 && lot.status !== "expired" && lot.status !== "blocked" && lot.status !== "depleted";
    if (shouldMarkExpired) {
      const update = await updateInventoryLot({
        id: lot.id,
        action: "update",
        expiryDate: lot.expiryDate,
        note: `库存批次风险巡检自动标记过期：${risk.reason}`,
        operator,
      });
      if (update.error || !update.lot) {
        results.push({
          lotId: lot.id,
          customerCode: lot.customerCode,
          skuCode: lot.skuCode,
          lotNo: lot.lotNo,
          expiryDate: lot.expiryDate,
          daysUntilExpiry: risk.days,
          riskLevel: risk.level,
          riskReason: risk.reason,
          status: "failed",
          message: update.error || "批次状态刷新失败。",
        });
        continue;
      }
      currentLot = update.lot;
    }

    const existingWorkOrder = findOpenInventoryLotRiskWorkOrder(data, currentLot.customerCode, currentLot.id);
    if (existingWorkOrder) {
      results.push({
        lotId: currentLot.id,
        customerCode: currentLot.customerCode,
        skuCode: currentLot.skuCode,
        lotNo: currentLot.lotNo,
        expiryDate: currentLot.expiryDate,
        daysUntilExpiry: risk.days,
        riskLevel: risk.level,
        riskReason: risk.reason,
        status: shouldMarkExpired ? "expired_marked" : "already_handled",
        workOrderId: existingWorkOrder.id,
        message: shouldMarkExpired ? "已刷新为过期状态，已有未关闭工单。" : "已有未关闭工单，跳过重复创建。",
      });
      continue;
    }

    const workOrder = createInventoryLotRiskWorkOrder(data, {
      lot: currentLot,
      title: risk.level === "高风险" ? "库存批次高风险待处理" : "库存批次临期待确认",
      priority: risk.level === "高风险" ? "urgent" : "normal",
      operator,
      description: `批次 ${currentLot.lotNo} / ${currentLot.skuCode} / ${currentLot.warehouseCode}${currentLot.locationCode ? ` / ${currentLot.locationCode}` : ""} 存在风险：${risk.reason}。数量：可用 ${currentLot.availableQty}，预留 ${currentLot.reservedQty}，效期 ${currentLot.expiryDate || "未填写"}。请运营确认促销优先出库、冻结原因、退供、销毁、换标或客户确认方案。`,
    });

    results.push({
      lotId: currentLot.id,
      customerCode: currentLot.customerCode,
      skuCode: currentLot.skuCode,
      lotNo: currentLot.lotNo,
      expiryDate: currentLot.expiryDate,
      daysUntilExpiry: risk.days,
      riskLevel: risk.level,
      riskReason: risk.reason,
      status: shouldMarkExpired ? "expired_marked" : "work_order_created",
      workOrderId: workOrder.id,
      message: shouldMarkExpired ? "已刷新为过期状态，并生成运营工单。" : "已生成运营工单。",
    });
  }

  await writeData(data);
  return {
    limit,
    expiryWarningDays,
    scannedLots: coreData.inventoryLots.length,
    reviewed: results.length,
    expiredMarked: results.filter((item) => item.status === "expired_marked").length,
    workOrders: results.filter((item) => item.workOrderId && item.status !== "already_handled").length,
    alreadyHandled: results.filter((item) => item.status === "already_handled").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
}

function balanceTotalQty(input: { availableQty: number; reservedQty: number; frozenQty?: number; defectiveQty?: number }) {
  return input.availableQty + input.reservedQty + (input.frozenQty ?? 0) + (input.defectiveQty ?? 0);
}

function warehouseLocationRisk(
  location: WarehouseLocation,
  coreData: Awaited<ReturnType<typeof getWarehouseCoreData>>,
  occupancyWarningRate: number,
) {
  const balances = coreData.inventoryBalances.filter((item) => item.locationCode === location.locationCode && balanceTotalQty(item) > 0);
  const utilization = getLocationUtilization(coreData, location.locationCode);
  const reasons: string[] = [];
  const highRiskSignals: string[] = [];

  if (location.status === "blocked" && utilization.usedQty > 0) highRiskSignals.push("停用库位仍有库存占用");
  if (location.status === "reserved" && utilization.usedQty > 0) reasons.push("预留库位已有库存占用");
  if ((typeof location.capacityQty !== "number" || location.capacityQty <= 0) && utilization.usedQty > 0) reasons.push("库位已有库存但未设置件数容量");
  if (typeof location.capacityQty === "number" && location.capacityQty > 0 && utilization.usedQty > location.capacityQty) highRiskSignals.push("库位已超容量");
  if (typeof utilization.occupancyRate === "number" && utilization.occupancyRate >= occupancyWarningRate && utilization.usedQty <= (location.capacityQty ?? Number.POSITIVE_INFINITY)) reasons.push("库位接近满仓");
  if (location.allowMixedSku === false && utilization.skuCount > 1) highRiskSignals.push("库位不允许混放但存在多个 SKU");

  const nonFrozenQty = balances.reduce((sum, item) => sum + item.availableQty + item.reservedQty + (item.defectiveQty ?? 0), 0);
  const nonDefectiveQty = balances.reduce((sum, item) => sum + item.availableQty + item.reservedQty + (item.frozenQty ?? 0), 0);
  const specialQty = balances.reduce((sum, item) => sum + (item.frozenQty ?? 0) + (item.defectiveQty ?? 0), 0);
  if (location.zoneType === "frozen" && nonFrozenQty > 0) highRiskSignals.push("冻结库位存在普通/预留/残次库存");
  if (location.zoneType === "defective" && nonDefectiveQty > 0) highRiskSignals.push("残次品位存在普通/预留/冻结库存");
  if (!["frozen", "defective"].includes(location.zoneType ?? "standard") && specialQty > 0) reasons.push("普通库位存在冻结或残次库存");

  const allReasons = [...highRiskSignals, ...reasons];
  if (allReasons.length === 0) return null;
  return {
    utilization,
    balances,
    level: highRiskSignals.length > 0 ? ("高风险" as const) : ("关注" as const),
    reason: allReasons.join("；"),
  };
}

function findOpenWarehouseLocationRiskWorkOrder(data: OpsExpansionData, referenceNo: string) {
  return data.selfServiceWorkOrders.find(
    (item) =>
      item.category === "库位风险" &&
      item.referenceNo === referenceNo &&
      item.status !== "resolved" &&
      item.status !== "cancelled",
  );
}

function createWarehouseLocationRiskWorkOrder(
  data: OpsExpansionData,
  input: {
    location: WarehouseLocation;
    customerCode: string;
    title: string;
    description: string;
    operator: string;
    priority: CustomerWorkOrder["priority"];
  },
) {
  const existing = findOpenWarehouseLocationRiskWorkOrder(data, input.location.locationCode);
  if (existing) return existing;
  const timestamp = now();
  const workOrder: CustomerWorkOrder = {
    id: makeId("WO"),
    customerCode: input.customerCode,
    category: "库位风险",
    title: input.title,
    priority: input.priority,
    status: "open",
    referenceNo: input.location.locationCode,
    description: input.description,
    internalNote: "由库位风险巡检自动生成，运营或仓库需要确认是否移库、调整容量、处理冻结/残次库存，或修正库位混放规则。",
    messages: [
      {
        id: makeId("MSG"),
        authorRole: "system",
        authorName: input.operator || "系统",
        body: input.description,
        visibleToCustomer: false,
        createdAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.selfServiceWorkOrders.unshift(workOrder);
  return workOrder;
}

export async function reviewWarehouseLocationRisks(input: { operator: string; limit?: number; occupancyWarningRate?: number }) {
  const limit = Math.min(200, Math.max(1, Math.floor(input.limit ?? 100)));
  const occupancyWarningRate = Math.min(1, Math.max(0.5, Number(input.occupancyWarningRate ?? 0.9)));
  const operator = input.operator.trim() || "库位风险巡检任务";
  const data = await getOpsExpansionData();
  const coreData = await getWarehouseCoreData();
  const results: WarehouseLocationRiskReviewResult[] = [];

  const riskyLocations = coreData.locations
    .map((location) => ({ location, risk: warehouseLocationRisk(location, coreData, occupancyWarningRate) }))
    .filter((item): item is { location: WarehouseLocation; risk: NonNullable<ReturnType<typeof warehouseLocationRisk>> } => Boolean(item.risk))
    .sort((left, right) => {
      const level = (value: "关注" | "高风险") => (value === "高风险" ? 0 : 1);
      return level(left.risk.level) - level(right.risk.level) || right.risk.utilization.usedQty - left.risk.utilization.usedQty || left.location.locationCode.localeCompare(right.location.locationCode);
    })
    .slice(0, limit);

  for (const { location, risk } of riskyLocations) {
    const impactedCustomers = [...new Set(risk.balances.map((item) => item.customerCode))];
    const primaryCustomer = impactedCustomers[0] || "INTERNAL";
    const existingWorkOrder = findOpenWarehouseLocationRiskWorkOrder(data, location.locationCode);
    const baseResult = {
      locationCode: location.locationCode,
      warehouseCode: location.warehouseCode,
      zone: location.zone,
      zoneType: location.zoneType,
      usedQty: risk.utilization.usedQty,
      capacityQty: risk.utilization.capacityQty,
      occupancyRate: risk.utilization.occupancyRate,
      skuCount: risk.utilization.skuCount,
      impactedCustomers,
      riskLevel: risk.level,
      riskReason: risk.reason,
    };

    if (existingWorkOrder) {
      results.push({
        ...baseResult,
        workOrderId: existingWorkOrder.id,
        status: "already_handled",
        message: "已有未关闭库位风险工单，跳过重复创建。",
      });
      continue;
    }

    const workOrder = createWarehouseLocationRiskWorkOrder(data, {
      location,
      customerCode: primaryCustomer,
      priority: risk.level === "高风险" ? "urgent" : "normal",
      operator,
      title: risk.level === "高风险" ? "库位高风险待处理" : "库位容量/规则待复核",
      description: `库位 ${location.locationCode} / ${location.warehouseCode} / ${location.zone} 存在风险：${risk.reason}。当前占用 ${risk.utilization.usedQty} 件，容量 ${risk.utilization.capacityQty ?? "未设置"} 件，SKU 数 ${risk.utilization.skuCount}，影响客户 ${impactedCustomers.join("、") || "内部库位"}。请确认是否移库、调整容量、冻结/残次处理或修正库位规则。`,
    });

    results.push({
      ...baseResult,
      workOrderId: workOrder.id,
      status: "work_order_created",
      message: "已生成库位风险运营工单。",
    });
  }

  await writeData(data);
  return {
    limit,
    occupancyWarningRate,
    scannedLocations: coreData.locations.length,
    reviewed: results.length,
    highRisk: results.filter((item) => item.riskLevel === "高风险").length,
    workOrders: results.filter((item) => item.status === "work_order_created").length,
    alreadyHandled: results.filter((item) => item.status === "already_handled").length,
    results,
  };
}

type PreparedOrderGroup = {
  platform: string;
  orderNo: string;
  customerCode: string;
  channel: string;
  recipientName: string;
  deliveryAddress: string;
  requestedShipDate: string;
  note: string;
  skuLines: Array<{ skuCode: string; quantity: number }>;
  rowNumbers: number[];
};

const orderImportFieldAliases: Record<string, string[]> = {
  customerCode: ["客户编号", "客户编码", "customer", "customerCode", "customer_code"],
  orderNo: ["订单号", "平台订单号", "orderNo", "orderNumber", "order_id"],
  skuCode: ["SKU", "SKU 编码", "商品编码", "sku", "skuCode", "seller_sku"],
  quantity: ["数量", "件数", "quantity", "qty"],
  channel: ["物流渠道", "渠道", "shippingMethod", "channel"],
  recipientName: ["收件人", "收货人", "recipient", "recipientName", "buyer_name"],
  deliveryAddress: ["收件地址", "收货地址", "地址", "address", "deliveryAddress"],
  requestedShipDate: ["发货日期", "要求发货日期", "发货时间", "shipDate", "requestedShipDate"],
  note: ["备注", "note", "remark"],
};

const requiredOrderImportFields = [
  { key: "customerCode", label: "客户编号" },
  { key: "orderNo", label: "平台订单号" },
  { key: "skuCode", label: "SKU 编码" },
  { key: "quantity", label: "数量" },
];

function mappedValue(row: Record<string, string>, mapping: Record<string, string> | undefined, canonical: string, aliases: string[]) {
  const mappedHeader = mapping?.[canonical];
  const reverseMapped = Object.entries(mapping ?? {}).find(([, value]) => value === canonical)?.[0];
  const candidates = [mappedHeader, reverseMapped, canonical, ...(orderImportFieldAliases[canonical] ?? []), ...aliases].filter(Boolean) as string[];
  for (const key of candidates) {
    const direct = clean(row[key]);
    if (direct) return direct;
    const found = Object.entries(row).find(([header]) => header.trim().toLowerCase() === key.trim().toLowerCase());
    if (found) {
      const value = clean(found[1]);
      if (value) return value;
    }
  }
  return "";
}

function hasMappedHeader(headers: string[], mapping: Record<string, string>, canonical: string) {
  const normalizedHeaders = new Set(headers.map((header) => header.trim().toLowerCase()));
  const mappedHeader = mapping?.[canonical];
  const reverseMapped = Object.entries(mapping ?? {}).find(([, value]) => value === canonical)?.[0];
  const candidates = [mappedHeader, reverseMapped, canonical, ...(orderImportFieldAliases[canonical] ?? [])].filter(Boolean) as string[];
  return candidates.some((candidate) => normalizedHeaders.has(candidate.trim().toLowerCase()));
}

async function preparePlatformOrdersCsv({ csv, source }: { csv: string; source: PlatformKind }) {
  const data = await getOpsExpansionData();
  const coreData = await getWarehouseCoreData();
  const customers = new Set(coreData.customers.map((item) => item.customerCode));
  const skuByCustomer = new Set(coreData.skus.map((item) => `${item.customerCode}:${item.skuCode}`));
  const availableByCustomerSku = new Map<string, number>();
  coreData.inventoryBalances.forEach((balance) => {
    const key = `${balance.customerCode}:${balance.skuCode}`;
    availableByCustomerSku.set(key, (availableByCustomerSku.get(key) ?? 0) + Math.max(0, balance.availableQty));
  });
  const requestedByCustomerSku = new Map<string, number>();
  const importedOrderKeys = new Set(data.orderImportBatches.flatMap((batch) => batch.rows.filter((row) => row.status === "created").map((row) => `${row.customerCode}:${row.orderNo}`)));
  const platformMappings = data.platformConnections
    .filter((item) => item.platform === source || source === "csv")
    .filter((item) => item.status !== "paused" && item.status !== "error")
    .map((item) => item.fieldMapping);
  const { headers, rows } = parseCsv(csv);
  const issues: ImportedOrderIssue[] = [];
  const importedRows: ImportedOrderRow[] = [];
  const grouped = new Map<string, PreparedOrderGroup>();
  if (rows.length === 0) issues.push({ row: 1, level: "error", message: "CSV 没有可导入的订单明细，请先填写订单数据。" });
  const preferredMapping = platformMappings[0] ?? {};
  const missingHeaders = requiredOrderImportFields.filter((field) => !hasMappedHeader(headers, preferredMapping, field.key)).map((field) => field.label);
  if (headers.length > 0 && missingHeaders.length > 0) {
    issues.push({ row: 1, level: "error", message: `缺少必填列：${missingHeaders.join("、")}。请下载字段映射说明或在平台配置里维护字段映射。` });
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const mapping = platformMappings.find((candidate) => mappedValue(row, candidate, "customerCode", ["customer", "客户编号"])) ?? platformMappings[0] ?? {};
    const customerCode = mappedValue(row, mapping, "customerCode", ["customer", "客户编号"]).toUpperCase();
    const orderNo = mappedValue(row, mapping, "orderNo", ["orderNumber", "订单号", "平台订单号"]);
    const skuCode = mappedValue(row, mapping, "skuCode", ["sku", "SKU", "商品编码"]).toUpperCase();
    const quantity = positiveInt(mappedValue(row, mapping, "quantity", ["qty", "数量"]));
    const channel = mappedValue(row, mapping, "channel", ["shippingMethod", "物流渠道", "渠道"]) || source;
    const recipientName = mappedValue(row, mapping, "recipientName", ["recipient", "收件人", "收货人"]);
    const deliveryAddress = mappedValue(row, mapping, "deliveryAddress", ["address", "收货地址", "地址"]);
    const requestedShipDate = mappedValue(row, mapping, "requestedShipDate", ["shipDate", "发货日期", "发货时间"]);
    const note = mappedValue(row, mapping, "note", ["备注"]);

    const baseRow = { row: rowNumber, platform: source, orderNo, customerCode, skuCode, quantity, channel };
    if (!customerCode || !customers.has(customerCode)) {
      issues.push({ row: rowNumber, level: "error", message: "客户编号不存在或为空。" });
      importedRows.push({ ...baseRow, status: "skipped", issue: "客户编号不存在或为空。" });
      continue;
    }
    if (!orderNo) {
      issues.push({ row: rowNumber, level: "error", message: "订单号为空。" });
      importedRows.push({ ...baseRow, status: "skipped", issue: "订单号为空。" });
      continue;
    }
    if (importedOrderKeys.has(`${customerCode}:${orderNo}`)) {
      issues.push({ row: rowNumber, level: "error", message: "订单号已导入，请勿重复创建。" });
      importedRows.push({ ...baseRow, status: "skipped", issue: "订单号已导入，请勿重复创建。" });
      continue;
    }
    if (!skuByCustomer.has(`${customerCode}:${skuCode}`) || quantity <= 0) {
      issues.push({ row: rowNumber, level: "error", message: "SKU 不存在或数量无效。" });
      importedRows.push({ ...baseRow, status: "skipped", issue: "SKU 不存在或数量无效。" });
      continue;
    }
    if (!recipientName || !deliveryAddress) issues.push({ row: rowNumber, level: "warning", message: "收件人或地址为空，导入后需要运营复核。" });
    if (!requestedShipDate) issues.push({ row: rowNumber, level: "warning", message: "发货日期为空，默认进入待审核队列。" });

    const stockKey = `${customerCode}:${skuCode}`;
    const availableQty = availableByCustomerSku.get(stockKey) ?? 0;
    const requestedQty = requestedByCustomerSku.get(stockKey) ?? 0;
    if (requestedQty + quantity > availableQty) {
      const issue = `可用库存不足：当前可用 ${availableQty} 件，本批次已占用 ${requestedQty} 件，本行需要 ${quantity} 件。`;
      issues.push({ row: rowNumber, level: "error", message: issue });
      importedRows.push({ ...baseRow, status: "skipped", issue });
      continue;
    }
    requestedByCustomerSku.set(stockKey, requestedQty + quantity);

    const groupKey = `${customerCode}:${orderNo}:${channel}:${recipientName}:${deliveryAddress}`;
    const existingOrderGroup = [...grouped.values()].find((item) => item.customerCode === customerCode && item.orderNo === orderNo && `${item.customerCode}:${item.orderNo}:${item.channel}:${item.recipientName}:${item.deliveryAddress}` !== groupKey);
    if (existingOrderGroup) issues.push({ row: rowNumber, level: "warning", message: "同一订单号出现不同收件人、地址或物流渠道，请确认是否需要拆单。" });

    const current =
      grouped.get(groupKey) ??
      {
        platform: source,
        orderNo,
        customerCode,
        channel,
        recipientName,
        deliveryAddress,
        requestedShipDate,
        note,
        skuLines: [],
        rowNumbers: [],
      };
    const existingLine = current.skuLines.find((line) => line.skuCode === skuCode);
    if (existingLine) {
      existingLine.quantity += quantity;
      issues.push({ row: rowNumber, level: "warning", message: "同一订单内重复 SKU 已自动合并数量。" });
    } else {
      current.skuLines.push({ skuCode, quantity });
    }
    current.rowNumbers.push(rowNumber);
    grouped.set(groupKey, current);
  }

  for (const group of grouped.values()) {
    group.skuLines.forEach((line) => {
      importedRows.push({
        row: group.rowNumbers[0],
        platform: group.platform,
        orderNo: group.orderNo,
        customerCode: group.customerCode,
        skuCode: line.skuCode,
        quantity: line.quantity,
        channel: group.channel,
        recipientName: group.recipientName,
        deliveryAddress: group.deliveryAddress,
        requestedShipDate: group.requestedShipDate,
        note: group.note,
        status: "ready",
      });
    });
  }

  const readyRows = [...grouped.values()].reduce((sum, group) => sum + group.rowNumbers.length, 0);
  return {
    data,
    source,
    totalRows: rows.length,
    readyRows,
    readyOrders: grouped.size,
    skippedRows: rows.length - readyRows,
    issues,
    rows: importedRows,
    groups: [...grouped.values()],
  };
}

export async function previewPlatformOrdersCsv({ csv, source }: { csv: string; source: PlatformKind }): Promise<OrderImportPreview> {
  const prepared = await preparePlatformOrdersCsv({ csv, source });
  return {
    totalRows: prepared.totalRows,
    readyRows: prepared.readyRows,
    readyOrders: prepared.readyOrders,
    skippedRows: prepared.skippedRows,
    issues: prepared.issues,
    rows: prepared.rows,
  };
}

export async function saveOrderImportDraft({
  preview,
  source,
  fileName,
  operator,
}: {
  preview: OrderImportPreview;
  source: PlatformKind;
  fileName?: string;
  operator: string;
}) {
  const data = await getOpsExpansionData();
  const batch: OrderImportBatch = {
    id: makeId("DRAFT"),
    source,
    status: "draft",
    fileName: fileName?.trim() || "订单导入预检草稿.csv",
    totalRows: preview.totalRows,
    readyRows: preview.readyRows,
    readyOrders: preview.readyOrders,
    createdOrders: 0,
    skippedRows: preview.skippedRows,
    issues: preview.issues,
    rows: preview.rows,
    createdBy: operator,
    createdAt: now(),
  };
  data.orderImportBatches.unshift(batch);
  await writeData(data);
  return batch;
}

export async function importPlatformOrdersCsv({ csv, source, fileName, operator }: { csv: string; source: PlatformKind; fileName?: string; operator: string }) {
  const prepared = await preparePlatformOrdersCsv({ csv, source });
  const importedRows = prepared.rows.filter((row) => row.status === "skipped");
  const issues = [...prepared.issues];
  let createdOrders = 0;
  let createdInputRows = 0;

  for (const group of prepared.groups) {
    const outbound = await createCustomerOutboundOrder({
      customerCode: group.customerCode,
      channel: group.channel,
      orderCount: 1,
      skuLines: group.skuLines,
      recipientName: group.recipientName,
      deliveryAddress: group.deliveryAddress,
      requestedShipDate: group.requestedShipDate,
      note: group.note || `${source} 导入订单 ${group.orderNo} / ${operator}`,
      platform: group.platform,
      platformOrderNo: group.orderNo,
      platformStoreName: prepared.data.platformConnections.find((item) => item.platform === source && item.customerCode === group.customerCode)?.storeName,
    });
    if (!outbound) {
      group.rowNumbers.forEach((rowNumber) => {
        issues.push({ row: rowNumber, level: "error", message: "创建出库单失败，请检查 SKU 和库存。" });
        importedRows.push({ row: rowNumber, platform: group.platform, orderNo: group.orderNo, customerCode: group.customerCode, skuCode: group.skuLines.map((line) => line.skuCode).join(" | "), quantity: group.skuLines.reduce((sum, line) => sum + line.quantity, 0), channel: group.channel, recipientName: group.recipientName, deliveryAddress: group.deliveryAddress, requestedShipDate: group.requestedShipDate, note: group.note, status: "skipped", issue: "创建出库单失败。" });
      });
      continue;
    }
    createdOrders += 1;
    createdInputRows += group.rowNumbers.length;
    group.skuLines.forEach((line) => {
      importedRows.push({ row: group.rowNumbers[0], platform: group.platform, orderNo: group.orderNo, customerCode: group.customerCode, skuCode: line.skuCode, quantity: line.quantity, channel: group.channel, recipientName: group.recipientName, deliveryAddress: group.deliveryAddress, requestedShipDate: group.requestedShipDate, note: group.note, status: "created", outboundId: outbound.id });
    });
  }

  const batch: OrderImportBatch = {
    id: makeId("IMP"),
    source,
    status: "created",
    fileName: fileName?.trim() || "platform-orders.csv",
    totalRows: prepared.totalRows,
    readyRows: prepared.readyRows,
    readyOrders: prepared.readyOrders,
    createdOrders,
    skippedRows: prepared.totalRows - createdInputRows,
    issues,
    rows: importedRows,
    createdBy: operator,
    createdAt: now(),
    confirmedAt: now(),
  };
  prepared.data.orderImportBatches.unshift(batch);
  await writeData(prepared.data);
  return batch;
}

export async function confirmOrderImportDraft({ id, operator }: { id: string; operator: string }) {
  const data = await getOpsExpansionData();
  const batch = data.orderImportBatches.find((item) => item.id === id);
  if (!batch) return { batch: null, error: "未找到导入批次。" };
  if (batch.status === "cancelled") return { batch, error: "该批次已取消，不能再创建出库单。" };
  if (batch.status !== "draft") return { batch, error: "该批次已经确认导入，不能重复创建出库单。" };

  const readyRows = batch.rows.filter((row) => row.status === "ready");
  if (readyRows.length === 0) return { batch, error: "该草稿没有可导入行。" };
  const confirmedOrderKeys = new Set(
    data.orderImportBatches
      .filter((item) => item.id !== batch.id)
      .flatMap((item) => item.rows.filter((row) => row.status === "created").map((row) => `${row.customerCode}:${row.orderNo}`)),
  );

  const grouped = new Map<
    string,
    {
      platform: string;
      orderNo: string;
      customerCode: string;
      channel: string;
      recipientName: string;
      deliveryAddress: string;
      requestedShipDate: string;
      note: string;
      skuLines: Array<{ skuCode: string; quantity: number }>;
      rows: ImportedOrderRow[];
    }
  >();

  readyRows.forEach((row) => {
    if (confirmedOrderKeys.has(`${row.customerCode}:${row.orderNo}`)) {
      row.status = "skipped";
      row.issue = "订单号已在其他批次创建，请勿重复导入。";
      return;
    }
    const key = `${row.customerCode}:${row.orderNo}:${row.channel}:${row.recipientName ?? ""}:${row.deliveryAddress ?? ""}`;
    const current =
      grouped.get(key) ??
      {
        platform: row.platform,
        orderNo: row.orderNo,
        customerCode: row.customerCode,
        channel: row.channel,
        recipientName: row.recipientName ?? "",
        deliveryAddress: row.deliveryAddress ?? "",
        requestedShipDate: row.requestedShipDate ?? "",
        note: row.note ?? "",
        skuLines: [],
        rows: [],
      };
    const existingLine = current.skuLines.find((line) => line.skuCode === row.skuCode);
    if (existingLine) existingLine.quantity += row.quantity;
    else current.skuLines.push({ skuCode: row.skuCode, quantity: row.quantity });
    current.rows.push(row);
    grouped.set(key, current);
  });

  const confirmedAt = now();
  const issues = [...batch.issues];
  let createdOrders = 0;
  let createdInputRows = 0;

  for (const group of grouped.values()) {
    const outbound = await createCustomerOutboundOrder({
      customerCode: group.customerCode,
      channel: group.channel,
      orderCount: 1,
      skuLines: group.skuLines,
      recipientName: group.recipientName,
      deliveryAddress: group.deliveryAddress,
      requestedShipDate: group.requestedShipDate,
      note: group.note || `${group.platform} 草稿确认导入 ${group.orderNo} / ${operator}`,
      platform: group.platform,
      platformOrderNo: group.orderNo,
      platformStoreName: data.platformConnections.find((item) => item.platform === group.platform && item.customerCode === group.customerCode)?.storeName,
    });
    if (!outbound) {
      group.rows.forEach((row) => {
        row.status = "skipped";
        row.issue = "创建出库单失败，请检查 SKU 和库存。";
        issues.push({ row: row.row, level: "error", message: "创建出库单失败，请检查 SKU 和库存。" });
      });
      continue;
    }
    createdOrders += 1;
    createdInputRows += group.rows.length;
    group.rows.forEach((row) => {
      row.status = "created";
      row.outboundId = outbound.id;
      row.issue = undefined;
    });
  }

  readyRows
    .filter((row) => row.issue === "订单号已在其他批次创建，请勿重复导入。")
    .forEach((row) => {
      issues.push({ row: row.row, level: "error", message: "订单号已在其他批次创建，请勿重复导入。" });
    });

  batch.status = "created";
  batch.createdOrders = createdOrders;
  batch.skippedRows = batch.totalRows - createdInputRows;
  batch.readyRows = 0;
  batch.readyOrders = 0;
  batch.issues = issues;
  batch.confirmedAt = confirmedAt;

  await writeData(data);
  return { batch };
}

export async function cancelOrderImportDraft({ id, operator, reason }: { id: string; operator: string; reason?: string }) {
  const data = await getOpsExpansionData();
  const batch = data.orderImportBatches.find((item) => item.id === id);
  if (!batch) return { batch: null, error: "未找到导入批次。" };
  if (batch.status === "created") return { batch, error: "该批次已经创建出库单，不能取消。" };
  if (batch.status === "cancelled") return { batch, error: null };

  const timestamp = now();
  batch.status = "cancelled";
  batch.readyRows = 0;
  batch.readyOrders = 0;
  batch.cancelledAt = timestamp;
  batch.cancelledBy = operator;
  batch.cancelReason = reason?.trim() || "运营取消同步预检批次";
  batch.rows = batch.rows.map((row) =>
    row.status === "ready"
      ? {
          ...row,
          status: "skipped" as const,
          issue: batch.cancelReason,
        }
      : row,
  );
  batch.issues = [
    ...batch.issues,
    { row: 0, level: "warning" as const, message: `批次已取消：${batch.cancelReason}` },
  ];
  await writeData(data);
  return { batch, error: null };
}

export async function createBatchOperationPlan(input: {
  kind: BatchOperationKind;
  title: string;
  targetModule: BatchOperationPlan["targetModule"];
  recordCount?: number;
  templateName?: string;
  note?: string;
  createdBy: string;
}) {
  const data = await getOpsExpansionData();
  const createdAt = now();
  const plan: BatchOperationPlan = {
    id: makeId("BATCH"),
    kind: input.kind,
    title: input.title.trim(),
    targetModule: input.targetModule,
    status: "queued",
    recordCount: Math.max(0, Math.floor(input.recordCount ?? 0)),
    templateName: input.templateName?.trim() || undefined,
    note: input.note?.trim() || undefined,
    attempts: 0,
    maxAttempts: 3,
    createdBy: input.createdBy,
    createdAt,
    updatedAt: createdAt,
  };
  data.batchOperationPlans.unshift(plan);
  await writeData(data);
  return plan;
}

export async function updateBatchOperationStatus(input: { id: string; status: BatchOperationStatus; note?: string; error?: string }) {
  const data = await getOpsExpansionData();
  const plan = data.batchOperationPlans.find((item) => item.id === input.id);
  if (!plan) return { plan: null, error: "未找到批量作业计划" };
  plan.status = input.status;
  plan.note = input.note?.trim() || plan.note;
  plan.lastError = input.status === "exception" ? input.error?.trim() || input.note?.trim() || plan.lastError || "任务执行异常" : undefined;
  plan.completedAt = input.status === "completed" ? now() : plan.completedAt;
  if (input.status === "processing") plan.attempts = (plan.attempts ?? 0) + 1;
  plan.updatedAt = now();
  await writeData(data);
  return { plan, error: null };
}

export async function retryBatchOperationPlan(input: { id: string; operator: string }) {
  const data = await getOpsExpansionData();
  const plan = data.batchOperationPlans.find((item) => item.id === input.id);
  if (!plan) return { plan: null, error: "未找到批量任务" };
  if (plan.status !== "exception") return { plan, error: "只有异常任务可以重试" };
  if ((plan.attempts ?? 0) >= (plan.maxAttempts ?? 3)) return { plan, error: "任务已达到最大重试次数，请复制为新任务后再执行" };
  plan.status = "queued";
  plan.nextRunAt = new Date(Date.now() + 60_000).toISOString();
  plan.note = [plan.note, `由 ${input.operator} 发起重试`].filter(Boolean).join(" / ");
  plan.lastError = undefined;
  plan.updatedAt = now();
  await writeData(data);
  return { plan, error: null };
}

export async function listRunnableBatchOperationPlans() {
  const data = await getOpsExpansionData();
  const timestamp = Date.now();
  return data.batchOperationPlans.filter((item) => item.status === "queued" && (!item.nextRunAt || new Date(item.nextRunAt).getTime() <= timestamp));
}

export async function upsertWmsPolicy(input: Partial<WmsPolicy> & { name: string; warehouseCode: string }) {
  const data = await getOpsExpansionData();
  const updatedAt = now();
  const existing = data.wmsPolicies.find((item) => item.warehouseCode === input.warehouseCode && item.name === input.name);
  const record: WmsPolicy = {
    id: existing?.id ?? makeId("WMS"),
    warehouseCode: input.warehouseCode.trim().toUpperCase(),
    name: input.name.trim(),
    status: input.status ?? existing?.status ?? "draft",
    zonePath: input.zonePath?.trim() || existing?.zonePath || "仓库 > 库区 > 货架 > 层 > 库位",
    capacityRule: input.capacityRule?.trim() || existing?.capacityRule || "按库位容量校验。",
    stockControls: input.stockControls?.length ? input.stockControls : existing?.stockControls ?? [],
    batchControls: input.batchControls?.length ? input.batchControls : existing?.batchControls ?? [],
    updatedAt,
  };
  if (existing) Object.assign(existing, record);
  else data.wmsPolicies.unshift(record);
  await writeData(data);
  return record;
}

export async function upsertLogisticsChannel(input: Partial<LogisticsChannelConfig> & { carrierName: string; serviceName: string }) {
  const data = await getOpsExpansionData();
  const updatedAt = now();
  const existing = data.logisticsChannels.find((item) => item.carrierName === input.carrierName && item.serviceName === input.serviceName);
  const record: LogisticsChannelConfig = {
    id: existing?.id ?? makeId("LOGI"),
    carrierName: input.carrierName.trim(),
    serviceName: input.serviceName.trim(),
    status: input.status ?? existing?.status ?? "draft",
    apiMode: input.apiMode ?? existing?.apiMode ?? "manual",
    enabledFeatures: input.enabledFeatures?.length ? input.enabledFeatures : existing?.enabledFeatures ?? [],
    surchargeRules: input.surchargeRules?.length ? input.surchargeRules : existing?.surchargeRules ?? [],
    credentialRef: input.credentialRef?.trim() || existing?.credentialRef,
    trackingWebhook: input.trackingWebhook?.trim() || existing?.trackingWebhook,
    updatedAt,
  };
  if (existing) Object.assign(existing, record);
  else data.logisticsChannels.unshift(record);
  await writeData(data);
  return record;
}

export function carrierBillTemplateRows() {
  return [
    ["追踪号", "出库单号", "承运商", "服务名称", "实际运费", "币种", "账单日期", "备注"],
    ["RM123456789GB", "OUT-202605-0001", "Royal Mail", "Tracked 48", "3.95", "GBP", "2026-05-26", "承运商账单行"],
  ];
}

export async function importCarrierBillCsv({ csv, fileName, operator }: { csv: string; fileName?: string; operator: string }) {
  const parsed = parseCsv(csv);
  const data = await getOpsExpansionData();
  const coreData = await getWarehouseCoreData();
  const rows: CarrierBillImportRow[] = [];

  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + 2;
    const trackingNumber = clean(rowValue(row, ["追踪号", "物流单号", "运单号", "trackingNumber", "trackingNo", "trackNo"]));
    const outboundId = clean(rowValue(row, ["出库单号", "出库订单号", "outboundId", "orderId", "id"]));
    const carrierName = clean(rowValue(row, ["承运商", "carrierName", "carrier"]));
    const serviceName = clean(rowValue(row, ["服务名称", "物流服务", "serviceName", "carrierServiceName"]));
    const billedAmount = numberValue(rowValue(row, ["实际运费", "账单金额", "运费", "billedAmount", "amount", "fee"]));
    const currency = clean(rowValue(row, ["币种", "currency"])) || "GBP";
    const billDate = clean(rowValue(row, ["账单日期", "出账日期", "billDate", "date"]));
    const note = clean(rowValue(row, ["备注", "note"]));

    if (!trackingNumber && !outboundId) {
      rows.push({ row: rowNumber, trackingNumber, outboundId, carrierName, serviceName, billedAmount, currency, billDate, status: "skipped", issue: "缺少追踪号或出库单号。" });
      continue;
    }
    if (billedAmount <= 0) {
      rows.push({ row: rowNumber, trackingNumber, outboundId, carrierName, serviceName, billedAmount, currency, billDate, status: "skipped", issue: "实际运费必须大于 0。" });
      continue;
    }

    const matched = coreData.outboundOrders.find((order) => (trackingNumber && order.trackingNumber === trackingNumber) || (outboundId && order.id === outboundId));
    if (!matched) {
      rows.push({ row: rowNumber, trackingNumber, outboundId, carrierName, serviceName, billedAmount, currency, billDate, status: "skipped", issue: "未匹配到出库单，请检查追踪号或出库单号。" });
      continue;
    }

    const expectedAmount = typeof matched.shippingFee === "number" ? matched.shippingFee : undefined;
    const diffAmount = typeof expectedAmount === "number" ? Math.round((billedAmount - expectedAmount) * 100) / 100 : undefined;
    await reconcileCoreOutboundShippingFee({
      id: matched.id,
      actualShippingFee: billedAmount,
      note: [carrierName || matched.carrierName || "承运商账单", serviceName || matched.carrierServiceName || "", billDate ? `账单日期 ${billDate}` : "", note].filter(Boolean).join(" / "),
      operator,
    });
    rows.push({
      row: rowNumber,
      trackingNumber: trackingNumber || matched.trackingNumber || "",
      outboundId: matched.id,
      customerCode: matched.customerCode,
      carrierName: carrierName || matched.carrierName || "",
      serviceName: serviceName || matched.carrierServiceName,
      billedAmount: Math.round(billedAmount * 100) / 100,
      expectedAmount,
      diffAmount,
      currency,
      billDate,
      status: "matched",
    });
  }

  const matchedRows = rows.filter((row) => row.status === "matched").length;
  const skippedRows = rows.length - matchedRows;
  const diffRows = rows.filter((row) => typeof row.diffAmount === "number" && Math.abs(row.diffAmount) >= 1).length;
  const totalBilledAmount = Math.round(rows.filter((row) => row.status === "matched").reduce((sum, row) => sum + row.billedAmount, 0) * 100) / 100;
  const totalDiffAmount = Math.round(rows.filter((row) => row.status === "matched").reduce((sum, row) => sum + (row.diffAmount ?? 0), 0) * 100) / 100;
  const batch: CarrierBillImportBatch = {
    id: makeId("CBILL"),
    fileName: fileName?.trim() || "承运商账单.csv",
    carrierName: rows.find((row) => row.carrierName)?.carrierName || "多承运商",
    totalRows: rows.length,
    matchedRows,
    skippedRows,
    diffRows,
    totalBilledAmount,
    totalDiffAmount,
    rows,
    createdBy: operator,
    createdAt: now(),
  };

  data.carrierBillImportBatches.unshift(batch);

  for (const row of rows) {
    if (row.status !== "matched" || !row.outboundId || !row.customerCode || typeof row.diffAmount !== "number" || Math.abs(row.diffAmount) < 1) continue;
    const existingOpenWorkOrder = data.selfServiceWorkOrders.find(
      (item) =>
        item.category === "账单争议" &&
        item.referenceNo === row.outboundId &&
        item.status !== "resolved" &&
        item.status !== "cancelled" &&
        item.description.includes("承运商账单差异"),
    );
    if (existingOpenWorkOrder) continue;
    const priority = Math.abs(row.diffAmount) >= 5 ? "urgent" : "normal";
    const approvalRule = approvalRuleForTrigger(data, "carrier_fee_diff", Math.abs(row.diffAmount), 1);
    data.selfServiceWorkOrders.unshift({
      id: makeId("WO"),
      customerCode: row.customerCode,
      category: "账单争议",
      title: "承运商账单差异待复核",
      priority,
      status: "open",
      referenceNo: row.outboundId,
      description: `承运商账单差异：出库单 ${row.outboundId}，追踪号 ${row.trackingNumber || "未记录"}，预估运费 £${(row.expectedAmount ?? 0).toFixed(2)}，实际运费 £${row.billedAmount.toFixed(2)}，差异 £${row.diffAmount.toFixed(2)}。请财务或运营确认是否需要调整客户账单。`,
      internalNote: `由承运商账单批次 ${batch.id} 自动生成。${approvalRuleNote(approvalRule)}`,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  await writeData(data);
  return batch;
}

export function carrierBillDetailRows(batch: CarrierBillImportBatch) {
  return [
    ["批次号", "行号", "核对状态", "追踪号", "出库单号", "客户编号", "承运商", "服务名称", "预估运费", "实际运费", "差异", "币种", "账单日期", "说明"],
    ...batch.rows.map((row) => [
      batch.id,
      row.row,
      row.status === "matched" ? "已匹配" : "未匹配",
      row.trackingNumber,
      row.outboundId ?? "",
      row.customerCode ?? "",
      row.carrierName,
      row.serviceName ?? "",
      row.expectedAmount ?? "",
      row.billedAmount,
      row.diffAmount ?? "",
      row.currency,
      row.billDate ?? "",
      row.issue ?? (typeof row.diffAmount === "number" && Math.abs(row.diffAmount) >= 1 ? "已生成账单争议工单" : ""),
    ]),
  ];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sameMoney(left: number, right: number) {
  return Math.abs(roundMoney(left) - roundMoney(right)) < 0.01;
}

function billingRecordMonthForImport(record: BillingRecord) {
  return (record.dueDate || record.createdAt || now()).slice(0, 7);
}

function normalizePaymentToken(value?: string) {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

function paymentRecordTokens(record: BillingRecord) {
  return [record.id, record.paymentReference, record.statementPaymentReference, record.statementId]
    .map((value) => normalizePaymentToken(value))
    .filter(Boolean);
}

export function paymentReconciliationTemplateRows() {
  return [
    ["银行流水号", "付款参考号", "账单编号", "月结单号", "客户编号", "到账金额", "币种", "到账日期", "付款方", "备注"],
    ["BANK-202606-0001", "PAY-CUST-202606", "BILL-202606-0001", "", "CUST-202605-3054", "128.50", "GBP", "2026-06-20", "客户公司名称", "银行流水导入核销"],
  ];
}

export async function importPaymentReconciliationCsv({ csv, fileName, operator }: { csv: string; fileName?: string; operator: string }) {
  const parsed = parseCsv(csv);
  const data = await getOpsExpansionData();
  const coreData = await getWarehouseCoreData();
  const rows: PaymentReconciliationImportRow[] = [];
  const paidRecordIds = new Set<string>();

  const availableRecords = () =>
    coreData.billingRecords.filter((record) => record.currency === "GBP" && record.status !== "paid" && !paidRecordIds.has(record.id));

  const monthRecords = (customerCode: string, month: string) =>
    availableRecords().filter((record) => record.customerCode === customerCode && billingRecordMonthForImport(record) === month);

  async function markBill(record: BillingRecord, reference: string, row: PaymentReconciliationImportRow) {
    const updated = await updateStaffBillingRecord({
      id: record.id,
      action: "mark_paid",
      reviewer: operator,
      paymentReference: reference,
      reviewNote: `银行流水导入自动核销，批次 ${row.bankReference || row.paymentReference || fileName || "未命名流水"}。`,
    });
    if (!updated) {
      row.status = "skipped";
      row.issue = "账单更新失败，请人工复核。";
      return;
    }
    paidRecordIds.add(record.id);
    record.status = "paid";
    row.status = "matched_bill";
    row.matchedBillingIds = [record.id];
  }

  async function markStatement(records: BillingRecord[], reference: string, row: PaymentReconciliationImportRow) {
    const first = records[0];
    if (!first) {
      row.status = "skipped";
      row.issue = "未找到可核销的月结账单。";
      return;
    }
    const month = billingRecordMonthForImport(first);
    const fullMonthRecords = monthRecords(first.customerCode, month);
    if (fullMonthRecords.some((record) => record.status === "disputed")) {
      row.status = "skipped";
      row.issue = "月结账单包含争议记录，需人工复核后再核销。";
      return;
    }
    const fullAmount = roundMoney(fullMonthRecords.reduce((sum, record) => sum + record.amount, 0));
    if (!sameMoney(fullAmount, row.amount)) {
      row.status = "skipped";
      row.issue = `月结未付金额 £${fullAmount.toFixed(2)} 与流水金额不一致。`;
      return;
    }
    const result = await updateStaffBillingStatement({
      customerCode: first.customerCode,
      month,
      action: "mark_paid",
      reviewer: operator,
      paymentReference: reference,
      reviewNote: `银行流水导入自动核销，流水号 ${row.bankReference || row.paymentReference || "未填写"}。`,
    });
    if (result.error) {
      row.status = "skipped";
      row.issue = result.error;
      return;
    }
    fullMonthRecords.forEach((record) => {
      paidRecordIds.add(record.id);
      record.status = "paid";
    });
    row.status = "matched_statement";
    row.matchedBillingIds = fullMonthRecords.map((record) => record.id);
  }

  async function matchCandidates(candidates: BillingRecord[], reference: string, row: PaymentReconciliationImportRow) {
    const uniqueCandidates = Array.from(new Map(candidates.map((record) => [record.id, record])).values());
    if (uniqueCandidates.some((record) => record.status === "disputed")) {
      row.status = "skipped";
      row.issue = "候选账单存在争议状态，需人工复核。";
      return;
    }

    const exactBills = uniqueCandidates.filter((record) => sameMoney(record.amount, row.amount));
    if (exactBills.length === 1) {
      await markBill(exactBills[0], reference, row);
      return;
    }
    if (exactBills.length > 1) {
      row.status = "skipped";
      row.issue = "匹配到多条同金额账单，需人工选择后核销。";
      return;
    }

    const grouped = new Map<string, BillingRecord[]>();
    for (const record of uniqueCandidates) {
      const key = `${record.customerCode}|${billingRecordMonthForImport(record)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    }
    const statementMatches = Array.from(grouped.values()).filter((records) => {
      const first = records[0];
      if (!first) return false;
      const fullMonthRecords = monthRecords(first.customerCode, billingRecordMonthForImport(first));
      return sameMoney(fullMonthRecords.reduce((sum, record) => sum + record.amount, 0), row.amount);
    });
    if (statementMatches.length === 1) {
      await markStatement(statementMatches[0], reference, row);
      return;
    }
    if (statementMatches.length > 1) {
      row.status = "skipped";
      row.issue = "匹配到多个月结候选，需人工复核。";
      return;
    }

    row.status = "skipped";
    row.issue = "金额与候选账单不一致。";
  }

  for (const [index, sourceRow] of parsed.rows.entries()) {
    const bankReference = clean(rowValue(sourceRow, ["银行流水号", "收款流水号", "bankReference", "transactionId", "bankNo"]));
    const paymentReference = clean(rowValue(sourceRow, ["付款参考号", "付款备注", "paymentReference", "reference", "paymentRef"]));
    const billingId = clean(rowValue(sourceRow, ["账单编号", "账单号", "billingId", "billId"]));
    const statementId = clean(rowValue(sourceRow, ["月结单号", "月结编号", "statementId", "statementNo"]));
    const customerCode = clean(rowValue(sourceRow, ["客户编号", "customerCode", "clientCode"])).toUpperCase();
    const amount = roundMoney(numberValue(rowValue(sourceRow, ["到账金额", "收款金额", "金额", "amount", "paidAmount"])));
    const currency = (clean(rowValue(sourceRow, ["币种", "currency"])) || "GBP").toUpperCase();
    const paidAt = clean(rowValue(sourceRow, ["到账日期", "付款日期", "paidAt", "paymentDate", "date"]));
    const payerName = clean(rowValue(sourceRow, ["付款方", "付款账户", "payerName", "payer"]));
    const reference = paymentReference || bankReference || billingId || statementId;
    const importRow: PaymentReconciliationImportRow = {
      row: index + 2,
      bankReference,
      paymentReference,
      billingId,
      statementId,
      customerCode,
      amount,
      currency,
      paidAt,
      payerName,
      status: "skipped",
      matchedBillingIds: [],
    };

    if (amount <= 0) {
      importRow.issue = "到账金额必须大于 0。";
      rows.push(importRow);
      continue;
    }
    if (currency !== "GBP") {
      importRow.issue = "当前账单币种为 GBP，非 GBP 流水需人工复核。";
      rows.push(importRow);
      continue;
    }

    const records = availableRecords();
    if (billingId) {
      const record = records.find((item) => normalizePaymentToken(item.id) === normalizePaymentToken(billingId));
      if (!record) importRow.issue = "未找到可核销的账单编号。";
      else if (!sameMoney(record.amount, amount)) importRow.issue = `账单金额 £${record.amount.toFixed(2)} 与流水金额不一致。`;
      else if (record.status === "disputed") importRow.issue = "账单处于争议状态，需人工复核。";
      else await markBill(record, reference, importRow);
      rows.push(importRow);
      continue;
    }

    if (statementId) {
      const statementRecords = records.filter((record) => normalizePaymentToken(record.statementId) === normalizePaymentToken(statementId));
      if (statementRecords.length === 0) importRow.issue = "未找到可核销的月结单号。";
      else await markStatement(statementRecords, reference, importRow);
      rows.push(importRow);
      continue;
    }

    const tokens = [bankReference, paymentReference].map((value) => normalizePaymentToken(value)).filter(Boolean);
    if (tokens.length > 0) {
      const tokenCandidates = records.filter((record) => {
        if (customerCode && record.customerCode !== customerCode) return false;
        return paymentRecordTokens(record).some((token) => tokens.includes(token));
      });
      if (tokenCandidates.length > 0) {
        await matchCandidates(tokenCandidates, reference, importRow);
        rows.push(importRow);
        continue;
      }
    }

    if (customerCode) {
      const customerCandidates = records.filter((record) => record.customerCode === customerCode && sameMoney(record.amount, amount));
      if (customerCandidates.length > 0) {
        await matchCandidates(customerCandidates, reference, importRow);
        rows.push(importRow);
        continue;
      }
    }

    importRow.issue = "未匹配到账单号、月结单号、付款参考号或客户同金额账单。";
    rows.push(importRow);
  }

  const matchedRows = rows.filter((row) => row.status !== "skipped").length;
  const skippedRows = rows.length - matchedRows;
  const statementRows = rows.filter((row) => row.status === "matched_statement").length;
  const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
  const matchedAmount = roundMoney(rows.filter((row) => row.status !== "skipped").reduce((sum, row) => sum + row.amount, 0));
  const batch: PaymentReconciliationImportBatch = {
    id: makeId("PAYIMP"),
    fileName: fileName?.trim() || "银行流水导入.csv",
    totalRows: rows.length,
    matchedRows,
    skippedRows,
    statementRows,
    totalAmount,
    matchedAmount,
    rows,
    createdBy: operator,
    createdAt: now(),
  };
  data.paymentReconciliationImportBatches.unshift(batch);
  await writeData(data);
  return batch;
}

export function paymentReconciliationDetailRows(batch: PaymentReconciliationImportBatch) {
  const statusLabels: Record<PaymentReconciliationImportRow["status"], string> = {
    matched_bill: "已核销单笔账单",
    matched_statement: "已核销月结账单",
    skipped: "待人工复核",
  };
  return [
    ["批次号", "行号", "状态", "银行流水号", "付款参考号", "账单编号", "月结单号", "客户编号", "到账金额", "币种", "到账日期", "付款方", "匹配账单", "说明"],
    ...batch.rows.map((row) => [
      batch.id,
      row.row,
      statusLabels[row.status],
      row.bankReference,
      row.paymentReference ?? "",
      row.billingId ?? "",
      row.statementId ?? "",
      row.customerCode ?? "",
      row.amount,
      row.currency,
      row.paidAt ?? "",
      row.payerName ?? "",
      row.matchedBillingIds.join(";"),
      row.issue ?? "",
    ]),
  ];
}

export async function upsertBillingRule(input: Partial<BillingRuleConfig> & { feeName: string; feeType: BillingRuleConfig["feeType"] }) {
  const data = await getOpsExpansionData();
  const updatedAt = now();
  const existing = data.billingRules.find((item) => item.feeName === input.feeName && item.feeType === input.feeType);
  const record: BillingRuleConfig = {
    id: existing?.id ?? makeId("FEE"),
    feeName: input.feeName.trim(),
    status: input.status ?? existing?.status ?? "draft",
    feeType: input.feeType,
    unitLabel: input.unitLabel?.trim() || existing?.unitLabel || "项",
    unitPrice: numberValue(input.unitPrice ?? existing?.unitPrice ?? 0),
    settlementCycle: input.settlementCycle ?? existing?.settlementCycle ?? "monthly",
    customerScope: input.customerScope ?? existing?.customerScope ?? "all",
    updatedAt,
  };
  if (existing) Object.assign(existing, record);
  else data.billingRules.unshift(record);
  await writeData(data);
  return record;
}

export async function createCustomerWorkOrder(input: {
  customerCode: string;
  category: string;
  title: string;
  priority?: CustomerWorkOrder["priority"];
  status?: CustomerWorkOrderStatus;
  referenceNo?: string;
  description: string;
  customerContact?: string;
  internalNote?: string;
  riskTag?: CustomerWorkOrder["riskTag"];
  linkedDownloadHref?: string;
  financeReviewRequired?: boolean;
  initialAuthorRole?: CustomerWorkOrderMessage["authorRole"];
  initialAuthorName?: string;
}) {
  const data = await getOpsExpansionData();
  const timestamp = now();
  const workOrder: CustomerWorkOrder = {
    id: makeId("WO"),
    customerCode: input.customerCode.trim().toUpperCase(),
    category: input.category.trim(),
    title: input.title.trim(),
    priority: input.priority === "urgent" ? "urgent" : "normal",
    status: input.status ?? "open",
    referenceNo: input.referenceNo?.trim() || undefined,
    description: input.description.trim(),
    customerContact: input.customerContact?.trim() || undefined,
    internalNote: input.internalNote?.trim() || undefined,
    riskTag: input.riskTag,
    linkedDownloadHref: input.linkedDownloadHref?.trim() || undefined,
    financeReviewRequired: input.financeReviewRequired || undefined,
    messages: [
      {
        id: makeId("MSG"),
        authorRole: input.initialAuthorRole ?? "customer",
        authorName: input.initialAuthorName?.trim() || (input.initialAuthorRole === "system" ? "系统" : "客户"),
        body: input.description.trim(),
        visibleToCustomer: true,
        createdAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.selfServiceWorkOrders.unshift(workOrder);
  await writeData(data);
  return workOrder;
}

export async function getCustomerWorkOrders(customerCode: string) {
  const data = await getOpsExpansionData();
  const normalized = customerCode.trim().toUpperCase();
  return data.selfServiceWorkOrders.filter((item) => item.customerCode === normalized);
}

export async function updateCustomerWorkOrder(input: { id: string; status: CustomerWorkOrderStatus; internalNote?: string }) {
  const data = await getOpsExpansionData();
  const workOrder = data.selfServiceWorkOrders.find((item) => item.id === input.id);
  if (!workOrder) return { workOrder: null, error: "未找到工单" };
  workOrder.status = input.status;
  workOrder.internalNote = input.internalNote?.trim() || workOrder.internalNote;
  workOrder.updatedAt = now();
  await writeData(data);
  return { workOrder, error: null };
}

export async function addCustomerWorkOrderMessage(input: {
  id: string;
  customerCode?: string;
  authorRole: CustomerWorkOrderMessage["authorRole"];
  authorName: string;
  body: string;
  visibleToCustomer?: boolean;
  nextStatus?: CustomerWorkOrderStatus;
}) {
  const data = await getOpsExpansionData();
  const workOrder = data.selfServiceWorkOrders.find((item) => item.id === input.id);
  if (!workOrder) return { workOrder: null, error: "未找到工单" };
  const normalizedCustomer = input.customerCode?.trim().toUpperCase();
  if (normalizedCustomer && workOrder.customerCode !== normalizedCustomer) return { workOrder: null, error: "当前账号无权回复该工单" };
  const body = input.body.trim();
  if (!body) return { workOrder: null, error: "请填写回复内容" };

  const timestamp = now();
  const message: CustomerWorkOrderMessage = {
    id: makeId("MSG"),
    authorRole: input.authorRole,
    authorName: input.authorName.trim() || (input.authorRole === "customer" ? "客户" : "运营"),
    body,
    visibleToCustomer: input.visibleToCustomer ?? true,
    createdAt: timestamp,
  };
  workOrder.messages = [...(workOrder.messages ?? []), message];
  workOrder.updatedAt = timestamp;
  if (input.nextStatus) workOrder.status = input.nextStatus;
  else if (input.authorRole === "customer" && workOrder.status === "waiting_customer") workOrder.status = "processing";
  await writeData(data);
  return { workOrder, error: null };
}

export async function updateSelfServiceConfig(input: Partial<CustomerSelfServiceConfig>) {
  const data = await getOpsExpansionData();
  data.selfService = {
    ...data.selfService,
    ...input,
    updatedAt: now(),
  };
  await writeData(data);
  return data.selfService;
}

export async function saveReportView(input: Omit<SavedReportView, "id" | "updatedAt">) {
  const data = await getOpsExpansionData();
  const updatedAt = now();
  const existing = data.savedViews.find((item) => item.name === input.name && item.module === input.module && item.ownerRole === input.ownerRole);
  const view: SavedReportView = { ...input, id: existing?.id ?? makeId("VIEW"), updatedAt };
  if (existing) Object.assign(existing, view);
  else data.savedViews.unshift(view);
  await writeData(data);
  return view;
}

export async function upsertReportSchedule(input: Omit<ReportScheduleConfig, "id" | "updatedAt"> & { id?: string }) {
  const data = await getOpsExpansionData();
  const view = data.savedViews.find((item) => item.id === input.viewId);
  if (!view) return { schedule: null, error: "未找到保存视图，不能创建定时报表" };
  const timestamp = now();
  const existing = input.id ? data.reportSchedules.find((item) => item.id === input.id) : undefined;
  const schedule: ReportScheduleConfig = {
    id: existing?.id ?? makeId("RSCH"),
    viewId: input.viewId,
    name: input.name.trim() || `${view.name} 定时发送`,
    cadence: input.cadence,
    recipients: input.recipients.map((item) => item.trim()).filter(Boolean),
    status: input.status,
    lastSentAt: existing?.lastSentAt,
    lastRunAt: existing?.lastRunAt,
    lastDeliveryStatus: existing?.lastDeliveryStatus,
    lastDeliveryNote: existing?.lastDeliveryNote,
    updatedAt: timestamp,
  };
  if (existing) Object.assign(existing, schedule);
  else data.reportSchedules.unshift(schedule);
  await writeData(data);
  return { schedule, error: null };
}

export async function updateReportScheduleDelivery(input: {
  id: string;
  lastSentAt?: string;
  lastRunAt: string;
  lastDeliveryStatus: NonNullable<ReportScheduleConfig["lastDeliveryStatus"]>;
  lastDeliveryNote?: string;
}) {
  const data = await getOpsExpansionData();
  const schedule = data.reportSchedules.find((item) => item.id === input.id);
  if (!schedule) return { schedule: null, error: "未找到定时报表配置" };
  schedule.lastRunAt = input.lastRunAt;
  schedule.lastSentAt = input.lastSentAt ?? schedule.lastSentAt;
  schedule.lastDeliveryStatus = input.lastDeliveryStatus;
  schedule.lastDeliveryNote = input.lastDeliveryNote?.trim() || undefined;
  schedule.updatedAt = input.lastRunAt;
  await writeData(data);
  return { schedule, error: null };
}

export async function upsertRolePermissions(input: Omit<RolePermissionConfig, "updatedAt">) {
  const data = await getOpsExpansionData();
  const updatedAt = now();
  const existing = data.rolePermissions.find((item) => item.role === input.role);
  const record: RolePermissionConfig = { ...input, updatedAt };
  if (existing) Object.assign(existing, record);
  else data.rolePermissions.unshift(record);
  await writeData(data);
  return record;
}

export async function upsertApprovalRule(input: Omit<ApprovalRuleConfig, "id" | "updatedAt">) {
  const data = await getOpsExpansionData();
  const updatedAt = now();
  const name = input.name.trim();
  const existing = data.approvalRules.find((item) => item.trigger === input.trigger && item.name === name);
  const record: ApprovalRuleConfig = {
    id: existing?.id ?? makeId("APR"),
    name,
    status: input.status ?? existing?.status ?? "draft",
    trigger: input.trigger,
    minAmount: typeof input.minAmount === "number" && input.minAmount > 0 ? Math.round(input.minAmount * 100) / 100 : undefined,
    minQuantity: typeof input.minQuantity === "number" && input.minQuantity > 0 ? Math.floor(input.minQuantity) : undefined,
    approverRoles: input.approverRoles.length > 0 ? input.approverRoles : existing?.approverRoles ?? ["admin"],
    slaHours: input.slaHours > 0 ? Math.floor(input.slaHours) : existing?.slaHours ?? 24,
    escalationRole: input.escalationRole || existing?.escalationRole,
    requireReason: input.requireReason,
    requireAttachment: input.requireAttachment,
    updatedAt,
  };
  if (existing) Object.assign(existing, record);
  else data.approvalRules.unshift(record);
  await writeData(data);
  return record;
}

export function orderImportTemplateRows() {
  return [
    ["销售平台", "平台订单号", "客户编号", "SKU 编码", "数量", "物流渠道", "收件人", "收件地址", "要求发货日期", "备注"],
    ["Amazon", "平台订单-001", "CUST-202605-0001", "SKU-001", "1", "Royal Mail 48", "张三", "英国伦敦示例街10号", "2026-05-26", "请按默认包材发货"],
  ];
}

export function orderImportMappingGuideRows() {
  return [
    ["系统字段", "中文表头", "常见平台字段", "是否必填", "说明"],
    ["customerCode", "客户编号", "customer / customerCode / customer_code", "必填", "必须匹配系统内已存在客户编号。"],
    ["orderNo", "平台订单号", "orderNo / orderNumber / order_id", "必填", "同一客户下订单号不可重复导入。"],
    ["skuCode", "SKU 编码", "sku / skuCode / seller_sku", "必填", "必须匹配客户自己的 SKU 档案。"],
    ["quantity", "数量", "qty / quantity", "必填", "必须大于 0，系统会校验可用库存。"],
    ["channel", "物流渠道", "shippingMethod / channel", "选填", "为空时按来源平台进入默认渠道复核。"],
    ["recipientName", "收件人", "recipient / buyer_name", "建议填写", "为空会进入运营复核提醒。"],
    ["deliveryAddress", "收件地址", "address / deliveryAddress", "建议填写", "为空会进入运营复核提醒。"],
    ["requestedShipDate", "要求发货日期", "shipDate / requestedShipDate", "选填", "为空默认进入待审核队列。"],
    ["note", "备注", "note / remark", "选填", "导入后保留在出库申请备注里。"],
  ];
}

function csvValue(value: unknown) {
  if (Array.isArray(value)) return value.join(" | ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

export function approvalRuleForTrigger(data: Pick<OpsExpansionData, "approvalRules">, trigger: ApprovalRuleTrigger, amount = 0, quantity = 0) {
  return data.approvalRules
    .filter((item) => item.status === "active" && item.trigger === trigger)
    .filter((item) => item.minAmount === undefined || amount >= item.minAmount)
    .filter((item) => item.minQuantity === undefined || quantity >= item.minQuantity)
    .sort((left, right) => (right.minAmount ?? 0) + (right.minQuantity ?? 0) - ((left.minAmount ?? 0) + (left.minQuantity ?? 0)))[0];
}

export function approvalRuleNote(rule: ApprovalRuleConfig | undefined) {
  if (!rule) return "未匹配审批规则，请按默认财务复核口径处理。";
  return [
    `审批规则：${rule.name}`,
    `审批角色：${rule.approverRoles.join("、") || "未配置"}`,
    `SLA：${rule.slaHours} 小时`,
    rule.escalationRole ? `超时升级：${rule.escalationRole}` : "",
    rule.requireReason ? "必须填写审批原因" : "",
    rule.requireAttachment ? "必须上传附件" : "",
  ]
    .filter(Boolean)
    .join("；");
}

const exportLabelMap: Record<string, string> = {
  draft: "草稿",
  connected: "已连接",
  paused: "暂停",
  error: "异常",
  sandbox: "沙箱",
  active: "启用",
  manual: "手工",
  live: "正式",
  api_sandbox: "API 沙箱",
  api_live: "API 正式",
  manual_csv: "手工 CSV",
  queued: "已排队",
  processing: "处理中",
  completed: "已完成",
  exception: "异常",
  sku_import: "SKU 批量导入",
  inbound_import: "入库批量导入",
  location_move: "批量改库位",
  picking_wave: "生成拣货波次",
  weighing: "批量称重",
  tracking_upload: "批量上传追踪号",
  export: "批量导出",
  inbound: "入库",
  inventory: "库存",
  outbound: "出库",
  logistics: "物流",
  billing: "账单",
  charge_events: "费用事件台账",
  automation_runs: "自动化运行记录",
  payment_reconciliation: "收款核销台账",
  finance_adjustments: "财务调账/赔付审批",
  storage: "仓租",
  operation: "操作费",
  labeling: "贴标费",
  return: "退货费",
  oversize: "超尺寸费",
  remote_area: "偏远费",
  fuel: "燃油费",
  weekly: "周结",
  monthly: "月结",
  realtime: "实时",
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
  open: "待处理",
  waiting_customer: "待客户补充",
  resolved: "已解决",
  cancelled: "已取消",
  orders: "订单",
  warehouse: "仓库效率",
  profit: "利润/成本",
  sla: "SLA",
  returns: "退货/RMA",
  exceptions: "异常中心",
  scans: "扫码留痕",
  locations: "库位利用率",
  data_quality: "数据质量巡检",
  staff_performance: "员工绩效",
  outbound_review: "出库复核差异",
  customer_credit: "客户信用风险",
  carrier_labels: "承运商面单生命周期",
  carrier_claims: "承运商赔付台账",
  platform_sync: "平台同步任务",
  customer_self_service: "客户自助待办",
  documents_security: "文件安全台账",
  permissions: "权限",
  admin: "管理员",
  ops: "运营",
  finance: "财务",
  inventory_adjustment: "库存调整",
  stocktake_difference: "盘点差异",
  transfer_order: "分仓调拨",
  billing_lock: "账单锁定",
  carrier_fee_diff: "运费差异",
  customer_status: "客户状态",
  manual_inbound_outbound: "手工出入库",
  manual_fee_adjustment: "手工费用调整",
  claim_approval: "异常赔付审批",
};

function exportLabel(value?: string) {
  return value ? exportLabelMap[value] ?? value : "";
}

function exportLabelList(values: string[]) {
  return csvValue(values.map((value) => exportLabel(value)));
}

export async function exportOpsExpansionRows(kind: OpsExpansionExportKind) {
  const data = await getOpsExpansionData();
  if (kind === "order-imports") {
    return [
      ["批次号", "批次状态", "来源", "文件名", "总行数", "可导入行", "可创建订单", "已创建订单", "跳过行数", "问题数", "创建人", "创建时间", "确认导入时间", "取消时间", "取消人", "取消原因"],
      ...data.orderImportBatches.map((item) => [
        item.id,
        item.status === "cancelled" ? "已取消" : item.status === "draft" ? "预检草稿" : "已创建出库单",
        item.source,
        item.fileName,
        item.totalRows,
        item.readyRows ?? "",
        item.readyOrders ?? "",
        item.createdOrders,
        item.skippedRows,
        item.issues.length,
        item.createdBy,
        item.createdAt,
        item.confirmedAt ?? "",
        item.cancelledAt ?? "",
        item.cancelledBy ?? "",
        item.cancelReason ?? "",
      ]),
    ];
  }
  if (kind === "platforms") {
    return [
      ["记录号", "平台", "店铺名称", "客户编号", "状态", "同步模式", "字段映射", "最后同步时间", "更新时间", "备注"],
      ...data.platformConnections.map((item) => [item.id, item.platform, item.storeName, item.customerCode, exportLabel(item.status), exportLabel(item.syncMode), csvValue(item.fieldMapping), item.lastSyncAt, item.updatedAt, item.note]),
    ];
  }
  if (kind === "platform-sync-jobs") {
    return [
      ["同步任务号", "平台连接号", "平台", "店铺名称", "客户编号", "同步模式", "状态", "拉取行数", "可创建订单", "跳过行数", "问题数", "导入批次号", "失败原因", "执行人", "创建时间"],
      ...data.platformSyncJobs.map((item) => [item.id, item.platformConnectionId, item.platform, item.storeName, item.customerCode, exportLabel(item.syncMode), item.status === "completed" ? "已完成" : "失败", item.pulledRows, item.readyOrders, item.skippedRows, item.issueCount, item.orderImportBatchId ?? "", item.error ?? "", item.createdBy, item.createdAt]),
    ];
  }
  if (kind === "batch-plans") {
    return [
      ["计划号", "作业类型", "标题", "目标模块", "状态", "记录数", "模板名称", "创建人", "创建时间", "更新时间", "备注"],
      ...data.batchOperationPlans.map((item) => [item.id, exportLabel(item.kind), item.title, exportLabel(item.targetModule), exportLabel(item.status), item.recordCount, item.templateName, item.createdBy, item.createdAt, item.updatedAt, item.note]),
    ];
  }
  if (kind === "wms-policies") {
    return [
      ["规则号", "仓库编号", "规则名称", "状态", "库区路径", "容量规则", "库存控制", "批次控制", "更新时间"],
      ...data.wmsPolicies.map((item) => [item.id, item.warehouseCode, item.name, exportLabel(item.status), item.zonePath, item.capacityRule, csvValue(item.stockControls), csvValue(item.batchControls), item.updatedAt]),
    ];
  }
  if (kind === "logistics-channels") {
    return [
      ["渠道号", "承运商", "服务名称", "状态", "接口模式", "凭证引用", "启用能力", "附加费规则", "轨迹回传地址", "更新时间"],
      ...data.logisticsChannels.map((item) => [item.id, item.carrierName, item.serviceName, exportLabel(item.status), exportLabel(item.apiMode), item.credentialRef ?? "", csvValue(item.enabledFeatures), csvValue(item.surchargeRules), item.trackingWebhook, item.updatedAt]),
    ];
  }
  if (kind === "carrier-bills") {
    return [
      ["批次号", "文件名", "承运商", "总行数", "匹配行数", "跳过行数", "差异行数", "账单总额", "差异总额", "创建人", "创建时间"],
      ...data.carrierBillImportBatches.map((item) => [item.id, item.fileName, item.carrierName, item.totalRows, item.matchedRows, item.skippedRows, item.diffRows, item.totalBilledAmount, item.totalDiffAmount, item.createdBy, item.createdAt]),
    ];
  }
  if (kind === "payment-imports") {
    return [
      ["批次号", "文件名", "总行数", "自动核销行数", "跳过行数", "月结核销行数", "流水总额", "已核销金额", "创建人", "创建时间"],
      ...data.paymentReconciliationImportBatches.map((item) => [item.id, item.fileName, item.totalRows, item.matchedRows, item.skippedRows, item.statementRows, item.totalAmount, item.matchedAmount, item.createdBy, item.createdAt]),
    ];
  }
  if (kind === "billing-rules") {
    return [
      ["规则号", "费用名称", "费用类型", "状态", "计费单位", "单价", "结算周期", "客户范围", "更新时间"],
      ...data.billingRules.map((item) => [item.id, item.feeName, exportLabel(item.feeType), exportLabel(item.status), item.unitLabel, item.unitPrice, exportLabel(item.settlementCycle), item.customerScope, item.updatedAt]),
    ];
  }
  if (kind === "work-orders") {
    return [
      ["工单号", "客户编号", "工单类型", "标题", "优先级", "状态", "关联单号", "客户联系方式", "创建时间", "更新时间", "客户可见消息数", "最后客户可见消息", "问题说明", "内部备注"],
      ...data.selfServiceWorkOrders.map((item) => {
        const visibleMessages = (item.messages ?? []).filter((message) => message.visibleToCustomer);
        const latest = visibleMessages[visibleMessages.length - 1];
        return [item.id, item.customerCode, item.category, item.title, exportLabel(item.priority), exportLabel(item.status), item.referenceNo, item.customerContact, item.createdAt, item.updatedAt, visibleMessages.length, latest ? `${latest.authorName}：${latest.body}` : "", item.description, item.internalNote];
      }),
    ];
  }
  if (kind === "report-views") {
    return [
      ["视图号", "视图名称", "模块", "筛选条件", "指标", "所属角色", "更新时间"],
      ...data.savedViews.map((item) => [item.id, item.name, exportLabel(item.module), csvValue(item.filters), csvValue(item.metrics), exportLabel(item.ownerRole), item.updatedAt]),
    ];
  }
  if (kind === "approval-rules") {
    return [
      ["规则号", "规则名称", "状态", "触发场景", "金额阈值", "数量阈值", "审批角色", "SLA 小时", "升级角色", "是否要求原因", "是否要求附件", "更新时间"],
      ...data.approvalRules.map((item) => [
        item.id,
        item.name,
        exportLabel(item.status),
        exportLabel(item.trigger),
        item.minAmount ?? "",
        item.minQuantity ?? "",
        exportLabelList(item.approverRoles),
        item.slaHours,
        exportLabel(item.escalationRole),
        item.requireReason ? "是" : "否",
        item.requireAttachment ? "是" : "否",
        item.updatedAt,
      ]),
    ];
  }
  return [
    ["角色", "可访问模块", "敏感操作", "是否需要二次确认", "更新时间"],
    ...data.rolePermissions.map((item) => [exportLabel(item.role), exportLabelList(item.allowedModules), csvValue(item.sensitiveActions), item.requireSecondConfirm ? "是" : "否", item.updatedAt]),
  ];
}
