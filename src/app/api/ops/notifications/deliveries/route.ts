import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getNotificationDeliveries, getNotificationProviderHealth, retryDueNotificationDeliveries, retryNotificationDelivery, testNotificationDelivery, type NotificationChannel } from "@/lib/notificationStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

type RetryBody = {
  action?: "retry" | "retry_due" | "test";
  id?: string;
  limit?: number;
  channel?: Exclude<NotificationChannel, "in_app">;
};

function canManageNotificationDelivery(role: string) {
  return role === "admin" || role === "ops";
}

function validTestChannel(value: unknown): value is Exclude<NotificationChannel, "in_app"> {
  return value === "email" || value === "sms" || value === "wechat";
}

export async function GET() {
  await requireStaffSession();
  const [deliveries, providerHealth] = await Promise.all([getNotificationDeliveries(100), Promise.resolve(getNotificationProviderHealth())]);
  return NextResponse.json({ deliveries, providerHealth });
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  if (!canManageNotificationDelivery(staff.role)) {
    return NextResponse.json({ error: "当前角色无权管理通知投递。" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as RetryBody;

  if (body.action === "retry_due") {
    const result = await retryDueNotificationDeliveries(body.limit);
    await recordAuditLog({
      action: "notification_delivery_retry_due",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "notification_delivery",
      targetId: "due",
      summary: "批量重试到期通知投递",
      note: `尝试 ${result.attempted} 条，成功 ${result.sent} 条，失败 ${result.failed} 条，阻断 ${result.blocked} 条。`,
      after: {
        attempted: result.attempted,
        sent: result.sent,
        failed: result.failed,
        blocked: result.blocked,
      },
    });
    return NextResponse.json(result);
  }

  if (body.action === "test") {
    if (!validTestChannel(body.channel)) return NextResponse.json({ error: "请选择要测试的通知渠道。" }, { status: 400 });
    const delivery = await testNotificationDelivery(body.channel, staff.displayName || staff.username);
    await recordAuditLog({
      action: "notification_delivery_retry",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "notification_delivery",
      targetId: delivery.id,
      summary: "测试通知供应商投递",
      note: `${delivery.channel} 测试投递状态：${delivery.status}`,
      after: delivery,
    });
    return NextResponse.json({ delivery });
  }

  if (body.action !== "retry" || !body.id?.trim()) {
    return NextResponse.json({ error: "缺少通知投递记录编号。" }, { status: 400 });
  }

  const result = await retryNotificationDelivery(body.id.trim());
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditLog({
    action: "notification_delivery_retry",
    actorRole: "staff",
    actorName: staff.displayName || staff.username,
    targetType: "notification_delivery",
    targetId: body.id.trim(),
    summary: "重试通知投递",
    note: result.delivery ? `重试后状态：${result.delivery.status}` : "",
    after: result.delivery,
  });

  return NextResponse.json({ delivery: result.delivery });
}
