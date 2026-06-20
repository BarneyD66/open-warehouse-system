import { getCustomerAccounts } from "./customerAccountStore";
import { getSql, hasPostgresConfig } from "./db";
import { getDocuments } from "./documentStore";
import { getOpsExpansionData, type LogisticsChannelConfig } from "./opsExpansionStore";
import { getManagedStaffAccounts } from "./staffAccountStore";
import { getStaffWhitelistView } from "./staffAuth";
import { getWarehouseCoreData } from "./warehouseCoreStore";

export type LaunchCheckStatus = "pass" | "warn" | "fail";

export type LaunchCheck = {
  id: string;
  label: string;
  status: LaunchCheckStatus;
  detail: string;
  owner: "产品" | "前端" | "后端" | "运营";
};

export type LaunchReadiness = {
  status: LaunchCheckStatus;
  score: number;
  generatedAt: string;
  environment: string;
  checks: LaunchCheck[];
  metrics: {
    customers: number;
    customerAccounts: number;
    documents: number;
    billingRecords: number;
    openOutboundOrders: number;
    openReturns: number;
    locations: number;
    activeLogisticsChannels: number;
    platformConnections: number;
    managedStaffAccounts: number;
  };
};

export type LaunchSurface = "marketing" | "customer" | "admin" | "platform";

function normaliseSurface(value?: string): LaunchSurface {
  const normalised = value?.toLowerCase();
  if (normalised === "web" || normalised === "site" || normalised === "marketing") return "marketing";
  if (normalised === "app" || normalised === "portal" || normalised === "customer") return "customer";
  if (normalised === "admin" || normalised === "ops") return "admin";
  return "platform";
}

function worstStatus(statuses: LaunchCheckStatus[]): LaunchCheckStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
}

function scoreFor(checks: LaunchCheck[]) {
  if (checks.length === 0) return 0;
  const points = checks.reduce((sum, check) => sum + (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0), 0);
  return Math.round((points / checks.length) * 100);
}

async function canConnectPostgres() {
  if (!hasPostgresConfig()) return false;
  try {
    const sql = getSql();
    await sql`select 1 as ok`;
    return true;
  } catch {
    return false;
  }
}

function logisticsChannelIssues(channel: LogisticsChannelConfig) {
  const features = channel.enabledFeatures.join(" ");
  return [
    channel.status === "paused" ? "渠道暂停" : "",
    channel.status === "draft" ? "未启用" : "",
    channel.apiMode !== "manual" && !channel.credentialRef ? "缺少承运商凭证引用" : "",
    channel.apiMode === "live" && !channel.trackingWebhook ? "正式接口缺少轨迹回传地址" : "",
    channel.apiMode !== "manual" && !features.includes("面单购买") ? "缺面单购买能力" : "",
    channel.apiMode !== "manual" && !features.includes("轨迹自动回传") ? "缺轨迹自动回传" : "",
    !features.includes("派送失败处理") ? "缺派送失败处理" : "",
    !features.includes("签收证明") ? "缺签收证明" : "",
    !features.includes("物流赔付") ? "缺物流赔付" : "",
    channel.surchargeRules.length === 0 ? "未配置附加费规则" : "",
  ].filter(Boolean);
}

export async function evaluateLaunchReadiness(surfaceOverride?: LaunchSurface): Promise<LaunchReadiness> {
  const [dbConnected, coreData, customerAccounts, documents, expansionData, managedStaffAccounts] = await Promise.all([
    canConnectPostgres(),
    getWarehouseCoreData(),
    getCustomerAccounts(),
    getDocuments(),
    getOpsExpansionData(),
    getManagedStaffAccounts(),
  ]);

  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const surface = surfaceOverride ?? normaliseSurface(process.env.WAREHOUSE_SURFACE || process.env.NEXT_PUBLIC_WAREHOUSE_SURFACE);
  const isAdminSurface = surface === "admin" || surface === "platform";
  const hasSharedDb = hasPostgresConfig() && dbConnected;
  const hasCustomerUrl = Boolean(process.env.NEXT_PUBLIC_CUSTOMER_APP_URL);
  const hasAdminUrl = Boolean(process.env.NEXT_PUBLIC_ADMIN_URL);
  const hasMarketingUrl = Boolean(process.env.NEXT_PUBLIC_MARKETING_URL);
  const staffWhitelist = getStaffWhitelistView();
  const hasStaffWhitelist = Boolean(process.env.STAFF_WHITELIST_JSON);
  const staffWhitelistRisks = staffWhitelist.flatMap((account) => account.risks);
  const allowsDemoCustomerLogin = process.env.ALLOW_DEMO_LOGIN === "true";
  const allowsDemoStaffLogin = process.env.ALLOW_DEMO_STAFF_LOGIN === "true";
  const locationsWithCapacity = coreData.locations.filter((item) => typeof item.capacityQty === "number" && item.capacityQty > 0).length;
  const riskyLocations = coreData.locations.filter((location) => location.status !== "active" || typeof location.capacityQty !== "number" || location.capacityQty <= 0);
  const activeChannels = expansionData.logisticsChannels.filter((item) => item.status === "active");
  const readyChannels = activeChannels.filter((item) => logisticsChannelIssues(item).length === 0);
  const sandboxChannels = expansionData.logisticsChannels.filter((item) => item.status === "sandbox");
  const apiPlatformConnections = expansionData.platformConnections.filter((item) => item.syncMode !== "manual_csv");
  const objectStorageConfigured = Boolean(process.env.OBJECT_STORAGE_UPLOAD_URL || process.env.BLOB_UPLOAD_URL);
  const blockedDocuments = documents.filter((item) => item.scanStatus === "blocked").length;
  const pendingDocuments = documents.filter((item) => !item.scanStatus || item.scanStatus === "pending").length;
  const localDocuments = documents.filter((item) => item.storageProvider === "local").length;

  const checks: LaunchCheck[] = [
    {
      id: "shared-db",
      label: "共享数据库",
      status: hasSharedDb ? "pass" : isProduction ? "fail" : "warn",
      detail: hasSharedDb ? "Postgres 已配置并可连接，核心业务数据可跨部署保留。" : "未确认 Postgres 可用，生产数据可能落到临时存储。",
      owner: "后端",
    },
    {
      id: "document-storage",
      label: "资料持久化",
      status: hasSharedDb || objectStorageConfigured ? "pass" : isProduction ? "fail" : "warn",
      detail: objectStorageConfigured ? "对象存储上传网关已配置，文件可从业务数据库之外持久化归档。" : hasSharedDb ? "上传资料会写入数据库 payload，避免 Vercel /tmp 丢失。" : "上传资料仍依赖本地文件存储，生产不可直接开放。",
      owner: "后端",
    },
    {
      id: "document-security",
      label: "文件安全扫描",
      status: blockedDocuments > 0 ? "fail" : pendingDocuments > 0 || (isProduction && localDocuments > 0) ? "warn" : "pass",
      detail:
        blockedDocuments > 0
          ? `当前有 ${blockedDocuments} 个文件被安全扫描拦截，需要重新上传或复核。`
          : pendingDocuments > 0
            ? `当前有 ${pendingDocuments} 个文件仍待扫描；建议上线前确认病毒扫描服务和文件台账。`
            : isProduction && localDocuments > 0
              ? `当前有 ${localDocuments} 个文件仍在本地存储，建议迁移到对象存储或数据库归档。`
              : "文件基础扫描通过，上传资料可在资料中心查看扫描和存储状态。",
      owner: "运营",
    },
    {
      id: "surface-routing",
      label: "三端访问域名",
      status: hasCustomerUrl && hasAdminUrl && hasMarketingUrl ? "pass" : "warn",
      detail: hasCustomerUrl && hasAdminUrl && hasMarketingUrl ? "官网、客户工作台、运营后台域名均已配置。" : "至少一个 NEXT_PUBLIC_*_URL 未配置，跨端跳转可能回到当前域名。",
      owner: "前端",
    },
    {
      id: "staff-whitelist",
      label: "员工白名单",
      status: managedStaffAccounts.length > 0 || (hasStaffWhitelist && staffWhitelistRisks.length === 0) ? "pass" : !isProduction && staffWhitelist.length > 0 ? "pass" : isAdminSurface ? "fail" : "warn",
      detail:
        managedStaffAccounts.length > 0
          ? `已启用后台员工账号治理，当前正式员工 ${managedStaffAccounts.length} 个。`
          : staffWhitelist.length > 0
          ? `当前白名单 ${staffWhitelist.length} 个，来源：${staffWhitelist[0]?.source ?? "未配置"}${staffWhitelistRisks.length > 0 ? `，风险：${Array.from(new Set(staffWhitelistRisks)).join("、")}` : "，未发现白名单风险"}。`
          : isAdminSurface
            ? "运营后台生产必须配置 STAFF_WHITELIST_JSON。"
            : "当前不是运营后台域名，员工白名单不阻塞客户侧健康检查。",
      owner: "运营",
    },
    {
      id: "demo-login",
      label: "演示登录开关",
      status: isProduction && (allowsDemoCustomerLogin || allowsDemoStaffLogin) ? "fail" : "pass",
      detail: isProduction && (allowsDemoCustomerLogin || allowsDemoStaffLogin) ? "生产仍允许演示登录，需要关闭 ALLOW_DEMO_LOGIN / ALLOW_DEMO_STAFF_LOGIN。" : "生产不会主动打开演示登录。",
      owner: "后端",
    },
    {
      id: "customer-account",
      label: "客户账号能力",
      status: customerAccounts.length > 0 || coreData.customers.length > 0 ? "pass" : "warn",
      detail: `当前客户档案 ${coreData.customers.length} 个，注册账号 ${customerAccounts.length} 个。`,
      owner: "产品",
    },
    {
      id: "operations-workflow",
      label: "仓储物流闭环",
      status: coreData.outboundOrders.length > 0 && coreData.billingRecords.length > 0 ? "pass" : "warn",
      detail: `出库单 ${coreData.outboundOrders.length} 个，账单 ${coreData.billingRecords.length} 条，退货单 ${coreData.returnOrders.length} 个。`,
      owner: "产品",
    },
    {
      id: "billing-readiness",
      label: "账单对账闭环",
      status: coreData.billingRecords.some((record) => record.statementId || record.statementMonth) ? "pass" : "warn",
      detail: coreData.billingRecords.some((record) => record.statementId || record.statementMonth) ? "月结单确认、收款和开票状态已有数据结构支撑。" : "已有账单明细，但还没有月结单动作记录。",
      owner: "产品",
    },
    {
      id: "location-capacity",
      label: "库位容量与风险",
      status: coreData.locations.length > 0 && riskyLocations.length === 0 ? "pass" : coreData.locations.length > 0 && locationsWithCapacity > 0 ? "warn" : "fail",
      detail:
        coreData.locations.length === 0
          ? "还没有库位资料，仓库无法按库区、容量和混放规则执行日常上架。"
          : `库位 ${coreData.locations.length} 个，已配置容量 ${locationsWithCapacity} 个，需复核 ${riskyLocations.length} 个。`,
      owner: "运营",
    },
    {
      id: "carrier-integration",
      label: "承运商闭环",
      status: readyChannels.length > 0 ? "pass" : sandboxChannels.length > 0 || activeChannels.length > 0 ? "warn" : "fail",
      detail:
        readyChannels.length > 0
          ? `已有 ${readyChannels.length} 个可上线渠道，面单、轨迹、派送失败、签收证明和赔付能力已配置。`
          : expansionData.logisticsChannels.length > 0
            ? `物流渠道 ${expansionData.logisticsChannels.length} 个，但还没有完整可上线渠道，请补齐 webhook、面单购买、轨迹回传和赔付能力。`
            : "还没有配置物流渠道，正式发货前需要至少配置一个承运商服务。",
      owner: "运营",
    },
    {
      id: "platform-api-sync",
      label: "平台订单 API 同步",
      status: apiPlatformConnections.some((item) => item.status === "connected") ? "pass" : apiPlatformConnections.length > 0 ? "warn" : "fail",
      detail:
        apiPlatformConnections.length > 0
          ? `已配置 API 型平台连接 ${apiPlatformConnections.length} 个，已连通 ${apiPlatformConnections.filter((item) => item.status === "connected").length} 个。`
          : "还没有 Amazon、TikTok Shop、Shopify 或 eBay API 型连接，当前只能依赖 CSV 导入。",
      owner: "运营",
    },
    {
      id: "backup-readiness",
      label: "备份与恢复准备",
      status: hasSharedDb || !isProduction ? "pass" : "warn",
      detail: hasSharedDb ? "系统备份接口已可导出业务快照，生产数据库也已独立持久化。" : "当前可导出 JSON 快照，但生产仍建议配置共享数据库和外部备份策略。",
      owner: "后端",
    },
  ];

  return {
    status: worstStatus(checks.map((check) => check.status)),
    score: scoreFor(checks),
    generatedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    checks,
    metrics: {
      customers: coreData.customers.length,
      customerAccounts: customerAccounts.length,
      documents: documents.length,
      billingRecords: coreData.billingRecords.length,
      openOutboundOrders: coreData.outboundOrders.filter((order) => order.status !== "shipped").length,
      openReturns: coreData.returnOrders.filter((order) => order.status !== "closed").length,
      locations: coreData.locations.length,
      activeLogisticsChannels: activeChannels.length,
      platformConnections: expansionData.platformConnections.length,
      managedStaffAccounts: managedStaffAccounts.length,
    },
  };
}
