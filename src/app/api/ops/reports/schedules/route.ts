import { NextResponse } from "next/server";
import { getOpsExpansionData, upsertReportSchedule } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

const cadences = new Set(["daily", "weekly", "monthly"]);
const statuses = new Set(["active", "paused", "archived"]);

export async function GET() {
  await requireStaffSession();
  const data = await getOpsExpansionData();
  return NextResponse.json({ schedules: data.reportSchedules, views: data.savedViews });
}

export async function POST(request: Request) {
  await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    viewId?: string;
    name?: string;
    cadence?: "daily" | "weekly" | "monthly";
    recipients?: string[];
    status?: "active" | "paused" | "archived";
  };
  if (!body.viewId) return NextResponse.json({ error: "请选择保存视图" }, { status: 400 });
  if (!body.cadence || !cadences.has(body.cadence)) return NextResponse.json({ error: "请选择发送频率" }, { status: 400 });
  if (body.status && !statuses.has(body.status)) return NextResponse.json({ error: "定时报表状态不正确" }, { status: 400 });
  const result = await upsertReportSchedule({
    id: body.id,
    viewId: body.viewId,
    name: body.name || "",
    cadence: body.cadence,
    recipients: body.recipients ?? [],
    status: body.status ?? "active",
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ schedule: result.schedule });
}
