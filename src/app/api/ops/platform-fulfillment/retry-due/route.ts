import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { pushPlatformFulfillment } from "@/lib/platformGateway";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { getWarehouseCoreData, updateCoreOutboundPlatformFulfillment, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetryActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type RetryResultRow = {
  outboundId: string;
  customerCode: string;
  platform: string;
  storeName: string;
  orderNo: string;
  trackingNumber: string;
  status: "synced" | "failed" | "skipped";
  message: string;
};

function retrySecret() {
  return process.env.PLATFORM_FULFILLMENT_RETRY_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = retrySecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function authorize(request: Request): Promise<RetryActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "平台发货回传定时任务" };

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

function shouldRetryFulfillment(order: CoreOutboundOrder) {
  if (!order.platform || !order.platformOrderNo || !order.trackingNumber) return false;
  if (order.platformFulfillmentStatus === "synced" || order.platformFulfillmentStatus === "not_required") return false;
  return order.platformFulfillmentStatus === "failed" || order.platformFulfillmentStatus === "pending" || !order.platformFulfillmentStatus;
}

async function retryOrder(order: CoreOutboundOrder, platformConnections: Awaited<ReturnType<typeof getOpsExpansionData>>["platformConnections"]): Promise<RetryResultRow> {
  const connection = platformConnections.find(
    (item) => item.platform === order.platform && item.customerCode === order.customerCode && (!order.platformStoreName || item.storeName === order.platformStoreName),
  );

  if (!connection) {
    const message = "未找到匹配的平台连接，请先在平台对接中配置客户店铺连接。";
    await updateCoreOutboundPlatformFulfillment({ id: order.id, status: "failed", error: message });
    return {
      outboundId: order.id,
      customerCode: order.customerCode,
      platform: order.platform ?? "",
      storeName: order.platformStoreName ?? "",
      orderNo: order.platformOrderNo ?? "",
      trackingNumber: order.trackingNumber ?? "",
      status: "failed",
      message,
    };
  }

  const fulfillment = await pushPlatformFulfillment({
    connection,
    orderNo: order.platformOrderNo!,
    outboundId: order.id,
    trackingNumber: order.trackingNumber!,
    carrierName: order.carrierName,
    carrierServiceName: order.carrierServiceName,
  });
  await updateCoreOutboundPlatformFulfillment({ id: order.id, status: fulfillment.ok ? "synced" : "failed", error: fulfillment.error });

  return {
    outboundId: order.id,
    customerCode: order.customerCode,
    platform: order.platform ?? "",
    storeName: order.platformStoreName ?? connection.storeName,
    orderNo: order.platformOrderNo ?? "",
    trackingNumber: order.trackingNumber ?? "",
    status: fulfillment.ok ? "synced" : "failed",
    message: fulfillment.ok ? "平台发货追踪号回传成功。" : fulfillment.error || "平台发货追踪号回传失败。",
  };
}

async function runRetry(request: Request, body?: { limit?: number }) {
  const rate = checkRateLimit(rateLimitKey(request, "platform-fulfillment-retry-due"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "平台发货回传重试过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的平台发货回传重试请求。" }, { status: 401 });

  const limit = limitFrom(request, body);
  const [coreData, expansionData] = await Promise.all([getWarehouseCoreData(), getOpsExpansionData()]);
  const retryOrders = coreData.outboundOrders
    .filter(shouldRetryFulfillment)
    .sort((left, right) => new Date(left.updatedAt || left.createdAt).getTime() - new Date(right.updatedAt || right.createdAt).getTime())
    .slice(0, limit);

  const results: RetryResultRow[] = [];
  for (const order of retryOrders) {
    results.push(await retryOrder(order, expansionData.platformConnections));
  }

  const summary = {
    limit,
    attempted: results.length,
    synced: results.filter((item) => item.status === "synced").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
  };

  await recordAuditLog({
    action: "platform_fulfillment_retry_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "outbound",
    targetId: "platform-fulfillment-due",
    summary: "批量重试平台发货追踪号回传",
    note: `限制 ${summary.limit} 条，尝试 ${summary.attempted} 条，成功 ${summary.synced} 条，失败 ${summary.failed} 条。`,
    after: { summary, results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, results });
}

export async function GET(request: Request) {
  return runRetry(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  return runRetry(request, body);
}
