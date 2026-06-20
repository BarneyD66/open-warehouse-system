import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";

export type ProductionErrorSeverity = "critical" | "warning";
export type ProductionErrorSource = "api" | "frontend" | "integration" | "system";
export type ProductionErrorHandlingStatus = "open" | "acknowledged" | "resolved";

export type ProductionErrorEvent = {
  id: string;
  severity: ProductionErrorSeverity;
  source: ProductionErrorSource;
  route: string;
  method?: string;
  message: string;
  stack?: string;
  actorName?: string;
  requestId?: string;
  userAgent?: string;
  ipHint?: string;
  refId?: string;
  handlingStatus: ProductionErrorHandlingStatus;
  handledBy?: string;
  handledAt?: string;
  handlingNote?: string;
  createdAt: string;
  updatedAt: string;
};

type ProductionErrorData = {
  events: ProductionErrorEvent[];
};

type ProductionErrorFilters = {
  severity?: ProductionErrorSeverity;
  source?: ProductionErrorSource;
  status?: ProductionErrorHandlingStatus;
  keyword?: string;
  limit?: number;
};

const storePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "production-errors.json") : path.join(process.cwd(), ".local-data", "production-errors.json");
let tableReady = false;

function now() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  return "未知系统异常";
}

function errorStack(error: unknown) {
  return error instanceof Error ? error.stack?.slice(0, 4000) : undefined;
}

function isNextFrameworkSignal(error: unknown) {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = String((error as { digest?: unknown }).digest ?? "");
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

async function ensureTable() {
  if (!hasPostgresConfig() || tableReady) return;
  const sql = getSql();
  await sql`
    create table if not exists warehouse_production_errors (
      id text primary key,
      severity text not null,
      source text not null,
      route text not null,
      method text,
      message text not null,
      payload jsonb not null,
      handling_status text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;
  await sql`create index if not exists warehouse_production_errors_status_idx on warehouse_production_errors (handling_status, created_at desc)`;
  tableReady = true;
}

async function readData(): Promise<ProductionErrorData> {
  if (hasPostgresConfig()) {
    await ensureTable();
    const sql = getSql();
    const rows = await sql<{ payload: ProductionErrorEvent }[]>`select payload from warehouse_production_errors order by created_at desc limit 2000`;
    return { events: rows.map((row) => row.payload).filter((item) => item?.id) };
  }

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProductionErrorData>;
    return { events: Array.isArray(parsed.events) ? parsed.events : [] };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { events: [] };
    if (error instanceof SyntaxError) return { events: [] };
    throw error;
  }
}

async function writeData(data: ProductionErrorData) {
  const events = data.events.slice(0, 2000);
  if (hasPostgresConfig()) {
    await ensureTable();
    const sql = getSql();
    await sql.begin(async (tx) => {
      for (const event of events) {
        await tx`
          insert into warehouse_production_errors (id, severity, source, route, method, message, payload, handling_status, created_at, updated_at)
          values (${event.id}, ${event.severity}, ${event.source}, ${event.route}, ${event.method ?? null}, ${event.message}, ${tx.json(event)}, ${event.handlingStatus}, ${event.createdAt}, ${event.updatedAt})
          on conflict (id) do update set
            severity = excluded.severity,
            source = excluded.source,
            route = excluded.route,
            method = excluded.method,
            message = excluded.message,
            payload = excluded.payload,
            handling_status = excluded.handling_status,
            updated_at = excluded.updated_at
        `;
      }
    });
    return;
  }

  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify({ events }, null, 2), "utf8");
}

function matchesKeyword(event: ProductionErrorEvent, keyword?: string) {
  const clean = normalizeText(keyword).toLowerCase();
  if (!clean) return true;
  return [event.id, event.route, event.method, event.message, event.actorName, event.refId, event.requestId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(clean);
}

export async function recordProductionError(input: {
  severity?: ProductionErrorSeverity;
  source: ProductionErrorSource;
  route: string;
  method?: string;
  message: string;
  stack?: string;
  actorName?: string;
  requestId?: string;
  userAgent?: string;
  ipHint?: string;
  refId?: string;
}) {
  const timestamp = now();
  const event: ProductionErrorEvent = {
    id: `ERR-${randomUUID()}`,
    severity: input.severity ?? "critical",
    source: input.source,
    route: input.route,
    method: input.method,
    message: input.message.trim() || "未知系统异常",
    stack: input.stack,
    actorName: normalizeText(input.actorName) || undefined,
    requestId: normalizeText(input.requestId) || undefined,
    userAgent: normalizeText(input.userAgent).slice(0, 240) || undefined,
    ipHint: normalizeText(input.ipHint).slice(0, 80) || undefined,
    refId: normalizeText(input.refId) || undefined,
    handlingStatus: "open",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const data = await readData();
  data.events.unshift(event);
  await writeData(data);
  return event;
}

export async function recordApiError(input: { request: Request; route: string; error: unknown; actorName?: string; refId?: string }) {
  if (isNextFrameworkSignal(input.error)) throw input.error;
  const headers = input.request.headers;
  return recordProductionError({
    source: "api",
    severity: "critical",
    route: input.route,
    method: input.request.method,
    message: errorMessage(input.error),
    stack: errorStack(input.error),
    actorName: input.actorName,
    refId: input.refId,
    requestId: normalizeText(headers.get("x-request-id")) || normalizeText(headers.get("x-vercel-id")) || undefined,
    userAgent: normalizeText(headers.get("user-agent")) || undefined,
    ipHint: normalizeText(headers.get("x-forwarded-for")) || normalizeText(headers.get("x-real-ip")) || undefined,
  });
}

export async function getProductionErrorEvents(filters: ProductionErrorFilters = {}) {
  const data = await readData();
  const limit = Math.max(1, Math.min(2000, Math.floor(Number(filters.limit ?? 300))));
  return data.events
    .filter((event) => (!filters.severity || event.severity === filters.severity) && (!filters.source || event.source === filters.source) && (!filters.status || event.handlingStatus === filters.status))
    .filter((event) => matchesKeyword(event, filters.keyword))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

export async function updateProductionErrorEvent(input: {
  id: string;
  status: ProductionErrorHandlingStatus;
  handledBy: string;
  note?: string;
}) {
  const cleanId = input.id.trim();
  const data = await readData();
  const event = data.events.find((item) => item.id === cleanId);
  if (!event) return { event: null, error: "未找到生产错误事件" };

  const timestamp = now();
  event.handlingStatus = input.status;
  event.handledBy = input.handledBy.trim() || event.handledBy;
  event.handledAt = timestamp;
  event.handlingNote = input.note?.trim() || event.handlingNote;
  event.updatedAt = timestamp;
  await writeData(data);
  return { event, error: null };
}
