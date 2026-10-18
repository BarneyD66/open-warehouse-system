import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { getCarrierRateRules } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

export async function GET() {
  await requireStaffSession();
  return NextResponse.json({ rates: getCarrierRateRules() });
}
