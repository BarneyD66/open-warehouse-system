import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { retryDueNotificationDeliveries } from "@/lib/notificationStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetryActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

function cronSecret() {
  return process.env.NOTIFICATION_RETRY_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = cronSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function authorize(request: Request): Promise<RetryActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "通知投递定时任务" };

  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops") return null;
  return { actorRole: "staff", actorName: staff.displayName || staff.username };
}

function limitFrom(request: Request, body?: { limit?: number }) {
  const queryLimit = Number(new URL(request.url).searchParams.get("limit"));
  const requested = Number.isFinite(body?.limit) ? Number(body?.limit) : queryLimit;
  if (!Number.isFinite(requested) || requested <= 0) return 50;
  return Math.min(200, Math.max(1, Math.floor(requested)));
}

async function runRetry(request: Request, body?: { limit?: number }) {
  const rate = checkRateLimit(rateLimitKey(request, "notification-retry-due"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "通知投递批量重试过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的通知投递重试请求。" }, { status: 401 });

  const limit = limitFrom(request, body);
  const result = await retryDueNotificationDeliveries(limit);
  await recordAuditLog({
    action: "notification_delivery_retry_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "notification_delivery",
    targetId: "due",
    summary: "自动重试到期通知投递",
    note: `限制 ${limit} 条，尝试 ${result.attempted} 条，成功 ${result.sent} 条，失败 ${result.failed} 条，阻断 ${result.blocked} 条。`,
    after: {
      limit,
      attempted: result.attempted,
      sent: result.sent,
      failed: result.failed,
      blocked: result.blocked,
    },
  });

  return NextResponse.json({ ...result, limit, generatedAt: new Date().toISOString() });
}

export async function GET(request: Request) {
  return runRetry(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  return runRetry(request, body);
}
