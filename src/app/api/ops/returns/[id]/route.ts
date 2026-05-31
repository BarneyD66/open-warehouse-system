import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { updateReturnOrderStatus, type ReturnOrderStatus, type ReturnResolution } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const returnStatuses = new Set<ReturnOrderStatus>(["requested", "label_sent", "in_transit", "received", "inspection", "restocked", "repair", "disposed", "closed", "exception"]);
const resolutions = new Set<ReturnResolution>(["restock", "repair", "dispose", "reship"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = clean(body.status) as ReturnOrderStatus;
  const resolution = clean(body.resolution) as ReturnResolution;

  if (!returnStatuses.has(status)) return NextResponse.json({ error: "不支持的退货状态" }, { status: 400 });
  if (resolution && !resolutions.has(resolution)) return NextResponse.json({ error: "不支持的退货处理方式" }, { status: 400 });

  const order = await updateReturnOrderStatus({
    id,
    status,
    resolution: resolution || undefined,
    inspectionResult: clean(body.inspectionResult),
    locationCode: clean(body.locationCode),
    opsNote: clean(body.opsNote),
    operator: staff.displayName || staff.username,
  });

  if (!order) return NextResponse.json({ error: "未找到退货单" }, { status: 404 });
  return NextResponse.json({ order });
}
