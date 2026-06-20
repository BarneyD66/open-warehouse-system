import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { generateCoreOutboundShippingLabel, getWarehouseCoreData, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetryActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type RetryResultRow = {
  outboundId: string;
  customerCode: string;
  carrierName: string;
  serviceName: string;
  status: "generated" | "failed" | "skipped";
  trackingNumber: string;
  labelUrl: string;
  retryCount: number;
  nextRetryAt: string;
  message: string;
};

function retrySecret() {
  return process.env.CARRIER_LABEL_RETRY_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = retrySecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function authorize(request: Request): Promise<RetryActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "承运商面单定时重试任务" };

  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops") return null;
  return { actorRole: "staff", actorName: staff.displayName || staff.username };
}

function limitFrom(request: Request, body?: { limit?: number }) {
  const queryLimit = Number(new URL(request.url).searchParams.get("limit"));
  const requested = Number.isFinite(body?.limit) ? Number(body?.limit) : queryLimit;
  if (!Number.isFinite(requested) || requested <= 0) return 50;
  return Math.min(200, Math.max(1, Math.floor(requested)));
}

function shouldRetryCarrierLabel(order: CoreOutboundOrder, nowMs: number) {
  if (order.status === "shipped") return false;
  if (order.labelStatus !== "failed") return false;
  if (order.labelFallbackNote) return false;
  if (!order.labelNextRetryAt) return true;
  const retryAt = new Date(order.labelNextRetryAt).getTime();
  return !Number.isFinite(retryAt) || retryAt <= nowMs;
}

async function retryOrder(order: CoreOutboundOrder, carrierConfigs: Awaited<ReturnType<typeof getOpsExpansionData>>["logisticsChannels"], operator: string): Promise<RetryResultRow> {
  const result = await generateCoreOutboundShippingLabel({
    id: order.id,
    serviceCode: order.carrierServiceCode,
    packageWeightKg: order.packageWeightKg,
    packageCount: order.packageCount,
    operator,
    carrierConfigs,
  });

  if (!result?.order) {
    return {
      outboundId: order.id,
      customerCode: order.customerCode,
      carrierName: order.carrierName ?? "",
      serviceName: order.carrierServiceName ?? "",
      status: "failed",
      trackingNumber: "",
      labelUrl: "",
      retryCount: order.labelRetryCount ?? 0,
      nextRetryAt: order.labelNextRetryAt ?? "",
      message: "未找到出库单，无法重试面单。",
    };
  }

  const nextOrder = result.order;
  return {
    outboundId: nextOrder.id,
    customerCode: nextOrder.customerCode,
    carrierName: nextOrder.carrierName ?? "",
    serviceName: nextOrder.carrierServiceName ?? "",
    status: nextOrder.labelStatus === "generated" ? "generated" : "failed",
    trackingNumber: nextOrder.trackingNumber ?? "",
    labelUrl: nextOrder.labelUrl ?? "",
    retryCount: nextOrder.labelRetryCount ?? 0,
    nextRetryAt: nextOrder.labelNextRetryAt ?? "",
    message: nextOrder.labelStatus === "generated" ? "承运商面单已重新生成。" : nextOrder.labelFailureReason || "承运商面单重试失败。",
  };
}

async function runRetry(request: Request, body?: { limit?: number }) {
  const rate = checkRateLimit(rateLimitKey(request, "carrier-label-retry-due"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "承运商面单批量重试过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的承运商面单重试请求。" }, { status: 401 });

  const limit = limitFrom(request, body);
  const [coreData, expansionData] = await Promise.all([getWarehouseCoreData(), getOpsExpansionData()]);
  const nowMs = Date.now();
  const retryOrders = coreData.outboundOrders
    .filter((order) => shouldRetryCarrierLabel(order, nowMs))
    .sort((left, right) => new Date(left.labelNextRetryAt || left.updatedAt || left.createdAt).getTime() - new Date(right.labelNextRetryAt || right.updatedAt || right.createdAt).getTime())
    .slice(0, limit);

  const results: RetryResultRow[] = [];
  for (const order of retryOrders) {
    results.push(await retryOrder(order, expansionData.logisticsChannels, actor.actorName));
  }

  const summary = {
    limit,
    attempted: results.length,
    generated: results.filter((item) => item.status === "generated").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
  };

  await recordAuditLog({
    action: "carrier_label_retry_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "outbound",
    targetId: "carrier-label-due",
    summary: "批量重试到期承运商面单",
    note: `限制 ${summary.limit} 条，尝试 ${summary.attempted} 条，成功 ${summary.generated} 条，失败 ${summary.failed} 条。`,
    after: { summary, results },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, results });
}

export async function GET(request: Request) {
  return withApiErrorCapture(request, "/api/ops/carrier-labels/retry-due", () => runRetry(request));
}

export async function POST(request: Request) {
  return withApiErrorCapture(request, "/api/ops/carrier-labels/retry-due", async () => {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    return runRetry(request, body);
  });
}
