import { getCustomerAccounts } from "./customerAccountStore";
import { getSql, hasPostgresConfig } from "./db";
import { getDocuments } from "./documentStore";
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

export async function evaluateLaunchReadiness(surfaceOverride?: LaunchSurface): Promise<LaunchReadiness> {
  const [dbConnected, coreData, customerAccounts, documents] = await Promise.all([
    canConnectPostgres(),
    getWarehouseCoreData(),
    getCustomerAccounts(),
    getDocuments(),
  ]);

  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const surface = surfaceOverride ?? normaliseSurface(process.env.WAREHOUSE_SURFACE || process.env.NEXT_PUBLIC_WAREHOUSE_SURFACE);
  const isAdminSurface = surface === "admin" || surface === "platform";
  const hasSharedDb = hasPostgresConfig() && dbConnected;
  const hasCustomerUrl = Boolean(process.env.NEXT_PUBLIC_CUSTOMER_APP_URL);
  const hasAdminUrl = Boolean(process.env.NEXT_PUBLIC_ADMIN_URL);
  const hasMarketingUrl = Boolean(process.env.NEXT_PUBLIC_MARKETING_URL);
  const hasStaffWhitelist = Boolean(process.env.STAFF_WHITELIST_JSON);
  const allowsDemoCustomerLogin = process.env.ALLOW_DEMO_LOGIN === "true";
  const allowsDemoStaffLogin = process.env.ALLOW_DEMO_STAFF_LOGIN === "true";

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
      status: hasSharedDb ? "pass" : isProduction ? "fail" : "warn",
      detail: hasSharedDb ? "上传资料会写入数据库 payload，避免 Vercel /tmp 丢失。" : "上传资料仍依赖本地文件存储，生产不可直接开放。",
      owner: "后端",
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
      status: hasStaffWhitelist || !isProduction ? "pass" : isAdminSurface ? "fail" : "warn",
      detail: hasStaffWhitelist ? "生产员工账号来自 STAFF_WHITELIST_JSON。" : isAdminSurface ? "运营后台生产必须配置 STAFF_WHITELIST_JSON。" : "当前不是运营后台域名，员工白名单不阻塞客户侧健康检查。",
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
    },
  };
}
