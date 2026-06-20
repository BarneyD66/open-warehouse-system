import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getAutomationRuns, updateAutomationTaskHandling, type AutomationTaskRunStatus } from "@/lib/automationRunStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaskActionBody = {
  runId?: string;
  taskKey?: string;
  action?: "retry" | "assign" | "ignore" | "resolve";
  assignedTo?: string;
  note?: string;
};

const retryBodies: Record<string, Record<string, unknown>> = {
  platform_orders: { limit: 20, minIntervalMinutes: 0 },
  platform_cancellation_review: { limit: 50 },
  batch_jobs_run: { limit: 50 },
  batch_jobs_retry: { limit: 50, includeQueued: true },
  outbound_pick_wave_auto: { limit: 80, strategy: "carrier", minAgeMinutes: 0 },
  inventory_lot_risk_review: { limit: 80, expiryWarningDays: 45 },
  carrier_labels_retry: { limit: 50 },
  carrier_tracking_sync: { limit: 50, minIntervalMinutes: 0 },
  platform_fulfillment_retry: { limit: 50 },
  notification_generate: { limit: 200, includeCustomers: true },
  notification_delivery_retry: { limit: 50 },
  scheduled_reports: { force: true },
};

function childBearerSecret(taskKey: string) {
  const taskSecrets: Record<string, string | undefined> = {
    platform_orders: process.env.PLATFORM_ORDER_SYNC_SECRET,
    platform_cancellation_review: process.env.PLATFORM_CANCELLATION_REVIEW_SECRET || process.env.PLATFORM_ORDER_SYNC_SECRET,
    batch_jobs_run: process.env.JOB_RUN_SECRET,
    batch_jobs_retry: process.env.JOB_RETRY_SECRET,
    outbound_pick_wave_auto: process.env.OUTBOUND_PICK_WAVE_AUTO_SECRET || process.env.JOB_RUN_SECRET,
    inventory_lot_risk_review: process.env.INVENTORY_LOT_RISK_REVIEW_SECRET,
    carrier_labels_retry: process.env.CARRIER_LABEL_RETRY_SECRET,
    carrier_tracking_sync: process.env.CARRIER_TRACKING_SYNC_SECRET,
    platform_fulfillment_retry: process.env.PLATFORM_FULFILLMENT_RETRY_SECRET,
    notification_generate: process.env.NOTIFICATION_GENERATE_SECRET,
    notification_delivery_retry: process.env.NOTIFICATION_RETRY_SECRET,
  };
  return taskSecrets[taskKey] || process.env.CRON_SECRET || "";
}

function taskStatusFromResponse(response: { ok: boolean; status: number }): AutomationTaskRunStatus {
  if (response.ok) return "completed";
  if (response.status === 401 || response.status === 403) return "unauthorized";
  return "failed";
}

function summaryFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return "任务已重试，未返回结构化汇总。";
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
  return "任务已重试。";
}

async function retryTask(request: Request, runId: string, taskKey: string) {
  const [run] = await getAutomationRuns({ keyword: runId, limit: 1 });
  const task = run?.id === runId ? run.results.find((item) => item.key === taskKey) : undefined;
  if (!run || !task) return { retryResult: null, error: "未找到要重试的自动化子任务" };

  const cookieStore = await cookies();
  const staffCookie = cookieStore.get(staffCookieName)?.value;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (staffCookie) headers.cookie = `${staffCookieName}=${staffCookie}`;
  const bearer = childBearerSecret(taskKey);
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (taskKey === "scheduled_reports" && process.env.REPORT_SCHEDULE_SECRET) headers["x-report-schedule-secret"] = process.env.REPORT_SCHEDULE_SECRET;

  const response = await fetch(new URL(task.endpoint, request.url), {
    method: "POST",
    headers,
    body: JSON.stringify(retryBodies[taskKey] ?? { limit: 50 }),
  }).catch((error: unknown) => ({
    ok: false,
    status: 0,
    json: async () => ({ error: error instanceof Error ? error.message : "网络异常" }),
  }));
  const payload = await response.json().catch(() => ({}));
  return {
    retryResult: {
      status: taskStatusFromResponse(response),
      httpStatus: response.status,
      summary: summaryFrom(payload),
      detail: payload,
    },
    error: null,
  };
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-automation-task-actions"), 30, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "自动化任务处理过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  if (staff.role !== "admin" && staff.role !== "ops") return NextResponse.json({ error: "当前账号无权处理自动化失败任务。" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as TaskActionBody;
  const runId = body.runId?.trim() ?? "";
  const taskKey = body.taskKey?.trim() ?? "";
  const action = body.action;
  if (!runId || !taskKey || !action) return NextResponse.json({ error: "缺少运行编号、任务编码或处理动作。" }, { status: 400 });

  const retry = action === "retry" ? await retryTask(request, runId, taskKey) : { retryResult: undefined, error: null };
  if (retry.error) return NextResponse.json({ error: retry.error }, { status: 404 });

  const result = await updateAutomationTaskHandling({
    runId,
    taskKey,
    action,
    assignedTo: body.assignedTo,
    note: body.note,
    operator: staff.displayName || staff.username,
    retryResult: retry.retryResult ?? undefined,
  });
  if (result.error || !result.task || !result.run) return NextResponse.json({ error: result.error || "自动化任务处理失败。" }, { status: 400 });

  await recordAuditLog({
    action: "automation_task_update",
    actorRole: "staff",
    actorName: staff.displayName || staff.username,
    targetType: "system",
    targetId: `${runId}:${taskKey}`,
    summary: action === "retry" ? "重试自动化失败任务" : action === "assign" ? "指派自动化失败任务" : action === "ignore" ? "忽略自动化失败任务" : "关闭自动化失败任务",
    note: body.note || result.task.lastRetrySummary || result.task.summary,
    after: {
      runId,
      taskKey,
      action,
      assignedTo: result.task.assignedTo,
      handlingStatus: result.task.handlingStatus,
      lastRetryStatus: result.task.lastRetryStatus,
      lastRetrySummary: result.task.lastRetrySummary,
    },
  });

  return NextResponse.json({ run: result.run, task: result.task, generatedAt: new Date().toISOString() });
}
