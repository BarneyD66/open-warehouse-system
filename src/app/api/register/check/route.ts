import { NextResponse } from "next/server";
import { checkCustomerAccountAvailability } from "@/lib/customerAccountStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string; email?: string };
  const result = await checkCustomerAccountAvailability({ phone: body.phone, email: body.email });
  return NextResponse.json(result);
}
