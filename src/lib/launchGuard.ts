import type { IntegrationAcceptanceReport, IntegrationAcceptanceRow } from "./integrationAcceptanceReport";
import type { LaunchReadiness } from "./launchReadiness";
import type { OpsSystemHealth, OpsSystemHealthStatus } from "./opsSystemHealth";
import type { IntegrationReadinessStatus, ProductionIntegrationReadiness } from "./productionIntegrationReadiness";
import type { SystemAlert } from "./systemAlertStore";

export type GuardStatus = "blocked" | "warning" | "ready";
export type GuardOwner = "产品" | "前端" | "后端" | "运营" | "运维" | "仓库" | "财务";

export type GuardTask = {
  id: string;
  source: string;
  owner: GuardOwner;
  status: GuardStatus;
  title: string;
  detail: string;
  nextAction: string;
  href?: string;
};

export type LaunchGuardInput = {
  launchReadiness: LaunchReadiness;
  integrationReadiness: ProductionIntegrationReadiness;
  systemHealth: OpsSystemHealth;
  alerts: SystemAlert[];
  integrationAcceptanceReport?: IntegrationAcceptanceReport;
};

export const guardStatusLabel: Record<GuardStatus, string> = {
  blocked: "必须处理",
  warning: "需要关注",
  ready: "已就绪",
};

export const integrationGroupLabel: Record<ProductionIntegrationReadiness["items"][number]["group"], string> = {
  carrier: "承运商 API",
  notification: "消息通知",
  platform: "平台订单 API",
  reporting: "报表投递",
  security: "安全运维",
  storage: "文件存储",
};

export function launchStatus(status: LaunchReadiness["checks"][number]["status"]): GuardStatus {
  if (status === "fail") return "blocked";
  if (status === "warn") return "warning";
  return "ready";
}

export function integrationStatus(status: IntegrationReadinessStatus): GuardStatus {
  if (status === "blocked") return "blocked";
  if (status === "partial") return "warning";
  return "ready";
}

export function healthStatus(status: OpsSystemHealthStatus): GuardStatus {
  if (status === "critical") return "blocked";
  if (status === "degraded") return "warning";
  return "ready";
}

function launchOwner(id: string): GuardOwner {
  if (["shared-db", "document-storage", "demo-login", "backup-readiness"].includes(id)) return "后端";
  if (id === "surface-routing") return "前端";
  if (id === "billing-readiness") return "财务";
  if (id === "location-capacity") return "仓库";
  if (["carrier-integration", "platform-api-sync", "staff-whitelist", "document-security"].includes(id)) return "运营";
  return "产品";
}

function integrationOwner(group: ProductionIntegrationReadiness["items"][number]["group"]): GuardOwner {
  if (group === "storage" || group === "security") return "运维";
  if (group === "reporting") return "运营";
  return "运营";
}

function acceptanceOwner(group: IntegrationAcceptanceRow["group"]): GuardOwner {
  if (group === "storage" || group === "security") return "运维";
  return "运营";
}

function acceptanceGuardStatus(row: IntegrationAcceptanceRow): GuardStatus {
  if (row.acceptanceStatus === "联调失败") return "blocked";
  if (row.acceptanceStatus === "配置待补" && ["carrier", "platform", "storage", "security"].includes(row.group)) return "blocked";
  return "warning";
}

function healthOwner(id: string): GuardOwner {
  if (["database", "production-errors", "integration-probes", "file-security"].includes(id)) return "运维";
  if (id === "notification-delivery") return "运营";
  if (id === "staff-governance") return "运营";
  if (id === "job-queue") return "运营";
  return "产品";
}

function alertOwner(source: SystemAlert["source"]): GuardOwner {
  if (source === "billing") return "财务";
  if (source === "warehouse") return "仓库";
  if (source === "system" || source === "readiness") return "运维";
  return "运营";
}

function taskRank(task: GuardTask) {
  const statusRank: Record<GuardStatus, number> = { blocked: 0, warning: 1, ready: 2 };
  const ownerRank: Record<GuardOwner, number> = { 运维: 0, 后端: 1, 运营: 2, 仓库: 3, 财务: 4, 产品: 5, 前端: 6 };
  return statusRank[task.status] * 10 + ownerRank[task.owner];
}

function dedupeTasks(tasks: GuardTask[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.source}:${task.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildLaunchGuardTasks({ launchReadiness, integrationReadiness, systemHealth, alerts, integrationAcceptanceReport }: LaunchGuardInput) {
  const launchTasks = launchReadiness.checks
    .filter((check) => check.status !== "pass")
    .map<GuardTask>((check) => ({
      id: `launch:${check.id}`,
      source: "上线体检",
      owner: launchOwner(check.id),
      status: launchStatus(check.status),
      title: check.label,
      detail: check.detail,
      nextAction: check.status === "fail" ? "先处理该阻塞项，再进行发版或开放给真实客户。" : "上线前完成复核，避免试运行时变成阻塞。",
      href: "/ops?section=overview",
    }));

  const integrationTasks = integrationReadiness.items
    .filter((item) => item.status !== "ready")
    .map<GuardTask>((item) => ({
      id: `integration:${item.id}`,
      source: integrationGroupLabel[item.group],
      owner: integrationOwner(item.group),
      status: integrationStatus(item.status),
      title: item.name,
      detail: item.summary,
      nextAction: item.nextActions[0] || "补齐生产环境变量、正式授权和联调验收。",
      href: "/ops?section=overview",
    }));

  const acceptanceTasks = (integrationAcceptanceReport?.rows ?? [])
    .filter((row) => row.acceptanceStatus !== "验收通过" && (row.readinessStatus === "配置可上线" || row.acceptanceStatus === "联调失败"))
    .map<GuardTask>((row) => ({
      id: `acceptance:${row.itemId}`,
      source: "生产集成验收",
      owner: acceptanceOwner(row.group),
      status: acceptanceGuardStatus(row),
      title: row.itemName,
      detail: `${row.groupLabel} / ${row.acceptanceStatus} / ${row.latestProbeStatus}${row.message ? `：${row.message}` : ""}`,
      nextAction: row.nextAction || "补齐配置并重新执行集成探测。",
      href: "/ops?section=overview",
    }));

  const healthTasks = systemHealth.checks
    .filter((check) => check.status !== "healthy")
    .map<GuardTask>((check) => ({
      id: `health:${check.id}`,
      source: "系统健康",
      owner: healthOwner(check.id),
      status: healthStatus(check.status),
      title: check.label,
      detail: check.detail,
      nextAction: check.status === "critical" ? "当天必须确认并处理，处理后再重新执行健康检查。" : "安排负责人复核，确认是否需要环境变量、权限或数据修复。",
      href: check.actionHref || "/ops?section=overview",
    }));

  const alertTasks = alerts
    .filter((alert) => alert.handlingStatus === "open" && alert.severity !== "info")
    .map<GuardTask>((alert) => ({
      id: `alert:${alert.id}`,
      source: "系统告警",
      owner: alertOwner(alert.source),
      status: alert.severity === "critical" ? "blocked" : "warning",
      title: alert.title,
      detail: alert.detail,
      nextAction: "在系统告警中确认、搁置或关闭，并补充处理备注。",
      href: alert.actionHref || "/ops?section=overview",
    }));

  return dedupeTasks([...alertTasks, ...launchTasks, ...integrationTasks, ...acceptanceTasks, ...healthTasks]).sort((a, b) => taskRank(a) - taskRank(b) || a.title.localeCompare(b.title));
}

export function summarizeLaunchGuard(tasks: GuardTask[], input: LaunchGuardInput) {
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const warning = tasks.filter((task) => task.status === "warning").length;
  const score = Math.min(input.launchReadiness.score, input.integrationReadiness.score, input.systemHealth.score, input.integrationAcceptanceReport?.score ?? 100);
  return {
    blocked,
    warning,
    ready: blocked === 0 && warning === 0,
    score,
    generatedAt: new Date().toISOString(),
  };
}
