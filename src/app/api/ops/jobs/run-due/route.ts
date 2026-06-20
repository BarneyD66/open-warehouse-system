import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { listRunnableBatchOperationPlans, updateBatchOperationStatus, type BatchOperationPlan } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { batchGenerateOutboundPickWaves, getWarehouseCoreData, type OutboundPickWaveStrategy } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunDueActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type RunDueBody = {
  limit?: number;
  strategy?: OutboundPickWaveStrategy;
};

type RunDueRow = {
  id: string;
  title: string;
  kind: BatchOperationPlan["kind"];
  targetModule: BatchOperationPlan["targetModule"];
  beforeStatus: BatchOperationPlan["status"];
  afterStatus: BatchOperationPlan["status"];
  attempts: number;
  status: "completed" | "failed";
  message: string;
  details?: Record<string, unknown>;
};

function runSecret() {
  return process.env.JOB_RUN_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = runSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<RunDueActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "批量任务自动执行器" };
  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops" && staff.role !== "warehouse") return null;
  return { actorRole: "staff", actorName: staff.displayName || staff.username };
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionsFrom(request: Request, body?: RunDueBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 20;
  return {
    limit: Math.min(100, Math.max(1, Math.floor(limit))),
    strategy: body?.strategy ?? (url.searchParams.get("strategy") as OutboundPickWaveStrategy | null) ?? "carrier",
  };
}

function missingPayloadMessage(plan: BatchOperationPlan) {
  const template = plan.templateName ? `，模板：${plan.templateName}` : "";
  if (plan.kind === "sku_import") return `批量导入 SKU 任务缺少待执行文件${template}。请重新上传 SKU 模板后执行。`;
  if (plan.kind === "inbound_import") return `批量入库任务缺少待执行文件${template}。请重新上传入库模板后执行。`;
  if (plan.kind === "location_move") return `批量改库位/移库任务缺少库位明细文件${template}。请上传包含 SKU、原库位、新库位和数量的模板后执行。`;
  if (plan.kind === "weighing") return `批量称重任务缺少称重明细文件${template}。请上传出库单号和重量后执行。`;
  if (plan.kind === "tracking_upload") return `批量上传追踪号任务缺少追踪号文件${template}。请上传出库单号、承运商和追踪号后执行。`;
  if (plan.kind === "export") return "导出任务应在报表中心选择报表后生成，当前队列任务没有导出条件。";
  return "当前任务缺少可执行参数，请补充任务文件或条件后重试。";
}

async function runPickingWaveJob(plan: BatchOperationPlan, actorName: string, strategy: OutboundPickWaveStrategy) {
  const data = await getWarehouseCoreData();
  const limit = plan.recordCount > 0 ? Math.min(plan.recordCount, 200) : 50;
  const ids = data.outboundOrders
    .filter((order) => order.status !== "shipped" && order.status !== "blocked" && !order.pickWaveNo)
    .slice(0, limit)
    .map((order) => order.id);

  if (ids.length === 0) {
    return {
      ok: true,
      message: "没有待生成拣货波次的出库单，任务已完成。",
      details: { selectedOrders: 0, strategy },
    };
  }

  const result = await batchGenerateOutboundPickWaves({
    ids,
    operator: actorName,
    strategy,
    note: `批量任务 ${plan.id} 自动执行`,
  });

  return {
    ok: result.updated.length > 0,
    message:
      result.updated.length > 0
        ? `已生成 ${result.waves.length} 个拣货波次，更新 ${result.updated.length} 个出库单。`
        : "未能生成拣货波次，请检查出库单状态。",
    details: {
      selectedOrders: ids.length,
      updatedOrders: result.updated.length,
      waveCount: result.waves.length,
      waves: result.waves,
      missing: result.missing,
      skipped: result.skipped,
      strategy,
    },
  };
}

async function executePlan(plan: BatchOperationPlan, actorName: string, strategy: OutboundPickWaveStrategy): Promise<RunDueRow> {
  const beforeStatus = plan.status;
  await updateBatchOperationStatus({
    id: plan.id,
    status: "processing",
    note: `由 ${actorName} 执行到期批量任务`,
  });

  try {
    const result =
      plan.kind === "picking_wave"
        ? await runPickingWaveJob(plan, actorName, strategy)
        : { ok: false, message: missingPayloadMessage(plan), details: { templateName: plan.templateName ?? "", recordCount: plan.recordCount } };

    const next = await updateBatchOperationStatus({
      id: plan.id,
      status: result.ok ? "completed" : "exception",
      note: result.message,
      error: result.ok ? undefined : result.message,
    });

    return {
      id: plan.id,
      title: plan.title,
      kind: plan.kind,
      targetModule: plan.targetModule,
      beforeStatus,
      afterStatus: next.plan?.status ?? (result.ok ? "completed" : "exception"),
      attempts: next.plan?.attempts ?? (plan.attempts ?? 0) + 1,
      status: result.ok ? "completed" : "failed",
      message: result.message,
      details: result.details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "任务执行异常";
    const next = await updateBatchOperationStatus({ id: plan.id, status: "exception", note: message, error: message });
    return {
      id: plan.id,
      title: plan.title,
      kind: plan.kind,
      targetModule: plan.targetModule,
      beforeStatus,
      afterStatus: next.plan?.status ?? "exception",
      attempts: next.plan?.attempts ?? (plan.attempts ?? 0) + 1,
      status: "failed",
      message,
    };
  }
}

async function runDueJobs(request: Request, body?: RunDueBody) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-jobs-run-due"), 30, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "批量任务执行过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的批量任务执行请求。" }, { status: 401 });

  const options = optionsFrom(request, body);
  const duePlans = (await listRunnableBatchOperationPlans())
    .sort((left, right) => new Date(left.updatedAt || left.createdAt).getTime() - new Date(right.updatedAt || right.createdAt).getTime())
    .slice(0, options.limit);

  const results: RunDueRow[] = [];
  for (const plan of duePlans) results.push(await executePlan(plan, actor.actorName, options.strategy));

  const summary = {
    limit: options.limit,
    scannedRunnable: duePlans.length,
    completed: results.filter((item) => item.status === "completed").length,
    failed: results.filter((item) => item.status === "failed").length,
  };

  await recordAuditLog({
    action: "batch_job_run_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "system",
    targetId: "batch-jobs-run-due",
    summary: "执行到期批量任务",
    note: `处理 ${summary.scannedRunnable} 个到期任务，完成 ${summary.completed} 个，失败 ${summary.failed} 个。`,
    after: { summary, results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, results });
}

export async function GET(request: Request) {
  return runDueJobs(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RunDueBody;
  return runDueJobs(request, body);
}
