import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getDocuments } from "@/lib/documentStore";
import { getSubmissions, getSubmissionsForCustomer } from "@/lib/localStore";
import { getCustomerNotifications, getNotificationDeliveries, getStaffNotifications } from "@/lib/notificationStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getOpsWorkbenchData } from "@/lib/opsStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { getSystemAlerts } from "@/lib/systemAlertStore";
import { getWarehouseCoreData, getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateActor = {
  actorRole: "staff" | "system";
  actorName: string;
};

type GenerateBody = {
  limit?: number;
  includeCustomers?: boolean;
};

function generateSecret() {
  return process.env.NOTIFICATION_GENERATE_SECRET || process.env.CRON_SECRET || "";
}

function authorizedBySecret(request: Request) {
  const secret = generateSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

async function authorize(request: Request): Promise<GenerateActor | null> {
  if (authorizedBySecret(request)) return { actorRole: "system", actorName: "通知提醒生成定时任务" };

  const cookieStore = await cookies();
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!staff) return null;
  if (staff.role !== "admin" && staff.role !== "ops") return null;
  return { actorRole: "staff", actorName: staff.displayName || staff.username };
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionsFrom(request: Request, body?: GenerateBody) {
  const url = new URL(request.url);
  const limit = numberFrom(body?.limit) ?? numberFrom(url.searchParams.get("limit")) ?? 200;
  const includeCustomers = body?.includeCustomers ?? url.searchParams.get("includeCustomers") !== "0";
  return {
    limit: Math.min(500, Math.max(1, Math.floor(limit))),
    includeCustomers,
  };
}

function uniqueCustomerCodes(coreData: Awaited<ReturnType<typeof getWarehouseCoreData>>, submissions: Awaited<ReturnType<typeof getSubmissions>>) {
  return Array.from(
    new Set(
      [
        ...coreData.customers.map((item) => item.customerCode),
        ...submissions.map((item) => item.customerCode).filter((value): value is string => Boolean(value)),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

async function generateDueNotifications(request: Request, body?: GenerateBody) {
  const rate = checkRateLimit(rateLimitKey(request, "notification-generate-due"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "通知提醒生成过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "未授权的通知提醒生成请求。" }, { status: 401 });

  const options = optionsFrom(request, body);
  const beforeDeliveries = await getNotificationDeliveries(1000);
  const beforeDeliveryIds = new Set(beforeDeliveries.map((item) => item.id));
  const [submissions, opsData, coreData, documents, expansionData, systemAlerts] = await Promise.all([getSubmissions(), getOpsWorkbenchData(), getWarehouseCoreData(), getDocuments(), getOpsExpansionData(), getSystemAlerts()]);

  const staffItems = await getStaffNotifications({
    submissions,
    opsData,
    coreData,
    documents,
    expansionData,
    workOrders: expansionData.selfServiceWorkOrders,
    systemAlerts,
  });

  const customerSummaries: Array<{ customerCode: string; itemCount: number; unreadCount: number; selfServiceDigest: number; overdueDigest: number }> = [];
  if (options.includeCustomers) {
    const customerCodes = uniqueCustomerCodes(coreData, submissions).slice(0, options.limit);
    for (const customerCode of customerCodes) {
      const [customerSubmissions, customerCoreData] = await Promise.all([getSubmissionsForCustomer(customerCode), getWarehouseCoreDataForCustomer(customerCode)]);
      const customerDocuments = documents.filter((item) => item.customerCode === customerCode);
      const customerItems = await getCustomerNotifications({
        customerCode,
        submissions: customerSubmissions,
        opsData,
        coreData: customerCoreData,
        documents: customerDocuments,
        workOrders: expansionData.selfServiceWorkOrders,
      });
      customerSummaries.push({
        customerCode,
        itemCount: customerItems.length,
        unreadCount: customerItems.filter((item) => item.unread).length,
        selfServiceDigest: customerItems.filter((item) => item.sourceId === "self-service-actions").length,
        overdueDigest: customerItems.filter((item) => item.sourceId === "self-service-actions" && item.slaLevel === "overdue").length,
      });
    }
  }

  const afterDeliveries = await getNotificationDeliveries(1000);
  const generatedDeliveries = afterDeliveries.filter((item) => !beforeDeliveryIds.has(item.id));
  const summary = {
    staffItems: staffItems.length,
    staffUnread: staffItems.filter((item) => item.unread).length,
    scannedCustomers: customerSummaries.length,
    customerItems: customerSummaries.reduce((sum, item) => sum + item.itemCount, 0),
    customerUnread: customerSummaries.reduce((sum, item) => sum + item.unreadCount, 0),
    customerSelfServiceDigest: customerSummaries.reduce((sum, item) => sum + item.selfServiceDigest, 0),
    customerSelfServiceOverdue: customerSummaries.reduce((sum, item) => sum + item.overdueDigest, 0),
    systemAlerts: staffItems.filter((item) => item.source === "system").length,
    criticalSystemAlerts: staffItems.filter((item) => item.source === "system" && item.severity === "critical").length,
    financeReviewApprovals: staffItems.filter((item) => item.source === "approval" && (item.id.includes("finance-work-order") || item.id.includes("finance-adjustment"))).length,
    financeReviewMissingAttachments: staffItems.filter((item) => item.source === "approval" && item.id.includes("finance-adjustment") && item.title.includes("attachment missing")).length,
    financeReviewOverdue: staffItems.filter((item) => item.source === "approval" && (item.id.includes("finance-work-order") || item.id.includes("finance-adjustment")) && item.slaLevel === "overdue").length,
    generated: generatedDeliveries.length,
    queued: generatedDeliveries.filter((item) => item.status === "queued").length,
    blocked: generatedDeliveries.filter((item) => item.status === "blocked").length,
  };

  await recordAuditLog({
    action: "notification_generate_due",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "notification_delivery",
    targetId: "generate-due",
    summary: "生成到期通知与 SLA 提醒",
    note: `员工待办 ${summary.staffItems} 条，财务复核/调账赔付 ${summary.financeReviewApprovals} 条，其中缺附件 ${summary.financeReviewMissingAttachments} 条、超时 ${summary.financeReviewOverdue} 条；客户待办 ${summary.customerItems} 条；新生成投递 ${summary.generated} 条。`,
    after: { options, summary, customerSummaries: customerSummaries.slice(0, 50) },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    options,
    summary,
    generatedDeliveries: generatedDeliveries.slice(0, 50),
  });
}

export async function GET(request: Request) {
  return generateDueNotifications(request);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GenerateBody;
  return generateDueNotifications(request, body);
}
