import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { generateCoreOutboundShippingLabel, rateCoreOutboundShipment, reconcileCoreOutboundShippingFee, type CarrierServiceCode } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const carrierServices = new Set(["royal_mail_24", "royal_mail_48", "dpd_next_day", "evri_standard", "manual"]);

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "rate" | "generate_label" | "reconcile_fee";
    serviceCode?: CarrierServiceCode;
    packageWeightKg?: number;
    packageCount?: number;
    actualShippingFee?: number;
    note?: string;
  };

  if (body.serviceCode && !carrierServices.has(body.serviceCode)) {
    return NextResponse.json({ error: "不支持的承运商服务" }, { status: 400 });
  }

  if (body.action === "reconcile_fee") {
    const actualShippingFee = numberValue(body.actualShippingFee);
    if (typeof actualShippingFee !== "number") return NextResponse.json({ error: "请填写实际运费" }, { status: 400 });
    const order = await reconcileCoreOutboundShippingFee({
      id: decodeURIComponent(id),
      actualShippingFee,
      note: body.note,
      operator: staff.displayName || staff.username,
    });
    if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });
    return NextResponse.json({ order });
  }

  const payload = {
    id: decodeURIComponent(id),
    serviceCode: body.serviceCode,
    packageWeightKg: numberValue(body.packageWeightKg),
    packageCount: numberValue(body.packageCount),
    operator: staff.displayName || staff.username,
  };

  const result = body.action === "generate_label" ? await generateCoreOutboundShippingLabel(payload) : await rateCoreOutboundShipment(payload);
  if (!result) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

  return NextResponse.json(result);
}
