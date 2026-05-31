import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";
import { createCustomerOutboundOrder, getWarehouseCoreData, reconcileCoreOutboundShippingFee } from "./warehouseCoreStore";

export type PlatformKind = "amazon" | "tiktok_shop" | "shopify" | "ebay" | "csv";
export type PlatformConnectionStatus = "draft" | "connected" | "paused" | "error";
export type BatchOperationKind = "sku_import" | "inbound_import" | "location_move" | "picking_wave" | "weighing" | "tracking_upload" | "export";
export type BatchOperationStatus = "draft" | "queued" | "processing" | "completed" | "exception";
export type WmsPolicyStatus = "draft" | "active" | "paused";
export type IntegrationStatus = "draft" | "sandbox" | "active" | "paused";
export type OpsExpansionExportKind = "order-imports" | "platforms" | "batch-plans" | "wms-policies" | "logistics-channels" | "carrier-bills" | "billing-rules" | "work-orders" | "report-views" | "permissions";

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
  status?: "draft" | "created";
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
  module: "orders" | "warehouse" | "logistics" | "billing" | "profit" | "sla";
  filters: Record<string, string>;
  metrics: string[];
  ownerRole: string;
  updatedAt: string;
};

export type RolePermissionConfig = {
  role: "admin" | "ops" | "warehouse" | "finance";
  allowedModules: string[];
  sensitiveActions: string[];
  requireSecondConfirm: boolean;
  updatedAt: string;
};

export type OpsExpansionData = {
  platformConnections: PlatformConnection[];
  orderImportBatches: OrderImportBatch[];
  batchOperationPlans: BatchOperationPlan[];
  wmsPolicies: WmsPolicy[];
  logisticsChannels: LogisticsChannelConfig[];
  carrierBillImportBatches: CarrierBillImportBatch[];
  billingRules: BillingRuleConfig[];
  selfServiceWorkOrders: CustomerWorkOrder[];
  selfService: CustomerSelfServiceConfig;
  savedViews: SavedReportView[];
  rolePermissions: RolePermissionConfig[];
};

const storePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "ops-expansion.json") : path.join(process.cwd(), ".local-data", "ops-expansion.json");
const postgresStoreKey = "ops-expansion-v1";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${yyyymm}-${Math.floor(1000 + Math.random() * 9000)}`;
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
    orderImportBatches: [],
    batchOperationPlans: [],
    wmsPolicies: [],
    logisticsChannels: [],
    carrierBillImportBatches: [],
    billingRules: [],
    selfServiceWorkOrders: [],
    selfService: {
      templates: [
        { id: "TPL-OUTBOUND", name: "\u51fa\u5e93\u8ba2\u5355\u5bfc\u5165\u6a21\u677f", href: "/api/outbounds?format=template", description: "\u6279\u91cf\u4e0a\u4f20\u5e73\u53f0\u8ba2\u5355\u3001\u6536\u4ef6\u4eba\u3001\u5730\u5740\u548c SKU \u660e\u7ec6\u3002" },
        { id: "TPL-SKU", name: "SKU \u6279\u91cf\u5bfc\u5165\u6a21\u677f", href: "/api/skus?format=template", description: "\u6279\u91cf\u7ef4\u62a4\u5546\u54c1\u7f16\u7801\u3001\u6761\u7801\u3001\u5206\u7c7b\u548c\u5e93\u5b58\u9884\u8b66\u3002" },
      ],
      enabledDownloads: ["\u5e93\u5b58\u62a5\u8868", "\u51fa\u5e93\u660e\u7ec6", "\u7269\u6d41\u5f02\u5e38\u4e0e\u8d54\u4ed8", "\u8d39\u7528\u660e\u7ec6", "\u9762\u5355", "\u7b7e\u6536\u8bc1\u660e"],
      workOrderCategories: ["\u7269\u6d41\u5f02\u5e38", "\u5e93\u5b58\u8c03\u6574", "\u8d26\u5355\u4e89\u8bae", "\u9000\u8d27\u552e\u540e", "\u8d44\u6599\u8865\u5145"],
      messageCenterEnabled: true,
      updatedAt,
    },
    savedViews: [],
    rolePermissions: [],
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
  const workOrderCategories = Array.isArray(value?.workOrderCategories) && value.workOrderCategories.some((item) => item && !item.includes("?")) ? value.workOrderCategories : seed.workOrderCategories;
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
    orderImportBatches: Array.isArray(parsed?.orderImportBatches) ? parsed.orderImportBatches : seed.orderImportBatches,
    batchOperationPlans: Array.isArray(parsed?.batchOperationPlans) ? parsed.batchOperationPlans : seed.batchOperationPlans,
    wmsPolicies: Array.isArray(parsed?.wmsPolicies) ? parsed.wmsPolicies : seed.wmsPolicies,
    logisticsChannels: Array.isArray(parsed?.logisticsChannels) ? parsed.logisticsChannels : seed.logisticsChannels,
    carrierBillImportBatches: Array.isArray(parsed?.carrierBillImportBatches) ? parsed.carrierBillImportBatches : seed.carrierBillImportBatches,
    billingRules: Array.isArray(parsed?.billingRules) ? parsed.billingRules : seed.billingRules,
    selfServiceWorkOrders: Array.isArray(parsed?.selfServiceWorkOrders) ? parsed.selfServiceWorkOrders : seed.selfServiceWorkOrders,
    selfService: normalizeSelfServiceConfig(parsed?.selfService, seed.selfService),
    savedViews: Array.isArray(parsed?.savedViews) ? parsed.savedViews : seed.savedViews,
    rolePermissions: Array.isArray(parsed?.rolePermissions) ? parsed.rolePermissions : seed.rolePermissions,
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

function mappedValue(row: Record<string, string>, mapping: Record<string, string> | undefined, canonical: string, aliases: string[]) {
  const chineseAliases: Record<string, string[]> = {
    customerCode: ["客户编号", "客户编码"],
    orderNo: ["订单号", "平台订单号"],
    skuCode: ["SKU", "SKU 编码", "商品编码"],
    quantity: ["数量", "件数"],
    channel: ["物流渠道", "渠道"],
    recipientName: ["收件人", "收货人"],
    deliveryAddress: ["收件地址", "收货地址", "地址"],
    requestedShipDate: ["发货日期", "要求发货日期", "发货时间"],
    note: ["备注"],
  };
  const mappedHeader = mapping?.[canonical];
  const reverseMapped = Object.entries(mapping ?? {}).find(([, value]) => value === canonical)?.[0];
  const candidates = [mappedHeader, reverseMapped, canonical, ...(chineseAliases[canonical] ?? []), ...aliases].filter(Boolean) as string[];
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
  const { rows } = parseCsv(csv);
  const issues: ImportedOrderIssue[] = [];
  const importedRows: ImportedOrderRow[] = [];
  const grouped = new Map<string, PreparedOrderGroup>();
  if (rows.length === 0) issues.push({ row: 1, level: "error", message: "CSV 没有可导入的订单明细，请先填写订单数据。" });

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
    createdBy: input.createdBy,
    createdAt,
    updatedAt: createdAt,
  };
  data.batchOperationPlans.unshift(plan);
  await writeData(data);
  return plan;
}

export async function updateBatchOperationStatus(input: { id: string; status: BatchOperationStatus; note?: string }) {
  const data = await getOpsExpansionData();
  const plan = data.batchOperationPlans.find((item) => item.id === input.id);
  if (!plan) return { plan: null, error: "未找到批量作业计划" };
  plan.status = input.status;
  plan.note = input.note?.trim() || plan.note;
  plan.updatedAt = now();
  await writeData(data);
  return { plan, error: null };
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
  await writeData(data);
  return batch;
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
  referenceNo?: string;
  description: string;
  customerContact?: string;
}) {
  const data = await getOpsExpansionData();
  const timestamp = now();
  const workOrder: CustomerWorkOrder = {
    id: makeId("WO"),
    customerCode: input.customerCode.trim().toUpperCase(),
    category: input.category.trim(),
    title: input.title.trim(),
    priority: input.priority === "urgent" ? "urgent" : "normal",
    status: "open",
    referenceNo: input.referenceNo?.trim() || undefined,
    description: input.description.trim(),
    customerContact: input.customerContact?.trim() || undefined,
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
  const view: SavedReportView = { ...input, id: makeId("VIEW"), updatedAt: now() };
  data.savedViews.unshift(view);
  await writeData(data);
  return view;
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

export function orderImportTemplateRows() {
  return [
    ["销售平台", "平台订单号", "客户编号", "SKU 编码", "数量", "物流渠道", "收件人", "收件地址", "要求发货日期", "备注"],
    ["Amazon", "ORDER-001", "CUST-202605-0001", "SKU-001", "1", "Royal Mail 48", "张三", "10 Example Street, London, UK", "2026-05-26", "请按默认包材发货"],
  ];
}

function csvValue(value: unknown) {
  if (Array.isArray(value)) return value.join(" | ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

export async function exportOpsExpansionRows(kind: OpsExpansionExportKind) {
  const data = await getOpsExpansionData();
  if (kind === "order-imports") {
    return [
      ["批次号", "批次状态", "来源", "文件名", "总行数", "可导入行", "可创建订单", "已创建订单", "跳过行数", "问题数", "创建人", "创建时间", "确认导入时间"],
      ...data.orderImportBatches.map((item) => [item.id, item.status === "draft" ? "预检草稿" : "已创建出库单", item.source, item.fileName, item.totalRows, item.readyRows ?? "", item.readyOrders ?? "", item.createdOrders, item.skippedRows, item.issues.length, item.createdBy, item.createdAt, item.confirmedAt ?? ""]),
    ];
  }
  if (kind === "platforms") {
    return [
      ["记录号", "平台", "店铺名称", "客户编号", "状态", "同步模式", "字段映射", "最后同步时间", "更新时间", "备注"],
      ...data.platformConnections.map((item) => [item.id, item.platform, item.storeName, item.customerCode, item.status, item.syncMode, csvValue(item.fieldMapping), item.lastSyncAt, item.updatedAt, item.note]),
    ];
  }
  if (kind === "batch-plans") {
    return [
      ["计划号", "作业类型", "标题", "目标模块", "状态", "记录数", "模板名称", "创建人", "创建时间", "更新时间", "备注"],
      ...data.batchOperationPlans.map((item) => [item.id, item.kind, item.title, item.targetModule, item.status, item.recordCount, item.templateName, item.createdBy, item.createdAt, item.updatedAt, item.note]),
    ];
  }
  if (kind === "wms-policies") {
    return [
      ["规则号", "仓库编号", "规则名称", "状态", "库区路径", "容量规则", "库存控制", "批次控制", "更新时间"],
      ...data.wmsPolicies.map((item) => [item.id, item.warehouseCode, item.name, item.status, item.zonePath, item.capacityRule, csvValue(item.stockControls), csvValue(item.batchControls), item.updatedAt]),
    ];
  }
  if (kind === "logistics-channels") {
    return [
      ["渠道号", "承运商", "服务名称", "状态", "接口模式", "启用能力", "附加费规则", "轨迹回传地址", "更新时间"],
      ...data.logisticsChannels.map((item) => [item.id, item.carrierName, item.serviceName, item.status, item.apiMode, csvValue(item.enabledFeatures), csvValue(item.surchargeRules), item.trackingWebhook, item.updatedAt]),
    ];
  }
  if (kind === "carrier-bills") {
    return [
      ["批次号", "文件名", "承运商", "总行数", "匹配行数", "跳过行数", "差异行数", "账单总额", "差异总额", "创建人", "创建时间"],
      ...data.carrierBillImportBatches.map((item) => [item.id, item.fileName, item.carrierName, item.totalRows, item.matchedRows, item.skippedRows, item.diffRows, item.totalBilledAmount, item.totalDiffAmount, item.createdBy, item.createdAt]),
    ];
  }
  if (kind === "billing-rules") {
    return [
      ["规则号", "费用名称", "费用类型", "状态", "计费单位", "单价", "结算周期", "客户范围", "更新时间"],
      ...data.billingRules.map((item) => [item.id, item.feeName, item.feeType, item.status, item.unitLabel, item.unitPrice, item.settlementCycle, item.customerScope, item.updatedAt]),
    ];
  }
  if (kind === "work-orders") {
    return [
      ["工单号", "客户编号", "工单类型", "标题", "优先级", "状态", "关联单号", "客户联系方式", "创建时间", "更新时间", "问题说明", "内部备注"],
      ...data.selfServiceWorkOrders.map((item) => [item.id, item.customerCode, item.category, item.title, item.priority, item.status, item.referenceNo, item.customerContact, item.createdAt, item.updatedAt, item.description, item.internalNote]),
    ];
  }
  if (kind === "report-views") {
    return [
      ["视图号", "视图名称", "模块", "筛选条件", "指标", "所属角色", "更新时间"],
      ...data.savedViews.map((item) => [item.id, item.name, item.module, csvValue(item.filters), csvValue(item.metrics), item.ownerRole, item.updatedAt]),
    ];
  }
  return [
    ["角色", "可访问模块", "敏感操作", "是否需要二次确认", "更新时间"],
    ...data.rolePermissions.map((item) => [item.role, csvValue(item.allowedModules), csvValue(item.sensitiveActions), item.requireSecondConfirm ? "是" : "否", item.updatedAt]),
  ];
}
