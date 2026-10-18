import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getIntegrationProbeRecords, runIntegrationProbe } from "@/lib/integrationProbeStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireStaffSession();
  const probes = await getIntegrationProbeRecords(200);
  return NextResponse.json({ probes });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-integration-probe"), 12, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "集成探测调用过于频繁，请稍后再试" }, { status: 429 });
  const staff = await requireStaffSession();
  if (staff.role !== "admin" && staff.role !== "ops") return NextResponse.json({ error: "当前角色无权执行集成联调探测" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { itemId?: string };
  const itemId = body.itemId?.trim();
  if (!itemId) return NextResponse.json({ error: "缺少集成配置项编号" }, { status: 400 });
  const result = await runIntegrationProbe(itemId, staff.displayName || staff.username);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditLog({
    action: "integration_probe",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "system",
    targetId: itemId,
    summary: `集成联调探测：${result.record?.status}`,
    note: result.record?.message,
    after: result.record,
  });

  return NextResponse.json({ probe: result.record });
}
