import { getAuditLogs } from "./auditLogStore";
import { getSql, hasPostgresConfig } from "./db";
import { getIntegrationProbeRecords } from "./integrationProbeStore";
import { evaluateLaunchReadiness } from "./launchReadiness";
import { getOpsExpansionData } from "./opsExpansionStore";
import { evaluateProductionIntegrationReadiness } from "./productionIntegrationReadiness";
import { getProductionErrorEvents } from "./productionErrorStore";
import { getManagedStaffAccounts } from "./staffAccountStore";
import { getStaffWhitelistView } from "./staffAuth";
import { getSystemAlerts } from "./systemAlertStore";
import { getWarehouseCoreData } from "./warehouseCoreStore";

export type OpsSystemHealthStatus = "healthy" | "degraded" | "critical";

export type OpsSystemHealthCheck = {
  id: string;
  label: string;
  status: OpsSystemHealthStatus;
  owner: "系统" | "运维" | "运营" | "仓库" | "财务";
  detail: string;
  actionHref?: string;
};

export type OpsSystemHealth = {
  status: OpsSystemHealthStatus;
  score: number;
  generatedAt: string;
  environment: string;
  summary: {
    healthy: number;
    degraded: number;
    critical: number;
  };
  metrics: {
    customers: number;
    skus: number;
    outboundOrders: number;
    billingRecords: number;
    openAlerts: number;
    exceptionJobs: number;
    failedIntegrationProbes: number;
    managedStaffAccounts: number;
    openProductionErrors: number;
  };
  checks: OpsSystemHealthCheck[];
};

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

async function databaseCheck(): Promise<OpsSystemHealthCheck> {
  if (!hasPostgresConfig()) {
    return {
      id: "database",
      label: "数据库持久化",
      status: "degraded",
      owner: "运维",
      detail: "未配置 POSTGRES_URL 或 DATABASE_URL，当前会回落本地/临时存储；生产环境建议配置 Postgres。",
      actionHref: "/ops?section=overview",
    };
  }

  try {
    await getSql()`select 1 as ok`;
    return {
      id: "database",
      label: "数据库持久化",
      status: "healthy",
      owner: "运维",
      detail: "Postgres 连接探测通过，核心业务数据具备持久化基础。",
    };
  } catch (error) {
    return {
      id: "database",
      label: "数据库持久化",
      status: "critical",
      owner: "运维",
      detail: `Postgres 连接失败：${error instanceof Error ? error.message : "未知错误"}`,
      actionHref: "/ops?section=overview",
    };
  }
}

function overallStatus(checks: OpsSystemHealthCheck[]): OpsSystemHealthStatus {
  if (checks.some((check) => check.status === "critical")) return "critical";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "healthy";
}

function statusScore(status: OpsSystemHealthStatus) {
  if (status === "healthy") return 100;
  if (status === "degraded") return 60;
  return 15;
}

export async function evaluateOpsSystemHealth(): Promise<OpsSystemHealth> {
  const [database, launchReadiness, integrationReadiness, alerts, expansionData, coreData, probes, auditLogs, staffAccounts, productionErrors] = await Promise.all([
    databaseCheck(),
    evaluateLaunchReadiness(),
    evaluateProductionIntegrationReadiness(),
    getSystemAlerts(),
    getOpsExpansionData(),
    getWarehouseCoreData(),
    getIntegrationProbeRecords(100),
    getAuditLogs({ limit: 1 }),
    getManagedStaffAccounts(),
    getProductionErrorEvents({ status: "open", limit: 1000 }),
  ]);

  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = alerts.filter((alert) => alert.severity === "warning").length;
  const exceptionJobs = expansionData.batchOperationPlans.filter((job) => job.status === "exception").length;
  const latestProbeMap = new Map<string, (typeof probes)[number]>();
  probes.forEach((probe) => {
    if (!latestProbeMap.has(probe.itemId)) latestProbeMap.set(probe.itemId, probe);
  });
  const failedProbeCount = Array.from(latestProbeMap.values()).filter((probe) => probe.status === "failed" || probe.status === "blocked").length;
  const whitelistRisks = getStaffWhitelistView().flatMap((account) => account.risks);
  const objectStorageReady = envPresent("OBJECT_STORAGE_UPLOAD_URL") && envPresent("OBJECT_STORAGE_TOKEN") || envPresent("BLOB_UPLOAD_URL") && envPresent("BLOB_READ_WRITE_TOKEN");
  const virusScanReady = envPresent("VIRUS_SCAN_WEBHOOK_URL") || envPresent("CLAMAV_SCAN_URL");
  const notificationReady = envPresent("NOTIFICATION_DELIVERY_WEBHOOK_URL") || envPresent("NOTIFICATION_EMAIL_WEBHOOK_URL") || envPresent("NOTIFICATION_SMS_WEBHOOK_URL") || envPresent("NOTIFICATION_WECHAT_WEBHOOK_URL");
  const notificationRetryReady = envPresent("NOTIFICATION_RETRY_SECRET") || envPresent("CRON_SECRET");
  const jobRunReady = envPresent("JOB_RUN_SECRET") || envPresent("CRON_SECRET");
  const jobRetryReady = envPresent("JOB_RETRY_SECRET") || envPresent("CRON_SECRET");
  const criticalProductionErrors = productionErrors.filter((event) => event.severity === "critical").length;

  const checks: OpsSystemHealthCheck[] = [
    database,
    {
      id: "launch-readiness",
      label: "上线体检",
      status: launchReadiness.status === "pass" ? "healthy" : launchReadiness.status === "warn" ? "degraded" : "critical",
      owner: "系统",
      detail: `上线评分 ${launchReadiness.score}/100，环境 ${launchReadiness.environment}。`,
      actionHref: "/ops?section=overview",
    },
    {
      id: "production-integrations",
      label: "外部集成配置",
      status: integrationReadiness.status === "ready" ? "healthy" : integrationReadiness.status === "partial" ? "degraded" : "critical",
      owner: "运维",
      detail: `集成评分 ${integrationReadiness.score}/100，可上线 ${integrationReadiness.summary.ready} 项，待补齐 ${integrationReadiness.summary.partial} 项，阻塞 ${integrationReadiness.summary.blocked} 项。`,
      actionHref: "/ops?section=overview",
    },
    {
      id: "system-alerts",
      label: "系统告警",
      status: criticalAlerts > 0 ? "critical" : warningAlerts > 0 ? "degraded" : "healthy",
      owner: "运营",
      detail: criticalAlerts > 0 || warningAlerts > 0 ? `当前严重告警 ${criticalAlerts} 条，提醒 ${warningAlerts} 条。` : "当前没有严重或提醒级系统告警。",
      actionHref: "/ops?section=overview",
    },
    {
      id: "production-errors",
      label: "生产错误事件",
      status: criticalProductionErrors > 0 ? "critical" : productionErrors.length > 0 ? "degraded" : "healthy",
      owner: "运维",
      detail: productionErrors.length > 0 ? `当前有 ${productionErrors.length} 条开放生产错误，其中严重 ${criticalProductionErrors} 条；请在生产日志检索中查看并处理。` : "当前没有开放生产错误事件。",
      actionHref: "/ops?section=overview",
    },
    {
      id: "job-queue",
      label: "任务队列",
      status: exceptionJobs > 0 ? "critical" : jobRunReady && jobRetryReady ? "healthy" : "degraded",
      owner: "运营",
      detail: exceptionJobs > 0 ? `当前有 ${exceptionJobs} 个批量任务处于异常状态，需要重试或人工处理；自动重试密钥${jobRetryReady ? "已配置" : "未配置"}。` : `批量任务队列未发现异常任务；自动重试密钥${jobRetryReady ? "已配置" : "未配置"}。`,
      actionHref: "/ops?section=logistics",
    },
    {
      id: "integration-probes",
      label: "集成联调结果",
      status: failedProbeCount > 0 ? "degraded" : "healthy",
      owner: "运维",
      detail: failedProbeCount > 0 ? `最近联调中有 ${failedProbeCount} 个集成项失败或无法探测。` : "最近集成联调未发现失败记录。",
      actionHref: "/ops?section=overview",
    },
    {
      id: "file-security",
      label: "文件存储与安全扫描",
      status: objectStorageReady && virusScanReady ? "healthy" : objectStorageReady || virusScanReady ? "degraded" : "critical",
      owner: "运维",
      detail: `对象存储${objectStorageReady ? "已配置" : "未配置"}，外部病毒扫描${virusScanReady ? "已配置" : "未配置"}。`,
      actionHref: "/ops?section=overview",
    },
    {
      id: "notification-delivery",
      label: "外部通知投递",
      status: notificationReady && notificationRetryReady ? "healthy" : notificationReady || notificationRetryReady ? "degraded" : "degraded",
      owner: "运营",
      detail: notificationReady ? `邮件/短信/微信或统一通知 webhook 已配置，外部提醒可进入投递台账；自动重试密钥${notificationRetryReady ? "已配置" : "未配置"}。` : "站内信可用，但外部通知 webhook 未配置；上线前建议配置自动重试密钥和调度器。",
      actionHref: "/ops?section=permissions",
    },
    {
      id: "staff-governance",
      label: "员工账号治理",
      status: whitelistRisks.length > 0 ? "critical" : staffAccounts.length > 0 ? "healthy" : "degraded",
      owner: "运维",
      detail: whitelistRisks.length > 0 ? `员工白名单存在风险：${Array.from(new Set(whitelistRisks)).join("、")}。` : `正式员工账号 ${staffAccounts.length} 个，未发现白名单风险。`,
      actionHref: "/ops?section=permissions",
    },
    {
      id: "audit-log",
      label: "审计日志",
      status: auditLogs.length > 0 ? "healthy" : "degraded",
      owner: "系统",
      detail: auditLogs.length > 0 ? `最近审计时间：${new Date(auditLogs[0].createdAt).toLocaleString("zh-CN", { hour12: false })}。` : "暂无审计日志，生产前建议完成一次关键流程操作并确认审计留痕。",
      actionHref: "/ops?section=permissions",
    },
  ];

  const status = overallStatus(checks);
  const summary = {
    healthy: checks.filter((check) => check.status === "healthy").length,
    degraded: checks.filter((check) => check.status === "degraded").length,
    critical: checks.filter((check) => check.status === "critical").length,
  };
  const score = Math.round(checks.reduce((sum, check) => sum + statusScore(check.status), 0) / Math.max(1, checks.length));

  return {
    status,
    score,
    generatedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "local",
    summary,
    metrics: {
      customers: coreData.customers.length,
      skus: coreData.skus.length,
      outboundOrders: coreData.outboundOrders.length,
      billingRecords: coreData.billingRecords.length,
      openAlerts: alerts.length,
      exceptionJobs,
      failedIntegrationProbes: failedProbeCount,
      managedStaffAccounts: staffAccounts.length,
      openProductionErrors: productionErrors.length,
    },
    checks,
  };
}
