import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { updateCoreOutboundOrderStatus, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const outboundStatuses = new Set(["pending_review", "picking", "label_pending", "packing_check", "handover", "shipped", "blocked"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: CoreOutboundOrder["status"];
    note?: string;
  };

  if (!body.status || !outboundStatuses.has(body.status)) {
    return NextResponse.json({ error: "不支持的出库状态" }, { status: 400 });
  }

  const order = await updateCoreOutboundOrderStatus({
    id,
    status: body.status,
    note: body.note,
    operator: staff.displayName || staff.username,
  });

  if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });
  return NextResponse.json({ order });
}
