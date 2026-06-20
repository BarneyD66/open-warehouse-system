import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAuditLogs, type AuditLogRecord } from "./auditLogStore";
import { getAutomationRuns } from "./automationRunStore";
import { getDocuments } from "./documentStore";
import { getSql, hasPostgresConfig } from "./db";
import { getIntegrationProbeRecords, type IntegrationProbeRecord } from "./integrationProbeStore";
import { evaluateLaunchReadiness, type LaunchCheckStatus } from "./launchReadiness";
import { getNotificationDeliveries, type NotificationDelivery } from "./notificationStore";
import { getOpsExpansionData } from "./opsExpansionStore";
import { getProductionErrorEvents, updateProductionErrorEvent } from "./productionErrorStore";
import { getManagedStaffAccounts } from "./staffAccountStore";
import { getWebhookEvents, type WebhookEventRecord } from "./webhookEventStore";
import { evaluateCustomerCreditRisk, getLocationUtilization, getWarehouseCoreData } from "./warehouseCoreStore";

export type SystemAlertSeverity = "critical" | "warning" | "info";
export type SystemAlertHandlingStatus = "open" | "acknowledged" | "snoozed" | "resolved";

export type SystemAlert = {
  id: string;
  severity: SystemAlertSeverity;
  source: "readiness" | "jobs" | "platform" | "logistics" | "billing" | "warehouse" | "documents" | "notification" | "system";
  title: string;
  detail: string;
  handlingStatus: SystemAlertHandlingStatus;
  handlingNote?: string;
  handledBy?: string;
  handledAt?: string;
  snoozedUntil?: string;
  actionHref?: string;
  createdAt: string;
};

export type SystemAlertState = {
  id: string;
  status: SystemAlertHandlingStatus;
  note?: string;
  handledBy: string;
  handledAt: string;
  snoozedUntil?: string;
  updatedAt: string;
};

type SystemAlertStateData = {
  states: SystemAlertState[];
};

const alertStateStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "system-alert-states.json") : path.join(process.cwd(), ".local-data", "system-alert-states.json");

function severityFromLaunch(status: LaunchCheckStatus): SystemAlertSeverity {
  if (status === "fail") return "critical";
  if (status === "warn") return "warning";
  return "info";
}

function now() {
  return new Date().toISOString();
}

function billingOverdueDays(dueDate: string | undefined, currentTime: number) {
  if (!dueDate) return 0;
  const dueMs = new Date(`${dueDate}T23:59:59`).getTime();
  if (!Number.isFinite(dueMs) || dueMs >= currentTime) return 0;
  return Math.floor((currentTime - dueMs) / 86_400_000);
}

function hoursSince(value: string | undefined, currentTime: number) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp >= currentTime) return 0;
  return Math.floor((currentTime - timestamp) / 3_600_000);
}

let alertStateTableReady = false;

async function ensureAlertStateTable() {
  if (!hasPostgresConfig() || alertStateTableReady) return;
  const sql = getSql();
  await sql`
    create table if not exists warehouse_system_alert_states (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  alertStateTableReady = true;
}

async function readAlertStates(): Promise<SystemAlertStateData> {
  if (hasPostgresConfig()) {
    await ensureAlertStateTable();
    const sql = getSql();
    const rows = await sql<{ payload: SystemAlertState }[]>`select payload from warehouse_system_alert_states order by updated_at desc`;
    return { states: rows.map((row) => row.payload).filter((item) => item?.id) };
  }
  try {
    const raw = await readFile(alertStateStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SystemAlertStateData>;
    return { states: Array.isArray(parsed.states) ? parsed.states : [] };
  } catch {
    return { states: [] };
  }
}

async function writeAlertStates(data: SystemAlertStateData) {
  if (hasPostgresConfig()) {
    await ensureAlertStateTable();
    const sql = getSql();
    await sql.begin(async (tx) => {
      await tx`delete from warehouse_system_alert_states`;
      for (const state of data.states) {
        await tx`
          insert into warehouse_system_alert_states (id, payload, updated_at)
          values (${state.id}, ${tx.json(state)}, now())
          on conflict (id) do update set payload = excluded.payload, updated_at = excluded.updated_at
        `;
      }
    });
    return;
  }
  await mkdir(path.dirname(alertStateStorePath), { recursive: true });
  await writeFile(alertStateStorePath, JSON.stringify(data, null, 2), "utf8");
}

function alertWithState(alert: Omit<SystemAlert, "handlingStatus">, state?: SystemAlertState): SystemAlert {
  return {
    ...alert,
    handlingStatus: state?.status ?? "open",
    handlingNote: state?.note,
    handledBy: state?.handledBy,
    handledAt: state?.handledAt,
    snoozedUntil: state?.snoozedUntil,
  };
}

function shouldShowAlert(alert: SystemAlert, includeHandled: boolean, currentTime: number) {
  if (includeHandled) return true;
  if (alert.handlingStatus === "resolved") return false;
  if (alert.handlingStatus === "snoozed" && alert.snoozedUntil && new Date(alert.snoozedUntil).getTime() > currentTime) return false;
  return true;
}

function outboundRequiredQty(order: Awaited<ReturnType<typeof getWarehouseCoreData>>["outboundOrders"][number]) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function outboundScannedQty(values?: Record<string, number>) {
  return Object.values(values ?? {}).reduce((sum, value) => sum + value, 0);
}

function notificationChannelLabel(value: string) {
  if (value === "邮件" || value.includes("閭")) return "邮件";
  if (value === "短信" || value.includes("鐭")) return "短信";
  if (value === "微信" || value.includes("寰")) return "微信";
  return value || "未知渠道";
}

function notificationAudienceLabel(value: NotificationDelivery["audience"]) {
  return value === "customer" ? "客户" : "员工";
}

const integrationAuditActions = new Set<AuditLogRecord["action"]>([
  "integration_probe",
  "staff_login_failed",
  "document_upload_rejected",
  "outbound_shipping_label_update",
  "carrier_label_retry_due",
  "carrier_tracking_sync_due",
  "platform_orders_sync_due",
  "platform_cancellation_review_due",
  "platform_fulfillment_retry_due",
  "automation_run_due",
  "automation_task_update",
]);

function isIntegrationAuditRisk(log: AuditLogRecord) {
  const text = [log.summary, log.note, JSON.stringify(log.after ?? ""), JSON.stringify(log.before ?? "")].join(" ").toLowerCase();
  return integrationAuditActions.has(log.action) && /失败|异常|错误|failed|error|blocked|missing|unauthorized/.test(text);
}

function integrationAuditSource(log: AuditLogRecord): SystemAlert["source"] {
  if (log.action === "staff_login_failed") return "system";
  if (log.action === "document_upload_rejected") return "documents";
  if (log.action.startsWith("carrier_") || log.action === "outbound_shipping_label_update") return "logistics";
  if (log.action.startsWith("platform_")) return "platform";
  if (log.action === "automation_run_due" || log.action === "automation_task_update") return "jobs";
  return "system";
}

function integrationAuditSeverity(log: AuditLogRecord): SystemAlertSeverity {
  if (log.action === "automation_run_due" || log.action === "automation_task_update") return "warning";
  if (log.action === "staff_login_failed") {
    const after = log.after && typeof log.after === "object" ? log.after as { status?: string } : {};
    return after.status === "locked" ? "critical" : "warning";
  }
  if (log.action === "document_upload_rejected") return "warning";
  return "critical";
}

function integrationAuditTitle(log: AuditLogRecord) {
  if (log.action === "document_upload_rejected") return "文件上传被安全策略拒绝";
  const labels: Partial<Record<AuditLogRecord["action"], string>> = {
    integration_probe: "接口探测异常",
    outbound_shipping_label_update: "面单接口异常",
    carrier_label_retry_due: "承运商面单重试异常",
    carrier_tracking_sync_due: "承运商轨迹/POD 同步异常",
    platform_orders_sync_due: "平台订单拉取异常",
    platform_cancellation_review_due: "平台取消复核异常",
    platform_fulfillment_retry_due: "平台发货回传异常",
    automation_run_due: "自动任务运行异常",
    automation_task_update: "自动任务处理异常",
  };
  return labels[log.action] ?? "API 联调异常";
}

function webhookAlertSeverity(event: WebhookEventRecord, currentTime: number): SystemAlertSeverity {
  if (event.status === "failed") return "critical";
  const ageMinutes = Math.floor((currentTime - new Date(event.updatedAt).getTime()) / 60_000);
  return ageMinutes >= 30 ? "critical" : "warning";
}

function integrationProbeAlertSource(probe: IntegrationProbeRecord): SystemAlert["source"] {
  if (probe.group === "carrier") return "logistics";
  if (probe.group === "platform") return "platform";
  if (probe.group === "storage" || probe.group === "security") return "documents";
  if (probe.group === "notification") return "notification";
  if (probe.group === "reporting") return "jobs";
  return "system";
}

function integrationProbeAlertSeverity(probe: IntegrationProbeRecord): SystemAlertSeverity {
  if (probe.status === "failed" && ["carrier", "platform", "storage", "security"].includes(probe.group)) return "critical";
  if (probe.status === "failed" || probe.status === "blocked") return "warning";
  return "info";
}

function integrationProbeActionHref(probe: IntegrationProbeRecord) {
  if (probe.group === "carrier" || probe.group === "platform") return "/ops?section=logistics";
  if (probe.group === "storage" || probe.group === "security") return "/ops?section=customers";
  if (probe.group === "notification" || probe.group === "reporting") return "/ops?section=permissions";
  return "/ops?section=overview";
}

function integrationProbeAlertDetail(probe: IntegrationProbeRecord) {
  return [
    probe.message,
    probe.missingEnv?.length ? `缺少配置：${probe.missingEnv.join("、")}` : "",
    probe.details?.length ? `建议动作：${probe.details.slice(0, 3).join("；")}` : "",
    `探测人：${probe.checkedBy}`,
  ].filter(Boolean).join("；");
}

function webhookAlertDetail(event: WebhookEventRecord, currentTime: number) {
  const ageMinutes = Math.max(0, Math.floor((currentTime - new Date(event.updatedAt).getTime()) / 60_000));
  return [
    `供应商/平台：${event.provider}`,
    `事件编号：${event.eventId}`,
    event.targetId ? `关联单号：${event.targetId}` : "未匹配到关联单号",
    event.error ? `错误：${event.error}` : "",
    event.summary ? `摘要：${event.summary}` : "",
    event.status === "processing" ? `已处理中 ${ageMinutes} 分钟，建议确认是否卡住` : "",
  ].filter(Boolean).join("；");
}

export async function updateSystemAlertState({
  id,
  status,
  note,
  handledBy,
  snoozeHours,
}: {
  id: string;
  status: SystemAlertHandlingStatus;
  note?: string;
  handledBy: string;
  snoozeHours?: number;
}) {
  const cleanId = id.trim();
  if (!cleanId) return { state: null, error: "缺少告警编号" };
  if (!["open", "acknowledged", "snoozed", "resolved"].includes(status)) return { state: null, error: "不支持的告警处理状态" };

  const data = await readAlertStates();
  const timestamp = now();
  const existing = data.states.find((item) => item.id === cleanId);
  const snoozedUntil = status === "snoozed"
    ? (() => {
        const date = new Date();
        date.setHours(date.getHours() + Math.max(1, Math.floor(snoozeHours ?? 24)));
        return date.toISOString();
      })()
    : undefined;
  const state: SystemAlertState = {
    id: cleanId,
    status,
    note: note?.trim() || existing?.note,
    handledBy: handledBy.trim() || "运营",
    handledAt: timestamp,
    snoozedUntil,
    updatedAt: timestamp,
  };
  if (existing) Object.assign(existing, state);
  else data.states.unshift(state);
  await writeAlertStates(data);

  if (cleanId.startsWith("production-error:")) {
    const errorId = cleanId.replace("production-error:", "");
    await updateProductionErrorEvent({
      id: errorId,
      status: status === "resolved" ? "resolved" : status === "open" ? "open" : "acknowledged",
      handledBy: state.handledBy,
      note: state.note,
    });
  }

  return { state, error: null };
}

export async function getSystemAlertStates() {
  return readAlertStates();
}

export async function getSystemAlerts(options: { includeHandled?: boolean } = {}) {
  const [readiness, coreData, expansionData, documents, integrationProbes, notificationDeliveries, productionErrors, webhookEvents, automationRuns, auditLogs, staffAccounts] = await Promise.all([
    evaluateLaunchReadiness(),
    getWarehouseCoreData(),
    getOpsExpansionData(),
    getDocuments(),
    getIntegrationProbeRecords(100),
    getNotificationDeliveries(1000),
    getProductionErrorEvents({ status: "open", limit: 50 }),
    getWebhookEvents(200),
    getAutomationRuns({ limit: 50 }),
    getAuditLogs({ limit: 300 }),
    getManagedStaffAccounts(),
  ]);
  const generatedAt = now();
  const alerts: Array<Omit<SystemAlert, "handlingStatus">> = [];

  readiness.checks
    .filter((check) => check.status !== "pass")
    .forEach((check) => {
      alerts.push({
        id: `readiness:${check.id}`,
        severity: severityFromLaunch(check.status),
        source: "readiness",
        title: `上线体检：${check.label}`,
        detail: check.detail,
        actionHref: "/ops?section=overview",
        createdAt: readiness.generatedAt,
      });
    });

  productionErrors.slice(0, 12).forEach((event) => {
    alerts.push({
      id: `production-error:${event.id}`,
      severity: event.severity,
      source: "system",
      title: `生产错误：${event.route}`,
      detail: [
        event.method ? `${event.method} 请求` : "",
        event.message,
        event.actorName ? `操作人：${event.actorName}` : "",
        event.requestId ? `请求编号：${event.requestId}` : "",
      ].filter(Boolean).join("；"),
      actionHref: "/ops?section=overview",
      createdAt: event.createdAt,
    });
  });

  const generatedTime = new Date(generatedAt).getTime();
  webhookEvents
    .filter((event) => event.status === "failed" || (event.status === "processing" && generatedTime - new Date(event.updatedAt).getTime() >= 10 * 60_000))
    .slice(0, 12)
    .forEach((event) => {
      alerts.push({
        id: `webhook:${event.id}`,
        severity: webhookAlertSeverity(event, generatedTime),
        source: event.kind === "carrier" ? "logistics" : "platform",
        title: `${event.kind === "carrier" ? "承运商" : "平台"} Webhook ${event.status === "failed" ? "失败" : "长时间处理中"}：${event.provider}`,
        detail: webhookAlertDetail(event, generatedTime),
        actionHref: "/ops?section=overview",
        createdAt: event.updatedAt || event.receivedAt,
      });
    });

  automationRuns
    .flatMap((run) =>
      run.results
        .filter((task) => task.status !== "completed" && !["ignored", "resolved"].includes(task.handlingStatus ?? "open"))
        .map((task) => ({ run, task })),
    )
    .slice(0, 12)
    .forEach(({ run, task }) => {
      alerts.push({
        id: `automation:${run.id}:${task.key}`,
        severity: task.status === "unauthorized" ? "critical" : "warning",
        source: "jobs",
        title: `自动化任务失败：${task.name}`,
        detail: [
          `运行批次：${run.id}`,
          `HTTP 状态：${task.httpStatus}`,
          task.summary,
          task.assignedTo ? `已指派：${task.assignedTo}` : "",
          task.retryCount ? `已重试：${task.retryCount} 次` : "",
        ].filter(Boolean).join("；"),
        actionHref: "/ops?section=overview",
        createdAt: task.lastRetryAt || run.finishedAt,
      });
    });

  auditLogs
    .filter(isIntegrationAuditRisk)
    .slice(0, 10)
    .forEach((log) => {
      alerts.push({
        id: `api-audit:${log.id}`,
        severity: integrationAuditSeverity(log),
        source: integrationAuditSource(log),
        title: `${integrationAuditTitle(log)}：${log.targetId}`,
        detail: [log.summary, log.note, `操作人/来源：${log.actorName}`].filter(Boolean).join("；"),
        actionHref: "/ops?section=overview",
        createdAt: log.createdAt,
      });
    });

  expansionData.batchOperationPlans
    .filter((plan) => plan.status === "exception")
    .slice(0, 10)
    .forEach((plan) => {
      alerts.push({
        id: `job:${plan.id}`,
        severity: "critical",
        source: "jobs",
        title: `批量任务异常：${plan.title}`,
        detail: plan.lastError || `任务 ${plan.id} 已进入异常状态，尝试次数 ${plan.attempts ?? 0}/${plan.maxAttempts ?? 3}。`,
        actionHref: "/ops?section=logistics",
        createdAt: plan.updatedAt || plan.createdAt,
      });
    });

  expansionData.platformSyncJobs
    .filter((job) => job.status === "failed")
    .slice(0, 10)
    .forEach((job) => {
      alerts.push({
        id: `platform:${job.id}`,
        severity: "warning",
        source: "platform",
        title: `平台同步失败：${job.platform} / ${job.storeName}`,
        detail: job.error || `本次拉单 0 行，客户 ${job.customerCode} 需要复核连接或授权。`,
        actionHref: "/ops?section=logistics",
        createdAt: job.createdAt,
      });
    });

  coreData.outboundOrders
    .filter((order) => order.labelStatus === "failed" || order.platformFulfillmentStatus === "failed")
    .slice(0, 12)
    .forEach((order) => {
      const retryText = order.labelStatus === "failed"
        ? [
            order.labelFailureReason ? `失败原因：${order.labelFailureReason}` : "面单购买失败",
            `尝试次数：${order.labelRetryCount ?? 0}`,
            order.labelNextRetryAt ? `建议重试：${new Date(order.labelNextRetryAt).toLocaleString("zh-CN", { hour12: false })}` : "",
            order.labelFallbackNote ? `人工面单：${order.labelFallbackNote}` : "",
          ].filter(Boolean).join("；")
        : "";
      alerts.push({
        id: `outbound:${order.id}`,
        severity: "critical",
        source: "logistics",
        title: `出库发货闭环异常：${order.id}`,
        detail: [retryText, order.platformFulfillmentError ? `平台回传失败：${order.platformFulfillmentError}` : ""].filter(Boolean).join("；") || "出库单物流闭环未完成。",
        actionHref: "/ops?section=outbound",
        createdAt: order.updatedAt || order.createdAt,
      });
    });

  coreData.outboundOrders
    .filter((order) => order.interceptStatus === "requested" || order.interceptStatus === "restock_pending")
    .slice(0, 10)
    .forEach((order) => {
      alerts.push({
        id: `outbound-intercept:${order.id}`,
        severity: "critical",
        source: "logistics",
        title: `出库截单待审批：${order.id}`,
        detail: `${order.customerCode} / ${order.interceptReason || "截单原因待复核"} / 申请人 ${order.interceptRequestedBy || "-"}`,
        actionHref: "/warehouse",
        createdAt: order.interceptRequestedAt || order.updatedAt || order.createdAt,
      });
    });

  coreData.outboundOrders
    .filter((order) => order.status === "handover" && !order.packageWeightKg)
    .slice(0, 10)
    .forEach((order) => {
      alerts.push({
        id: `outbound-weight:${order.id}`,
        severity: "warning",
        source: "warehouse",
        title: `出库待称重签出：${order.id}`,
        detail: `${order.customerCode} / ${order.channel} / 已复核待交运，但还没有包裹重量。`,
        actionHref: "/warehouse",
        createdAt: order.updatedAt || order.createdAt,
      });
    });

  coreData.outboundOrders
    .map((order) => {
      const required = outboundRequiredQty(order);
      const picked = outboundScannedQty(order.scanProgress?.pickedQtyBySku);
      const sorted = outboundScannedQty(order.scanProgress?.sortedQtyBySku);
      const packed = outboundScannedQty(order.scanProgress?.packedQtyBySku);
      return { order, required, picked, sorted, packed };
    })
    .filter(({ order, required, picked, sorted, packed }) => required > 0 && ["picking", "packing_check", "handover"].includes(order.status) && (picked < required || sorted < required || packed < required))
    .slice(0, 10)
    .forEach(({ order, required, picked, sorted, packed }) => {
      alerts.push({
        id: `outbound-review-gap:${order.id}`,
        severity: order.status === "handover" ? "critical" : "warning",
        source: "warehouse",
        title: `出库复核数量缺口：${order.id}`,
        detail: `${order.customerCode} / 应拣 ${required}，已拣 ${picked}，已分拣 ${sorted}，已复核 ${packed}。`,
        actionHref: "/warehouse",
        createdAt: order.updatedAt || order.createdAt,
      });
    });

  coreData.billingRecords
    .filter((record) => record.status === "payment_submitted")
    .slice(0, 10)
    .forEach((record) => {
      const ageHours = hoursSince(record.paymentSubmittedAt || record.statementPaymentSubmittedAt || record.updatedAt || record.createdAt, new Date(generatedAt).getTime());
      alerts.push({
        id: `billing-payment-review:${record.id}`,
        severity: ageHours >= 48 ? "critical" : "warning",
        source: "billing",
        title: `付款凭证待复核：${record.customerCode}`,
        detail: `${record.title} / 金额 £${record.amount.toFixed(2)} / 付款参考 ${record.paymentReference || record.statementPaymentReference || "-"} / 已等待 ${ageHours} 小时。`,
        actionHref: "/ops?section=billing",
        createdAt: record.paymentSubmittedAt || record.statementPaymentSubmittedAt || record.updatedAt || record.createdAt,
      });
    });

  coreData.billingRecords
    .filter((record) => record.status !== "payment_submitted" && Boolean(record.paymentRejectedAt || record.statementPaymentRejectedAt || record.paymentRejectionNote || record.statementPaymentRejectionNote))
    .slice(0, 10)
    .forEach((record) => {
      alerts.push({
        id: `billing-payment-rejected:${record.id}`,
        severity: "warning",
        source: "billing",
        title: `付款凭证已驳回待客户重提：${record.customerCode}`,
        detail: `${record.title} / 金额 £${record.amount.toFixed(2)} / 驳回原因：${record.paymentRejectionNote || record.statementPaymentRejectionNote || "付款凭证需重新提交"}`,
        actionHref: "/ops?section=billing",
        createdAt: record.paymentRejectedAt || record.statementPaymentRejectedAt || record.updatedAt || record.createdAt,
      });
    });

  coreData.billingRecords
    .filter((record) => !["paid", "payment_submitted", "disputed"].includes(record.status) && billingOverdueDays(record.dueDate, new Date(generatedAt).getTime()) > 0)
    .slice(0, 10)
    .forEach((record) => {
      const overdueDays = billingOverdueDays(record.dueDate, new Date(generatedAt).getTime());
      alerts.push({
        id: `billing-overdue:${record.id}`,
        severity: overdueDays >= 30 ? "critical" : "warning",
        source: "billing",
        title: `账单逾期未处理：${record.customerCode}`,
        detail: `${record.title} / 金额 £${record.amount.toFixed(2)} / 已逾期 ${overdueDays} 天，需催付、提交付款凭证或暂停高风险出库。`,
        actionHref: "/ops?section=billing",
        createdAt: record.dueDate ? `${record.dueDate}T23:59:59.000Z` : record.updatedAt || record.createdAt,
      });
    });

  coreData.billingRecords
    .filter((record) => record.status === "disputed")
    .slice(0, 10)
    .forEach((record) => {
      alerts.push({
        id: `billing:${record.id}`,
        severity: "warning",
        source: "billing",
        title: `账单争议待复核：${record.customerCode}`,
        detail: record.customerMessage || record.statementCustomerMessage || `${record.title} 存在客户争议，需要财务复核。`,
        actionHref: "/ops?section=billing",
        createdAt: record.updatedAt || record.createdAt,
      });
    });

  coreData.customers
    .map((customer) => ({ customer, risk: evaluateCustomerCreditRisk(coreData, customer.customerCode) }))
    .filter(({ risk }) => risk.status === "blocked")
    .slice(0, 12)
    .forEach(({ customer, risk }) => {
      alerts.push({
        id: `customer-credit:${customer.customerCode}`,
        severity: risk.overdueAmount > 0 || customer.status === "paused" ? "critical" : "warning",
        source: "billing",
        title: `客户账期/信用拦截：${customer.customerCode}`,
        detail: risk.reasons.join("；") || `未结费用 £${risk.outstandingAmount.toFixed(2)}，需要财务复核。`,
        actionHref: "/ops?section=billing",
        createdAt: risk.checkedAt || generatedAt,
      });
    });

  coreData.locations
    .map((location) => ({ location, utilization: getLocationUtilization(coreData, location.locationCode) }))
    .filter(({ utilization }) => typeof utilization.occupancyRate === "number" && utilization.occupancyRate >= 0.9)
    .slice(0, 10)
    .forEach(({ location, utilization }) => {
      alerts.push({
        id: `location:${location.locationCode}`,
        severity: utilization.occupancyRate === 1 ? "critical" : "warning",
        source: "warehouse",
        title: `库位容量接近上限：${location.locationCode}`,
        detail: `容量 ${utilization.capacityQty ?? "-"} 件，已占用 ${utilization.usedQty} 件，剩余 ${utilization.remainingQty ?? "-"} 件。`,
        actionHref: "/ops?section=inventory",
        createdAt: location.updatedAt || generatedAt,
      });
    });

  documents
    .filter((document) => document.scanStatus === "blocked")
    .slice(0, 10)
    .forEach((document) => {
      alerts.push({
        id: `document:${document.id}`,
        severity: "critical",
        source: "documents",
        title: `文件安全扫描拦截：${document.originalName}`,
        detail: document.scanNote || `${document.customerCode} 上传文件未通过基础安全扫描。`,
        actionHref: "/ops?section=customers",
        createdAt: document.uploadedAt,
      });
    });

  notificationDeliveries
    .filter((delivery) => delivery.status === "failed" || delivery.status === "blocked")
    .slice(0, 12)
    .forEach((delivery) => {
      const isRepeatedFailure = delivery.status === "failed" && delivery.attempts >= 3;
      alerts.push({
        id: `notification:${delivery.id}`,
        severity: isRepeatedFailure ? "critical" : "warning",
        source: "notification",
        title: `通知投递${delivery.status === "blocked" ? "配置阻断" : "失败"}：${notificationChannelLabel(delivery.channel)} / ${delivery.title}`,
        detail: [
          `${notificationAudienceLabel(delivery.audience)}${delivery.customerCode ? ` / ${delivery.customerCode}` : ""}`,
          `来源 ${delivery.source} / ${delivery.sourceId}`,
          `尝试 ${delivery.attempts} 次`,
          delivery.lastError ? `原因：${delivery.lastError}` : "",
          delivery.nextRetryAt ? `建议重试：${new Date(delivery.nextRetryAt).toLocaleString("zh-CN", { hour12: false })}` : "",
        ].filter(Boolean).join("；"),
        actionHref: "/ops?section=permissions",
        createdAt: delivery.updatedAt || delivery.createdAt,
      });
    });

  staffAccounts
    .filter((account) => account.lockedUntil && new Date(account.lockedUntil).getTime() > new Date(generatedAt).getTime())
    .slice(0, 10)
    .forEach((account) => {
      alerts.push({
        id: `staff-login-lock:${account.username}`,
        severity: "warning",
        source: "system",
        title: `员工账号登录锁定：${account.displayName}`,
        detail: [
          `账号：${account.username}`,
          `连续失败：${account.failedLoginCount ?? 0} 次`,
          account.lastFailedLoginAt ? `最近失败：${new Date(account.lastFailedLoginAt).toLocaleString("zh-CN", { hour12: false })}` : "",
          account.lockedUntil ? `锁定至：${new Date(account.lockedUntil).toLocaleString("zh-CN", { hour12: false })}` : "",
          account.lastFailedLoginReason ? `原因：${account.lastFailedLoginReason}` : "",
        ].filter(Boolean).join("；"),
        actionHref: "/ops?section=permissions",
        createdAt: account.lastFailedLoginAt || account.updatedAt,
      });
    });

  const latestProbeMap = new Map<string, (typeof integrationProbes)[number]>();
  integrationProbes.forEach((probe) => {
    if (!latestProbeMap.has(probe.itemId)) latestProbeMap.set(probe.itemId, probe);
  });
  Array.from(latestProbeMap.values())
    .filter((probe) => probe.status === "failed" || probe.status === "blocked")
    .slice(0, 12)
    .forEach((probe) => {
      alerts.push({
        id: `integration-probe:${probe.itemId}`,
        severity: integrationProbeAlertSeverity(probe),
        source: integrationProbeAlertSource(probe),
        title: `集成联调需处理：${probe.itemName}`,
        detail: integrationProbeAlertDetail(probe),
        actionHref: integrationProbeActionHref(probe),
        createdAt: probe.finishedAt || probe.startedAt,
      });
    });

  const stateData = await readAlertStates();
  const stateMap = new Map(stateData.states.map((state) => [state.id, state]));
  const currentTime = Date.now();
  return alerts
    .map((alert) => alertWithState(alert, stateMap.get(alert.id)))
    .filter((alert) => shouldShowAlert(alert, Boolean(options.includeHandled), currentTime))
    .sort((a, b) => {
    const rank: Record<SystemAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
