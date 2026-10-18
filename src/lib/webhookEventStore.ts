import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";

export type WebhookEventKind = "carrier" | "platform";
export type WebhookEventStatus = "processing" | "processed" | "ignored" | "failed";

export type WebhookEventRecord = {
  id: string;
  kind: WebhookEventKind;
  provider: string;
  eventId: string;
  status: WebhookEventStatus;
  targetId?: string;
  summary?: string;
  error?: string;
  receivedAt: string;
  updatedAt: string;
  expiresAt: string;
};

type WebhookEventData = {
  events: WebhookEventRecord[];
};

const webhookEventStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "webhook-events.json") : path.join(process.cwd(), ".local-data", "webhook-events.json");
const defaultTtlMs = 7 * 24 * 60 * 60_000;

let webhookEventTableReady = false;

function nowIso() {
  return new Date().toISOString();
}

function expiryIso(ttlMs = defaultTtlMs) {
  return new Date(Date.now() + ttlMs).toISOString();
}

function cleanText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, "-").replace(/-+/g, "-").slice(0, 160);
}

export function webhookBodyHash(rawBody: string) {
  return createHash("sha256").update(rawBody || "").digest("hex");
}

export function makeWebhookEventKey(kind: WebhookEventKind, provider: string, eventId: string) {
  return `${kind}:${cleanText(provider || "unknown")}:${cleanText(eventId || "unknown")}`;
}

async function ensureWebhookEventTable() {
  if (!hasPostgresConfig() || webhookEventTableReady) return;
  const sql = getSql();
  await sql`
    create table if not exists warehouse_webhook_events (
      id text primary key,
      kind text not null,
      provider text not null,
      event_id text not null,
      status text not null,
      target_id text,
      summary text,
      error text,
      payload jsonb not null,
      received_at timestamptz not null,
      updated_at timestamptz not null,
      expires_at timestamptz not null
    )
  `;
  await sql`create index if not exists warehouse_webhook_events_expires_idx on warehouse_webhook_events (expires_at)`;
  webhookEventTableReady = true;
}

async function readWebhookEvents(): Promise<WebhookEventData> {
  if (hasPostgresConfig()) {
    await ensureWebhookEventTable();
    const sql = getSql();
    const rows = await sql<{ payload: WebhookEventRecord }[]>`select payload from warehouse_webhook_events where expires_at > now() order by received_at desc limit 2000`;
    return { events: rows.map((row) => row.payload).filter((item) => item?.id) };
  }

  try {
    const raw = await readFile(webhookEventStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WebhookEventData>;
    const now = Date.now();
    return { events: Array.isArray(parsed.events) ? parsed.events.filter((item) => item.expiresAt && new Date(item.expiresAt).getTime() > now) : [] };
  } catch {
    return { events: [] };
  }
}

async function writeWebhookEvents(data: WebhookEventData) {
  if (hasPostgresConfig()) {
    await ensureWebhookEventTable();
    const sql = getSql();
    await sql.begin(async (tx) => {
      await tx`delete from warehouse_webhook_events where expires_at <= now()`;
      for (const event of data.events) {
        await tx`
          insert into warehouse_webhook_events (id, kind, provider, event_id, status, target_id, summary, error, payload, received_at, updated_at, expires_at)
          values (${event.id}, ${event.kind}, ${event.provider}, ${event.eventId}, ${event.status}, ${event.targetId ?? null}, ${event.summary ?? null}, ${event.error ?? null}, ${tx.json(event)}, ${event.receivedAt}, ${event.updatedAt}, ${event.expiresAt})
          on conflict (id) do update set
            status = excluded.status,
            target_id = excluded.target_id,
            summary = excluded.summary,
            error = excluded.error,
            payload = excluded.payload,
            updated_at = excluded.updated_at,
            expires_at = excluded.expires_at
        `;
      }
    });
    return;
  }

  await mkdir(path.dirname(webhookEventStorePath), { recursive: true });
  await writeFile(webhookEventStorePath, JSON.stringify(data, null, 2), "utf8");
}

export async function claimWebhookEvent({
  kind,
  provider,
  eventId,
  ttlMs = defaultTtlMs,
}: {
  kind: WebhookEventKind;
  provider: string;
  eventId: string;
  ttlMs?: number;
}) {
  const id = makeWebhookEventKey(kind, provider, eventId);
  const timestamp = nowIso();
  const record: WebhookEventRecord = {
    id,
    kind,
    provider,
    eventId,
    status: "processing",
    receivedAt: timestamp,
    updatedAt: timestamp,
    expiresAt: expiryIso(ttlMs),
  };

  if (hasPostgresConfig()) {
    await ensureWebhookEventTable();
    const sql = getSql();
    await sql`delete from warehouse_webhook_events where expires_at <= now()`;
    const inserted = await sql<{ id: string }[]>`
      insert into warehouse_webhook_events (id, kind, provider, event_id, status, payload, received_at, updated_at, expires_at)
      values (${record.id}, ${record.kind}, ${record.provider}, ${record.eventId}, ${record.status}, ${sql.json(record)}, ${record.receivedAt}, ${record.updatedAt}, ${record.expiresAt})
      on conflict (id) do nothing
      returning id
    `;
    if (inserted.length > 0) return { duplicate: false, record };
    const existing = await sql<{ payload: WebhookEventRecord }[]>`select payload from warehouse_webhook_events where id = ${id} limit 1`;
    return { duplicate: true, record: existing[0]?.payload ?? record };
  }

  const data = await readWebhookEvents();
  const existing = data.events.find((item) => item.id === id);
  if (existing) return { duplicate: true, record: existing };
  data.events.unshift(record);
  await writeWebhookEvents(data);
  return { duplicate: false, record };
}

export async function completeWebhookEvent({
  id,
  status,
  targetId,
  summary,
  error,
}: {
  id: string;
  status: WebhookEventStatus;
  targetId?: string;
  summary?: string;
  error?: string;
}) {
  const data = await readWebhookEvents();
  const timestamp = nowIso();
  const existing = data.events.find((item) => item.id === id);
  if (!existing) return null;

  existing.status = status;
  existing.targetId = targetId;
  existing.summary = summary;
  existing.error = error;
  existing.updatedAt = timestamp;
  await writeWebhookEvents(data);
  return existing;
}

export async function getWebhookEvents(limit = 200) {
  const data = await readWebhookEvents();
  return data.events.slice(0, limit);
}

