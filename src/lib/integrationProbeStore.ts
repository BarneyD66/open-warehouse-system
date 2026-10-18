import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";
import { evaluateProductionIntegrationReadiness, type ProductionIntegrationReadinessItem } from "./productionIntegrationReadiness";

export type IntegrationProbeStatus = "passed" | "failed" | "blocked";

export type IntegrationProbeRecord = {
  id: string;
  itemId: string;
  group: ProductionIntegrationReadinessItem["group"];
  itemName: string;
  status: IntegrationProbeStatus;
  checkedBy: string;
  startedAt: string;
  finishedAt: string;
  message: string;
  details?: string[];
  missingEnv?: string[];
};

type IntegrationProbeData = {
  records: IntegrationProbeRecord[];
};

const probeStorePath = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data", "integration-probes.json") : path.join(process.cwd(), ".local-data", "integration-probes.json");

function now() {
  return new Date().toISOString();
}

let probeTableReady = false;

async function ensureProbeTable() {
  if (!hasPostgresConfig() || probeTableReady) return;
  const sql = getSql();
  await sql`
    create table if not exists warehouse_integration_probes (
      id text primary key,
      item_id text not null,
      payload jsonb not null,
      created_at timestamptz not null default now()
    )
  `;
  probeTableReady = true;
}

async function readProbeData(): Promise<IntegrationProbeData> {
  if (hasPostgresConfig()) {
    await ensureProbeTable();
    const sql = getSql();
    const rows = await sql<{ payload: IntegrationProbeRecord }[]>`select payload from warehouse_integration_probes order by created_at desc limit 500`;
    return { records: rows.map((row) => row.payload).filter((item) => item?.id) };
  }
  try {
    const raw = await readFile(probeStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<IntegrationProbeData>;
    return { records: Array.isArray(parsed.records) ? parsed.records : [] };
  } catch {
    return { records: [] };
  }
}

async function writeProbeData(data: IntegrationProbeData) {
  data.records = data.records.slice(0, 500);
  if (hasPostgresConfig()) {
    await ensureProbeTable();
    const sql = getSql();
    await sql.begin(async (tx) => {
      for (const record of data.records) {
        await tx`
          insert into warehouse_integration_probes (id, item_id, payload, created_at)
          values (${record.id}, ${record.itemId}, ${tx.json(record)}, ${record.startedAt})
          on conflict (id) do update set payload = excluded.payload
        `;
      }
    });
    return;
  }
  await mkdir(path.dirname(probeStorePath), { recursive: true });
  await writeFile(probeStorePath, JSON.stringify(data, null, 2), "utf8");
}

export async function getIntegrationProbeRecords(limit = 100) {
  const data = await readProbeData();
  return [...data.records].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, limit);
}

export async function getLatestIntegrationProbeMap() {
  const records = await getIntegrationProbeRecords(500);
  const map = new Map<string, IntegrationProbeRecord>();
  records.forEach((record) => {
    if (!map.has(record.itemId)) map.set(record.itemId, record);
  });
  return map;
}

function envValue(name: string | undefined) {
  if (!name) return undefined;
  return process.env[name]?.trim();
}

function envBySuffix(item: ProductionIntegrationReadinessItem, suffixes: string[]) {
  return item.env.find((env) => env.present && suffixes.some((suffix) => env.name.endsWith(suffix)))?.name;
}

function tokenEnvForItem(item: ProductionIntegrationReadinessItem) {
  return item.env.find((env) => env.present && (env.name.endsWith("_TOKEN") || env.name.endsWith("_API_KEY") || env.name.endsWith("_ACCESS_TOKEN") || env.name === "OBJECT_STORAGE_TOKEN" || env.name === "BLOB_READ_WRITE_TOKEN" || env.name === "VIRUS_SCAN_TOKEN" || env.name === "NOTIFICATION_DELIVERY_TOKEN" || env.name === "REPORT_DELIVERY_TOKEN"))?.name;
}

async function postJsonProbe({
  endpoint,
  token,
  payload,
  headers = {},
}: {
  endpoint: string;
  token?: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(payload),
  }).catch((error: unknown) => ({ error }));
  if ("error" in response) return { ok: false, message: response.error instanceof Error ? response.error.message : "网络连接异常" };
  if (!response.ok) return { ok: false, message: `返回 HTTP ${response.status}` };
  return { ok: true, message: "联调探测通过" };
}

async function probeItem(item: ProductionIntegrationReadinessItem) {
  const missingRequired = item.env.filter((env) => env.required && !env.present).map((env) => env.name);
  if (item.status === "blocked" || missingRequired.length > 0) {
    return {
      status: "blocked" as IntegrationProbeStatus,
      message: missingRequired.length > 0 ? `缺少必要配置：${missingRequired.join("、")}` : item.summary,
      details: item.nextActions,
      missingEnv: missingRequired,
    };
  }

  if (item.group === "carrier") {
    if (item.mode === "manual") return { status: "blocked" as const, message: "人工渠道不能执行真实承运商 API 探测。", details: item.nextActions };
    const endpointName = envBySuffix(item, ["_BASE_URL", "_ENDPOINT", "_CARRIER_GATEWAY_URL"]);
    const endpoint = envValue(endpointName);
    const token = envValue(tokenEnvForItem(item));
    if (!endpoint || !token) return { status: "blocked" as const, message: "缺少承运商网关地址或 Token，无法探测。", details: item.nextActions };
    const result = await postJsonProbe({
      endpoint,
      token,
      payload: { healthcheck: true, dryRun: true, source: "sheffield-warehouse", integrationId: item.id, requestedAt: now() },
      headers: { "X-Sheffield-Healthcheck": "true" },
    });
    return { status: result.ok ? "passed" as const : "failed" as const, message: result.ok ? "承运商网关 dry-run 探测通过。" : `承运商网关探测失败：${result.message}`, details: item.nextActions };
  }

  if (item.group === "platform") {
    const endpointName = envBySuffix(item, ["_ORDERS_URL", "_API_BASE_URL"]);
    const endpoint = envValue(endpointName);
    const token = envValue(tokenEnvForItem(item));
    if (!endpoint || !token) return { status: "blocked" as const, message: "缺少平台拉单地址或 Token，无法探测。", details: item.nextActions };
    const result = await postJsonProbe({
      endpoint,
      token,
      payload: { healthcheck: true, dryRun: true, source: "sheffield-warehouse", integrationId: item.id, requestedAt: now() },
      headers: { "X-Sheffield-Healthcheck": "true" },
    });
    return { status: result.ok ? "passed" as const : "failed" as const, message: result.ok ? "平台订单 API dry-run 探测通过。" : `平台订单 API 探测失败：${result.message}`, details: item.nextActions };
  }

  if (item.group === "storage") {
    const endpoint = envValue("OBJECT_STORAGE_UPLOAD_URL") || envValue("BLOB_UPLOAD_URL");
    const token = envValue("OBJECT_STORAGE_TOKEN") || envValue("BLOB_READ_WRITE_TOKEN");
    if (!endpoint || !token) return { status: "blocked" as const, message: "对象存储上传地址或令牌未配置。", details: item.nextActions };
    const result = await postJsonProbe({
      endpoint,
      token,
      payload: { key: `healthcheck/integration-probe-${Date.now()}.txt`, mimeType: "text/plain", bytesBase64: Buffer.from("sheffield warehouse integration probe", "utf8").toString("base64"), healthcheck: true },
    });
    return { status: result.ok ? "passed" as const : "failed" as const, message: result.ok ? "对象存储测试文件上传通过。" : `对象存储探测失败：${result.message}`, details: item.nextActions };
  }

  if (item.group === "notification" || item.group === "reporting") {
    const endpoint = item.group === "notification"
      ? envValue("NOTIFICATION_DELIVERY_WEBHOOK_URL") || envValue("NOTIFICATION_EMAIL_WEBHOOK_URL") || envValue("NOTIFICATION_SMS_WEBHOOK_URL") || envValue("NOTIFICATION_WECHAT_WEBHOOK_URL")
      : envValue("REPORT_DELIVERY_WEBHOOK_URL");
    const token = item.group === "notification" ? envValue("NOTIFICATION_DELIVERY_TOKEN") : envValue("REPORT_DELIVERY_TOKEN");
    if (!endpoint) return { status: "blocked" as const, message: "外部投递 webhook 未配置。", details: item.nextActions };
    const result = await postJsonProbe({
      endpoint,
      token,
      payload: { healthcheck: true, dryRun: true, source: "sheffield-warehouse", integrationId: item.id, title: "集成联调探测", requestedAt: now() },
    });
    return { status: result.ok ? "passed" as const : "failed" as const, message: result.ok ? "外部投递 webhook dry-run 探测通过。" : `外部投递探测失败：${result.message}`, details: item.nextActions };
  }

  if (item.group === "security") {
    const endpoint = envValue("VIRUS_SCAN_WEBHOOK_URL") || envValue("CLAMAV_SCAN_URL");
    const token = envValue("VIRUS_SCAN_TOKEN");
    if (!endpoint) return { status: item.status === "partial" ? "failed" as const : "blocked" as const, message: "病毒扫描服务未配置，当前只具备基础扫描规则。", details: item.nextActions };
    const result = await postJsonProbe({
      endpoint,
      token,
      payload: { healthcheck: true, originalName: "probe.txt", storedName: "probe.txt", mimeType: "text/plain", size: 5, bytesBase64: Buffer.from("probe").toString("base64") },
    });
    return { status: result.ok ? "passed" as const : "failed" as const, message: result.ok ? "病毒扫描服务探测通过。" : `病毒扫描服务探测失败：${result.message}`, details: item.nextActions };
  }

  return { status: "failed" as const, message: "暂不支持该集成类型的自动探测。", details: item.nextActions };
}

export async function runIntegrationProbe(itemId: string, checkedBy: string) {
  const readiness = await evaluateProductionIntegrationReadiness();
  const item = readiness.items.find((entry) => entry.id === itemId);
  if (!item) return { record: null, error: "未找到集成配置项" };
  const startedAt = now();
  const result = await probeItem(item);
  const record: IntegrationProbeRecord = {
    id: `IPROBE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    itemId: item.id,
    group: item.group,
    itemName: item.name,
    status: result.status,
    checkedBy,
    startedAt,
    finishedAt: now(),
    message: result.message,
    details: result.details,
    missingEnv: result.missingEnv,
  };
  const data = await readProbeData();
  data.records.unshift(record);
  await writeProbeData(data);
  return { record, error: null };
}
