import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { recordAuditLog } from "@/lib/auditLogStore";
import { reviewWarehouseLocationRisks } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type ReviewBody = {
  limit?: number;
  occupancyWarningRate?: number;
};

function reviewSecret() {
  return process.env.WAREHOUSE_LOCATION_RISK_REVIEW_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = reviewSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<ReviewActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "库位风险巡检定时任务" };

  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops" && staff.role !== "warehouse") return null;
  return { actorRole: "staff", actorName: staff.displayName || staff.username };
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionsFrom(request: Request, body?: ReviewBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 100;
  const occupancyWarningRate = numberFrom(body?.occupancyWarningRate) ?? numberFrom(url.searchParams.get("occupancyWarningRate")) ?? 0.9;
  return {
    limit: Math.min(200, Math.max(1, Math.floor(limit))),
    occupancyWarningRate: Math.min(1, Math.max(0.5, occupancyWarningRate)),
  };
}

async function runReview(request: Request, body?: ReviewBody) {
  const rate = checkRateLimit(rateLimitKey(request, "warehouse-location-risk-review"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "库位风险巡检过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的库位风险巡检请求。" }, { status: 401 });

  const options = optionsFrom(request, body);
  const result = await reviewWarehouseLocationRisks({ operator: actor.actorName, ...options });
  const summary = {
    limit: result.limit,
    occupancyWarningRate: result.occupancyWarningRate,
    scannedLocations: result.scannedLocations,
    reviewed: result.reviewed,
    highRisk: result.highRisk,
    workOrders: result.workOrders,
    alreadyHandled: result.alreadyHandled,
  };

  await recordAuditLog({
    action: "warehouse_location_risk_review_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "warehouse_location",
    targetId: "warehouse-location-risk-review",
    summary: "批量巡检库位容量与规则风险",
    note: `扫描 ${summary.scannedLocations} 个库位，复核 ${summary.reviewed} 个，高风险 ${summary.highRisk} 个，工单 ${summary.workOrders} 个。`,
    after: { summary, results: result.results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, results: result.results });
}

export async function GET(request: Request) {
  return withApiErrorCapture(request, "/api/ops/warehouse/locations/risk-review", () => runReview(request));
}

export async function POST(request: Request) {
  return withApiErrorCapture(request, "/api/ops/warehouse/locations/risk-review", async () => {
    const body = (await request.json().catch(() => ({}))) as ReviewBody;
    return runReview(request, body);
  });
}
