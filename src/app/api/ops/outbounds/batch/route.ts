import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { batchUpdateCoreOutboundOrderStatus, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const outboundStatuses = new Set(["pending_review", "picking", "label_pending", "packing_check", "handover", "shipped", "blocked"]);

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
    status?: CoreOutboundOrder["status"];
    note?: string;
  };

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "请选择需要批量处理的出库申请" }, { status: 400 });
  }

  if (!body.status || !outboundStatuses.has(body.status)) {
    return NextResponse.json({ error: "不支持的出库状态" }, { status: 400 });
  }

  const result = await batchUpdateCoreOutboundOrderStatus({
    ids: body.ids,
    status: body.status,
    note: body.note,
    operator: staff.displayName || staff.username,
  });

  return NextResponse.json({
    updated: result.updated.length,
    missing: result.missing,
  });
}
