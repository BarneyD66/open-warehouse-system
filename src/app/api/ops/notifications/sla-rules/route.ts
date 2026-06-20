import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getSlaNotificationRules, updateSlaNotificationRules, type SlaNotificationRule, type SlaRuleKey } from "@/lib/slaRuleStore";

export const runtime = "nodejs";

const ruleKeys = new Set<SlaRuleKey>([
  "inbound_putaway",
  "outbound_ship",
  "outbound_intercept",
  "outbound_weight",
  "work_order_open",
  "work_order_processing",
  "finance_review",
  "billing_due",
]);

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[\n,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanRules(value: unknown) {
  const rawRules = Array.isArray(value) ? value : [];
  return rawRules
    .map((item) => item as Partial<SlaNotificationRule>)
    .filter((item): item is Partial<SlaNotificationRule> & { key: SlaRuleKey } => Boolean(item.key && ruleKeys.has(item.key as SlaRuleKey)))
    .map((item) => ({
      key: item.key,
      enabled: item.enabled !== false,
      overdueHours: numberFrom(item.overdueHours),
      nearDueHours: numberFrom(item.nearDueHours),
      channels: stringList(item.channels),
      escalationRole: String(item.escalationRole ?? "").trim() || undefined,
    }));
}

async function authorize() {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData) && !canAccessOpsModule(staff, "permissions", expansionData)) return { staff, error: "当前角色无权配置 SLA 提醒规则。" };
  return { staff, error: "" };
}

export async function GET() {
  const auth = await authorize();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 403 });
  const rules = await getSlaNotificationRules();
  return NextResponse.json({ rules, generatedAt: new Date().toISOString() });
}

export async function PATCH(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-sla-rules"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "SLA 规则保存过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const auth = await authorize();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { rules?: unknown };
  const rules = cleanRules(body.rules);
  if (rules.length === 0) return NextResponse.json({ error: "请至少提交一条有效 SLA 规则。" }, { status: 400 });

  const result = await updateSlaNotificationRules(rules, auth.staff.displayName || auth.staff.username);
  await recordAuditLog({
    action: "notification_rule_update",
    actorRole: "staff",
    actorName: auth.staff.displayName || auth.staff.username,
    targetType: "notification_delivery",
    targetId: "sla-rules",
    summary: "更新 SLA 提醒规则",
    note: `更新 ${rules.length} 条规则`,
    after: { rules: result.rules, updatedBy: result.updatedBy, updatedAt: result.updatedAt },
  });

  return NextResponse.json(result);
}

