import { carrierProviderFromText } from "./carrierGateway";
import { getNotificationDeliveries } from "./notificationStore";
import { getOpsExpansionData, type PlatformConnection, type PlatformKind } from "./opsExpansionStore";

export type IntegrationReadinessStatus = "ready" | "partial" | "blocked";

export type IntegrationEnvRequirement = {
  name: string;
  present: boolean;
  description: string;
  required: boolean;
};

export type ProductionIntegrationReadinessItem = {
  id: string;
  group: "carrier" | "platform" | "storage" | "notification" | "reporting" | "security";
  name: string;
  status: IntegrationReadinessStatus;
  mode?: string;
  summary: string;
  env: IntegrationEnvRequirement[];
  linkedRecords?: number;
  nextActions: string[];
};

export type ProductionIntegrationReadiness = {
  generatedAt: string;
  status: IntegrationReadinessStatus;
  score: number;
  items: ProductionIntegrationReadinessItem[];
  summary: {
    ready: number;
    partial: number;
    blocked: number;
  };
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function envRequirement(name: string, description: string, required = true): IntegrationEnvRequirement {
  return { name, description, required, present: hasEnv(name) };
}

function platformPrefix(platform: PlatformKind) {
  return platform.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function parseCredentialRef(note?: string) {
  return note?.match(/credentialRef\s*=\s*([A-Za-z0-9_]+)/i)?.[1];
}

function providerPrefixFromCarrier(text: string) {
  return carrierProviderFromText(text).toUpperCase();
}

function itemScore(status: IntegrationReadinessStatus) {
  if (status === "ready") return 1;
  if (status === "partial") return 0.5;
  return 0;
}

function statusFromBooleans(requiredReady: boolean, partialReady: boolean, hasNonProductionMode = false): IntegrationReadinessStatus {
  if (requiredReady && !hasNonProductionMode) return "ready";
  if (requiredReady || partialReady) return "partial";
  return "blocked";
}

function featureMissing(features: string, label: string) {
  return !features.includes(label);
}

function carrierItems(data: Awaited<ReturnType<typeof getOpsExpansionData>>): ProductionIntegrationReadinessItem[] {
  const activeChannels = data.logisticsChannels.filter((item) => item.status !== "draft" && item.status !== "paused");
  if (activeChannels.length === 0) {
    return [{
      id: "carrier:none",
      group: "carrier",
      name: "承运商 API",
      status: "blocked",
      summary: "还没有启用的物流渠道，真实面单购买、取消面单、轨迹回传和签收证明无法进入生产闭环。",
      env: [],
      linkedRecords: 0,
      nextActions: ["至少配置一个 Royal Mail、DPD 或 Evri 渠道", "为渠道填写凭证引用、面单购买、轨迹回传、签收证明、派送失败处理和赔付能力"],
    }];
  }

  return activeChannels.map((channel) => {
    const providerPrefix = providerPrefixFromCarrier(channel.carrierName);
    const credentialRef = channel.credentialRef?.trim();
    const credentialEnv = credentialRef || `${providerPrefix}_API_KEY`;
    const endpointEnv = credentialRef ? `${credentialRef}_BASE_URL` : `${providerPrefix}_${channel.apiMode.toUpperCase()}_BASE_URL`;
    const gatewayEnv = credentialRef ? `${credentialRef}_ENDPOINT` : `${providerPrefix}_CARRIER_GATEWAY_URL`;
    const trackingEnv = credentialRef ? `${credentialRef}_TRACKING_URL` : `${providerPrefix}_TRACKING_URL`;
    const proofEnv = credentialRef ? `${credentialRef}_PROOF_URL` : `${providerPrefix}_PROOF_URL`;

    const requirements =
      channel.apiMode === "manual"
        ? []
        : [
            envRequirement(credentialEnv, "承运商 API Token 或密钥"),
            envRequirement(endpointEnv, "承运商网关基础地址", false),
            envRequirement(gatewayEnv, "承运商统一网关备用地址", false),
            envRequirement("CARRIER_WEBHOOK_SECRET", "承运商轨迹 webhook 统一签名密钥", false),
            envRequirement(`${providerPrefix}_WEBHOOK_SECRET`, "承运商轨迹 webhook 独立签名密钥", false),
            envRequirement(trackingEnv, "承运商轨迹主动同步地址", false),
            envRequirement(proofEnv, "承运商 POD 签收证明地址", false),
            envRequirement("CARRIER_LABEL_RETRY_SECRET", "承运商面单自动重试密钥", false),
            envRequirement("CARRIER_TRACKING_SYNC_SECRET", "承运商轨迹/POD 自动同步密钥", false),
            envRequirement("CRON_SECRET", "Cron 统一调用密钥", false),
          ];

    const features = channel.enabledFeatures.join(" ");
    const missingFeatureActions = [
      featureMissing(features, "面单购买") ? "补齐面单购买能力" : "",
      featureMissing(features, "轨迹自动回传") ? "补齐轨迹自动回传能力" : "",
      featureMissing(features, "签收证明") ? "补齐签收证明/POD 能力" : "",
      featureMissing(features, "派送失败处理") ? "补齐派送失败处理规则" : "",
      featureMissing(features, "物流赔付") ? "补齐物流赔付流程" : "",
      channel.surchargeRules.length === 0 ? "补齐燃油、偏远、超尺寸等附加费规则" : "",
      !channel.trackingWebhook ? "填写承运商轨迹回传地址" : "",
      channel.apiMode !== "live" ? "上线前切换到 live，并完成承运商沙箱到正式验收" : "",
    ].filter(Boolean);

    const hasCredential = channel.apiMode === "manual" || hasEnv(credentialEnv);
    const hasEndpoint = channel.apiMode === "manual" || hasEnv(endpointEnv) || hasEnv(gatewayEnv);
    const hasWebhookSecret = hasEnv("CARRIER_WEBHOOK_SECRET") || hasEnv(`${providerPrefix}_WEBHOOK_SECRET`);
    const hasRetrySecret = hasEnv("CARRIER_LABEL_RETRY_SECRET") || hasEnv("CRON_SECRET");
    const hasTrackingSyncSecret = hasEnv("CARRIER_TRACKING_SYNC_SECRET") || hasEnv("CRON_SECRET");
    const requiredReady = channel.apiMode !== "manual" && hasCredential && hasEndpoint && hasWebhookSecret && hasRetrySecret && hasTrackingSyncSecret && missingFeatureActions.length === 0;
    const partialReady = channel.apiMode === "manual" || hasCredential || hasEndpoint || channel.enabledFeatures.length > 0;
    const status = statusFromBooleans(requiredReady, partialReady, channel.apiMode !== "live");

    return {
      id: `carrier:${channel.id}`,
      group: "carrier",
      name: `${channel.carrierName} / ${channel.serviceName}`,
      status,
      mode: channel.apiMode,
      summary:
        status === "ready"
          ? "承运商凭证、网关、webhook、面单重试和业务能力已具备生产闭环。"
          : channel.apiMode === "manual"
            ? "当前是人工渠道，可作为兜底，但还不是真实承运商 API 闭环。"
            : "承运商 API 仍有凭证、网关、webhook、自动重试或业务能力缺口。",
      env: requirements,
      linkedRecords: 1,
      nextActions: [
        !hasCredential && channel.apiMode !== "manual" ? `配置 ${credentialEnv}` : "",
        !hasEndpoint && channel.apiMode !== "manual" ? `配置 ${endpointEnv} 或 ${gatewayEnv}` : "",
        !hasWebhookSecret && channel.apiMode !== "manual" ? "配置 CARRIER_WEBHOOK_SECRET 或承运商独立 webhook 密钥" : "",
        !hasRetrySecret && channel.apiMode !== "manual" ? "配置 CARRIER_LABEL_RETRY_SECRET 或 CRON_SECRET，并让调度器调用 /api/ops/carrier-labels/retry-due" : "",
        !hasTrackingSyncSecret && channel.apiMode !== "manual" ? "配置 CARRIER_TRACKING_SYNC_SECRET 或 CRON_SECRET，并让调度器调用 /api/ops/carrier-tracking/sync-due" : "",
        ...missingFeatureActions,
        requiredReady ? "完成真实下单、取消面单、轨迹回传和 POD 联调验收" : "",
      ].filter(Boolean),
    };
  });
}

function platformItems(data: Awaited<ReturnType<typeof getOpsExpansionData>>): ProductionIntegrationReadinessItem[] {
  const apiConnections = data.platformConnections.filter((item) => item.syncMode !== "manual_csv");
  if (apiConnections.length === 0) {
    return [{
      id: "platform:none",
      group: "platform",
      name: "平台订单 API 同步",
      status: "blocked",
      summary: "当前还没有 Amazon、TikTok Shop、Shopify 或 eBay 的 API 型连接，订单仍主要依赖 CSV。",
      env: [],
      linkedRecords: data.platformConnections.length,
      nextActions: ["为至少一个平台创建 API 沙箱或正式连接", "在连接备注中填写 credentialRef=XXX，或配置平台默认 Token/URL"],
    }];
  }
  return apiConnections.map((connection) => platformConnectionItem(connection));
}

function platformSpecificEnv(connection: PlatformConnection, credentialRef: string | undefined) {
  if (connection.platform === "amazon") {
    return [
      envRequirement(credentialRef ? `${credentialRef}_MARKETPLACE_ID` : "AMAZON_MARKETPLACE_ID", "Amazon Marketplace ID，英国站默认 A1F83G8C2ARO7P", false),
      envRequirement(credentialRef ? `${credentialRef}_SELLER_ID` : "AMAZON_SELLER_ID", "Amazon Seller ID，用于 SP-API 签名网关", false),
    ];
  }
  if (connection.platform === "tiktok_shop") {
    return [
      envRequirement(credentialRef ? `${credentialRef}_APP_KEY` : "TIKTOK_SHOP_APP_KEY", "TikTok Shop App Key，用于开放平台签名网关", false),
      envRequirement(credentialRef ? `${credentialRef}_SHOP_ID` : "TIKTOK_SHOP_SHOP_ID", "TikTok Shop 店铺 ID", false),
    ];
  }
  return [];
}

function platformSpecificActions(connection: PlatformConnection) {
  if (connection.platform === "amazon") return ["Amazon 正式联调建议通过 SP-API 签名网关暴露订单拉取和发货回传地址，系统负责订单归一化、取消复核和追踪号回传留痕"];
  if (connection.platform === "tiktok_shop") return ["TikTok Shop 正式联调建议通过开放平台签名网关暴露订单搜索和发货回传地址，系统负责订单归一化、取消复核和追踪号回传留痕"];
  return [];
}

function platformConnectionItem(connection: PlatformConnection): ProductionIntegrationReadinessItem {
  const prefix = platformPrefix(connection.platform);
  const credentialRef = parseCredentialRef(connection.note);
  const tokenEnv = credentialRef || `${prefix}_API_TOKEN`;
  const accessTokenEnv = credentialRef ? `${credentialRef}_ACCESS_TOKEN` : `${prefix}_ACCESS_TOKEN`;
  const ordersEnv = credentialRef ? `${credentialRef}_ORDERS_URL` : `${prefix}_ORDERS_URL`;
  const baseEnv = credentialRef ? `${credentialRef}_API_BASE_URL` : `${prefix}_API_BASE_URL`;
  const fulfillmentEnv = credentialRef ? `${credentialRef}_FULFILLMENT_URL` : `${prefix}_FULFILLMENT_URL`;

  const requirements = [
    envRequirement(tokenEnv, "平台 API Token 或 OAuth 访问令牌", false),
    envRequirement(accessTokenEnv, "平台访问令牌备用变量", false),
    envRequirement(ordersEnv, "平台拉单地址", false),
    envRequirement(baseEnv, "平台统一 API 基础地址", false),
    envRequirement(fulfillmentEnv, "平台发货追踪号回传地址", false),
    ...platformSpecificEnv(connection, credentialRef),
    envRequirement("PLATFORM_WEBHOOK_SECRET", "平台 webhook 统一签名密钥", false),
    envRequirement(`${prefix}_WEBHOOK_SECRET`, "平台 webhook 独立签名密钥", false),
    envRequirement("PLATFORM_ORDER_SYNC_SECRET", "平台订单自动同步密钥", false),
    envRequirement("PLATFORM_CANCELLATION_REVIEW_SECRET", "平台取消订单复核密钥", false),
    envRequirement("PLATFORM_FULFILLMENT_RETRY_SECRET", "平台发货回传自动重试密钥", false),
    envRequirement("CRON_SECRET", "Cron 统一调用密钥", false),
  ];

  const hasToken = hasEnv(tokenEnv) || hasEnv(accessTokenEnv);
  const hasOrdersEndpoint = hasEnv(ordersEnv) || hasEnv(baseEnv);
  const hasFulfillmentEndpoint = hasEnv(fulfillmentEnv) || hasEnv(baseEnv);
  const hasWebhookSecret = hasEnv("PLATFORM_WEBHOOK_SECRET") || hasEnv(`${prefix}_WEBHOOK_SECRET`);
  const hasOrderSyncSecret = hasEnv("PLATFORM_ORDER_SYNC_SECRET") || hasEnv("CRON_SECRET");
  const hasCancellationReviewSecret = hasEnv("PLATFORM_CANCELLATION_REVIEW_SECRET") || hasOrderSyncSecret || hasEnv("CRON_SECRET");
  const hasFulfillmentRetrySecret = hasEnv("PLATFORM_FULFILLMENT_RETRY_SECRET") || hasEnv("CRON_SECRET");
  const requiredReady = connection.syncMode === "api_live" && connection.status === "connected" && hasToken && hasOrdersEndpoint && hasFulfillmentEndpoint && hasWebhookSecret && hasOrderSyncSecret && hasCancellationReviewSecret && hasFulfillmentRetrySecret;
  const partialReady = hasToken || hasOrdersEndpoint || connection.syncMode === "api_sandbox";
  const status = statusFromBooleans(requiredReady, partialReady, connection.syncMode !== "api_live" || connection.status !== "connected");

  return {
    id: `platform:${connection.id}`,
    group: "platform",
    name: `${connection.platform} / ${connection.storeName}`,
    status,
    mode: connection.syncMode,
    summary:
      status === "ready"
        ? "平台拉单、取消订单 webhook、发货追踪号回传和自动重试已具备生产条件。"
        : connection.syncMode === "api_sandbox"
          ? "当前是 API 沙箱连接，还需要正式授权、回传地址和生产调度。"
          : "平台 API 连接仍缺 Token、拉单地址、发货回传地址、webhook 密钥或自动重试密钥。",
    env: requirements,
    linkedRecords: 1,
    nextActions: [
      !hasToken ? `配置 ${tokenEnv} 或 ${accessTokenEnv}` : "",
      !hasOrdersEndpoint ? `配置 ${ordersEnv} 或 ${baseEnv}` : "",
      !hasFulfillmentEndpoint ? `配置 ${fulfillmentEnv} 或 ${baseEnv}` : "",
      ...platformSpecificActions(connection),
      !hasWebhookSecret ? "配置 PLATFORM_WEBHOOK_SECRET 或平台独立 webhook 密钥，用于接收平台取消/作废订单事件" : "",
      !hasOrderSyncSecret ? "配置 PLATFORM_ORDER_SYNC_SECRET 或 CRON_SECRET，并让调度器调用 /api/ops/platform-orders/sync-due" : "",
      !hasCancellationReviewSecret ? "配置 PLATFORM_CANCELLATION_REVIEW_SECRET 或复用 PLATFORM_ORDER_SYNC_SECRET，并让调度器调用 /api/ops/platform-orders/cancellation-review" : "",
      !hasFulfillmentRetrySecret ? "配置 PLATFORM_FULFILLMENT_RETRY_SECRET 或 CRON_SECRET，并让调度器调用 /api/ops/platform-fulfillment/retry-due" : "",
      connection.syncMode !== "api_live" ? "上线前切换为 API 正式模式" : "",
      connection.status !== "connected" ? "把平台连接状态调整为已连接" : "",
    ].filter(Boolean),
  };
}

function infrastructureItems(deliveryCount: number): ProductionIntegrationReadinessItem[] {
  const storageEnv = [
    envRequirement("OBJECT_STORAGE_UPLOAD_URL", "对象存储上传网关", false),
    envRequirement("OBJECT_STORAGE_TOKEN", "对象存储上传令牌", false),
    envRequirement("BLOB_UPLOAD_URL", "Vercel Blob 上传地址", false),
    envRequirement("BLOB_READ_WRITE_TOKEN", "Vercel Blob 读写令牌", false),
  ];
  const hasStorageEndpoint = hasEnv("OBJECT_STORAGE_UPLOAD_URL") || hasEnv("BLOB_UPLOAD_URL");
  const hasStorageToken = hasEnv("OBJECT_STORAGE_TOKEN") || hasEnv("BLOB_READ_WRITE_TOKEN");

  const notificationEnv = [
    envRequirement("NOTIFICATION_EMAIL_WEBHOOK_URL", "邮件投递 webhook", false),
    envRequirement("NOTIFICATION_SMS_WEBHOOK_URL", "短信投递 webhook", false),
    envRequirement("NOTIFICATION_WECHAT_WEBHOOK_URL", "微信投递 webhook", false),
    envRequirement("NOTIFICATION_DELIVERY_WEBHOOK_URL", "统一通知投递 webhook", false),
    envRequirement("NOTIFICATION_DELIVERY_TOKEN", "通知投递签名令牌", false),
    envRequirement("NOTIFICATION_RETRY_SECRET", "通知投递自动重试密钥", false),
    envRequirement("CRON_SECRET", "Cron 统一调用密钥", false),
  ];
  const hasNotificationWebhook = notificationEnv.some((item) => item.name.endsWith("_WEBHOOK_URL") && item.present);
  const hasNotificationToken = hasEnv("NOTIFICATION_DELIVERY_TOKEN");
  const hasNotificationRetrySecret = hasEnv("NOTIFICATION_RETRY_SECRET") || hasEnv("CRON_SECRET");

  const reportingEnv = [
    envRequirement("REPORT_DELIVERY_WEBHOOK_URL", "定时报表外部投递 webhook", false),
    envRequirement("REPORT_DELIVERY_TOKEN", "定时报表投递令牌", false),
    envRequirement("REPORT_SCHEDULE_SECRET", "定时报表 Cron 调用密钥", false),
  ];

  const securityEnv = [
    envRequirement("POSTGRES_URL", "生产共享数据库", false),
    envRequirement("DATABASE_URL", "生产共享数据库备用变量", false),
    envRequirement("SESSION_SECRET", "会话签名密钥", false),
    envRequirement("AUTH_SECRET", "会话签名密钥备用变量", false),
    envRequirement("STAFF_WHITELIST_JSON", "正式员工白名单兜底配置", false),
    envRequirement("MAX_UPLOAD_BYTES", "最大上传大小限制", false),
    envRequirement("VIRUS_SCAN_WEBHOOK_URL", "病毒扫描服务 webhook", false),
    envRequirement("CLAMAV_SCAN_URL", "ClamAV 扫描服务地址", false),
    envRequirement("VIRUS_SCAN_TOKEN", "病毒扫描服务鉴权令牌", false),
    envRequirement("JOB_RUN_SECRET", "批量任务自动执行密钥", false),
    envRequirement("JOB_RETRY_SECRET", "批量任务自动重试密钥", false),
    envRequirement("AUTOMATION_RUN_SECRET", "统一生产自动化调度密钥", false),
    envRequirement("CRON_SECRET", "Cron 统一调用密钥", false),
  ];
  const hasDatabase = hasEnv("POSTGRES_URL") || hasEnv("DATABASE_URL");
  const hasSessionSecret = hasEnv("SESSION_SECRET") || hasEnv("AUTH_SECRET");
  const hasVirusScan = hasEnv("VIRUS_SCAN_WEBHOOK_URL") || hasEnv("CLAMAV_SCAN_URL");
  const hasJobRunSecret = hasEnv("JOB_RUN_SECRET") || hasEnv("CRON_SECRET");
  const hasJobRetrySecret = hasEnv("JOB_RETRY_SECRET") || hasEnv("CRON_SECRET");
  const hasAutomationSecret = hasEnv("AUTOMATION_RUN_SECRET") || hasEnv("CRON_SECRET");

  return [
    {
      id: "storage:object",
      group: "storage",
      name: "对象存储与安全下载",
      status: hasStorageEndpoint && hasStorageToken ? "ready" : hasStorageEndpoint || hasStorageToken ? "partial" : "blocked",
      summary: hasStorageEndpoint && hasStorageToken ? "上传文件可进入对象存储，并通过系统签名下载/预览。" : "对象存储尚未完整配置，线上文件仍可能依赖临时目录或数据库 payload。",
      env: storageEnv,
      nextActions: ["配置对象存储上传网关和令牌", "生产建议使用 Vercel Blob、S3 或自建对象存储中间层"],
    },
    {
      id: "notification:delivery",
      group: "notification",
      name: "邮件/短信/微信通知投递",
      status: hasNotificationWebhook && hasNotificationToken && hasNotificationRetrySecret ? "ready" : hasNotificationWebhook || hasNotificationRetrySecret ? "partial" : "blocked",
      summary: hasNotificationWebhook ? `已具备外部通知投递入口，当前已有 ${deliveryCount} 条投递台账。` : "站内信可用，但邮件、短信、微信供应商 webhook 尚未配置。",
      env: notificationEnv,
      linkedRecords: deliveryCount,
      nextActions: [
        !hasNotificationWebhook ? "配置统一通知 webhook，或分别配置邮件/短信/微信 webhook" : "",
        !hasNotificationToken ? "配置 NOTIFICATION_DELIVERY_TOKEN 用于供应商侧鉴权" : "",
        !hasNotificationRetrySecret ? "配置 NOTIFICATION_RETRY_SECRET 或 CRON_SECRET，并让调度器调用 /api/ops/notifications/deliveries/retry-due" : "",
      ].filter(Boolean),
    },
    {
      id: "reporting:delivery",
      group: "reporting",
      name: "定时报表外部发送",
      status: hasEnv("REPORT_DELIVERY_WEBHOOK_URL") && hasEnv("REPORT_SCHEDULE_SECRET") ? "ready" : hasEnv("REPORT_DELIVERY_WEBHOOK_URL") || hasEnv("REPORT_SCHEDULE_SECRET") ? "partial" : "blocked",
      summary: "定时报表需要外部投递地址和 Cron 调用密钥，才能从手动下载升级为自动发送。",
      env: reportingEnv,
      nextActions: ["配置 REPORT_DELIVERY_WEBHOOK_URL", "配置 REPORT_SCHEDULE_SECRET，并在 Vercel Cron 或外部调度器中使用"],
    },
    {
      id: "security:runtime",
      group: "security",
      name: "生产运行安全与扫描",
      status: hasDatabase && hasSessionSecret && hasVirusScan && hasJobRunSecret && hasJobRetrySecret && hasAutomationSecret ? "ready" : hasDatabase && hasSessionSecret ? "partial" : "blocked",
      summary: hasVirusScan && hasJobRetrySecret && hasAutomationSecret ? "生产数据库、会话密钥、外部病毒扫描、任务重试和统一调度配置较完整。" : "已有基础文件安全规则，正式生产仍建议接入病毒扫描、任务自动重试和统一自动化调度。",
      env: securityEnv,
      nextActions: [
        !hasDatabase ? "配置生产数据库 POSTGRES_URL 或 DATABASE_URL" : "",
        !hasSessionSecret ? "配置 SESSION_SECRET 或 AUTH_SECRET" : "",
        !hasVirusScan ? "接入 VIRUS_SCAN_WEBHOOK_URL 或 CLAMAV_SCAN_URL" : "",
        !hasJobRunSecret ? "配置 JOB_RUN_SECRET 或 CRON_SECRET，用于批量任务自动执行" : "",
        !hasJobRetrySecret ? "配置 JOB_RETRY_SECRET 或 CRON_SECRET，并让调度器调用 /api/ops/jobs/retry-due" : "",
        !hasAutomationSecret ? "配置 AUTOMATION_RUN_SECRET 或 CRON_SECRET，并让调度器调用 /api/ops/automation/run-due" : "",
        "保留 STAFF_WHITELIST_JSON 作为员工登录兜底",
      ].filter(Boolean),
    },
  ];
}

export async function evaluateProductionIntegrationReadiness(): Promise<ProductionIntegrationReadiness> {
  const [data, deliveries] = await Promise.all([getOpsExpansionData(), getNotificationDeliveries(1000)]);
  const items = [...carrierItems(data), ...platformItems(data), ...infrastructureItems(deliveries.length)];
  const summary = {
    ready: items.filter((item) => item.status === "ready").length,
    partial: items.filter((item) => item.status === "partial").length,
    blocked: items.filter((item) => item.status === "blocked").length,
  };
  const score = items.length > 0 ? Math.round((items.reduce((sum, item) => sum + itemScore(item.status), 0) / items.length) * 100) : 0;
  return {
    generatedAt: new Date().toISOString(),
    status: summary.blocked > 0 ? "blocked" : summary.partial > 0 ? "partial" : "ready",
    score,
    items,
    summary,
  };
}
