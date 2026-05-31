import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { batchMatchCoreOutboundCarriers } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
  };

  const result = await batchMatchCoreOutboundCarriers({
    ids: Array.isArray(body.ids) ? body.ids : undefined,
    operator: staff.displayName || staff.username,
  });

  return NextResponse.json(result);
}
