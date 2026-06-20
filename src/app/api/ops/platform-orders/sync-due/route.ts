import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData, syncPlatformConnection, type PlatformConnection } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type SyncDueBody = {
  limit?: number;
  minIntervalMinutes?: number;
  connectionId?: string;
};

type SyncDueResult = {
  connectionId: string;
  platform: string;
  storeName: string;
  customerCode: string;
  status: "completed" | "failed" | "skipped";
  message: string;
  jobId?: string;
  orderImportBatchId?: string;
  pulledRows?: number;
  readyOrders?: number;
  skippedRows?: number;
  issueCount?: number;
  cancelledRows?: number;
};

function syncSecret() {
  return process.env.PLATFORM_ORDER_SYNC_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = syncSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<SyncActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "平台订单同步定时任务" };

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

function optionsFrom(request: Request, body?: SyncDueBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 20;
  const minIntervalMinutes = numberFrom(body?.minIntervalMinutes) ?? numberFrom(url.searchParams.get("minIntervalMinutes")) ?? 30;
  const connectionId = (body?.connectionId || url.searchParams.get("connectionId") || "").trim();
  return {
    limit: Math.min(100, Math.max(1, Math.floor(limit))),
    minIntervalMinutes: Math.min(24 * 60, Math.max(0, Math.floor(minIntervalMinutes))),
    connectionId,
  };
}

function minutesSince(value: string | undefined, nowMs: number) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.floor((nowMs - timestamp) / 60_000);
}

function shouldSyncConnection(connection: PlatformConnection, nowMs: number, minIntervalMinutes: number, connectionId: string) {
  if (connectionId && connection.id !== connectionId) return false;
  if (connection.syncMode === "manual_csv") return false;
  if (connection.status === "paused" || connection.status === "draft") return false;
  return minutesSince(connection.lastSyncAt, nowMs) >= minIntervalMinutes;
}

async function syncOne(connection: PlatformConnection, actorName: string): Promise<SyncDueResult> {
  const result = await syncPlatformConnection({ id: connection.id, operator: actorName });
  if (result.error) {
    return {
      connectionId: connection.id,
      platform: connection.platform,
      storeName: connection.storeName,
      customerCode: connection.customerCode,
      status: "failed",
      message: result.error,
    };
  }
  if (!result.job) {
    return {
      connectionId: connection.id,
      platform: connection.platform,
      storeName: connection.storeName,
      customerCode: connection.customerCode,
      status: "failed",
      message: "同步未生成任务记录，请检查平台连接。",
    };
  }
  return {
    connectionId: connection.id,
    platform: connection.platform,
    storeName: connection.storeName,
    customerCode: connection.customerCode,
    status: result.job.status === "completed" ? "completed" : "failed",
    message: result.job.status === "completed" ? "平台订单同步完成，已生成导入预检草稿。" : result.job.error || "平台订单同步失败。",
    jobId: result.job.id,
    orderImportBatchId: result.job.orderImportBatchId,
    pulledRows: result.job.pulledRows,
    readyOrders: result.job.readyOrders,
    skippedRows: result.job.skippedRows,
    issueCount: result.job.issueCount,
    cancelledRows: result.job.cancelledRows ?? 0,
  };
}

async function runSyncDue(request: Request, body?: SyncDueBody) {
  const rate = checkRateLimit(rateLimitKey(request, "platform-orders-sync-due"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "平台订单同步过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的平台订单同步请求。" }, { status: 401 });

  const options = optionsFrom(request, body);
  const expansionData = await getOpsExpansionData();
  const nowMs = Date.now();
  const dueConnections = expansionData.platformConnections
    .filter((connection) => shouldSyncConnection(connection, nowMs, options.minIntervalMinutes, options.connectionId))
    .sort((left, right) => new Date(left.lastSyncAt || left.updatedAt || 0).getTime() - new Date(right.lastSyncAt || right.updatedAt || 0).getTime())
    .slice(0, options.limit);

  const results: SyncDueResult[] = [];
  for (const connection of dueConnections) results.push(await syncOne(connection, actor.actorName));

  const summary = {
    limit: options.limit,
    minIntervalMinutes: options.minIntervalMinutes,
    scannedConnections: expansionData.platformConnections.length,
    attempted: results.length,
    completed: results.filter((item) => item.status === "completed").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
  };

  await recordAuditLog({
    action: "platform_orders_sync_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "outbound",
    targetId: "platform-orders-sync-due",
    summary: "批量同步到期平台订单",
    note: `扫描 ${summary.scannedConnections} 个连接，尝试 ${summary.attempted} 个，成功 ${summary.completed} 个，失败 ${summary.failed} 个。`,
    after: { summary, results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, results });
}

export async function GET(request: Request) {
  return withApiErrorCapture(request, "/api/ops/platform-orders/sync-due", () => runSyncDue(request));
}

export async function POST(request: Request) {
  return withApiErrorCapture(request, "/api/ops/platform-orders/sync-due", async () => {
    const body = (await request.json().catch(() => ({}))) as SyncDueBody;
    return runSyncDue(request, body);
  });
}
