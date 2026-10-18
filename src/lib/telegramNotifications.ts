import "server-only";

export type CustomerNotificationSnapshot = {
  customerCode: string;
  companyName: string;
  contactName: string;
  phone: string;
  wechat?: string;
  email?: string;
  vatNumber?: string;
  eoriNumber?: string;
  platforms?: string[];
  storeUrl?: string;
  businessAddress?: string;
  createdAt?: string;
  updatedAt?: string;
};

type CustomerNotificationSource = CustomerNotificationSnapshot & Record<string, unknown>;

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
};

const TELEGRAM_API_TIMEOUT_MS = 8_000;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptional(value: unknown) {
  const result = clean(value);
  return result || undefined;
}

export function buildCustomerNotificationSnapshot(account: CustomerNotificationSource): CustomerNotificationSnapshot {
  return {
    customerCode: clean(account.customerCode),
    companyName: clean(account.companyName),
    contactName: clean(account.contactName),
    phone: clean(account.phone),
    wechat: cleanOptional(account.wechat),
    email: cleanOptional(account.email),
    vatNumber: cleanOptional(account.vatNumber),
    eoriNumber: cleanOptional(account.eoriNumber),
    platforms: Array.isArray(account.platforms) ? account.platforms.map(clean).filter(Boolean) : [],
    storeUrl: cleanOptional(account.storeUrl),
    businessAddress: cleanOptional(account.businessAddress),
    createdAt: cleanOptional(account.createdAt),
    updatedAt: cleanOptional(account.updatedAt),
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function line(label: string, value: unknown) {
  const text = clean(value);
  return text ? `<b>${escapeHtml(label)}：</b>${escapeHtml(text)}` : "";
}

function formatTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(safeDate);
}

function adminCustomerUrl(customerCode: string) {
  const baseUrl = clean(process.env.NEXT_PUBLIC_ADMIN_URL) || "https://admin.nexroutehub.com";
  return `${baseUrl.replace(/\/+$/, "")}/boss/customers/${encodeURIComponent(customerCode)}`;
}

function adminLink(account: CustomerNotificationSnapshot) {
  if (!account.customerCode) return "";
  return `<a href="${escapeHtml(adminCustomerUrl(account.customerCode))}">在管理后台查看客户详情</a>`;
}

function visibleAccountLines(account: CustomerNotificationSnapshot) {
  return [
    line("客户编号", account.customerCode),
    line("公司 / 店铺", account.companyName),
    line("联系人", account.contactName),
    line("手机", account.phone),
    line("微信", account.wechat),
    line("邮箱", account.email),
    line("平台", account.platforms?.join("、")),
    line("店铺链接", account.storeUrl),
  ].filter(Boolean);
}

function normalized(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => clean(item))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .join("\u0000");
  }
  return clean(value);
}

function changedFieldLabels(before: CustomerNotificationSnapshot | undefined, account: CustomerNotificationSnapshot) {
  if (!before) return ["客户资料"];
  const fields: Array<[keyof CustomerNotificationSnapshot, string]> = [
    ["companyName", "公司 / 店铺名称"],
    ["contactName", "联系人"],
    ["phone", "手机"],
    ["wechat", "微信"],
    ["email", "邮箱"],
    ["vatNumber", "VAT 税号"],
    ["eoriNumber", "EORI 编号"],
    ["platforms", "平台"],
    ["storeUrl", "店铺链接"],
    ["businessAddress", "业务地址"],
  ];
  return fields.filter(([key]) => normalized(before[key]) !== normalized(account[key])).map(([, label]) => label);
}

function registrationMessage(account: CustomerNotificationSnapshot) {
  return [
    "🆕 <b>新客户注册</b>",
    "",
    ...visibleAccountLines(account),
    line("注册时间", formatTime(account.createdAt)),
    "",
    adminLink(account),
  ]
    .filter((item, index, items) => item || (index > 0 && items[index - 1]))
    .join("\n");
}

function profileUpdateMessage(before: CustomerNotificationSnapshot | undefined, account: CustomerNotificationSnapshot) {
  const changes = changedFieldLabels(before, account);
  return [
    "✏️ <b>客户资料更新</b>",
    "",
    ...visibleAccountLines(account),
    line("本次更新", changes.length ? changes.join("、") : "资料已重新保存"),
    line("更新时间", formatTime(account.updatedAt)),
    "",
    adminLink(account),
  ]
    .filter((item, index, items) => item || (index > 0 && items[index - 1]))
    .join("\n");
}

function notificationChatIds() {
  const configured = clean(process.env.TELEGRAM_NOTIFICATION_CHAT_IDS) || clean(process.env.TELEGRAM_NOTIFICATION_CHAT_ID);
  return [...new Set(configured.split(/[\s,;，；]+/).map((item) => item.trim()).filter(Boolean))];
}

async function sendTelegramMessage(text: string) {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  const chatIds = notificationChatIds();
  if (!token || chatIds.length === 0) return;

  await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as TelegramApiResponse;
        throw new Error(`TELEGRAM_SEND_FAILED:${response.status}:${result.description || "unknown"}`);
      }
    }),
  );
}

export async function notifyCustomerRegistered(account: CustomerNotificationSnapshot) {
  try {
    await sendTelegramMessage(registrationMessage(account));
  } catch {
    // Operational notifications must never block or roll back customer registration.
  }
}

export async function notifyCustomerProfileUpdated(input: {
  before?: CustomerNotificationSnapshot;
  account: CustomerNotificationSnapshot;
}) {
  try {
    await sendTelegramMessage(profileUpdateMessage(input.before, input.account));
  } catch {
    // Profile changes remain successful even if Telegram is temporarily unavailable.
  }
}
