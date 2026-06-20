import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { recordAutomationRun } from "@/lib/automationRunStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutomationActor = {
  actorRole: "staff" | "system";
  actorName: string;
  cookieHeader?: string;
  secret?: string;
};

type AutomationBody = {
  limit?: number;
  forceReports?: boolean;
  minPlatformIntervalMinutes?: number;
};

type AutomationTask = {
  key: string;
  name: string;
  endpoint: string;
  body: Record<string, unknown>;
  reportSecret?: boolean;
};

type AutomationTaskResult = {
  key: string;
  name: string;
  endpoint: string;
  status: "completed" | "failed" | "unauthorized";
  httpStatus: number;
  summary: string;
  detail?: unknown;
};

function automationSecret() {
  return process.env.AUTOMATION_RUN_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = automationSecret();
  if (!secret) return "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const querySecret = new URL(request.url).searchParams.get("secret")?.trim();
  return token === secret || querySecret === secret ? secret : "";
}

async function authorize(request: Request): Promise<AutomationActor | null> {
  const secret = authorizedBySecret(request);
  if (secret) return { actorRole: "system", actorName: "生产自动化调度", secret };

  const cookieStore = await cookies();
  const staffCookie = cookieStore.get(staffCookieName)?.value;
  const staff = parseStaffSession(staffCookie);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops") return null;
  return {
    actorRole: "staff",
    actorName: staff.displayName || staff.username,
    cookieHeader: staffCookie ? `${staffCookieName}=${staffCookie}` : undefined,
  };
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionsFrom(request: Request, body?: AutomationBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 50;
  const minPlatformIntervalMinutes = numberFrom(body?.minPlatformIntervalMinutes) ?? numberFrom(url.searchParams.get("minPlatformIntervalMinutes")) ?? 30;
  return {
    limit: Math.min(200, Math.max(1, Math.floor(limit))),
    minPlatformIntervalMinutes: Math.min(24 * 60, Math.max(0, Math.floor(minPlatformIntervalMinutes))),
    forceReports: body?.forceReports ?? url.searchParams.get("forceReports") === "1",
  };
}

function summaryFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return "任务已执行，未返回结构化汇总。";
  const data = payload as Record<string, unknown>;
  const summary = data.summary && typeof data.summary === "object" ? (data.summary as Record<string, unknown>) : data;
  const pairs = [
    ["attempted", "尝试"],
    ["scannedRunnable", "处理"],
    ["scannedConnections", "扫描连接"],
    ["candidateCount", "候选"],
    ["updatedOrders", "更新订单"],
    ["waveCount", "波次"],
    ["completed", "完成"],
    ["generated", "生成"],
    ["financeReviewApprovals", "财务复核/调账赔付"],
    ["financeReviewOverdue", "财务超时"],
    ["reviewed", "复核"],
    ["expiredMarked", "过期"],
    ["intercepts", "截单"],
    ["workOrders", "工单"],
    ["synced", "同步"],
    ["proofs", "签收证明"],
    ["exceptions", "异常"],
    ["retried", "重试"],
    ["sent", "发送"],
    ["skipped", "跳过"],
    ["failed", "失败"],
    ["blocked", "阻断"],
    ["total", "总数"],
  ]
    .map(([key, label]) => (typeof summary[key] === "number" ? `${label} ${summary[key]}` : ""))
    .filter(Boolean);
  if (pairs.length > 0) return pairs.join("，");
  if (typeof data.error === "string") return data.error;
  return "任务已执行。";
}

function childBearerSecret(taskKey: string, actor: AutomationActor) {
  const taskSecrets: Record<string, string | undefined> = {
    platform_orders: process.env.PLATFORM_ORDER_SYNC_SECRET,
    platform_cancellation_review: process.env.PLATFORM_CANCELLATION_REVIEW_SECRET || process.env.PLATFORM_ORDER_SYNC_SECRET,
    batch_jobs_run: process.env.JOB_RUN_SECRET,
    batch_jobs_retry: process.env.JOB_RETRY_SECRET,
    outbound_pick_wave_auto: process.env.OUTBOUND_PICK_WAVE_AUTO_SECRET || process.env.JOB_RUN_SECRET,
    inventory_lot_risk_review: process.env.INVENTORY_LOT_RISK_REVIEW_SECRET,
    warehouse_location_risk_review: process.env.WAREHOUSE_LOCATION_RISK_REVIEW_SECRET,
    carrier_labels_retry: process.env.CARRIER_LABEL_RETRY_SECRET,
    carrier_tracking_sync: process.env.CARRIER_TRACKING_SYNC_SECRET,
    platform_fulfillment_retry: process.env.PLATFORM_FULFILLMENT_RETRY_SECRET,
    notification_generate: process.env.NOTIFICATION_GENERATE_SECRET,
    notification_delivery_retry: process.env.NOTIFICATION_RETRY_SECRET,
  };
  return taskSecrets[taskKey] || process.env.CRON_SECRET || actor.secret || "";
}

function taskHeaders(actor: AutomationActor, task: Pick<AutomationTask, "key" | "reportSecret">) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (actor.cookieHeader) headers.cookie = actor.cookieHeader;
  const childSecret = childBearerSecret(task.key, actor);
  if (childSecret) headers.authorization = `Bearer ${childSecret}`;
  if (task.reportSecret && process.env.REPORT_SCHEDULE_SECRET) headers["x-report-schedule-secret"] = process.env.REPORT_SCHEDULE_SECRET;
  return headers;
}

async function callTask(request: Request, actor: AutomationActor, task: AutomationTask): Promise<AutomationTaskResult> {
  const url = new URL(task.endpoint, request.url);
  const response = await fetch(url, {
    method: "POST",
    headers: taskHeaders(actor, task),
    body: JSON.stringify(task.body),
  }).catch((error: unknown) => ({
    ok: false,
    status: 0,
    json: async () => ({ error: error instanceof Error ? error.message : "网络异常" }),
  }));
  const payload = await response.json().catch(() => ({}));
  return {
    key: task.key,
    name: task.name,
    endpoint: task.endpoint,
    status: response.ok ? "completed" : response.status === 401 || response.status === 403 ? "unauthorized" : "failed",
    httpStatus: response.status,
    summary: summaryFrom(payload),
    detail: payload,
  };
}

function automationTasks(options: ReturnType<typeof optionsFrom>): AutomationTask[] {
  return [
    {
      key: "platform_orders",
      name: "平台订单同步",
      endpoint: "/api/ops/platform-orders/sync-due",
      body: { limit: Math.min(options.limit, 50), minIntervalMinutes: options.minPlatformIntervalMinutes },
    },
    {
      key: "platform_cancellation_review",
      name: "平台取消订单复核",
      endpoint: "/api/ops/platform-orders/cancellation-review",
      body: { limit: Math.min(options.limit, 50) },
    },
    {
      key: "batch_jobs_run",
      name: "批量作业执行",
      endpoint: "/api/ops/jobs/run-due",
      body: { limit: Math.min(options.limit, 50) },
    },
    {
      key: "batch_jobs_retry",
      name: "异常批量作业重试",
      endpoint: "/api/ops/jobs/retry-due",
      body: { limit: options.limit, includeQueued: true },
    },
    {
      key: "outbound_pick_wave_auto",
      name: "出库拣货波次自动生成",
      endpoint: "/api/ops/outbounds/pick-waves/auto-generate",
      body: { limit: Math.min(options.limit, 80), strategy: "carrier", minAgeMinutes: 0 },
    },
    {
      key: "inventory_lot_risk_review",
      name: "库存批次风险巡检",
      endpoint: "/api/ops/inventory-lots/risk-review",
      body: { limit: options.limit, expiryWarningDays: 45 },
    },
    {
      key: "warehouse_location_risk_review",
      name: "库位容量与规则风险巡检",
      endpoint: "/api/ops/warehouse/locations/risk-review",
      body: { limit: options.limit, occupancyWarningRate: 0.9 },
    },
    {
      key: "carrier_labels_retry",
      name: "承运商面单重试",
      endpoint: "/api/ops/carrier-labels/retry-due",
      body: { limit: options.limit },
    },
    {
      key: "carrier_tracking_sync",
      name: "承运商轨迹与 POD 同步",
      endpoint: "/api/ops/carrier-tracking/sync-due",
      body: { limit: options.limit, minIntervalMinutes: 120 },
    },
    {
      key: "platform_fulfillment_retry",
      name: "平台发货回传重试",
      endpoint: "/api/ops/platform-fulfillment/retry-due",
      body: { limit: options.limit },
    },
    {
      key: "notification_generate",
      name: "通知与 SLA 提醒生成",
      endpoint: "/api/ops/notifications/generate-due",
      body: { limit: options.limit, includeCustomers: true },
    },
    {
      key: "notification_delivery_retry",
      name: "通知投递重试",
      endpoint: "/api/ops/notifications/deliveries/retry-due",
      body: { limit: options.limit },
    },
    {
      key: "scheduled_reports",
      name: "定时报表发送",
      endpoint: "/api/ops/reports/schedules/run",
      body: { force: options.forceReports },
      reportSecret: true,
    },
  ];
}

async function runAutomation(request: Request, body?: AutomationBody) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const rate = checkRateLimit(rateLimitKey(request, "ops-automation-run-due"), 10, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "自动化调度执行过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "当前账号无权执行生产自动化调度。" }, { status: 403 });

  const options = optionsFrom(request, body);
  const results: AutomationTaskResult[] = [];
  for (const task of automationTasks(options)) results.push(await callTask(request, actor, task));

  const summary = {
    total: results.length,
    completed: results.filter((item) => item.status === "completed").length,
    failed: results.filter((item) => item.status === "failed").length,
    unauthorized: results.filter((item) => item.status === "unauthorized").length,
  };
  const finishedAt = new Date().toISOString();
  const automationRun = await recordAutomationRun({
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    trigger: actor.actorRole === "system" ? "cron" : "manual",
    options,
    summary,
    results,
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedMs,
  });

  await recordAuditLog({
    action: "automation_run_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "system",
    targetId: "automation-run-due",
    summary: "执行生产自动化到期任务",
    note: `共 ${summary.total} 项，完成 ${summary.completed} 项，失败 ${summary.failed} 项，权限不足 ${summary.unauthorized} 项。`,
    after: { automationRunId: automationRun.id, options, summary, results },
  });

  return NextResponse.json({ generatedAt: finishedAt, run: automationRun, options, summary, results });
}

export async function GET(request: Request) {
  return runAutomation(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AutomationBody;
  return runAutomation(request, body);
}
