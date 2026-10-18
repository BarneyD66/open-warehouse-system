import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import {
  batchGenerateOutboundPickWaves,
  getWarehouseCoreData,
  type CoreOutboundOrder,
  type OutboundPickWaveStrategy,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutoGenerateActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type AutoGenerateBody = {
  limit?: number;
  strategy?: OutboundPickWaveStrategy;
  assignedPicker?: string;
  minAgeMinutes?: number;
};

const validStrategies = new Set<OutboundPickWaveStrategy>(["single_wave", "work_mode", "carrier", "channel", "cutoff_time", "warehouse_zone", "sku_heat"]);

function autoGenerateSecret() {
  return process.env.OUTBOUND_PICK_WAVE_AUTO_SECRET || process.env.JOB_RUN_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = autoGenerateSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<AutoGenerateActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "出库波次自动生成任务" };

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

function optionsFrom(request: Request, body?: AutoGenerateBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 60;
  const minAgeMinutes = numberFrom(body?.minAgeMinutes) ?? numberFrom(url.searchParams.get("minAgeMinutes")) ?? 0;
  const strategy = (body?.strategy || url.searchParams.get("strategy") || "carrier") as OutboundPickWaveStrategy;
  return {
    limit: Math.min(200, Math.max(1, Math.floor(limit))),
    minAgeMinutes: Math.min(24 * 60, Math.max(0, Math.floor(minAgeMinutes))),
    strategy: validStrategies.has(strategy) ? strategy : ("carrier" as OutboundPickWaveStrategy),
    assignedPicker: body?.assignedPicker?.trim() || url.searchParams.get("assignedPicker")?.trim() || "",
  };
}

function orderAgeMinutes(order: CoreOutboundOrder, nowMs: number) {
  const timestamp = new Date(order.updatedAt || order.createdAt).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.floor((nowMs - timestamp) / 60_000);
}

function isPickWaveCandidate(order: CoreOutboundOrder, nowMs: number, minAgeMinutes: number) {
  if (order.pickWaveNo || order.pickListNo) return false;
  if (order.status === "shipped" || order.status === "blocked" || order.status === "handover" || order.status === "packing_check") return false;
  if (order.interceptStatus === "requested" || order.interceptStatus === "restock_pending" || order.interceptStatus === "completed") return false;
  if (!order.skuLines?.length) return false;
  return orderAgeMinutes(order, nowMs) >= minAgeMinutes;
}

function candidatePriority(order: CoreOutboundOrder) {
  const statusScore = order.status === "pending_review" ? 0 : order.status === "picking" ? 1 : 2;
  const carrierScore = order.carrierServiceCode || order.carrierName ? 0 : 1;
  const qty = (order.skuLines ?? []).reduce((sum, line) => sum + line.quantity, 0);
  return statusScore * 1000 + carrierScore * 100 - Math.min(qty, 99);
}

async function runAutoGenerate(request: Request, body?: AutoGenerateBody) {
  const rate = checkRateLimit(rateLimitKey(request, "outbound-pick-wave-auto-generate"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "自动生成出库波次过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的出库波次自动生成请求。" }, { status: 401 });

  const options = optionsFrom(request, body);
  const data = await getWarehouseCoreData();
  const nowMs = Date.now();
  const candidates = data.outboundOrders
    .filter((order) => isPickWaveCandidate(order, nowMs, options.minAgeMinutes))
    .sort((left, right) => candidatePriority(left) - candidatePriority(right) || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(0, options.limit);

  if (candidates.length === 0) {
    const summary = {
      limit: options.limit,
      strategy: options.strategy,
      minAgeMinutes: options.minAgeMinutes,
      scannedOrders: data.outboundOrders.length,
      candidateCount: 0,
      updatedOrders: 0,
      waveCount: 0,
      skipped: 0,
    };
    return NextResponse.json({ generatedAt: new Date().toISOString(), summary, waves: [], results: [] });
  }

  const result = await batchGenerateOutboundPickWaves({
    ids: candidates.map((order) => order.id),
    operator: actor.actorName,
    strategy: options.strategy,
    assignedPicker: options.assignedPicker,
    note: `自动生成出库拣货波次；策略：${options.strategy}`,
  });

  const summary = {
    limit: options.limit,
    strategy: options.strategy,
    minAgeMinutes: options.minAgeMinutes,
    scannedOrders: data.outboundOrders.length,
    candidateCount: candidates.length,
    updatedOrders: result.updated.length,
    waveCount: result.waves.length,
    skipped: result.skipped.length,
  };

  await recordAuditLog({
    action: "outbound_pick_wave_batch",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "outbound",
    targetId: "pick-wave-auto-generate",
    summary: "自动生成出库拣货波次",
    note: `候选 ${summary.candidateCount} 单，更新 ${summary.updatedOrders} 单，生成 ${summary.waveCount} 个波次。`,
    after: {
      summary,
      selectedIds: candidates.map((order) => order.id),
      waves: result.waves,
      missing: result.missing,
      skipped: result.skipped,
    },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary,
    waves: result.waves,
    results: result.updated.map((order) => ({
      outboundId: order.id,
      customerCode: order.customerCode,
      status: order.status,
      workMode: order.workMode,
      pickWaveNo: order.pickWaveNo,
      pickListNo: order.pickListNo,
      basketNo: order.basketNo,
      assignedPicker: order.assignedPicker,
    })),
    skipped: result.skipped,
  });
}

export async function GET(request: Request) {
  return runAutoGenerate(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AutoGenerateBody;
  return runAutoGenerate(request, body);
}
