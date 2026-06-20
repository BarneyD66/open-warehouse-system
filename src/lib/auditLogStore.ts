import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";

export type AuditAction =
  | "customer_register"
  | "customer_profile_update"
  | "customer_status_update"
  | "customer_password_change"
  | "customer_password_reset"
  | "document_upload"
  | "document_upload_rejected"
  | "document_preview"
  | "document_download"
  | "document_security_review"
  | "staff_login_success"
  | "staff_login_failed"
  | "staff_account_update"
  | "staff_role_change_review"
  | "inventory_adjustment_request"
  | "inventory_adjustment_approve"
  | "inventory_adjustment_reject"
  | "inventory_lot_create"
  | "inventory_lot_reserve"
  | "inventory_lot_release"
  | "inventory_lot_consume"
  | "inventory_lot_block"
  | "inventory_lot_activate"
  | "inventory_lot_update"
  | "inventory_lot_risk_review_due"
  | "warehouse_location_update"
  | "warehouse_location_risk_review_due"
  | "warehouse_task_update"
  | "warehouse_scan"
  | "warehouse_scan_exception"
  | "outbound_delivery_exception_create"
  | "outbound_delivery_exception_update"
  | "outbound_exception_update"
  | "inbound_exception_create"
  | "inbound_exception_update"
  | "inbound_putaway"
  | "outbound_work_mode_assign"
  | "outbound_document_reprint"
  | "outbound_intercept_request"
  | "outbound_intercept_restock"
  | "outbound_ship"
  | "outbound_status_batch_update"
  | "outbound_shipping_label_update"
  | "batch_job_run_due"
  | "batch_job_retry_due"
  | "outbound_pick_wave_batch"
  | "outbound_batch_weighing"
  | "platform_orders_sync_due"
  | "platform_cancellation_review_due"
  | "billing_auto_generate"
  | "billing_record_review"
  | "billing_payment_review"
  | "billing_payment_import"
  | "billing_invoice_review"
  | "carrier_label_retry_due"
  | "carrier_tracking_sync_due"
  | "platform_fulfillment_retry_due"
  | "notification_delivery_retry"
  | "notification_delivery_retry_due"
  | "notification_generate_due"
  | "notification_rule_update"
  | "automation_run_due"
  | "automation_task_update"
  | "report_export"
  | "integration_probe"
  | "system_alert_update"
  | "production_error_update"
  | "system_backup_export"
  | "system_restore";

export type AuditActorRole = "customer" | "staff" | "system";

export type AuditLogRecord = {
  id: string;
  action: AuditAction;
  actorRole: AuditActorRole;
  actorName: string;
  targetType:
    | "customer_account"
    | "customer_profile"
    | "staff_account"
    | "inventory_adjustment"
    | "inventory_lot"
    | "warehouse_location"
    | "warehouse_task"
    | "inbound"
    | "outbound"
    | "return"
    | "billing"
    | "notification_delivery"
    | "document"
    | "report"
    | "system";
  targetId: string;
  customerCode?: string;
  summary: string;
  note?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

type AuditLogData = {
  logs: AuditLogRecord[];
};

type AuditLogFilters = {
  customerCode?: string;
  action?: AuditAction;
  actorRole?: AuditActorRole;
  targetType?: AuditLogRecord["targetType"];
  targetId?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

const auditStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "audit-logs.json") : path.join(process.cwd(), ".local-data", "audit-logs.json");

function now() {
  return new Date().toISOString();
}

let auditTableReady = false;

async function ensureAuditTable() {
  if (!hasPostgresConfig() || auditTableReady) return;
  const sql = getSql();
  await sql`
    create table if not exists warehouse_audit_logs (
      id text primary key,
      action text not null,
      actor_role text not null,
      actor_name text not null,
      target_type text not null,
      target_id text not null,
      customer_code text,
      summary text not null,
      note text,
      before_payload jsonb,
      after_payload jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists warehouse_audit_logs_customer_idx on warehouse_audit_logs (customer_code, created_at desc)`;
  await sql`create index if not exists warehouse_audit_logs_target_idx on warehouse_audit_logs (target_type, target_id, created_at desc)`;
  auditTableReady = true;
}

async function insertPostgresAuditLog(record: AuditLogRecord) {
  await ensureAuditTable();
  const sql = getSql();
  const beforePayload = record.before === undefined ? null : sql.json(record.before as never);
  const afterPayload = record.after === undefined ? null : sql.json(record.after as never);
  await sql`
    insert into warehouse_audit_logs (
      id, action, actor_role, actor_name, target_type, target_id, customer_code, summary, note, before_payload, after_payload, created_at
    )
    values (
      ${record.id},
      ${record.action},
      ${record.actorRole},
      ${record.actorName},
      ${record.targetType},
      ${record.targetId},
      ${record.customerCode ?? null},
      ${record.summary},
      ${record.note ?? null},
      ${beforePayload},
      ${afterPayload},
      ${record.createdAt}
    )
    on conflict (id) do nothing
  `;
}

async function getPostgresAuditLogs(filters: AuditLogFilters = {}) {
  await ensureAuditTable();
  const sql = getSql();
  const limit = Math.max(1, Math.min(500, Math.floor(filters.limit ?? 80)));
  const rows = await sql<{
    id: string;
    action: AuditAction;
    actorRole: AuditActorRole;
    actorName: string;
    targetType: AuditLogRecord["targetType"];
    targetId: string;
    customerCode: string | null;
    summary: string;
    note: string | null;
    beforePayload: unknown;
    afterPayload: unknown;
    createdAt: string;
  }[]>`
    select
      id,
      action,
      actor_role as "actorRole",
      actor_name as "actorName",
      target_type as "targetType",
      target_id as "targetId",
      customer_code as "customerCode",
      summary,
      note,
      before_payload as "beforePayload",
      after_payload as "afterPayload",
      created_at as "createdAt"
    from warehouse_audit_logs
    where (${filters.customerCode ?? null}::text is null or customer_code = ${filters.customerCode ?? null})
      and (${filters.action ?? null}::text is null or action = ${filters.action ?? null})
      and (${filters.actorRole ?? null}::text is null or actor_role = ${filters.actorRole ?? null})
      and (${filters.targetType ?? null}::text is null or target_type = ${filters.targetType ?? null})
      and (${filters.targetId ?? null}::text is null or target_id = ${filters.targetId ?? null})
      and (${filters.dateFrom ?? null}::text is null or created_at >= (${filters.dateFrom ?? null}::date))
      and (${filters.dateTo ?? null}::text is null or created_at < ((${filters.dateTo ?? null}::date) + interval '1 day'))
      and (
        ${filters.keyword ?? null}::text is null
        or summary ilike ${filters.keyword ? `%${filters.keyword}%` : null}
        or note ilike ${filters.keyword ? `%${filters.keyword}%` : null}
        or actor_name ilike ${filters.keyword ? `%${filters.keyword}%` : null}
        or target_id ilike ${filters.keyword ? `%${filters.keyword}%` : null}
        or customer_code ilike ${filters.keyword ? `%${filters.keyword}%` : null}
      )
    order by created_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorRole: row.actorRole,
    actorName: row.actorName,
    targetType: row.targetType,
    targetId: row.targetId,
    customerCode: row.customerCode ?? undefined,
    summary: row.summary,
    note: row.note ?? undefined,
    before: row.beforePayload ?? undefined,
    after: row.afterPayload ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

async function readAuditLogs(): Promise<AuditLogData> {
  try {
    const raw = await readFile(auditStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuditLogData>;
    return { logs: Array.isArray(parsed.logs) ? parsed.logs : [] };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { logs: [] };
    if (error instanceof SyntaxError) return { logs: [] };
    throw error;
  }
}

async function writeAuditLogs(data: AuditLogData) {
  await mkdir(path.dirname(auditStorePath), { recursive: true });
  await writeFile(auditStorePath, JSON.stringify(data, null, 2), "utf8");
}

export async function recordAuditLog(input: Omit<AuditLogRecord, "id" | "createdAt">) {
  const record: AuditLogRecord = {
    id: `AUD-${randomUUID()}`,
    ...input,
    createdAt: now(),
  };

  if (hasPostgresConfig()) {
    await insertPostgresAuditLog(record);
    return record;
  }

  const data = await readAuditLogs();
  data.logs.unshift(record);
  await writeAuditLogs({ logs: data.logs.slice(0, 500) });
  return record;
}

export async function getAuditLogs({
  customerCode,
  action,
  actorRole,
  targetType,
  targetId,
  keyword,
  dateFrom,
  dateTo,
  limit = 80,
}: AuditLogFilters = {}) {
  if (hasPostgresConfig()) return getPostgresAuditLogs({ customerCode, action, actorRole, targetType, targetId, keyword, dateFrom, dateTo, limit });
  const data = await readAuditLogs();
  const cleanKeyword = keyword?.trim().toLowerCase();
  return data.logs
    .filter((record) => (!customerCode || record.customerCode === customerCode) && (!action || record.action === action))
    .filter((record) => (!actorRole || record.actorRole === actorRole) && (!targetType || record.targetType === targetType) && (!targetId || record.targetId === targetId))
    .filter((record) => (!dateFrom || record.createdAt.slice(0, 10) >= dateFrom) && (!dateTo || record.createdAt.slice(0, 10) <= dateTo))
    .filter((record) => {
      if (!cleanKeyword) return true;
      return [record.summary, record.note, record.actorName, record.targetId, record.customerCode].filter(Boolean).join(" ").toLowerCase().includes(cleanKeyword);
    })
    .slice(0, limit);
}
