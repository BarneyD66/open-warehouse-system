import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { getWarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeProofUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const customer = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!customer && !staff) return NextResponse.json({ error: "请先登录后再查看签收证明。" }, { status: 401 });

  const { id } = await params;
  const data = await getWarehouseCoreData();
  const order = data.outboundOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ error: "未找到出库单。" }, { status: 404 });
  if (customer && order.customerCode !== customer.customerCode) return NextResponse.json({ error: "当前账号无权查看该签收证明。" }, { status: 403 });

  const proofException = order.exceptions?.find((item) => item.proofUrl);
  const proofUrl = safeProofUrl(proofException?.proofUrl);
  const delivered = order.trackingEvents?.find((event) => event.status === "delivered");
  if (!proofUrl) {
    return NextResponse.json(
      {
        error: delivered ? "该订单已签收，但暂未关联可下载的签收证明。" : "该订单暂未签收，或承运商尚未回传签收证明。",
        outboundId: order.id,
        trackingNumber: order.trackingNumber ?? "",
        deliveredAt: delivered?.occurredAt ?? "",
      },
      { status: 404 },
    );
  }

  const response = NextResponse.redirect(proofUrl, { status: 302 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
