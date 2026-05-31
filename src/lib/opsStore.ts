import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type OpsKind = "logistics" | "outbound" | "inventory";

export type OpsEvent = {
  id: string;
  message: string;
  operator: "system" | "ops";
  occurredAt: string;
};

export type LogisticsStatus = "open" | "investigating" | "waiting_customer" | "resolved";
export type OutboundStatus = "pending_review" | "picking" | "label_pending" | "packing_check" | "handover" | "shipped" | "blocked";
export type InventoryStatus = "normal" | "low_stock" | "aging" | "replenishment_pending" | "sync_issue";

export type LogisticsIssue = {
  id: string;
  type: "logistics";
  customerCode?: string;
  trackingNo: string;
  customer: string;
  channel: string;
  issue: string;
  status: LogisticsStatus;
  owner: string;
  deadline: string;
  costDelta?: number;
  note?: string;
  updatedAt: string;
  events: OpsEvent[];
};

export type OutboundTask = {
  id: string;
  type: "outbound";
  customerCode?: string;
  customer: string;
  channel: string;
  orderCount: number;
  status: OutboundStatus;
  owner: string;
  deadline: string;
  note?: string;
  updatedAt: string;
  events: OpsEvent[];
};

export type InventoryWatch = {
  id: string;
  type: "inventory";
  customerCode?: string;
  sku: string;
  product: string;
  warehouse: string;
  available: number;
  reserved: number;
  alert: number;
  agingDays: number;
  status: InventoryStatus;
  owner: string;
  note?: string;
  updatedAt: string;
  events: OpsEvent[];
};

export type OpsWorkbenchData = {
  logistics: LogisticsIssue[];
  outbound: OutboundTask[];
  inventory: InventoryWatch[];
};

type AnyOpsItem = LogisticsIssue | OutboundTask | InventoryWatch;

const opsStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "ops-workbench.json") : path.join(process.cwd(), ".local-data", "ops-workbench.json");

function seedData(): OpsWorkbenchData {
  return {
    logistics: [],
    outbound: [],
    inventory: [],
  };
}

async function readData() {
  try {
    const raw = await readFile(opsStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<OpsWorkbenchData>;
    const data = {
      logistics: Array.isArray(parsed.logistics) ? parsed.logistics : [],
      outbound: Array.isArray(parsed.outbound) ? parsed.outbound : [],
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
    };
    return {
      logistics: data.logistics,
      outbound: data.outbound,
      inventory: data.inventory,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return seedData();
    if (error instanceof SyntaxError) return seedData();
    throw error;
  }
}

async function writeData(data: OpsWorkbenchData) {
  await mkdir(path.dirname(opsStorePath), { recursive: true });
  await writeFile(opsStorePath, JSON.stringify(data, null, 2), "utf8");
}

export async function getOpsWorkbenchData() {
  const data = await readData();
  await writeData(data);
  return data;
}

export function labelForOpsStatus(kind: OpsKind, status: string) {
  const labels = {
    logistics: {
      open: "待处理",
      investigating: "处理中",
      waiting_customer: "待客户确认",
      resolved: "已解决",
    },
    outbound: {
      pending_review: "待审核",
      picking: "待配货",
      label_pending: "待获取面单",
      packing_check: "包装验货",
      handover: "待交运",
      shipped: "已发货",
      blocked: "异常阻塞",
    },
    inventory: {
      normal: "正常",
      low_stock: "低于安全库存",
      aging: "库龄偏高",
      replenishment_pending: "待预约送仓",
      sync_issue: "同步异常",
    },
  };
  return labels[kind][status as keyof (typeof labels)[typeof kind]] ?? status;
}

export async function updateOpsItem(kind: OpsKind, id: string, patch: { status?: string; owner?: string; note?: string }) {
  const data = await readData();
  const rows = data[kind] as AnyOpsItem[];
  const index = rows.findIndex((item) => item.id.toLowerCase() === id.toLowerCase());
  if (index === -1) return null;

  const current = rows[index];
  const now = new Date().toISOString();
  const nextStatus = patch.status?.trim() || current.status;
  const nextOwner = patch.owner?.trim() || current.owner;
  const nextNote = patch.note?.trim() || current.note;
  const changed = nextStatus !== current.status || nextOwner !== current.owner || nextNote !== current.note;
  const events = [...current.events];

  if (changed) {
    events.push({
      id: `OPS-EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      operator: "ops",
      occurredAt: now,
      message: `运营更新：状态 ${labelForOpsStatus(kind, current.status)} -> ${labelForOpsStatus(kind, nextStatus)}，负责人 ${nextOwner}${nextNote ? `，备注：${nextNote}` : ""}`,
    });
  }

  const updated = {
    ...current,
    status: nextStatus,
    owner: nextOwner,
    note: nextNote,
    updatedAt: now,
    events,
  } as AnyOpsItem;

  rows[index] = updated;
  await writeData(data);
  return updated;
}
