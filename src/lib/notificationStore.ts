import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCustomerSelfServiceCenterData } from "./customerSelfServiceCenter";
import type { DocumentRecord } from "./documentStore";
import { buildInboundDocumentChecklist, type InboundSubmission, type InquirySubmission, type Submission } from "./localStore";
import { approvalRuleForTrigger, type ApprovalRuleConfig, type ApprovalRuleTrigger, type CustomerWorkOrder, type OpsExpansionData } from "./opsExpansionStore";
import type { OpsWorkbenchData } from "./opsStore";
import { getSlaRuleMap, type SlaNotificationRule, type SlaRuleKey } from "./slaRuleStore";
import { returnResolutionLabel, type WarehouseCoreData } from "./warehouseCoreStore";

export type NotificationAudience = "customer" | "staff";
export type NotificationSeverity = "info" | "warning" | "critical" | "success";
export type NotificationSource = "inquiry" | "inbound" | "billing" | "inventory" | "outbound" | "returns" | "logistics" | "document" | "work_order" | "approval" | "system";
export type NotificationChannel = "in_app" | "email" | "sms" | "wechat";

export type NotificationItem = {
  id: string;
  audience: NotificationAudience;
  customerCode?: string;
  source: NotificationSource;
  sourceId: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  href: string;
  createdAt: string;
  unread?: boolean;
  slaLevel?: "normal" | "near_due" | "overdue";
  channels?: NotificationChannel[];
};

type NotificationState = {
  dismissedIds: string[];
  readIds: string[];
  subscriptions: NotificationSubscription[];
  deliveries: NotificationDelivery[];
};

export type NotificationSubscription = {
  id: string;
  audience: NotificationAudience;
  customerCode?: string;
  staffRole?: string;
  sources: NotificationSource[];
  severities: NotificationSeverity[];
  channels: NotificationChannel[];
  enabled: boolean;
  updatedAt: string;
};

export type NotificationDelivery = {
  id: string;
  notificationId: string;
  audience: NotificationAudience;
  customerCode?: string;
  channel: Exclude<NotificationChannel, "in_app">;
  source: NotificationSource;
  sourceId: string;
  title: string;
  body: string;
  href: string;
  status: "queued" | "sent" | "failed" | "blocked";
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationProviderHealth = {
  channel: Exclude<NotificationChannel, "in_app">;
  label: string;
  configured: boolean;
  usesFallbackWebhook: boolean;
  tokenConfigured: boolean;
  webhookEnv: string;
};

const notificationStorePath = process.env.VERCEL
  ? path.join("/tmp", "warehouse-system-data", "notifications.json")
  : path.join(process.cwd(), ".local-data", "notifications.json");

function isInbound(item: Submission): item is InboundSubmission {
  return item.type === "inbound";
}

function isInquiry(item: Submission): item is InquirySubmission {
  return item.type === "inquiry";
}

function nowFallback(value?: string) {
  return value || new Date().toISOString();
}

async function readNotificationState(): Promise<NotificationState> {
  try {
    const raw = await readFile(notificationStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<NotificationState>;
    return {
      dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : [],
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { dismissedIds: [], readIds: [], subscriptions: [], deliveries: [] };
    if (error instanceof SyntaxError) return { dismissedIds: [], readIds: [], subscriptions: [], deliveries: [] };
    throw error;
  }
}

async function writeNotificationState(data: NotificationState) {
  await mkdir(path.dirname(notificationStorePath), { recursive: true });
  await writeFile(notificationStorePath, JSON.stringify(data, null, 2), "utf8");
}

function deliveryWebhookForChannel(channel: NotificationDelivery["channel"]) {
  if (channel === "email") return process.env.NOTIFICATION_EMAIL_WEBHOOK_URL || process.env.NOTIFICATION_DELIVERY_WEBHOOK_URL;
  if (channel === "sms") return process.env.NOTIFICATION_SMS_WEBHOOK_URL || process.env.NOTIFICATION_DELIVERY_WEBHOOK_URL;
  return process.env.NOTIFICATION_WECHAT_WEBHOOK_URL || process.env.NOTIFICATION_DELIVERY_WEBHOOK_URL;
}

export function notificationChannelLabel(channel: NotificationChannel) {
  if (channel === "in_app") return "站内信";
  if (channel === "email") return "邮件";
  if (channel === "sms") return "短信";
  return "微信";
}

function providerEnvName(channel: NotificationDelivery["channel"]) {
  if (channel === "email") return process.env.NOTIFICATION_EMAIL_WEBHOOK_URL ? "NOTIFICATION_EMAIL_WEBHOOK_URL" : "NOTIFICATION_DELIVERY_WEBHOOK_URL";
  if (channel === "sms") return process.env.NOTIFICATION_SMS_WEBHOOK_URL ? "NOTIFICATION_SMS_WEBHOOK_URL" : "NOTIFICATION_DELIVERY_WEBHOOK_URL";
  return process.env.NOTIFICATION_WECHAT_WEBHOOK_URL ? "NOTIFICATION_WECHAT_WEBHOOK_URL" : "NOTIFICATION_DELIVERY_WEBHOOK_URL";
}

export function getNotificationProviderHealth(): NotificationProviderHealth[] {
  return (["email", "sms", "wechat"] as Array<NotificationDelivery["channel"]>).map((channel) => {
    const webhook = deliveryWebhookForChannel(channel);
    const specificConfigured =
      (channel === "email" && Boolean(process.env.NOTIFICATION_EMAIL_WEBHOOK_URL)) ||
      (channel === "sms" && Boolean(process.env.NOTIFICATION_SMS_WEBHOOK_URL)) ||
      (channel === "wechat" && Boolean(process.env.NOTIFICATION_WECHAT_WEBHOOK_URL));
    return {
      channel,
      label: notificationChannelLabel(channel),
      configured: Boolean(webhook),
      usesFallbackWebhook: Boolean(webhook) && !specificConfigured,
      tokenConfigured: Boolean(process.env.NOTIFICATION_DELIVERY_TOKEN),
      webhookEnv: webhook ? providerEnvName(channel) : channel === "email" ? "NOTIFICATION_EMAIL_WEBHOOK_URL" : channel === "sms" ? "NOTIFICATION_SMS_WEBHOOK_URL" : "NOTIFICATION_WECHAT_WEBHOOK_URL",
    };
  });
}

function nextRetryAt(attempts: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + Math.min(120, Math.max(5, attempts * 15)));
  return date.toISOString();
}

async function syncNotificationDeliveries(items: NotificationItem[], state: NotificationState) {
  const existing = new Set(state.deliveries.map((item) => item.id));
  const timestamp = new Date().toISOString();
  let changed = false;
  items.forEach((item) => {
    (item.channels ?? ["in_app"]).filter((channel): channel is NotificationDelivery["channel"] => channel !== "in_app").forEach((channel) => {
      const id = `${item.id}:${channel}`;
      if (existing.has(id)) return;
      const hasWebhook = Boolean(deliveryWebhookForChannel(channel));
      state.deliveries.unshift({
        id,
        notificationId: item.id,
        audience: item.audience,
        customerCode: item.customerCode,
        channel,
        source: item.source,
        sourceId: item.sourceId,
        title: item.title,
        body: item.body,
        href: item.href,
        status: hasWebhook ? "queued" : "blocked",
        attempts: 0,
        lastError: hasWebhook ? undefined : `${channel} webhook not configured`,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      changed = true;
    });
  });
  state.deliveries = state.deliveries.slice(0, 1000);
  if (changed) await writeNotificationState(state);
}

async function deliverNotification(delivery: NotificationDelivery) {
  const webhookUrl = deliveryWebhookForChannel(delivery.channel);
  const timestamp = new Date().toISOString();
  if (!webhookUrl) {
    return {
      ...delivery,
      status: "blocked" as const,
      attempts: delivery.attempts + 1,
      lastError: `${delivery.channel} webhook not configured`,
      nextRetryAt: undefined,
      updatedAt: timestamp,
    };
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NOTIFICATION_DELIVERY_TOKEN ? { Authorization: `Bearer ${process.env.NOTIFICATION_DELIVERY_TOKEN}` } : {}),
      },
      body: JSON.stringify(delivery),
    });
    if (!response.ok) throw new Error(`provider returned ${response.status}`);
    return {
      ...delivery,
      status: "sent" as const,
      attempts: delivery.attempts + 1,
      lastError: undefined,
      nextRetryAt: undefined,
      deliveredAt: timestamp,
      updatedAt: timestamp,
    };
  } catch (error) {
    const attempts = delivery.attempts + 1;
    return {
      ...delivery,
      status: "failed" as const,
      attempts,
      lastError: error instanceof Error ? error.message : "notification delivery failed",
      nextRetryAt: nextRetryAt(attempts),
      updatedAt: timestamp,
    };
  }
}

async function filterDismissed(items: NotificationItem[]) {
  const state = await readNotificationState();
  const dismissed = new Set(state.dismissedIds);
  const read = new Set(state.readIds);
  const filtered = items
    .filter((item) => !dismissed.has(item.id))
    .map((item) => ({ ...item, unread: !read.has(item.id), channels: channelsForNotification(item, state.subscriptions) }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  await syncNotificationDeliveries(filtered, state);
  return filtered;
}

function channelsForNotification(item: NotificationItem, subscriptions: NotificationSubscription[]) {
  const matched = subscriptions.find(
    (subscription) =>
      subscription.enabled &&
      subscription.audience === item.audience &&
      (!subscription.customerCode || subscription.customerCode === item.customerCode) &&
      (subscription.sources.length === 0 || subscription.sources.includes(item.source)) &&
      (subscription.severities.length === 0 || subscription.severities.includes(item.severity)),
  );
  return matched?.channels ?? ["in_app"];
}

function severityRank(severity: NotificationSeverity) {
  if (severity === "critical") return 4;
  if (severity === "warning") return 3;
  if (severity === "info") return 2;
  return 1;
}

function hoursSince(value?: string) {
  const time = value ? new Date(value).getTime() : Date.now();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.round((Date.now() - time) / 36_000) / 100);
}

type NotificationBillingRecord = WarehouseCoreData["billingRecords"][number];

type StaffSystemAlertNotification = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  handlingStatus: "open" | "acknowledged" | "snoozed" | "resolved";
  actionHref?: string;
  createdAt: string;
};

function billingAmountText(record: NotificationBillingRecord) {
  return `GBP ${record.amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

function billingOverdueDays(record: NotificationBillingRecord) {
  if (!record.dueDate || record.status === "paid") return 0;
  const dueMs = new Date(`${record.dueDate}T23:59:59`).getTime();
  if (!Number.isFinite(dueMs) || dueMs >= Date.now()) return 0;
  return Math.floor((Date.now() - dueMs) / 86_400_000);
}

function billingDueSoon(record: NotificationBillingRecord) {
  if (!record.dueDate || record.status === "paid") return false;
  const dueMs = new Date(`${record.dueDate}T23:59:59`).getTime();
  return Number.isFinite(dueMs) && dueMs >= Date.now() && dueMs - Date.now() <= 3 * 86_400_000;
}

function billingSlaLevel(record: NotificationBillingRecord): NotificationItem["slaLevel"] {
  const overdue = billingOverdueDays(record);
  if (overdue > 0 || record.status === "disputed") return "overdue";
  if (record.status === "payment_submitted" || billingDueSoon(record)) return "near_due";
  return "normal";
}

type NotificationOutboundOrder = WarehouseCoreData["outboundOrders"][number];

function outboundRequiredQty(order: NotificationOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function outboundScannedQty(values?: Record<string, number>) {
  return Object.values(values ?? {}).reduce((sum, value) => sum + value, 0);
}

function outboundReviewGap(order: NotificationOutboundOrder) {
  const required = outboundRequiredQty(order);
  const picked = outboundScannedQty(order.scanProgress?.pickedQtyBySku);
  const sorted = outboundScannedQty(order.scanProgress?.sortedQtyBySku);
  const packed = outboundScannedQty(order.scanProgress?.packedQtyBySku);
  const openExceptions = (order.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
  const criticalExceptions = openExceptions.filter((exception) => exception.severity === "critical");
  return {
    required,
    picked,
    sorted,
    packed,
    pickGap: Math.max(0, required - picked),
    sortGap: Math.max(0, required - sorted),
    packGap: Math.max(0, required - packed),
    openExceptions,
    criticalExceptions,
  };
}

function latestCustomerVisibleMessage(item: CustomerWorkOrder) {
  return (item.messages ?? []).filter((message) => message.visibleToCustomer).at(-1);
}

function workOrderHref(audience: NotificationAudience) {
  return audience === "customer" ? "/portal#work-orders" : "/ops";
}

function approvalRuleBrief(rule: ApprovalRuleConfig) {
  return [
    `approver roles ${rule.approverRoles.join("/") || "not configured"}`,
    `SLA ${rule.slaHours}h`,
    rule.escalationRole ? `escalate to ${rule.escalationRole}` : "",
    rule.requireReason ? "reason required" : "",
    rule.requireAttachment ? "attachment required" : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

function approvalSeverity(rule: ApprovalRuleConfig, createdAt?: string) {
  const age = hoursSince(createdAt);
  if (age >= rule.slaHours) return "critical" as NotificationSeverity;
  if (age >= rule.slaHours * 0.8) return "warning" as NotificationSeverity;
  return rule.requireAttachment ? "warning" : "info";
}

function approvalTitle(rule: ApprovalRuleConfig, createdAt?: string) {
  return hoursSince(createdAt) >= rule.slaHours ? "approval SLA overdue" : rule.requireAttachment ? "approval pending with attachment" : "approval pending";
}

function adjustmentApprovalTrigger(requestedByRole: string, controlAction?: string): ApprovalRuleTrigger {
  if (requestedByRole === "stocktake") return "stocktake_difference";
  if (controlAction === "move_location") return "manual_inbound_outbound";
  return "inventory_adjustment";
}

function financeAdjustmentApprovalTrigger(kind?: NotificationBillingRecord["adjustmentKind"]): ApprovalRuleTrigger {
  return kind === "compensation" ? "claim_approval" : "manual_fee_adjustment";
}

function financeAdjustmentLabel(kind?: NotificationBillingRecord["adjustmentKind"]) {
  if (kind === "compensation") return "compensation";
  if (kind === "fee_adjustment") return "fee adjustment";
  return "finance adjustment";
}

function financeAdjustmentApprovalStatus(record: NotificationBillingRecord) {
  if (record.adjustmentApprovalStatus === "pending_approval") return "pending approval";
  if (record.adjustmentApprovalStatus === "approved") return "approved";
  if (record.adjustmentApprovalStatus === "posted") return "posted";
  if (record.adjustmentApprovalStatus === "rejected") return "rejected or disputed";
  if (record.adjustmentApprovalStatus === "paid") return "settled";
  if (record.status === "paid") return "settled";
  if (record.status === "confirmed") return "posted";
  if (record.status === "payment_submitted") return "payment review";
  if (record.status === "disputed") return "rejected or disputed";
  return "approved";
}

function financeAdjustmentApprovalRef(record: NotificationBillingRecord) {
  return record.workOrderId || `adjustment:${record.id}`;
}

function financeAdjustmentAttachmentStatus(record: NotificationBillingRecord, documents: DocumentRecord[]) {
  const refId = financeAdjustmentApprovalRef(record);
  const hasArchivedDocument = documents.some((document) => document.customerCode === record.customerCode && document.refType === "approval" && document.refId === refId);
  if (hasArchivedDocument) return "archived";
  if (record.adjustmentAttachmentStatus === "archived") return "archived";
  if (record.adjustmentAttachmentStatus === "confirmed") return "confirmed";
  if (record.adjustmentAttachmentStatus === "missing") return "missing";
  if (record.adjustmentAttachmentStatus === "not_required") return "not required";
  return "not recorded";
}

function financeSlaLevel(createdAt: string | undefined, slaHours = 24): NotificationItem["slaLevel"] {
  const age = hoursSince(createdAt);
  if (age >= slaHours) return "overdue";
  if (age >= slaHours * 0.8) return "near_due";
  return "normal";
}

function channelFromRuleValue(value: string): NotificationChannel | null {
  const text = value.trim().toLowerCase();
  if (text === "in_app" || text === "\u7ad9\u5185\u4fe1" || text === "\u7ad9\u5167\u4fe1") return "in_app";
  if (text === "email" || text === "\u90ae\u4ef6" || text === "\u90f5\u4ef6") return "email";
  if (text === "sms" || text === "\u77ed\u4fe1") return "sms";
  if (text === "wechat" || text === "\u5fae\u4fe1") return "wechat";
  return null;
}

function channelsFromRule(rule?: SlaNotificationRule): NotificationChannel[] | undefined {
  if (!rule?.enabled) return undefined;
  const channels = rule.channels.map(channelFromRuleValue).filter((item): item is NotificationChannel => Boolean(item));
  return channels.length > 0 ? channels : ["in_app"];
}

function slaLevelFromRule(ageHours: number, rule?: SlaNotificationRule): NotificationItem["slaLevel"] {
  if (!rule?.enabled) return "normal";
  if (ageHours >= rule.overdueHours) return "overdue";
  if (ageHours >= rule.nearDueHours) return "near_due";
  return "normal";
}

function ruleOrDefault(ruleMap: Map<SlaRuleKey, SlaNotificationRule>, key: SlaRuleKey, fallback: Pick<SlaNotificationRule, "overdueHours" | "nearDueHours" | "channels">): SlaNotificationRule {
  return (
    ruleMap.get(key) ?? {
      key,
      label: key,
      description: "",
      enabled: true,
      overdueHours: fallback.overdueHours,
      nearDueHours: fallback.nearDueHours,
      channels: fallback.channels,
      updatedAt: "fallback",
    }
  );
}

export async function dismissNotification(id: string) {
  const state = await readNotificationState();
  if (!state.dismissedIds.includes(id)) state.dismissedIds.push(id);
  if (!state.readIds.includes(id)) state.readIds.push(id);
  await writeNotificationState(state);
}

export async function markNotificationRead(id: string) {
  const state = await readNotificationState();
  if (!state.readIds.includes(id)) state.readIds.push(id);
  await writeNotificationState(state);
}

export async function markNotificationsRead(ids: string[]) {
  const state = await readNotificationState();
  const read = new Set(state.readIds);
  ids.forEach((id) => read.add(id));
  state.readIds = Array.from(read).slice(-5000);
  await writeNotificationState(state);
}

export async function getNotificationSubscriptions() {
  const state = await readNotificationState();
  return state.subscriptions;
}

export async function upsertNotificationSubscription(input: Omit<NotificationSubscription, "id" | "updatedAt"> & { id?: string }) {
  const state = await readNotificationState();
  const timestamp = new Date().toISOString();
  const existing = input.id ? state.subscriptions.find((item) => item.id === input.id) : undefined;
  const subscription: NotificationSubscription = {
    id: existing?.id ?? `NSUB-${Date.now()}`,
    audience: input.audience,
    customerCode: input.customerCode?.trim() || undefined,
    staffRole: input.staffRole?.trim() || undefined,
    sources: input.sources,
    severities: input.severities,
    channels: input.channels.length > 0 ? input.channels : ["in_app"],
    enabled: input.enabled,
    updatedAt: timestamp,
  };
  if (existing) Object.assign(existing, subscription);
  else state.subscriptions.unshift(subscription);
  await writeNotificationState(state);
  return subscription;
}

export async function getNotificationDeliveries(limit = 50) {
  const state = await readNotificationState();
  return [...state.deliveries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
}

export async function retryNotificationDelivery(id: string) {
  const state = await readNotificationState();
  const index = state.deliveries.findIndex((item) => item.id === id);
  if (index < 0) return { delivery: null, error: "notification delivery not found" };
  const updated = await deliverNotification(state.deliveries[index]);
  state.deliveries[index] = updated;
  await writeNotificationState(state);
  return { delivery: updated, error: null };
}

export async function retryDueNotificationDeliveries(limit = 50) {
  const state = await readNotificationState();
  const timestamp = Date.now();
  const dueIndexes = state.deliveries
    .map((delivery, index) => ({ delivery, index }))
    .filter(({ delivery }) => {
      if (delivery.status === "sent") return false;
      if (delivery.status === "queued") return true;
      if (delivery.status === "blocked") return false;
      if (!delivery.nextRetryAt) return true;
      const retryAt = new Date(delivery.nextRetryAt).getTime();
      return !Number.isFinite(retryAt) || retryAt <= timestamp;
    })
    .sort((left, right) => new Date(left.delivery.updatedAt).getTime() - new Date(right.delivery.updatedAt).getTime())
    .slice(0, Math.max(1, limit));

  const deliveries: NotificationDelivery[] = [];
  for (const item of dueIndexes) {
    const updated = await deliverNotification(state.deliveries[item.index]);
    state.deliveries[item.index] = updated;
    deliveries.push(updated);
  }

  if (deliveries.length > 0) await writeNotificationState(state);
  return {
    attempted: deliveries.length,
    sent: deliveries.filter((delivery) => delivery.status === "sent").length,
    failed: deliveries.filter((delivery) => delivery.status === "failed").length,
    blocked: deliveries.filter((delivery) => delivery.status === "blocked").length,
    deliveries,
  };
}

export async function testNotificationDelivery(channel: NotificationDelivery["channel"], actorName: string) {
  const state = await readNotificationState();
  const timestamp = new Date().toISOString();
  const delivery: NotificationDelivery = {
    id: `test:${channel}:${Date.now()}`,
    notificationId: `test:${channel}:${Date.now()}`,
    audience: "staff",
    channel,
    source: "system",
    sourceId: "notification-provider-test",
    title: `${notificationChannelLabel(channel)}测试通知`,
    body: `${actorName} 发起了${notificationChannelLabel(channel)}供应商测试投递。`,
    href: "/ops?section=permissions",
    status: "queued",
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const delivered = await deliverNotification(delivery);
  state.deliveries.unshift(delivered);
  state.deliveries = state.deliveries.slice(0, 1000);
  await writeNotificationState(state);
  return delivered;
}

export async function getCustomerNotifications({
  customerCode,
  submissions,
  opsData,
  coreData,
  documents = [],
  workOrders = [],
}: {
  customerCode: string;
  submissions: Submission[];
  opsData: OpsWorkbenchData;
  coreData: Pick<WarehouseCoreData, "billingRecords" | "inventoryBalances" | "outboundOrders" | "returnOrders">;
  documents?: DocumentRecord[];
  workOrders?: CustomerWorkOrder[];
}) {
  const items: NotificationItem[] = [];
  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);
  const customerWorkOrders = workOrders.filter((item) => item.customerCode === customerCode);
  const selfServiceCenter = buildCustomerSelfServiceCenterData({ customerCode, submissions, coreData, documents, workOrders: customerWorkOrders });
  const dueSelfServiceActions = selfServiceCenter.actions.filter((item) => item.severity !== "\u6b63\u5e38" || item.slaLevel === "near_due" || item.slaLevel === "overdue");
  const overdueSelfServiceActions = dueSelfServiceActions.filter((item) => item.slaLevel === "overdue");
  const urgentSelfServiceActions = dueSelfServiceActions.filter((item) => item.severity === "\u7d27\u6025");

  if (dueSelfServiceActions.length > 0) {
    const topActions = dueSelfServiceActions.slice(0, 3);
    const digestKey = `${overdueSelfServiceActions.length}-${urgentSelfServiceActions.length}-${dueSelfServiceActions.length}-${topActions.map((item) => item.id).join("-")}`;
    items.push({
      id: `customer:${customerCode}:self-service-digest:${digestKey}`,
      audience: "customer",
      customerCode,
      source: "system",
      sourceId: "self-service-actions",
      title: overdueSelfServiceActions.length > 0 ? "\u81ea\u52a9\u5f85\u529e\u5df2\u8d85\u65f6" : urgentSelfServiceActions.length > 0 ? "\u81ea\u52a9\u5f85\u529e\u9700\u4f18\u5148\u5904\u7406" : "\u81ea\u52a9\u5f85\u529e\u5f85\u5904\u7406",
      body: [`\u5f53\u524d\u6709 ${dueSelfServiceActions.length} \u9879\u5f85\u5904\u7406`, overdueSelfServiceActions.length > 0 ? `${overdueSelfServiceActions.length} \u9879\u5df2\u8d85\u65f6` : "", urgentSelfServiceActions.length > 0 ? `${urgentSelfServiceActions.length} \u9879\u7d27\u6025` : "", `\u4f18\u5148\u5904\u7406\uff1a${topActions.map((item) => `${item.module}-${item.title}`).join("\uff1b")}`].filter(Boolean).join(" / "),
      severity: overdueSelfServiceActions.length > 0 || urgentSelfServiceActions.length > 0 ? "critical" : "warning",
      href: "/portal",
      createdAt: new Date().toISOString(),
      slaLevel: overdueSelfServiceActions.length > 0 ? "overdue" : dueSelfServiceActions.some((item) => item.slaLevel === "near_due") ? "near_due" : "normal",
      channels: overdueSelfServiceActions.length > 0 || urgentSelfServiceActions.length > 0 ? ["in_app", "email"] : ["in_app"],
    });
  }

  inquiries.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if ((item.status === "quoted" || item.status === "waiting_customer") && item.quoteDraft) {
      items.push({
        id: `customer:${customerCode}:quote:${item.id}`,
        audience: "customer",
        customerCode,
        source: "inquiry",
        sourceId: item.id,
        title: "\u62a5\u4ef7\u5f85\u786e\u8ba4",
        body: `${item.service || "\u62a5\u4ef7\u65b9\u6848"} \u5df2\u751f\u6210\uff0c\u8bf7\u786e\u8ba4\u8d39\u7528\u6216\u63d0\u51fa\u95ee\u9898\u3002`,
        severity: "warning",
        href: "/portal",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  inbounds.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    const checklist = buildInboundDocumentChecklist(item);
    if (checklist.missingRequired.length > 0) {
      items.push({ id: `customer:${customerCode}:inbound-docs:${item.id}`, audience: "customer", customerCode, source: "inbound", sourceId: item.id, title: "\u5165\u5e93\u8d44\u6599\u5f85\u8865", body: `${item.id} \u7f3a\u5c11 ${checklist.missingRequired.join("\u3001")}\u3002`, severity: "warning", href: "/supplement", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    }
    if (!item.tracking) {
      items.push({ id: `customer:${customerCode}:inbound-tracking:${item.id}`, audience: "customer", customerCode, source: "inbound", sourceId: item.id, title: "\u8ffd\u8e2a\u53f7\u5f85\u8865", body: `${item.id} \u5c1a\u672a\u8865\u5145\u8ffd\u8e2a\u53f7\uff0c\u4ed3\u5e93\u5230\u8d27\u8bc6\u522b\u4f1a\u53d8\u6162\u3002`, severity: "critical", href: "/supplement", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    }
  });

  coreData.billingRecords.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if (!["pending_confirmation", "confirmed", "payment_submitted", "disputed"].includes(item.status)) return;
    const overdue = billingOverdueDays(item);
    const dueSoon = billingDueSoon(item);
    const submitted = item.status === "payment_submitted";
    const adjustmentTitle = item.adjustmentKind ? `${financeAdjustmentLabel(item.adjustmentKind)} generated` : "";
    const title = adjustmentTitle || (item.status === "confirmed" ? (overdue > 0 ? "\u8d26\u5355\u5df2\u903e\u671f\uff0c\u8bf7\u5c3d\u5feb\u4ed8\u6b3e" : dueSoon ? "\u8d26\u5355\u5373\u5c06\u5230\u671f" : "\u8d26\u5355\u5f85\u4ed8\u6b3e") : item.status === "payment_submitted" ? "\u4ed8\u6b3e\u51ed\u8bc1\u5df2\u63d0\u4ea4" : item.status === "disputed" ? "\u8d26\u5355\u5f02\u8bae\u5904\u7406\u4e2d" : "\u8d26\u5355\u5f85\u786e\u8ba4");
    const bodyParts = [`${item.title} / ${billingAmountText(item)}`, item.adjustmentKind ? "finance review synced to billing center" : "", item.workOrderId ? `work order ${item.workOrderId}` : "", item.adjustmentSourceRecordId ? `source bill ${item.adjustmentSourceRecordId}` : "", item.dueDate ? `due ${item.dueDate}` : "", overdue > 0 ? `overdue ${overdue} days` : "", submitted ? "payment proof will be reviewed soon" : ""].filter(Boolean);
    items.push({ id: `customer:${customerCode}:billing:${item.id}:${item.status}:${overdue > 0 ? `overdue-${overdue}` : dueSoon ? "due-soon" : "open"}`, audience: "customer", customerCode, source: "billing", sourceId: item.id, title, body: bodyParts.join(" / "), severity: item.adjustmentKind ? "success" : item.status === "disputed" || overdue > 0 ? "critical" : submitted ? "info" : "warning", href: "/billing", createdAt: nowFallback(item.updatedAt ?? item.createdAt), slaLevel: item.adjustmentKind ? "normal" : billingSlaLevel(item), channels: item.status === "disputed" || overdue > 0 ? ["in_app", "email"] : undefined });
  });

  coreData.inventoryBalances.forEach((item) => {
    if (item.customerCode !== customerCode || item.availableQty >= item.alertQty) return;
    items.push({ id: `customer:${customerCode}:inventory-low:${item.id}`, audience: "customer", customerCode, source: "inventory", sourceId: item.id, title: "\u5e93\u5b58\u4f4e\u4e8e\u9884\u8b66", body: `${item.skuCode} \u53ef\u7528 ${item.availableQty}\uff0c\u4f4e\u4e8e\u9884\u8b66 ${item.alertQty}\u3002`, severity: "warning", href: "/skus", createdAt: item.updatedAt });
  });

  coreData.outboundOrders.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if (item.interceptStatus === "requested" || item.interceptStatus === "restock_pending" || item.interceptStatus === "completed") {
      items.push({ id: `customer:${customerCode}:outbound-intercept:${item.id}:${item.interceptStatus}`, audience: "customer", customerCode, source: "outbound", sourceId: item.id, title: item.interceptStatus === "completed" ? "\u51fa\u5e93\u5355\u5df2\u622a\u5355\u56de\u5e93" : "\u51fa\u5e93\u5355\u622a\u5355\u5904\u7406\u4e2d", body: `${item.id} / ${item.channel} / ${item.interceptReason || "intercept reviewing"}`, severity: item.interceptStatus === "completed" ? "info" : "warning", href: "/outbound", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
      return;
    }
    if (item.status === "blocked" || item.status === "label_pending") {
      items.push({ id: `customer:${customerCode}:outbound:${item.id}:${item.status}`, audience: "customer", customerCode, source: "outbound", sourceId: item.id, title: item.status === "blocked" ? "\u51fa\u5e93\u5f02\u5e38\u963b\u585e" : "\u51fa\u5e93\u5f85\u9762\u5355", body: `${item.id} / ${item.channel} / ${item.orderCount} \u5355\u3002`, severity: item.status === "blocked" ? "critical" : "warning", href: "/outbound", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    }
  });

  coreData.returnOrders.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if (!item.buyerReturnTracking && !["received", "inspection", "repair", "restocked", "disposed", "closed"].includes(item.status)) {
      items.push({ id: `customer:${customerCode}:returns-tracking:${item.id}:${item.updatedAt ?? item.createdAt}`, audience: "customer", customerCode, source: "returns", sourceId: item.id, title: "\u9000\u8d27\u8ffd\u8e2a\u53f7\u5f85\u8865\u5145", body: `${item.id} \u5c1a\u672a\u586b\u5199\u4e70\u5bb6\u9000\u8d27\u8ffd\u8e2a\u53f7\u3002`, severity: "warning", href: "/returns", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
      return;
    }
    if (["received", "inspection", "repair", "exception"].includes(item.status) && !item.customerResolutionDecision) {
      items.push({ id: `customer:${customerCode}:returns-decision:${item.id}:${item.updatedAt ?? item.createdAt}`, audience: "customer", customerCode, source: "returns", sourceId: item.id, title: "\u9000\u8d27\u5904\u7406\u65b9\u5f0f\u5f85\u786e\u8ba4", body: `${item.id} \u8bf7\u786e\u8ba4\u91cd\u65b0\u4e0a\u67b6\u3001\u7ef4\u4fee\u3001\u62a5\u5e9f\u6216\u8f6c\u5bc4\u3002`, severity: item.status === "exception" ? "critical" : "warning", href: "/returns", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
      return;
    }
    if (["requested", "received", "inspection", "exception"].includes(item.status)) {
      items.push({ id: `customer:${customerCode}:returns:${item.id}:${item.status}`, audience: "customer", customerCode, source: "returns", sourceId: item.id, title: item.status === "exception" ? "\u9000\u8d27\u5f02\u5e38\u5904\u7406\u4e2d" : item.status === "inspection" ? "\u9000\u8d27\u8d28\u68c0\u4e2d" : "\u9000\u8d27\u5904\u7406\u5f85\u63a8\u8fdb", body: `${item.id} / ${item.platform} / ${item.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join(";")}`, severity: item.status === "exception" ? "critical" : "warning", href: "/returns", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    }
  });

  opsData.logistics.filter((item) => item.customerCode === customerCode && item.status !== "resolved").forEach((item) => {
    items.push({ id: `customer:${customerCode}:logistics:${item.id}:${item.status}`, audience: "customer", customerCode, source: "logistics", sourceId: item.id, title: "\u7269\u6d41\u5f02\u5e38\u5904\u7406\u4e2d", body: `${item.trackingNo} / ${item.issue}`, severity: item.status === "waiting_customer" ? "critical" : "warning", href: "/tracking", createdAt: item.updatedAt });
  });

  customerWorkOrders.filter((item) => !["resolved", "cancelled"].includes(item.status)).forEach((item) => {
    const latest = latestCustomerVisibleMessage(item);
    const ageHours = hoursSince(item.updatedAt);
    if (item.status !== "waiting_customer" && latest?.authorRole !== "ops") return;
    items.push({ id: `customer:${customerCode}:work-order:${item.id}:${item.updatedAt}`, audience: "customer", customerCode, source: "work_order", sourceId: item.id, title: item.status === "waiting_customer" ? "\u5de5\u5355\u5f85\u60a8\u8865\u5145" : "\u8fd0\u8425\u5df2\u56de\u590d\u5de5\u5355", body: `${item.title}${latest?.body ? `; ${latest.body}` : ""}`, severity: item.priority === "urgent" || ageHours >= 48 ? "critical" : "warning", href: workOrderHref("customer"), createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
  });

  return filterDismissed(items);
}

export async function getStaffNotifications({
  submissions,
  opsData,
  coreData,
  documents,
  expansionData,
  workOrders = [],
  systemAlerts = [],
}: {
  submissions: Submission[];
  opsData: OpsWorkbenchData;
  coreData: Pick<WarehouseCoreData, "billingRecords" | "inventoryBalances" | "inventoryAdjustments" | "outboundOrders" | "returnOrders" | "stocktakeBatches" | "transferOrders">;
  documents: DocumentRecord[];
  expansionData?: Pick<OpsExpansionData, "approvalRules">;
  workOrders?: CustomerWorkOrder[];
  systemAlerts?: StaffSystemAlertNotification[];
}) {
  const items: NotificationItem[] = [];
  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);
  const approvalData = expansionData ?? { approvalRules: [] };
  const slaRules = await getSlaRuleMap();
  const inboundRule = ruleOrDefault(slaRules, "inbound_putaway", { overdueHours: 48, nearDueHours: 38, channels: ["in_app", "email"] });
  const outboundRule = ruleOrDefault(slaRules, "outbound_ship", { overdueHours: 24, nearDueHours: 19, channels: ["in_app", "email"] });
  const outboundInterceptRule = ruleOrDefault(slaRules, "outbound_intercept", { overdueHours: 24, nearDueHours: 19, channels: ["in_app", "email"] });
  const outboundWeightRule = ruleOrDefault(slaRules, "outbound_weight", { overdueHours: 24, nearDueHours: 19, channels: ["in_app"] });
  const workOrderOpenRule = ruleOrDefault(slaRules, "work_order_open", { overdueHours: 24, nearDueHours: 19, channels: ["in_app", "email"] });
  const workOrderProcessingRule = ruleOrDefault(slaRules, "work_order_processing", { overdueHours: 48, nearDueHours: 38, channels: ["in_app"] });
  const financeReviewRule = ruleOrDefault(slaRules, "finance_review", { overdueHours: 24, nearDueHours: 18, channels: ["in_app", "email"] });

  systemAlerts.filter((alert) => alert.handlingStatus === "open" && alert.severity !== "info").slice(0, 12).forEach((alert) => {
    items.push({ id: `staff:system-alert:${alert.id}:${alert.severity}`, audience: "staff", source: "system", sourceId: alert.id, title: alert.severity === "critical" ? `\u4e25\u91cd\u544a\u8b66: ${alert.title}` : `\u7cfb\u7edf\u544a\u8b66: ${alert.title}`, body: alert.detail, severity: alert.severity === "critical" ? "critical" : "warning", href: alert.actionHref || "/ops?section=overview", createdAt: nowFallback(alert.createdAt), slaLevel: alert.severity === "critical" ? "overdue" : "near_due", channels: alert.severity === "critical" ? ["in_app", "email"] : ["in_app"] });
  });

  inquiries.forEach((item) => {
    if (item.status !== "new" && item.status !== "quote_question") return;
    const inquiryDocuments = documents.filter((document) => document.refType === "inquiry" && document.refId === item.id);
    items.push({ id: `staff:inquiry:${item.id}:${item.status}:docs-${inquiryDocuments.length}`, audience: "staff", customerCode: item.customerCode, source: "inquiry", sourceId: item.id, title: item.status === "quote_question" ? "\u5ba2\u6237\u63d0\u51fa\u62a5\u4ef7\u7591\u95ee" : inquiryDocuments.length > 0 ? "\u5e26\u8d44\u6599\u8be2\u76d8\u5f85\u4f18\u5148\u62a5\u4ef7" : "\u65b0\u8be2\u76d8\u5f85\u5904\u7406", body: `${item.company || item.contact} / ${item.service || "service pending"}${inquiryDocuments.length > 0 ? ` / docs ${inquiryDocuments.length}` : ""}`, severity: item.status === "quote_question" || inquiryDocuments.length > 0 ? "critical" : "warning", href: "/ops?section=inquiry", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
  });

  inbounds.forEach((item) => {
    const checklist = buildInboundDocumentChecklist(item);
    const ageHours = hoursSince(item.updatedAt ?? item.createdAt);
    if (checklist.missingRequired.length === 0 && item.tracking && item.status !== "exception" && item.status !== "on_hold") return;
    items.push({ id: `staff:inbound:${item.id}:${item.status}:${checklist.missingRequired.length}:${item.tracking ? "tracked" : "no-track"}:${ageHours >= inboundRule.overdueHours ? "overdue" : "open"}`, audience: "staff", customerCode: item.customerCode, source: "inbound", sourceId: item.id, title: ageHours >= inboundRule.overdueHours ? "\u5165\u5e93 SLA \u5df2\u8d85\u65f6" : item.status === "exception" ? "\u5165\u5e93\u5f02\u5e38\u5f85\u5904\u7406" : "\u5165\u5e93\u8d44\u6599\u5f85\u590d\u6838", body: `${item.id} / docs ${checklist.requiredReady}/${checklist.requiredTotal}${item.tracking ? "" : " / no tracking"} / ${ageHours}h`, severity: ageHours >= inboundRule.overdueHours || item.status === "exception" || !item.tracking ? "critical" : "warning", href: "/ops?section=inbound", createdAt: nowFallback(item.updatedAt ?? item.createdAt), slaLevel: slaLevelFromRule(ageHours, inboundRule), channels: ageHours >= inboundRule.nearDueHours || item.status === "exception" || !item.tracking ? channelsFromRule(inboundRule) : undefined });
  });

  opsData.logistics.filter((item) => item.status !== "resolved").forEach((item) => {
    items.push({ id: `staff:logistics:${item.id}:${item.status}`, audience: "staff", customerCode: item.customerCode, source: "logistics", sourceId: item.id, title: "\u7269\u6d41\u5f02\u5e38\u5f85\u63a8\u8fdb", body: `${item.trackingNo} / ${item.issue} / ${item.deadline}`, severity: item.status === "open" ? "critical" : "warning", href: "/ops?section=logistics", createdAt: item.updatedAt });
  });

  coreData.billingRecords.forEach((item) => {
    if (!["payment_submitted", "disputed", "pending_confirmation", "confirmed"].includes(item.status)) return;
    const overdue = billingOverdueDays(item);
    const dueSoon = billingDueSoon(item);
    if (item.status === "confirmed" && overdue <= 0 && !dueSoon) return;
    const title = item.status === "payment_submitted" ? "\u4ed8\u6b3e\u51ed\u8bc1\u5f85\u8d22\u52a1\u590d\u6838" : item.status === "disputed" ? "\u8d26\u5355\u5f02\u8bae\u5f85\u5904\u7406" : item.status === "confirmed" ? (overdue > 0 ? "\u5ba2\u6237\u8d26\u5355\u5df2\u903e\u671f" : "\u5ba2\u6237\u8d26\u5355\u5373\u5c06\u5230\u671f") : "\u8d26\u5355\u5f85\u5ba2\u6237\u786e\u8ba4";
    const bodyParts = [`${item.id} / ${item.customerCode}`, `${item.title} / ${billingAmountText(item)}`, item.paymentReference ? `payment ref ${item.paymentReference}` : "", item.dueDate ? `due ${item.dueDate}` : "", overdue > 0 ? `overdue ${overdue}d` : "", item.customerMessage ? `customer note: ${item.customerMessage}` : ""].filter(Boolean);
    items.push({ id: `staff:billing:${item.id}:${item.status}:${overdue > 0 ? `overdue-${overdue}` : dueSoon ? "due-soon" : "open"}`, audience: "staff", customerCode: item.customerCode, source: "billing", sourceId: item.id, title, body: bodyParts.join(" / "), severity: item.status === "disputed" || overdue > 0 ? "critical" : "warning", href: "/ops?section=billing", createdAt: nowFallback(item.updatedAt ?? item.createdAt), slaLevel: billingSlaLevel(item), channels: item.status === "disputed" || overdue > 0 || item.status === "payment_submitted" ? ["in_app", "email"] : undefined });
  });

  coreData.billingRecords.filter((item) => Boolean(item.adjustmentKind)).forEach((item) => {
    const createdAt = item.generatedAt ?? item.createdAt;
    const rule = approvalRuleForTrigger(approvalData, financeAdjustmentApprovalTrigger(item.adjustmentKind), Math.abs(item.amount), 1);
    const slaHours = rule?.slaHours ?? financeReviewRule.overdueHours;
    const ageHours = hoursSince(createdAt);
    const level = financeSlaLevel(createdAt, slaHours);
    const label = financeAdjustmentLabel(item.adjustmentKind);
    const amount = billingAmountText(item);
    const approvalStatus = financeAdjustmentApprovalStatus(item);
    const attachmentStatus = financeAdjustmentAttachmentStatus(item, documents);
    const missingAttachment = rule?.requireAttachment && (attachmentStatus === "missing" || attachmentStatus === "not recorded");
    const needsAttention = missingAttachment || ["pending approval", "payment review", "rejected or disputed"].includes(approvalStatus) || level === "overdue" || level === "near_due";
    if (!needsAttention) return;
    const sourceText = [item.workOrderId ? `work order ${item.workOrderId}` : "", item.adjustmentSourceRecordId ? `source bill ${item.adjustmentSourceRecordId}` : ""].filter(Boolean).join(" / ");
    const title = missingAttachment ? `${label} attachment missing` : approvalStatus === "payment review" ? `${label} payment review` : approvalStatus === "rejected or disputed" ? `${label} dispute review` : level === "overdue" ? `${label} approval overdue` : level === "near_due" ? `${label} approval near due` : `${label} pending`;
    items.push({ id: `staff:approval:finance-adjustment:${item.id}:${item.status}:${approvalStatus}:${attachmentStatus}:${level}`, audience: "staff", customerCode: item.customerCode, source: "approval", sourceId: item.id, title, body: `${item.customerCode} / ${item.id} / ${amount} / ${approvalStatus} / ${attachmentStatus} / ${ageHours}h${sourceText ? ` / ${sourceText}` : ""}${rule ? ` / ${approvalRuleBrief(rule)}` : ""}`, severity: missingAttachment || level === "overdue" || Math.abs(item.amount) >= 100 || approvalStatus === "rejected or disputed" ? "critical" : "warning", href: "/ops?section=billing", createdAt: nowFallback(createdAt), slaLevel: missingAttachment ? (level === "normal" ? "near_due" : level) : level, channels: missingAttachment || level === "overdue" || Math.abs(item.amount) >= 100 || approvalStatus === "rejected or disputed" ? channelsFromRule(financeReviewRule) : undefined });
  });

  coreData.outboundOrders.forEach((item) => {
    const reviewGap = outboundReviewGap(item);
    if ((item.interceptStatus === "requested" || item.interceptStatus === "restock_pending") && item.status !== "shipped") {
      const ageHours = hoursSince(item.interceptRequestedAt ?? item.updatedAt ?? item.createdAt);
      items.push({ id: `staff:outbound-intercept:${item.id}:${item.interceptStatus}:${ageHours >= outboundInterceptRule.overdueHours ? "overdue" : "open"}`, audience: "staff", customerCode: item.customerCode, source: "approval", sourceId: item.id, title: ageHours >= outboundInterceptRule.overdueHours ? "\u51fa\u5e93\u622a\u5355\u5ba1\u6279\u5df2\u8d85\u65f6" : "\u51fa\u5e93\u622a\u5355\u5f85\u5ba1\u6279", body: `${item.id} / ${item.customerCode} / ${item.interceptReason || "intercept review"} / ${ageHours}h`, severity: ageHours >= outboundInterceptRule.overdueHours ? "critical" : "warning", href: "/warehouse", createdAt: nowFallback(item.interceptRequestedAt ?? item.updatedAt ?? item.createdAt), slaLevel: slaLevelFromRule(ageHours, outboundInterceptRule), channels: ageHours >= outboundInterceptRule.nearDueHours ? channelsFromRule(outboundInterceptRule) : undefined });
    }
    if (item.status === "handover" && !item.packageWeightKg) {
      const ageHours = hoursSince(item.updatedAt ?? item.createdAt);
      items.push({ id: `staff:outbound-weight:${item.id}:${ageHours >= outboundWeightRule.overdueHours ? "overdue" : "open"}`, audience: "staff", customerCode: item.customerCode, source: "outbound", sourceId: item.id, title: ageHours >= outboundWeightRule.overdueHours ? "\u51fa\u5e93\u5f85\u79f0\u91cd\u5df2\u8d85\u65f6" : "\u51fa\u5e93\u5f85\u79f0\u91cd\u7b7e\u51fa", body: `${item.id} / ${item.channel} / weight required`, severity: ageHours >= outboundWeightRule.overdueHours ? "critical" : "warning", href: "/warehouse", createdAt: nowFallback(item.updatedAt ?? item.createdAt), slaLevel: slaLevelFromRule(ageHours, outboundWeightRule), channels: ageHours >= outboundWeightRule.nearDueHours ? channelsFromRule(outboundWeightRule) : undefined });
    }
    if (reviewGap.criticalExceptions.length > 0) {
      items.push({ id: `staff:outbound-critical-exception:${item.id}:${reviewGap.criticalExceptions.length}`, audience: "staff", customerCode: item.customerCode, source: "outbound", sourceId: item.id, title: "\u51fa\u5e93\u4e25\u91cd\u590d\u6838\u5f02\u5e38\u5f85\u5904\u7406", body: `${item.id} / ${reviewGap.criticalExceptions[0]?.message ?? "critical exception"} / ${reviewGap.criticalExceptions.length}`, severity: "critical", href: "/warehouse", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    }
    if ((item.status === "picking" || item.status === "packing_check" || item.status === "handover") && reviewGap.required > 0 && (reviewGap.pickGap > 0 || reviewGap.sortGap > 0 || reviewGap.packGap > 0)) {
      items.push({ id: `staff:outbound-review-gap:${item.id}:${reviewGap.pickGap}-${reviewGap.sortGap}-${reviewGap.packGap}`, audience: "staff", customerCode: item.customerCode, source: "outbound", sourceId: item.id, title: "\u51fa\u5e93\u590d\u6838\u6570\u91cf\u7f3a\u53e3\u5f85\u5904\u7406", body: `${item.id} / required ${reviewGap.required} / pick ${reviewGap.pickGap} / sort ${reviewGap.sortGap} / pack ${reviewGap.packGap}`, severity: item.status === "handover" || reviewGap.openExceptions.length > 0 ? "critical" : "warning", href: "/warehouse", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    }
    if (item.status !== "shipped") {
      const ageHours = hoursSince(item.updatedAt ?? item.createdAt);
      items.push({ id: `staff:outbound:${item.id}:${item.status}:${ageHours >= outboundRule.overdueHours ? "overdue" : "open"}`, audience: "staff", customerCode: item.customerCode, source: "outbound", sourceId: item.id, title: ageHours >= outboundRule.overdueHours ? "\u51fa\u5e93 SLA \u5df2\u8d85\u65f6" : item.status === "blocked" ? "\u51fa\u5e93\u5f02\u5e38\u963b\u585e" : "\u5ba2\u6237\u51fa\u5e93\u7533\u8bf7\u5f85\u63a8\u8fdb", body: `${item.id} / ${item.channel} / ${item.orderCount} / ${ageHours}h`, severity: ageHours >= outboundRule.overdueHours || item.status === "blocked" || item.status === "label_pending" ? "critical" : "warning", href: "/ops?section=outbound", createdAt: nowFallback(item.updatedAt ?? item.createdAt), slaLevel: slaLevelFromRule(ageHours, outboundRule), channels: ageHours >= outboundRule.nearDueHours || item.status === "blocked" || item.status === "label_pending" ? channelsFromRule(outboundRule) : undefined });
    }
  });

  coreData.returnOrders.forEach((item) => {
    if (!["restocked", "disposed", "closed"].includes(item.status)) {
      const customerConfirmed = Boolean(item.customerResolutionDecision);
      items.push({ id: `staff:returns:${item.id}:${item.status}:${item.customerResolutionDecision ?? "pending"}`, audience: "staff", customerCode: item.customerCode, source: "returns", sourceId: item.id, title: customerConfirmed ? "\u5ba2\u6237\u5df2\u786e\u8ba4\u9000\u8d27\u5904\u7406\u65b9\u6848" : item.status === "exception" ? "\u9000\u8d27\u5f02\u5e38\u5f85\u5904\u7406" : "\u9000\u8d27 RMA \u5f85\u63a8\u8fdb", body: customerConfirmed ? `${item.customerCode} / ${item.id} / ${returnResolutionLabel(item.customerResolutionDecision)}${item.customerResolutionNote ? ` / ${item.customerResolutionNote}` : ""}` : `${item.customerCode} / ${item.platform} / ${item.buyerReturnTracking || "return tracking missing"}`, severity: customerConfirmed || item.status === "exception" || item.status === "received" ? "critical" : "warning", href: "/ops?section=returns", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    }
    const hasFee = (feeCode: "return_inspection" | "return_restock" | "return_disposal") => coreData.billingRecords.some((record) => record.customerCode === item.customerCode && record.refType === "return" && record.refId === item.id && (record.feeLines ?? []).some((line) => line.feeCode === feeCode));
    [
      { feeCode: "return_inspection" as const, label: "return inspection", enabled: ["received", "inspection", "repair", "restocked", "disposed", "closed", "exception"].includes(item.status) },
      { feeCode: "return_restock" as const, label: "return restock", enabled: item.status === "restocked" || item.resolution === "restock" },
      { feeCode: "return_disposal" as const, label: "return disposal", enabled: item.status === "disposed" || item.resolution === "dispose" },
    ].filter((hint) => hint.enabled && !hasFee(hint.feeCode)).forEach((hint) => {
      items.push({ id: `staff:return-fee:${item.id}:${hint.feeCode}:${item.updatedAt ?? item.createdAt}`, audience: "staff", customerCode: item.customerCode, source: "billing", sourceId: item.id, title: "\u9000\u8d27\u8d39\u7528\u5f85\u751f\u6210", body: `${item.customerCode} / ${item.id} / ${hint.label} / ${item.platform}`, severity: "warning", href: "/ops?section=billing", createdAt: nowFallback(item.updatedAt ?? item.createdAt) });
    });
  });

  coreData.inventoryBalances.forEach((item) => {
    if (item.availableQty >= item.alertQty) return;
    items.push({ id: `staff:inventory-low:${item.id}`, audience: "staff", customerCode: item.customerCode, source: "inventory", sourceId: item.id, title: "\u5e93\u5b58\u4f4e\u4e8e\u5b89\u5168\u9884\u8b66", body: `${item.customerCode} / ${item.skuCode} / ${item.availableQty} < ${item.alertQty}`, severity: "warning", href: "/ops?section=inventory", createdAt: item.updatedAt });
  });

  coreData.inventoryAdjustments.filter((item) => item.status === "pending").forEach((item) => {
    const rule = approvalRuleForTrigger(approvalData, adjustmentApprovalTrigger(item.requestedByRole, item.controlAction), 0, Math.abs(item.quantity ?? 0));
    if (!rule) return;
    items.push({ id: `staff:approval:inventory-adjustment:${item.id}:${rule.id}:${item.requestedAt}`, audience: "staff", customerCode: item.customerCode, source: "approval", sourceId: item.id, title: approvalTitle(rule, item.requestedAt), body: `${item.customerCode} / ${item.skuCode} / ${item.quantity ?? 0} / ${approvalRuleBrief(rule)}`, severity: approvalSeverity(rule, item.requestedAt), href: "/ops?section=inventory", createdAt: item.requestedAt });
  });

  coreData.stocktakeBatches.filter((item) => item.status === "pending_approval").forEach((item) => {
    const quantity = Math.abs(item.totalDifferenceQty ?? 0);
    const rule = approvalRuleForTrigger(approvalData, "stocktake_difference", 0, quantity);
    if (!rule) return;
    const createdAt = item.submittedAt ?? item.updatedAt ?? item.createdAt;
    items.push({ id: `staff:approval:stocktake:${item.id}:${rule.id}:${createdAt}`, audience: "staff", customerCode: item.customerCode, source: "approval", sourceId: item.id, title: approvalTitle(rule, createdAt), body: `${item.warehouseCode} / diff ${item.totalDifferenceQty} / ${approvalRuleBrief(rule)}`, severity: approvalSeverity(rule, createdAt), href: "/ops?section=inventory", createdAt });
  });

  coreData.transferOrders.filter((item) => item.status === "new").forEach((item) => {
    const rule = approvalRuleForTrigger(approvalData, "transfer_order", 0, item.quantity);
    if (!rule) return;
    items.push({ id: `staff:approval:transfer:${item.id}:${rule.id}:${item.createdAt}`, audience: "staff", customerCode: item.customerCode, source: "approval", sourceId: item.id, title: approvalTitle(rule, item.createdAt), body: `${item.customerCode} / ${item.skuCode} / ${item.fromWarehouseCode} -> ${item.toWarehouseCode} / ${item.quantity} / ${approvalRuleBrief(rule)}`, severity: approvalSeverity(rule, item.createdAt), href: "/ops?section=inventory", createdAt: item.createdAt });
  });

  workOrders.filter((item) => !["resolved", "cancelled"].includes(item.status)).forEach((item) => {
    const latest = latestCustomerVisibleMessage(item);
    const ageHours = hoursSince(item.updatedAt);
    const customerReplied = latest?.authorRole === "customer";
    const financeReview = Boolean(item.financeReviewRequired);
    const activeWorkOrderRule = item.status === "processing" ? workOrderProcessingRule : workOrderOpenRule;
    const workOrderLevel = slaLevelFromRule(ageHours, activeWorkOrderRule);
    const financeLevel = slaLevelFromRule(ageHours, financeReviewRule);
    const overdue = workOrderLevel === "overdue";
    const financeOverdue = financeReview && financeLevel === "overdue";
    const financeNearDue = financeReview && financeLevel === "near_due";
    if (!financeReview && !customerReplied && !overdue && item.priority !== "urgent") return;
    items.push({ id: `${financeReview ? "staff:approval:finance-work-order" : "staff:work-order"}:${item.id}:${item.updatedAt}`, audience: "staff", customerCode: item.customerCode, source: financeReview ? "approval" : "work_order", sourceId: item.id, title: financeReview ? (financeOverdue ? "\u8d22\u52a1\u590d\u6838\u5de5\u5355\u5df2\u8d85\u65f6" : financeNearDue ? "\u8d22\u52a1\u590d\u6838\u5de5\u5355\u5373\u5c06\u8d85\u65f6" : "\u8d22\u52a1\u590d\u6838\u5de5\u5355\u5f85\u5904\u7406") : customerReplied ? "\u5ba2\u6237\u5de5\u5355\u6709\u65b0\u56de\u590d" : overdue ? "\u5de5\u5355\u5904\u7406\u8d85\u65f6" : "\u7d27\u6025\u5de5\u5355\u5f85\u5904\u7406", body: `${item.customerCode} / ${item.category} / ${item.title}${item.referenceNo ? ` / ref ${item.referenceNo}` : ""}${latest?.body ? ` / ${latest.body}` : ""}`, severity: item.priority === "urgent" || overdue || financeOverdue ? "critical" : "warning", href: workOrderHref("staff"), createdAt: nowFallback(item.updatedAt ?? item.createdAt), slaLevel: financeReview ? financeLevel : workOrderLevel, channels: financeReview ? (financeNearDue || financeOverdue || item.priority === "urgent" ? channelsFromRule(financeReviewRule) : undefined) : workOrderLevel !== "normal" || item.priority === "urgent" ? channelsFromRule(activeWorkOrderRule) : undefined });
  });

  documents.filter((item) => item.category === "payment_proof").slice(0, 12).forEach((item) => {
    items.push({ id: `staff:document:${item.id}`, audience: "staff", customerCode: item.customerCode, source: "document", sourceId: item.id, title: "\u65b0\u4ed8\u6b3e\u51ed\u8bc1\u5f85\u67e5\u770b", body: `${item.customerCode} / ${item.originalName}`, severity: "info", href: "/ops?section=billing", createdAt: item.uploadedAt });
  });

  return filterDismissed(items);
}
