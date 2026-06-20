import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData, updateReportScheduleDelivery, type ReportScheduleConfig, type SavedReportView } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryResult = {
  scheduleId: string;
  scheduleName: string;
  viewName: string;
  status: "sent" | "skipped" | "failed";
  note: string;
  downloadUrl: string;
  recipients: string[];
};

function scheduleSecret() {
  return process.env.REPORT_SCHEDULE_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = scheduleSecret();
  if (!secret) return false;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return token === secret || request.headers.get("x-report-schedule-secret") === secret || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request, expansionData: Awaited<ReturnType<typeof getOpsExpansionData>>) {
  if (authorizedBySecret(request)) return { ok: true, actorName: "系统定时任务", source: "secret" as const };
  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return { ok: false, actorName: "", source: "staff" as const };
  if (!canAccessOpsModule(staff, "reports", expansionData)) return { ok: false, actorName: staff.displayName || staff.username, source: "staff" as const };
  return { ok: true, actorName: staff.displayName || staff.username, source: "staff" as const };
}

function cadenceDue(schedule: ReportScheduleConfig, timestamp: Date) {
  if (schedule.status !== "active") return false;
  if (!schedule.lastSentAt) return true;
  const last = new Date(schedule.lastSentAt);
  if (!Number.isFinite(last.getTime())) return true;
  const elapsed = timestamp.getTime() - last.getTime();
  if (schedule.cadence === "daily") return elapsed >= 23 * 60 * 60 * 1000;
  if (schedule.cadence === "weekly") return elapsed >= 6.5 * 24 * 60 * 60 * 1000;
  return timestamp.getFullYear() !== last.getFullYear() || timestamp.getMonth() !== last.getMonth();
}

function reportDownloadUrlForView(request: Request, view: SavedReportView) {
  const params = new URLSearchParams();
  Object.entries(view.filters ?? {}).forEach(([key, value]) => {
    const cleanKey = key.trim();
    const cleanValue = String(value ?? "").trim();
    if (cleanKey && cleanValue) params.set(cleanKey, cleanValue);
  });
  params.set("auditSource", "scheduled_report");

  if (view.module === "warehouse") return new URL(`/api/ops/reports/inventory?${params.toString()}`, request.url).toString();
  if (view.module === "charge_events") return new URL(`/api/ops/reports/charge-events?${params.toString()}`, request.url).toString();
  if (view.module === "automation_runs") return new URL(`/api/ops/reports/automation-runs?${params.toString()}`, request.url).toString();
  if (view.module === "billing_aging") return new URL(`/api/ops/reports/billing-aging?${params.toString()}`, request.url).toString();
  if (view.module === "payment_review") return new URL(`/api/ops/reports/payment-review?${params.toString()}`, request.url).toString();
  if (view.module === "payment_reconciliation") return new URL(`/api/ops/reports/payment-reconciliation?${params.toString()}`, request.url).toString();
  if (view.module === "finance_adjustments") return new URL(`/api/ops/reports/finance-adjustments?${params.toString()}`, request.url).toString();
  if (view.module === "returns") return new URL(`/api/ops/reports/returns?${params.toString()}`, request.url).toString();
  if (view.module === "exceptions") return new URL(`/api/ops/reports/exceptions?${params.toString()}`, request.url).toString();
  if (view.module === "scans") return new URL(`/api/ops/reports/scans?${params.toString()}`, request.url).toString();
  if (view.module === "locations") return new URL(`/api/ops/reports/locations?${params.toString()}`, request.url).toString();
  if (view.module === "inventory_lots") return new URL(`/api/ops/reports/inventory-lots?${params.toString()}`, request.url).toString();
  if (view.module === "outbound_lot_allocation") return new URL(`/api/ops/reports/outbound-lot-allocation?${params.toString()}`, request.url).toString();
  if (view.module === "data_quality") return new URL(`/api/ops/reports/data-quality?${params.toString()}`, request.url).toString();
  if (view.module === "profit") return new URL(`/api/ops/reports/profit?${params.toString()}`, request.url).toString();
  if (view.module === "staff_performance") return new URL(`/api/ops/reports/staff-performance?${params.toString()}`, request.url).toString();
  if (view.module === "outbound_review") return new URL(`/api/ops/reports/outbound-review?${params.toString()}`, request.url).toString();
  if (view.module === "pick_waves") return new URL(`/api/ops/reports/pick-waves?${params.toString()}`, request.url).toString();
  if (view.module === "customer_credit") return new URL(`/api/ops/reports/customer-credit?${params.toString()}`, request.url).toString();
  if (view.module === "carrier_labels") return new URL(`/api/ops/reports/carrier-labels?${params.toString()}`, request.url).toString();
  if (view.module === "carrier_claims") return new URL(`/api/ops/reports/carrier-claims?${params.toString()}`, request.url).toString();
  if (view.module === "platform_sync") return new URL(`/api/ops/reports/platform-sync?${params.toString()}`, request.url).toString();
  if (view.module === "notification_deliveries") return new URL(`/api/ops/reports/notification-deliveries?${params.toString()}`, request.url).toString();
  if (view.module === "customer_self_service") return new URL(`/api/ops/reports/customer-self-service?${params.toString()}`, request.url).toString();
  if (view.module === "documents_security") return new URL(`/api/ops/reports/documents-security?${params.toString()}`, request.url).toString();

  const reportModule = view.module === "orders" ? "outbound" : view.module;
  params.set("module", reportModule);
  return new URL(`/api/ops/reports/sla?${params.toString()}`, request.url).toString();
}

async function deliverReport(input: { schedule: ReportScheduleConfig; view: SavedReportView; downloadUrl: string; generatedAt: string }) {
  const endpoint = process.env.REPORT_DELIVERY_WEBHOOK_URL;
  const token = process.env.REPORT_DELIVERY_TOKEN;
  if (!endpoint) return { status: "skipped" as const, note: "未配置 REPORT_DELIVERY_WEBHOOK_URL，仅生成待发送下载链接。" };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      scheduleId: input.schedule.id,
      scheduleName: input.schedule.name,
      cadence: input.schedule.cadence,
      recipients: input.schedule.recipients,
      view: input.view,
      downloadUrl: input.downloadUrl,
      generatedAt: input.generatedAt,
    }),
  }).catch((error: unknown) => ({ ok: false, status: 0, statusText: error instanceof Error ? error.message : "网络异常" }));
  if (!response.ok) return { status: "failed" as const, note: `投递 webhook 失败：${response.status} ${response.statusText}` };
  return { status: "sent" as const, note: "已提交到报表投递 webhook。" };
}

async function runSchedules(request: Request, body?: { force?: boolean; scheduleId?: string }) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-report-schedule-run"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "定时报表执行过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const expansionData = await getOpsExpansionData();
  const auth = await authorize(request, expansionData);
  if (!auth.ok) return NextResponse.json({ error: "当前账号无权执行定时报表。" }, { status: 403 });

  const timestamp = new Date();
  const generatedAt = timestamp.toISOString();
  const schedules = expansionData.reportSchedules.filter((schedule) => (!body?.scheduleId || schedule.id === body.scheduleId) && (body?.force || cadenceDue(schedule, timestamp)));
  const results: DeliveryResult[] = [];

  for (const schedule of schedules) {
    const view = expansionData.savedViews.find((item) => item.id === schedule.viewId);
    if (!view) {
      await updateReportScheduleDelivery({
        id: schedule.id,
        lastRunAt: generatedAt,
        lastDeliveryStatus: "failed",
        lastDeliveryNote: "保存视图不存在，无法生成定时报表。",
      });
      results.push({ scheduleId: schedule.id, scheduleName: schedule.name, viewName: "视图不存在", status: "failed", note: "保存视图不存在，无法生成定时报表。", downloadUrl: "", recipients: schedule.recipients });
      continue;
    }

    const downloadUrl = reportDownloadUrlForView(request, view);
    const delivery = await deliverReport({ schedule, view, downloadUrl, generatedAt });
    await updateReportScheduleDelivery({
      id: schedule.id,
      lastRunAt: generatedAt,
      lastSentAt: delivery.status === "sent" ? generatedAt : undefined,
      lastDeliveryStatus: delivery.status,
      lastDeliveryNote: delivery.note,
    });
    results.push({ scheduleId: schedule.id, scheduleName: schedule.name, viewName: view.name, status: delivery.status, note: delivery.note, downloadUrl, recipients: schedule.recipients });
  }

  await recordAuditLog({
    action: "report_export",
    actorRole: auth.source === "secret" ? "system" : "staff",
    actorName: auth.actorName,
    targetType: "report",
    targetId: "scheduled-reports",
    summary: "执行定时报表发送任务",
    note: `执行 ${results.length} 个定时报表；来源：${auth.source}。`,
    after: { force: Boolean(body?.force), scheduleId: body?.scheduleId ?? "", results },
  });

  return NextResponse.json({
    generatedAt,
    total: results.length,
    sent: results.filter((item) => item.status === "sent").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return runSchedules(request, {
    force: url.searchParams.get("force") === "1",
    scheduleId: url.searchParams.get("scheduleId") || undefined,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { force?: boolean; scheduleId?: string };
  return runSchedules(request, body);
}
