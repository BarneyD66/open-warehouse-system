import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AuditAction =
  | "customer_register"
  | "customer_profile_update"
  | "customer_status_update"
  | "customer_password_change"
  | "customer_password_reset"
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
  | "outbound_intercept_restock"
  | "outbound_ship";

export type AuditActorRole = "customer" | "staff" | "system";

export type AuditLogRecord = {
  id: string;
  action: AuditAction;
  actorRole: AuditActorRole;
  actorName: string;
  targetType: "customer_account" | "customer_profile" | "inventory_adjustment" | "inventory_lot" | "warehouse_task" | "inbound" | "outbound";
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

const auditStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "audit-logs.json") : path.join(process.cwd(), ".local-data", "audit-logs.json");

function now() {
  return new Date().toISOString();
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
  const data = await readAuditLogs();
  const record: AuditLogRecord = {
    id: `AUD-${randomUUID()}`,
    ...input,
    createdAt: now(),
  };

  data.logs.unshift(record);
  await writeAuditLogs({ logs: data.logs.slice(0, 500) });
  return record;
}

export async function getAuditLogs({
  customerCode,
  action,
  limit = 80,
}: {
  customerCode?: string;
  action?: AuditAction;
  limit?: number;
} = {}) {
  const data = await readAuditLogs();
  return data.logs.filter((record) => (!customerCode || record.customerCode === customerCode) && (!action || record.action === action)).slice(0, limit);
}
