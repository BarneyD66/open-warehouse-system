import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cancelCarrierLabel, purchaseCarrierLabel } from "./carrierGateway";
import { getSql, hasPostgresConfig } from "./db";
import { addCustomerWorkOrderMessage, createCustomerWorkOrder } from "./opsExpansionStore";

export type CustomerProfile = {
  customerCode: string;
  companyName: string;
  contactName: string;
  phone: string;
  email?: string;
  vatNumber?: string;
  eoriNumber?: string;
  platforms?: string[];
  storeUrl?: string;
  businessAddress?: string;
  status: "unverified" | "verified" | "paused";
  paymentTermDays?: number;
  creditLimit?: number;
  billingCycle?: "prepaid" | "weekly" | "monthly";
  updatedAt?: string;
};

export type WarehouseSku = {
  skuCode: string;
  customerCode: string;
  productName: string;
  barcode?: string;
  category?: string;
  status: "active" | "paused" | "archived";
};

export type InventoryBalance = {
  id: string;
  customerCode: string;
  skuCode: string;
  warehouseCode: string;
  locationCode?: string;
  availableQty: number;
  reservedQty: number;
  frozenQty: number;
  defectiveQty: number;
  inboundQty: number;
  alertQty: number;
  agingDays: number;
  updatedAt: string;
};

export type InventoryLotStatus = "active" | "reserved" | "blocked" | "expired" | "depleted";
export type InventorySerialStatus = "active" | "reserved" | "consumed" | "blocked";

export type InventorySerialRecord = {
  serialNumber: string;
  status: InventorySerialStatus;
  updatedAt: string;
  updatedBy?: string;
};

export type InventoryLot = {
  id: string;
  customerCode: string;
  skuCode: string;
  warehouseCode: string;
  locationCode?: string;
  lotNo: string;
  expiryDate?: string;
  serialNumbers?: string[];
  serialNumberStatuses?: InventorySerialRecord[];
  quantity: number;
  availableQty: number;
  reservedQty: number;
  status: InventoryLotStatus;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
};

export type WarehouseLocationZoneType = "standard" | "receiving" | "returns" | "defective" | "frozen" | "oversize";

export type WarehouseLocation = {
  locationCode: string;
  warehouseCode: string;
  zone: string;
  zoneType?: WarehouseLocationZoneType;
  status: "active" | "blocked" | "reserved";
  capacityCbm?: number;
  capacityQty?: number;
  allowMixedSku?: boolean;
  note?: string;
  updatedAt: string;
};

export type OutboundLotAllocation = {
  skuCode: string;
  requiredQty: number;
  allocatedQty: number;
  shortageQty: number;
  lots: Array<{
    lotId: string;
    lotNo: string;
    quantity: number;
    availableQty: number;
    locationCode?: string;
    expiryDate?: string;
    status: InventoryLotStatus;
    daysUntilExpiry?: number;
  }>;
};

export type InventoryMovementRefType = "inbound" | "outbound" | "adjustment" | "stocktake" | "replenishment" | "transfer" | "purchase";

export type InventoryMovement = {
  id: string;
  customerCode: string;
  skuCode: string;
  refType: InventoryMovementRefType;
  refId: string;
  movementType: "in" | "out" | "reserve" | "release" | "adjust";
  quantity: number;
  beforeQty?: number;
  afterQty?: number;
  note?: string;
  occurredAt: string;
  operator: string;
};

export type ApprovalTimelineEvent = {
  id: string;
  action: "submitted" | "approved" | "rejected" | "locked" | "unlocked" | "commented";
  label: string;
  actor: string;
  note?: string;
  occurredAt: string;
};

export type InventoryAdjustmentStatus = "pending" | "approved" | "rejected";
export type InventoryControlAction = "manual_adjust" | "freeze" | "release" | "defective" | "restore" | "move_location";

export type InventoryAdjustmentRequest = {
  id: string;
  balanceId?: string;
  customerCode: string;
  skuCode: string;
  warehouseCode: string;
  locationCode?: string;
  status: InventoryAdjustmentStatus;
  availableDelta: number;
  reservedDelta: number;
  frozenDelta?: number;
  defectiveDelta?: number;
  alertQty?: number;
  agingDays?: number;
  controlAction?: InventoryControlAction;
  quantity?: number;
  beforeLocationCode?: string;
  nextLocationCode?: string;
  beforeAvailableQty: number;
  beforeReservedQty: number;
  beforeFrozenQty?: number;
  beforeDefectiveQty?: number;
  reason: string;
  requestedBy: string;
  requestedByRole: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  approvalTimeline?: ApprovalTimelineEvent[];
};

export type ReplenishmentSuggestionStatus = "healthy" | "watch" | "replenish_now";

export type ReplenishmentSuggestion = {
  id: string;
  balanceId: string;
  customerCode: string;
  skuCode: string;
  warehouseCode: string;
  locationCode?: string;
  availableQty: number;
  reservedQty: number;
  inboundQty: number;
  alertQty: number;
  dailySalesEstimate: number;
  daysOfCover: number;
  recommendedQty: number;
  status: ReplenishmentSuggestionStatus;
  reason: string;
};

export type ReplenishmentPlanStatus = "draft" | "submitted" | "approved" | "in_transit" | "received" | "cancelled";

export type ReplenishmentPlan = {
  id: string;
  customerCode: string;
  skuCode: string;
  targetWarehouseCode: string;
  locationCode?: string;
  plannedQty: number;
  recommendedQty: number;
  status: ReplenishmentPlanStatus;
  sourceBalanceId: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
};

export type TransferOrderStatus = "new" | "approved" | "picking" | "in_transit" | "partially_received" | "received" | "exception" | "cancelled";

export type TransferOrder = {
  id: string;
  customerCode: string;
  skuCode: string;
  fromWarehouseCode: string;
  toWarehouseCode: string;
  quantity: number;
  pickedQty?: number;
  shippedQty?: number;
  receivedQty: number;
  status: TransferOrderStatus;
  progress: number;
  relatedPlanId?: string;
  carrierName?: string;
  trackingNumber?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  pickedBy?: string;
  pickedAt?: string;
  shippedBy?: string;
  shippedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  exceptionNote?: string;
  updatedAt?: string;
  approvalTimeline?: ApprovalTimelineEvent[];
};

export type PurchaseReceiptStatus = "draft" | "in_transit" | "arrived" | "partially_received" | "received" | "putaway_completed" | "exception" | "cancelled";

export type PurchaseReceiptLine = {
  skuCode: string;
  productName?: string;
  expectedQty: number;
  receivedQty: number;
  putawayQty: number;
  defectiveQty?: number;
  locationCode?: string;
  lotNo?: string;
  expiryDate?: string;
  note?: string;
};

export type PurchaseReceiptScanAction = "receive" | "putaway";
export type PurchaseReceiptScanCodeType = "purchase_receipt" | "tracking" | "sku" | "location" | "unknown";

export type PurchaseReceiptScanRecord = {
  id: string;
  action: PurchaseReceiptScanAction;
  code: string;
  codeType: PurchaseReceiptScanCodeType;
  skuCode?: string;
  locationCode?: string;
  quantity?: number;
  operator: string;
  scannedAt: string;
};

export type PurchaseReceiptDiscrepancyType = "shortage" | "overage" | "damaged" | "wrong_sku" | "missing_label" | "other";
export type PurchaseReceiptDiscrepancyStatus = "open" | "customer_pending" | "resolved" | "ignored";

export type PurchaseReceiptDiscrepancyReport = {
  id: string;
  type: PurchaseReceiptDiscrepancyType;
  status: PurchaseReceiptDiscrepancyStatus;
  severity: "warning" | "critical";
  skuCode?: string;
  expectedQty?: number;
  actualQty?: number;
  affectedQty?: number;
  description: string;
  photoUrls?: string[];
  workOrderId?: string;
  createdBy: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
};

export type PurchaseReceiptOrder = {
  id: string;
  customerCode: string;
  supplierName: string;
  warehouseCode: string;
  status: PurchaseReceiptStatus;
  expectedArrivalDate?: string;
  trackingNumber?: string;
  lines: PurchaseReceiptLine[];
  totalExpectedQty: number;
  totalReceivedQty: number;
  totalPutawayQty: number;
  exceptionNote?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  arrivedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  putawayBy?: string;
  putawayAt?: string;
  updatedAt?: string;
  timeline?: ApprovalTimelineEvent[];
  scanLogs?: PurchaseReceiptScanRecord[];
  discrepancyReports?: PurchaseReceiptDiscrepancyReport[];
};

export type StocktakeBatchStatus = "draft" | "counting" | "pending_approval" | "completed" | "cancelled";

export type StocktakeBatchItem = {
  balanceId: string;
  customerCode: string;
  skuCode: string;
  warehouseCode: string;
  locationCode?: string;
  systemAvailableQty: number;
  systemReservedQty: number;
  countedAvailableQty?: number;
  differenceQty?: number;
  note?: string;
  countedBy?: string;
  countedAt?: string;
};

export type StocktakeBatch = {
  id: string;
  warehouseCode: string;
  customerCode?: string;
  status: StocktakeBatchStatus;
  itemCount: number;
  differenceCount: number;
  totalDifferenceQty: number;
  note?: string;
  items: StocktakeBatchItem[];
  adjustmentIds?: string[];
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  completedBy?: string;
  completedAt?: string;
  updatedAt?: string;
};

export type OutboundLabelStatus = "not_requested" | "rated" | "generated" | "failed";

export type OutboundTrackingEvent = {
  id: string;
  status: "label_created" | "warehouse_processing" | "carrier_handover" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
  label: string;
  detail?: string;
  location?: string;
  occurredAt: string;
  operator: string;
};

export type CarrierServiceCode = "royal_mail_24" | "royal_mail_48" | "dpd_next_day" | "evri_standard" | "manual";

export type CarrierRateRule = {
  serviceCode: CarrierServiceCode;
  carrierName: string;
  serviceName: string;
  currency: "GBP";
  baseFee: number;
  perKgFee: number;
  maxWeightKg: number;
  etaDays: string;
  trackingPrefix: string;
  active: boolean;
};

export type CarrierRulePreference = {
  carrierName: string;
  serviceName: string;
  status?: string;
  apiMode?: string;
  enabledFeatures?: string[];
  surchargeRules?: string[];
  credentialRef?: string;
  trackingWebhook?: string;
};

type CarrierRuleEvaluation = {
  surchargeAmount: number;
  notes: string[];
  blocked: boolean;
  blockedReason?: string;
};

export type OutboundWeightImportIssue = {
  row: number;
  level: "warning" | "error";
  message: string;
};

export type OutboundWeightImportRow = {
  row: number;
  outboundId: string;
  packageWeightKg?: number;
  packageCount?: number;
  status: "updated" | "skipped";
  shippingFee?: number;
  carrierName?: string;
  carrierServiceName?: string;
  issue?: string;
};

export type OutboundWeightImportResult = {
  totalRows: number;
  updatedRows: number;
  skippedRows: number;
  issues: OutboundWeightImportIssue[];
  rows: OutboundWeightImportRow[];
};

export type OutboundWorkMode = "single_item_batch" | "cart_sort" | "order_pick";
export type OutboundDocumentType = "pick_list" | "shipping_label" | "carrier_label" | "invoice";
export type OutboundInterceptStatus = "none" | "requested" | "restock_pending" | "completed";
export type OutboundScanAction = "pick" | "sort" | "pack" | "ship" | "intercept";
export type OutboundScanCodeType = "outbound_order" | "pick_wave" | "pick_list" | "tracking" | "basket" | "sku" | "location" | "unknown";
export type OutboundExceptionStatus = "open" | "investigating" | "resolved" | "ignored";
export type OutboundDeliveryExceptionType = "delivery_failed" | "address_issue" | "customer_absent" | "damaged" | "lost" | "return_to_sender" | "claim" | "proof_uploaded" | "manual";
export type OutboundClaimStatus = "not_required" | "draft" | "submitted" | "approved" | "rejected" | "paid";
export type OutboundExceptionType = "wrong_sku" | "duplicate_scan" | "over_scan" | "missing_task" | "intercept_blocked" | OutboundDeliveryExceptionType;
export type OutboundCustomerExceptionDecision = "accepted" | "redelivery_confirmed" | "claim_question" | "rejected";

export type OutboundOperationLog = {
  id: string;
  action: "work_mode_assigned" | "status_changed" | "document_reprinted" | "intercept_requested" | "intercept_completed" | "scan_pick" | "scan_sort" | "scan_pack" | "scan_ship" | "scan_intercept" | "exception_created" | "exception_resolved" | "customer_exception_decision";
  label: string;
  detail?: string;
  operator: string;
  occurredAt: string;
};

export type OutboundReprintLog = {
  id: string;
  documentType: OutboundDocumentType;
  reason: string;
  operator: string;
  printedAt: string;
};

export type OutboundScanRecord = {
  id: string;
  action: OutboundScanAction;
  code: string;
  codeType: OutboundScanCodeType;
  skuCode?: string;
  quantity?: number;
  locationCode?: string;
  weightKg?: number;
  operator: string;
  scannedAt: string;
};

export type OutboundScanProgress = {
  pickedQtyBySku?: Record<string, number>;
  sortedQtyBySku?: Record<string, number>;
  packedQtyBySku?: Record<string, number>;
  lastScans?: OutboundScanRecord[];
};

export type OutboundExceptionRecord = {
  id: string;
  type: OutboundExceptionType;
  status: OutboundExceptionStatus;
  severity: "warning" | "critical";
  deliveryExceptionType?: OutboundDeliveryExceptionType;
  action?: OutboundScanAction;
  code?: string;
  skuCode?: string;
  message: string;
  redeliveryRequired?: boolean;
  redeliveryNote?: string;
  proofUrl?: string;
  claimAmount?: number;
  claimStatus?: OutboundClaimStatus;
  claimNote?: string;
  customerDecision?: OutboundCustomerExceptionDecision;
  customerDecisionNote?: string;
  customerDecisionAt?: string;
  customerDecisionBy?: string;
  workOrderId?: string;
  operator: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
};

export type CoreOutboundOrder = {
  id: string;
  customerCode: string;
  channel: string;
  orderCount: number;
  skuLines?: Array<{
    skuCode: string;
    quantity: number;
  }>;
  recipientName?: string;
  deliveryAddress?: string;
  requestedShipDate?: string;
  note?: string;
  platform?: string;
  platformOrderNo?: string;
  platformStoreName?: string;
  platformFulfillmentStatus?: "not_required" | "pending" | "synced" | "failed";
  platformFulfillmentSyncedAt?: string;
  platformFulfillmentError?: string;
  carrierServiceCode?: CarrierServiceCode;
  carrierName?: string;
  carrierServiceName?: string;
  packageWeightKg?: number;
  packageCount?: number;
  shippingFee?: number;
  actualShippingFee?: number;
  shippingFeeCheckedAt?: string;
  shippingFeeCheckedBy?: string;
  shippingFeeNote?: string;
  labelStatus?: OutboundLabelStatus;
  labelGeneratedAt?: string;
  labelGeneratedBy?: string;
  labelUrl?: string;
  labelFormat?: "pdf" | "zpl" | "internal";
  labelFailureReason?: string;
  labelRetryCount?: number;
  labelLastTriedAt?: string;
  labelLastTriedBy?: string;
  labelNextRetryAt?: string;
  labelFallbackNote?: string;
  carrierGatewayMode?: "internal" | "sandbox" | "live";
  carrierProvider?: string;
  carrierShipmentId?: string;
  trackingNumber?: string;
  trackingEvents?: OutboundTrackingEvent[];
  workMode?: OutboundWorkMode;
  pickWaveNo?: string;
  pickListNo?: string;
  assignedPicker?: string;
  basketNo?: string;
  reprintLogs?: OutboundReprintLog[];
  operationLogs?: OutboundOperationLog[];
  scanProgress?: OutboundScanProgress;
  exceptions?: OutboundExceptionRecord[];
  interceptStatus?: OutboundInterceptStatus;
  interceptReason?: string;
  interceptRequestedBy?: string;
  interceptRequestedAt?: string;
  interceptCompletedAt?: string;
  restockLocationCode?: string;
  shippedAt?: string;
  handoverAt?: string;
  status: "pending_review" | "picking" | "label_pending" | "packing_check" | "handover" | "shipped" | "blocked";
  createdAt: string;
  updatedAt?: string;
};

export type ReturnOrderStatus = "requested" | "label_sent" | "in_transit" | "received" | "inspection" | "restocked" | "repair" | "disposed" | "closed" | "exception";

export type ReturnResolution = "restock" | "repair" | "dispose" | "reship";

export type ReturnScanAction = "receive" | "inspect";

export type ReturnScanRecord = {
  id: string;
  action: ReturnScanAction;
  code: string;
  codeType: "return" | "tracking" | "order" | "sku" | "location";
  skuCode?: string;
  locationCode?: string;
  operator: string;
  scannedAt: string;
};

export type ReturnOrder = {
  id: string;
  customerCode: string;
  platform: string;
  originalOrderNo?: string;
  buyerReturnTracking?: string;
  returnReason: string;
  expectedArrivalDate?: string;
  skuLines: Array<{
    skuCode: string;
    quantity: number;
  }>;
  status: ReturnOrderStatus;
  inspectionResult?: string;
  resolution?: ReturnResolution;
  customerResolutionDecision?: ReturnResolution;
  customerResolutionNote?: string;
  customerResolutionConfirmedAt?: string;
  locationCode?: string;
  workOrderId?: string;
  customerNote?: string;
  opsNote?: string;
  scanLogs?: ReturnScanRecord[];
  receivedAt?: string;
  inspectedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type BillingRefType = "quote" | "inbound" | "outbound" | "logistics" | "storage" | "return" | "manual";

export type BillingFeeCode =
  | "inbound_carton"
  | "outbound_order"
  | "outbound_item"
  | "labeling_service"
  | "remote_area_surcharge"
  | "fuel_surcharge"
  | "oversize_surcharge"
  | "return_inspection"
  | "return_restock"
  | "return_disposal"
  | "storage_daily"
  | "manual_service";

export type BillingFeeRule = {
  feeCode: BillingFeeCode;
  label: string;
  refType: BillingRefType;
  unitLabel: string;
  unitPrice: number;
  description: string;
  active: boolean;
};

export type BillingFeeLine = {
  feeCode: BillingFeeCode;
  label: string;
  unitLabel: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  note?: string;
};

export type BillingInvoiceStatus = "not_requested" | "requested" | "issued" | "voided";

export type BillingStatementStatus = "open" | "locked";

export type BillingPaymentReviewAction = "mark_paid" | "reject_payment" | "resolve_dispute" | "reopen";
export type BillingAdjustmentKind = "fee_adjustment" | "compensation";
export type BillingAdjustmentApprovalStatus = "pending_approval" | "approved" | "posted" | "rejected" | "paid";
export type BillingAdjustmentAttachmentStatus = "not_required" | "archived" | "confirmed" | "missing";

export type BillingRecord = {
  id: string;
  customerCode: string;
  refType: BillingRefType;
  refId: string;
  status: "draft" | "pending_confirmation" | "confirmed" | "payment_submitted" | "paid" | "disputed";
  currency: "GBP";
  amount: number;
  dueDate?: string;
  title: string;
  note?: string;
  workOrderId?: string;
  adjustmentKind?: BillingAdjustmentKind;
  adjustmentApprovalStatus?: BillingAdjustmentApprovalStatus;
  adjustmentApprovalRuleId?: string;
  adjustmentApprovalRuleName?: string;
  adjustmentApprovalRuleNote?: string;
  adjustmentAttachmentStatus?: BillingAdjustmentAttachmentStatus;
  adjustmentSourceRecordId?: string;
  feeLines?: BillingFeeLine[];
  generatedBy?: string;
  generatedAt?: string;
  invoiceStatus?: BillingInvoiceStatus;
  invoiceRequestedAt?: string;
  invoiceIssuedAt?: string;
  invoiceVoidedAt?: string;
  invoiceNote?: string;
  invoiceUpdatedBy?: string;
  statementStatus?: BillingStatementStatus;
  statementMonth?: string;
  statementId?: string;
  statementLockedAt?: string;
  statementLockedBy?: string;
  statementCustomerConfirmedAt?: string;
  statementCustomerMessage?: string;
  statementPaymentReference?: string;
  statementPaymentNote?: string;
  statementPaymentSubmittedAt?: string;
  statementPaymentRejectedAt?: string;
  statementPaymentRejectedBy?: string;
  statementPaymentRejectionNote?: string;
  statementPaidAt?: string;
  statementPaidBy?: string;
  statementReviewNote?: string;
  customerMessage?: string;
  customerConfirmedAt?: string;
  paymentReference?: string;
  paymentNote?: string;
  paymentSubmittedAt?: string;
  paymentRejectedAt?: string;
  paymentRejectedBy?: string;
  paymentRejectionNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt?: string;
  approvalTimeline?: ApprovalTimelineEvent[];
};

export type WarehouseCoreData = {
  customers: CustomerProfile[];
  skus: WarehouseSku[];
  inventoryBalances: InventoryBalance[];
  inventoryLots: InventoryLot[];
  locations: WarehouseLocation[];
  inventoryMovements: InventoryMovement[];
  inventoryAdjustments: InventoryAdjustmentRequest[];
  replenishmentPlans: ReplenishmentPlan[];
  transferOrders: TransferOrder[];
  purchaseReceipts: PurchaseReceiptOrder[];
  stocktakeBatches: StocktakeBatch[];
  outboundOrders: CoreOutboundOrder[];
  returnOrders: ReturnOrder[];
  billingRecords: BillingRecord[];
};

export type CustomerCreditRiskStatus = "clear" | "warning" | "blocked";

export type CustomerCreditRisk = {
  status: CustomerCreditRiskStatus;
  customerCode: string;
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  creditLimit?: number;
  creditRemaining?: number;
  billingCycle?: CustomerProfile["billingCycle"];
  paymentTermDays?: number;
  reasons: string[];
  checkedAt: string;
};

const coreStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "warehouse-core.json") : path.join(process.cwd(), ".local-data", "warehouse-core.json");

function now() {
  return new Date().toISOString();
}

function normalizeInventoryBalance(balance: InventoryBalance): InventoryBalance {
  return {
    ...balance,
    frozenQty: Math.max(0, Math.floor(Number(balance.frozenQty ?? 0))),
    defectiveQty: Math.max(0, Math.floor(Number(balance.defectiveQty ?? 0))),
  };
}

function inventoryTotalQty(balance: InventoryBalance) {
  return balance.availableQty + balance.reservedQty + (balance.frozenQty ?? 0) + (balance.defectiveQty ?? 0);
}

export function warehouseLocationZoneTypeLabel(type?: WarehouseLocationZoneType) {
  const labels: Record<WarehouseLocationZoneType, string> = {
    standard: "常规库位",
    receiving: "收货暂存",
    returns: "退货处理",
    defective: "残次品位",
    frozen: "冻结库存位",
    oversize: "大件库位",
  };
  return labels[type ?? "standard"];
}

const validLocationZoneTypes = new Set<WarehouseLocationZoneType>(["standard", "receiving", "returns", "defective", "frozen", "oversize"]);

function normalizeLocationZoneType(type?: string): WarehouseLocationZoneType {
  const clean = (type || "standard").trim().toLowerCase() as WarehouseLocationZoneType;
  return validLocationZoneTypes.has(clean) ? clean : "standard";
}

export function warehouseLocationStatusLabel(status: WarehouseLocation["status"]) {
  const labels: Record<WarehouseLocation["status"], string> = {
    active: "可用",
    blocked: "停用",
    reserved: "预留",
  };
  return labels[status] ?? status;
}

export function getLocationUtilization(data: Pick<WarehouseCoreData, "inventoryBalances" | "locations">, locationCode: string, excludeBalanceId?: string) {
  const cleanLocationCode = locationCode.trim().toUpperCase();
  const balances = data.inventoryBalances.filter((item) => item.locationCode === cleanLocationCode && item.id !== excludeBalanceId);
  const usedQty = balances.reduce((sum, item) => sum + inventoryTotalQty(item), 0);
  const skuKeys = new Set(balances.filter((item) => inventoryTotalQty(item) > 0).map((item) => `${item.customerCode}:${item.skuCode}`));
  const location = data.locations.find((item) => item.locationCode === cleanLocationCode);
  const capacityQty = location?.capacityQty;
  return {
    locationCode: cleanLocationCode,
    usedQty,
    capacityQty,
    remainingQty: typeof capacityQty === "number" ? Math.max(0, capacityQty - usedQty) : undefined,
    skuCount: skuKeys.size,
    occupancyRate: typeof capacityQty === "number" && capacityQty > 0 ? Math.min(1, usedQty / capacityQty) : undefined,
  };
}

function inventoryPlacementQty(balance: InventoryBalance | undefined, targetLocationCode: string, incomingQty: number) {
  const cleanIncomingQty = Math.max(0, Math.floor(Number(incomingQty) || 0));
  if (!balance) return cleanIncomingQty;
  return (balance.locationCode || "") === targetLocationCode ? inventoryTotalQty(balance) + cleanIncomingQty : inventoryTotalQty(balance) + cleanIncomingQty;
}

export function validateLocationPlacement({
  data,
  customerCode,
  skuCode,
  targetLocationCode,
  balance,
  incomingQty,
  allowSameLocation = true,
  restrictSpecialZones = false,
}: {
  data: Pick<WarehouseCoreData, "inventoryBalances" | "locations">;
  customerCode: string;
  skuCode: string;
  targetLocationCode: string;
  balance?: InventoryBalance;
  incomingQty: number;
  allowSameLocation?: boolean;
  restrictSpecialZones?: boolean;
}) {
  const cleanTargetLocationCode = targetLocationCode.trim().toUpperCase();
  const cleanCustomerCode = customerCode.trim().toUpperCase();
  const cleanSkuCode = skuCode.trim().toUpperCase();
  if (!cleanTargetLocationCode) return { ok: false, error: "请选择目标库位" };
  if (!allowSameLocation && (balance?.locationCode || "") === cleanTargetLocationCode) return { ok: false, error: "目标库位不能和当前库位相同" };

  const targetLocation = data.locations.find((item) => item.locationCode === cleanTargetLocationCode);
  if (!targetLocation) return { ok: false, error: "目标库位不存在，请先在库位管理中创建" };
  if (targetLocation.status !== "active") return { ok: false, error: `目标库位当前为${warehouseLocationStatusLabel(targetLocation.status)}，不能移入` };
  if (restrictSpecialZones && ["frozen", "defective"].includes(targetLocation.zoneType ?? "")) {
    return { ok: false, error: "冻结位/残次品位不能用于普通上架，请通过冻结或残次品流程处理", targetLocation };
  }

  const placementQty = inventoryPlacementQty(balance, cleanTargetLocationCode, incomingQty);
  const utilization = getLocationUtilization(data, cleanTargetLocationCode, balance?.id);
  if (typeof targetLocation.capacityQty === "number" && targetLocation.capacityQty > 0 && utilization.usedQty + placementQty > targetLocation.capacityQty) {
    return {
      ok: false,
      error: `目标库位容量不足：容量 ${targetLocation.capacityQty} 件，已占用 ${utilization.usedQty} 件，本次需放入 ${placementQty} 件`,
      targetLocation,
      utilization,
    };
  }

  if (!(targetLocation.allowMixedSku ?? true)) {
    const mixedBalance = data.inventoryBalances.find(
      (item) =>
        item.id !== balance?.id &&
        item.locationCode === cleanTargetLocationCode &&
        inventoryTotalQty(item) > 0 &&
        (item.customerCode !== cleanCustomerCode || item.skuCode !== cleanSkuCode),
    );
    if (mixedBalance) {
      return {
        ok: false,
        error: `目标库位不允许混放，当前已有 ${mixedBalance.customerCode} / ${mixedBalance.skuCode}`,
        targetLocation,
        utilization,
      };
    }
  }

  return { ok: true, targetLocation, utilization };
}

export function validateLocationMove(data: Pick<WarehouseCoreData, "inventoryBalances" | "locations">, balance: InventoryBalance, targetLocationCode: string) {
  return validateLocationPlacement({
    data,
    customerCode: balance.customerCode,
    skuCode: balance.skuCode,
    targetLocationCode,
    balance,
    incomingQty: 0,
    allowSameLocation: false,
  });
}

function makeCoreId(prefix: string) {
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${yyyymm}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function approvalEvent(action: ApprovalTimelineEvent["action"], label: string, actor: string, note?: string, occurredAt = now()): ApprovalTimelineEvent {
  return {
    id: makeCoreId("APP"),
    action,
    label,
    actor,
    note: note?.trim() || undefined,
    occurredAt,
  };
}

function appendApprovalTimeline(events: ApprovalTimelineEvent[] | undefined, event: ApprovalTimelineEvent) {
  return [event, ...(events ?? [])].slice(0, 20);
}

function billingTimelineEvent(action: ApprovalTimelineEvent["action"], label: string, actor: string, note?: string, occurredAt = now()) {
  return approvalEvent(action, label, actor, note, occurredAt);
}

function adjustmentApprovalStatusForBillingStatus(status: BillingRecord["status"]): BillingAdjustmentApprovalStatus {
  if (status === "paid") return "paid";
  if (status === "confirmed" || status === "payment_submitted") return "posted";
  if (status === "disputed") return "rejected";
  return "approved";
}

function makeDailySequence(prefix: string) {
  const date = new Date();
  const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `${prefix}-${yyyymmdd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function outboundWorkModeLabel(mode?: OutboundWorkMode) {
  const labels: Record<OutboundWorkMode, string> = {
    single_item_batch: "集中分拣",
    cart_sort: "拣货车分拣",
    order_pick: "按单分拣",
  };
  return mode ? labels[mode] : "待分配";
}

export function inferOutboundWorkMode(order: Pick<CoreOutboundOrder, "orderCount" | "skuLines" | "channel" | "carrierServiceCode">): OutboundWorkMode {
  const totalQty = order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const skuCount = order.skuLines?.length ?? 0;
  const text = `${order.channel || ""} ${order.carrierServiceCode || ""}`.toLowerCase();

  if (text.includes("fba") || text.includes("manual") || text.includes("invoice") || text.includes("customer arranged")) return "order_pick";
  if (skuCount <= 1 && totalQty <= Math.max(1, order.orderCount)) return "single_item_batch";
  return "cart_sort";
}

function appendOutboundOperationLog(order: CoreOutboundOrder, log: Omit<OutboundOperationLog, "id" | "occurredAt"> & { occurredAt?: string }) {
  return [
    {
      ...log,
      id: makeCoreId("OLOG"),
      occurredAt: log.occurredAt ?? now(),
    },
    ...(order.operationLogs ?? []),
  ].slice(0, 60);
}

function normalizeScanCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function totalRequiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function totalScannedQty(progress?: Record<string, number>) {
  return Object.values(progress ?? {}).reduce((sum, qty) => sum + qty, 0);
}

function expectedSkuQuantity(order: CoreOutboundOrder, skuCode: string) {
  return order.skuLines?.find((line) => line.skuCode.toUpperCase() === skuCode.toUpperCase())?.quantity ?? 0;
}

function incrementScanQty(progress: Record<string, number> | undefined, skuCode: string, expectedQty: number) {
  const current = progress?.[skuCode] ?? 0;
  if (current >= expectedQty) return { next: progress ?? {}, accepted: false };
  return { next: { ...(progress ?? {}), [skuCode]: current + 1 }, accepted: true };
}

function resolveOutboundOrderByCode(data: WarehouseCoreData, code: string, activeOrderId?: string) {
  const normalized = normalizeScanCode(code);
  const active = activeOrderId ? data.outboundOrders.find((order) => order.id === activeOrderId) : undefined;
  const matched =
    data.outboundOrders.find((order) =>
      [order.id, order.pickWaveNo, order.pickListNo, order.trackingNumber, order.basketNo]
        .filter(Boolean)
        .some((token) => normalizeScanCode(token ?? "") === normalized),
    ) ?? active;

  if (!matched) return { order: null, codeType: "unknown" as OutboundScanCodeType };
  if (normalizeScanCode(matched.id) === normalized) return { order: matched, codeType: "outbound_order" as OutboundScanCodeType };
  if (matched.pickWaveNo && normalizeScanCode(matched.pickWaveNo) === normalized) return { order: matched, codeType: "pick_wave" as OutboundScanCodeType };
  if (matched.pickListNo && normalizeScanCode(matched.pickListNo) === normalized) return { order: matched, codeType: "pick_list" as OutboundScanCodeType };
  if (matched.trackingNumber && normalizeScanCode(matched.trackingNumber) === normalized) return { order: matched, codeType: "tracking" as OutboundScanCodeType };
  if (matched.basketNo && normalizeScanCode(matched.basketNo) === normalized) return { order: matched, codeType: "basket" as OutboundScanCodeType };
  return { order: matched, codeType: active ? "unknown" as OutboundScanCodeType : "unknown" as OutboundScanCodeType };
}

function resolveSkuFromScan(data: WarehouseCoreData, order: CoreOutboundOrder, code: string) {
  const normalized = normalizeScanCode(code);
  const directLine = order.skuLines?.find((line) => normalizeScanCode(line.skuCode) === normalized);
  if (directLine) return directLine.skuCode;

  const sku = data.skus.find((item) => item.customerCode === order.customerCode && normalizeScanCode(item.barcode ?? "") === normalized);
  if (!sku) return "";
  return order.skuLines?.some((line) => line.skuCode === sku.skuCode) ? sku.skuCode : "";
}

function resolveLocationFromScan(data: WarehouseCoreData, code: string) {
  const normalized = normalizeScanCode(code);
  return data.locations.find((item) => normalizeScanCode(item.locationCode) === normalized)?.locationCode ?? "";
}

function appendScanRecord(order: CoreOutboundOrder, record: Omit<OutboundScanRecord, "id" | "scannedAt"> & { scannedAt?: string }) {
  return [
    {
      ...record,
      id: makeCoreId("SCAN"),
      scannedAt: record.scannedAt ?? now(),
    },
    ...(order.scanProgress?.lastScans ?? []),
  ].slice(0, 80);
}

function appendReturnScanRecord(order: ReturnOrder, record: Omit<ReturnScanRecord, "id" | "scannedAt"> & { scannedAt?: string }) {
  return [
    {
      ...record,
      id: makeCoreId("RSCAN"),
      scannedAt: record.scannedAt ?? now(),
    },
    ...(order.scanLogs ?? []),
  ].slice(0, 80);
}

function appendOutboundException(
  order: CoreOutboundOrder,
  exception: Omit<OutboundExceptionRecord, "id" | "createdAt" | "status"> & { status?: OutboundExceptionStatus; createdAt?: string },
) {
  return [
    {
      ...exception,
      id: makeCoreId("EXC"),
      status: exception.status ?? "open",
      createdAt: exception.createdAt ?? now(),
    },
    ...(order.exceptions ?? []),
  ].slice(0, 80);
}

function statusLabelForException(status: OutboundExceptionStatus) {
  const labels: Record<OutboundExceptionStatus, string> = {
    open: "待处理",
    investigating: "处理中",
    resolved: "已处理",
    ignored: "已忽略",
  };
  return labels[status];
}

function openOutboundExceptions(order: CoreOutboundOrder) {
  return (order.exceptions ?? []).filter((item) => item.status === "open" || item.status === "investigating");
}

export const outboundDeliveryExceptionTypeLabel: Record<OutboundDeliveryExceptionType, string> = {
  delivery_failed: "派送失败",
  address_issue: "地址异常",
  customer_absent: "收件人不在",
  damaged: "运输破损",
  lost: "疑似丢件",
  return_to_sender: "退回仓库",
  claim: "物流赔付",
  proof_uploaded: "签收证明",
  manual: "其他异常",
};

export const outboundClaimStatusLabel: Record<OutboundClaimStatus, string> = {
  not_required: "无需赔付",
  draft: "待整理材料",
  submitted: "已提交承运商",
  approved: "已通过",
  rejected: "已拒赔",
  paid: "已赔付到账",
};

export const outboundCustomerExceptionDecisionLabel: Record<OutboundCustomerExceptionDecision, string> = {
  accepted: "客户确认无误",
  redelivery_confirmed: "客户确认改派",
  claim_question: "客户提出赔付疑问",
  rejected: "客户不认可处理结果",
};

function applyOutboundScanException({
  data,
  order,
  index,
  type,
  severity,
  action,
  code,
  skuCode,
  message,
  operator,
  blockOrder = false,
}: {
  data: WarehouseCoreData;
  order: CoreOutboundOrder;
  index: number;
  type: OutboundExceptionType;
  severity: "warning" | "critical";
  action?: OutboundScanAction;
  code?: string;
  skuCode?: string;
  message: string;
  operator: string;
  blockOrder?: boolean;
}) {
  const occurredAt = now();
  data.outboundOrders[index] = {
    ...order,
    status: blockOrder ? "blocked" : order.status,
    exceptions: appendOutboundException(order, { type, severity, action, code, skuCode, message, operator, createdAt: occurredAt }),
    operationLogs: appendOutboundOperationLog(order, {
      action: "exception_created",
      label: "扫码异常",
      detail: message,
      operator,
      occurredAt,
    }),
    updatedAt: occurredAt,
  };
}

const carrierRateRules: CarrierRateRule[] = [
  { serviceCode: "royal_mail_48", carrierName: "Royal Mail", serviceName: "Tracked 48", currency: "GBP", baseFee: 3.65, perKgFee: 0.72, maxWeightKg: 20, etaDays: "2-3", trackingPrefix: "RM48", active: true },
  { serviceCode: "royal_mail_24", carrierName: "Royal Mail", serviceName: "Tracked 24", currency: "GBP", baseFee: 4.95, perKgFee: 0.9, maxWeightKg: 20, etaDays: "1-2", trackingPrefix: "RM24", active: true },
  { serviceCode: "dpd_next_day", carrierName: "DPD UK", serviceName: "Next Day", currency: "GBP", baseFee: 6.8, perKgFee: 0.62, maxWeightKg: 30, etaDays: "1", trackingPrefix: "DPD", active: true },
  { serviceCode: "evri_standard", carrierName: "Evri", serviceName: "Standard", currency: "GBP", baseFee: 2.95, perKgFee: 0.58, maxWeightKg: 15, etaDays: "2-4", trackingPrefix: "EVRI", active: true },
  { serviceCode: "manual", carrierName: "人工承运商", serviceName: "手动/客户指定渠道", currency: "GBP", baseFee: 0, perKgFee: 0, maxWeightKg: 999, etaDays: "-", trackingPrefix: "MAN", active: true },
];

const billingFeeRules: BillingFeeRule[] = [
  { feeCode: "inbound_carton", label: "入库收货", refType: "inbound", unitLabel: "箱", unitPrice: 0.35, description: "按入库箱数自动生成收货处理费", active: true },
  { feeCode: "outbound_order", label: "出库基础处理", refType: "outbound", unitLabel: "单", unitPrice: 0.65, description: "按出库订单数量生成基础拣配费", active: true },
  { feeCode: "outbound_item", label: "出库 SKU 件数", refType: "outbound", unitLabel: "件", unitPrice: 0.18, description: "按出库商品件数生成拣货操作费", active: true },
  { feeCode: "labeling_service", label: "面单/贴标处理", refType: "outbound", unitLabel: "票", unitPrice: 0.12, description: "按已生成面单的出库单自动生成贴标处理费", active: true },
  { feeCode: "remote_area_surcharge", label: "偏远地区附加费", refType: "logistics", unitLabel: "票", unitPrice: 2.8, description: "按偏远邮编出库单自动生成偏远地区附加费", active: true },
  { feeCode: "fuel_surcharge", label: "燃油附加费", refType: "logistics", unitLabel: "运费GBP", unitPrice: 0.06, description: "按预估或实际运费自动生成燃油附加费", active: true },
  { feeCode: "oversize_surcharge", label: "超尺寸/多包裹附加费", refType: "logistics", unitLabel: "票", unitPrice: 2.5, description: "按超重或多包裹出库单自动生成附加费", active: true },
  { feeCode: "return_inspection", label: "退货质检", refType: "return", unitLabel: "件", unitPrice: 1.2, description: "按退货件数生成质检处理费", active: true },
  { feeCode: "return_restock", label: "退货上架", refType: "return", unitLabel: "件", unitPrice: 0.45, description: "按可重新入库件数生成上架费", active: true },
  { feeCode: "return_disposal", label: "退货销毁", refType: "return", unitLabel: "件", unitPrice: 0.8, description: "按需销毁件数生成处置费", active: true },
  { feeCode: "storage_daily", label: "仓储日租", refType: "storage", unitLabel: "CBM/天", unitPrice: 0.62, description: "按占用体积和天数生成仓储费", active: true },
  { feeCode: "manual_service", label: "人工服务", refType: "manual", unitLabel: "项", unitPrice: 1, description: "用于临时增值服务或费用调整", active: true },
];

export function makeCustomerCode() {
  return makeCoreId("CUST");
}

function seedCoreData(): WarehouseCoreData {
  return {
    customers: [],
    skus: [],
    inventoryBalances: [],
    inventoryLots: [],
    locations: [],
    inventoryMovements: [],
    inventoryAdjustments: [],
    replenishmentPlans: [],
    transferOrders: [],
    purchaseReceipts: [],
    stocktakeBatches: [],
    outboundOrders: [],
    returnOrders: [],
    billingRecords: [],
  };
}

async function ensureInventoryAdjustmentTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_inventory_adjustments (
      id text primary key,
      customer_code text not null,
      sku_code text not null,
      warehouse_code text not null default 'SHEFFIELD-MAIN',
      status text not null default 'pending',
      available_delta integer not null default 0,
      reserved_delta integer not null default 0,
      alert_qty integer,
      aging_days integer,
      reason text not null default '',
      requested_by text not null default 'system',
      requested_by_role text not null default 'staff',
      requested_at timestamptz not null default now(),
      reviewed_by text,
      reviewed_at timestamptz,
      review_note text,
      payload jsonb not null default '{}'::jsonb
    )
  `;
  await sql`create index if not exists warehouse_inventory_adjustments_status_idx on warehouse_inventory_adjustments (status, requested_at desc)`;
  await sql`create index if not exists warehouse_inventory_adjustments_customer_idx on warehouse_inventory_adjustments (customer_code, requested_at desc)`;
}

async function ensureReturnOrdersTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_return_orders (
      id text primary key,
      customer_code text not null,
      platform text not null default '',
      original_order_no text,
      buyer_return_tracking text,
      status text not null default 'requested',
      return_reason text not null default '',
      expected_arrival_date date,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    )
  `;
  await sql`create index if not exists warehouse_return_orders_customer_status_idx on warehouse_return_orders (customer_code, status, created_at desc)`;
  await sql`create index if not exists warehouse_return_orders_tracking_idx on warehouse_return_orders (buyer_return_tracking)`;
}

async function ensureReplenishmentPlanTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_replenishment_plans (
      id text primary key,
      customer_code text not null,
      sku_code text not null,
      target_warehouse_code text not null,
      status text not null default 'draft',
      planned_qty integer not null default 0,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    )
  `;
  await sql`create index if not exists warehouse_replenishment_plans_customer_status_idx on warehouse_replenishment_plans (customer_code, status, created_at desc)`;
}

async function ensureTransferOrderTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_transfer_orders (
      id text primary key,
      customer_code text not null,
      sku_code text not null,
      from_warehouse_code text not null,
      to_warehouse_code text not null,
      status text not null default 'new',
      quantity integer not null default 0,
      received_qty integer not null default 0,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    )
  `;
  await sql`create index if not exists warehouse_transfer_orders_customer_status_idx on warehouse_transfer_orders (customer_code, status, created_at desc)`;
}

async function ensurePurchaseReceiptTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_purchase_receipts (
      id text primary key,
      customer_code text not null,
      supplier_name text not null default '',
      warehouse_code text not null,
      status text not null default 'draft',
      total_expected_qty integer not null default 0,
      total_received_qty integer not null default 0,
      total_putaway_qty integer not null default 0,
      tracking_number text,
      expected_arrival_date date,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    )
  `;
  await sql`create index if not exists warehouse_purchase_receipts_customer_status_idx on warehouse_purchase_receipts (customer_code, status, created_at desc)`;
  await sql`create index if not exists warehouse_purchase_receipts_tracking_idx on warehouse_purchase_receipts (tracking_number)`;
}

async function ensureStocktakeBatchTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_stocktake_batches (
      id text primary key,
      warehouse_code text not null,
      customer_code text,
      status text not null default 'draft',
      item_count integer not null default 0,
      difference_count integer not null default 0,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    )
  `;
  await sql`create index if not exists warehouse_stocktake_batches_status_idx on warehouse_stocktake_batches (warehouse_code, status, created_at desc)`;
}

async function ensureInventoryLotTable() {
  const sql = getSql();
  await sql`
    create table if not exists warehouse_inventory_lots (
      id text primary key,
      customer_code text not null,
      sku_code text not null,
      warehouse_code text not null,
      lot_no text not null,
      expiry_date date,
      status text not null default 'active',
      quantity integer not null default 0,
      available_qty integer not null default 0,
      reserved_qty integer not null default 0,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    )
  `;
  await sql`create index if not exists warehouse_inventory_lots_customer_sku_idx on warehouse_inventory_lots (customer_code, sku_code, status, expiry_date)`;
  await sql`create index if not exists warehouse_inventory_lots_lot_no_idx on warehouse_inventory_lots (lot_no)`;
}

async function readPostgresCoreData(): Promise<WarehouseCoreData> {
  const sql = getSql();
  await sql`alter table if exists warehouse_inventory_balances add column if not exists frozen_qty integer not null default 0`;
  await sql`alter table if exists warehouse_inventory_balances add column if not exists defective_qty integer not null default 0`;
  await ensureInventoryAdjustmentTable();
  await ensureReturnOrdersTable();
  await ensureReplenishmentPlanTable();
  await ensureTransferOrderTable();
  await ensurePurchaseReceiptTable();
  await ensureStocktakeBatchTable();
  await ensureInventoryLotTable();
  await ensureInventoryLotTable();
  const [customers, skus, locations, inventoryBalances, inventoryLots, inventoryMovements, inventoryAdjustments, replenishmentPlans, transferOrders, purchaseReceipts, stocktakeBatches, outboundOrders, returnOrders, billingRecords] = await Promise.all([
    sql<{ payload: CustomerProfile }[]>`select payload from warehouse_customers order by updated_at desc nulls last, created_at desc`,
    sql<{ payload: WarehouseSku }[]>`select payload from warehouse_skus order by created_at desc`,
    sql<{ payload: WarehouseLocation }[]>`select payload from warehouse_locations order by warehouse_code, location_code`,
    sql<InventoryBalance[]>`
      select id, customer_code as "customerCode", sku_code as "skuCode", warehouse_code as "warehouseCode", location_code as "locationCode",
        available_qty as "availableQty", reserved_qty as "reservedQty", frozen_qty as "frozenQty", defective_qty as "defectiveQty", inbound_qty as "inboundQty", alert_qty as "alertQty", aging_days as "agingDays",
        updated_at as "updatedAt"
      from warehouse_inventory_balances
      order by updated_at desc
    `,
    sql<{ payload: InventoryLot }[]>`select payload from warehouse_inventory_lots order by updated_at desc nulls last, created_at desc limit 1000`,
    sql<InventoryMovement[]>`
      select id, customer_code as "customerCode", sku_code as "skuCode", ref_type as "refType", ref_id as "refId", movement_type as "movementType",
        quantity, before_qty as "beforeQty", after_qty as "afterQty", note, occurred_at as "occurredAt", operator
      from warehouse_inventory_movements
      order by occurred_at desc
      limit 500
    `,
    sql<{ payload: InventoryAdjustmentRequest }[]>`select payload from warehouse_inventory_adjustments order by requested_at desc limit 500`,
    sql<{ payload: ReplenishmentPlan }[]>`select payload from warehouse_replenishment_plans order by created_at desc limit 500`,
    sql<{ payload: TransferOrder }[]>`select payload from warehouse_transfer_orders order by created_at desc limit 500`,
    sql<{ payload: PurchaseReceiptOrder }[]>`select payload from warehouse_purchase_receipts order by created_at desc limit 500`,
    sql<{ payload: StocktakeBatch }[]>`select payload from warehouse_stocktake_batches order by created_at desc limit 500`,
    sql<{ payload: CoreOutboundOrder }[]>`select payload from warehouse_outbound_orders order by created_at desc`,
    sql<{ payload: ReturnOrder }[]>`select payload from warehouse_return_orders order by created_at desc`,
    sql<{ payload: BillingRecord }[]>`select payload from warehouse_billing_records order by created_at desc`,
  ]);

  if (customers.length === 0 && skus.length === 0 && outboundOrders.length === 0) {
    const seeded = seedCoreData();
    await writePostgresCoreData(seeded);
    return seeded;
  }

  return {
    customers: customers.map((row) => row.payload),
    skus: skus.map((row) => row.payload),
    locations: locations.map((row) => row.payload),
    inventoryBalances: inventoryBalances.map((row) => normalizeInventoryBalance({
      ...row,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : now(),
    })),
    inventoryLots: inventoryLots.map((row) => row.payload),
    inventoryMovements: inventoryMovements.map((row) => ({
      ...row,
      occurredAt: row.occurredAt ? new Date(row.occurredAt).toISOString() : now(),
    })),
    inventoryAdjustments: inventoryAdjustments.map((row) => row.payload),
    replenishmentPlans: replenishmentPlans.map((row) => row.payload),
    transferOrders: transferOrders.map((row) => row.payload),
    purchaseReceipts: purchaseReceipts.map((row) => row.payload),
    stocktakeBatches: stocktakeBatches.map((row) => row.payload),
    outboundOrders: outboundOrders.map((row) => row.payload),
    returnOrders: returnOrders.map((row) => row.payload),
    billingRecords: billingRecords.map((row) => row.payload),
  };
}

async function writePostgresCoreData(data: WarehouseCoreData) {
  const sql = getSql();
  await ensureInventoryAdjustmentTable();
  await ensureReturnOrdersTable();
  await ensureReplenishmentPlanTable();
  await ensureTransferOrderTable();
  await ensurePurchaseReceiptTable();
  await ensureStocktakeBatchTable();

  for (const item of data.customers) {
    await sql`
      insert into warehouse_customers (
        customer_code, company_name, contact_name, phone, email, vat_number, eori_number, platforms, store_url, business_address, status, payload, updated_at
      )
      values (
        ${item.customerCode}, ${item.companyName}, ${item.contactName}, ${item.phone}, ${item.email ?? ""}, ${item.vatNumber ?? null}, ${item.eoriNumber ?? null},
        ${item.platforms ?? []}, ${item.storeUrl ?? null}, ${item.businessAddress ?? null}, ${item.status}, ${sql.json(item)}, ${item.updatedAt ?? now()}
      )
      on conflict (customer_code) do update set
        company_name = excluded.company_name,
        contact_name = excluded.contact_name,
        phone = excluded.phone,
        email = excluded.email,
        vat_number = excluded.vat_number,
        eori_number = excluded.eori_number,
        platforms = excluded.platforms,
        store_url = excluded.store_url,
        business_address = excluded.business_address,
        status = excluded.status,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.skus) {
    await sql`
      insert into warehouse_skus (sku_code, customer_code, product_name, barcode, category, status, payload, updated_at)
      values (${item.skuCode}, ${item.customerCode}, ${item.productName}, ${item.barcode ?? null}, ${item.category ?? null}, ${item.status}, ${sql.json(item)}, now())
      on conflict (sku_code) do update set
        customer_code = excluded.customer_code,
        product_name = excluded.product_name,
        barcode = excluded.barcode,
        category = excluded.category,
        status = excluded.status,
        payload = excluded.payload,
        updated_at = now()
    `;
  }

  for (const item of data.locations) {
    await sql`
      insert into warehouse_locations (location_code, warehouse_code, zone, status, capacity_cbm, note, payload, updated_at)
      values (${item.locationCode}, ${item.warehouseCode}, ${item.zone}, ${item.status}, ${item.capacityCbm ?? null}, ${item.note ?? null}, ${sql.json(item)}, ${item.updatedAt})
      on conflict (location_code) do update set
        warehouse_code = excluded.warehouse_code,
        zone = excluded.zone,
        status = excluded.status,
        capacity_cbm = excluded.capacity_cbm,
        note = excluded.note,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.inventoryBalances) {
    const balance = normalizeInventoryBalance(item);
    await sql`
      insert into warehouse_inventory_balances (
        id, customer_code, sku_code, warehouse_code, location_code, available_qty, reserved_qty, frozen_qty, defective_qty, inbound_qty, alert_qty, aging_days, updated_at
      )
      values (
        ${balance.id}, ${balance.customerCode}, ${balance.skuCode}, ${balance.warehouseCode}, ${balance.locationCode ?? null}, ${balance.availableQty}, ${balance.reservedQty},
        ${balance.frozenQty}, ${balance.defectiveQty}, ${balance.inboundQty}, ${balance.alertQty}, ${balance.agingDays}, ${balance.updatedAt}
      )
      on conflict (id) do update set
        customer_code = excluded.customer_code,
        sku_code = excluded.sku_code,
        warehouse_code = excluded.warehouse_code,
        location_code = excluded.location_code,
        available_qty = excluded.available_qty,
        reserved_qty = excluded.reserved_qty,
        frozen_qty = excluded.frozen_qty,
        defective_qty = excluded.defective_qty,
        inbound_qty = excluded.inbound_qty,
        alert_qty = excluded.alert_qty,
        aging_days = excluded.aging_days,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.inventoryLots) {
    await sql`
      insert into warehouse_inventory_lots (
        id, customer_code, sku_code, warehouse_code, lot_no, expiry_date, status, quantity, available_qty, reserved_qty, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.skuCode}, ${item.warehouseCode}, ${item.lotNo}, ${item.expiryDate ?? null}, ${item.status},
        ${item.quantity}, ${item.availableQty}, ${item.reservedQty}, ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        customer_code = excluded.customer_code,
        sku_code = excluded.sku_code,
        warehouse_code = excluded.warehouse_code,
        lot_no = excluded.lot_no,
        expiry_date = excluded.expiry_date,
        status = excluded.status,
        quantity = excluded.quantity,
        available_qty = excluded.available_qty,
        reserved_qty = excluded.reserved_qty,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.inventoryMovements) {
    await sql`
      insert into warehouse_inventory_movements (
        id, customer_code, sku_code, ref_type, ref_id, movement_type, quantity, before_qty, after_qty, note, occurred_at, operator
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.skuCode}, ${item.refType}, ${item.refId}, ${item.movementType}, ${item.quantity},
        ${item.beforeQty ?? null}, ${item.afterQty ?? null}, ${item.note ?? null}, ${item.occurredAt}, ${item.operator}
      )
      on conflict (id) do nothing
    `;
  }

  for (const item of data.inventoryAdjustments) {
    await sql`
      insert into warehouse_inventory_adjustments (
        id, customer_code, sku_code, warehouse_code, status, available_delta, reserved_delta, alert_qty, aging_days, reason,
        requested_by, requested_by_role, requested_at, reviewed_by, reviewed_at, review_note, payload
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.skuCode}, ${item.warehouseCode}, ${item.status}, ${item.availableDelta}, ${item.reservedDelta},
        ${item.alertQty ?? null}, ${item.agingDays ?? null}, ${item.reason}, ${item.requestedBy}, ${item.requestedByRole}, ${item.requestedAt},
        ${item.reviewedBy ?? null}, ${item.reviewedAt ?? null}, ${item.reviewNote ?? null}, ${sql.json(item)}
      )
      on conflict (id) do update set
        status = excluded.status,
        available_delta = excluded.available_delta,
        reserved_delta = excluded.reserved_delta,
        alert_qty = excluded.alert_qty,
        aging_days = excluded.aging_days,
        reason = excluded.reason,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at,
        review_note = excluded.review_note,
        payload = excluded.payload
    `;
  }

  for (const item of data.replenishmentPlans) {
    await sql`
      insert into warehouse_replenishment_plans (
        id, customer_code, sku_code, target_warehouse_code, status, planned_qty, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.skuCode}, ${item.targetWarehouseCode}, ${item.status}, ${item.plannedQty},
        ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        status = excluded.status,
        planned_qty = excluded.planned_qty,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.transferOrders) {
    await sql`
      insert into warehouse_transfer_orders (
        id, customer_code, sku_code, from_warehouse_code, to_warehouse_code, status, quantity, received_qty, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.skuCode}, ${item.fromWarehouseCode}, ${item.toWarehouseCode}, ${item.status}, ${item.quantity},
        ${item.receivedQty}, ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        status = excluded.status,
        quantity = excluded.quantity,
        received_qty = excluded.received_qty,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.purchaseReceipts) {
    await sql`
      insert into warehouse_purchase_receipts (
        id, customer_code, supplier_name, warehouse_code, status, total_expected_qty, total_received_qty, total_putaway_qty,
        tracking_number, expected_arrival_date, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.supplierName}, ${item.warehouseCode}, ${item.status}, ${item.totalExpectedQty},
        ${item.totalReceivedQty}, ${item.totalPutawayQty}, ${item.trackingNumber ?? null}, ${item.expectedArrivalDate ?? null},
        ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        customer_code = excluded.customer_code,
        supplier_name = excluded.supplier_name,
        warehouse_code = excluded.warehouse_code,
        status = excluded.status,
        total_expected_qty = excluded.total_expected_qty,
        total_received_qty = excluded.total_received_qty,
        total_putaway_qty = excluded.total_putaway_qty,
        tracking_number = excluded.tracking_number,
        expected_arrival_date = excluded.expected_arrival_date,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.stocktakeBatches) {
    await sql`
      insert into warehouse_stocktake_batches (
        id, warehouse_code, customer_code, status, item_count, difference_count, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.warehouseCode}, ${item.customerCode ?? null}, ${item.status}, ${item.itemCount}, ${item.differenceCount},
        ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        status = excluded.status,
        item_count = excluded.item_count,
        difference_count = excluded.difference_count,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.outboundOrders) {
    await sql`
      insert into warehouse_outbound_orders (
        id, customer_code, channel, order_count, status, recipient_name, delivery_address, requested_ship_date, note, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.channel}, ${item.orderCount}, ${item.status}, ${item.recipientName ?? null}, ${item.deliveryAddress ?? null},
        ${item.requestedShipDate ?? null}, ${item.note ?? null}, ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        customer_code = excluded.customer_code,
        channel = excluded.channel,
        order_count = excluded.order_count,
        status = excluded.status,
        recipient_name = excluded.recipient_name,
        delivery_address = excluded.delivery_address,
        requested_ship_date = excluded.requested_ship_date,
        note = excluded.note,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.returnOrders) {
    await sql`
      insert into warehouse_return_orders (
        id, customer_code, platform, original_order_no, buyer_return_tracking, status, return_reason, expected_arrival_date, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.platform}, ${item.originalOrderNo ?? null}, ${item.buyerReturnTracking ?? null}, ${item.status},
        ${item.returnReason}, ${item.expectedArrivalDate ?? null}, ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        customer_code = excluded.customer_code,
        platform = excluded.platform,
        original_order_no = excluded.original_order_no,
        buyer_return_tracking = excluded.buyer_return_tracking,
        status = excluded.status,
        return_reason = excluded.return_reason,
        expected_arrival_date = excluded.expected_arrival_date,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }

  for (const item of data.billingRecords) {
    await sql`
      insert into warehouse_billing_records (
        id, customer_code, ref_type, ref_id, status, currency, amount, due_date, title, note, customer_message, customer_confirmed_at,
        payment_reference, payment_note, payment_submitted_at, reviewed_by, reviewed_at, review_note, payload, created_at, updated_at
      )
      values (
        ${item.id}, ${item.customerCode}, ${item.refType}, ${item.refId}, ${item.status}, ${item.currency}, ${item.amount}, ${item.dueDate ?? null},
        ${item.title}, ${item.note ?? null}, ${item.customerMessage ?? null}, ${item.customerConfirmedAt ?? null}, ${item.paymentReference ?? null},
        ${item.paymentNote ?? null}, ${item.paymentSubmittedAt ?? null}, ${item.reviewedBy ?? null}, ${item.reviewedAt ?? null}, ${item.reviewNote ?? null},
        ${sql.json(item)}, ${item.createdAt}, ${item.updatedAt ?? null}
      )
      on conflict (id) do update set
        status = excluded.status,
        amount = excluded.amount,
        due_date = excluded.due_date,
        title = excluded.title,
        note = excluded.note,
        customer_message = excluded.customer_message,
        customer_confirmed_at = excluded.customer_confirmed_at,
        payment_reference = excluded.payment_reference,
        payment_note = excluded.payment_note,
        payment_submitted_at = excluded.payment_submitted_at,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at,
        review_note = excluded.review_note,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `;
  }
}

async function readCoreData() {
  if (hasPostgresConfig()) return readPostgresCoreData();

  try {
    const raw = await readFile(coreStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WarehouseCoreData>;
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      skus: Array.isArray(parsed.skus) ? parsed.skus : [],
      inventoryBalances: Array.isArray(parsed.inventoryBalances) ? parsed.inventoryBalances.map((item) => normalizeInventoryBalance(item)) : [],
      inventoryLots: Array.isArray(parsed.inventoryLots) ? parsed.inventoryLots : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      inventoryMovements: Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements : [],
      inventoryAdjustments: Array.isArray(parsed.inventoryAdjustments) ? parsed.inventoryAdjustments : [],
      replenishmentPlans: Array.isArray(parsed.replenishmentPlans) ? parsed.replenishmentPlans : [],
      transferOrders: Array.isArray(parsed.transferOrders) ? parsed.transferOrders : [],
      purchaseReceipts: Array.isArray(parsed.purchaseReceipts) ? parsed.purchaseReceipts : [],
      stocktakeBatches: Array.isArray(parsed.stocktakeBatches) ? parsed.stocktakeBatches : [],
      outboundOrders: Array.isArray(parsed.outboundOrders) ? parsed.outboundOrders : [],
      returnOrders: Array.isArray(parsed.returnOrders) ? parsed.returnOrders : [],
      billingRecords: Array.isArray(parsed.billingRecords) ? parsed.billingRecords : [],
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return seedCoreData();
    if (error instanceof SyntaxError) return seedCoreData();
    throw error;
  }
}

async function writeCoreData(data: WarehouseCoreData) {
  if (hasPostgresConfig()) {
    await writePostgresCoreData(data);
    return;
  }

  await mkdir(path.dirname(coreStorePath), { recursive: true });
  await writeFile(coreStorePath, JSON.stringify(data, null, 2), "utf8");
}

export async function getWarehouseCoreData() {
  const data = await readCoreData();
  await writeCoreData(data);
  return data;
}

export async function restoreWarehouseCoreData(data: WarehouseCoreData) {
  await writeCoreData(data);
  return data;
}

export async function getWarehouseCoreDataForCustomer(customerCode: string) {
  const data = await getWarehouseCoreData();
  return {
    customer: data.customers.find((item) => item.customerCode === customerCode) ?? null,
    skus: data.skus.filter((item) => item.customerCode === customerCode),
    inventoryBalances: data.inventoryBalances.filter((item) => item.customerCode === customerCode),
    inventoryLots: data.inventoryLots.filter((item) => item.customerCode === customerCode),
    inventoryMovements: data.inventoryMovements.filter((item) => item.customerCode === customerCode),
    inventoryAdjustments: data.inventoryAdjustments.filter((item) => item.customerCode === customerCode),
    replenishmentPlans: data.replenishmentPlans.filter((item) => item.customerCode === customerCode),
    transferOrders: data.transferOrders.filter((item) => item.customerCode === customerCode),
    purchaseReceipts: data.purchaseReceipts.filter((item) => item.customerCode === customerCode),
    stocktakeBatches: data.stocktakeBatches.filter((item) => item.customerCode === customerCode || item.items.some((line) => line.customerCode === customerCode)),
    outboundOrders: data.outboundOrders.filter((item) => item.customerCode === customerCode),
    returnOrders: data.returnOrders.filter((item) => item.customerCode === customerCode),
    billingRecords: data.billingRecords.filter((item) => item.customerCode === customerCode),
  };
}

type CustomerCreditRiskSource = Pick<WarehouseCoreData, "billingRecords"> & {
  customer?: CustomerProfile | null;
  customers?: CustomerProfile[];
};

export function evaluateCustomerCreditRisk(data: CustomerCreditRiskSource, customerCode: string): CustomerCreditRisk {
  const cleanCustomerCode = customerCode.trim();
  const customer =
    data.customer?.customerCode === cleanCustomerCode
      ? data.customer
      : data.customers?.find((item) => item.customerCode === cleanCustomerCode);
  const openRecords = data.billingRecords.filter((record) => record.customerCode === cleanCustomerCode && record.status !== "paid");
  const nowMs = Date.now();
  const overdueRecords = openRecords.filter((record) => record.dueDate && new Date(`${record.dueDate}T23:59:59`).getTime() < nowMs && record.status !== "payment_submitted");
  const outstandingAmount = roundMoney(openRecords.reduce((sum, record) => sum + record.amount, 0));
  const overdueAmount = roundMoney(overdueRecords.reduce((sum, record) => sum + record.amount, 0));
  const creditLimit = typeof customer?.creditLimit === "number" ? customer.creditLimit : undefined;
  const creditRemaining = typeof creditLimit === "number" ? roundMoney(creditLimit - outstandingAmount) : undefined;
  const reasons: string[] = [];

  if (customer?.status === "paused") reasons.push("客户账号已暂停，请联系运营处理后再提交新的出库申请");
  if (customer?.billingCycle === "prepaid" && outstandingAmount > 0) reasons.push(`预付客户仍有未结清费用 £${outstandingAmount.toFixed(2)}`);
  if (overdueAmount > 0) reasons.push(`存在逾期账单 £${overdueAmount.toFixed(2)}，请先完成付款或提交付款凭证`);
  if (typeof creditRemaining === "number" && creditRemaining < 0) reasons.push(`已超出信用额度 £${Math.abs(creditRemaining).toFixed(2)}`);

  const blocked = reasons.length > 0;
  const warningReasons: string[] = [];
  if (!blocked && outstandingAmount > 0) warningReasons.push(`当前未结费用 £${outstandingAmount.toFixed(2)}`);
  if (!blocked && typeof creditRemaining === "number" && creditLimit && creditRemaining / creditLimit <= 0.2) warningReasons.push(`信用额度剩余 £${creditRemaining.toFixed(2)}，建议关注账期`);

  return {
    status: blocked ? "blocked" : warningReasons.length > 0 ? "warning" : "clear",
    customerCode: cleanCustomerCode,
    outstandingAmount,
    overdueAmount,
    overdueCount: overdueRecords.length,
    creditLimit,
    creditRemaining,
    billingCycle: customer?.billingCycle,
    paymentTermDays: customer?.paymentTermDays,
    reasons: blocked ? reasons : warningReasons,
    checkedAt: new Date().toISOString(),
  };
}

export async function getCustomerCreditRisk(customerCode: string) {
  const data = await getWarehouseCoreData();
  return evaluateCustomerCreditRisk(data, customerCode);
}

export async function upsertWarehouseCustomer(profile: CustomerProfile) {
  const data = await getWarehouseCoreData();
  const index = data.customers.findIndex((item) => item.customerCode === profile.customerCode);
  if (index >= 0) {
    data.customers[index] = { ...data.customers[index], ...profile, updatedAt: now() };
  } else {
    data.customers.unshift({ ...profile, updatedAt: now() });
  }
  await writeCoreData(data);
  return profile;
}

export async function updateWarehouseCustomerProfile(
  customerCode: string,
  profile: Partial<Pick<CustomerProfile, "companyName" | "contactName" | "phone" | "email" | "vatNumber" | "eoriNumber" | "platforms" | "storeUrl" | "businessAddress" | "status" | "paymentTermDays" | "creditLimit" | "billingCycle">>,
) {
  const data = await getWarehouseCoreData();
  const index = data.customers.findIndex((item) => item.customerCode === customerCode);
  if (index < 0) return null;

  data.customers[index] = {
    ...data.customers[index],
    ...profile,
    platforms: profile.platforms ?? data.customers[index].platforms,
    updatedAt: now(),
  };
  await writeCoreData(data);
  return data.customers[index];
}

export async function createWarehouseSku({
  customerCode,
  skuCode,
  productName,
  barcode,
  category,
  alertQty = 0,
}: {
  customerCode: string;
  skuCode: string;
  productName: string;
  barcode?: string;
  category?: string;
  alertQty?: number;
}) {
  const data = await getWarehouseCoreData();
  const normalizedSku = skuCode.trim().toUpperCase();
  if (!normalizedSku || !productName.trim()) return null;
  if (data.skus.some((item) => item.customerCode === customerCode && item.skuCode === normalizedSku)) {
    throw new Error("SKU_ALREADY_EXISTS");
  }

  const updatedAt = now();
  const sku: WarehouseSku = {
    skuCode: normalizedSku,
    customerCode,
    productName: productName.trim(),
    barcode: barcode?.trim() || undefined,
    category: category?.trim() || undefined,
    status: "active",
  };

  data.skus.unshift(sku);
  data.inventoryBalances.unshift({
    id: `BAL-${normalizedSku}`,
    customerCode,
    skuCode: normalizedSku,
    warehouseCode: "SHEFFIELD-MAIN",
    availableQty: 0,
    reservedQty: 0,
    frozenQty: 0,
    defectiveQty: 0,
    inboundQty: 0,
    alertQty,
    agingDays: 0,
    updatedAt,
  });

  await writeCoreData(data);
  return sku;
}

function parseCsvRow(row: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if ((char === "," || char === "\t" || char === "|") && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseNonNegativeInt(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export async function importCustomerSkusCsv(customerCode: string, csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstRow = parseCsvRow(lines[0] ?? "").map((cell) => cell.toLowerCase().replace(/\s+/g, ""));
  const hasHeader = firstRow.some((cell) =>
    ["skucode", "sku", "productname", "product_name", "barcode", "category", "alertqty", "alert_qty", "sku编码", "商品编码", "商品名称", "条码", "商品分类", "预警库存"].includes(cell),
  );
  const rows = hasHeader ? lines.slice(1) : lines;
  const data = await getWarehouseCoreData();
  const updatedAt = now();
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const [rawSku = "", productName = "", barcode = "", category = "", alertQty = "0"] = parseCsvRow(row);
    const skuCode = rawSku.trim().toUpperCase();
    if (!skuCode || !productName.trim()) {
      errors.push(`第 ${index + 1} 行缺少 SKU 编码或商品名称`);
      return;
    }

    const existingSku = data.skus.find((item) => item.customerCode === customerCode && item.skuCode === skuCode);
    if (existingSku) {
      existingSku.productName = productName.trim();
      existingSku.barcode = barcode.trim() || undefined;
      existingSku.category = category.trim() || undefined;
      existingSku.status = "active";
      updated += 1;
    } else {
      data.skus.unshift({
        skuCode,
        customerCode,
        productName: productName.trim(),
        barcode: barcode.trim() || undefined,
        category: category.trim() || undefined,
        status: "active",
      });
      imported += 1;
    }

    let balance = data.inventoryBalances.find((item) => item.customerCode === customerCode && item.skuCode === skuCode);
    if (!balance) {
      balance = {
        id: `BAL-${customerCode}-${skuCode}`,
        customerCode,
        skuCode,
        warehouseCode: "SHEFFIELD-MAIN",
        availableQty: 0,
        reservedQty: 0,
        frozenQty: 0,
        defectiveQty: 0,
        inboundQty: 0,
        alertQty: parseNonNegativeInt(alertQty),
        agingDays: 0,
        updatedAt,
      };
      data.inventoryBalances.unshift(balance);
    } else if (alertQty.trim()) {
      balance.alertQty = parseNonNegativeInt(alertQty);
      balance.updatedAt = updatedAt;
    }
  });

  await writeCoreData(data);
  return { imported, updated, errors };
}

export async function batchUpdateCoreOutboundOrderStatus({
  ids,
  status,
  operator,
  note,
}: {
  ids: string[];
  status: CoreOutboundOrder["status"];
  operator: string;
  note?: string;
}) {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  const updated: CoreOutboundOrder[] = [];
  const missing: string[] = [];

  for (const id of uniqueIds) {
    const order = await updateCoreOutboundOrderStatus({ id, status, operator, note });
    if (order) updated.push(order);
    else missing.push(id);
  }

  return { updated, missing };
}

export async function assignOutboundWorkMode({
  id,
  workMode,
  assignedPicker,
  basketNo,
  operator,
  note,
}: {
  id: string;
  workMode?: OutboundWorkMode;
  assignedPicker?: string;
  basketNo?: string;
  operator: string;
  note?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = data.outboundOrders[index];
  const updatedAt = now();
  const nextMode = workMode ?? inferOutboundWorkMode(current);
  const nextPickWaveNo = current.pickWaveNo || makeDailySequence(nextMode === "single_item_batch" ? "DW" : nextMode === "cart_sort" ? "PL" : "OP");
  const nextPickListNo = current.pickListNo || makeDailySequence("PICK");
  const nextBasketNo = basketNo?.trim() || current.basketNo || (nextMode === "cart_sort" ? `B-${Math.floor(100 + Math.random() * 900)}` : undefined);
  const detail = [
    `模式：${outboundWorkModeLabel(nextMode)}`,
    `波次：${nextPickWaveNo}`,
    nextBasketNo ? `篮号：${nextBasketNo}` : "",
    note?.trim() || "",
  ].filter(Boolean).join("；");

  data.outboundOrders[index] = {
    ...current,
    workMode: nextMode,
    pickWaveNo: nextPickWaveNo,
    pickListNo: nextPickListNo,
    assignedPicker: assignedPicker?.trim() || current.assignedPicker || operator,
    basketNo: nextBasketNo,
    status: current.status === "pending_review" ? "picking" : current.status,
    note: note?.trim() || current.note,
    operationLogs: appendOutboundOperationLog(current, {
      action: "work_mode_assigned",
      label: "已生成下架/拣货任务",
      detail,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return data.outboundOrders[index];
}

export type OutboundPickWaveStrategy = "single_wave" | "work_mode" | "carrier" | "channel" | "cutoff_time" | "warehouse_zone" | "sku_heat";

function skuHeatBucket(order: Pick<CoreOutboundOrder, "skuLines" | "orderCount">) {
  const totalQty = order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const skuCount = order.skuLines?.length ?? 0;
  if (skuCount <= 1 && totalQty >= 10) return "爆款单品";
  if (skuCount <= 2 && totalQty >= Math.max(3, order.orderCount)) return "高频 SKU";
  if (skuCount >= 6) return "多 SKU 订单";
  return "常规 SKU";
}

function outboundZoneBucket(order: Pick<CoreOutboundOrder, "skuLines">, data: WarehouseCoreData) {
  const zones = new Set<string>();
  for (const line of order.skuLines ?? []) {
    data.inventoryBalances
      .filter((balance) => balance.skuCode === line.skuCode && balance.availableQty > 0)
      .forEach((balance) => {
        const location = data.locations.find((item) => item.locationCode === balance.locationCode);
        zones.add(location?.zone || location?.zoneType || balance.locationCode?.split("-")[0] || "未分区");
      });
  }
  if (zones.size === 0) return "未分区";
  if (zones.size > 2) return "跨区拣货";
  return Array.from(zones).sort().join("+");
}

function cutoffBucket(order: CoreOutboundOrder) {
  const timestamp = order.updatedAt || order.createdAt;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "截单时间待确认";
  const hour = date.getHours();
  if (hour < 12) return "上午截单";
  if (hour < 16) return "下午截单";
  return "晚间截单";
}

function pickWaveGroupKey(order: CoreOutboundOrder, mode: OutboundWorkMode, strategy: OutboundPickWaveStrategy, data: WarehouseCoreData) {
  if (strategy === "single_wave") return "全部订单";
  if (strategy === "carrier") return order.carrierServiceCode || order.carrierName || order.channel || "未匹配渠道";
  if (strategy === "channel") return order.channel || order.carrierName || "未填写渠道";
  if (strategy === "cutoff_time") return cutoffBucket(order);
  if (strategy === "warehouse_zone") return outboundZoneBucket(order, data);
  if (strategy === "sku_heat") return skuHeatBucket(order);
  return mode;
}

export async function batchGenerateOutboundPickWaves({
  ids,
  operator,
  strategy = "work_mode",
  assignedPicker,
  note,
}: {
  ids: string[];
  operator: string;
  strategy?: OutboundPickWaveStrategy;
  assignedPicker?: string;
  note?: string;
}) {
  const data = await getWarehouseCoreData();
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  const updated: CoreOutboundOrder[] = [];
  const missing: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const waveByGroup = new Map<string, string>();
  const updatedAt = now();

  for (const id of uniqueIds) {
    const index = data.outboundOrders.findIndex((item) => item.id === id);
    if (index < 0) {
      missing.push(id);
      continue;
    }

    const current = data.outboundOrders[index];
    if (current.status === "shipped") {
      skipped.push({ id, reason: "出库单已发货" });
      continue;
    }
    if (current.status === "blocked") {
      skipped.push({ id, reason: "出库单处于异常阻塞" });
      continue;
    }

    const mode = current.workMode ?? inferOutboundWorkMode(current);
    const groupKey = pickWaveGroupKey(current, mode, strategy, data);
    const wavePrefix = mode === "single_item_batch" ? "DW" : mode === "cart_sort" ? "PL" : "OP";
    const nextPickWaveNo = current.pickWaveNo || waveByGroup.get(groupKey) || makeDailySequence(wavePrefix);
    waveByGroup.set(groupKey, nextPickWaveNo);
    const nextPickListNo = current.pickListNo || makeDailySequence("PICK");
    const nextBasketNo = current.basketNo || (mode === "cart_sort" ? `B-${Math.floor(100 + Math.random() * 900)}` : undefined);
    const detail = [
      `策略：${strategy}`,
      `分组：${groupKey}`,
      `模式：${outboundWorkModeLabel(mode)}`,
      `波次：${nextPickWaveNo}`,
      nextBasketNo ? `篮号：${nextBasketNo}` : "",
      note?.trim() || "",
    ].filter(Boolean).join("；");

    const nextOrder: CoreOutboundOrder = {
      ...current,
      workMode: mode,
      pickWaveNo: nextPickWaveNo,
      pickListNo: nextPickListNo,
      assignedPicker: assignedPicker?.trim() || current.assignedPicker || operator,
      basketNo: nextBasketNo,
      status: current.status === "pending_review" ? "picking" : current.status,
      operationLogs: appendOutboundOperationLog(current, {
        action: "work_mode_assigned",
        label: "批量生成拣货波次",
        detail,
        operator,
        occurredAt: updatedAt,
      }),
      updatedAt,
    };
    data.outboundOrders[index] = nextOrder;
    updated.push(nextOrder);
  }

  await writeCoreData(data);
  return {
    updated,
    missing,
    skipped,
    waves: Array.from(waveByGroup.entries()).map(([groupKey, waveNo]) => ({ groupKey, waveNo })),
  };
}

export function getCarrierRateRules() {
  return carrierRateRules.filter((rule) => rule.active);
}

export function suggestCarrierServiceForOutbound(order: Pick<CoreOutboundOrder, "channel" | "deliveryAddress" | "packageWeightKg" | "skuLines" | "orderCount">): CarrierRateRule {
  const text = `${order.channel || ""} ${order.deliveryAddress || ""}`.toLowerCase();
  const weight = estimateOutboundWeight(order as CoreOutboundOrder, order.packageWeightKg);

  if (text.includes("fba") || text.includes("amazon") || text.includes("customer arranged") || text.includes("manual")) return resolveCarrierRule("manual", order.channel);
  if (text.includes("next day") || text.includes("express") || text.includes("urgent") || text.includes("dpd")) return resolveCarrierRule("dpd_next_day", order.channel);
  if (text.includes("economy") || text.includes("evri")) return resolveCarrierRule("evri_standard", order.channel);
  if (weight > 5) return resolveCarrierRule("dpd_next_day", order.channel);
  if (weight <= 1) return resolveCarrierRule("royal_mail_48", order.channel);
  return resolveCarrierRule(undefined, order.channel);
}

function serviceCodeFromConfiguredChannel(config: CarrierRulePreference): CarrierServiceCode | undefined {
  const text = `${config.carrierName || ""} ${config.serviceName || ""}`.toLowerCase();
  if (text.includes("dpd")) return "dpd_next_day";
  if (text.includes("evri") || text.includes("hermes")) return "evri_standard";
  if (text.includes("royal") && text.includes("24")) return "royal_mail_24";
  if (text.includes("royal") || text.includes("tracked 48") || text.includes("48")) return "royal_mail_48";
  if (text.includes("manual") || text.includes("人工") || text.includes("客户")) return "manual";
  return undefined;
}

function activeCarrierConfigs(configs: CarrierRulePreference[] = []) {
  return configs.filter((item) => item.status === "active" || item.status === "sandbox");
}

function carrierConfigForRule(rule: CarrierRateRule, configs: CarrierRulePreference[] = []) {
  return activeCarrierConfigs(configs).find((config) => serviceCodeFromConfiguredChannel(config) === rule.serviceCode);
}

function ruleText(config?: CarrierRulePreference) {
  return (config?.surchargeRules ?? []).join("\n").toLowerCase();
}

function extractPostcodePrefix(address?: string) {
  const normalized = (address ?? "").toUpperCase().match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/)?.[0]?.replace(/\s+/g, "");
  return normalized?.match(/^[A-Z]+/)?.[0] ?? "";
}

function parseMoneyFromRule(rule: string, fallback: number) {
  const matched = rule.match(/(?:£|gbp)?\s*(\d+(?:\.\d+)?)/i);
  return matched ? Number(matched[1]) : fallback;
}

function parsePercentFromRule(rule: string, fallback: number) {
  const matched = rule.match(/(\d+(?:\.\d+)?)\s*%/);
  return matched ? Number(matched[1]) / 100 : fallback;
}

function carrierRuleBlocksOrder(order: Pick<CoreOutboundOrder, "customerCode" | "channel" | "deliveryAddress">, rule: CarrierRateRule, config?: CarrierRulePreference) {
  const lines = (config?.surchargeRules ?? []).filter((item) => /黑名单|blacklist/i.test(item));
  const haystack = `${order.customerCode} ${order.channel ?? ""} ${order.deliveryAddress ?? ""} ${rule.carrierName} ${rule.serviceName}`.toLowerCase();
  for (const line of lines) {
    const [, rawList = ""] = line.split(/[:：=]/);
    const tokens = rawList
      .split(/[,\n\r;；、]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length > 0 && tokens.some((token) => haystack.includes(token))) return `命中渠道黑名单：${tokens.join("、")}`;
  }
  return "";
}

function evaluateCarrierRules(
  order: Pick<CoreOutboundOrder, "customerCode" | "channel" | "deliveryAddress" | "packageWeightKg" | "packageCount" | "skuLines" | "orderCount">,
  rule: CarrierRateRule,
  baseAmount: number,
  weightKg: number,
  parcels: number,
  configs: CarrierRulePreference[] = [],
): CarrierRuleEvaluation {
  const config = carrierConfigForRule(rule, configs);
  const text = ruleText(config);
  const notes: string[] = [];
  const blockedReason = carrierRuleBlocksOrder(order, rule, config);
  if (blockedReason) return { surchargeAmount: 0, notes: [blockedReason], blocked: true, blockedReason };

  let surchargeAmount = 0;
  const postcodePrefix = extractPostcodePrefix(order.deliveryAddress);
  const remotePrefixes = ["AB", "BT", "DD", "FK", "HS", "IV", "KA", "KW", "PA", "PH", "ZE", "IM", "GY", "JE"];
  if ((text.includes("偏远") || text.includes("remote")) && postcodePrefix && remotePrefixes.includes(postcodePrefix)) {
    const remoteRule = (config?.surchargeRules ?? []).find((item) => /偏远|remote/i.test(item)) ?? "";
    const fee = parseMoneyFromRule(remoteRule, 2.8);
    surchargeAmount += fee;
    notes.push(`偏远地区附加费 £${fee.toFixed(2)}（${postcodePrefix}）`);
  }

  if (text.includes("燃油") || text.includes("fuel")) {
    const fuelRule = (config?.surchargeRules ?? []).find((item) => /燃油|fuel/i.test(item)) ?? "";
    const rate = parsePercentFromRule(fuelRule, 0.06);
    const fee = Math.round(baseAmount * rate * 100) / 100;
    if (fee > 0) {
      surchargeAmount += fee;
      notes.push(`燃油附加费 ${(rate * 100).toFixed(1)}%：£${fee.toFixed(2)}`);
    }
  }

  if ((text.includes("超尺寸") || text.includes("oversize")) && (weightKg > 10 || parcels > 1)) {
    const oversizeRule = (config?.surchargeRules ?? []).find((item) => /超尺寸|oversize/i.test(item)) ?? "";
    const fee = parseMoneyFromRule(oversizeRule, 2.5);
    surchargeAmount += fee;
    notes.push(`超尺寸/多包裹附加费 £${fee.toFixed(2)}`);
  }

  return { surchargeAmount: Math.round(surchargeAmount * 100) / 100, notes, blocked: false };
}

export function suggestCarrierServiceFromConfiguredRules(
  order: Pick<CoreOutboundOrder, "channel" | "deliveryAddress" | "packageWeightKg" | "skuLines" | "orderCount" | "customerCode">,
  configs: CarrierRulePreference[] = [],
): CarrierRateRule {
  const activeConfigs = activeCarrierConfigs(configs);
  const text = `${order.channel || ""} ${order.deliveryAddress || ""}`.toLowerCase();
  const preferred = activeConfigs.find((item) => {
    const serviceCode = serviceCodeFromConfiguredChannel(item);
    const candidateRule = serviceCode ? resolveCarrierRule(serviceCode, order.channel) : null;
    if (candidateRule && carrierRuleBlocksOrder(order, candidateRule, item)) return false;
    const configText = `${item.carrierName || ""} ${item.serviceName || ""} ${(item.enabledFeatures ?? []).join(" ")} ${(item.surchargeRules ?? []).join(" ")}`.toLowerCase();
    if (text.includes("dpd") && configText.includes("dpd")) return true;
    if ((text.includes("evri") || text.includes("economy")) && (configText.includes("evri") || configText.includes("economy"))) return true;
    if ((text.includes("royal") || text.includes("tracked")) && configText.includes("royal")) return true;
    if ((text.includes("manual") || text.includes("fba") || text.includes("amazon")) && (configText.includes("manual") || configText.includes("人工") || configText.includes("客户"))) return true;
    return false;
  }) ?? activeConfigs.find((item) => {
    const serviceCode = serviceCodeFromConfiguredChannel(item);
    const candidateRule = serviceCode ? resolveCarrierRule(serviceCode, order.channel) : null;
    return !candidateRule || !carrierRuleBlocksOrder(order, candidateRule, item);
  });
  const configuredServiceCode = preferred ? serviceCodeFromConfiguredChannel(preferred) : undefined;
  return configuredServiceCode ? resolveCarrierRule(configuredServiceCode, order.channel) : suggestCarrierServiceForOutbound(order);
}

function resolveCarrierRule(serviceCode?: string, channel?: string) {
  const normalized = serviceCode?.trim() as CarrierServiceCode | undefined;
  if (normalized) {
    const matched = carrierRateRules.find((rule) => rule.serviceCode === normalized && rule.active);
    if (matched) return matched;
  }

  const text = channel?.toLowerCase() ?? "";
  if (text.includes("dpd")) return carrierRateRules.find((rule) => rule.serviceCode === "dpd_next_day") ?? carrierRateRules[0];
  if (text.includes("evri")) return carrierRateRules.find((rule) => rule.serviceCode === "evri_standard") ?? carrierRateRules[0];
  if (text.includes("24")) return carrierRateRules.find((rule) => rule.serviceCode === "royal_mail_24") ?? carrierRateRules[0];
  if (text.includes("manual") || text.includes("fba")) return carrierRateRules.find((rule) => rule.serviceCode === "manual") ?? carrierRateRules[0];
  return carrierRateRules.find((rule) => rule.serviceCode === "royal_mail_48") ?? carrierRateRules[0];
}

function estimateOutboundWeight(order: CoreOutboundOrder, packageWeightKg?: number) {
  if (typeof packageWeightKg === "number" && Number.isFinite(packageWeightKg) && packageWeightKg > 0) return Math.round(packageWeightKg * 100) / 100;
  const quantity = order.skuLines?.reduce((total, line) => total + line.quantity, 0) ?? order.orderCount;
  return Math.max(0.2, Math.round(quantity * 0.22 * 100) / 100);
}

function calculateCarrierRate(order: CoreOutboundOrder, rule: CarrierRateRule, packageWeightKg?: number, packageCount?: number, carrierConfigs: CarrierRulePreference[] = []) {
  const weightKg = estimateOutboundWeight(order, packageWeightKg);
  const parcels = Math.max(1, Math.floor(packageCount || order.packageCount || 1));
  const overweight = weightKg > rule.maxWeightKg;
  const baseAmount = rule.serviceCode === "manual" ? 0 : Math.round((rule.baseFee * parcels + rule.perKgFee * weightKg) * 100) / 100;
  const evaluation = evaluateCarrierRules(order, rule, baseAmount, weightKg, parcels, carrierConfigs);
  const amount = evaluation.blocked ? baseAmount : Math.round((baseAmount + evaluation.surchargeAmount) * 100) / 100;
  const warnings = [
    overweight ? `包裹重量 ${weightKg}kg 超过 ${rule.serviceName} 限重 ${rule.maxWeightKg}kg` : "",
    evaluation.blockedReason ?? "",
    ...evaluation.notes,
  ].filter(Boolean);
  return {
    serviceCode: rule.serviceCode,
    carrierName: rule.carrierName,
    serviceName: rule.serviceName,
    currency: rule.currency,
    amount,
    baseAmount,
    surchargeAmount: evaluation.surchargeAmount,
    weightKg,
    packageCount: parcels,
    etaDays: rule.etaDays,
    warning: warnings.join("；"),
    blocked: evaluation.blocked,
    ruleNotes: evaluation.notes,
  };
}

function parseSimpleCsv(csv: string) {
  const split = (line: string) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [] as string[], rows: [] as Record<string, string>[] };
  const headers = split(lines[0]);
  return {
    headers,
    rows: lines.slice(1).map((line) => {
      const cells = split(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    }),
  };
}

function csvRowValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const matched = Object.entries(row).find(([header]) => header.trim().toLowerCase() === key.trim().toLowerCase());
    if (matched) return matched[1].trim();
  }
  return "";
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export function outboundWeightImportTemplateRows() {
  return [
    ["出库单号", "包裹重量KG", "包裹数", "备注"],
    ["OUT-202606-0001", "1.25", "1", "打包台称重后导入，系统会重算预估运费"],
  ];
}

export async function importOutboundWeightsCsv({
  csv,
  operator,
  carrierConfigs,
}: {
  csv: string;
  operator: string;
  carrierConfigs?: CarrierRulePreference[];
}): Promise<OutboundWeightImportResult> {
  const parsed = parseSimpleCsv(csv);
  const data = await getWarehouseCoreData();
  const updatedAt = now();
  const issues: OutboundWeightImportIssue[] = [];
  const rows: OutboundWeightImportRow[] = [];

  parsed.rows.forEach((raw, index) => {
    const rowNo = index + 2;
    const outboundId = csvRowValue(raw, ["出库单号", "出库申请号", "订单号", "outboundId", "id", "orderId"]);
    const weight = positiveNumber(csvRowValue(raw, ["包裹重量KG", "重量KG", "称重KG", "packageWeightKg", "weightKg"]));
    const packageCount = positiveInteger(csvRowValue(raw, ["包裹数", "件数", "包裹件数", "packageCount", "parcels"]));
    const note = csvRowValue(raw, ["备注", "note", "remark"]);

    if (!outboundId) {
      issues.push({ row: rowNo, level: "error", message: "缺少出库单号" });
      rows.push({ row: rowNo, outboundId: "", status: "skipped", issue: "缺少出库单号" });
      return;
    }
    if (!weight) {
      issues.push({ row: rowNo, level: "error", message: "包裹重量必须大于 0" });
      rows.push({ row: rowNo, outboundId, status: "skipped", issue: "包裹重量必须大于 0" });
      return;
    }

    const orderIndex = data.outboundOrders.findIndex((item) => item.id === outboundId);
    if (orderIndex < 0) {
      issues.push({ row: rowNo, level: "error", message: "未找到出库单" });
      rows.push({ row: rowNo, outboundId, packageWeightKg: weight, packageCount, status: "skipped", issue: "未找到出库单" });
      return;
    }

    const order = data.outboundOrders[orderIndex];
    if (order.status === "shipped") {
      issues.push({ row: rowNo, level: "warning", message: "出库单已发货，跳过批量称重" });
      rows.push({ row: rowNo, outboundId, packageWeightKg: weight, packageCount, status: "skipped", issue: "出库单已发货" });
      return;
    }

    const rule = order.carrierServiceCode ? resolveCarrierRule(order.carrierServiceCode, order.channel) : suggestCarrierServiceFromConfiguredRules(order, carrierConfigs);
    const rate = calculateCarrierRate(order, rule, weight, packageCount ?? order.packageCount, carrierConfigs);
    const nextOrder: CoreOutboundOrder = {
      ...order,
      carrierServiceCode: rule.serviceCode,
      carrierName: rule.carrierName,
      carrierServiceName: rule.serviceName,
      packageWeightKg: rate.weightKg,
      packageCount: rate.packageCount,
      shippingFee: rate.amount,
      shippingFeeNote: [rate.warning, note].filter(Boolean).join("；") || order.shippingFeeNote,
      labelStatus: rate.blocked ? "failed" : order.labelStatus === "generated" ? "generated" : "rated",
      operationLogs: appendOutboundOperationLog(order, {
        action: "status_changed",
        label: "批量称重",
        detail: `重量 ${rate.weightKg}kg / 包裹 ${rate.packageCount} 件 / 预估运费 £${rate.amount.toFixed(2)}${rate.warning ? ` / ${rate.warning}` : ""}`,
        operator,
        occurredAt: updatedAt,
      }),
      updatedAt,
    };
    data.outboundOrders[orderIndex] = nextOrder;
    if (rate.blocked) issues.push({ row: rowNo, level: "warning", message: rate.warning || "命中渠道限制，面单已标记失败" });
    rows.push({
      row: rowNo,
      outboundId,
      packageWeightKg: rate.weightKg,
      packageCount: rate.packageCount,
      status: "updated",
      shippingFee: rate.amount,
      carrierName: rule.carrierName,
      carrierServiceName: rule.serviceName,
      issue: rate.warning || undefined,
    });
  });

  await writeCoreData(data);
  return {
    totalRows: parsed.rows.length,
    updatedRows: rows.filter((row) => row.status === "updated").length,
    skippedRows: rows.filter((row) => row.status === "skipped").length,
    issues,
    rows,
  };
}

function makeTrackingNumber(rule: CarrierRateRule, orderId: string) {
  const suffix = orderId.replace(/[^A-Z0-9]/gi, "").slice(-8).toUpperCase();
  const stamp = Date.now().toString().slice(-6);
  return `${rule.trackingPrefix}${suffix}${stamp}`;
}

function nextCarrierRetryAt(retryCount: number) {
  const delayMinutes = Math.min(120, Math.max(10, retryCount * 15));
  const date = new Date();
  date.setMinutes(date.getMinutes() + delayMinutes);
  return date.toISOString();
}

function carrierFailurePatch(current: CoreOutboundOrder, error: string, operator: string, triedAt: string) {
  const retryCount = (current.labelRetryCount ?? 0) + 1;
  return {
    labelFailureReason: error,
    labelRetryCount: retryCount,
    labelLastTriedAt: triedAt,
    labelLastTriedBy: operator,
    labelNextRetryAt: nextCarrierRetryAt(retryCount),
  };
}

function clearCarrierFailurePatch() {
  return {
    labelFailureReason: undefined,
    labelNextRetryAt: undefined,
    labelFallbackNote: undefined,
  };
}

function appendTrackingEvent(order: CoreOutboundOrder, event: Omit<OutboundTrackingEvent, "id">) {
  const trackingEvents = order.trackingEvents ?? [];
  return [
    {
      ...event,
      id: makeCoreId("TRK"),
    },
    ...trackingEvents,
  ];
}

function deductReservedOutboundInventory(data: WarehouseCoreData, order: CoreOutboundOrder, updatedAt: string, operator: string, note?: string) {
  order.skuLines?.forEach((line) => {
    const balance = data.inventoryBalances.find((item) => item.customerCode === order.customerCode && item.skuCode === line.skuCode);
    if (!balance) return;
    const beforeQty = balance.availableQty + balance.reservedQty;
    balance.reservedQty = Math.max(0, balance.reservedQty - line.quantity);
    balance.updatedAt = updatedAt;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: order.customerCode,
      skuCode: line.skuCode,
      refType: "outbound",
      refId: order.id,
      movementType: "out",
      quantity: line.quantity,
      beforeQty,
      afterQty: balance.availableQty + balance.reservedQty,
      note: note || "出库已交运，已扣减占用库存",
      occurredAt: updatedAt,
      operator,
    });
  });
}

function releaseReservedOutboundInventory(data: WarehouseCoreData, order: CoreOutboundOrder, updatedAt: string, operator: string, note?: string) {
  order.skuLines?.forEach((line) => {
    const balance = data.inventoryBalances.find((item) => item.customerCode === order.customerCode && item.skuCode === line.skuCode);
    if (!balance) return;
    const beforeQty = balance.availableQty + balance.reservedQty;
    const releaseQty = Math.min(balance.reservedQty, line.quantity);
    if (releaseQty <= 0) return;
    balance.reservedQty = Math.max(0, balance.reservedQty - releaseQty);
    balance.availableQty += releaseQty;
    balance.updatedAt = updatedAt;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: order.customerCode,
      skuCode: line.skuCode,
      refType: "outbound",
      refId: order.id,
      movementType: "release",
      quantity: releaseQty,
      beforeQty,
      afterQty: balance.availableQty + balance.reservedQty,
      note: note || "截单后释放预占库存并回库",
      occurredAt: updatedAt,
      operator,
    });
  });
}

export async function rateCoreOutboundShipment({
  id,
  serviceCode,
  packageWeightKg,
  packageCount,
  operator,
  carrierConfigs,
}: {
  id: string;
  serviceCode?: CarrierServiceCode;
  packageWeightKg?: number;
  packageCount?: number;
  operator: string;
  carrierConfigs?: CarrierRulePreference[];
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = data.outboundOrders[index];
  const rule = resolveCarrierRule(serviceCode, current.channel);
  const rate = calculateCarrierRate(current, rule, packageWeightKg, packageCount, carrierConfigs);
  const updatedAt = now();

  data.outboundOrders[index] = {
    ...current,
    carrierServiceCode: rule.serviceCode,
    carrierName: rule.carrierName,
    carrierServiceName: rule.serviceName,
    packageWeightKg: rate.weightKg,
    packageCount: rate.packageCount,
    shippingFee: rate.amount,
    shippingFeeNote: rate.warning || current.shippingFeeNote,
    labelStatus: "rated",
    updatedAt,
  };

  await writeCoreData(data);
  return { order: data.outboundOrders[index], rate, operator };
}

export async function matchCoreOutboundCarrier({
  id,
  operator,
  carrierConfigs,
}: {
  id: string;
  operator: string;
  carrierConfigs?: CarrierRulePreference[];
}) {
  const data = await getWarehouseCoreData();
  const order = data.outboundOrders.find((item) => item.id === id);
  if (!order) return null;
  const rule = suggestCarrierServiceFromConfiguredRules(order, carrierConfigs);
  return rateCoreOutboundShipment({ id, serviceCode: rule.serviceCode, operator, carrierConfigs });
}

export async function batchMatchCoreOutboundCarriers({
  ids,
  operator,
  carrierConfigs,
}: {
  ids?: string[];
  operator: string;
  carrierConfigs?: CarrierRulePreference[];
}) {
  const data = await getWarehouseCoreData();
  const requestedIds = ids?.map((id) => id.trim()).filter(Boolean);
  const candidates = data.outboundOrders.filter((order) =>
    requestedIds?.length
      ? requestedIds.includes(order.id)
      : order.status !== "shipped" && (!order.carrierServiceCode || order.labelStatus === "not_requested")
  );
  const updated: CoreOutboundOrder[] = [];
  const missing: string[] = [];

  for (const order of candidates) {
    const result = await matchCoreOutboundCarrier({ id: order.id, operator, carrierConfigs });
    if (result?.order) updated.push(result.order);
    else missing.push(order.id);
  }

  return { updated, missing };
}

export async function reconcileCoreOutboundShippingFee({
  id,
  actualShippingFee,
  note,
  operator,
}: {
  id: string;
  actualShippingFee: number;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updatedAt = now();
  data.outboundOrders[index] = {
    ...data.outboundOrders[index],
    actualShippingFee: Math.round(actualShippingFee * 100) / 100,
    shippingFeeCheckedAt: updatedAt,
    shippingFeeCheckedBy: operator,
    shippingFeeNote: note?.trim() || undefined,
    updatedAt,
  };

  await writeCoreData(data);
  return data.outboundOrders[index];
}

export async function generateCoreOutboundShippingLabel({
  id,
  serviceCode,
  packageWeightKg,
  packageCount,
  operator,
  carrierConfigs,
}: {
  id: string;
  serviceCode?: CarrierServiceCode;
  packageWeightKg?: number;
  packageCount?: number;
  operator: string;
  carrierConfigs?: CarrierRulePreference[];
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = data.outboundOrders[index];
  const rule = resolveCarrierRule(serviceCode ?? current.carrierServiceCode, current.channel);
  const rate = calculateCarrierRate(current, rule, packageWeightKg ?? current.packageWeightKg, packageCount ?? current.packageCount, carrierConfigs);
  const updatedAt = now();
  if (rate.blocked) {
    const error = rate.warning || "当前订单命中物流渠道限制，不能购买面单。";
    const blockedOrder: CoreOutboundOrder = {
      ...current,
      carrierServiceCode: rule.serviceCode,
      carrierName: rule.carrierName,
      carrierServiceName: rule.serviceName,
      packageWeightKg: rate.weightKg,
      packageCount: rate.packageCount,
      shippingFee: rate.amount,
      shippingFeeNote: error,
      labelStatus: "failed",
      ...carrierFailurePatch(current, error, operator, updatedAt),
      updatedAt,
    };
    data.outboundOrders[index] = blockedOrder;
    await writeCoreData(data);
    return { order: blockedOrder, rate };
  }
  const gateway = await purchaseCarrierLabel({ order: current, rule, rate, configs: carrierConfigs });
  if (!gateway.ok) {
    const error = gateway.error || "承运商面单购买失败。";
    const failedOrder: CoreOutboundOrder = {
      ...current,
      carrierServiceCode: rule.serviceCode,
      carrierName: rule.carrierName,
      carrierServiceName: rule.serviceName,
      packageWeightKg: rate.weightKg,
      packageCount: rate.packageCount,
      shippingFee: rate.amount,
      shippingFeeNote: error || rate.warning || current.shippingFeeNote,
      labelStatus: "failed",
      ...carrierFailurePatch(current, error, operator, updatedAt),
      carrierGatewayMode: gateway.mode,
      carrierProvider: gateway.carrierProvider,
      updatedAt,
    };
    data.outboundOrders[index] = failedOrder;
    await writeCoreData(data);
    return { order: failedOrder, rate, gateway };
  }

  const trackingNumber = gateway.trackingNumber || current.trackingNumber || makeTrackingNumber(rule, current.id);
  const nextOrder: CoreOutboundOrder = {
    ...current,
    carrierServiceCode: rule.serviceCode,
    carrierName: rule.carrierName,
    carrierServiceName: rule.serviceName,
    channel: rule.serviceCode === "manual" ? current.channel : `${rule.carrierName} ${rule.serviceName}`,
    packageWeightKg: rate.weightKg,
    packageCount: rate.packageCount,
    shippingFee: rate.amount,
    shippingFeeNote: gateway.warning || rate.warning || current.shippingFeeNote,
    labelStatus: "generated",
    labelGeneratedAt: updatedAt,
    labelGeneratedBy: operator,
    labelUrl: gateway.labelUrl || `/warehouse/print/label/${encodeURIComponent(current.id)}`,
    labelFormat: gateway.labelFormat,
    ...clearCarrierFailurePatch(),
    carrierGatewayMode: gateway.mode,
    carrierProvider: gateway.carrierProvider,
    carrierShipmentId: gateway.carrierShipmentId,
    trackingNumber,
    trackingEvents: appendTrackingEvent(current, {
      status: "label_created",
      label: "面单已生成",
      detail: `${rule.carrierName} ${rule.serviceName} / ${trackingNumber}${gateway.mode === "internal" ? " / 内部面单" : " / 承运商接口"}`,
      location: "谢菲尔德仓库",
      occurredAt: updatedAt,
      operator,
    }),
    status: current.status === "pending_review" || current.status === "label_pending" ? "packing_check" : current.status,
    updatedAt,
  };

  data.outboundOrders[index] = nextOrder;
  await writeCoreData(data);
  return { order: nextOrder, rate, gateway };
}

export async function cancelCoreOutboundShippingLabel({
  id,
  operator,
  carrierConfigs,
  reason,
}: {
  id: string;
  operator: string;
  carrierConfigs?: CarrierRulePreference[];
  reason?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return { order: null, error: "未找到出库单" };

  const current = data.outboundOrders[index];
  if (!current.trackingNumber && current.labelStatus !== "generated") return { order: current, error: "当前出库单没有可取消的面单" };
  const gateway = await cancelCarrierLabel({ order: current, configs: carrierConfigs });
  if (!gateway.ok) {
    const updatedAt = now();
    const error = gateway.error || "取消面单失败";
    data.outboundOrders[index] = {
      ...current,
      labelStatus: "failed",
      shippingFeeNote: error || current.shippingFeeNote,
      ...carrierFailurePatch(current, error, operator, updatedAt),
      updatedAt,
    };
    await writeCoreData(data);
    return { order: data.outboundOrders[index], error: gateway.error || "取消面单失败", gateway };
  }

  const updatedAt = now();
  data.outboundOrders[index] = {
    ...current,
    labelStatus: "not_requested",
    labelUrl: undefined,
    ...clearCarrierFailurePatch(),
    trackingEvents: appendTrackingEvent(current, {
      status: "warehouse_processing",
      label: "面单已取消",
      detail: reason?.trim() || "运营取消面单，可重新生成。",
      location: "谢菲尔德仓库",
      occurredAt: updatedAt,
      operator,
    }),
    updatedAt,
  };
  await writeCoreData(data);
  return { order: data.outboundOrders[index], error: null, gateway };
}

export async function fallbackCoreOutboundShippingLabel({
  id,
  operator,
  reason,
}: {
  id: string;
  operator: string;
  reason?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return { order: null, error: "未找到出库单" };

  const current = data.outboundOrders[index];
  const updatedAt = now();
  const rule = resolveCarrierRule("manual", current.channel);
  const trackingNumber = current.trackingNumber || makeTrackingNumber(rule, current.id);
  const fallbackNote = reason?.trim() || current.labelFailureReason || "真实承运商接口暂不可用，运营转为内部/人工面单继续仓库作业。";
  const nextOrder: CoreOutboundOrder = {
    ...current,
    carrierServiceCode: "manual",
    carrierName: "Manual",
    carrierServiceName: "Internal label",
    labelStatus: "generated",
    labelGeneratedAt: updatedAt,
    labelGeneratedBy: operator,
    labelUrl: `/warehouse/print/label/${encodeURIComponent(current.id)}`,
    labelFormat: "internal",
    ...clearCarrierFailurePatch(),
    labelFallbackNote: fallbackNote,
    carrierGatewayMode: "internal",
    carrierProvider: "manual",
    carrierShipmentId: undefined,
    trackingNumber,
    trackingEvents: appendTrackingEvent(current, {
      status: "label_created",
      label: "内部面单已生成",
      detail: `${fallbackNote} / ${trackingNumber}`,
      location: "谢菲尔德仓库",
      occurredAt: updatedAt,
      operator,
    }),
    status: current.status === "pending_review" || current.status === "label_pending" ? "packing_check" : current.status,
    updatedAt,
  };

  data.outboundOrders[index] = nextOrder;
  await writeCoreData(data);
  return { order: nextOrder, error: null };
}

export async function recordOutboundDocumentReprint({
  id,
  documentType,
  reason,
  operator,
}: {
  id: string;
  documentType: OutboundDocumentType;
  reason: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = data.outboundOrders[index];
  const updatedAt = now();
  const labels: Record<OutboundDocumentType, string> = {
    pick_list: "拣货单",
    shipping_label: "出货标签",
    carrier_label: "快递面单",
    invoice: "发票",
  };
  const log: OutboundReprintLog = {
    id: makeCoreId("RPT"),
    documentType,
    reason: reason.trim() || "仓库作业需要重打",
    operator,
    printedAt: updatedAt,
  };

  data.outboundOrders[index] = {
    ...current,
    reprintLogs: [log, ...(current.reprintLogs ?? [])].slice(0, 40),
    operationLogs: appendOutboundOperationLog(current, {
      action: "document_reprinted",
      label: `重打${labels[documentType]}`,
      detail: log.reason,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return data.outboundOrders[index];
}

export async function requestCoreOutboundIntercept({
  id,
  reason,
  operator,
}: {
  id: string;
  reason: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return { order: null, error: "未找到出库单" };

  const current = data.outboundOrders[index];
  if (current.status === "shipped") return { order: current, error: "订单已签出/交运，不能申请截单，请走物流异常或售后流程" };
  if (current.interceptStatus === "completed") return { order: current, error: "该出库单已经截单回库，不能重复申请" };

  const updatedAt = now();
  const cleanReason = reason.trim() || "运营申请截单，等待复核回库";
  data.outboundOrders[index] = {
    ...current,
    status: current.status === "blocked" ? current.status : "blocked",
    interceptStatus: "requested",
    interceptReason: cleanReason,
    interceptRequestedBy: operator,
    interceptRequestedAt: current.interceptRequestedAt ?? updatedAt,
    note: `已申请截单：${cleanReason}`,
    operationLogs: appendOutboundOperationLog(current, {
      action: "intercept_requested",
      label: "申请截单",
      detail: cleanReason,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return { order: data.outboundOrders[index], error: null };
}

export async function interceptCoreOutboundOrder({
  id,
  reason,
  restockLocationCode,
  operator,
}: {
  id: string;
  reason: string;
  restockLocationCode?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return { order: null, error: "未找到出库单" };

  const current = data.outboundOrders[index];
  if (current.status === "shipped") return { order: current, error: "订单已签出/交运，不能直接截单，请走物流异常或售后流程" };

  const updatedAt = now();
  const cleanReason = reason.trim() || "客服/客户要求拦截订单";
  releaseReservedOutboundInventory(data, current, updatedAt, operator, `截单回库：${cleanReason}`);

  data.outboundOrders[index] = {
    ...current,
    status: "blocked",
    interceptStatus: "completed",
    interceptReason: cleanReason,
    interceptRequestedBy: operator,
    interceptRequestedAt: current.interceptRequestedAt ?? updatedAt,
    interceptCompletedAt: updatedAt,
    restockLocationCode: restockLocationCode?.trim() || current.restockLocationCode,
    note: `已截单回库：${cleanReason}`,
    operationLogs: appendOutboundOperationLog(current, {
      action: "intercept_completed",
      label: "截单并重新上架",
      detail: [cleanReason, restockLocationCode?.trim() ? `回库位：${restockLocationCode.trim()}` : ""].filter(Boolean).join("；"),
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return { order: data.outboundOrders[index], error: null };
}

export async function resolveCoreOutboundException({
  id,
  exceptionId,
  status,
  note,
  operator,
}: {
  id: string;
  exceptionId: string;
  status: OutboundExceptionStatus;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return { order: null, error: "未找到出库单" };

  const current = data.outboundOrders[index];
  const exception = current.exceptions?.find((item) => item.id === exceptionId);
  if (!exception) return { order: current, error: "未找到异常记录" };

  const updatedAt = now();
  const nextExceptions = (current.exceptions ?? []).map((item) =>
    item.id === exceptionId
      ? {
          ...item,
          status,
          resolvedBy: operator,
          resolvedAt: status === "resolved" || status === "ignored" ? updatedAt : item.resolvedAt,
          resolutionNote: note?.trim() || item.resolutionNote,
        }
      : item,
  );
  const stillOpenCritical = nextExceptions.some((item) => (item.status === "open" || item.status === "investigating") && item.severity === "critical");
  const nextStatus = current.status === "blocked" && !stillOpenCritical ? "picking" : current.status;

  data.outboundOrders[index] = {
    ...current,
    status: nextStatus,
    exceptions: nextExceptions,
    operationLogs: appendOutboundOperationLog(current, {
      action: "exception_resolved",
      label: status === "resolved" ? "异常已处理" : status === "ignored" ? "异常已忽略" : "异常处理中",
      detail: `${exception.message}${note?.trim() ? `；${note.trim()}` : ""}`,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return { order: data.outboundOrders[index], error: null };
}

export async function scanCoreOutboundTask({
  action,
  code,
  activeOrderId,
  weightKg,
  locationCode,
  operator,
}: {
  action: OutboundScanAction;
  code: string;
  activeOrderId?: string;
  weightKg?: number;
  locationCode?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const cleanCode = code.trim();
  if (!cleanCode) return { order: null, error: "请扫描或输入条码", message: "", codeType: "unknown" as OutboundScanCodeType };

  const resolved = resolveOutboundOrderByCode(data, cleanCode, activeOrderId);
  let order = resolved.order;
  let codeType = resolved.codeType;
  if (!order) return { order: null, error: "未匹配到出库任务，请先扫描出库单、波次号或拣货单号", message: "", codeType };

  const index = data.outboundOrders.findIndex((item) => item.id === order?.id);
  if (index < 0) return { order: null, error: "未找到出库任务", message: "", codeType };
  order = data.outboundOrders[index];

  if (["outbound_order", "pick_wave", "pick_list", "tracking", "basket"].includes(codeType)) {
    return {
      order,
      error: null,
      message: `已选中出库任务：${order.id} / ${outboundWorkModeLabel(order.workMode)}`,
      codeType,
    };
  }

  const updatedAt = now();
  const scanLocation = resolveLocationFromScan(data, cleanCode) || locationCode?.trim() || "";
  const skuCode = resolveSkuFromScan(data, order, cleanCode);
  if (scanLocation && !skuCode) codeType = "location";
  if (skuCode) codeType = "sku";

  if (!skuCode && action !== "ship" && action !== "intercept") {
    const message = "当前条码不是该出库任务的 SKU，请检查是否扫错货品";
    applyOutboundScanException({
      data,
      order,
      index,
      type: "wrong_sku",
      severity: "critical",
      action,
      code: cleanCode,
      message,
      operator,
      blockOrder: true,
    });
    await writeCoreData(data);
    return { order: data.outboundOrders[index], error: message, message: "", codeType };
  }

  const progress = order.scanProgress ?? {};
  const scanActionLabel: Record<OutboundScanAction, string> = {
    pick: "扫码拣货",
    sort: "扫码配货",
    pack: "打包复核",
    ship: "称重签出",
    intercept: "截单回库",
  };
  const operationAction: Record<OutboundScanAction, OutboundOperationLog["action"]> = {
    pick: "scan_pick",
    sort: "scan_sort",
    pack: "scan_pack",
    ship: "scan_ship",
    intercept: "scan_intercept",
  };

  if (action === "ship") {
    if (order.status === "shipped") return { order, error: "该出库单已签出", message: "", codeType };
    if (openOutboundExceptions(order).some((item) => item.severity === "critical")) {
      return { order, error: "该出库单存在未处理的严重异常，请先处理异常后再签出", message: "", codeType };
    }
    const nextWeight = typeof weightKg === "number" && Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 100) / 100 : order.packageWeightKg;
    deductReservedOutboundInventory(data, order, updatedAt, operator, "扫码签出，已扣减预占库存");
    data.outboundOrders[index] = {
      ...order,
      status: "shipped",
      packageWeightKg: nextWeight,
      shippedAt: updatedAt,
      handoverAt: updatedAt,
      trackingEvents: appendTrackingEvent(order, {
        status: "carrier_handover",
        label: "已交接承运商",
        detail: nextWeight ? `扫码签出，重量 ${nextWeight}kg` : "扫码签出",
        location: "谢菲尔德仓库",
        occurredAt: updatedAt,
        operator,
      }),
      scanProgress: {
        ...progress,
        lastScans: appendScanRecord(order, { action, code: cleanCode, codeType, weightKg: nextWeight, operator, scannedAt: updatedAt }),
      },
      operationLogs: appendOutboundOperationLog(order, {
        action: operationAction[action],
        label: scanActionLabel[action],
        detail: nextWeight ? `重量：${nextWeight}kg` : "已完成签出",
        operator,
        occurredAt: updatedAt,
      }),
      updatedAt,
    };
    await writeCoreData(data);
    return { order: data.outboundOrders[index], error: null, message: "签出完成，已扣减预占库存并生成物流交接记录", codeType };
  }

  if (action === "intercept") {
    const result = await interceptCoreOutboundOrder({
      id: order.id,
      reason: `扫码截单：${cleanCode}`,
      restockLocationCode: scanLocation || locationCode,
      operator,
    });
    return { order: result.order, error: result.error, message: result.error ? "" : "截单回库完成，已释放预占库存", codeType };
  }

  const requiredQty = expectedSkuQuantity(order, skuCode);
  if (requiredQty <= 0) {
    const message = "该 SKU 不属于当前出库任务";
    applyOutboundScanException({
      data,
      order,
      index,
      type: "wrong_sku",
      severity: "critical",
      action,
      code: cleanCode,
      skuCode,
      message,
      operator,
      blockOrder: true,
    });
    await writeCoreData(data);
    return { order: data.outboundOrders[index], error: message, message: "", codeType };
  }

  const field = action === "pick" ? "pickedQtyBySku" : action === "sort" ? "sortedQtyBySku" : "packedQtyBySku";
  const increment = incrementScanQty(progress[field], skuCode, requiredQty);
  if (!increment.accepted) {
    const message = `${skuCode} 已达到应扫数量 ${requiredQty}，请勿重复扫描`;
    applyOutboundScanException({
      data,
      order,
      index,
      type: "duplicate_scan",
      severity: "warning",
      action,
      code: cleanCode,
      skuCode,
      message,
      operator,
    });
    await writeCoreData(data);
    return { order: data.outboundOrders[index], error: message, message: "", codeType };
  }

  const nextProgress: OutboundScanProgress = {
    ...progress,
    [field]: increment.next,
    lastScans: appendScanRecord(order, { action, code: cleanCode, codeType, skuCode, quantity: 1, locationCode: scanLocation || undefined, operator, scannedAt: updatedAt }),
  };
  const scannedTotal = totalScannedQty(increment.next);
  const requiredTotal = totalRequiredQty(order);
  const completed = scannedTotal >= requiredTotal && requiredTotal > 0;
  const nextStatus: CoreOutboundOrder["status"] =
    action === "pack" && completed ? "handover" : action === "sort" && completed ? "packing_check" : action === "pick" ? "picking" : order.status;

  data.outboundOrders[index] = {
    ...order,
    status: nextStatus,
    scanProgress: nextProgress,
    operationLogs: appendOutboundOperationLog(order, {
      action: operationAction[action],
      label: scanActionLabel[action],
      detail: `${skuCode}：${scannedTotal}/${requiredTotal}${scanLocation ? `；库位：${scanLocation}` : ""}`,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return {
    order: data.outboundOrders[index],
    error: null,
    message: completed ? `${scanActionLabel[action]}完成：${scannedTotal}/${requiredTotal}` : `${scanActionLabel[action]}成功：${skuCode} ${scannedTotal}/${requiredTotal}`,
    codeType,
  };
}

export async function addCoreOutboundTrackingEvent({
  id,
  status,
  detail,
  location,
  trackingNumber,
  carrierName,
  carrierServiceName,
  operator,
}: {
  id: string;
  status: OutboundTrackingEvent["status"];
  detail?: string;
  location?: string;
  trackingNumber?: string;
  carrierName?: string;
  carrierServiceName?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = data.outboundOrders[index];
  const updatedAt = now();
  const labels: Record<OutboundTrackingEvent["status"], string> = {
    label_created: "面单已生成",
    warehouse_processing: "仓库处理中",
    carrier_handover: "已交接承运商",
    in_transit: "运输途中",
    out_for_delivery: "派送中",
    delivered: "已签收",
    exception: "物流异常",
  };
  let nextStatus = current.status;
  if (status === "carrier_handover" || status === "in_transit" || status === "out_for_delivery" || status === "delivered") nextStatus = "shipped";
  if (status === "exception") nextStatus = "blocked";
  if (status === "warehouse_processing" && current.status === "label_pending") nextStatus = "packing_check";

  if (nextStatus === "shipped" && current.status !== "shipped") {
    deductReservedOutboundInventory(data, current, updatedAt, operator, detail || "已确认交接承运商，已扣减占用库存");
  }

  data.outboundOrders[index] = {
    ...current,
    status: nextStatus,
    trackingNumber: trackingNumber?.trim() || current.trackingNumber,
    carrierName: carrierName?.trim() || current.carrierName,
    carrierServiceName: carrierServiceName?.trim() || current.carrierServiceName,
    labelStatus: trackingNumber?.trim() && status === "label_created" ? "generated" : current.labelStatus,
    handoverAt: status === "carrier_handover" ? updatedAt : current.handoverAt,
    shippedAt: nextStatus === "shipped" ? current.shippedAt ?? updatedAt : current.shippedAt,
    trackingEvents: appendTrackingEvent(current, {
      status,
      label: labels[status],
      detail: detail?.trim() || undefined,
      location: location?.trim() || "谢菲尔德仓库",
      occurredAt: updatedAt,
      operator,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return data.outboundOrders[index];
}

export async function addCoreOutboundTrackingEventByReference({
  outboundId,
  trackingNumber,
  carrierShipmentId,
  status,
  detail,
  location,
  operator,
}: {
  outboundId?: string;
  trackingNumber?: string;
  carrierShipmentId?: string;
  status: OutboundTrackingEvent["status"];
  detail?: string;
  location?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const matched = data.outboundOrders.find(
    (item) =>
      (outboundId && item.id === outboundId) ||
      (trackingNumber && item.trackingNumber === trackingNumber) ||
      (carrierShipmentId && item.carrierShipmentId === carrierShipmentId),
  );
  if (!matched) return null;
  return addCoreOutboundTrackingEvent({
    id: matched.id,
    status,
    detail,
    location,
    trackingNumber: trackingNumber || matched.trackingNumber,
    carrierName: matched.carrierName,
    carrierServiceName: matched.carrierServiceName,
    operator,
  });
}

export async function updateCoreOutboundPlatformFulfillment({
  id,
  status,
  error,
}: {
  id: string;
  status: CoreOutboundOrder["platformFulfillmentStatus"];
  error?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  data.outboundOrders[index] = {
    ...data.outboundOrders[index],
    platformFulfillmentStatus: status,
    platformFulfillmentSyncedAt: status === "synced" ? now() : data.outboundOrders[index].platformFulfillmentSyncedAt,
    platformFulfillmentError: status === "failed" ? error?.trim() || "平台发货回传失败" : undefined,
    updatedAt: now(),
  };
  await writeCoreData(data);
  return data.outboundOrders[index];
}

export async function createCoreOutboundDeliveryException({
  id,
  exceptionType,
  message,
  severity,
  redeliveryRequired,
  redeliveryNote,
  proofUrl,
  claimAmount,
  claimStatus,
  claimNote,
  recordTrackingEvent = true,
  operator,
}: {
  id: string;
  exceptionType: OutboundDeliveryExceptionType;
  message: string;
  severity?: "warning" | "critical";
  redeliveryRequired?: boolean;
  redeliveryNote?: string;
  proofUrl?: string;
  claimAmount?: number;
  claimStatus?: OutboundClaimStatus;
  claimNote?: string;
  recordTrackingEvent?: boolean;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return { order: null, exception: null, error: "未找到出库单" };

  const current = data.outboundOrders[index];
  const updatedAt = now();
  const cleanMessage = message.trim() || outboundDeliveryExceptionTypeLabel[exceptionType];
  const cleanProofUrl = proofUrl?.trim();
  const cleanRedeliveryNote = redeliveryNote?.trim();
  const cleanClaimNote = claimNote?.trim();
  const normalizedClaimAmount = typeof claimAmount === "number" && Number.isFinite(claimAmount) && claimAmount > 0 ? Math.round(claimAmount * 100) / 100 : undefined;
  const normalizedClaimStatus = claimStatus ?? (normalizedClaimAmount ? "draft" : "not_required");
  const normalizedSeverity = severity ?? (exceptionType === "proof_uploaded" ? "warning" : "critical");
  const nextExceptions = appendOutboundException(current, {
    type: exceptionType,
    deliveryExceptionType: exceptionType,
    severity: normalizedSeverity,
    message: cleanMessage,
    redeliveryRequired,
    redeliveryNote: cleanRedeliveryNote || undefined,
    proofUrl: cleanProofUrl || undefined,
    claimAmount: normalizedClaimAmount,
    claimStatus: normalizedClaimStatus,
    claimNote: cleanClaimNote || undefined,
    operator,
    createdAt: updatedAt,
  });
  const createdException = nextExceptions[0];
  const nextStatus = normalizedSeverity === "critical" ? "blocked" : current.status;
  const trackingDetail = [
    cleanMessage,
    redeliveryRequired ? `改派：${cleanRedeliveryNote || "待补充"}` : "",
    normalizedClaimAmount ? `赔付金额：£${normalizedClaimAmount.toFixed(2)} / ${outboundClaimStatusLabel[normalizedClaimStatus]}` : "",
    cleanProofUrl ? "已关联签收证明" : "",
  ].filter(Boolean).join("；");
  const workOrder = await createCustomerWorkOrder({
    customerCode: current.customerCode,
    category: "物流异常",
    title: `物流异常待确认：${outboundDeliveryExceptionTypeLabel[exceptionType]}`,
    priority: normalizedSeverity === "critical" ? "urgent" : "normal",
    status: "waiting_customer",
    referenceNo: current.trackingNumber || current.id,
    description: [
      "物流异常已登记，请客户确认处理要求或等待运营进一步同步。",
      `出库单：${current.id}`,
      `追踪号：${current.trackingNumber || "暂无追踪号"}`,
      `承运商/渠道：${current.carrierName || current.channel}${current.carrierServiceName ? ` ${current.carrierServiceName}` : ""}`,
      `异常类型：${outboundDeliveryExceptionTypeLabel[exceptionType]}`,
      `异常说明：${cleanMessage}`,
      redeliveryRequired ? `改派要求：${cleanRedeliveryNote || "待补充"}` : "",
      cleanProofUrl ? `签收证明：${cleanProofUrl}` : "",
      normalizedClaimAmount ? `赔付金额：£${normalizedClaimAmount.toFixed(2)} / ${outboundClaimStatusLabel[normalizedClaimStatus]}` : "",
      cleanClaimNote ? `赔付说明：${cleanClaimNote}` : "",
    ].filter(Boolean).join("\n"),
    initialAuthorRole: "system",
    initialAuthorName: "物流系统",
  });
  createdException.workOrderId = workOrder.id;

  data.outboundOrders[index] = {
    ...current,
    status: nextStatus,
    exceptions: nextExceptions,
    trackingEvents: recordTrackingEvent
      ? appendTrackingEvent(current, {
          status: exceptionType === "proof_uploaded" ? "delivered" : "exception",
          label: outboundDeliveryExceptionTypeLabel[exceptionType],
          detail: trackingDetail,
          location: "承运商",
          occurredAt: updatedAt,
          operator,
        })
      : current.trackingEvents,
    operationLogs: appendOutboundOperationLog(current, {
      action: "exception_created",
      label: outboundDeliveryExceptionTypeLabel[exceptionType],
      detail: trackingDetail,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  return { order: data.outboundOrders[index], exception: createdException, error: null };
}

export async function updateCoreOutboundDeliveryException({
  id,
  exceptionId,
  status,
  redeliveryRequired,
  redeliveryNote,
  proofUrl,
  claimAmount,
  claimStatus,
  claimNote,
  note,
  operator,
}: {
  id: string;
  exceptionId: string;
  status?: OutboundExceptionStatus;
  redeliveryRequired?: boolean;
  redeliveryNote?: string;
  proofUrl?: string;
  claimAmount?: number;
  claimStatus?: OutboundClaimStatus;
  claimNote?: string;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return { order: null, exception: null, error: "未找到出库单" };

  const current = data.outboundOrders[index];
  const target = current.exceptions?.find((item) => item.id === exceptionId);
  if (!target) return { order: current, exception: null, error: "未找到异常记录" };

  const updatedAt = now();
  const normalizedClaimAmount = typeof claimAmount === "number" && Number.isFinite(claimAmount) && claimAmount >= 0 ? Math.round(claimAmount * 100) / 100 : undefined;
  const nextExceptions = (current.exceptions ?? []).map((item) => {
    if (item.id !== exceptionId) return item;
    return {
      ...item,
      status: status ?? item.status,
      redeliveryRequired: typeof redeliveryRequired === "boolean" ? redeliveryRequired : item.redeliveryRequired,
      redeliveryNote: redeliveryNote?.trim() || item.redeliveryNote,
      proofUrl: proofUrl?.trim() || item.proofUrl,
      claimAmount: normalizedClaimAmount ?? item.claimAmount,
      claimStatus: claimStatus ?? item.claimStatus,
      claimNote: claimNote?.trim() || item.claimNote,
      resolvedBy: status === "resolved" || status === "ignored" ? operator : item.resolvedBy,
      resolvedAt: status === "resolved" || status === "ignored" ? updatedAt : item.resolvedAt,
      resolutionNote: note?.trim() || item.resolutionNote,
    };
  });
  const finalException = nextExceptions.find((item) => item.id === exceptionId) ?? target;
  const stillOpenCritical = nextExceptions.some((item) => (item.status === "open" || item.status === "investigating") && item.severity === "critical");
  const nextStatus = current.status === "blocked" && !stillOpenCritical ? "picking" : current.status;
  const detail = [
    note?.trim() || target.message,
    finalException.redeliveryRequired ? `改派：${finalException.redeliveryNote || "待补充"}` : "",
    finalException.claimAmount ? `赔付金额：£${finalException.claimAmount.toFixed(2)} / ${outboundClaimStatusLabel[finalException.claimStatus ?? "draft"]}` : "",
    finalException.proofUrl ? "已关联签收证明" : "",
  ].filter(Boolean).join("；");

  data.outboundOrders[index] = {
    ...current,
    status: nextStatus,
    exceptions: nextExceptions,
    operationLogs: appendOutboundOperationLog(current, {
      action: status === "resolved" || status === "ignored" ? "exception_resolved" : "exception_created",
      label: status === "resolved" ? "物流异常已处理" : "物流异常已更新",
      detail,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  if (finalException.workOrderId) {
    await addCustomerWorkOrderMessage({
      id: finalException.workOrderId,
      customerCode: current.customerCode,
      authorRole: "system",
      authorName: "物流系统",
      body: [
        status === "resolved" ? "物流异常已处理完成。" : status === "ignored" ? "物流异常已忽略并关闭。" : "物流异常处理进度已更新。",
        `处理状态：${statusLabelForException(finalException.status)}`,
        note?.trim() ? `处理说明：${note.trim()}` : "",
        finalException.redeliveryRequired ? `改派要求：${finalException.redeliveryNote || "待补充"}` : "",
        finalException.proofUrl ? `签收证明：${finalException.proofUrl}` : "",
        finalException.claimAmount ? `赔付金额：£${finalException.claimAmount.toFixed(2)} / ${outboundClaimStatusLabel[finalException.claimStatus ?? "draft"]}` : "",
        finalException.claimNote ? `赔付说明：${finalException.claimNote}` : "",
      ].filter(Boolean).join("\n"),
      visibleToCustomer: true,
      nextStatus: status === "resolved" || status === "ignored" ? "resolved" : "waiting_customer",
    });
  }
  return { order: data.outboundOrders[index], exception: finalException, error: null };
}

export async function customerConfirmCoreOutboundDeliveryException({
  id,
  exceptionId,
  customerCode,
  decision,
  note,
  actorName,
}: {
  id: string;
  exceptionId: string;
  customerCode: string;
  decision: OutboundCustomerExceptionDecision;
  note?: string;
  actorName: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id && item.customerCode === customerCode);
  if (index < 0) return { order: null, exception: null, error: "未找到可确认的出库单" };

  const current = data.outboundOrders[index];
  const target = current.exceptions?.find((item) => item.id === exceptionId);
  if (!target) return { order: current, exception: null, error: "未找到可确认的异常记录" };
  if (target.status === "resolved" || target.status === "ignored") return { order: current, exception: target, error: "该异常已关闭，不能重复确认" };

  const cleanNote = note?.trim();
  const updatedAt = now();
  const nextStatus: OutboundExceptionStatus = decision === "accepted" && target.deliveryExceptionType === "proof_uploaded" ? "resolved" : "investigating";
  const nextExceptions = (current.exceptions ?? []).map((item) => {
    if (item.id !== exceptionId) return item;
    return {
      ...item,
      status: nextStatus,
      customerDecision: decision,
      customerDecisionNote: cleanNote || undefined,
      customerDecisionAt: updatedAt,
      customerDecisionBy: actorName,
      resolvedBy: nextStatus === "resolved" ? actorName : item.resolvedBy,
      resolvedAt: nextStatus === "resolved" ? updatedAt : item.resolvedAt,
      resolutionNote: nextStatus === "resolved" ? cleanNote || "客户确认签收证明无误。" : item.resolutionNote,
    };
  });
  const finalException = nextExceptions.find((item) => item.id === exceptionId) ?? target;
  const stillOpenCritical = nextExceptions.some((item) => (item.status === "open" || item.status === "investigating") && item.severity === "critical");
  const nextOrderStatus = current.status === "blocked" && !stillOpenCritical ? "picking" : current.status;
  const decisionLabel = outboundCustomerExceptionDecisionLabel[decision];
  const detail = [decisionLabel, cleanNote ? `客户备注：${cleanNote}` : "", target.redeliveryRequired ? `改派要求：${target.redeliveryNote || "待补充"}` : "", target.claimStatus && target.claimStatus !== "not_required" ? `赔付状态：${outboundClaimStatusLabel[target.claimStatus]}` : ""].filter(Boolean).join("；");

  data.outboundOrders[index] = {
    ...current,
    status: nextOrderStatus,
    exceptions: nextExceptions,
    operationLogs: appendOutboundOperationLog(current, {
      action: "customer_exception_decision",
      label: decisionLabel,
      detail,
      operator: actorName,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  await writeCoreData(data);
  if (finalException.workOrderId) {
    await addCustomerWorkOrderMessage({
      id: finalException.workOrderId,
      customerCode: current.customerCode,
      authorRole: "customer",
      authorName: actorName,
      body: [decisionLabel, cleanNote ? `备注：${cleanNote}` : "", `关联异常：${finalException.id}`, `关联出库单：${current.id}`].filter(Boolean).join("\n"),
      visibleToCustomer: true,
      nextStatus: decision === "accepted" ? "processing" : "waiting_customer",
    });
  }

  return { order: data.outboundOrders[index], exception: finalException, error: null };
}

export async function createCustomerOutboundOrder({
  customerCode,
  channel,
  orderCount,
  skuLines,
  recipientName,
  deliveryAddress,
  requestedShipDate,
  note,
  platform,
  platformOrderNo,
  platformStoreName,
}: {
  customerCode: string;
  channel: string;
  orderCount: number;
  skuLines: Array<{ skuCode: string; quantity: number }>;
  recipientName?: string;
  deliveryAddress?: string;
  requestedShipDate?: string;
  note?: string;
  platform?: string;
  platformOrderNo?: string;
  platformStoreName?: string;
}) {
  const data = await getWarehouseCoreData();
  const validSkuCodes = new Set(data.skus.filter((item) => item.customerCode === customerCode).map((item) => item.skuCode));
  const cleanLines = skuLines
    .map((line) => ({ skuCode: line.skuCode.trim().toUpperCase(), quantity: Math.max(0, Math.floor(line.quantity)) }))
    .filter((line) => line.skuCode && line.quantity > 0 && validSkuCodes.has(line.skuCode));

  if (!channel.trim() || orderCount <= 0 || cleanLines.length === 0) return null;

  const createdAt = now();
  const inferredWorkMode = inferOutboundWorkMode({ channel, orderCount, skuLines: cleanLines });
  const order: CoreOutboundOrder = {
    id: makeCoreId("OUT-CUS"),
    customerCode,
    channel: channel.trim(),
    orderCount,
    skuLines: cleanLines,
    recipientName: recipientName?.trim() || undefined,
    deliveryAddress: deliveryAddress?.trim() || undefined,
    requestedShipDate: requestedShipDate?.trim() || undefined,
    note: note?.trim() || undefined,
    platform: platform?.trim() || undefined,
    platformOrderNo: platformOrderNo?.trim() || undefined,
    platformStoreName: platformStoreName?.trim() || undefined,
    platformFulfillmentStatus: platformOrderNo?.trim() ? "pending" : "not_required",
    labelStatus: "not_requested",
    packageCount: 1,
    workMode: inferredWorkMode,
    interceptStatus: "none",
    operationLogs: [
      {
        id: makeCoreId("OLOG"),
        action: "work_mode_assigned",
        label: "系统已预判出库模式",
        detail: `模式：${outboundWorkModeLabel(inferredWorkMode)}`,
        operator: "customer",
        occurredAt: createdAt,
      },
    ],
    status: "pending_review",
    createdAt,
    updatedAt: createdAt,
  };

  data.outboundOrders.unshift(order);
  cleanLines.forEach((line) => {
    const balance = data.inventoryBalances.find((item) => item.customerCode === customerCode && item.skuCode === line.skuCode);
    if (!balance) return;
    balance.reservedQty += line.quantity;
    balance.availableQty = Math.max(0, balance.availableQty - line.quantity);
    balance.updatedAt = createdAt;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode,
      skuCode: line.skuCode,
      refType: "outbound",
      refId: order.id,
      movementType: "reserve",
      quantity: line.quantity,
      note: "客户提交出库申请后系统预占库存",
      occurredAt: createdAt,
      operator: "customer",
    });
  });

  await writeCoreData(data);
  return order;
}

export async function updateCoreOutboundOrderStatus({
  id,
  status,
  operator,
  note,
}: {
  id: string;
  status: CoreOutboundOrder["status"];
  operator: string;
  note?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.outboundOrders.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = data.outboundOrders[index];
  const updatedAt = now();
  const cleanNote = note?.trim();

  data.outboundOrders[index] = {
    ...current,
    status,
    note: cleanNote || current.note,
    operationLogs: appendOutboundOperationLog(current, {
      action: "status_changed",
      label: "出库状态更新",
      detail: `${current.status} -> ${status}${cleanNote ? `；${cleanNote}` : ""}`,
      operator,
      occurredAt: updatedAt,
    }),
    updatedAt,
  };

  if (status === "shipped" && current.status !== "shipped") {
    current.skuLines?.forEach((line) => {
      const balance = data.inventoryBalances.find((item) => item.customerCode === current.customerCode && item.skuCode === line.skuCode);
      if (!balance) return;
      const beforeQty = balance.availableQty + balance.reservedQty;
      balance.reservedQty = Math.max(0, balance.reservedQty - line.quantity);
      balance.updatedAt = updatedAt;
      data.inventoryMovements.unshift({
        id: makeCoreId("MOV"),
        customerCode: current.customerCode,
        skuCode: line.skuCode,
        refType: "outbound",
        refId: current.id,
        movementType: "out",
        quantity: line.quantity,
        beforeQty,
        afterQty: balance.availableQty + balance.reservedQty,
        note: cleanNote || "出库已发货，扣减预占库存",
        occurredAt: updatedAt,
        operator,
      });
    });
  }

  await writeCoreData(data);
  return data.outboundOrders[index];
}

export function returnOrderStatusLabel(status: ReturnOrderStatus) {
  const labels: Record<ReturnOrderStatus, string> = {
    requested: "待审核",
    label_sent: "已发退货指引",
    in_transit: "退货在途",
    received: "已到仓",
    inspection: "质检中",
    restocked: "已重新上架",
    repair: "维修处理中",
    disposed: "已报废",
    closed: "已关闭",
    exception: "异常处理",
  };
  return labels[status];
}

export function returnResolutionLabel(resolution?: ReturnResolution) {
  const labels: Record<ReturnResolution, string> = {
    restock: "重新上架",
    repair: "维修/翻新",
    dispose: "报废",
    reship: "转寄/重发",
  };
  return resolution ? labels[resolution] : "待定";
}

export async function createCustomerReturnOrder({
  customerCode,
  platform,
  originalOrderNo,
  buyerReturnTracking,
  returnReason,
  expectedArrivalDate,
  skuLines,
  customerNote,
}: {
  customerCode: string;
  platform: string;
  originalOrderNo?: string;
  buyerReturnTracking?: string;
  returnReason: string;
  expectedArrivalDate?: string;
  skuLines: Array<{ skuCode: string; quantity: number }>;
  customerNote?: string;
}) {
  const data = await getWarehouseCoreData();
  const normalizedLines = skuLines
    .map((line) => ({ skuCode: line.skuCode.trim().toUpperCase(), quantity: Math.floor(line.quantity) }))
    .filter((line) => line.skuCode && line.quantity > 0);
  if (!platform.trim() || !returnReason.trim() || normalizedLines.length === 0) return null;

  const validSkuCodes = new Set(data.skus.filter((item) => item.customerCode === customerCode).map((item) => item.skuCode));
  if (normalizedLines.some((line) => !validSkuCodes.has(line.skuCode))) return null;

  const createdAt = now();
  const order: ReturnOrder = {
    id: makeCoreId("RMA"),
    customerCode,
    platform: platform.trim(),
    originalOrderNo: originalOrderNo?.trim() || undefined,
    buyerReturnTracking: buyerReturnTracking?.trim() || undefined,
    returnReason: returnReason.trim(),
    expectedArrivalDate: expectedArrivalDate?.trim() || undefined,
    skuLines: normalizedLines,
    status: "requested",
    customerNote: customerNote?.trim() || undefined,
    createdAt,
  };

  data.returnOrders.unshift(order);
  await writeCoreData(data);
  return order;
}

function restockReturnInventory(data: WarehouseCoreData, order: ReturnOrder, updatedAt: string, operator: string, note?: string) {
  const alreadyPosted = data.inventoryMovements.some((item) => item.refType === "adjustment" && item.refId === order.id && item.movementType === "in");
  if (alreadyPosted) return;

  order.skuLines.forEach((line) => {
    let balance = data.inventoryBalances.find((item) => item.customerCode === order.customerCode && item.skuCode === line.skuCode);
    if (!balance) {
      balance = {
        id: `BAL-${line.skuCode}`,
        customerCode: order.customerCode,
        skuCode: line.skuCode,
        warehouseCode: "SHEFFIELD-MAIN",
        locationCode: order.locationCode,
        availableQty: 0,
        reservedQty: 0,
        frozenQty: 0,
        defectiveQty: 0,
        inboundQty: 0,
        alertQty: 0,
        agingDays: 0,
        updatedAt,
      };
      data.inventoryBalances.unshift(balance);
    }

    const beforeQty = balance.availableQty + balance.reservedQty;
    balance.availableQty += line.quantity;
    balance.locationCode = order.locationCode || balance.locationCode;
    balance.updatedAt = updatedAt;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: order.customerCode,
      skuCode: line.skuCode,
      refType: "adjustment",
      refId: order.id,
      movementType: "in",
      quantity: line.quantity,
      beforeQty,
      afterQty: balance.availableQty + balance.reservedQty,
      note: note || "退货质检后重新上架",
      occurredAt: updatedAt,
      operator,
    });
  });
}

export async function updateReturnOrderStatus({
  id,
  status,
  inspectionResult,
  resolution,
  locationCode,
  opsNote,
  operator,
}: {
  id: string;
  status: ReturnOrderStatus;
  inspectionResult?: string;
  resolution?: ReturnResolution;
  locationCode?: string;
  opsNote?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const current = data.returnOrders.find((item) => item.id === id);
  if (!current) return null;

  const updatedAt = now();
  current.status = status;
  current.inspectionResult = inspectionResult?.trim() || current.inspectionResult;
  current.resolution = resolution || current.resolution;
  current.locationCode = locationCode?.trim().toUpperCase() || current.locationCode;
  current.opsNote = opsNote?.trim() || current.opsNote;
  current.updatedAt = updatedAt;
  if (status === "received" && !current.receivedAt) current.receivedAt = updatedAt;
  if ((status === "inspection" || status === "restocked" || status === "repair" || status === "disposed") && !current.inspectedAt) current.inspectedAt = updatedAt;
  if (["restocked", "disposed", "closed"].includes(status)) current.closedAt = updatedAt;
  if (status === "restocked") {
    restockReturnInventory(data, current, updatedAt, operator, current.inspectionResult || current.opsNote);
  }

  const shouldSyncWorkOrder = ["inspection", "repair", "disposed", "exception", "restocked", "closed"].includes(status) || Boolean(current.inspectionResult || current.resolution);
  if (shouldSyncWorkOrder && !current.workOrderId) {
    const workOrder = await createCustomerWorkOrder({
      customerCode: current.customerCode,
      category: "退货售后",
      title: `退货质检进度：${current.id}`,
      priority: status === "exception" ? "urgent" : "normal",
      status: status === "restocked" || status === "disposed" || status === "closed" ? "resolved" : "waiting_customer",
      referenceNo: current.id,
      description: [
        "退货质检结果已更新，请查看处理方式并按需回复运营。",
        `退货单：${current.id}`,
        `平台/订单：${current.platform} / ${current.originalOrderNo || "订单号待补"}`,
        `退货追踪号：${current.buyerReturnTracking || "待补"}`,
        `当前状态：${returnOrderStatusLabel(current.status)}`,
        `处理方式：${returnResolutionLabel(current.resolution)}`,
        current.inspectionResult ? `质检结果：${current.inspectionResult}` : "",
        current.locationCode ? `上架/处理库位：${current.locationCode}` : "",
        current.opsNote ? `运营备注：${current.opsNote}` : "",
      ].filter(Boolean).join("\n"),
      initialAuthorRole: "system",
      initialAuthorName: "退货质检系统",
    });
    current.workOrderId = workOrder.id;
  } else if (shouldSyncWorkOrder && current.workOrderId) {
    await addCustomerWorkOrderMessage({
      id: current.workOrderId,
      customerCode: current.customerCode,
      authorRole: "system",
      authorName: "退货质检系统",
      body: [
        "退货处理进度已更新。",
        `当前状态：${returnOrderStatusLabel(current.status)}`,
        `处理方式：${returnResolutionLabel(current.resolution)}`,
        current.inspectionResult ? `质检结果：${current.inspectionResult}` : "",
        current.locationCode ? `上架/处理库位：${current.locationCode}` : "",
        current.opsNote ? `运营备注：${current.opsNote}` : "",
      ].filter(Boolean).join("\n"),
      visibleToCustomer: true,
      nextStatus: status === "restocked" || status === "disposed" || status === "closed" ? "resolved" : "waiting_customer",
    });
  }

  await writeCoreData(data);
  return current;
}

function resolveReturnOrderFromScan(data: WarehouseCoreData, code: string, activeReturnId?: string) {
  const normalized = normalizeScanCode(code);
  const active = activeReturnId ? data.returnOrders.find((item) => item.id === activeReturnId) : undefined;
  const matched =
    data.returnOrders.find((item) =>
      [item.id, item.buyerReturnTracking, item.originalOrderNo]
        .filter(Boolean)
        .some((token) => normalizeScanCode(token ?? "") === normalized),
    ) ?? active;

  if (!matched) return { order: null, codeType: "return" as ReturnScanRecord["codeType"] };
  if (normalizeScanCode(matched.id) === normalized) return { order: matched, codeType: "return" as ReturnScanRecord["codeType"] };
  if (matched.buyerReturnTracking && normalizeScanCode(matched.buyerReturnTracking) === normalized) return { order: matched, codeType: "tracking" as ReturnScanRecord["codeType"] };
  if (matched.originalOrderNo && normalizeScanCode(matched.originalOrderNo) === normalized) return { order: matched, codeType: "order" as ReturnScanRecord["codeType"] };
  return { order: matched, codeType: "return" as ReturnScanRecord["codeType"] };
}

function resolveReturnSkuFromScan(data: WarehouseCoreData, order: ReturnOrder, code: string) {
  const normalized = normalizeScanCode(code);
  const directLine = order.skuLines.find((line) => normalizeScanCode(line.skuCode) === normalized);
  if (directLine) return directLine.skuCode;

  const sku = data.skus.find((item) => item.customerCode === order.customerCode && normalizeScanCode(item.barcode ?? "") === normalized);
  if (!sku) return "";
  return order.skuLines.some((line) => line.skuCode === sku.skuCode) ? sku.skuCode : "";
}

export async function scanReturnOrderTask({
  action,
  code,
  activeReturnId,
  locationCode,
  operator,
}: {
  action: ReturnScanAction;
  code: string;
  activeReturnId?: string;
  locationCode?: string;
  operator: string;
}) {
  const cleanCode = normalizeScanCode(code);
  if (!cleanCode) return { returnOrder: null, error: "请扫描或输入退货单号、买家退货追踪号、原订单号、SKU 或库位", codeType: "return" as ReturnScanRecord["codeType"] };

  const data = await getWarehouseCoreData();
  const active = activeReturnId ? data.returnOrders.find((item) => item.id === activeReturnId) : undefined;
  const scanLocation = resolveLocationFromScan(data, cleanCode) || locationCode?.trim().toUpperCase() || "";
  const resolved = scanLocation && active ? { order: active, codeType: "location" as ReturnScanRecord["codeType"] } : resolveReturnOrderFromScan(data, cleanCode, activeReturnId);
  const order = resolved.order;

  if (!order) return { returnOrder: null, error: "没有找到匹配的退货预报，请先确认 RMA 单号或买家退货追踪号", codeType: resolved.codeType };
  if (["closed", "disposed"].includes(order.status)) return { returnOrder: order, error: "该退货单已经关闭或报废，不能继续扫码推进", codeType: resolved.codeType };

  const skuCode = resolveReturnSkuFromScan(data, order, cleanCode);
  const codeType: ReturnScanRecord["codeType"] = skuCode ? "sku" : scanLocation ? "location" : resolved.codeType;
  const updatedAt = now();
  const nextLocationCode = scanLocation || locationCode?.trim().toUpperCase() || order.locationCode;
  const nextStatus: ReturnOrderStatus = action === "receive" ? (order.status === "requested" || order.status === "label_sent" || order.status === "in_transit" ? "received" : order.status) : "inspection";
  const scanNote = action === "receive"
    ? `退货到仓扫码：${cleanCode}${nextLocationCode ? `；库位：${nextLocationCode}` : ""}`
    : `退货质检扫码：${skuCode || cleanCode}${nextLocationCode ? `；库位：${nextLocationCode}` : ""}`;

  order.status = nextStatus;
  order.locationCode = nextLocationCode;
  order.updatedAt = updatedAt;
  if (action === "receive" && !order.receivedAt) order.receivedAt = updatedAt;
  if (action === "inspect" && !order.inspectedAt) order.inspectedAt = updatedAt;
  if (action === "inspect" && !order.inspectionResult) order.inspectionResult = skuCode ? `已扫描质检 SKU：${skuCode}` : "已进入扫码质检";
  order.opsNote = scanNote;
  order.scanLogs = appendReturnScanRecord(order, {
    action,
    code: cleanCode,
    codeType,
    skuCode: skuCode || undefined,
    locationCode: nextLocationCode,
    operator,
    scannedAt: updatedAt,
  });

  await writeCoreData(data);
  const synced = await updateReturnOrderStatus({
    id: order.id,
    status: nextStatus,
    inspectionResult: action === "inspect" ? order.inspectionResult : undefined,
    locationCode: nextLocationCode,
    opsNote: scanNote,
    operator,
  });

  return {
    returnOrder: synced ?? order,
    error: null,
    message: action === "receive" ? `退货到仓已记录：${order.id}` : `退货质检已记录：${order.id}`,
    codeType,
  };
}

export async function confirmCustomerReturnResolution({
  id,
  customerCode,
  resolution,
  note,
  operator,
}: {
  id: string;
  customerCode: string;
  resolution: ReturnResolution;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const normalizedCustomer = customerCode.trim().toUpperCase();
  const order = data.returnOrders.find((item) => item.id === id && item.customerCode === normalizedCustomer);
  if (!order) return { order: null, error: "未找到可确认的退货单" };
  if (!["received", "inspection", "repair", "exception"].includes(order.status)) return { order, error: "当前退货状态暂不需要客户确认处理方式" };

  const updatedAt = now();
  const cleanNote = note?.trim();
  order.customerResolutionDecision = resolution;
  order.customerResolutionNote = cleanNote || undefined;
  order.customerResolutionConfirmedAt = updatedAt;
  order.resolution = resolution;
  order.updatedAt = updatedAt;
  order.opsNote = `客户已确认退货处理方式：${returnResolutionLabel(resolution)}${cleanNote ? `；备注：${cleanNote}` : ""}`;

  if (order.workOrderId) {
    await addCustomerWorkOrderMessage({
      id: order.workOrderId,
      customerCode: order.customerCode,
      authorRole: "customer",
      authorName: operator,
      body: [
        `客户确认处理方式：${returnResolutionLabel(resolution)}`,
        cleanNote ? `客户备注：${cleanNote}` : "",
      ].filter(Boolean).join("\n"),
      visibleToCustomer: true,
      nextStatus: "processing",
    });
  }

  await writeCoreData(data);
  return { order, error: null };
}

export async function updateCustomerReturnTracking({
  id,
  customerCode,
  buyerReturnTracking,
  expectedArrivalDate,
  customerNote,
}: {
  id: string;
  customerCode: string;
  buyerReturnTracking?: string;
  expectedArrivalDate?: string;
  customerNote?: string;
}) {
  const data = await getWarehouseCoreData();
  const normalizedCustomer = customerCode.trim().toUpperCase();
  const order = data.returnOrders.find((item) => item.id === id && item.customerCode === normalizedCustomer);
  if (!order) return { order: null, error: "未找到可更新的退货单" };
  if (["restocked", "disposed", "closed"].includes(order.status)) return { order, error: "该退货单已经结束，不能继续补充追踪信息" };

  const tracking = buyerReturnTracking?.trim();
  if (!tracking) return { order, error: "请填写买家退货追踪号" };

  order.buyerReturnTracking = tracking;
  order.expectedArrivalDate = expectedArrivalDate?.trim() || order.expectedArrivalDate;
  order.customerNote = customerNote?.trim() || order.customerNote;
  order.status = order.status === "requested" || order.status === "label_sent" ? "in_transit" : order.status;
  order.updatedAt = now();

  await writeCoreData(data);
  return { order, error: null };
}

export async function putawayInboundInventory({
  customerCode,
  inboundId,
  skuLines,
  locationCode,
  operator,
  note,
}: {
  customerCode: string;
  inboundId: string;
  skuLines: Array<{ skuCode: string; productName?: string; expectedQty?: number }>;
  locationCode?: string;
  operator: string;
  note?: string;
}) {
  const data = await getWarehouseCoreData();
  const updatedAt = now();
  const normalizedCustomer = customerCode.trim().toUpperCase();
  const cleanNote = note?.trim() || "入库上架完成，写入正式库存";
  const cleanLocationCode = locationCode?.trim().toUpperCase();
  let movementCount = 0;

  const lines = skuLines
    .map((line) => ({
      skuCode: line.skuCode.trim().toUpperCase(),
      productName: line.productName?.trim(),
      quantity: Math.max(0, Math.floor(line.expectedQty ?? 0)),
    }))
    .filter((line) => line.skuCode && line.quantity > 0);

  const errors: string[] = [];
  if (cleanLocationCode) {
    const targetLocation = data.locations.find((item) => item.locationCode === cleanLocationCode);
    const lineKeys = new Set(lines.map((line) => `${normalizedCustomer}:${line.skuCode}`));
    if (targetLocation && !(targetLocation.allowMixedSku ?? true) && lineKeys.size > 1) {
      errors.push(`目标库位 ${cleanLocationCode} 不允许混放，本次上架包含多个 SKU`);
    }
    for (const line of lines) {
      const alreadyPosted = data.inventoryMovements.some(
        (movement) => movement.refType === "inbound" && movement.refId === inboundId && movement.skuCode === line.skuCode && movement.movementType === "in",
      );
      if (alreadyPosted) continue;
      const balance = data.inventoryBalances.find((item) => item.customerCode === normalizedCustomer && item.skuCode === line.skuCode);
      const validation = validateLocationPlacement({
        data,
        customerCode: normalizedCustomer,
        skuCode: line.skuCode,
        targetLocationCode: cleanLocationCode,
        balance,
        incomingQty: line.quantity,
        restrictSpecialZones: true,
      });
      if (!validation.ok) errors.push(`${line.skuCode}: ${validation.error}`);
    }
  }
  if (errors.length) return { movementCount, errors };

  lines.forEach((line) => {
      const alreadyPosted = data.inventoryMovements.some(
        (movement) => movement.refType === "inbound" && movement.refId === inboundId && movement.skuCode === line.skuCode && movement.movementType === "in",
      );
      if (alreadyPosted) return;

      if (!data.skus.some((sku) => sku.customerCode === normalizedCustomer && sku.skuCode === line.skuCode)) {
        data.skus.unshift({
          skuCode: line.skuCode,
          customerCode: normalizedCustomer,
          productName: line.productName || line.skuCode,
          status: "active",
        });
      }

      let balance = data.inventoryBalances.find((item) => item.customerCode === normalizedCustomer && item.skuCode === line.skuCode);
      if (!balance) {
        balance = {
          id: `BAL-${normalizedCustomer}-${line.skuCode}`,
          customerCode: normalizedCustomer,
          skuCode: line.skuCode,
          warehouseCode: "SHEFFIELD-MAIN",
          availableQty: 0,
          reservedQty: 0,
          frozenQty: 0,
          defectiveQty: 0,
          inboundQty: 0,
          alertQty: 0,
          agingDays: 0,
          updatedAt,
        };
        data.inventoryBalances.unshift(balance);
      }

      const beforeQty = balance.availableQty + balance.reservedQty;
      balance.availableQty += line.quantity;
      balance.inboundQty = Math.max(0, balance.inboundQty - line.quantity);
      balance.locationCode = cleanLocationCode || balance.locationCode;
      balance.updatedAt = updatedAt;
      data.inventoryMovements.unshift({
        id: makeCoreId("MOV"),
        customerCode: normalizedCustomer,
        skuCode: line.skuCode,
        refType: "inbound",
        refId: inboundId,
        movementType: "in",
        quantity: line.quantity,
        beforeQty,
        afterQty: balance.availableQty + balance.reservedQty,
        note: cleanNote,
        occurredAt: updatedAt,
        operator,
      });
      movementCount += 1;
    });

  await writeCoreData(data);
  return { movementCount, errors };
}

export async function upsertWarehouseLocation({
  locationCode,
  warehouseCode = "SHEFFIELD-MAIN",
  zone = "MAIN",
  zoneType = "standard",
  status = "active",
  capacityCbm,
  capacityQty,
  allowMixedSku = true,
  note,
}: {
  locationCode: string;
  warehouseCode?: string;
  zone?: string;
  zoneType?: WarehouseLocationZoneType;
  status?: WarehouseLocation["status"];
  capacityCbm?: number;
  capacityQty?: number;
  allowMixedSku?: boolean;
  note?: string;
}) {
  const data = await getWarehouseCoreData();
  const updatedAt = now();
  const cleanLocationCode = locationCode.trim().toUpperCase();
  if (!cleanLocationCode) return null;
  const location: WarehouseLocation = {
    locationCode: cleanLocationCode,
    warehouseCode: warehouseCode.trim().toUpperCase() || "SHEFFIELD-MAIN",
    zone: zone.trim() || "MAIN",
    zoneType: normalizeLocationZoneType(zoneType),
    status,
    capacityCbm: typeof capacityCbm === "number" && Number.isFinite(capacityCbm) && capacityCbm > 0 ? capacityCbm : undefined,
    capacityQty: typeof capacityQty === "number" && Number.isFinite(capacityQty) && capacityQty > 0 ? Math.floor(capacityQty) : undefined,
    allowMixedSku,
    note: note?.trim() || undefined,
    updatedAt,
  };
  const index = data.locations.findIndex((item) => item.locationCode === cleanLocationCode);
  if (index >= 0) {
    data.locations[index] = { ...data.locations[index], ...location };
  } else {
    data.locations.unshift(location);
  }
  await writeCoreData(data);
  return location;
}

export async function importWarehouseLocationsCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = lines[0]?.toLowerCase().includes("location") ? lines.slice(1) : lines;
  let imported = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const [locationCode = "", warehouseCode = "SHEFFIELD-MAIN", zone = "MAIN", status = "active", capacity = "", note = "", zoneType = "standard", capacityQty = "", allowMixedSku = "true"] = row.split(/[,，\t|]/).map((part) => part.trim());
    if (!locationCode) {
      errors.push(`第 ${index + 1} 行缺少库位编码`);
      continue;
    }
    if (!["active", "blocked", "reserved"].includes(status)) {
      errors.push(`第 ${index + 1} 行状态无效`);
      continue;
    }
    await upsertWarehouseLocation({
      locationCode,
      warehouseCode,
      zone,
      zoneType: normalizeLocationZoneType(zoneType),
      status: status as WarehouseLocation["status"],
      capacityCbm: capacity ? Number(capacity) : undefined,
      capacityQty: capacityQty ? Number(capacityQty) : undefined,
      allowMixedSku: !["false", "0", "否", "不允许"].includes(allowMixedSku.toLowerCase()),
      note,
    });
    imported += 1;
  }

  return { imported, errors };
}

export async function adjustInventoryBalance({
  customerCode,
  skuCode,
  availableDelta,
  reservedDelta = 0,
  alertQty,
  agingDays,
  note,
  operator,
}: {
  customerCode: string;
  skuCode: string;
  availableDelta: number;
  reservedDelta?: number;
  alertQty?: number;
  agingDays?: number;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const normalizedSku = skuCode.trim().toUpperCase();
  const balance = data.inventoryBalances.find((item) => item.customerCode === customerCode && item.skuCode === normalizedSku);
  if (!balance) return null;

  const updatedAt = now();
  const beforeQty = balance.availableQty + balance.reservedQty;
  balance.availableQty = Math.max(0, balance.availableQty + availableDelta);
  balance.reservedQty = Math.max(0, balance.reservedQty + reservedDelta);
  if (typeof alertQty === "number" && Number.isFinite(alertQty) && alertQty >= 0) balance.alertQty = Math.floor(alertQty);
  if (typeof agingDays === "number" && Number.isFinite(agingDays) && agingDays >= 0) balance.agingDays = Math.floor(agingDays);
  balance.updatedAt = updatedAt;

  data.inventoryMovements.unshift({
    id: makeCoreId("MOV"),
    customerCode,
    skuCode: normalizedSku,
    refType: "adjustment",
    refId: makeCoreId("ADJ"),
    movementType: "adjust",
    quantity: availableDelta + reservedDelta,
    beforeQty,
    afterQty: balance.availableQty + balance.reservedQty,
    note: note?.trim() || "运营库存调整",
    occurredAt: updatedAt,
    operator,
  });

  await writeCoreData(data);
  return balance;
}

export async function createInventoryAdjustmentRequest({
  balanceId,
  customerCode,
  skuCode,
  availableDelta,
  reservedDelta = 0,
  alertQty,
  agingDays,
  controlAction = "manual_adjust",
  quantity,
  nextLocationCode,
  reason,
  requestedBy,
  requestedByRole,
}: {
  balanceId?: string;
  customerCode: string;
  skuCode: string;
  availableDelta: number;
  reservedDelta?: number;
  alertQty?: number;
  agingDays?: number;
  controlAction?: InventoryControlAction;
  quantity?: number;
  nextLocationCode?: string;
  reason: string;
  requestedBy: string;
  requestedByRole: string;
}) {
  const data = await getWarehouseCoreData();
  const normalizedSku = skuCode.trim().toUpperCase();
  const balance = balanceId
    ? data.inventoryBalances.find((item) => item.id === balanceId && item.customerCode === customerCode && item.skuCode === normalizedSku)
    : data.inventoryBalances.find((item) => item.customerCode === customerCode && item.skuCode === normalizedSku);
  if (!balance) return null;

  const requestedAt = now();
  const cleanQuantity = Math.max(0, Math.floor(Number(quantity ?? 0)));
  const cleanNextLocationCode = nextLocationCode?.trim().toUpperCase() || undefined;
  let nextAvailableDelta = Math.floor(Number(availableDelta) || 0);
  let nextReservedDelta = Math.floor(Number(reservedDelta) || 0);
  let nextFrozenDelta = 0;
  let nextDefectiveDelta = 0;
  if (controlAction === "freeze") {
    nextAvailableDelta = -cleanQuantity;
    nextReservedDelta = 0;
    nextFrozenDelta = cleanQuantity;
  }
  if (controlAction === "release") {
    nextAvailableDelta = cleanQuantity;
    nextReservedDelta = 0;
    nextFrozenDelta = -cleanQuantity;
  }
  if (controlAction === "defective") {
    nextAvailableDelta = -cleanQuantity;
    nextReservedDelta = 0;
    nextDefectiveDelta = cleanQuantity;
  }
  if (controlAction === "restore") {
    nextAvailableDelta = cleanQuantity;
    nextReservedDelta = 0;
    nextDefectiveDelta = -cleanQuantity;
  }
  if (controlAction === "move_location") {
    nextAvailableDelta = 0;
    nextReservedDelta = 0;
  }

  const adjustment: InventoryAdjustmentRequest = {
    id: makeCoreId("ADJ"),
    balanceId: balance.id,
    customerCode,
    skuCode: normalizedSku,
    warehouseCode: balance.warehouseCode,
    locationCode: balance.locationCode,
    status: "pending",
    availableDelta: nextAvailableDelta,
    reservedDelta: nextReservedDelta,
    frozenDelta: nextFrozenDelta,
    defectiveDelta: nextDefectiveDelta,
    alertQty,
    agingDays,
    controlAction,
    quantity: cleanQuantity || undefined,
    beforeLocationCode: balance.locationCode,
    nextLocationCode: cleanNextLocationCode,
    beforeAvailableQty: balance.availableQty,
    beforeReservedQty: balance.reservedQty,
    beforeFrozenQty: balance.frozenQty ?? 0,
    beforeDefectiveQty: balance.defectiveQty ?? 0,
    reason: reason.trim(),
    requestedBy,
    requestedByRole,
    requestedAt,
    approvalTimeline: [approvalEvent("submitted", "提交库存调整审批", requestedBy, reason, requestedAt)],
  };

  data.inventoryAdjustments.unshift(adjustment);
  await writeCoreData(data);
  return adjustment;
}

export async function reviewInventoryAdjustmentRequest({
  id,
  decision,
  reviewNote,
  reviewedBy,
}: {
  id: string;
  decision: "approve" | "reject";
  reviewNote?: string;
  reviewedBy: string;
}) {
  const data = await getWarehouseCoreData();
  const adjustment = data.inventoryAdjustments.find((item) => item.id === id);
  if (!adjustment) return { adjustment: null, balance: null, error: "未找到库存调整申请" };
  if (adjustment.status !== "pending") return { adjustment, balance: null, error: "该库存调整申请已审核" };

  const reviewedAt = now();
  adjustment.reviewedBy = reviewedBy;
  adjustment.reviewedAt = reviewedAt;
  adjustment.reviewNote = reviewNote?.trim() || undefined;

  const syncStocktakeBatch = () => {
    const batch = data.stocktakeBatches.find((item) => item.adjustmentIds?.includes(adjustment.id));
    if (!batch || batch.status !== "pending_approval" || !(batch.adjustmentIds?.length)) return;
    const related = batch.adjustmentIds
      .map((adjustmentId) => data.inventoryAdjustments.find((item) => item.id === adjustmentId))
      .filter((item): item is InventoryAdjustmentRequest => Boolean(item));
    if (related.length === batch.adjustmentIds.length && related.every((item) => item.status !== "pending")) {
      batch.status = "completed";
      batch.completedBy = reviewedBy;
      batch.completedAt = reviewedAt;
      batch.updatedAt = reviewedAt;
    }
  };

  if (decision === "reject") {
    adjustment.status = "rejected";
    adjustment.approvalTimeline = appendApprovalTimeline(adjustment.approvalTimeline, approvalEvent("rejected", "驳回库存调整", reviewedBy, adjustment.reviewNote, reviewedAt));
    syncStocktakeBatch();
    await writeCoreData(data);
    return { adjustment, balance: null, error: null };
  }

  const balance = data.inventoryBalances.find((item) => item.customerCode === adjustment.customerCode && item.skuCode === adjustment.skuCode);
  if (!balance) return { adjustment, balance: null, error: "未找到对应库存记录" };
  const normalizedBalance = normalizeInventoryBalance(balance);
  Object.assign(balance, normalizedBalance);

  const nextAvailableQty = balance.availableQty + adjustment.availableDelta;
  const nextReservedQty = balance.reservedQty + adjustment.reservedDelta;
  const nextFrozenQty = (balance.frozenQty ?? 0) + (adjustment.frozenDelta ?? 0);
  const nextDefectiveQty = (balance.defectiveQty ?? 0) + (adjustment.defectiveDelta ?? 0);
  if (nextAvailableQty < 0 || nextReservedQty < 0 || nextFrozenQty < 0 || nextDefectiveQty < 0) {
    return { adjustment, balance, error: "库存调整后不能出现负库存" };
  }
  if (adjustment.controlAction === "move_location" && adjustment.nextLocationCode) {
    const validation = validateLocationMove(data, balance, adjustment.nextLocationCode);
    if (!validation.ok) return { adjustment, balance, error: validation.error };
  }

  const beforeQty = inventoryTotalQty(balance);
  balance.availableQty = nextAvailableQty;
  balance.reservedQty = nextReservedQty;
  balance.frozenQty = nextFrozenQty;
  balance.defectiveQty = nextDefectiveQty;
  if (typeof adjustment.alertQty === "number" && Number.isFinite(adjustment.alertQty) && adjustment.alertQty >= 0) balance.alertQty = Math.floor(adjustment.alertQty);
  if (typeof adjustment.agingDays === "number" && Number.isFinite(adjustment.agingDays) && adjustment.agingDays >= 0) balance.agingDays = Math.floor(adjustment.agingDays);
  if (adjustment.nextLocationCode) balance.locationCode = adjustment.nextLocationCode;
  balance.updatedAt = reviewedAt;
  adjustment.status = "approved";
  adjustment.approvalTimeline = appendApprovalTimeline(adjustment.approvalTimeline, approvalEvent("approved", "审批通过库存调整", reviewedBy, adjustment.reviewNote, reviewedAt));
  syncStocktakeBatch();

  data.inventoryMovements.unshift({
    id: makeCoreId("MOV"),
    customerCode: adjustment.customerCode,
    skuCode: adjustment.skuCode,
    refType: "adjustment",
    refId: adjustment.id,
    movementType: "adjust",
    quantity: adjustment.availableDelta + adjustment.reservedDelta + (adjustment.frozenDelta ?? 0) + (adjustment.defectiveDelta ?? 0),
    beforeQty,
    afterQty: inventoryTotalQty(balance),
    note: adjustment.reviewNote ? `${adjustment.reason} / ${adjustment.reviewNote}` : adjustment.reason,
    occurredAt: reviewedAt,
    operator: reviewedBy,
  });

  await writeCoreData(data);
  return { adjustment, balance, error: null };
}

function normalizeSerialNumbers(value: string[] | string | undefined) {
  const items = (Array.isArray(value) ? value : (value ?? "").split(/[,\n，\s]+/))
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(items));
}

function rawSerialNumbers(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value.map((item) => item.trim().toUpperCase()).filter(Boolean);
  return (value ?? "")
    .split(/[,\n，\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function initializeSerialStatuses(lot: InventoryLot, updatedAt: string, updatedBy?: string) {
  if (!lot.serialNumbers?.length) return;
  const existing = new Map((lot.serialNumberStatuses ?? []).map((item) => [item.serialNumber, item]));
  lot.serialNumberStatuses = lot.serialNumbers.map((serialNumber) => existing.get(serialNumber) ?? {
    serialNumber,
    status: "active",
    updatedAt,
    updatedBy,
  });
}

function transitionSerialStatuses(lot: InventoryLot, fromStatuses: InventorySerialStatus[], toStatus: InventorySerialStatus, quantity: number, updatedAt: string, updatedBy: string) {
  if (!lot.serialNumbers?.length || quantity <= 0) return;
  initializeSerialStatuses(lot, updatedAt, updatedBy);
  let remaining = quantity;
  for (const fromStatus of fromStatuses) {
    lot.serialNumberStatuses = (lot.serialNumberStatuses ?? []).map((record) => {
      if (remaining <= 0 || record.status !== fromStatus) return record;
      remaining -= 1;
      return {
        ...record,
        status: toStatus,
        updatedAt,
        updatedBy,
      };
    });
    if (remaining <= 0) break;
  }
}

function lotStatusByExpiry(expiryDate: string | undefined, status: InventoryLotStatus): InventoryLotStatus {
  if (status === "depleted" || status === "blocked") return status;
  if (!expiryDate) return status;
  const today = new Date().toISOString().slice(0, 10);
  return expiryDate < today ? "expired" : status;
}

function daysUntilExpiry(expiryDate?: string) {
  if (!expiryDate) return undefined;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const expiry = new Date(`${expiryDate}T00:00:00`).getTime();
  if (!Number.isFinite(expiry)) return undefined;
  return Math.ceil((expiry - today) / 86_400_000);
}

export function suggestOutboundLotAllocations(order: Pick<CoreOutboundOrder, "customerCode" | "skuLines">, lots: InventoryLot[]): OutboundLotAllocation[] {
  return (order.skuLines ?? []).map((line) => {
    let remaining = Math.max(0, Math.floor(line.quantity));
    const candidates = lots
      .filter((lot) => lot.customerCode === order.customerCode && lot.skuCode === line.skuCode && lot.availableQty > 0)
      .filter((lot) => lotStatusByExpiry(lot.expiryDate, lot.status) === "active")
      .sort((a, b) => {
        const expiryA = a.expiryDate || "9999-12-31";
        const expiryB = b.expiryDate || "9999-12-31";
        if (expiryA !== expiryB) return expiryA.localeCompare(expiryB);
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const allocation: OutboundLotAllocation["lots"] = [];
    for (const lot of candidates) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, lot.availableQty);
      if (quantity <= 0) continue;
      allocation.push({
        lotId: lot.id,
        lotNo: lot.lotNo,
        quantity,
        availableQty: lot.availableQty,
        locationCode: lot.locationCode,
        expiryDate: lot.expiryDate,
        status: lot.status,
        daysUntilExpiry: daysUntilExpiry(lot.expiryDate),
      });
      remaining -= quantity;
    }

    const allocatedQty = allocation.reduce((sum, item) => sum + item.quantity, 0);
    return {
      skuCode: line.skuCode,
      requiredQty: Math.max(0, Math.floor(line.quantity)),
      allocatedQty,
      shortageQty: Math.max(0, remaining),
      lots: allocation,
    };
  });
}

export async function createInventoryLot(input: {
  customerCode: string;
  skuCode: string;
  warehouseCode?: string;
  locationCode?: string;
  lotNo: string;
  expiryDate?: string;
  serialNumbers?: string[] | string;
  quantity: number;
  note?: string;
  createdBy: string;
}) {
  const data = await getWarehouseCoreData();
  const customerCode = input.customerCode.trim().toUpperCase();
  const skuCode = input.skuCode.trim().toUpperCase();
  const lotNo = input.lotNo.trim().toUpperCase();
  const quantity = Math.floor(Number(input.quantity));
  const rawSerials = rawSerialNumbers(input.serialNumbers);
  const serialNumbers = normalizeSerialNumbers(input.serialNumbers);
  if (!customerCode || !skuCode || !lotNo || !Number.isFinite(quantity) || quantity <= 0) return { lot: null, error: "请填写客户、SKU、批次号和大于 0 的数量" };
  if (!data.customers.some((item) => item.customerCode === customerCode)) return { lot: null, error: "未找到客户" };
  if (!data.skus.some((item) => item.customerCode === customerCode && item.skuCode === skuCode)) return { lot: null, error: "未找到该客户的 SKU" };
  if (data.inventoryLots.some((item) => item.customerCode === customerCode && item.skuCode === skuCode && item.lotNo === lotNo)) return { lot: null, error: "该客户和 SKU 已存在相同批次号" };
  if (rawSerials.length !== serialNumbers.length) return { lot: null, error: "序列号存在重复，请检查后再登记" };
  if (serialNumbers.length > quantity) return { lot: null, error: "序列号数量不能超过批次数量" };
  const duplicateSerial = data.inventoryLots
    .filter((item) => item.customerCode === customerCode && item.skuCode === skuCode && item.status !== "depleted")
    .flatMap((item) => item.serialNumbers ?? [])
    .find((serialNumber) => serialNumbers.includes(serialNumber.toUpperCase()));
  if (duplicateSerial) return { lot: null, error: `序列号 ${duplicateSerial} 已在同客户同 SKU 的其他未耗尽批次中存在` };

  const createdAt = now();
  const lot: InventoryLot = {
    id: makeCoreId("LOT"),
    customerCode,
    skuCode,
    warehouseCode: input.warehouseCode?.trim().toUpperCase() || "SHEFFIELD-MAIN",
    locationCode: input.locationCode?.trim().toUpperCase() || undefined,
    lotNo,
    expiryDate: input.expiryDate?.trim() || undefined,
    serialNumbers,
    serialNumberStatuses: serialNumbers.map((serialNumber) => ({ serialNumber, status: "active", updatedAt: createdAt, updatedBy: input.createdBy })),
    quantity,
    availableQty: quantity,
    reservedQty: 0,
    status: lotStatusByExpiry(input.expiryDate?.trim(), "active"),
    note: input.note?.trim() || undefined,
    createdBy: input.createdBy,
    createdAt,
    updatedAt: createdAt,
  };
  data.inventoryLots.unshift(lot);
  await writeCoreData(data);
  return { lot, error: null };
}

export async function updateInventoryLot(input: {
  id: string;
  action: "reserve" | "release" | "consume" | "block" | "activate" | "update";
  quantity?: number;
  locationCode?: string;
  expiryDate?: string;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const lot = data.inventoryLots.find((item) => item.id === input.id);
  if (!lot) return { lot: null, error: "未找到库存批次" };

  const updatedAt = now();
  const quantity = Math.floor(Number(input.quantity ?? 0));
  if (input.action === "reserve") {
    if (quantity <= 0 || quantity > lot.availableQty) return { lot, error: "预留数量无效或超过可用库存" };
    lot.availableQty -= quantity;
    lot.reservedQty += quantity;
    lot.status = "reserved";
    transitionSerialStatuses(lot, ["active"], "reserved", quantity, updatedAt, input.operator);
  }
  if (input.action === "release") {
    if (quantity <= 0 || quantity > lot.reservedQty) return { lot, error: "释放数量无效或超过已预留库存" };
    lot.availableQty += quantity;
    lot.reservedQty -= quantity;
    lot.status = lot.reservedQty > 0 ? "reserved" : "active";
    transitionSerialStatuses(lot, ["reserved"], "active", quantity, updatedAt, input.operator);
  }
  if (input.action === "consume") {
    if (quantity <= 0 || quantity > lot.availableQty + lot.reservedQty) return { lot, error: "扣减数量无效或超过当前批次库存" };
    const fromReserved = Math.min(lot.reservedQty, quantity);
    const fromAvailable = quantity - fromReserved;
    lot.reservedQty -= fromReserved;
    lot.availableQty -= fromAvailable;
    lot.status = lot.availableQty + lot.reservedQty <= 0 ? "depleted" : lot.reservedQty > 0 ? "reserved" : "active";
    transitionSerialStatuses(lot, ["reserved", "active"], "consumed", quantity, updatedAt, input.operator);
  }
  if (input.action === "block") {
    lot.status = "blocked";
    initializeSerialStatuses(lot, updatedAt, input.operator);
    lot.serialNumberStatuses = lot.serialNumberStatuses?.map((record) => record.status === "consumed" ? record : { ...record, status: "blocked", updatedAt, updatedBy: input.operator });
  }
  if (input.action === "activate") {
    lot.status = "active";
    initializeSerialStatuses(lot, updatedAt, input.operator);
    let reservedToRestore = lot.reservedQty;
    lot.serialNumberStatuses = lot.serialNumberStatuses?.map((record) => {
      if (record.status !== "blocked") return record;
      if (reservedToRestore > 0) {
        reservedToRestore -= 1;
        return { ...record, status: "reserved", updatedAt, updatedBy: input.operator };
      }
      return { ...record, status: "active", updatedAt, updatedBy: input.operator };
    });
    lot.status = lot.reservedQty > 0 ? "reserved" : "active";
  }
  if (input.locationCode !== undefined) lot.locationCode = input.locationCode.trim().toUpperCase() || undefined;
  if (input.expiryDate !== undefined) lot.expiryDate = input.expiryDate.trim() || undefined;
  lot.status = lotStatusByExpiry(lot.expiryDate, lot.status);
  lot.note = input.note?.trim() || lot.note;
  lot.updatedAt = updatedAt;

  data.inventoryMovements.unshift({
    id: makeCoreId("MOV"),
    customerCode: lot.customerCode,
    skuCode: lot.skuCode,
    refType: "adjustment",
    refId: lot.id,
    movementType: input.action === "consume" ? "out" : input.action === "reserve" ? "reserve" : input.action === "release" ? "release" : "adjust",
    quantity: quantity || 0,
    note: input.note?.trim() || `Lot ${lot.lotNo} ${input.action}`,
    occurredAt: updatedAt,
    operator: input.operator,
  });

  await writeCoreData(data);
  return { lot, error: null };
}

function summarizeStocktakeItems(items: StocktakeBatchItem[]) {
  const differenceItems = items.filter((item) => typeof item.differenceQty === "number" && item.differenceQty !== 0);
  return {
    itemCount: items.length,
    differenceCount: differenceItems.length,
    totalDifferenceQty: differenceItems.reduce((sum, item) => sum + (item.differenceQty ?? 0), 0),
  };
}

function buildStocktakeItem(balance: InventoryBalance): StocktakeBatchItem {
  return {
    balanceId: balance.id,
    customerCode: balance.customerCode,
    skuCode: balance.skuCode,
    warehouseCode: balance.warehouseCode,
    locationCode: balance.locationCode,
    systemAvailableQty: balance.availableQty,
    systemReservedQty: balance.reservedQty,
  };
}

export function buildStocktakeCandidates(data: WarehouseCoreData) {
  return [...data.inventoryBalances]
    .sort((a, b) => {
      const riskScore = (item: InventoryBalance) => (item.availableQty < item.alertQty ? 100 : 0) + Math.min(item.agingDays, 180) + item.reservedQty + (item.frozenQty ?? 0) * 2 + (item.defectiveQty ?? 0) * 3;
      return riskScore(b) - riskScore(a);
    })
    .slice(0, 20)
    .map((balance) => ({
      ...buildStocktakeItem(balance),
      alertQty: balance.alertQty,
      agingDays: balance.agingDays,
      inboundQty: balance.inboundQty,
      riskLabels: [
        balance.availableQty < balance.alertQty ? "低于安全库存" : "",
        balance.agingDays >= 120 ? "库龄偏高" : "",
        balance.reservedQty > balance.availableQty ? "占用偏高" : "",
        (balance.frozenQty ?? 0) > 0 ? "存在冻结库存" : "",
        (balance.defectiveQty ?? 0) > 0 ? "存在残次品" : "",
      ].filter(Boolean),
    }));
}

export async function createStocktakeBatch({
  warehouseCode,
  customerCode,
  balanceIds,
  note,
  createdBy,
}: {
  warehouseCode?: string;
  customerCode?: string;
  balanceIds?: string[];
  note?: string;
  createdBy: string;
}) {
  const data = await getWarehouseCoreData();
  const selectedIds = new Set((balanceIds ?? []).map((id) => id.trim()).filter(Boolean));
  const cleanWarehouse = warehouseCode?.trim().toUpperCase();
  const cleanCustomer = customerCode?.trim();
  const candidates = data.inventoryBalances.filter((balance) => {
    if (selectedIds.size > 0) return selectedIds.has(balance.id);
    if (cleanWarehouse && balance.warehouseCode !== cleanWarehouse) return false;
    if (cleanCustomer && balance.customerCode !== cleanCustomer) return false;
    return balance.availableQty < balance.alertQty || balance.agingDays >= 120 || balance.reservedQty > balance.availableQty || (balance.frozenQty ?? 0) > 0 || (balance.defectiveQty ?? 0) > 0;
  });
  const fallback = data.inventoryBalances.filter((balance) => (!cleanWarehouse || balance.warehouseCode === cleanWarehouse) && (!cleanCustomer || balance.customerCode === cleanCustomer));
  const items = (candidates.length > 0 ? candidates : fallback).slice(0, 30).map(buildStocktakeItem);
  if (items.length === 0) return { batch: null, error: "没有可盘点的库存记录" };

  const createdAt = now();
  const summary = summarizeStocktakeItems(items);
  const batch: StocktakeBatch = {
    id: makeCoreId("STK"),
    warehouseCode: cleanWarehouse || items[0]?.warehouseCode || "SHEFFIELD-MAIN",
    customerCode: cleanCustomer || (new Set(items.map((item) => item.customerCode)).size === 1 ? items[0]?.customerCode : undefined),
    status: "draft",
    ...summary,
    note: note?.trim() || "库存盘点批次",
    items,
    adjustmentIds: [],
    createdBy,
    createdAt,
    updatedAt: createdAt,
  };

  data.stocktakeBatches.unshift(batch);
  await writeCoreData(data);
  return { batch, error: null };
}

export async function countStocktakeBatchItem({
  batchId,
  balanceId,
  countedAvailableQty,
  note,
  countedBy,
}: {
  batchId: string;
  balanceId: string;
  countedAvailableQty: number;
  note?: string;
  countedBy: string;
}) {
  const data = await getWarehouseCoreData();
  const batch = data.stocktakeBatches.find((item) => item.id === batchId);
  if (!batch) return { batch: null, error: "未找到盘点批次" };
  if (["pending_approval", "completed", "cancelled"].includes(batch.status)) return { batch, error: "当前盘点状态不能继续录入数量" };

  const line = batch.items.find((item) => item.balanceId === balanceId);
  if (!line) return { batch, error: "未找到盘点明细" };
  const cleanCount = Math.floor(Number(countedAvailableQty));
  if (!Number.isFinite(cleanCount) || cleanCount < 0) return { batch, error: "实盘数量必须是不小于 0 的数字" };

  const countedAt = now();
  line.countedAvailableQty = cleanCount;
  line.differenceQty = cleanCount - line.systemAvailableQty;
  line.note = note?.trim() || line.note;
  line.countedBy = countedBy;
  line.countedAt = countedAt;
  batch.status = "counting";
  Object.assign(batch, summarizeStocktakeItems(batch.items));
  batch.updatedAt = countedAt;

  await writeCoreData(data);
  return { batch, error: null };
}

export async function submitStocktakeBatch({
  batchId,
  submittedBy,
  approvalNote,
}: {
  batchId: string;
  submittedBy: string;
  approvalNote?: string;
}) {
  const data = await getWarehouseCoreData();
  const batch = data.stocktakeBatches.find((item) => item.id === batchId);
  if (!batch) return { batch: null, createdAdjustments: [], error: "未找到盘点批次" };
  if (batch.status === "completed" || batch.status === "cancelled") return { batch, createdAdjustments: [], error: "盘点批次已关闭" };

  const uncounted = batch.items.filter((item) => typeof item.countedAvailableQty !== "number");
  if (uncounted.length > 0) return { batch, createdAdjustments: [], error: "盘点批次仍有未录入数量的明细" };

  const submittedAt = now();
  const createdAdjustments: InventoryAdjustmentRequest[] = [];
  for (const line of batch.items) {
    const differenceQty = line.differenceQty ?? 0;
    if (differenceQty === 0) continue;
    const adjustment: InventoryAdjustmentRequest = {
      id: makeCoreId("ADJ"),
      customerCode: line.customerCode,
      skuCode: line.skuCode,
      warehouseCode: line.warehouseCode,
      locationCode: line.locationCode,
      status: "pending",
      availableDelta: differenceQty,
      reservedDelta: 0,
      frozenDelta: 0,
      defectiveDelta: 0,
      beforeAvailableQty: line.systemAvailableQty,
      beforeReservedQty: line.systemReservedQty,
      beforeFrozenQty: 0,
      beforeDefectiveQty: 0,
      reason: [`盘点批次 ${batch.id} 差异：账面 ${line.systemAvailableQty}，实盘 ${line.countedAvailableQty}`, approvalNote?.trim()].filter(Boolean).join(" / "),
      requestedBy: submittedBy,
      requestedByRole: "stocktake",
      requestedAt: submittedAt,
    };
    data.inventoryAdjustments.unshift(adjustment);
    createdAdjustments.push(adjustment);
  }

  batch.adjustmentIds = [...(batch.adjustmentIds ?? []), ...createdAdjustments.map((item) => item.id)];
  batch.status = createdAdjustments.length > 0 ? "pending_approval" : "completed";
  batch.submittedBy = submittedBy;
  batch.submittedAt = submittedAt;
  batch.note = [batch.note, approvalNote?.trim()].filter(Boolean).join(" / ") || batch.note;
  batch.updatedAt = submittedAt;
  Object.assign(batch, summarizeStocktakeItems(batch.items));

  await writeCoreData(data);
  return { batch, createdAdjustments, error: null };
}

function estimateDailySales(balance: InventoryBalance) {
  const signalQty = Math.max(balance.reservedQty, Math.ceil(balance.alertQty * 0.35));
  return Math.max(1, Math.ceil(signalQty / 14));
}

export function buildReplenishmentSuggestions(data: WarehouseCoreData): ReplenishmentSuggestion[] {
  return data.inventoryBalances
    .map((balance) => {
      const dailySalesEstimate = estimateDailySales(balance);
      const coverBaseQty = Math.max(0, balance.availableQty + balance.inboundQty - balance.reservedQty);
      const daysOfCover = Math.floor(coverBaseQty / dailySalesEstimate);
      const targetQty = Math.max(balance.alertQty * 2, dailySalesEstimate * 30);
      const recommendedQty = Math.max(0, targetQty - coverBaseQty);
      const status: ReplenishmentSuggestionStatus =
        balance.availableQty <= balance.alertQty || daysOfCover <= 14 ? "replenish_now" : daysOfCover <= 30 ? "watch" : "healthy";
      const reason =
        status === "replenish_now"
          ? "可售库存低于安全库存或覆盖天数不足，需要安排补货/调拨。"
          : status === "watch"
            ? "库存覆盖天数接近预警线，建议提前确认补货节奏。"
            : "库存覆盖仍在安全范围。";

      return {
        id: `SUG-${balance.id}`,
        balanceId: balance.id,
        customerCode: balance.customerCode,
        skuCode: balance.skuCode,
        warehouseCode: balance.warehouseCode,
        locationCode: balance.locationCode,
        availableQty: balance.availableQty,
        reservedQty: balance.reservedQty,
        inboundQty: balance.inboundQty,
        alertQty: balance.alertQty,
        dailySalesEstimate,
        daysOfCover,
        recommendedQty,
        status,
        reason,
      };
    })
    .sort((a, b) => {
      const rank: Record<ReplenishmentSuggestionStatus, number> = { replenish_now: 0, watch: 1, healthy: 2 };
      return rank[a.status] - rank[b.status] || b.recommendedQty - a.recommendedQty;
    });
}

export async function createReplenishmentPlanFromBalance({
  balanceId,
  plannedQty,
  note,
  createdBy,
}: {
  balanceId: string;
  plannedQty?: number;
  note?: string;
  createdBy: string;
}) {
  const data = await getWarehouseCoreData();
  const balance = data.inventoryBalances.find((item) => item.id === balanceId);
  if (!balance) return { plan: null, error: "未找到对应库存记录" };

  const suggestion = buildReplenishmentSuggestions(data).find((item) => item.balanceId === balanceId);
  const fallbackQty = suggestion?.recommendedQty || Math.max(1, balance.alertQty - balance.availableQty);
  const cleanQty = Math.floor(Number(plannedQty ?? fallbackQty));
  if (!Number.isFinite(cleanQty) || cleanQty <= 0) return { plan: null, error: "计划补货数量必须大于 0" };

  const createdAt = now();
  const plan: ReplenishmentPlan = {
    id: makeCoreId("REP"),
    customerCode: balance.customerCode,
    skuCode: balance.skuCode,
    targetWarehouseCode: balance.warehouseCode,
    locationCode: balance.locationCode,
    plannedQty: cleanQty,
    recommendedQty: suggestion?.recommendedQty ?? fallbackQty,
    status: "submitted",
    sourceBalanceId: balance.id,
    note: note?.trim() || suggestion?.reason,
    createdBy,
    createdAt,
    updatedAt: createdAt,
  };

  data.replenishmentPlans.unshift(plan);
  await writeCoreData(data);
  return { plan, error: null };
}

export async function createTransferOrderFromBalance({
  balanceId,
  fromWarehouseCode,
  toWarehouseCode,
  quantity,
  relatedPlanId,
  note,
  createdBy,
}: {
  balanceId: string;
  fromWarehouseCode?: string;
  toWarehouseCode?: string;
  quantity?: number;
  relatedPlanId?: string;
  note?: string;
  createdBy: string;
}) {
  const data = await getWarehouseCoreData();
  const balance = data.inventoryBalances.find((item) => item.id === balanceId);
  if (!balance) return { transfer: null, error: "未找到对应库存记录" };

  const suggestion = buildReplenishmentSuggestions(data).find((item) => item.balanceId === balanceId);
  const cleanQty = Math.floor(Number(quantity ?? suggestion?.recommendedQty ?? Math.max(1, balance.alertQty - balance.availableQty)));
  if (!Number.isFinite(cleanQty) || cleanQty <= 0) return { transfer: null, error: "调拨数量必须大于 0" };

  const cleanToWarehouse = toWarehouseCode?.trim().toUpperCase() || balance.warehouseCode;
  const cleanFromWarehouse = fromWarehouseCode?.trim().toUpperCase() || (cleanToWarehouse === "SHEFFIELD-MAIN" ? "SHEFFIELD-TRANSIT" : "SHEFFIELD-MAIN");
  if (cleanFromWarehouse === cleanToWarehouse) return { transfer: null, error: "调出仓和调入仓不能相同" };

  const createdAt = now();
  const transfer: TransferOrder = {
    id: makeCoreId("TRF"),
    customerCode: balance.customerCode,
    skuCode: balance.skuCode,
    fromWarehouseCode: cleanFromWarehouse,
    toWarehouseCode: cleanToWarehouse,
    quantity: cleanQty,
    receivedQty: 0,
    status: "new",
    progress: 0,
    relatedPlanId: relatedPlanId?.trim() || undefined,
    note: note?.trim() || suggestion?.reason,
    createdBy,
    createdAt,
    updatedAt: createdAt,
    approvalTimeline: [approvalEvent("submitted", "创建调拨审批", createdBy, note?.trim() || suggestion?.reason, createdAt)],
  };

  data.transferOrders.unshift(transfer);
  await writeCoreData(data);
  return { transfer, error: null };
}

export type TransferLifecycleAction = "approve" | "start_picking" | "ship" | "receive" | "partial_receive" | "mark_exception" | "cancel";

function findTransferBalance(data: WarehouseCoreData, customerCode: string, skuCode: string, warehouseCode: string) {
  return data.inventoryBalances.find((item) => item.customerCode === customerCode && item.skuCode === skuCode && item.warehouseCode === warehouseCode);
}

function ensureTransferBalance(data: WarehouseCoreData, customerCode: string, skuCode: string, warehouseCode: string, updatedAt: string) {
  let balance = findTransferBalance(data, customerCode, skuCode, warehouseCode);
  if (!balance) {
    balance = {
      id: `BAL-${customerCode}-${warehouseCode}-${skuCode}`,
      customerCode,
      skuCode,
      warehouseCode,
      availableQty: 0,
      reservedQty: 0,
      frozenQty: 0,
      defectiveQty: 0,
      inboundQty: 0,
      alertQty: 0,
      agingDays: 0,
      updatedAt,
    };
    data.inventoryBalances.unshift(balance);
  }
  return balance;
}

function updateRelatedReplenishmentPlan(data: WarehouseCoreData, transfer: TransferOrder, status: ReplenishmentPlanStatus, updatedAt: string) {
  if (!transfer.relatedPlanId) return;
  const plan = data.replenishmentPlans.find((item) => item.id === transfer.relatedPlanId);
  if (!plan) return;
  plan.status = status;
  plan.updatedAt = updatedAt;
}

function normalizePurchaseReceiptLine(line: Partial<PurchaseReceiptLine>): PurchaseReceiptLine | null {
  const skuCode = String(line.skuCode ?? "").trim().toUpperCase();
  const expectedQty = Math.max(0, Math.floor(Number(line.expectedQty ?? 0)));
  if (!skuCode || expectedQty <= 0) return null;
  return {
    skuCode,
    productName: line.productName?.trim() || undefined,
    expectedQty,
    receivedQty: Math.max(0, Math.floor(Number(line.receivedQty ?? 0))),
    putawayQty: Math.max(0, Math.floor(Number(line.putawayQty ?? 0))),
    defectiveQty: Math.max(0, Math.floor(Number(line.defectiveQty ?? 0))) || undefined,
    locationCode: line.locationCode?.trim().toUpperCase() || undefined,
    lotNo: line.lotNo?.trim() || undefined,
    expiryDate: line.expiryDate?.trim() || undefined,
    note: line.note?.trim() || undefined,
  };
}

function recalcPurchaseReceipt(order: PurchaseReceiptOrder) {
  order.totalExpectedQty = order.lines.reduce((sum, line) => sum + line.expectedQty, 0);
  order.totalReceivedQty = order.lines.reduce((sum, line) => sum + line.receivedQty, 0);
  order.totalPutawayQty = order.lines.reduce((sum, line) => sum + line.putawayQty, 0);
  return order;
}

function hasOpenPurchaseDiscrepancy(order: PurchaseReceiptOrder) {
  return (order.discrepancyReports ?? []).some((item) => item.status === "open" || item.status === "customer_pending");
}

function purchaseReceiptCanClose(order: PurchaseReceiptOrder) {
  return order.totalExpectedQty > 0 && order.totalPutawayQty >= order.totalExpectedQty && !hasOpenPurchaseDiscrepancy(order);
}

function recalculatePurchaseReceiptStatus(order: PurchaseReceiptOrder) {
  if (hasOpenPurchaseDiscrepancy(order)) return "exception" as PurchaseReceiptStatus;
  if (purchaseReceiptCanClose(order)) return "putaway_completed" as PurchaseReceiptStatus;
  if (order.totalReceivedQty >= order.totalExpectedQty && order.totalExpectedQty > 0) return "received" as PurchaseReceiptStatus;
  if (order.totalReceivedQty > 0) return "partially_received" as PurchaseReceiptStatus;
  return order.status === "exception" ? "in_transit" : order.status;
}

function ensurePurchaseReceiptBalance(data: WarehouseCoreData, customerCode: string, skuCode: string, warehouseCode: string, updatedAt: string, productName?: string) {
  if (!data.skus.some((sku) => sku.customerCode === customerCode && sku.skuCode === skuCode)) {
    data.skus.unshift({
      skuCode,
      customerCode,
      productName: productName || skuCode,
      status: "active",
    });
  }

  let balance = data.inventoryBalances.find((item) => item.customerCode === customerCode && item.skuCode === skuCode && item.warehouseCode === warehouseCode);
  if (!balance) {
    balance = {
      id: `BAL-${customerCode}-${warehouseCode}-${skuCode}`,
      customerCode,
      skuCode,
      warehouseCode,
      availableQty: 0,
      reservedQty: 0,
      frozenQty: 0,
      defectiveQty: 0,
      inboundQty: 0,
      alertQty: 0,
      agingDays: 0,
      updatedAt,
    };
    data.inventoryBalances.unshift(balance);
  }
  return balance;
}

function resolvePurchaseReceiptByCode(data: WarehouseCoreData, code: string, activePurchaseId?: string) {
  const normalized = normalizeScanCode(code);
  const active = activePurchaseId ? data.purchaseReceipts.find((order) => order.id === activePurchaseId) : undefined;
  const matched =
    data.purchaseReceipts.find((order) =>
      [order.id, order.trackingNumber]
        .filter(Boolean)
        .some((token) => normalizeScanCode(token ?? "") === normalized),
    ) ?? active;

  if (!matched) return { order: null, codeType: "unknown" as PurchaseReceiptScanCodeType };
  if (normalizeScanCode(matched.id) === normalized) return { order: matched, codeType: "purchase_receipt" as PurchaseReceiptScanCodeType };
  if (matched.trackingNumber && normalizeScanCode(matched.trackingNumber) === normalized) return { order: matched, codeType: "tracking" as PurchaseReceiptScanCodeType };
  return { order: matched, codeType: "unknown" as PurchaseReceiptScanCodeType };
}

function resolvePurchaseSkuFromScan(data: WarehouseCoreData, order: PurchaseReceiptOrder, code: string) {
  const normalized = normalizeScanCode(code);
  const directLine = order.lines.find((line) => normalizeScanCode(line.skuCode) === normalized);
  if (directLine) return directLine.skuCode;

  const sku = data.skus.find((item) => item.customerCode === order.customerCode && normalizeScanCode(item.barcode ?? "") === normalized);
  if (!sku) return "";
  return order.lines.some((line) => line.skuCode === sku.skuCode) ? sku.skuCode : "";
}

function appendPurchaseReceiptScanRecord(order: PurchaseReceiptOrder, record: Omit<PurchaseReceiptScanRecord, "id" | "scannedAt"> & { scannedAt?: string }) {
  return [
    {
      ...record,
      id: makeCoreId("PRSCAN"),
      scannedAt: record.scannedAt ?? now(),
    },
    ...(order.scanLogs ?? []),
  ].slice(0, 80);
}

const purchaseDiscrepancyTypeLabels: Record<PurchaseReceiptDiscrepancyType, string> = {
  shortage: "少货",
  overage: "多货",
  damaged: "破损",
  wrong_sku: "错 SKU",
  missing_label: "缺标签",
  other: "其他差异",
};

function nonNegativeOptionalNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
}

function buildPurchaseDiscrepancyDescription(order: PurchaseReceiptOrder, report: PurchaseReceiptDiscrepancyReport) {
  const quantityText = [
    typeof report.expectedQty === "number" ? `预计 ${report.expectedQty}` : "",
    typeof report.actualQty === "number" ? `实收 ${report.actualQty}` : "",
    typeof report.affectedQty === "number" ? `影响 ${report.affectedQty}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  return [
    `采购到货单 ${order.id} 出现${purchaseDiscrepancyTypeLabels[report.type]}，请确认后续处理方式。`,
    `客户编号：${order.customerCode}`,
    `供应商：${order.supplierName}`,
    report.skuCode ? `SKU：${report.skuCode}` : "",
    quantityText,
    report.description ? `差异说明：${report.description}` : "",
    report.photoUrls?.length ? `照片/凭证：${report.photoUrls.join("，")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function purchaseReceiptTemplateRows() {
  return [
    ["客户编号", "供应商", "仓库", "SKU编码", "商品名称", "预计数量", "预计到仓日期", "追踪号", "库位", "批次号", "效期", "备注"],
    ["CUST-202605-3054", "义乌供应商A", "SHEFFIELD-MAIN", "SKU-001", "收纳盒", 100, "2026-06-20", "追踪号-001", "RCV-A-01", "批次-202606", "2027-06-30", "首批补货"],
  ];
}

export async function importPurchaseReceiptsCsv({ csv, operator }: { csv: string; operator: string }) {
  const parsed = parseSimpleCsv(csv);
  const issues: Array<{ row: number; message: string }> = [];
  const createdOrders: PurchaseReceiptOrder[] = [];

  for (const [index, raw] of parsed.rows.entries()) {
    const rowNo = index + 2;
    const result = await createPurchaseReceiptOrder({
      customerCode: csvRowValue(raw, ["客户编号", "customerCode"]),
      supplierName: csvRowValue(raw, ["供应商", "supplierName"]),
      warehouseCode: csvRowValue(raw, ["仓库", "warehouseCode"]) || "SHEFFIELD-MAIN",
      expectedArrivalDate: csvRowValue(raw, ["预计到仓日期", "expectedArrivalDate"]),
      trackingNumber: csvRowValue(raw, ["追踪号", "trackingNumber"]),
      lines: [
        {
          skuCode: csvRowValue(raw, ["SKU编码", "SKU 编码", "skuCode", "sku"]),
          productName: csvRowValue(raw, ["商品名称", "productName"]),
          expectedQty: Number(csvRowValue(raw, ["预计数量", "expectedQty", "quantity"])) || 0,
          locationCode: csvRowValue(raw, ["库位", "locationCode"]),
          lotNo: csvRowValue(raw, ["批次号", "lotNo"]),
          expiryDate: csvRowValue(raw, ["效期", "expiryDate"]),
          note: csvRowValue(raw, ["备注", "note"]),
        },
      ],
      note: csvRowValue(raw, ["备注", "note"]),
      operator,
    });
    if (result.order) {
      createdOrders.push(result.order);
    } else {
      issues.push({ row: rowNo, message: result.error || "该行未能创建采购到货单" });
    }
  }

  return {
    totalRows: parsed.rows.length,
    createdRows: createdOrders.length,
    skippedRows: issues.length,
    issues,
    createdOrders,
  };
}

export async function createPurchaseReceiptOrder({
  customerCode,
  supplierName,
  warehouseCode = "SHEFFIELD-MAIN",
  expectedArrivalDate,
  trackingNumber,
  lines,
  note,
  operator,
}: {
  customerCode: string;
  supplierName: string;
  warehouseCode?: string;
  expectedArrivalDate?: string;
  trackingNumber?: string;
  lines: Array<Partial<PurchaseReceiptLine>>;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const cleanCustomerCode = customerCode.trim();
  const cleanSupplierName = supplierName.trim();
  const cleanWarehouseCode = warehouseCode.trim().toUpperCase() || "SHEFFIELD-MAIN";
  const normalizedLines = lines.map(normalizePurchaseReceiptLine).filter((line): line is PurchaseReceiptLine => Boolean(line));
  if (!cleanCustomerCode || !cleanSupplierName || normalizedLines.length === 0) return { order: null, error: "请填写客户编号、供应商和至少 1 条 SKU 明细" };
  if (!data.customers.some((item) => item.customerCode === cleanCustomerCode)) return { order: null, error: "未找到客户编号，请先确认客户账号" };

  const createdAt = now();
  const order = recalcPurchaseReceipt({
    id: makeCoreId("PO"),
    customerCode: cleanCustomerCode,
    supplierName: cleanSupplierName,
    warehouseCode: cleanWarehouseCode,
    status: "in_transit",
    expectedArrivalDate: expectedArrivalDate?.trim() || undefined,
    trackingNumber: trackingNumber?.trim() || undefined,
    lines: normalizedLines,
    totalExpectedQty: 0,
    totalReceivedQty: 0,
    totalPutawayQty: 0,
    note: note?.trim() || undefined,
    createdBy: operator,
    createdAt,
    updatedAt: createdAt,
    timeline: [approvalEvent("submitted", "创建采购到货单", operator, note?.trim(), createdAt)],
  });

  data.purchaseReceipts.unshift(order);
  await writeCoreData(data);
  return { order, error: null };
}

export async function receivePurchaseReceiptOrder({
  id,
  lines,
  locationCode,
  note,
  operator,
}: {
  id: string;
  lines?: Array<Partial<PurchaseReceiptLine>>;
  locationCode?: string;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const order = data.purchaseReceipts.find((item) => item.id === id);
  if (!order) return { order: null, error: "未找到采购到货单" };
  if (["received", "putaway_completed", "cancelled"].includes(order.status)) return { order, error: "当前采购到货单不能重复签收" };

  const updatedAt = now();
  const lineMap = new Map((lines ?? []).map((line) => [String(line.skuCode ?? "").trim().toUpperCase(), line]));
  let postedQty = 0;
  const cleanLocationCode = locationCode?.trim().toUpperCase();

  for (const line of order.lines) {
    const inputLine = lineMap.get(line.skuCode);
    const targetReceivedQty = Math.max(line.receivedQty, Math.floor(Number(inputLine?.receivedQty ?? line.expectedQty)));
    const receiveDelta = Math.max(0, Math.min(line.expectedQty, targetReceivedQty) - line.receivedQty);
    if (receiveDelta <= 0) continue;

    const balance = ensurePurchaseReceiptBalance(data, order.customerCode, line.skuCode, order.warehouseCode, updatedAt, line.productName);
    const beforeQty = balance.availableQty + balance.reservedQty + balance.inboundQty;
    balance.inboundQty += receiveDelta;
    balance.locationCode = cleanLocationCode || inputLine?.locationCode?.trim().toUpperCase() || line.locationCode || balance.locationCode;
    balance.updatedAt = updatedAt;
    line.receivedQty += receiveDelta;
    line.locationCode = cleanLocationCode || inputLine?.locationCode?.trim().toUpperCase() || line.locationCode;
    line.lotNo = inputLine?.lotNo?.trim() || line.lotNo;
    line.expiryDate = inputLine?.expiryDate?.trim() || line.expiryDate;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: order.customerCode,
      skuCode: line.skuCode,
      refType: "purchase",
      refId: order.id,
      movementType: "adjust",
      quantity: receiveDelta,
      beforeQty,
      afterQty: balance.availableQty + balance.reservedQty + balance.inboundQty,
      note: note?.trim() || "采购到货签收，进入待上架库存",
      occurredAt: updatedAt,
      operator,
    });
    postedQty += receiveDelta;
  }

  recalcPurchaseReceipt(order);
  order.status = recalculatePurchaseReceiptStatus(order);
  order.arrivedAt = order.arrivedAt || updatedAt;
  order.receivedAt = updatedAt;
  order.receivedBy = operator;
  order.updatedAt = updatedAt;
  order.note = note?.trim() || order.note;
  if (order.totalReceivedQty < order.totalExpectedQty) {
    order.exceptionNote = `预计 ${order.totalExpectedQty} 件，已签收 ${order.totalReceivedQty} 件，仍有 ${order.totalExpectedQty - order.totalReceivedQty} 件未签收。`;
  } else {
    order.exceptionNote = undefined;
  }
  order.timeline = appendApprovalTimeline(order.timeline, approvalEvent("commented", "采购到货签收", operator, order.note, updatedAt));

  await writeCoreData(data);
  return { order, postedQty, error: null };
}

export async function putawayPurchaseReceiptOrder({
  id,
  locationCode,
  note,
  operator,
}: {
  id: string;
  locationCode?: string;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const order = data.purchaseReceipts.find((item) => item.id === id);
  if (!order) return { order: null, error: "未找到采购到货单" };
  if (!["received", "partially_received"].includes(order.status)) return { order, error: "请先完成到货签收，再执行上架" };

  const updatedAt = now();
  const cleanLocationCode = locationCode?.trim().toUpperCase();
  let postedQty = 0;
  const errors: string[] = [];

  if (cleanLocationCode) {
    const targetLocation = data.locations.find((item) => item.locationCode === cleanLocationCode);
    const lineKeys = new Set(order.lines.filter((line) => line.receivedQty > line.putawayQty).map((line) => `${order.customerCode}:${line.skuCode}`));
    if (targetLocation && !(targetLocation.allowMixedSku ?? true) && lineKeys.size > 1) {
      errors.push(`目标库位 ${cleanLocationCode} 不允许混放，本次上架包含多个 SKU`);
    }
  }
  for (const line of order.lines) {
    const putawayDelta = Math.max(0, line.receivedQty - line.putawayQty);
    if (putawayDelta <= 0) continue;
    const targetLocationCode = cleanLocationCode || line.locationCode;
    if (!targetLocationCode) continue;
    const balance = ensurePurchaseReceiptBalance(data, order.customerCode, line.skuCode, order.warehouseCode, updatedAt, line.productName);
    const validation = validateLocationPlacement({
      data,
      customerCode: order.customerCode,
      skuCode: line.skuCode,
      targetLocationCode,
      balance,
      incomingQty: putawayDelta,
      restrictSpecialZones: true,
    });
    if (!validation.ok) errors.push(`${line.skuCode}: ${validation.error}`);
  }
  if (errors.length) return { order, postedQty, error: errors.join("；") };

  for (const line of order.lines) {
    const putawayDelta = Math.max(0, line.receivedQty - line.putawayQty);
    if (putawayDelta <= 0) continue;
    const balance = ensurePurchaseReceiptBalance(data, order.customerCode, line.skuCode, order.warehouseCode, updatedAt, line.productName);
    const beforeQty = balance.availableQty + balance.reservedQty;
    balance.inboundQty = Math.max(0, balance.inboundQty - putawayDelta);
    balance.availableQty += putawayDelta;
    balance.locationCode = cleanLocationCode || line.locationCode || balance.locationCode;
    balance.updatedAt = updatedAt;
    line.putawayQty += putawayDelta;
    line.locationCode = cleanLocationCode || line.locationCode;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: order.customerCode,
      skuCode: line.skuCode,
      refType: "purchase",
      refId: order.id,
      movementType: "in",
      quantity: putawayDelta,
      beforeQty,
      afterQty: balance.availableQty + balance.reservedQty,
      note: note?.trim() || "采购到货上架，转为可售库存",
      occurredAt: updatedAt,
      operator,
    });
    postedQty += putawayDelta;
  }

  recalcPurchaseReceipt(order);
  order.status = recalculatePurchaseReceiptStatus(order);
  order.putawayAt = updatedAt;
  order.putawayBy = operator;
  order.updatedAt = updatedAt;
  order.note = note?.trim() || order.note;
  order.timeline = appendApprovalTimeline(order.timeline, approvalEvent("approved", "采购到货上架", operator, order.note, updatedAt));

  await writeCoreData(data);
  return { order, postedQty, error: null };
}

export async function scanPurchaseReceiptTask({
  action,
  code,
  activePurchaseId,
  locationCode,
  operator,
}: {
  action: PurchaseReceiptScanAction;
  code: string;
  activePurchaseId?: string;
  locationCode?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const cleanCode = code.trim();
  if (!cleanCode) return { purchase: null, error: "请扫描或输入条码", message: "", codeType: "unknown" as PurchaseReceiptScanCodeType };

  const resolved = resolvePurchaseReceiptByCode(data, cleanCode, activePurchaseId);
  let purchase = resolved.order;
  let codeType = resolved.codeType;
  if (!purchase) return { purchase: null, error: "未匹配到采购到货单，请先扫描采购单号或追踪号", message: "", codeType };

  const index = data.purchaseReceipts.findIndex((item) => item.id === purchase?.id);
  if (index < 0) return { purchase: null, error: "未找到采购到货任务", message: "", codeType };
  purchase = data.purchaseReceipts[index];

  if (["purchase_receipt", "tracking"].includes(codeType)) {
    return {
      purchase,
      error: null,
      message: `已选中采购到货单：${purchase.id} / ${purchase.supplierName}`,
      codeType,
    };
  }

  if (["putaway_completed", "cancelled"].includes(purchase.status)) {
    return { purchase, error: "该采购到货单已关闭，不能继续扫码", message: "", codeType };
  }

  const updatedAt = now();
  const scanLocation = resolveLocationFromScan(data, cleanCode) || locationCode?.trim().toUpperCase() || "";
  const skuCode = resolvePurchaseSkuFromScan(data, purchase, cleanCode);
  if (scanLocation && !skuCode) codeType = "location";
  if (skuCode) codeType = "sku";

  if (scanLocation && !skuCode) {
    const targetLocation = data.locations.find((item) => item.locationCode === scanLocation);
    if (!targetLocation) return { purchase, error: "目标库位不存在，请先在库位管理中创建", message: "", codeType };
    if (targetLocation.status !== "active") return { purchase, error: `目标库位当前为${warehouseLocationStatusLabel(targetLocation.status)}，不能上架`, message: "", codeType };
    if (["frozen", "defective"].includes(targetLocation.zoneType ?? "")) {
      return { purchase, error: "冻结位/残次品位不能用于普通上架，请通过冻结或残次品流程处理", message: "", codeType };
    }
    const nextLines = purchase.lines.map((line) => ({ ...line, locationCode: line.locationCode || scanLocation }));
    data.purchaseReceipts[index] = {
      ...purchase,
      lines: nextLines,
      scanLogs: appendPurchaseReceiptScanRecord(purchase, { action, code: cleanCode, codeType, locationCode: scanLocation, operator, scannedAt: updatedAt }),
      updatedAt,
    };
    await writeCoreData(data);
    return { purchase: data.purchaseReceipts[index], error: null, message: `已记录库位：${scanLocation}，下一步扫描 SKU`, codeType };
  }

  if (!skuCode) return { purchase, error: "当前条码不是该采购到货单的 SKU，请检查是否扫错货品", message: "", codeType };

  const line = purchase.lines.find((item) => item.skuCode === skuCode);
  if (!line) return { purchase, error: "该 SKU 不属于当前采购到货单", message: "", codeType };

  const balance = ensurePurchaseReceiptBalance(data, purchase.customerCode, skuCode, purchase.warehouseCode, updatedAt, line.productName);
  const cleanLocationCode = scanLocation || line.locationCode || locationCode?.trim().toUpperCase();

  if (action === "receive") {
    if (line.receivedQty >= line.expectedQty) {
      return { purchase, error: `${skuCode} 已签收 ${line.receivedQty}/${line.expectedQty}，请勿重复签收`, message: "", codeType };
    }
    const beforeQty = balance.availableQty + balance.reservedQty + balance.inboundQty;
    line.receivedQty += 1;
    line.locationCode = cleanLocationCode || line.locationCode;
    balance.inboundQty += 1;
    balance.locationCode = cleanLocationCode || balance.locationCode;
    balance.updatedAt = updatedAt;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: purchase.customerCode,
      skuCode,
      refType: "purchase",
      refId: purchase.id,
      movementType: "adjust",
      quantity: 1,
      beforeQty,
      afterQty: balance.availableQty + balance.reservedQty + balance.inboundQty,
      note: "扫码签收，进入待上架库存",
      occurredAt: updatedAt,
      operator,
    });
  } else {
    if (line.receivedQty <= line.putawayQty) {
      return { purchase, error: `${skuCode} 暂无可上架数量，请先完成签收`, message: "", codeType };
    }
    if (cleanLocationCode) {
      const validation = validateLocationPlacement({
        data,
        customerCode: purchase.customerCode,
        skuCode,
        targetLocationCode: cleanLocationCode,
        balance,
        incomingQty: 1,
        restrictSpecialZones: true,
      });
      if (!validation.ok) return { purchase, error: validation.error, message: "", codeType };
    }
    const beforeQty = balance.availableQty + balance.reservedQty;
    line.putawayQty += 1;
    line.locationCode = cleanLocationCode || line.locationCode;
    balance.inboundQty = Math.max(0, balance.inboundQty - 1);
    balance.availableQty += 1;
    balance.locationCode = cleanLocationCode || balance.locationCode;
    balance.updatedAt = updatedAt;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: purchase.customerCode,
      skuCode,
      refType: "purchase",
      refId: purchase.id,
      movementType: "in",
      quantity: 1,
      beforeQty,
      afterQty: balance.availableQty + balance.reservedQty,
      note: "扫码上架，转为可售库存",
      occurredAt: updatedAt,
      operator,
    });
  }

  recalcPurchaseReceipt(purchase);
  purchase.status = recalculatePurchaseReceiptStatus(purchase);
  purchase.arrivedAt = purchase.arrivedAt || updatedAt;
  if (action === "receive") {
    purchase.receivedAt = updatedAt;
    purchase.receivedBy = operator;
  } else {
    purchase.putawayAt = updatedAt;
    purchase.putawayBy = operator;
  }
  purchase.scanLogs = appendPurchaseReceiptScanRecord(purchase, {
    action,
    code: cleanCode,
    codeType,
    skuCode,
    locationCode: cleanLocationCode,
    quantity: 1,
    operator,
    scannedAt: updatedAt,
  });
  purchase.updatedAt = updatedAt;
  purchase.timeline = appendApprovalTimeline(
    purchase.timeline,
    approvalEvent("commented", action === "receive" ? "扫码签收" : "扫码上架", operator, `${skuCode} 1 件${cleanLocationCode ? ` / ${cleanLocationCode}` : ""}`, updatedAt),
  );

  await writeCoreData(data);
  return {
    purchase: data.purchaseReceipts[index],
    error: null,
    message:
      action === "receive"
        ? `扫码签收成功：${skuCode} ${line.receivedQty}/${line.expectedQty}`
        : `扫码上架成功：${skuCode} ${line.putawayQty}/${line.receivedQty}`,
    codeType,
  };
}

export async function reportPurchaseReceiptDiscrepancy({
  id,
  type,
  severity = "critical",
  skuCode,
  expectedQty,
  actualQty,
  affectedQty,
  description,
  photoUrls = [],
  operator,
}: {
  id: string;
  type: PurchaseReceiptDiscrepancyType;
  severity?: PurchaseReceiptDiscrepancyReport["severity"];
  skuCode?: string;
  expectedQty?: number;
  actualQty?: number;
  affectedQty?: number;
  description: string;
  photoUrls?: string[];
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const order = data.purchaseReceipts.find((item) => item.id === id);
  if (!order) return { order: null, discrepancy: null, workOrder: null, error: "未找到采购到货单" };
  if (["putaway_completed", "cancelled"].includes(order.status)) return { order, discrepancy: null, workOrder: null, error: "当前采购到货单已关闭，不能登记差异" };

  const cleanType = type;
  if (!purchaseDiscrepancyTypeLabels[cleanType]) return { order, discrepancy: null, workOrder: null, error: "请选择有效的采购到货差异类型" };

  const cleanSkuCode = skuCode?.trim().toUpperCase() || undefined;
  if (cleanSkuCode && !order.lines.some((line) => line.skuCode === cleanSkuCode) && cleanType !== "wrong_sku" && cleanType !== "overage") {
    return { order, discrepancy: null, workOrder: null, error: "该 SKU 不属于当前采购到货单" };
  }

  const cleanDescription = description.trim();
  if (!cleanDescription) return { order, discrepancy: null, workOrder: null, error: "请填写差异说明，方便客户和运营确认" };

  const timestamp = now();
  const discrepancy: PurchaseReceiptDiscrepancyReport = {
    id: makeCoreId("PRDIFF"),
    type: cleanType,
    status: "customer_pending",
    severity,
    skuCode: cleanSkuCode,
    expectedQty: nonNegativeOptionalNumber(expectedQty),
    actualQty: nonNegativeOptionalNumber(actualQty),
    affectedQty: nonNegativeOptionalNumber(affectedQty),
    description: cleanDescription,
    photoUrls: photoUrls.map((url) => url.trim()).filter(Boolean).slice(0, 8),
    createdBy: operator,
    createdAt: timestamp,
  };

  const workOrder = await createCustomerWorkOrder({
    customerCode: order.customerCode,
    category: "入库差异",
    title: `采购到货${purchaseDiscrepancyTypeLabels[discrepancy.type]}待确认`,
    priority: discrepancy.severity === "critical" ? "urgent" : "normal",
    status: "waiting_customer",
    referenceNo: order.id,
    description: buildPurchaseDiscrepancyDescription(order, discrepancy),
    initialAuthorRole: "system",
    initialAuthorName: "仓库系统",
  });

  discrepancy.workOrderId = workOrder.id;
  order.discrepancyReports = [discrepancy, ...(order.discrepancyReports ?? [])].slice(0, 100);
  order.status = "exception";
  order.exceptionNote = `${purchaseDiscrepancyTypeLabels[discrepancy.type]}待确认：${cleanSkuCode ? `${cleanSkuCode} / ` : ""}${cleanDescription}`;
  order.updatedAt = timestamp;
  order.timeline = appendApprovalTimeline(order.timeline, approvalEvent("rejected", `登记采购到货${purchaseDiscrepancyTypeLabels[discrepancy.type]}`, operator, `已生成客户待确认工单 ${workOrder.id}`, timestamp));

  await writeCoreData(data);
  return { order, discrepancy, workOrder, error: null };
}

export async function resolvePurchaseReceiptDiscrepancy({
  id,
  discrepancyId,
  status,
  note,
  operator,
}: {
  id: string;
  discrepancyId: string;
  status: Extract<PurchaseReceiptDiscrepancyStatus, "resolved" | "ignored">;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const order = data.purchaseReceipts.find((item) => item.id === id);
  if (!order) return { order: null, discrepancy: null, error: "未找到采购到货单" };

  const discrepancy = (order.discrepancyReports ?? []).find((item) => item.id === discrepancyId);
  if (!discrepancy) return { order, discrepancy: null, error: "未找到采购到货差异记录" };
  if (discrepancy.status === "resolved" || discrepancy.status === "ignored") return { order, discrepancy, error: "该采购到货差异已经处理完成" };

  const timestamp = now();
  const cleanNote = note?.trim() || (status === "resolved" ? "运营已确认处理完成。" : "运营确认该差异无需继续处理。");
  discrepancy.status = status;
  discrepancy.resolvedBy = operator;
  discrepancy.resolvedAt = timestamp;
  discrepancy.resolutionNote = cleanNote;

  recalcPurchaseReceipt(order);
  order.status = recalculatePurchaseReceiptStatus(order);
  order.exceptionNote = hasOpenPurchaseDiscrepancy(order) ? order.exceptionNote : undefined;
  order.updatedAt = timestamp;
  order.timeline = appendApprovalTimeline(
    order.timeline,
    approvalEvent(status === "resolved" ? "approved" : "commented", status === "resolved" ? "采购到货差异已处理" : "采购到货差异已忽略", operator, cleanNote, timestamp),
  );

  await writeCoreData(data);

  if (discrepancy.workOrderId) {
    await addCustomerWorkOrderMessage({
      id: discrepancy.workOrderId,
      authorRole: "system",
      authorName: "仓库系统",
      body: `采购到货差异已${status === "resolved" ? "处理完成" : "标记无需继续处理"}：${cleanNote}`,
      visibleToCustomer: true,
      nextStatus: "resolved",
    });
  }

  return { order, discrepancy, error: null };
}

export async function progressTransferOrder({
  id,
  action,
  quantity,
  carrierName,
  trackingNumber,
  note,
  operator,
}: {
  id: string;
  action: TransferLifecycleAction;
  quantity?: number;
  carrierName?: string;
  trackingNumber?: string;
  note?: string;
  operator: string;
}) {
  const data = await getWarehouseCoreData();
  const transfer = data.transferOrders.find((item) => item.id === id);
  if (!transfer) return { transfer: null, error: "未找到调拨单" };
  if (["received", "cancelled"].includes(transfer.status)) return { transfer, error: "调拨单已关闭" };

  const updatedAt = now();
  const cleanQty = Math.floor(Number(quantity ?? transfer.quantity));
  const cleanNote = note?.trim();

  if (action === "approve") {
    if (transfer.status !== "new") return { transfer, error: "只有新建调拨单可以审批" };
    transfer.status = "approved";
    transfer.progress = 20;
    transfer.approvedBy = operator;
    transfer.approvedAt = updatedAt;
    transfer.note = cleanNote || transfer.note;
    transfer.approvalTimeline = appendApprovalTimeline(transfer.approvalTimeline, approvalEvent("approved", "审批通过调拨单", operator, cleanNote, updatedAt));
    updateRelatedReplenishmentPlan(data, transfer, "approved", updatedAt);
  }

  if (action === "start_picking") {
    if (!["new", "approved"].includes(transfer.status)) return { transfer, error: "当前调拨状态不能开始拣货" };
    transfer.status = "picking";
    transfer.progress = 40;
    transfer.pickedQty = Math.min(transfer.quantity, Math.max(transfer.pickedQty ?? 0, cleanQty > 0 ? cleanQty : transfer.quantity));
    transfer.pickedBy = operator;
    transfer.pickedAt = updatedAt;
  }

  if (action === "ship") {
    if (!["approved", "picking"].includes(transfer.status)) return { transfer, error: "当前调拨状态不能发出" };
    const shippedQty = Math.min(transfer.quantity, cleanQty > 0 ? cleanQty : transfer.pickedQty || transfer.quantity);
    const sourceBalance = findTransferBalance(data, transfer.customerCode, transfer.skuCode, transfer.fromWarehouseCode);
    if (sourceBalance) {
      const beforeQty = sourceBalance.availableQty;
      sourceBalance.availableQty = Math.max(0, sourceBalance.availableQty - shippedQty);
      sourceBalance.updatedAt = updatedAt;
      data.inventoryMovements.unshift({
        id: makeCoreId("MOV"),
        customerCode: transfer.customerCode,
        skuCode: transfer.skuCode,
        refType: "transfer",
        refId: transfer.id,
        movementType: "out",
        quantity: shippedQty,
        beforeQty,
        afterQty: sourceBalance.availableQty,
        note: cleanNote || `调拨发出至 ${transfer.toWarehouseCode}`,
        occurredAt: updatedAt,
        operator,
      });
    }
    transfer.status = "in_transit";
    transfer.progress = 65;
    transfer.pickedQty = transfer.pickedQty ?? shippedQty;
    transfer.shippedQty = shippedQty;
    transfer.shippedBy = operator;
    transfer.shippedAt = updatedAt;
    transfer.carrierName = carrierName?.trim() || transfer.carrierName;
    transfer.trackingNumber = trackingNumber?.trim() || transfer.trackingNumber;
    transfer.note = cleanNote || transfer.note;
    updateRelatedReplenishmentPlan(data, transfer, "in_transit", updatedAt);
  }

  if (action === "receive" || action === "partial_receive") {
    if (!["in_transit", "partially_received", "exception"].includes(transfer.status)) return { transfer, error: "当前调拨状态不能收货" };
    const remainingQty = Math.max(0, transfer.quantity - transfer.receivedQty);
    const receiveQty = Math.min(remainingQty, cleanQty > 0 ? cleanQty : remainingQty);
    if (receiveQty <= 0) return { transfer, error: "收货数量必须大于 0" };
    const destinationBalance = ensureTransferBalance(data, transfer.customerCode, transfer.skuCode, transfer.toWarehouseCode, updatedAt);
    const beforeQty = destinationBalance.availableQty;
    destinationBalance.availableQty += receiveQty;
    destinationBalance.updatedAt = updatedAt;
    data.inventoryMovements.unshift({
      id: makeCoreId("MOV"),
      customerCode: transfer.customerCode,
      skuCode: transfer.skuCode,
      refType: "transfer",
      refId: transfer.id,
      movementType: "in",
      quantity: receiveQty,
      beforeQty,
      afterQty: destinationBalance.availableQty,
      note: cleanNote || `调拨收货，来源 ${transfer.fromWarehouseCode}`,
      occurredAt: updatedAt,
      operator,
    });
    transfer.receivedQty += receiveQty;
    transfer.receivedBy = operator;
    transfer.receivedAt = updatedAt;
    transfer.status = transfer.receivedQty >= transfer.quantity ? "received" : "partially_received";
    transfer.progress = transfer.status === "received" ? 100 : Math.max(75, Math.round((transfer.receivedQty / transfer.quantity) * 100));
    transfer.note = cleanNote || transfer.note;
    updateRelatedReplenishmentPlan(data, transfer, transfer.status === "received" ? "received" : "in_transit", updatedAt);
  }

  if (action === "mark_exception") {
    transfer.status = "exception";
    transfer.progress = Math.max(transfer.progress, 60);
    transfer.exceptionNote = cleanNote || transfer.exceptionNote || "调拨异常";
    transfer.note = cleanNote || transfer.note;
  }

  if (action === "cancel") {
    if (!["new", "approved", "picking", "exception"].includes(transfer.status)) return { transfer, error: "当前调拨状态不能取消" };
    transfer.status = "cancelled";
    transfer.progress = 0;
    transfer.note = cleanNote || transfer.note;
    updateRelatedReplenishmentPlan(data, transfer, "cancelled", updatedAt);
  }

  transfer.updatedAt = updatedAt;
  await writeCoreData(data);
  return { transfer, error: null };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function billingDueDateFromTerm(termDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, Math.floor(termDays)));
  return date.toISOString().slice(0, 10);
}

export function billingDueDateForCustomer(customer?: Pick<CustomerProfile, "paymentTermDays" | "billingCycle">) {
  if (customer?.billingCycle === "prepaid") return billingDueDateFromTerm(0);
  return billingDueDateFromTerm(customer?.paymentTermDays ?? 7);
}

function billingRecordMonth(record: BillingRecord) {
  return (record.dueDate || record.createdAt).slice(0, 7);
}

function resolveBillingRefTitle(data: WarehouseCoreData, customerCode: string, refType: BillingRefType, refId: string) {
  if (refType === "outbound") {
    const order = data.outboundOrders.find((item) => item.id === refId && item.customerCode === customerCode);
    return order ? `${order.channel || "未填渠道"} / ${order.orderCount} 单` : refId;
  }

  if (refType === "return") {
    const order = data.returnOrders.find((item) => item.id === refId && item.customerCode === customerCode);
    return order ? `${order.platform || "退货"} / ${order.skuLines.reduce((sum, line) => sum + line.quantity, 0)} 件` : refId;
  }

  return refId;
}

export function getBillingFeeRules() {
  return billingFeeRules.filter((item) => item.active);
}

export async function createOpsBillingRecordFromRule({
  customerCode,
  feeCode,
  quantity,
  refId,
  note,
  reviewer,
  dueDate,
  status = "pending_confirmation",
}: {
  customerCode: string;
  feeCode: BillingFeeCode;
  quantity: number;
  refId?: string;
  note?: string;
  reviewer: string;
  dueDate?: string;
  status?: BillingRecord["status"];
}) {
  const data = await getWarehouseCoreData();
  const customer = data.customers.find((item) => item.customerCode === customerCode);
  if (!customer) return { record: null, error: "未找到客户" };

  const rule = billingFeeRules.find((item) => item.feeCode === feeCode && item.active);
  if (!rule) return { record: null, error: "未找到费用规则" };

  const cleanQuantity = Number(quantity);
  if (!Number.isFinite(cleanQuantity) || cleanQuantity <= 0) return { record: null, error: "费用数量必须大于 0" };

  const cleanRefId = refId?.trim() || `${rule.refType}-${new Date().toISOString().slice(0, 10)}`;
  const cleanNote = note?.trim();
  const amount = roundMoney(rule.unitPrice * cleanQuantity);
  const line: BillingFeeLine = {
    feeCode: rule.feeCode,
    label: rule.label,
    unitLabel: rule.unitLabel,
    unitPrice: rule.unitPrice,
    quantity: cleanQuantity,
    amount,
    note: cleanNote,
  };
  const generatedAt = now();
  const refTitle = resolveBillingRefTitle(data, customerCode, rule.refType, cleanRefId);
  const record: BillingRecord = {
    id: makeCoreId("BILL"),
    customerCode,
    refType: rule.refType,
    refId: cleanRefId,
    status,
    currency: "GBP",
    amount,
    dueDate: dueDate?.trim() || billingDueDateForCustomer(customer),
    title: `${rule.label} - ${refTitle}`,
    note: cleanNote || rule.description,
    feeLines: [line],
    generatedBy: reviewer,
    generatedAt,
    reviewedBy: reviewer,
    reviewedAt: generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };

  data.billingRecords.unshift(record);
  await writeCoreData(data);
  return { record, error: null };
}

export async function createManualBillingAdjustmentRecord({
  customerCode,
  amount,
  title,
  note,
  reviewer,
  workOrderId,
  sourceRecordId,
  adjustmentKind,
  approvalRuleId,
  approvalRuleName,
  approvalRuleNote,
  attachmentStatus,
  status = "confirmed",
}: {
  customerCode: string;
  amount: number;
  title: string;
  note?: string;
  reviewer: string;
  workOrderId?: string;
  sourceRecordId?: string;
  adjustmentKind: BillingAdjustmentKind;
  approvalRuleId?: string;
  approvalRuleName?: string;
  approvalRuleNote?: string;
  attachmentStatus?: BillingAdjustmentAttachmentStatus;
  status?: BillingRecord["status"];
}) {
  const data = await getWarehouseCoreData();
  const customer = data.customers.find((item) => item.customerCode === customerCode);
  if (!customer) return { record: null, error: "未找到客户" };

  const cleanAmount = roundMoney(Number(amount));
  if (!Number.isFinite(cleanAmount) || cleanAmount >= 0) return { record: null, error: "调账金额必须为负数" };

  const generatedAt = now();
  const cleanTitle = title.trim() || (adjustmentKind === "compensation" ? "赔付抵扣" : "费用调账");
  const cleanNote = note?.trim();
  const line: BillingFeeLine = {
    feeCode: "manual_service",
    label: adjustmentKind === "compensation" ? "赔付抵扣" : "费用调账",
    unitLabel: "项",
    unitPrice: cleanAmount,
    quantity: 1,
    amount: cleanAmount,
    note: cleanNote,
  };
  const record: BillingRecord = {
    id: makeCoreId("BILL"),
    customerCode,
    refType: "manual",
    refId: workOrderId || sourceRecordId || `adjustment-${generatedAt.slice(0, 10)}`,
    status,
    currency: "GBP",
    amount: cleanAmount,
    dueDate: billingDueDateForCustomer(customer),
    title: cleanTitle,
    note: cleanNote || (adjustmentKind === "compensation" ? "财务复核生成赔付抵扣。" : "财务复核生成费用调账。"),
    workOrderId: workOrderId?.trim() || undefined,
    adjustmentKind,
    adjustmentApprovalStatus: adjustmentApprovalStatusForBillingStatus(status),
    adjustmentApprovalRuleId: approvalRuleId?.trim() || undefined,
    adjustmentApprovalRuleName: approvalRuleName?.trim() || undefined,
    adjustmentApprovalRuleNote: approvalRuleNote?.trim() || undefined,
    adjustmentAttachmentStatus: attachmentStatus ?? "not_required",
    adjustmentSourceRecordId: sourceRecordId?.trim() || undefined,
    feeLines: [line],
    generatedBy: reviewer,
    generatedAt,
    reviewedBy: reviewer,
    reviewedAt: generatedAt,
    reviewNote: cleanNote,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    approvalTimeline: [
      billingTimelineEvent(
        "approved",
        adjustmentKind === "compensation" ? "生成赔付抵扣" : "生成费用调账",
        reviewer,
        [cleanNote, approvalRuleName ? `审批规则 ${approvalRuleName}` : "", attachmentStatus && attachmentStatus !== "not_required" ? `附件状态 ${attachmentStatus}` : "", workOrderId ? `来源工单 ${workOrderId}` : "", sourceRecordId ? `来源账单 ${sourceRecordId}` : ""].filter(Boolean).join(" / "),
        generatedAt,
      ),
    ],
  };

  data.billingRecords.unshift(record);
  await writeCoreData(data);
  return { record, error: null };
}

export async function updateCustomerBillingRecord({
  id,
  customerCode,
  action,
  message,
  paymentReference,
}: {
  id: string;
  customerCode: string;
  action: "confirm" | "dispute" | "submit_payment" | "request_invoice";
  message?: string;
  paymentReference?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.billingRecords.findIndex((item) => item.id === id && item.customerCode === customerCode);
  if (index < 0) return null;

  const record = data.billingRecords[index];
  const updatedAt = now();
  const cleanMessage = message?.trim();
  const cleanPaymentReference = paymentReference?.trim();

  if (action === "confirm") {
    data.billingRecords[index] = {
      ...record,
      status: "confirmed",
      customerMessage: cleanMessage,
      customerConfirmedAt: updatedAt,
      updatedAt,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户确认账单", "客户", cleanMessage, updatedAt)),
    };
  }

  if (action === "dispute") {
    data.billingRecords[index] = {
      ...record,
      status: "disputed",
      customerMessage: cleanMessage || "客户提出费用异议，请运营复核。",
      updatedAt,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户提出账单异议", "客户", cleanMessage || "客户提出费用异议，请运营复核。", updatedAt)),
    };
  }

  if (action === "submit_payment") {
    data.billingRecords[index] = {
      ...record,
      status: "payment_submitted",
      paymentReference: cleanPaymentReference,
      paymentNote: cleanMessage,
      paymentSubmittedAt: updatedAt,
      paymentRejectedAt: undefined,
      paymentRejectedBy: undefined,
      paymentRejectionNote: undefined,
      updatedAt,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户提交付款凭证", "客户", [cleanPaymentReference ? `付款参考号 ${cleanPaymentReference}` : "", cleanMessage].filter(Boolean).join(" / "), updatedAt)),
    };
  }

  if (action === "request_invoice") {
    data.billingRecords[index] = {
      ...record,
      invoiceStatus: "requested",
      invoiceRequestedAt: updatedAt,
      invoiceNote: cleanMessage,
      updatedAt,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户申请开票", "客户", cleanMessage, updatedAt)),
    };
  }

  await writeCoreData(data);
  return data.billingRecords[index];
}

export async function updateBillingInvoiceStatus({
  id,
  invoiceStatus,
  reviewer,
  invoiceNote,
}: {
  id: string;
  invoiceStatus: BillingInvoiceStatus;
  reviewer: string;
  invoiceNote?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.billingRecords.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updatedAt = now();
  const patch: Partial<BillingRecord> = {
    invoiceStatus,
    invoiceNote: invoiceNote?.trim(),
    invoiceUpdatedBy: reviewer,
    updatedAt,
  };

  if (invoiceStatus === "issued") patch.invoiceIssuedAt = updatedAt;
  if (invoiceStatus === "voided") patch.invoiceVoidedAt = updatedAt;
  if (invoiceStatus === "not_requested") {
    patch.invoiceRequestedAt = undefined;
    patch.invoiceIssuedAt = undefined;
    patch.invoiceVoidedAt = undefined;
  }

  data.billingRecords[index] = {
    ...data.billingRecords[index],
    ...patch,
  };

  await writeCoreData(data);
  return data.billingRecords[index];
}

export async function updateBillingStatementLock({
  customerCode,
  month,
  action,
  reviewer,
  reviewNote,
}: {
  customerCode: string;
  month: string;
  action: "lock" | "unlock";
  reviewer: string;
  reviewNote?: string;
}) {
  const data = await getWarehouseCoreData();
  const records = data.billingRecords.filter((item) => item.customerCode === customerCode && billingRecordMonth(item) === month);
  if (records.length === 0) return { records: [] as BillingRecord[], error: "未找到该客户本月账单记录" };

  const updatedAt = now();
  const statementId = `STMT-${customerCode}-${month}`;
  data.billingRecords = data.billingRecords.map((record) => {
    if (record.customerCode !== customerCode || billingRecordMonth(record) !== month) return record;
    if (action === "lock") {
      return {
        ...record,
        statementStatus: "locked" as BillingStatementStatus,
        statementMonth: month,
        statementId,
        statementLockedAt: updatedAt,
        statementLockedBy: reviewer,
        statementReviewNote: reviewNote?.trim() || record.statementReviewNote,
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, approvalEvent("locked", "锁定月结账单", reviewer, reviewNote, updatedAt)),
      };
    }

    return {
      ...record,
      statementStatus: "open" as BillingStatementStatus,
      statementMonth: month,
      statementId: undefined,
      statementLockedAt: undefined,
      statementLockedBy: undefined,
      statementReviewNote: reviewNote?.trim() || record.statementReviewNote,
      updatedAt,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, approvalEvent("unlocked", "解除月结锁定", reviewer, reviewNote, updatedAt)),
    };
  });

  await writeCoreData(data);
  return {
    records: data.billingRecords.filter((item) => item.customerCode === customerCode && billingRecordMonth(item) === month),
    error: null,
  };
}

export async function updateCustomerBillingStatement({
  customerCode,
  month,
  action,
  message,
  paymentReference,
}: {
  customerCode: string;
  month: string;
  action: "confirm" | "dispute" | "submit_payment" | "request_invoice";
  message?: string;
  paymentReference?: string;
}) {
  const data = await getWarehouseCoreData();
  const records = data.billingRecords.filter((item) => item.customerCode === customerCode && billingRecordMonth(item) === month);
  if (records.length === 0) return { records: [] as BillingRecord[], error: "未找到该客户本月账单记录" };

  const updatedAt = now();
  const cleanMessage = message?.trim();
  const cleanPaymentReference = paymentReference?.trim();
  const statementId = records.find((record) => record.statementId)?.statementId || `STMT-${customerCode}-${month}`;

  data.billingRecords = data.billingRecords.map((record) => {
    if (record.customerCode !== customerCode || billingRecordMonth(record) !== month) return record;

    if (action === "confirm") {
      return {
        ...record,
        status: record.status === "paid" ? record.status : "confirmed",
        statementMonth: month,
        statementId,
        statementCustomerConfirmedAt: updatedAt,
        statementCustomerMessage: cleanMessage,
        customerConfirmedAt: record.customerConfirmedAt || updatedAt,
        customerMessage: cleanMessage || record.customerMessage,
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户确认月结单", "客户", cleanMessage, updatedAt)),
      };
    }

    if (action === "dispute") {
      return {
        ...record,
        status: record.status === "paid" ? record.status : "disputed",
        statementMonth: month,
        statementId,
        statementCustomerMessage: cleanMessage || "客户对本月结单提出异议，请运营复核。",
        customerMessage: cleanMessage || "客户对本月结单提出异议，请运营复核。",
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户提出月结异议", "客户", cleanMessage || "客户对本月结单提出异议，请运营复核。", updatedAt)),
      };
    }

    if (action === "submit_payment") {
      return {
        ...record,
        status: record.status === "paid" ? record.status : "payment_submitted",
        statementMonth: month,
        statementId,
        statementPaymentReference: cleanPaymentReference,
        statementPaymentNote: cleanMessage,
        statementPaymentSubmittedAt: updatedAt,
        statementPaymentRejectedAt: undefined,
        statementPaymentRejectedBy: undefined,
        statementPaymentRejectionNote: undefined,
        paymentReference: cleanPaymentReference,
        paymentNote: cleanMessage,
        paymentSubmittedAt: updatedAt,
        paymentRejectedAt: undefined,
        paymentRejectedBy: undefined,
        paymentRejectionNote: undefined,
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户提交月结付款", "客户", [cleanPaymentReference ? `付款参考号 ${cleanPaymentReference}` : "", cleanMessage].filter(Boolean).join(" / "), updatedAt)),
      };
    }

    return {
      ...record,
      statementMonth: month,
      statementId,
      invoiceStatus: record.invoiceStatus === "issued" ? record.invoiceStatus : "requested",
      invoiceRequestedAt: record.invoiceRequestedAt || updatedAt,
      invoiceNote: cleanMessage || record.invoiceNote,
      updatedAt,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("submitted", "客户申请月结开票", "客户", cleanMessage, updatedAt)),
    };
  });

  await writeCoreData(data);
  return {
    records: data.billingRecords.filter((item) => item.customerCode === customerCode && billingRecordMonth(item) === month),
    error: null,
  };
}

export async function updateStaffBillingStatement({
  customerCode,
  month,
  action,
  reviewer,
  paymentReference,
  reviewNote,
}: {
  customerCode: string;
  month: string;
  action: "mark_paid" | "issue_invoice" | "void_invoice" | "reopen" | "resolve_dispute" | "reject_payment";
  reviewer: string;
  paymentReference?: string;
  reviewNote?: string;
}) {
  const data = await getWarehouseCoreData();
  const records = data.billingRecords.filter((item) => item.customerCode === customerCode && billingRecordMonth(item) === month);
  if (records.length === 0) return { records: [] as BillingRecord[], error: "未找到该客户本月账单记录" };

  const updatedAt = now();
  const cleanReference = paymentReference?.trim();
  const cleanNote = reviewNote?.trim();
  const statementId = records.find((record) => record.statementId)?.statementId || `STMT-${customerCode}-${month}`;

  data.billingRecords = data.billingRecords.map((record) => {
    if (record.customerCode !== customerCode || billingRecordMonth(record) !== month) return record;

    if (action === "mark_paid") {
      return {
        ...record,
        status: record.status === "disputed" ? record.status : "paid",
        statementMonth: month,
        statementId,
        statementPaidAt: updatedAt,
        statementPaidBy: reviewer,
        statementPaymentReference: cleanReference || record.statementPaymentReference,
        statementReviewNote: cleanNote,
        paymentReference: cleanReference || record.paymentReference,
        reviewedBy: reviewer,
        reviewedAt: updatedAt,
        reviewNote: cleanNote,
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("approved", "财务确认月结到账", reviewer, [cleanReference ? `付款参考号 ${cleanReference}` : "", cleanNote].filter(Boolean).join(" / "), updatedAt)),
      };
    }

    if (action === "issue_invoice") {
      return {
        ...record,
        statementMonth: month,
        statementId,
        invoiceStatus: "issued",
        invoiceIssuedAt: updatedAt,
        invoiceUpdatedBy: reviewer,
        invoiceNote: cleanNote || record.invoiceNote,
        statementReviewNote: cleanNote,
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("approved", "财务开具发票", reviewer, cleanNote, updatedAt)),
      };
    }

    if (action === "void_invoice") {
      return {
        ...record,
        statementMonth: month,
        statementId,
        invoiceStatus: "voided",
        invoiceVoidedAt: updatedAt,
        invoiceUpdatedBy: reviewer,
        invoiceNote: cleanNote || record.invoiceNote,
        statementReviewNote: cleanNote,
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("rejected", "财务作废发票", reviewer, cleanNote, updatedAt)),
      };
    }

    if (action === "resolve_dispute") {
      return {
        ...record,
        status: record.status === "disputed" ? "confirmed" : record.status,
        statementMonth: month,
        statementId,
        statementReviewNote: cleanNote || "异议已复核，恢复为已确认账单。",
        reviewedBy: reviewer,
        reviewedAt: updatedAt,
        reviewNote: cleanNote || "异议已复核，恢复为已确认账单。",
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("approved", "财务解除月结异议", reviewer, cleanNote || "异议已复核，恢复为已确认账单。", updatedAt)),
      };
    }

    if (action === "reject_payment") {
      return {
        ...record,
        status: record.status === "payment_submitted" ? "confirmed" : record.status,
        statementMonth: month,
        statementId,
        statementPaymentRejectedAt: updatedAt,
        statementPaymentRejectedBy: reviewer,
        statementPaymentRejectionNote: cleanNote || "付款凭证未通过复核，请客户重新提交。",
        statementReviewNote: cleanNote || "付款凭证未通过复核，请客户重新提交。",
        paymentRejectedAt: updatedAt,
        paymentRejectedBy: reviewer,
        paymentRejectionNote: cleanNote || "付款凭证未通过复核，请重新提交。",
        reviewedBy: reviewer,
        reviewedAt: updatedAt,
        reviewNote: cleanNote || "付款凭证未通过复核，请客户重新提交。",
        updatedAt,
        approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("rejected", "财务驳回月结付款", reviewer, cleanNote || "付款凭证未通过复核，请客户重新提交。", updatedAt)),
      };
    }

    return {
      ...record,
      status: record.status === "paid" ? "confirmed" : record.status,
      statementMonth: month,
      statementId,
      statementPaidAt: undefined,
      statementPaidBy: undefined,
      statementReviewNote: cleanNote,
      reviewedBy: reviewer,
      reviewedAt: updatedAt,
      reviewNote: cleanNote,
      updatedAt,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("commented", "财务重开月结账单", reviewer, cleanNote, updatedAt)),
    };
  });

  await writeCoreData(data);
  return {
    records: data.billingRecords.filter((item) => item.customerCode === customerCode && billingRecordMonth(item) === month),
    error: null,
  };
}

export async function updateStaffBillingRecord({
  id,
  status,
  action,
  reviewer,
  reviewNote,
  paymentReference,
  workOrderId,
}: {
  id: string;
  status?: BillingRecord["status"];
  action?: BillingPaymentReviewAction;
  reviewer: string;
  reviewNote?: string;
  paymentReference?: string;
  workOrderId?: string;
}) {
  const data = await getWarehouseCoreData();
  const index = data.billingRecords.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updatedAt = now();
  const record = data.billingRecords[index];
  const cleanNote = reviewNote?.trim();
  const cleanReference = paymentReference?.trim();
  let nextRecord: BillingRecord = {
    ...record,
    reviewedBy: reviewer,
    reviewedAt: updatedAt,
    reviewNote: cleanNote,
    workOrderId: workOrderId?.trim() || record.workOrderId,
    updatedAt,
  };

  if (action === "mark_paid") {
    nextRecord = {
      ...nextRecord,
      status: "paid",
      paymentReference: cleanReference || record.paymentReference,
      paymentRejectedAt: undefined,
      paymentRejectedBy: undefined,
      paymentRejectionNote: undefined,
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("approved", "财务确认到账", reviewer, [cleanReference ? `付款参考号 ${cleanReference}` : "", cleanNote].filter(Boolean).join(" / "), updatedAt)),
    };
  } else if (action === "reject_payment") {
    nextRecord = {
      ...nextRecord,
      status: "confirmed",
      paymentRejectedAt: updatedAt,
      paymentRejectedBy: reviewer,
      paymentRejectionNote: cleanNote || "付款凭证需重新提交",
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("rejected", "财务驳回付款凭证", reviewer, cleanNote || "付款凭证需重新提交", updatedAt)),
    };
  } else if (action === "resolve_dispute" || action === "reopen") {
    nextRecord = {
      ...nextRecord,
      status: "confirmed",
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent("approved", action === "resolve_dispute" ? "财务解除账单异议" : "财务重开账单", reviewer, cleanNote, updatedAt)),
    };
  } else if (status) {
    nextRecord = {
      ...nextRecord,
      status,
      ...(status === "paid"
        ? {
            paymentRejectedAt: undefined,
            paymentRejectedBy: undefined,
            paymentRejectionNote: undefined,
          }
        : {}),
      approvalTimeline: appendApprovalTimeline(record.approvalTimeline, billingTimelineEvent(status === "paid" ? "approved" : "commented", `财务更新账单状态为${billingStatusLabel(status)}`, reviewer, cleanNote, updatedAt)),
    };
  }

  if (nextRecord.adjustmentKind) {
    nextRecord.adjustmentApprovalStatus = adjustmentApprovalStatusForBillingStatus(nextRecord.status);
  }

  data.billingRecords[index] = nextRecord;

  await writeCoreData(data);
  return data.billingRecords[index];
}

export function billingStatusLabel(status: BillingRecord["status"]) {
  if (status === "payment_submitted") return "待复核付款";
  const labels: Partial<Record<BillingRecord["status"], string>> = {
    draft: "待生成",
    pending_confirmation: "待确认",
    confirmed: "已确认",
    paid: "已付款",
    disputed: "有疑问",
  };
  return labels[status] ?? status;
}

export function billingInvoiceStatusLabel(status: BillingInvoiceStatus | undefined) {
  const labels: Record<BillingInvoiceStatus, string> = {
    not_requested: "未申请开票",
    requested: "已申请开票",
    issued: "已开票",
    voided: "已作废",
  };
  return labels[status || "not_requested"];
}
