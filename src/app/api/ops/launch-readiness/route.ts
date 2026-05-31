import { NextResponse } from "next/server";
import { evaluateLaunchReadiness } from "@/lib/launchReadiness";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireStaffSession();
  const readiness = await evaluateLaunchReadiness();
  return NextResponse.json({ readiness });
}
