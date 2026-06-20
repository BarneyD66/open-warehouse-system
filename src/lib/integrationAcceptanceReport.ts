import type { IntegrationProbeRecord } from "./integrationProbeStore";
import type { ProductionIntegrationReadiness, ProductionIntegrationReadinessItem } from "./productionIntegrationReadiness";

export type IntegrationAcceptanceStatus = "验收通过" | "等待探测" | "配置待补" | "联调失败";

export type IntegrationAcceptanceRow = {
  itemId: string;
  group: ProductionIntegrationReadinessItem["group"];
  groupLabel: string;
  itemName: string;
  mode: string;
  readinessStatus: string;
  acceptanceStatus: IntegrationAcceptanceStatus;
  latestProbeStatus: string;
  latestProbeAt: string;
  checkedBy: string;
  message: string;
  missingEnv: string;
  nextAction: string;
};

export type IntegrationAcceptanceReport = {
  generatedAt: string;
  score: number;
  summary: {
    passed: number;
    waiting: number;
    blocked: number;
    failed: number;
  };
  rows: IntegrationAcceptanceRow[];
};

const groupLabel: Record<ProductionIntegrationReadinessItem["group"], string> = {
  carrier: "承运商 API",
  platform: "平台订单 API",
  storage: "文件存储",
  notification: "消息通知",
  reporting: "报表投递",
  security: "安全运维",
};

const readinessStatusLabel: Record<ProductionIntegrationReadinessItem["status"], string> = {
  ready: "配置可上线",
  partial: "配置待补齐",
  blocked: "配置阻塞",
};

const probeStatusLabel: Record<IntegrationProbeRecord["status"], string> = {
  passed: "探测通过",
  failed: "探测失败",
  blocked: "无法探测",
};

function acceptanceStatus(item: ProductionIntegrationReadinessItem, probe?: IntegrationProbeRecord): IntegrationAcceptanceStatus {
  if (probe?.status === "failed") return "联调失败";
  if (item.status === "blocked" || probe?.status === "blocked") return "配置待补";
  if (item.status === "ready" && probe?.status === "passed") return "验收通过";
  return "等待探测";
}

function acceptanceScore(status: IntegrationAcceptanceStatus) {
  if (status === "验收通过") return 1;
  if (status === "等待探测") return 0.5;
  return 0;
}

function rowNextAction(item: ProductionIntegrationReadinessItem, probe: IntegrationProbeRecord | undefined, status: IntegrationAcceptanceStatus) {
  if (status === "验收通过") return "保留验收记录，进入上线前抽检。";
  if (status === "联调失败") return probe?.message ? `处理失败原因：${probe.message}` : "查看最近探测失败原因，修复后重新探测。";
  if (status === "配置待补") return item.nextActions[0] || probe?.message || "补齐生产环境变量、正式授权和 webhook 后重新探测。";
  return "点击集成探测，完成 dry-run 或正式联调验收。";
}

export function buildIntegrationAcceptanceReport({
  readiness,
  probes,
}: {
  readiness: ProductionIntegrationReadiness;
  probes: IntegrationProbeRecord[] | Map<string, IntegrationProbeRecord>;
}): IntegrationAcceptanceReport {
  const probeMap = probes instanceof Map ? probes : new Map(probes.map((probe) => [probe.itemId, probe]));
  const rows = readiness.items.map<IntegrationAcceptanceRow>((item) => {
    const probe = probeMap.get(item.id);
    const status = acceptanceStatus(item, probe);
    return {
      itemId: item.id,
      group: item.group,
      groupLabel: groupLabel[item.group],
      itemName: item.name,
      mode: item.mode ?? "",
      readinessStatus: readinessStatusLabel[item.status],
      acceptanceStatus: status,
      latestProbeStatus: probe ? probeStatusLabel[probe.status] : "未探测",
      latestProbeAt: probe?.finishedAt || probe?.startedAt || "",
      checkedBy: probe?.checkedBy ?? "",
      message: probe?.message || item.summary,
      missingEnv: (probe?.missingEnv ?? item.env.filter((env) => env.required && !env.present).map((env) => env.name)).join("、"),
      nextAction: rowNextAction(item, probe, status),
    };
  });

  const summary = {
    passed: rows.filter((row) => row.acceptanceStatus === "验收通过").length,
    waiting: rows.filter((row) => row.acceptanceStatus === "等待探测").length,
    blocked: rows.filter((row) => row.acceptanceStatus === "配置待补").length,
    failed: rows.filter((row) => row.acceptanceStatus === "联调失败").length,
  };
  const score = rows.length > 0 ? Math.round((rows.reduce((sum, row) => sum + acceptanceScore(row.acceptanceStatus), 0) / rows.length) * 100) : 0;
  return {
    generatedAt: new Date().toISOString(),
    score,
    summary,
    rows,
  };
}

export function integrationAcceptanceCsvRows(report: IntegrationAcceptanceReport) {
  return [
    ["生成时间", "验收评分", "验收通过", "等待探测", "配置待补", "联调失败", "分组", "集成项", "模式", "配置状态", "验收状态", "最近探测", "探测时间", "探测人", "说明", "缺少配置", "下一步动作"],
    ...report.rows.map((row) => [
      report.generatedAt,
      report.score,
      report.summary.passed,
      report.summary.waiting,
      report.summary.blocked,
      report.summary.failed,
      row.groupLabel,
      row.itemName,
      row.mode,
      row.readinessStatus,
      row.acceptanceStatus,
      row.latestProbeStatus,
      row.latestProbeAt,
      row.checkedBy,
      row.message,
      row.missingEnv,
      row.nextAction,
    ]),
  ];
}
