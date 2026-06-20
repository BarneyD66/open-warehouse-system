import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";

export type AutomationTaskRunStatus = "completed" | "failed" | "unauthorized";
export type AutomationTaskHandlingStatus = "open" | "assigned" | "ignored" | "resolved";

export type AutomationTaskRunRecord = {
  key: string;
  name: string;
  endpoint: string;
  status: AutomationTaskRunStatus;
  httpStatus: number;
  summary: string;
  detail?: unknown;
  handlingStatus?: AutomationTaskHandlingStatus;
  assignedTo?: string;
  handlingNote?: string;
  handledBy?: string;
  handledAt?: string;
  retryCount?: number;
  lastRetryAt?: string;
  lastRetryStatus?: AutomationTaskRunStatus;
  lastRetrySummary?: string;
};

export type AutomationRunRecord = {
  id: string;
  actorRole: "staff" | "system";
  actorName: string;
  trigger: "manual" | "cron";
  status: "completed" | "partial_failed" | "failed";
  options: Record<string, unknown>;
  summary: {
    total: number;
    completed: number;
    failed: number;
    unauthorized: number;
  };
  results: AutomationTaskRunRecord[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  nextAction: string;
};

type AutomationRunData = {
  runs: AutomationRunRecord[];
};

type AutomationRunFilters = {
  status?: AutomationRunRecord["status"];
  taskStatus?: AutomationTaskRunStatus;
  handlingStatus?: AutomationTaskHandlingStatus;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

const automationRunStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "automation-runs.json") : path.join(process.cwd(), ".local-data", "automation-runs.json");

let automationRunTableReady = false;

async function ensureAutomationRunTable() {
  if (!hasPostgresConfig() || automationRunTableReady) return;
  const sql = getSql();
  await sql`
    create table if not exists warehouse_automation_runs (
      id text primary key,
      payload jsonb not null,
      status text not null,
      started_at timestamptz not null,
      finished_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists warehouse_automation_runs_status_idx on warehouse_automation_runs (status, started_at desc)`;
  automationRunTableReady = true;
}

async function readAutomationRunData(): Promise<AutomationRunData> {
  if (hasPostgresConfig()) {
    await ensureAutomationRunTable();
    const sql = getSql();
    const rows = await sql<{ payload: AutomationRunRecord }[]>`select payload from warehouse_automation_runs order by started_at desc limit 500`;
    return { runs: rows.map((row) => normalizeAutomationRun(row.payload)).filter((item) => item?.id) };
  }

  try {
    const raw = await readFile(automationRunStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AutomationRunData>;
    return { runs: Array.isArray(parsed.runs) ? parsed.runs.map(normalizeAutomationRun) : [] };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { runs: [] };
    if (error instanceof SyntaxError) return { runs: [] };
    throw error;
  }
}

function normalizeAutomationTask(task: AutomationTaskRunRecord): AutomationTaskRunRecord {
  return {
    ...task,
    handlingStatus: task.handlingStatus ?? (task.status === "completed" ? "resolved" : "open"),
    retryCount: Math.max(0, Math.floor(Number(task.retryCount ?? 0))),
  };
}

function normalizeAutomationRun(run: AutomationRunRecord): AutomationRunRecord {
  return {
    ...run,
    results: Array.isArray(run.results) ? run.results.map(normalizeAutomationTask) : [],
  };
}

async function writeAutomationRunData(data: AutomationRunData) {
  if (hasPostgresConfig()) {
    await ensureAutomationRunTable();
    const sql = getSql();
    await sql.begin(async (tx) => {
      for (const run of data.runs) {
        await tx`
          insert into warehouse_automation_runs (id, payload, status, started_at, finished_at)
          values (${run.id}, ${tx.json(run as never)}, ${run.status}, ${run.startedAt}, ${run.finishedAt})
          on conflict (id) do update set payload = excluded.payload, status = excluded.status, started_at = excluded.started_at, finished_at = excluded.finished_at
        `;
      }
    });
    return;
  }

  await mkdir(path.dirname(automationRunStorePath), { recursive: true });
  await writeFile(automationRunStorePath, JSON.stringify({ runs: data.runs.slice(0, 500) }, null, 2), "utf8");
}

export function automationRunStatusLabel(status: AutomationRunRecord["status"]) {
  const labels: Record<AutomationRunRecord["status"], string> = {
    completed: "全部完成",
    partial_failed: "部分失败",
    failed: "全部失败",
  };
  return labels[status] ?? status;
}

export function automationTaskStatusLabel(status: AutomationTaskRunStatus) {
  const labels: Record<AutomationTaskRunStatus, string> = {
    completed: "完成",
    failed: "失败",
    unauthorized: "权限不足",
  };
  return labels[status] ?? status;
}

export function automationTaskHandlingStatusLabel(status: AutomationTaskHandlingStatus | undefined) {
  const labels: Record<AutomationTaskHandlingStatus, string> = {
    open: "待处理",
    assigned: "已指派",
    ignored: "已忽略",
    resolved: "已解决",
  };
  return labels[status ?? "open"];
}

export function resolveAutomationRunStatus(summary: AutomationRunRecord["summary"]): AutomationRunRecord["status"] {
  if (summary.total > 0 && summary.completed === summary.total) return "completed";
  if (summary.completed > 0) return "partial_failed";
  return "failed";
}

export function automationRunNextAction(record: Pick<AutomationRunRecord, "summary" | "results">) {
  if (record.summary.unauthorized > 0) return "优先检查自动化密钥、员工权限和子任务专用密钥。";
  if (record.summary.failed > 0) {
    const failedNames = record.results.filter((item) => item.status === "failed").map((item) => item.name).slice(0, 3);
    return `优先处理失败子任务：${failedNames.join("、") || "查看详情"}。`;
  }
  return "无需处理，继续按计划自动执行。";
}

export async function recordAutomationRun(input: Omit<AutomationRunRecord, "id" | "status" | "nextAction"> & { id?: string }) {
  const summary = input.summary;
  const record: AutomationRunRecord = {
    id: input.id ?? `AUTO-${randomUUID()}`,
    actorRole: input.actorRole,
    actorName: input.actorName,
    trigger: input.trigger,
    status: resolveAutomationRunStatus(summary),
    options: input.options,
    summary,
    results: input.results,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
    nextAction: "",
  };
  record.nextAction = automationRunNextAction(record);

  if (hasPostgresConfig()) {
    await writeAutomationRunData({ runs: [record] });
    return record;
  }

  const data = await readAutomationRunData();
  data.runs.unshift(record);
  await writeAutomationRunData(data);
  return record;
}

export async function updateAutomationTaskHandling(input: {
  runId: string;
  taskKey: string;
  action: "assign" | "ignore" | "resolve" | "retry";
  assignedTo?: string;
  note?: string;
  operator: string;
  retryResult?: {
    status: AutomationTaskRunStatus;
    httpStatus: number;
    summary: string;
    detail?: unknown;
  };
}) {
  const cleanRunId = input.runId.trim();
  const cleanTaskKey = input.taskKey.trim();
  if (!cleanRunId || !cleanTaskKey) return { run: null, task: null, error: "缺少运行编号或任务编码" };

  const data = await readAutomationRunData();
  const run = data.runs.find((item) => item.id === cleanRunId);
  if (!run) return { run: null, task: null, error: "未找到自动化运行记录" };
  const task = run.results.find((item) => item.key === cleanTaskKey);
  if (!task) return { run, task: null, error: "未找到自动化子任务" };

  const timestamp = new Date().toISOString();
  if (input.action === "assign") {
    const assignedTo = input.assignedTo?.trim();
    if (!assignedTo) return { run, task, error: "请填写指派负责人" };
    task.handlingStatus = "assigned";
    task.assignedTo = assignedTo;
    task.handlingNote = input.note?.trim() || task.handlingNote;
  }
  if (input.action === "ignore") {
    task.handlingStatus = "ignored";
    task.handlingNote = input.note?.trim() || "运营确认暂不处理";
  }
  if (input.action === "resolve") {
    task.handlingStatus = "resolved";
    task.handlingNote = input.note?.trim() || "已人工处理完成";
  }
  if (input.action === "retry") {
    const retry = input.retryResult;
    if (!retry) return { run, task, error: "缺少重试结果" };
    task.retryCount = (task.retryCount ?? 0) + 1;
    task.lastRetryAt = timestamp;
    task.lastRetryStatus = retry.status;
    task.lastRetrySummary = retry.summary;
    task.detail = retry.detail ?? task.detail;
    task.httpStatus = retry.httpStatus;
    task.summary = retry.summary;
    if (retry.status === "completed") {
      task.status = "completed";
      task.handlingStatus = "resolved";
      task.handlingNote = input.note?.trim() || "重试成功，自动关闭";
    } else {
      task.status = retry.status;
      task.handlingStatus = "open";
      task.handlingNote = input.note?.trim() || "重试后仍需处理";
    }
  }

  task.handledBy = input.operator.trim() || "运营";
  task.handledAt = timestamp;
  run.summary = {
    total: run.results.length,
    completed: run.results.filter((item) => item.status === "completed").length,
    failed: run.results.filter((item) => item.status === "failed").length,
    unauthorized: run.results.filter((item) => item.status === "unauthorized").length,
  };
  run.status = resolveAutomationRunStatus(run.summary);
  run.nextAction = automationRunNextAction(run);

  await writeAutomationRunData(data);
  return { run, task, error: null };
}

function inDateRange(record: AutomationRunRecord, dateFrom?: string, dateTo?: string) {
  const day = record.startedAt.slice(0, 10);
  return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
}

function matchesKeyword(record: AutomationRunRecord, keyword?: string) {
  const clean = keyword?.trim().toLowerCase();
  if (!clean) return true;
  const text = [
    record.id,
    record.actorName,
    record.status,
    record.nextAction,
    ...record.results.flatMap((item) => [item.key, item.name, item.endpoint, item.status, item.summary, item.handlingStatus, item.assignedTo, item.handlingNote]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(clean);
}

export async function getAutomationRuns(filters: AutomationRunFilters = {}) {
  const limit = Math.max(1, Math.min(500, Math.floor(filters.limit ?? 100)));
  const data = await readAutomationRunData();
  return data.runs
    .filter((record) => (!filters.status || record.status === filters.status))
    .filter((record) => (!filters.taskStatus || record.results.some((item) => item.status === filters.taskStatus)))
    .filter((record) => (!filters.handlingStatus || record.results.some((item) => (item.handlingStatus ?? (item.status === "completed" ? "resolved" : "open")) === filters.handlingStatus)))
    .filter((record) => inDateRange(record, filters.dateFrom, filters.dateTo))
    .filter((record) => matchesKeyword(record, filters.keyword))
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, limit);
}
