import "server-only";
import { after } from "next/server";
import { renderWarehouseTelegramEvent, type WarehouseTelegramEvent } from "./warehouseTelegramEvents";

export function warehouseTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && (process.env.TELEGRAM_NOTIFICATION_CHAT_IDS?.trim() || process.env.TELEGRAM_NOTIFICATION_CHAT_ID?.trim()));
}

export async function sendWarehouseTelegramEvents(events: WarehouseTelegramEvent[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const configured = process.env.TELEGRAM_NOTIFICATION_CHAT_IDS?.trim() || process.env.TELEGRAM_NOTIFICATION_CHAT_ID?.trim() || "";
  const chatIds = [...new Set(configured.split(/[\s,;，；]+/).filter(Boolean))];
  if (!token || !chatIds.length) return;
  const jobs = events.flatMap(event => chatIds.map(chatId => ({ chatId, text: renderWarehouseTelegramEvent(event) })));
  let next = 0;
  // Bounded concurrency, no retries or extra database/network work in the business response.
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: job.chatId, text: job.text, disable_web_page_preview: true }),
          cache: "no-store", signal: AbortSignal.timeout(8_000),
        });
        const body = await response.json().catch(() => null) as { ok?: boolean } | null;
        if (!response.ok || body?.ok !== true) console.warn("WAREHOUSE_TELEGRAM_SEND_FAILED", response.status);
      } catch {
        // Never log the exception: fetch errors can contain the bot token in their URL.
        console.warn("WAREHOUSE_TELEGRAM_SEND_FAILED");
      }
    }
  }));
}

export function queueWarehouseTelegramEvents(events: WarehouseTelegramEvent[]) {
  if (!events.length || !warehouseTelegramConfigured()) return;
  try {
    after(async () => {
      try { await sendWarehouseTelegramEvents(events); }
      catch { console.warn("WAREHOUSE_TELEGRAM_SEND_FAILED"); }
    });
  } catch {
    // CLI/maintenance code has no request lifecycle; do not risk an untracked send.
    console.warn("WAREHOUSE_TELEGRAM_SCHEDULE_SKIPPED");
  }
}
