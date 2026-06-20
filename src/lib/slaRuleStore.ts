import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type SlaRuleKey =
  | "inbound_putaway"
  | "outbound_ship"
  | "outbound_intercept"
  | "outbound_weight"
  | "work_order_open"
  | "work_order_processing"
  | "finance_review"
  | "billing_due";

export type SlaNotificationRule = {
  key: SlaRuleKey;
  label: string;
  description: string;
  enabled: boolean;
  overdueHours: number;
  nearDueHours: number;
  channels: string[];
  escalationRole?: string;
  updatedAt: string;
};

type SlaRuleState = {
  rules: SlaNotificationRule[];
};

const slaRuleStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "sla-rules.json") : path.join(process.cwd(), ".local-data", "sla-rules.json");

const defaultSlaRules: SlaNotificationRule[] = [
  {
    key: "inbound_putaway",
    label: "入库上架 SLA",
    description: "入库预报提交后，仓库应完成签收、异常处理和上架。",
    enabled: true,
    overdueHours: 48,
    nearDueHours: 38,
    channels: ["站内信", "邮件"],
    escalationRole: "ops",
    updatedAt: "system",
  },
  {
    key: "outbound_ship",
    label: "出库发货 SLA",
    description: "客户出库单创建后，应完成拣货、复核、面单和交运。",
    enabled: true,
    overdueHours: 24,
    nearDueHours: 19,
    channels: ["站内信", "邮件"],
    escalationRole: "warehouse",
    updatedAt: "system",
  },
  {
    key: "outbound_intercept",
    label: "出库截单审批",
    description: "平台取消、客户截单或异常截单应及时审批并回库。",
    enabled: true,
    overdueHours: 24,
    nearDueHours: 19,
    channels: ["站内信", "邮件"],
    escalationRole: "ops",
    updatedAt: "system",
  },
  {
    key: "outbound_weight",
    label: "出库称重签出",
    description: "包装复核完成后，应补录重量、包裹数并完成签出。",
    enabled: true,
    overdueHours: 24,
    nearDueHours: 19,
    channels: ["站内信"],
    escalationRole: "warehouse",
    updatedAt: "system",
  },
  {
    key: "work_order_open",
    label: "工单首次处理",
    description: "客户工单创建或回复后，运营应在首次处理 SLA 内推进。",
    enabled: true,
    overdueHours: 24,
    nearDueHours: 19,
    channels: ["站内信", "邮件"],
    escalationRole: "ops",
    updatedAt: "system",
  },
  {
    key: "work_order_processing",
    label: "工单处理中推进",
    description: "工单进入处理中后，不应长时间无更新。",
    enabled: true,
    overdueHours: 48,
    nearDueHours: 38,
    channels: ["站内信"],
    escalationRole: "ops",
    updatedAt: "system",
  },
  {
    key: "finance_review",
    label: "财务复核 SLA",
    description: "账单争议、调账、赔付、付款复核需要财务及时确认。",
    enabled: true,
    overdueHours: 24,
    nearDueHours: 18,
    channels: ["站内信", "邮件"],
    escalationRole: "admin",
    updatedAt: "system",
  },
  {
    key: "billing_due",
    label: "账单到期提醒",
    description: "客户账单到期前触发提醒，到期后进入逾期升级。",
    enabled: true,
    overdueHours: 0,
    nearDueHours: 72,
    channels: ["站内信", "邮件"],
    escalationRole: "ops",
    updatedAt: "system",
  },
];

function normalizeHours(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(720, Math.round(parsed)));
}

function normalizeRule(input: Partial<SlaNotificationRule> | undefined, fallback: SlaNotificationRule): SlaNotificationRule {
  const source = input ?? {};
  const overdueHours = normalizeHours(source.overdueHours, fallback.overdueHours);
  const nearDueHours = Math.min(overdueHours || fallback.nearDueHours, normalizeHours(source.nearDueHours, fallback.nearDueHours));
  const channels = Array.isArray(source.channels) && source.channels.length > 0 ? source.channels.map((item) => String(item).trim()).filter(Boolean) : fallback.channels;
  return {
    ...fallback,
    ...source,
    enabled: source.enabled ?? fallback.enabled,
    overdueHours,
    nearDueHours,
    channels,
    escalationRole: source.escalationRole?.trim() || fallback.escalationRole,
    updatedAt: source.updatedAt || fallback.updatedAt,
  };
}

async function readSlaRuleState(): Promise<SlaRuleState> {
  try {
    const raw = await readFile(slaRuleStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SlaRuleState>;
    const configured = Array.isArray(parsed.rules) ? parsed.rules : [];
    return {
      rules: defaultSlaRules.map((fallback) => normalizeRule(configured.find((item) => item.key === fallback.key), fallback)),
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { rules: defaultSlaRules };
    if (error instanceof SyntaxError) return { rules: defaultSlaRules };
    throw error;
  }
}

async function writeSlaRuleState(state: SlaRuleState) {
  await mkdir(path.dirname(slaRuleStorePath), { recursive: true });
  await writeFile(slaRuleStorePath, JSON.stringify(state, null, 2), "utf8");
}

export async function getSlaNotificationRules() {
  const state = await readSlaRuleState();
  return state.rules;
}

export async function getSlaRuleMap() {
  const rules = await getSlaNotificationRules();
  return new Map(rules.map((rule) => [rule.key, rule]));
}

export async function updateSlaNotificationRules(input: Array<Partial<SlaNotificationRule> & { key: SlaRuleKey }>, operator: string) {
  const state = await readSlaRuleState();
  const timestamp = new Date().toISOString();
  const nextRules = defaultSlaRules.map((fallback) => {
    const current = state.rules.find((item) => item.key === fallback.key) ?? fallback;
    const incoming = input.find((item) => item.key === fallback.key);
    return normalizeRule(incoming ? { ...current, ...incoming, updatedAt: timestamp } : current, fallback);
  });
  await writeSlaRuleState({ rules: nextRules });
  return {
    rules: nextRules,
    updatedBy: operator,
    updatedAt: timestamp,
  };
}
