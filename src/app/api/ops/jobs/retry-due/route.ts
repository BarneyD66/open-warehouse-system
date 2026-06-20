import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData, retryBatchOperationPlan, type BatchOperationPlan } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetryDueActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type RetryDueBody = {
  limit?: number;
  includeQueued?: boolean;
};

type RetryDueRow = {
  id: string;
  title: string;
  kind: BatchOperationPlan["kind"];
  targetModule: BatchOperationPlan["targetModule"];
  beforeStatus: BatchOperationPlan["status"];
  afterStatus: BatchOperationPlan["status"];
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  status: "retried" | "skipped" | "failed";
  message: string;
};

function retrySecret() {
  return process.env.JOB_RETRY_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = retrySecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<RetryDueActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "任务队列自动重试" };
  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops") return null;
  return { actorRole: "staff", actorName: staff.displayName || staff.username };
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionsFrom(request: Request, body?: RetryDueBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 50;
  const includeQueued = body?.includeQueued ?? url.searchParams.get("includeQueued") === "1";
  return {
    limit: Math.min(200, Math.max(1, Math.floor(limit))),
    includeQueued,
  };
}

function dueForRetry(plan: BatchOperationPlan, includeQueued: boolean, nowMs: number) {
  if (plan.status === "exception") return (plan.attempts ?? 0) < (plan.maxAttempts ?? 3);
  if (!includeQueued || plan.status !== "queued") return false;
  if (!plan.nextRunAt) return true;
  const nextRunMs = new Date(plan.nextRunAt).getTime();
  return !Number.isFinite(nextRunMs) || nextRunMs <= nowMs;
}

async function retryOne(plan: BatchOperationPlan, actorName: string): Promise<RetryDueRow> {
  if (plan.status === "queued") {
    return {
      id: plan.id,
      title: plan.title,
      kind: plan.kind,
      targetModule: plan.targetModule,
      beforeStatus: plan.status,
      afterStatus: plan.status,
      attempts: plan.attempts ?? 0,
      maxAttempts: plan.maxAttempts ?? 3,
      nextRunAt: plan.nextRunAt ?? "",
      status: "skipped",
      message: "任务已在队列中，等待执行器处理。",
    };
  }

  const result = await retryBatchOperationPlan({ id: plan.id, operator: actorName });
  if (result.error || !result.plan) {
    return {
      id: plan.id,
      title: plan.title,
      kind: plan.kind,
      targetModule: plan.targetModule,
      beforeStatus: plan.status,
      afterStatus: result.plan?.status ?? plan.status,
      attempts: result.plan?.attempts ?? plan.attempts ?? 0,
      maxAttempts: result.plan?.maxAttempts ?? plan.maxAttempts ?? 3,
      nextRunAt: result.plan?.nextRunAt ?? plan.nextRunAt ?? "",
      status: "failed",
      message: result.error || "任务重试失败。",
    };
  }

  return {
    id: result.plan.id,
    title: result.plan.title,
    kind: result.plan.kind,
    targetModule: result.plan.targetModule,
    beforeStatus: plan.status,
    afterStatus: result.plan.status,
    attempts: result.plan.attempts ?? 0,
    maxAttempts: result.plan.maxAttempts ?? 3,
    nextRunAt: result.plan.nextRunAt ?? "",
    status: "retried",
    message: "异常任务已重新排队，等待任务执行器处理。",
  };
}

async function runRetryDue(request: Request, body?: RetryDueBody) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-jobs-retry-due"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "任务队列重试过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的任务队列重试请求。" }, { status: 401 });

  const options = optionsFrom(request, body);
  const data = await getOpsExpansionData();
  const nowMs = Date.now();
  const duePlans = data.batchOperationPlans
    .filter((plan) => dueForRetry(plan, options.includeQueued, nowMs))
    .sort((left, right) => new Date(left.updatedAt || left.createdAt).getTime() - new Date(right.updatedAt || right.createdAt).getTime())
    .slice(0, options.limit);

  const results: RetryDueRow[] = [];
  for (const plan of duePlans) results.push(await retryOne(plan, actor.actorName));

  const summary = {
    limit: options.limit,
    includeQueued: options.includeQueued,
    scannedJobs: data.batchOperationPlans.length,
    attempted: results.length,
    retried: results.filter((item) => item.status === "retried").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
  };

  await recordAuditLog({
    action: "batch_job_retry_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "system",
    targetId: "batch-jobs-retry-due",
    summary: "批量重试到期异常任务",
    note: `扫描 ${summary.scannedJobs} 个任务，处理 ${summary.attempted} 个，重新排队 ${summary.retried} 个，失败 ${summary.failed} 个。`,
    after: { summary, results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, results });
}

export async function GET(request: Request) {
  return runRetryDue(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RetryDueBody;
  return runRetryDue(request, body);
}
