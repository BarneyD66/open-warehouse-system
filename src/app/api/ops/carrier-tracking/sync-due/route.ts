import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { fetchCarrierTrackingAndProof } from "@/lib/carrierGateway";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import {
  addCoreOutboundTrackingEvent,
  createCoreOutboundDeliveryException,
  getWarehouseCoreData,
  type CoreOutboundOrder,
  type OutboundDeliveryExceptionType,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type SyncBody = {
  limit?: number;
  minIntervalMinutes?: number;
  includeInternal?: boolean;
};

type SyncResultRow = {
  outboundId: string;
  customerCode: string;
  carrierName: string;
  serviceName: string;
  trackingNumber: string;
  status: "synced" | "failed" | "skipped";
  trackingStatus: string;
  proofCreated: boolean;
  exceptionCreated: boolean;
  message: string;
};

function syncSecret() {
  return process.env.CARRIER_TRACKING_SYNC_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = syncSecret();
  if (!secret) return false;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return token === secret || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<SyncActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "承运商轨迹与 POD 自动同步任务" };

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

function optionsFrom(request: Request, body?: SyncBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 50;
  const minIntervalMinutes = numberFrom(body?.minIntervalMinutes) ?? numberFrom(url.searchParams.get("minIntervalMinutes")) ?? 120;
  return {
    includeInternal: body?.includeInternal ?? url.searchParams.get("includeInternal") === "1",
    limit: Math.min(200, Math.max(1, Math.floor(limit))),
    minIntervalMinutes: Math.min(24 * 60, Math.max(0, Math.floor(minIntervalMinutes))),
  };
}

function latestTrackingEvent(order: CoreOutboundOrder) {
  return [...(order.trackingEvents ?? [])].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0];
}

function hasProof(order: CoreOutboundOrder, proofUrl?: string) {
  return (order.exceptions ?? []).some((item) => item.deliveryExceptionType === "proof_uploaded" || Boolean(proofUrl && item.proofUrl === proofUrl));
}

function hasOpenDeliveryException(order: CoreOutboundOrder, exceptionType: OutboundDeliveryExceptionType) {
  return (order.exceptions ?? []).some((item) => item.deliveryExceptionType === exceptionType && (item.status === "open" || item.status === "investigating"));
}

function deliveryExceptionTypeFromTracking(detail?: string): OutboundDeliveryExceptionType {
  const text = (detail ?? "").toLowerCase();
  if (text.includes("address")) return "address_issue";
  if (text.includes("absent") || text.includes("not home") || text.includes("no answer")) return "customer_absent";
  if (text.includes("damage")) return "damaged";
  if (text.includes("lost")) return "lost";
  if (text.includes("return")) return "return_to_sender";
  if (text.includes("claim")) return "claim";
  return "delivery_failed";
}

function shouldSyncOrder(order: CoreOutboundOrder, nowMs: number, options: ReturnType<typeof optionsFrom>) {
  if (!order.trackingNumber && !order.carrierShipmentId) return false;
  if (order.carrierGatewayMode === "internal" && !options.includeInternal) return false;
  if (latestTrackingEvent(order)?.status === "delivered" && hasProof(order)) return false;

  const latest = latestTrackingEvent(order);
  if (!latest || options.minIntervalMinutes === 0) return true;
  const latestMs = new Date(latest.occurredAt).getTime();
  return !Number.isFinite(latestMs) || nowMs - latestMs >= options.minIntervalMinutes * 60_000;
}

async function syncOrder(order: CoreOutboundOrder, carrierConfigs: Awaited<ReturnType<typeof getOpsExpansionData>>["logisticsChannels"], operator: string): Promise<SyncResultRow> {
  const tracking = await fetchCarrierTrackingAndProof({ order, configs: carrierConfigs });
  if (!tracking.ok || !tracking.status) {
    return {
      outboundId: order.id,
      customerCode: order.customerCode,
      carrierName: order.carrierName ?? "",
      serviceName: order.carrierServiceName ?? "",
      trackingNumber: order.trackingNumber ?? "",
      status: "failed",
      trackingStatus: "",
      proofCreated: false,
      exceptionCreated: false,
      message: tracking.error || "承运商轨迹/POD 同步失败。",
    };
  }

  const updatedOrder = await addCoreOutboundTrackingEvent({
    id: order.id,
    status: tracking.status,
    detail: tracking.detail,
    location: tracking.location,
    trackingNumber: tracking.trackingNumber,
    carrierName: order.carrierName,
    carrierServiceName: order.carrierServiceName,
    operator,
  });
  if (!updatedOrder) {
    return {
      outboundId: order.id,
      customerCode: order.customerCode,
      carrierName: order.carrierName ?? "",
      serviceName: order.carrierServiceName ?? "",
      trackingNumber: order.trackingNumber ?? "",
      status: "failed",
      trackingStatus: tracking.status,
      proofCreated: false,
      exceptionCreated: false,
      message: "未找到出库单，无法写入轨迹。",
    };
  }

  let proofCreated = false;
  let exceptionCreated = false;
  if (tracking.status === "delivered" && tracking.proofUrl && !hasProof(updatedOrder, tracking.proofUrl)) {
    const result = await createCoreOutboundDeliveryException({
      id: updatedOrder.id,
      exceptionType: "proof_uploaded",
      message: tracking.detail || "承运商返回签收证明 POD。",
      severity: "warning",
      proofUrl: tracking.proofUrl,
      claimStatus: "not_required",
      recordTrackingEvent: false,
      operator,
    });
    proofCreated = Boolean(result.exception);
  }

  if (tracking.status === "exception") {
    const exceptionType = deliveryExceptionTypeFromTracking(tracking.detail);
    if (!hasOpenDeliveryException(updatedOrder, exceptionType)) {
      const result = await createCoreOutboundDeliveryException({
        id: updatedOrder.id,
        exceptionType,
        message: tracking.detail || "承运商返回派送异常。",
        severity: "critical",
        proofUrl: tracking.proofUrl,
        claimStatus: "draft",
        recordTrackingEvent: false,
        operator,
      });
      exceptionCreated = Boolean(result.exception);
    }
  }

  return {
    outboundId: updatedOrder.id,
    customerCode: updatedOrder.customerCode,
    carrierName: updatedOrder.carrierName ?? "",
    serviceName: updatedOrder.carrierServiceName ?? "",
    trackingNumber: updatedOrder.trackingNumber ?? "",
    status: "synced",
    trackingStatus: tracking.status,
    proofCreated,
    exceptionCreated,
    message: tracking.detail || "承运商轨迹/POD 已同步。",
  };
}

async function runSync(request: Request, body?: SyncBody) {
  const rate = checkRateLimit(rateLimitKey(request, "carrier-tracking-sync-due"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "承运商轨迹/POD 批量同步过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的承运商轨迹/POD 同步请求。" }, { status: 401 });

  const options = optionsFrom(request, body);
  const [coreData, expansionData] = await Promise.all([getWarehouseCoreData(), getOpsExpansionData()]);
  const nowMs = Date.now();
  const orders = coreData.outboundOrders
    .filter((order) => shouldSyncOrder(order, nowMs, options))
    .sort((left, right) => {
      const leftTime = latestTrackingEvent(left)?.occurredAt || left.updatedAt || left.createdAt;
      const rightTime = latestTrackingEvent(right)?.occurredAt || right.updatedAt || right.createdAt;
      return new Date(leftTime).getTime() - new Date(rightTime).getTime();
    })
    .slice(0, options.limit);

  const results: SyncResultRow[] = [];
  for (const order of orders) results.push(await syncOrder(order, expansionData.logisticsChannels, actor.actorName));

  const summary = {
    limit: options.limit,
    attempted: results.length,
    synced: results.filter((item) => item.status === "synced").length,
    failed: results.filter((item) => item.status === "failed").length,
    proofs: results.filter((item) => item.proofCreated).length,
    exceptions: results.filter((item) => item.exceptionCreated).length,
  };

  await recordAuditLog({
    action: "carrier_tracking_sync_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "outbound",
    targetId: "carrier-tracking-due",
    summary: "批量同步承运商轨迹/POD",
    note: `限制 ${summary.limit} 条，尝试 ${summary.attempted} 条，成功 ${summary.synced} 条，失败 ${summary.failed} 条，签收证明 ${summary.proofs} 条，异常 ${summary.exceptions} 条。`,
    after: { options, summary, results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), options, summary, results });
}

export async function GET(request: Request) {
  return runSync(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SyncBody;
  return runSync(request, body);
}
