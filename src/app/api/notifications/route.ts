import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseCustomerSession } from "@/lib/customerAuth";
import { getCustomerNotifications, getNotificationSubscriptions, getStaffNotifications, dismissNotification, markNotificationRead, markNotificationsRead, upsertNotificationSubscription, type NotificationChannel, type NotificationSeverity, type NotificationSource } from "@/lib/notificationStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { getDocuments } from "@/lib/documentStore";
import { getSubmissions, getSubmissionsForCustomer } from "@/lib/localStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getOpsWorkbenchData } from "@/lib/opsStore";
import { getWarehouseCoreData, getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function normalizeChannels(value: unknown): NotificationChannel[] {
  const raw = Array.isArray(value) ? value : [];
  const channels = raw
    .map((item) => {
      const text = String(item).trim().toLowerCase();
      if (text === "in_app" || text === "\u7ad9\u5185\u4fe1" || text === "\u7ad9\u5167\u4fe1") return "in_app";
      if (text === "email" || text === "\u90ae\u4ef6" || text === "\u90f5\u4ef6") return "email";
      if (text === "sms" || text === "\u77ed\u4fe1") return "sms";
      if (text === "wechat" || text === "\u5fae\u4fe1") return "wechat";
      return "";
    })
    .filter((item): item is NotificationChannel => Boolean(item));
  return channels.length > 0 ? channels : ["in_app"];
}

export async function GET() {
  const cookieStore = await cookies();
  const customerSession = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staffSession = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!customerSession && !staffSession) return NextResponse.json({ error: "login required" }, { status: 401 });

  if (customerSession) {
    const [submissions, opsData, coreData, expansionData, documents] = await Promise.all([getSubmissionsForCustomer(customerSession.customerCode), getOpsWorkbenchData(), getWarehouseCoreDataForCustomer(customerSession.customerCode), getOpsExpansionData(), getDocuments()]);
    const customerDocuments = documents.filter((item) => item.customerCode === customerSession.customerCode);
    const workOrders = expansionData.selfServiceWorkOrders.filter((item) => item.customerCode === customerSession.customerCode);
    const items = await getCustomerNotifications({ customerCode: customerSession.customerCode, submissions, opsData, coreData, documents: customerDocuments, workOrders });
    const subscriptions = (await getNotificationSubscriptions()).filter((item) => item.audience === "customer" && item.customerCode === customerSession.customerCode);
    return NextResponse.json({ items, unreadCount: items.filter((item) => item.unread).length, subscriptions });
  }

  const [submissions, opsData, coreData, documents, expansionData] = await Promise.all([getSubmissions(), getOpsWorkbenchData(), getWarehouseCoreData(), getDocuments(), getOpsExpansionData()]);
  const items = await getStaffNotifications({ submissions, opsData, coreData, documents, expansionData, workOrders: expansionData.selfServiceWorkOrders });
  const subscriptions = (await getNotificationSubscriptions()).filter((item) => item.audience === "staff");
  return NextResponse.json({ items, unreadCount: items.filter((item) => item.unread).length, subscriptions });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    id?: string;
    ids?: string[];
    audience?: "customer" | "staff";
    sources?: NotificationSource[];
    severities?: NotificationSeverity[];
    channels?: Array<NotificationChannel | string>;
    enabled?: boolean;
  };
  if (!body.action) return NextResponse.json({ error: "unsupported notification action" }, { status: 400 });

  const cookieStore = await cookies();
  const customerSession = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staffSession = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!customerSession && !staffSession) return NextResponse.json({ error: "login required" }, { status: 401 });

  if ((body.action === "dismiss" || body.action === "read") && !body.id) return NextResponse.json({ error: "notification id required" }, { status: 400 });
  if (body.id?.startsWith("staff:") && !staffSession) return NextResponse.json({ error: "staff notification permission required" }, { status: 403 });
  if (body.id?.startsWith("customer:") && !customerSession) return NextResponse.json({ error: "customer notification permission required" }, { status: 403 });

  if (body.action === "dismiss" && body.id) {
    await dismissNotification(body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "read" && body.id) {
    await markNotificationRead(body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "read_all") {
    await markNotificationsRead(body.ids ?? []);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "upsert_subscription") {
    const audience = staffSession ? "staff" : "customer";
    const subscription = await upsertNotificationSubscription({
      audience,
      customerCode: customerSession?.customerCode,
      staffRole: staffSession?.role,
      sources: body.sources ?? [],
      severities: body.severities ?? [],
      channels: normalizeChannels(body.channels),
      enabled: body.enabled ?? true,
    });
    return NextResponse.json({ subscription });
  }

  return NextResponse.json({ error: "unsupported notification action" }, { status: 400 });
}