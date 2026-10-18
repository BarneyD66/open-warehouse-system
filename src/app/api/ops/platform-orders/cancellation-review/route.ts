import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { reviewPlatformCancelledOrders } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type ReviewBody = {
  limit?: number;
};

function reviewSecret() {
  return process.env.PLATFORM_CANCELLATION_REVIEW_SECRET || process.env.PLATFORM_ORDER_SYNC_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = reviewSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<ReviewActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "平台取消订单复核定时任务" };

  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops") return null;
  return { actorRole: "staff", actorName: staff.displayName || staff.username };
}

function limitFrom(request: Request, body?: ReviewBody) {
  const queryLimit = Number(new URL(request.url).searchParams.get("limit"));
  const requested = Number.isFinite(body?.limit) ? Number(body?.limit) : queryLimit;
  if (!Number.isFinite(requested) || requested <= 0) return 50;
  return Math.min(200, Math.max(1, Math.floor(requested)));
}

async function runReview(request: Request, body?: ReviewBody) {
  const rate = checkRateLimit(rateLimitKey(request, "platform-cancellation-review"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "平台取消订单复核过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的平台取消订单复核请求。" }, { status: 401 });

  const result = await reviewPlatformCancelledOrders({ operator: actor.actorName, limit: limitFrom(request, body) });
  const summary = {
    limit: result.limit,
    scannedJobs: result.scannedJobs,
    reviewed: result.reviewed,
    intercepts: result.intercepts,
    deliveryExceptions: result.deliveryExceptions,
    workOrders: result.workOrders,
    unmatched: result.unmatched,
    failed: result.failed,
  };

  await recordAuditLog({
    action: "platform_cancellation_review_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "outbound",
    targetId: "platform-cancellation-review",
    summary: "批量复核平台取消订单",
    note: `扫描 ${summary.scannedJobs} 个同步任务，复核 ${summary.reviewed} 条，截单 ${summary.intercepts} 条，异常 ${summary.deliveryExceptions} 条。`,
    after: { summary, results: result.results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, results: result.results });
}

export async function GET(request: Request) {
  return runReview(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ReviewBody;
  return runReview(request, body);
}
