import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { getSystemAlerts, updateSystemAlertState, type SystemAlertHandlingStatus } from "@/lib/systemAlertStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireStaffSession();
  const alerts = await getSystemAlerts();
  return NextResponse.json({
    alerts,
    summary: {
      total: alerts.length,
      critical: alerts.filter((item) => item.severity === "critical").length,
      warning: alerts.filter((item) => item.severity === "warning").length,
    },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const statusByAction: Record<string, SystemAlertHandlingStatus> = {
  acknowledge: "acknowledged",
  snooze: "snoozed",
  resolve: "resolved",
  reopen: "open",
};

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action);
  const id = clean(body.id);
  const status = statusByAction[action];
  if (!status) return NextResponse.json({ error: "不支持的告警处理动作" }, { status: 400 });

  const result = await updateSystemAlertState({
    id,
    status,
    note: clean(body.note),
    handledBy: staff.displayName || staff.username,
    snoozeHours: Number(body.snoozeHours) || undefined,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditLog({
    action: "system_alert_update",
    actorRole: "staff",
    actorName: `${staff.displayName || staff.username} / ${staff.role}`,
    targetType: "system",
    targetId: id,
    summary: `系统告警已更新为 ${status}`,
    note: clean(body.note),
    after: result.state,
  });

  const alerts = await getSystemAlerts({ includeHandled: true });
  return NextResponse.json({ state: result.state, alerts });
}
