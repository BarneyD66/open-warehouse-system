import type { CarrierRateRule, CarrierRulePreference, CoreOutboundOrder, OutboundTrackingEvent } from "./warehouseCoreStore";

export type CarrierGatewayMode = "internal" | "sandbox" | "live";

export type CarrierGatewayLabelResult = {
  ok: boolean;
  mode: CarrierGatewayMode;
  carrierProvider: string;
  trackingNumber?: string;
  carrierShipmentId?: string;
  labelUrl?: string;
  labelFormat?: "pdf" | "zpl" | "internal";
  raw?: unknown;
  error?: string;
  warning?: string;
};

export type CarrierGatewayCancelResult = {
  ok: boolean;
  mode: CarrierGatewayMode;
  carrierProvider: string;
  raw?: unknown;
  error?: string;
};

export type CarrierGatewayTrackingResult = {
  ok: boolean;
  mode: CarrierGatewayMode;
  carrierProvider: string;
  status?: OutboundTrackingEvent["status"];
  detail?: string;
  location?: string;
  trackingNumber?: string;
  carrierShipmentId?: string;
  proofUrl?: string;
  raw?: unknown;
  error?: string;
};

export type CarrierWebhookPayload = {
  outboundId?: string;
  trackingNumber?: string;
  carrierShipmentId?: string;
  status?: OutboundTrackingEvent["status"];
  detail?: string;
  location?: string;
  occurredAt?: string;
};

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function carrierProviderFromText(value: string | undefined) {
  const text = normalizeText(value);
  if (text.includes("royal")) return "royal_mail";
  if (text.includes("dpd")) return "dpd";
  if (text.includes("evri") || text.includes("hermes")) return "evri";
  return "manual";
}

export function matchCarrierConfig(rule: CarrierRateRule, configs: CarrierRulePreference[] = []) {
  const ruleCarrier = normalizeText(rule.carrierName);
  const ruleService = normalizeText(rule.serviceName);
  return configs.find((config) => {
    const carrier = normalizeText(config.carrierName);
    const service = normalizeText(config.serviceName);
    return carrier && ruleCarrier.includes(carrier) && (!service || ruleService.includes(service) || service.includes(ruleService));
  });
}

function envValue(name: string | undefined) {
  if (!name) return undefined;
  return process.env[name.trim()];
}

function configuredEndpoint(credentialRef: string | undefined, provider: string, mode: CarrierGatewayMode) {
  const normalizedRef = credentialRef?.trim();
  const providerPrefix = provider.toUpperCase();
  return (
    envValue(normalizedRef ? `${normalizedRef}_BASE_URL` : undefined) ||
    envValue(normalizedRef ? `${normalizedRef}_ENDPOINT` : undefined) ||
    envValue(`${providerPrefix}_${mode.toUpperCase()}_BASE_URL`) ||
    envValue(`${providerPrefix}_CARRIER_GATEWAY_URL`)
  );
}

function configuredActionEndpoint(credentialRef: string | undefined, provider: string, mode: CarrierGatewayMode, action: "label" | "cancel" | "tracking" | "proof") {
  const normalizedRef = credentialRef?.trim();
  const providerPrefix = provider.toUpperCase();
  const actionSuffix = action.toUpperCase();
  return (
    envValue(normalizedRef ? `${normalizedRef}_${actionSuffix}_URL` : undefined) ||
    envValue(normalizedRef ? `${normalizedRef}_${actionSuffix}_ENDPOINT` : undefined) ||
    envValue(`${providerPrefix}_${mode.toUpperCase()}_${actionSuffix}_URL`) ||
    envValue(`${providerPrefix}_${actionSuffix}_URL`) ||
    configuredEndpoint(credentialRef, provider, mode)
  );
}

function configuredToken(credentialRef: string | undefined, provider: string) {
  const normalizedRef = credentialRef?.trim();
  const providerPrefix = provider.toUpperCase();
  return (
    envValue(normalizedRef) ||
    envValue(normalizedRef ? `${normalizedRef}_API_KEY` : undefined) ||
    envValue(normalizedRef ? `${normalizedRef}_TOKEN` : undefined) ||
    envValue(`${providerPrefix}_API_KEY`) ||
    envValue(`${providerPrefix}_TOKEN`)
  );
}

export function makeInternalTrackingNumber(rule: CarrierRateRule, orderId: string) {
  const suffix = orderId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase() || "ORDER";
  const stamp = Date.now().toString().slice(-6);
  return `${rule.trackingPrefix}${suffix}${stamp}`;
}

function buildGatewayPayload(order: CoreOutboundOrder, rule: CarrierRateRule, rate: { amount: number; weightKg: number; packageCount: number }) {
  return {
    reference: order.id,
    customerCode: order.customerCode,
    serviceCode: rule.serviceCode,
    carrierName: rule.carrierName,
    serviceName: rule.serviceName,
    recipientName: order.recipientName,
    deliveryAddress: order.deliveryAddress,
    packageWeightKg: rate.weightKg,
    packageCount: rate.packageCount,
    estimatedFee: rate.amount,
    currency: rule.currency,
    skuLines: order.skuLines ?? [],
  };
}

export async function purchaseCarrierLabel({
  order,
  rule,
  rate,
  configs,
}: {
  order: CoreOutboundOrder;
  rule: CarrierRateRule;
  rate: { amount: number; weightKg: number; packageCount: number };
  configs?: CarrierRulePreference[];
}): Promise<CarrierGatewayLabelResult> {
  const config = matchCarrierConfig(rule, configs);
  const provider = carrierProviderFromText(config?.carrierName || rule.carrierName);
  const configuredMode = config?.apiMode === "live" || config?.apiMode === "sandbox" ? config.apiMode : "internal";

  if (provider === "manual" || configuredMode === "internal") {
    return {
      ok: true,
      mode: "internal",
      carrierProvider: provider,
      trackingNumber: order.trackingNumber || makeInternalTrackingNumber(rule, order.id),
      labelUrl: `/warehouse/print/label/${encodeURIComponent(order.id)}`,
      labelFormat: "internal",
      warning: provider === "manual" ? "人工渠道已生成内部面单，请线下确认承运商交接。" : undefined,
    };
  }

  const token = configuredToken(config?.credentialRef, provider);
  const endpoint = configuredActionEndpoint(config?.credentialRef, provider, configuredMode, "label");
  if (!config?.credentialRef) {
    return { ok: false, mode: configuredMode, carrierProvider: provider, error: "物流渠道已启用沙箱/正式模式，但缺少凭证引用。" };
  }
  if (!token) {
    return { ok: false, mode: configuredMode, carrierProvider: provider, error: `未在环境变量中找到 ${config.credentialRef}，无法调用真实承运商接口。` };
  }
  if (!endpoint) {
    return {
      ok: false,
      mode: configuredMode,
      carrierProvider: provider,
      error: `未配置 ${config.credentialRef}_BASE_URL、${config.credentialRef}_LABEL_URL 或 ${provider.toUpperCase()}_${configuredMode.toUpperCase()}_BASE_URL。`,
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Sheffield-Carrier": provider,
      "X-Sheffield-Mode": configuredMode,
    },
    body: JSON.stringify(buildGatewayPayload(order, rule, rate)),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) {
    return { ok: false, mode: configuredMode, carrierProvider: provider, error: `承运商接口连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    trackingNumber?: string;
    tracking_number?: string;
    carrierShipmentId?: string;
    shipmentId?: string;
    labelUrl?: string;
    label_url?: string;
    labelFormat?: "pdf" | "zpl";
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    return { ok: false, mode: configuredMode, carrierProvider: provider, error: payload.error || payload.message || `承运商接口返回 ${response.status}` };
  }

  const trackingNumber = payload.trackingNumber || payload.tracking_number;
  const labelUrl = payload.labelUrl || payload.label_url;
  if (!trackingNumber || !labelUrl) {
    return { ok: false, mode: configuredMode, carrierProvider: provider, error: "承运商接口未返回追踪号或面单地址，请检查网关响应字段。" };
  }

  return {
    ok: true,
    mode: configuredMode,
    carrierProvider: provider,
    trackingNumber,
    carrierShipmentId: payload.carrierShipmentId || payload.shipmentId,
    labelUrl,
    labelFormat: payload.labelFormat || "pdf",
    raw: payload,
  };
}

export async function cancelCarrierLabel({
  order,
  configs,
}: {
  order: CoreOutboundOrder;
  configs?: CarrierRulePreference[];
}): Promise<CarrierGatewayCancelResult> {
  const config = configs?.find((item) => {
    const carrier = normalizeText(item.carrierName);
    const service = normalizeText(item.serviceName);
    return carrier && normalizeText(order.carrierName).includes(carrier) && (!service || normalizeText(order.carrierServiceName).includes(service));
  });
  const provider = carrierProviderFromText(config?.carrierName || order.carrierName);
  const configuredMode = config?.apiMode === "live" || config?.apiMode === "sandbox" ? config.apiMode : "internal";
  if (provider === "manual" || configuredMode === "internal") return { ok: true, mode: "internal", carrierProvider: provider };

  const token = configuredToken(config?.credentialRef, provider);
  const endpoint = configuredActionEndpoint(config?.credentialRef, provider, configuredMode, "cancel");
  if (!config?.credentialRef) return { ok: false, mode: configuredMode, carrierProvider: provider, error: "物流渠道缺少凭证引用，无法取消真实面单。" };
  if (!token) return { ok: false, mode: configuredMode, carrierProvider: provider, error: `未在环境变量中找到 ${config.credentialRef}。` };
  if (!endpoint) return { ok: false, mode: configuredMode, carrierProvider: provider, error: "未配置承运商取消面单网关地址。" };

  const cancelEndpoint = /cancel|void/i.test(endpoint) ? endpoint : `${endpoint.replace(/\/$/, "")}/cancel`;
  const response = await fetch(cancelEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Sheffield-Carrier": provider,
      "X-Sheffield-Mode": configuredMode,
    },
    body: JSON.stringify({
      outboundId: order.id,
      trackingNumber: order.trackingNumber,
      carrierShipmentId: order.carrierShipmentId,
    }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, mode: configuredMode, carrierProvider: provider, error: `承运商取消面单连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      mode: configuredMode,
      carrierProvider: provider,
      raw: payload,
      error: typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : `承运商接口返回 ${response.status}`,
    };
  }
  return { ok: true, mode: configuredMode, carrierProvider: provider, raw: payload };
}

function trackingStatusFromPayload(payload: Record<string, unknown>): OutboundTrackingEvent["status"] {
  const statusText = String(payload.status || payload.event || payload.trackingStatus || payload.tracking_status || payload.deliveryStatus || "").toLowerCase();
  if (statusText.includes("deliver") && !statusText.includes("out")) return "delivered";
  if (statusText.includes("out_for_delivery") || statusText.includes("out for delivery")) return "out_for_delivery";
  if (statusText.includes("exception") || statusText.includes("fail") || statusText.includes("return")) return "exception";
  if (statusText.includes("transit")) return "in_transit";
  if (statusText.includes("handover") || statusText.includes("collected") || statusText.includes("accepted")) return "carrier_handover";
  if (statusText.includes("label")) return "label_created";
  return "warehouse_processing";
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export async function fetchCarrierTrackingAndProof({
  order,
  configs,
}: {
  order: CoreOutboundOrder;
  configs?: CarrierRulePreference[];
}): Promise<CarrierGatewayTrackingResult> {
  const config = configs?.find((item) => {
    const carrier = normalizeText(item.carrierName);
    const service = normalizeText(item.serviceName);
    return carrier && normalizeText(order.carrierName).includes(carrier) && (!service || normalizeText(order.carrierServiceName).includes(service));
  });
  const provider = carrierProviderFromText(config?.carrierName || order.carrierName);
  const configuredMode = config?.apiMode === "live" || config?.apiMode === "sandbox" ? config.apiMode : "internal";
  if (provider === "manual" || configuredMode === "internal") {
    return {
      ok: true,
      mode: "internal",
      carrierProvider: provider,
      status: order.trackingNumber ? "carrier_handover" : "warehouse_processing",
      detail: order.trackingNumber ? "内部/人工渠道暂无外部轨迹，已保留当前追踪号。" : "内部/人工渠道暂无外部追踪号。",
      trackingNumber: order.trackingNumber,
      carrierShipmentId: order.carrierShipmentId,
    };
  }

  const token = configuredToken(config?.credentialRef, provider);
  const endpoint = configuredActionEndpoint(config?.credentialRef, provider, configuredMode, "tracking");
  if (!config?.credentialRef) return { ok: false, mode: configuredMode, carrierProvider: provider, error: "物流渠道缺少凭证引用，无法主动同步承运商轨迹。" };
  if (!token) return { ok: false, mode: configuredMode, carrierProvider: provider, error: `未在环境变量中找到 ${config.credentialRef}。` };
  if (!endpoint) return { ok: false, mode: configuredMode, carrierProvider: provider, error: "未配置承运商轨迹/POD 同步网关地址。" };

  const trackingEndpoint = /tracking|track|proof|pod/i.test(endpoint) ? endpoint : `${endpoint.replace(/\/$/, "")}/tracking`;
  const response = await fetch(trackingEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Sheffield-Carrier": provider,
      "X-Sheffield-Mode": configuredMode,
    },
    body: JSON.stringify({
      outboundId: order.id,
      trackingNumber: order.trackingNumber,
      carrierShipmentId: order.carrierShipmentId,
      requestProof: true,
    }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, mode: configuredMode, carrierProvider: provider, error: `承运商轨迹/POD 同步连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ok: false,
      mode: configuredMode,
      carrierProvider: provider,
      raw: payload,
      error: textValue(payload.error, payload.message) || `承运商轨迹/POD 接口返回 ${response.status}`,
    };
  }

  return {
    ok: true,
    mode: configuredMode,
    carrierProvider: provider,
    status: trackingStatusFromPayload(payload),
    detail: textValue(payload.detail, payload.message, payload.description) || "承运商轨迹/POD 主动同步完成。",
    location: textValue(payload.location, payload.city, payload.depot),
    trackingNumber: textValue(payload.trackingNumber, payload.tracking_number) || order.trackingNumber,
    carrierShipmentId: textValue(payload.carrierShipmentId, payload.shipmentId) || order.carrierShipmentId,
    proofUrl: textValue(payload.proofUrl, payload.proof_url, payload.podUrl, payload.pod_url, payload.signatureUrl, payload.signature_url),
    raw: payload,
  };
}

export function normalizeCarrierWebhookPayload(input: Record<string, unknown>): CarrierWebhookPayload {
  const statusText = String(input.status || input.event || input.trackingStatus || "").toLowerCase();
  const status: OutboundTrackingEvent["status"] =
    statusText.includes("deliver") && !statusText.includes("out")
      ? "delivered"
      : statusText.includes("out_for_delivery") || statusText.includes("out for delivery")
        ? "out_for_delivery"
        : statusText.includes("exception") || statusText.includes("fail") || statusText.includes("return")
          ? "exception"
          : statusText.includes("transit")
            ? "in_transit"
            : statusText.includes("handover") || statusText.includes("collected")
              ? "carrier_handover"
              : "warehouse_processing";

  return {
    outboundId: typeof input.outboundId === "string" ? input.outboundId : typeof input.reference === "string" ? input.reference : undefined,
    trackingNumber: typeof input.trackingNumber === "string" ? input.trackingNumber : typeof input.tracking_number === "string" ? input.tracking_number : undefined,
    carrierShipmentId: typeof input.carrierShipmentId === "string" ? input.carrierShipmentId : typeof input.shipmentId === "string" ? input.shipmentId : undefined,
    status,
    detail: typeof input.detail === "string" ? input.detail : typeof input.message === "string" ? input.message : undefined,
    location: typeof input.location === "string" ? input.location : undefined,
    occurredAt: typeof input.occurredAt === "string" ? input.occurredAt : typeof input.timestamp === "string" ? input.timestamp : undefined,
  };
}
