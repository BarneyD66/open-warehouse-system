import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { claimWebhookEvent, completeWebhookEvent, webhookBodyHash } from "@/lib/webhookEventStore";
import {
  cancelCoreOutboundShippingLabel,
  createCoreOutboundDeliveryException,
  getWarehouseCoreData,
  requestCoreOutboundIntercept,
  type CoreOutboundOrder,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const replayWindowMs = 10 * 60_000;

type RouteContext = {
  params: Promise<{ platform: string }>;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSignature(value: string | null) {
  return value?.trim().replace(/^sha256=/i, "") || "";
}

function expectedSignature(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret).update(timestamp ? `${timestamp}.${rawBody}` : rawBody).digest("hex");
}

function platformEnvPrefix(platform: string) {
  return platform.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function platformSecret(platform: string) {
  const prefix = platformEnvPrefix(platform);
  return process.env.PLATFORM_WEBHOOK_SECRET || process.env[`${prefix}_WEBHOOK_SECRET`];
}

function authorizeWebhook(request: Request, platform: string, rawBody: string) {
  const secret = platformSecret(platform);
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (!secret) {
    return isProduction
      ? { ok: false, error: "生产环境必须配置平台 webhook 签名密钥。" }
      : { ok: true, mode: "unsigned" as const };
  }

  const signature = normalizeSignature(request.headers.get("x-sheffield-signature") || request.headers.get("x-platform-signature") || request.headers.get("x-webhook-signature"));
  const timestamp = request.headers.get("x-sheffield-webhook-timestamp") || request.headers.get("x-webhook-timestamp") || "";
  if (signature) {
    if (!timestamp) return { ok: false, error: "缺少 webhook 时间戳。" };
    const timestampMs = Number(timestamp.length >= 13 ? timestamp : Number(timestamp) * 1000);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > replayWindowMs) return { ok: false, error: "Webhook 时间戳已过期或不合法。" };
    return safeEqual(signature, expectedSignature(secret, timestamp, rawBody)) ? { ok: true, mode: "hmac" as const } : { ok: false, error: "Webhook 签名不正确。" };
  }

  const legacyHeader = request.headers.get("x-sheffield-webhook-secret") || request.headers.get("x-webhook-secret");
  return legacyHeader && safeEqual(legacyHeader, secret) ? { ok: true, mode: "legacy-secret" as const } : { ok: false, error: "Webhook 密钥不正确。" };
}

function replayKey(request: Request, body: Record<string, unknown>, rawBody: string) {
  const headerId = request.headers.get("x-sheffield-webhook-id") || request.headers.get("x-webhook-id") || request.headers.get("x-event-id");
  const bodyId = body.eventId || body.event_id || body.id || body.webhookId;
  const id = clean(headerId || bodyId);
  return id || `body-${webhookBodyHash(rawBody)}`;
}

function orderNoFromPayload(body: Record<string, unknown>) {
  return clean(body.orderNo || body.orderNumber || body.order_number || body.orderId || body.order_id || body.AmazonOrderId || body.amazonOrderId || body.name || body.id);
}

function storeNameFromPayload(body: Record<string, unknown>) {
  return clean(body.storeName || body.store || body.shopName || body.shop || body.accountName);
}

function customerCodeFromPayload(body: Record<string, unknown>) {
  return clean(body.customerCode || body.customer || body.customer_code).toUpperCase();
}

function isCancellationPayload(body: Record<string, unknown>) {
  const text = [body.event, body.eventType, body.type, body.status, body.orderStatus, body.order_status, body.cancelStatus, body.cancel_status, body.cancelled_at, body.canceled_at]
    .map((value) => clean(value).toLowerCase())
    .join(" ");
  return Boolean(body.cancelled_at || body.canceled_at || body.cancelledAt || body.canceledAt) || ["cancelled", "canceled", "cancel", "voided", "closed"].some((value) => text.includes(value));
}

function cancellationReason(body: Record<string, unknown>) {
  return clean(body.reason || body.cancelReason || body.cancel_reason || body.message || body.note) || "平台推送订单取消/作废。";
}

function findOutboundOrder(orders: CoreOutboundOrder[], platform: string, orderNo: string, customerCode: string, storeName: string) {
  const platformText = platform.trim().toLowerCase();
  const orderText = orderNo.trim().toLowerCase();
  const storeText = storeName.trim().toLowerCase();
  return orders.find((order) => {
    if ((order.platformOrderNo || "").trim().toLowerCase() !== orderText) return false;
    if (order.platform && order.platform.toLowerCase() !== platformText) return false;
    if (customerCode && order.customerCode !== customerCode) return false;
    if (storeText && (order.platformStoreName || "").toLowerCase() !== storeText) return false;
    return true;
  });
}

async function handleCancellation(order: CoreOutboundOrder, reason: string, platform: string) {
  const operator = `${platform}-webhook`;
  const expansionData = await getOpsExpansionData();
  let labelCancelResult: Awaited<ReturnType<typeof cancelCoreOutboundShippingLabel>> | null = null;

  if (order.labelStatus === "generated" || order.trackingNumber) {
    labelCancelResult = await cancelCoreOutboundShippingLabel({
      id: order.id,
      operator,
      carrierConfigs: expansionData.logisticsChannels,
      reason: `平台取消订单，自动取消面单：${reason}`,
    });
  }

  if (order.status === "shipped") {
    const exceptionResult = await createCoreOutboundDeliveryException({
      id: order.id,
      exceptionType: "return_to_sender",
      message: `平台已取消订单，但出库单已发货：${reason}`,
      severity: "critical",
      redeliveryRequired: false,
      operator,
    });
    await recordAuditLog({
      action: "outbound_delivery_exception_create",
      actorRole: "system",
      actorName: operator,
      targetType: "outbound",
      targetId: order.id,
      customerCode: order.customerCode,
      summary: "平台取消订单触发已发货异常",
      note: reason,
      after: exceptionResult.exception,
    });
    return { action: "delivery_exception", labelCancelResult, ...exceptionResult };
  }

  const interceptResult = await requestCoreOutboundIntercept({
    id: order.id,
    reason: `平台取消订单：${reason}`,
    operator,
  });
  if (!interceptResult.error && interceptResult.order) {
    await recordAuditLog({
      action: "outbound_intercept_request",
      actorRole: "system",
      actorName: operator,
      targetType: "outbound",
      targetId: order.id,
      customerCode: order.customerCode,
      summary: "平台取消订单触发截单申请",
      note: reason,
      after: {
        status: interceptResult.order.status,
        interceptStatus: interceptResult.order.interceptStatus,
        interceptReason: interceptResult.order.interceptReason,
        labelCancelError: labelCancelResult?.error,
      },
    });
  }
  return { action: "intercept_requested", labelCancelResult, ...interceptResult };
}

async function handlePost(request: Request, platform: string) {
  const rawBody = await request.text();
  const auth = authorizeWebhook(request, platform, rawBody);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Webhook 请求体不是合法 JSON。" }, { status: 400 });
  }

  const eventId = replayKey(request, body, rawBody);
  const claimed = await claimWebhookEvent({ kind: "platform", provider: platform, eventId });
  if (claimed.duplicate) return NextResponse.json({ ok: true, duplicate: true, status: claimed.record.status, message: "重复 webhook 已忽略。" });

  if (!isCancellationPayload(body)) {
    await completeWebhookEvent({ id: claimed.record.id, status: "ignored", summary: "平台 webhook 非取消/作废订单事件，已忽略。" });
    return NextResponse.json({ ok: true, ignored: true, message: "当前平台事件不是取消/作废订单事件。" });
  }

  const orderNo = orderNoFromPayload(body);
  if (!orderNo) {
    await completeWebhookEvent({ id: claimed.record.id, status: "failed", error: "缺少平台订单号。", summary: "平台 webhook 缺少订单号" });
    return NextResponse.json({ error: "缺少平台订单号。" }, { status: 400 });
  }

  const coreData = await getWarehouseCoreData();
  const order = findOutboundOrder(coreData.outboundOrders, platform, orderNo, customerCodeFromPayload(body), storeNameFromPayload(body));
  if (!order) {
    await completeWebhookEvent({ id: claimed.record.id, status: "failed", error: "未匹配到对应出库单。", summary: `${platform} 取消事件未匹配出库单：${orderNo}` });
    return NextResponse.json({ error: "未匹配到对应出库单。", platform, orderNo }, { status: 404 });
  }

  const result = await handleCancellation(order, cancellationReason(body), platform);
  await completeWebhookEvent({
    id: claimed.record.id,
    status: result.error ? "failed" : "processed",
    targetId: order.id,
    summary: `${platform} 取消/作废订单事件：${orderNo}`,
    error: result.error ?? undefined,
  });

  return NextResponse.json({
    ok: !result.error,
    authMode: auth.mode,
    platform,
    orderNo,
    outboundId: order.id,
    result,
  }, { status: result.error ? 400 : 200 });
}

export async function POST(request: Request, context: RouteContext) {
  const { platform } = await context.params;
  return withApiErrorCapture(request, "/api/webhooks/platforms/[platform]", () => handlePost(request, platform), { refId: platform });
}
