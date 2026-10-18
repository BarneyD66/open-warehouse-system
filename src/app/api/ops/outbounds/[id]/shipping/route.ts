import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { recordAuditLog } from "@/lib/auditLogStore";
import { fetchCarrierTrackingAndProof } from "@/lib/carrierGateway";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { pushPlatformFulfillment } from "@/lib/platformGateway";
import { requireStaffSession } from "@/lib/staffAuth";
import {
  addCoreOutboundTrackingEvent,
  cancelCoreOutboundShippingLabel,
  createCoreOutboundDeliveryException,
  fallbackCoreOutboundShippingLabel,
  generateCoreOutboundShippingLabel,
  getWarehouseCoreData,
  rateCoreOutboundShipment,
  reconcileCoreOutboundShippingFee,
  updateCoreOutboundPlatformFulfillment,
  type CarrierServiceCode,
  type CoreOutboundOrder,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const carrierServices = new Set(["royal_mail_24", "royal_mail_48", "dpd_next_day", "evri_standard", "manual"]);

async function recordShippingAudit(input: {
  actorName: string;
  orderId: string;
  customerCode?: string;
  summary: string;
  note?: string;
  before?: CoreOutboundOrder;
  after?: unknown;
}) {
  await recordAuditLog({
    action: "outbound_shipping_label_update",
    actorRole: "staff",
    actorName: input.actorName,
    targetType: "outbound",
    targetId: input.orderId,
    customerCode: input.customerCode,
    summary: input.summary,
    note: input.note,
    before: input.before,
    after: input.after,
  });
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function retryPlatformFulfillment(input: {
  order: CoreOutboundOrder;
  platformConnections: Awaited<ReturnType<typeof getOpsExpansionData>>["platformConnections"];
}) {
  const { order, platformConnections } = input;
  if (!order.platform || !order.platformOrderNo) {
    await updateCoreOutboundPlatformFulfillment({ id: order.id, status: "not_required" });
    return { ok: true, skipped: true, note: "该出库单没有平台订单号，无需回传发货追踪号。" };
  }
  if (!order.trackingNumber) {
    const error = "缺少追踪号，无法回传平台发货状态。";
    await updateCoreOutboundPlatformFulfillment({ id: order.id, status: "failed", error });
    return { ok: false, skipped: false, error };
  }
  const connection = platformConnections.find(
    (item) => item.platform === order.platform && item.customerCode === order.customerCode && (!order.platformStoreName || item.storeName === order.platformStoreName),
  );
  if (!connection) {
    const error = "未找到匹配的平台连接，请先在订单导入与平台对接中配置店铺连接。";
    await updateCoreOutboundPlatformFulfillment({ id: order.id, status: "failed", error });
    return { ok: false, skipped: false, error };
  }

  const fulfillment = await pushPlatformFulfillment({
    connection,
    orderNo: order.platformOrderNo,
    outboundId: order.id,
    trackingNumber: order.trackingNumber,
    carrierName: order.carrierName,
    carrierServiceName: order.carrierServiceName,
  });
  await updateCoreOutboundPlatformFulfillment({ id: order.id, status: fulfillment.ok ? "synced" : "failed", error: fulfillment.error });
  return fulfillment.ok ? { ok: true, skipped: false, raw: fulfillment.raw } : { ok: false, skipped: false, error: fulfillment.error || "平台发货回传失败。", raw: fulfillment.raw };
}

async function handlePost(request: Request, orderId: string) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  const actorName = staff.displayName || staff.username;
  const beforeOrder = (await getWarehouseCoreData()).outboundOrders.find((item) => item.id === orderId);
  const body = (await request.json().catch(() => ({}))) as {
    action?: "rate" | "generate_label" | "reconcile_fee" | "cancel_label" | "manual_label" | "retry_fulfillment" | "sync_tracking";
    serviceCode?: CarrierServiceCode;
    packageWeightKg?: number;
    packageCount?: number;
    actualShippingFee?: number;
    note?: string;
  };

  if (body.serviceCode && !carrierServices.has(body.serviceCode)) {
    return NextResponse.json({ error: "不支持的承运商服务。" }, { status: 400 });
  }

  if (body.action === "reconcile_fee") {
    const actualShippingFee = numberValue(body.actualShippingFee);
    if (typeof actualShippingFee !== "number") return NextResponse.json({ error: "请填写实际运费。" }, { status: 400 });
    const order = await reconcileCoreOutboundShippingFee({
      id: orderId,
      actualShippingFee,
      note: body.note,
      operator: actorName,
    });
    if (!order) return NextResponse.json({ error: "未找到出库单。" }, { status: 404 });
    await recordShippingAudit({
      actorName,
      orderId,
      customerCode: order.customerCode,
      summary: "核对出库实际运费",
      note: body.note,
      before: beforeOrder,
      after: order,
    });
    return NextResponse.json({ order });
  }

  if (body.action === "cancel_label") {
    const result = await cancelCoreOutboundShippingLabel({
      id: orderId,
      operator: actorName,
      carrierConfigs: expansionData.logisticsChannels,
      reason: body.note,
    });
    if (!result.order) return NextResponse.json({ error: result.error || "未找到出库单。" }, { status: 404 });
    await recordShippingAudit({
      actorName,
      orderId,
      customerCode: result.order.customerCode,
      summary: result.error ? "取消承运商面单失败" : "取消承运商面单",
      note: result.error || body.note,
      before: beforeOrder,
      after: { order: result.order, gateway: result.gateway },
    });
    if (result.error) return NextResponse.json({ error: result.error, order: result.order, gateway: result.gateway }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "manual_label") {
    const result = await fallbackCoreOutboundShippingLabel({
      id: orderId,
      operator: actorName,
      reason: body.note,
    });
    if (result.order) {
      await recordShippingAudit({
        actorName,
        orderId,
        customerCode: result.order.customerCode,
        summary: "转为内部/人工面单",
        note: body.note,
        before: beforeOrder,
        after: result,
      });
    }
    if (!result.order) return NextResponse.json({ error: result.error || "未找到出库单。" }, { status: 404 });
    return NextResponse.json(result);
  }

  if (body.action === "retry_fulfillment") {
    const coreData = await getWarehouseCoreData();
    const order = coreData.outboundOrders.find((item) => item.id === orderId);
    if (!order) return NextResponse.json({ error: "未找到出库单。" }, { status: 404 });
    const fulfillment = await retryPlatformFulfillment({ order, platformConnections: expansionData.platformConnections });
    await recordShippingAudit({
      actorName,
      orderId,
      customerCode: order.customerCode,
      summary: fulfillment.ok ? "重试平台发货追踪号回传" : "平台发货追踪号回传失败",
      note: fulfillment.ok ? undefined : fulfillment.error,
      before: beforeOrder,
      after: { order, fulfillment },
    });
    if (!fulfillment.ok) return NextResponse.json({ error: fulfillment.error, fulfillment, order }, { status: 400 });
    return NextResponse.json({ fulfillment, order });
  }

  if (body.action === "sync_tracking") {
    const coreData = await getWarehouseCoreData();
    const order = coreData.outboundOrders.find((item) => item.id === orderId);
    if (!order) return NextResponse.json({ error: "未找到出库单。" }, { status: 404 });
    const tracking = await fetchCarrierTrackingAndProof({ order, configs: expansionData.logisticsChannels });
    if (!tracking.ok || !tracking.status) {
      await recordShippingAudit({
        actorName,
        orderId,
        customerCode: order.customerCode,
        summary: "主动同步承运商轨迹/POD 失败",
        note: tracking.error,
        before: beforeOrder,
        after: { tracking },
      });
      return NextResponse.json({ error: tracking.error || "承运商轨迹/POD 同步失败。", tracking, order }, { status: 400 });
    }
    const updatedOrder = await addCoreOutboundTrackingEvent({
      id: order.id,
      status: tracking.status,
      detail: tracking.detail,
      location: tracking.location,
      trackingNumber: tracking.trackingNumber,
      carrierName: order.carrierName,
      carrierServiceName: order.carrierServiceName,
      operator: actorName,
    });
    let proofException: unknown = null;
    if (tracking.status === "delivered" && tracking.proofUrl && !order.exceptions?.some((item) => item.proofUrl === tracking.proofUrl || item.deliveryExceptionType === "proof_uploaded")) {
      const result = await createCoreOutboundDeliveryException({
        id: order.id,
        exceptionType: "proof_uploaded",
        message: tracking.detail || "承运商返回签收证明/POD。",
        severity: "warning",
        proofUrl: tracking.proofUrl,
        claimStatus: "not_required",
        recordTrackingEvent: false,
        operator: actorName,
      });
      proofException = result.exception;
    }
    await recordShippingAudit({
      actorName,
      orderId,
      customerCode: order.customerCode,
      summary: "主动同步承运商轨迹/POD",
      note: tracking.proofUrl ? "已同步轨迹并关联签收证明。" : tracking.detail,
      before: beforeOrder,
      after: { order: updatedOrder, tracking, proofException },
    });
    return NextResponse.json({ order: updatedOrder, tracking, proofException });
  }

  const payload = {
    id: orderId,
    serviceCode: body.serviceCode,
    packageWeightKg: numberValue(body.packageWeightKg),
    packageCount: numberValue(body.packageCount),
    operator: actorName,
    carrierConfigs: expansionData.logisticsChannels,
  };

  const result = body.action === "generate_label" ? await generateCoreOutboundShippingLabel(payload) : await rateCoreOutboundShipment(payload);
  if (!result) return NextResponse.json({ error: "未找到出库单。" }, { status: 404 });

  if (body.action === "generate_label" && result.order.platform && result.order.platformOrderNo && result.order.trackingNumber) {
    await retryPlatformFulfillment({ order: result.order, platformConnections: expansionData.platformConnections });
  }

  await recordShippingAudit({
    actorName,
    orderId,
    customerCode: result.order.customerCode,
    summary: body.action === "generate_label" ? "生成承运商面单" : "试算出库运费",
    note: result.rate?.warning,
    before: beforeOrder,
    after: result,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = decodeURIComponent(id);
  return withApiErrorCapture(request, "/api/ops/outbounds/[id]/shipping", () => handlePost(request, orderId), { refId: orderId });
}
