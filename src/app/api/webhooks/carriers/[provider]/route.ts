import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { normalizeCarrierWebhookPayload } from "@/lib/carrierGateway";
import { claimWebhookEvent, completeWebhookEvent, webhookBodyHash } from "@/lib/webhookEventStore";
import {
  addCoreOutboundTrackingEventByReference,
  createCoreOutboundDeliveryException,
  type OutboundDeliveryExceptionType,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const replayWindowMs = 10 * 60_000;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeSignature(value: string | null) {
  return value?.trim().replace(/^sha256=/i, "") || "";
}

function signaturePayload(timestamp: string, rawBody: string) {
  return timestamp ? `${timestamp}.${rawBody}` : rawBody;
}

function expectedSignature(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret).update(signaturePayload(timestamp, rawBody)).digest("hex");
}

function replayKey(request: Request, body: Record<string, unknown>, rawBody: string) {
  const headerId = request.headers.get("x-sheffield-webhook-id") || request.headers.get("x-webhook-id") || request.headers.get("x-event-id");
  const bodyId = body.eventId || body.event_id || body.id || body.webhookId;
  const id = String(headerId || bodyId || "").trim();
  return id || `body-${webhookBodyHash(rawBody)}`;
}

function authorizeWebhook(request: Request, provider: string, rawBody: string) {
  const secret = process.env.CARRIER_WEBHOOK_SECRET || process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (!secret) {
    return isProduction
      ? { ok: false, error: "生产环境必须配置承运商 webhook 签名密钥。" }
      : { ok: true, mode: "unsigned" as const };
  }

  const signature = normalizeSignature(request.headers.get("x-sheffield-signature") || request.headers.get("x-carrier-signature") || request.headers.get("x-webhook-signature"));
  const timestamp = request.headers.get("x-sheffield-webhook-timestamp") || request.headers.get("x-webhook-timestamp") || "";
  if (signature) {
    if (!timestamp) return { ok: false, error: "缺少 webhook 时间戳。" };
    const timestampMs = Number(timestamp.length >= 13 ? timestamp : Number(timestamp) * 1000);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > replayWindowMs) return { ok: false, error: "Webhook 时间戳已过期或不合法。" };
    const expected = expectedSignature(secret, timestamp, rawBody);
    return safeEqual(signature, expected) ? { ok: true, mode: "hmac" as const } : { ok: false, error: "Webhook 签名不正确。" };
  }

  const legacyHeader = request.headers.get("x-sheffield-webhook-secret") || request.headers.get("x-webhook-secret");
  return legacyHeader && safeEqual(legacyHeader, secret) ? { ok: true, mode: "legacy-secret" as const } : { ok: false, error: "Webhook 密钥不正确。" };
}

function deliveryExceptionTypeFromWebhook(body: Record<string, unknown>, detail: string | undefined): OutboundDeliveryExceptionType {
  const text = `${String(body.exceptionType || body.reasonCode || body.reason || body.event || body.status || "")} ${detail || ""}`.toLowerCase();
  if (text.includes("address")) return "address_issue";
  if (text.includes("absent") || text.includes("not home") || text.includes("no answer")) return "customer_absent";
  if (text.includes("damage")) return "damaged";
  if (text.includes("lost")) return "lost";
  if (text.includes("return")) return "return_to_sender";
  if (text.includes("claim")) return "claim";
  return "delivery_failed";
}

function webhookNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : undefined;
}

function webhookText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function proofUrlFromWebhook(body: Record<string, unknown>) {
  return webhookText(body.proofUrl, body.proof_url, body.podUrl, body.pod_url, body.pod, body.proof, body.signatureUrl, body.signature_url);
}

async function handlePost(request: Request, provider: string) {
  const rawBody = await request.text();
  const auth = authorizeWebhook(request, provider, rawBody);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Webhook 请求体不是合法 JSON。" }, { status: 400 });
  }

  const payload = normalizeCarrierWebhookPayload(body);
  if (!payload.outboundId && !payload.trackingNumber && !payload.carrierShipmentId) {
    return NextResponse.json({ error: "缺少出库单号、追踪号或承运商运单号。" }, { status: 400 });
  }

  const eventId = replayKey(request, body, rawBody);
  const claimed = await claimWebhookEvent({ kind: "carrier", provider, eventId });
  if (claimed.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true, status: claimed.record.status, message: "重复 webhook 已忽略。" });
  }

  const order = await addCoreOutboundTrackingEventByReference({
    outboundId: payload.outboundId,
    trackingNumber: payload.trackingNumber,
    carrierShipmentId: payload.carrierShipmentId,
    status: payload.status ?? "warehouse_processing",
    detail: payload.detail || `${provider} 轨迹自动回传`,
    location: payload.location,
    operator: `${provider}-webhook`,
  });
  if (!order) {
    await completeWebhookEvent({ id: claimed.record.id, status: "failed", error: "未匹配到出库单。", summary: "承运商 webhook 未匹配到出库单" });
    return NextResponse.json({ error: "未匹配到出库单。" }, { status: 404 });
  }

  let deliveryException: unknown = null;
  const proofUrl = proofUrlFromWebhook(body);
  if (payload.status === "exception") {
    const claimAmount = webhookNumber(body.claimAmount || body.claim_amount);
    const result = await createCoreOutboundDeliveryException({
      id: order.id,
      exceptionType: deliveryExceptionTypeFromWebhook(body, payload.detail),
      message: payload.detail || `${provider} 派送异常自动回传`,
      severity: "critical",
      redeliveryRequired: Boolean(body.redeliveryRequired || body.redelivery_required || String(body.action || "").toLowerCase().includes("redelivery")),
      redeliveryNote: webhookText(body.redeliveryNote, body.redelivery_note) || undefined,
      proofUrl,
      claimAmount,
      claimStatus: claimAmount ? "draft" : undefined,
      claimNote: webhookText(body.claimNote, body.claim_note) || undefined,
      recordTrackingEvent: false,
      operator: `${provider}-webhook`,
    });
    deliveryException = result.exception;
  }

  if (payload.status === "delivered" && proofUrl && !order.exceptions?.some((item) => item.proofUrl === proofUrl || item.deliveryExceptionType === "proof_uploaded")) {
    const result = await createCoreOutboundDeliveryException({
      id: order.id,
      exceptionType: "proof_uploaded",
      message: payload.detail || `${provider} 已回传签收证明`,
      severity: "warning",
      proofUrl,
      claimStatus: "not_required",
      recordTrackingEvent: false,
      operator: `${provider}-webhook`,
    });
    deliveryException = result.exception;
  }

  await completeWebhookEvent({
    id: claimed.record.id,
    status: "processed",
    targetId: order.id,
    summary: `承运商 ${provider} 回传 ${payload.status ?? "warehouse_processing"} / ${order.trackingNumber || payload.trackingNumber || "-"}`,
  });
  return NextResponse.json({ ok: true, authMode: auth.mode, orderId: order.id, status: order.status, trackingNumber: order.trackingNumber, deliveryException });
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return withApiErrorCapture(request, "/api/webhooks/carriers/[provider]", () => handlePost(request, provider), { refId: provider });
}
