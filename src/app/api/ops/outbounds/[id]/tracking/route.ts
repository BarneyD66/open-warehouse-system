import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { addCoreOutboundTrackingEvent, type OutboundTrackingEvent } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const trackingStatuses = new Set(["label_created", "warehouse_processing", "carrier_handover", "in_transit", "out_for_delivery", "delivered", "exception"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: OutboundTrackingEvent["status"];
    detail?: string;
    location?: string;
    trackingNumber?: string;
    carrierName?: string;
    carrierServiceName?: string;
  };

  if (!body.status || !trackingStatuses.has(body.status)) {
    return NextResponse.json({ error: "不支持的物流轨迹状态" }, { status: 400 });
  }

  const order = await addCoreOutboundTrackingEvent({
    id: decodeURIComponent(id),
    status: body.status,
    detail: body.detail,
    location: body.location,
    trackingNumber: body.trackingNumber,
    carrierName: body.carrierName,
    carrierServiceName: body.carrierServiceName,
    operator: staff.displayName || staff.username,
  });

  if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });
  return NextResponse.json({ order });
}
