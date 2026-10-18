import type { ImportedOrderRow, PlatformConnection, PlatformKind } from "./opsExpansionStore";

export type PlatformGatewayOrder = Omit<ImportedOrderRow, "row" | "status" | "issue">;

export type PlatformGatewayCancelledOrder = {
  platform: PlatformKind;
  orderNo: string;
  customerCode: string;
  rawStatus?: string;
  reason?: string;
  cancelledAt?: string;
};

export type PlatformGatewayPullResult = {
  ok: boolean;
  orders: PlatformGatewayOrder[];
  cancelledOrders?: PlatformGatewayCancelledOrder[];
  raw?: unknown;
  error?: string;
};

export type PlatformGatewayFulfillmentResult = {
  ok: boolean;
  raw?: unknown;
  error?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function platformEnvPrefix(platform: PlatformKind) {
  return platform.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function parseCredentialRef(note: string | undefined) {
  return clean(note).match(/credentialRef\s*=\s*([A-Za-z0-9_]+)/i)?.[1];
}

function envValue(name: string | undefined) {
  if (!name) return undefined;
  return process.env[name.trim()];
}

function endpointFor(connection: PlatformConnection, action: "orders" | "fulfillment") {
  const prefix = platformEnvPrefix(connection.platform);
  const credentialRef = parseCredentialRef(connection.note);
  return (
    envValue(credentialRef ? `${credentialRef}_${action.toUpperCase()}_URL` : undefined) ||
    envValue(`${prefix}_${action.toUpperCase()}_URL`) ||
    envValue(credentialRef ? `${credentialRef}_API_BASE_URL` : undefined) ||
    envValue(`${prefix}_API_BASE_URL`)
  );
}

function apiBaseFor(connection: PlatformConnection) {
  const prefix = platformEnvPrefix(connection.platform);
  const credentialRef = parseCredentialRef(connection.note);
  return envValue(credentialRef ? `${credentialRef}_API_BASE_URL` : undefined) || envValue(`${prefix}_API_BASE_URL`);
}

function tokenFor(connection: PlatformConnection) {
  const prefix = platformEnvPrefix(connection.platform);
  const credentialRef = parseCredentialRef(connection.note);
  return (
    envValue(credentialRef) ||
    envValue(credentialRef ? `${credentialRef}_API_TOKEN` : undefined) ||
    envValue(credentialRef ? `${credentialRef}_ACCESS_TOKEN` : undefined) ||
    envValue(`${prefix}_API_TOKEN`) ||
    envValue(`${prefix}_ACCESS_TOKEN`)
  );
}

function credentialEnvValue(connection: PlatformConnection, suffix: string) {
  const prefix = platformEnvPrefix(connection.platform);
  const credentialRef = parseCredentialRef(connection.note);
  return envValue(credentialRef ? `${credentialRef}_${suffix}` : undefined) || envValue(`${prefix}_${suffix}`);
}

function configuredEndpoint(connection: PlatformConnection, action: "orders" | "fulfillment", fallbackPath: string, defaultBase?: string) {
  const explicit = endpointFor(connection, action);
  if (explicit && /\/[^/]+/.test(new URL(explicit, "https://placeholder.local").pathname.replace(/\/$/, ""))) return explicit;
  const base = (explicit || apiBaseFor(connection) || defaultBase || "").trim().replace(/\/$/, "");
  return base ? `${base}${fallbackPath}` : "";
}

function sourceRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  for (const key of ["orders", "Orders", "order_list", "orderList", "packages", "data_list", "items", "order", "line_items"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  for (const key of ["payload", "data", "result", "response"]) {
    if (record[key] && typeof record[key] === "object") {
      const nested = sourceRows(record[key]);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function orderLines(row: Record<string, unknown>) {
  const candidates = [row.line_items, row.lineItems, row.items, row.orderItems, row.OrderItems, row.OrderItemsList, row.skuLines, row.products, row.productList, row.package_items, row.packageItems];
  const found = candidates.find(Array.isArray);
  if (Array.isArray(found) && found.length > 0) return found.map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}));
  return [row];
}

function addressName(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  return clean(row.name || row.recipientName || row.fullName || row.Name || row.contactName);
}

function formatAddress(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(formatAddress).filter(Boolean).join("；");
  if (typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const nested = row.shippingStep || row.shipping_address || row.shippingAddress || row.address || row.ShippingAddress || row.contactAddress;
  if (nested && nested !== value) {
    const nestedText = formatAddress(nested);
    if (nestedText) return nestedText;
  }
  return [
    row.name || row.Name,
    row.address1 || row.AddressLine1 || row.street1 || row.line1,
    row.address2 || row.AddressLine2 || row.street2 || row.line2,
    row.city || row.CityName || row.town,
    row.province || row.state || row.StateOrRegion || row.county,
    row.zip || row.postcode || row.postal_code || row.PostalCode,
    row.country || row.country_code || row.CountryCode,
    row.phone || row.Phone,
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

function platformOrderNo(row: Record<string, unknown>) {
  return clean(row.orderNo || row.orderNumber || row.order_number || row.order_id || row.AmazonOrderId || row.amazonOrderId || row.orderId || row.id || row.name);
}

function platformStatus(row: Record<string, unknown>) {
  return clean(row.status || row.orderStatus || row.order_status || row.fulfillmentStatus || row.cancelStatus || row.cancel_status || row.cancelled_at || row.canceled_at);
}

function isCancelledRow(row: Record<string, unknown>) {
  const status = platformStatus(row).toLowerCase();
  return Boolean(row.cancelled_at || row.canceled_at || row.cancelledAt || row.canceledAt) || ["cancelled", "canceled", "cancel", "voided", "closed"].some((value) => status.includes(value));
}

function genericChannel(row: Record<string, unknown>) {
  return clean(row.channel || row.shippingMethod || row.shipping_method || row.shippingService || row.deliveryOption || "Royal Mail 48");
}

function genericRequestedShipDate(row: Record<string, unknown>) {
  return clean(row.requestedShipDate || row.shipByDate || row.ship_by_date || row.latestShipDate || row.LatestShipDate || row.created_at || row.createTime || row.createdAt);
}

function genericRecipient(row: Record<string, unknown>) {
  const address = row.shippingAddress || row.shipping_address || row.ShippingAddress || row.deliveryAddress || row.address;
  return clean(row.recipientName || row.buyerName || row.buyer_name || row.customerName || row.name || addressName(address));
}

function normalizeGenericOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (isCancelledRow(row)) return [];
    const orderNo = platformOrderNo(row);
    if (!orderNo) return [];
    const address = formatAddress(row.deliveryAddress || row.address || row.shippingAddress || row.shipping_address || row.ShippingAddress || row.fulfillmentStartInstructions);
    const channel = genericChannel(row);
    const recipientName = genericRecipient(row);
    const requestedShipDate = genericRequestedShipDate(row);
    const note = clean(row.note || row.remark) || `平台 API 同步：${connection.platform} / ${orderNo}`;
    return orderLines(row)
      .map((line) => {
        const skuCode = clean(line.skuCode || line.sellerSku || line.seller_sku || line.sku || line.SellerSKU || line.sku_id || line.product_sku);
        const quantity = Number(line.quantity || line.qty || line.QuantityOrdered || line.quantity_purchased || 1);
        return {
          platform: connection.platform,
          orderNo,
          customerCode: clean(row.customerCode || row.customer || connection.customerCode).toUpperCase(),
          skuCode,
          quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
          channel,
          recipientName,
          deliveryAddress: address,
          requestedShipDate,
          note,
        };
      })
      .filter((line) => line.orderNo && line.skuCode);
  });
}

function normalizeGenericCancelledOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayCancelledOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (!isCancelledRow(row)) return [];
    const orderNo = platformOrderNo(row);
    if (!orderNo) return [];
    return {
      platform: connection.platform,
      orderNo,
      customerCode: clean(row.customerCode || row.customer || connection.customerCode).toUpperCase(),
      rawStatus: platformStatus(row),
      reason: clean(row.cancelReason || row.cancel_reason || row.reason || row.message || row.note),
      cancelledAt: clean(row.cancelled_at || row.canceled_at || row.cancelledAt || row.canceledAt || row.cancelTime || row.cancel_time || row.updated_at || row.updatedAt),
    };
  });
}

function shopifyAdminBase(connection: PlatformConnection) {
  const raw = apiBaseFor(connection) || endpointFor(connection, "orders");
  if (!raw) return undefined;
  const cleanBase = raw.trim().replace(/\/$/, "");
  if (cleanBase.includes("/admin/api/")) return cleanBase.replace(/\/orders\.json$/i, "").replace(/\/fulfillments\.json$/i, "");
  const version = process.env.SHOPIFY_API_VERSION || "2026-01";
  return `${cleanBase}/admin/api/${version}`;
}

function normalizeShopifyOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (isCancelledRow(row)) return [];
    const orderNo = clean(row.id || row.admin_graphql_api_id || row.name);
    if (!orderNo) return [];
    const shippingAddress = row.shipping_address || row.shippingAddress;
    const shippingLines = row.shipping_lines || row.shippingLines;
    const firstShipping = Array.isArray(shippingLines) ? shippingLines.find((line) => line && typeof line === "object") as Record<string, unknown> | undefined : undefined;
    const channel = clean(firstShipping?.title || firstShipping?.code || row.shippingMethod || "Royal Mail 48");
    const orderName = clean(row.name);
    return orderLines(row)
      .map((line) => {
        const quantity = Number(line.current_quantity || line.quantity || line.fulfillable_quantity || 1);
        return {
          platform: connection.platform,
          orderNo,
          customerCode: connection.customerCode,
          skuCode: clean(line.sku || line.SKU || line.sellerSku || line.seller_sku || line.product_sku),
          quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
          channel,
          recipientName: clean(row.recipientName || row.buyerName || row.customerName || addressName(shippingAddress)),
          deliveryAddress: formatAddress(shippingAddress),
          requestedShipDate: clean(row.shipByDate || row.ship_by_date || row.created_at || row.updated_at),
          note: `Shopify API 同步：${connection.storeName}${orderName ? ` / ${orderName}` : ""}`,
        };
      })
      .filter((line) => line.skuCode);
  });
}

function ebayFulfillmentBase(connection: PlatformConnection) {
  const raw = apiBaseFor(connection) || endpointFor(connection, "orders");
  const base = (raw || (connection.syncMode === "api_sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com")).trim().replace(/\/$/, "");
  if (base.includes("/sell/fulfillment/v1")) return base.replace(/\/order.*$/i, "");
  return `${base}/sell/fulfillment/v1`;
}

function ebayShipTo(row: Record<string, unknown>) {
  const instructions = row.fulfillmentStartInstructions;
  if (Array.isArray(instructions)) {
    const first = instructions.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
    const shippingStep = first?.shippingStep;
    if (shippingStep && typeof shippingStep === "object") {
      const shipTo = (shippingStep as Record<string, unknown>).shipTo;
      return shipTo && typeof shipTo === "object" ? (shipTo as Record<string, unknown>) : {};
    }
  }
  return {};
}

function ebayStatus(row: Record<string, unknown>) {
  const cancelStatus = row.cancelStatus && typeof row.cancelStatus === "object" ? row.cancelStatus as Record<string, unknown> : {};
  return clean(row.orderFulfillmentStatus || row.orderPaymentStatus || cancelStatus.cancelState || cancelStatus.cancelReason || row.orderStatus || row.status);
}

function ebayIsCancelled(row: Record<string, unknown>) {
  return ebayStatus(row).toLowerCase().includes("cancel");
}

function normalizeEbayOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (ebayIsCancelled(row)) return [];
    const orderNo = clean(row.orderId || row.legacyOrderId || row.orderNo || row.id);
    if (!orderNo) return [];
    const shipTo = ebayShipTo(row);
    const channel = clean(row.shippingServiceCode || row.shippingCarrierCode || "Royal Mail 48");
    return orderLines(row)
      .map((line) => ({
        platform: connection.platform,
        orderNo,
        customerCode: connection.customerCode,
        skuCode: clean(line.sku || line.legacyItemId || line.title || line.lineItemId),
        quantity: Math.max(1, Math.floor(Number(line.quantity || line.quantityPurchased || 1) || 1)),
        channel,
        recipientName: clean(shipTo.fullName || shipTo.contactName || shipTo.username || shipTo.name),
        deliveryAddress: formatAddress(shipTo.contactAddress || shipTo),
        requestedShipDate: clean(row.creationDate || row.lastModifiedDate || row.createdAt),
        note: `eBay Fulfillment API 同步：${connection.storeName} / ${ebayStatus(row) || "订单待履约"}`,
      }))
      .filter((line) => line.skuCode);
  });
}

function normalizeEbayCancelledOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayCancelledOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (!ebayIsCancelled(row)) return [];
    const orderNo = clean(row.orderId || row.legacyOrderId || row.orderNo || row.id);
    if (!orderNo) return [];
    return {
      platform: connection.platform,
      orderNo,
      customerCode: connection.customerCode,
      rawStatus: ebayStatus(row),
      reason: ebayStatus(row),
      cancelledAt: clean(row.cancelledDate || row.canceledDate || row.lastModifiedDate),
    };
  });
}

function amazonStatus(row: Record<string, unknown>) {
  return clean(row.OrderStatus || row.orderStatus || row.status || row.cancelStatus);
}

function amazonIsCancelled(row: Record<string, unknown>) {
  return ["cancel", "canceled", "cancelled"].some((item) => amazonStatus(row).toLowerCase().includes(item));
}

function normalizeAmazonOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (amazonIsCancelled(row)) return [];
    const orderNo = clean(row.AmazonOrderId || row.amazonOrderId || row.orderId || row.orderNo);
    if (!orderNo) return [];
    const address = row.ShippingAddress || row.shippingAddress || row.shipping_address;
    const channel = clean(row.ShipServiceLevel || row.ShipmentServiceLevelCategory || row.shippingService || "Royal Mail 48");
    return orderLines(row)
      .map((line) => {
        const quantity = Number(line.QuantityOrdered || line.QuantityShipped || line.quantity || line.qty || 1);
        return {
          platform: connection.platform,
          orderNo,
          customerCode: connection.customerCode,
          skuCode: clean(line.SellerSKU || line.sellerSku || line.sku || line.skuCode),
          quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
          channel,
          recipientName: clean(row.recipientName || row.buyerName || row.BuyerName || addressName(address)),
          deliveryAddress: formatAddress(address),
          requestedShipDate: clean(row.LatestShipDate || row.EarliestShipDate || row.PurchaseDate || row.LastUpdateDate),
          note: `Amazon SP-API 同步：${connection.storeName} / ${amazonStatus(row) || "待履约"}`,
        };
      })
      .filter((line) => line.skuCode);
  });
}

function normalizeAmazonCancelledOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayCancelledOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (!amazonIsCancelled(row)) return [];
    const orderNo = clean(row.AmazonOrderId || row.amazonOrderId || row.orderId || row.orderNo);
    if (!orderNo) return [];
    return {
      platform: connection.platform,
      orderNo,
      customerCode: connection.customerCode,
      rawStatus: amazonStatus(row),
      reason: clean(row.CancelReason || row.cancelReason || row.reason || amazonStatus(row)),
      cancelledAt: clean(row.LastUpdateDate || row.cancelledAt || row.canceledAt),
    };
  });
}

function tiktokStatus(row: Record<string, unknown>) {
  return clean(row.order_status || row.orderStatus || row.status || row.cancel_status || row.cancelStatus);
}

function tiktokIsCancelled(row: Record<string, unknown>) {
  return Boolean(row.cancel_time || row.cancelTime) || ["cancel", "cancelled", "canceled"].some((item) => tiktokStatus(row).toLowerCase().includes(item));
}

function tiktokRecipientAddress(row: Record<string, unknown>) {
  return row.recipient_address || row.recipientAddress || row.shipping_address || row.shippingAddress || row.address;
}

function normalizeTikTokOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (tiktokIsCancelled(row)) return [];
    const orderNo = clean(row.order_id || row.orderId || row.id || row.orderNo);
    if (!orderNo) return [];
    const address = tiktokRecipientAddress(row);
    const channel = clean(row.shipping_provider_name || row.shippingProviderName || row.delivery_option_name || row.deliveryOptionName || "Royal Mail 48");
    return orderLines(row)
      .map((line) => {
        const quantity = Number(line.quantity || line.qty || line.sku_quantity || line.skuQuantity || 1);
        return {
          platform: connection.platform,
          orderNo,
          customerCode: connection.customerCode,
          skuCode: clean(line.seller_sku || line.sellerSku || line.sku_name || line.skuName || line.sku_id || line.skuId || line.skuCode),
          quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
          channel,
          recipientName: clean(row.recipient_name || row.recipientName || addressName(address)),
          deliveryAddress: formatAddress(address),
          requestedShipDate: clean(row.rts_sla_time || row.rtsSlaTime || row.create_time || row.createTime || row.update_time || row.updateTime),
          note: `TikTok Shop API 同步：${connection.storeName} / ${tiktokStatus(row) || "待履约"}`,
        };
      })
      .filter((line) => line.skuCode);
  });
}

function normalizeTikTokCancelledOrders(raw: unknown, connection: PlatformConnection): PlatformGatewayCancelledOrder[] {
  return sourceRows(raw).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (!tiktokIsCancelled(row)) return [];
    const orderNo = clean(row.order_id || row.orderId || row.id || row.orderNo);
    if (!orderNo) return [];
    return {
      platform: connection.platform,
      orderNo,
      customerCode: connection.customerCode,
      rawStatus: tiktokStatus(row),
      reason: clean(row.cancel_reason || row.cancelReason || row.cancel_user || row.cancelUser || tiktokStatus(row)),
      cancelledAt: clean(row.cancel_time || row.cancelTime || row.update_time || row.updateTime),
    };
  });
}

async function pullAmazonOrders(connection: PlatformConnection): Promise<PlatformGatewayPullResult> {
  const token = tokenFor(connection);
  if (!token) return { ok: false, orders: [], error: "缺少 Amazon SP-API Access Token，请配置 AMAZON_ACCESS_TOKEN、AMAZON_API_TOKEN 或 credentialRef。" };

  const endpoint = configuredEndpoint(connection, "orders", "/orders/v0/orders", connection.syncMode === "api_sandbox" ? "https://sandbox.sellingpartnerapi-eu.amazon.com" : "https://sellingpartnerapi-eu.amazon.com");
  const url = new URL(endpoint);
  const marketplaceId = credentialEnvValue(connection, "MARKETPLACE_ID") || "A1F83G8C2ARO7P";
  if (!url.searchParams.has("MarketplaceIds")) url.searchParams.set("MarketplaceIds", marketplaceId);
  if (!url.searchParams.has("CreatedAfter") && !url.searchParams.has("LastUpdatedAfter")) {
    url.searchParams.set("LastUpdatedAfter", connection.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString());
  }
  if (!url.searchParams.has("OrderStatuses")) url.searchParams.set("OrderStatuses", "Unshipped,PartiallyShipped,Canceled");

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "x-amz-access-token": token, "Content-Type": "application/json", "X-Sheffield-Platform": "amazon" },
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, orders: [], error: `Amazon 订单接口连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "errors" in payload ? JSON.stringify((payload as { errors?: unknown }).errors) : `Amazon SP-API 返回 ${response.status}`;
    return { ok: false, orders: [], error: message, raw: payload };
  }

  return { ok: true, orders: normalizeAmazonOrders(payload, connection), cancelledOrders: normalizeAmazonCancelledOrders(payload, connection), raw: payload };
}

async function pullTikTokOrders(connection: PlatformConnection): Promise<PlatformGatewayPullResult> {
  const token = tokenFor(connection);
  if (!token) return { ok: false, orders: [], error: "缺少 TikTok Shop Access Token，请配置 TIKTOK_SHOP_ACCESS_TOKEN、TIKTOK_SHOP_API_TOKEN 或 credentialRef。" };

  const endpoint = configuredEndpoint(connection, "orders", "/order/202309/orders/search", "https://open-api.tiktokglobalshop.com");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-tts-access-token": token, "Content-Type": "application/json", "X-Sheffield-Platform": "tiktok_shop" },
    body: JSON.stringify({
      page_size: 50,
      sort_field: "update_time",
      sort_order: "DESC",
      update_time_ge: connection.lastSyncAt ? Math.floor(new Date(connection.lastSyncAt).getTime() / 1000) : undefined,
    }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, orders: [], error: `TikTok Shop 订单接口连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload ? String((payload as { message?: unknown }).message) : `TikTok Shop API 返回 ${response.status}`;
    return { ok: false, orders: [], error: message, raw: payload };
  }

  return { ok: true, orders: normalizeTikTokOrders(payload, connection), cancelledOrders: normalizeTikTokCancelledOrders(payload, connection), raw: payload };
}

async function pullEbayOrders(connection: PlatformConnection): Promise<PlatformGatewayPullResult> {
  const token = tokenFor(connection);
  if (!token) return { ok: false, orders: [], error: "缺少 eBay OAuth Access Token，请配置 EBAY_ACCESS_TOKEN、EBAY_API_TOKEN 或 credentialRef。" };

  const url = new URL(`${ebayFulfillmentBase(connection)}/order`);
  url.searchParams.set("limit", "50");
  if (connection.lastSyncAt) url.searchParams.set("filter", `lastmodifieddate:[${connection.lastSyncAt}..]`);

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Sheffield-Platform": "ebay" },
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, orders: [], error: `eBay 订单接口连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "errors" in payload ? JSON.stringify((payload as { errors?: unknown }).errors) : `eBay Fulfillment API 返回 ${response.status}`;
    return { ok: false, orders: [], error: message, raw: payload };
  }

  return { ok: true, orders: normalizeEbayOrders(payload, connection), cancelledOrders: normalizeEbayCancelledOrders(payload, connection), raw: payload };
}

async function pullShopifyOrders(connection: PlatformConnection): Promise<PlatformGatewayPullResult> {
  const token = tokenFor(connection);
  const base = shopifyAdminBase(connection);
  if (!token) return { ok: false, orders: [], error: "缺少 Shopify Access Token，请配置 SHOPIFY_ACCESS_TOKEN、SHOPIFY_API_TOKEN 或 credentialRef。" };
  if (!base) return { ok: false, orders: [], error: "缺少 Shopify API_BASE_URL，请配置 SHOPIFY_API_BASE_URL 或 credentialRef_API_BASE_URL，例如 https://your-store.myshopify.com。" };

  const url = new URL(`${base}/orders.json`);
  url.searchParams.set("status", "any");
  url.searchParams.set("fulfillment_status", "unfulfilled");
  url.searchParams.set("limit", "50");
  if (connection.lastSyncAt) url.searchParams.set("updated_at_min", connection.lastSyncAt);

  const response = await fetch(url, {
    method: "GET",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", "X-Sheffield-Platform": "shopify" },
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, orders: [], error: `Shopify 订单接口连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : `Shopify 接口返回 ${response.status}`;
    return { ok: false, orders: [], error: message, raw: payload };
  }

  return { ok: true, orders: normalizeShopifyOrders(payload, connection), cancelledOrders: normalizeGenericCancelledOrders(payload, connection), raw: payload };
}

export async function pullPlatformOrders(connection: PlatformConnection): Promise<PlatformGatewayPullResult> {
  if (connection.syncMode === "manual_csv") return { ok: false, orders: [], error: "当前连接是 CSV 手工导入，请切换为 API 沙箱或正式模式。" };
  if (connection.syncMode === "api_sandbox") {
    return {
      ok: true,
      orders: [{
        platform: connection.platform,
        orderNo: `${connection.platform.toUpperCase()}-${Date.now().toString().slice(-8)}`,
        customerCode: connection.customerCode,
        skuCode: "请填写SKU编码",
        quantity: 1,
        channel: "Royal Mail 48",
        recipientName: "沙箱收件人",
        deliveryAddress: "英国伦敦示例街10号",
        requestedShipDate: new Date().toISOString().slice(0, 10),
        note: "平台沙箱同步预检订单",
      }],
    };
  }
  if (connection.platform === "amazon") return pullAmazonOrders(connection);
  if (connection.platform === "tiktok_shop") return pullTikTokOrders(connection);
  if (connection.platform === "shopify") return pullShopifyOrders(connection);
  if (connection.platform === "ebay") return pullEbayOrders(connection);

  const token = tokenFor(connection);
  const endpoint = endpointFor(connection, "orders");
  if (!token) return { ok: false, orders: [], error: "缺少平台 API Token，请在环境变量中配置 credentialRef 或平台默认 Token。" };
  if (!endpoint) return { ok: false, orders: [], error: "缺少平台订单同步地址，请配置 *_ORDERS_URL 或 *_API_BASE_URL。" };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Sheffield-Platform": connection.platform },
    body: JSON.stringify({ platform: connection.platform, storeName: connection.storeName, customerCode: connection.customerCode, fieldMapping: connection.fieldMapping, since: connection.lastSyncAt }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, orders: [], error: `平台接口连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : `平台接口返回 ${response.status}`;
    return { ok: false, orders: [], error: message, raw: payload };
  }

  return { ok: true, orders: normalizeGenericOrders(payload, connection), cancelledOrders: normalizeGenericCancelledOrders(payload, connection), raw: payload };
}

function ebayCarrierCode(carrierName?: string, carrierServiceName?: string) {
  const text = `${carrierName || ""} ${carrierServiceName || ""}`.toLowerCase();
  if (text.includes("royal")) return "Royal Mail";
  if (text.includes("dpd")) return "DPD";
  if (text.includes("evri") || text.includes("hermes")) return "Evri";
  return carrierName || carrierServiceName || "Other";
}

async function pushShopifyFulfillment({
  connection,
  orderNo,
  outboundId,
  trackingNumber,
  carrierName,
  carrierServiceName,
}: {
  connection: PlatformConnection;
  orderNo: string;
  outboundId: string;
  trackingNumber: string;
  carrierName?: string;
  carrierServiceName?: string;
}): Promise<PlatformGatewayFulfillmentResult> {
  const token = tokenFor(connection);
  const base = shopifyAdminBase(connection);
  if (!token) return { ok: false, error: "缺少 Shopify Access Token，无法回传发货追踪号。" };
  if (!base) return { ok: false, error: "缺少 Shopify API_BASE_URL，无法回传发货追踪号。" };

  const fulfillmentOrdersResponse = await fetch(`${base}/orders/${encodeURIComponent(orderNo)}/fulfillment_orders.json`, {
    method: "GET",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", "X-Sheffield-Platform": "shopify" },
  }).catch((error: unknown) => ({ error }));
  if ("error" in fulfillmentOrdersResponse) return { ok: false, error: `Shopify fulfillment orders 连接失败：${fulfillmentOrdersResponse.error instanceof Error ? fulfillmentOrdersResponse.error.message : "网络异常"}` };
  const fulfillmentOrdersPayload = await fulfillmentOrdersResponse.json().catch(() => ({}));
  if (!fulfillmentOrdersResponse.ok) {
    const message = typeof fulfillmentOrdersPayload === "object" && fulfillmentOrdersPayload && "error" in fulfillmentOrdersPayload ? String((fulfillmentOrdersPayload as { error?: unknown }).error) : `Shopify fulfillment orders 返回 ${fulfillmentOrdersResponse.status}`;
    return { ok: false, raw: fulfillmentOrdersPayload, error: message };
  }

  const fulfillmentOrders = Array.isArray((fulfillmentOrdersPayload as { fulfillment_orders?: unknown }).fulfillment_orders)
    ? (fulfillmentOrdersPayload as { fulfillment_orders: Array<Record<string, unknown>> }).fulfillment_orders
    : [];
  const target = fulfillmentOrders.find((item) => !["closed", "cancelled", "canceled"].includes(clean(item.status).toLowerCase())) || fulfillmentOrders[0];
  const fulfillmentOrderId = clean(target?.id);
  if (!fulfillmentOrderId) return { ok: false, raw: fulfillmentOrdersPayload, error: "Shopify 未返回可履约的 fulfillment_order_id。" };

  const response = await fetch(`${base}/fulfillments.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", "X-Sheffield-Platform": "shopify" },
    body: JSON.stringify({
      fulfillment: {
        message: `Sheffield Warehouse 发货回传：${outboundId}`,
        notify_customer: false,
        tracking_info: { number: trackingNumber, company: carrierName || carrierServiceName || "Sheffield Warehouse" },
        line_items_by_fulfillment_order: [{ fulfillment_order_id: Number(fulfillmentOrderId) }],
      },
    }),
  }).catch((error: unknown) => ({ error }));
  if ("error" in response) return { ok: false, error: `Shopify 发货回传连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : `Shopify 发货回传返回 ${response.status}`;
    return { ok: false, raw: payload, error: message };
  }
  return { ok: true, raw: payload };
}

async function pushEbayFulfillment({
  connection,
  orderNo,
  outboundId,
  trackingNumber,
  carrierName,
  carrierServiceName,
}: {
  connection: PlatformConnection;
  orderNo: string;
  outboundId: string;
  trackingNumber: string;
  carrierName?: string;
  carrierServiceName?: string;
}): Promise<PlatformGatewayFulfillmentResult> {
  const token = tokenFor(connection);
  if (!token) return { ok: false, error: "缺少 eBay OAuth Access Token，无法回传发货追踪号。" };

  const base = ebayFulfillmentBase(connection);
  const response = await fetch(`${base}/order/${encodeURIComponent(orderNo)}/shipping_fulfillment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Sheffield-Platform": "ebay" },
    body: JSON.stringify({ shippedDate: new Date().toISOString(), shippingCarrierCode: ebayCarrierCode(carrierName, carrierServiceName), trackingNumber }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, error: `eBay 发货回传连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorText = typeof payload === "object" && payload && "errors" in payload ? JSON.stringify((payload as { errors?: unknown }).errors) : `eBay Fulfillment API 返回 ${response.status}`;
    return { ok: false, raw: { fulfillment: payload, outboundId }, error: errorText };
  }
  return { ok: true, raw: { fulfillment: payload, outboundId } };
}

async function pushConfiguredPlatformFulfillment({
  connection,
  platformHeader,
  fallbackPath,
  defaultBase,
  orderNo,
  outboundId,
  trackingNumber,
  carrierName,
  carrierServiceName,
  extraHeaders = {},
}: {
  connection: PlatformConnection;
  platformHeader: string;
  fallbackPath: string;
  defaultBase: string;
  orderNo: string;
  outboundId: string;
  trackingNumber: string;
  carrierName?: string;
  carrierServiceName?: string;
  extraHeaders?: Record<string, string>;
}): Promise<PlatformGatewayFulfillmentResult> {
  const token = tokenFor(connection);
  if (!token) return { ok: false, error: `缺少 ${platformHeader} Access Token，无法回传发货追踪号。` };

  const endpoint = configuredEndpoint(connection, "fulfillment", fallbackPath.replace("{orderNo}", encodeURIComponent(orderNo)), defaultBase);
  if (!endpoint) return { ok: false, error: `缺少 ${platformHeader} 发货回传地址，请配置平台默认 API_BASE_URL、FULFILLMENT_URL 或 credentialRef。` };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Sheffield-Platform": connection.platform,
      ...extraHeaders,
    },
    body: JSON.stringify({
      orderNo,
      outboundId,
      trackingNumber,
      carrierName,
      carrierServiceName,
      shippedAt: new Date().toISOString(),
      warehouse: "Sheffield Warehouse",
    }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, error: `${platformHeader} 发货回传连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : `${platformHeader} 发货回传返回 ${response.status}`;
    return { ok: false, raw: payload, error: message };
  }
  return { ok: true, raw: payload };
}

export async function pushPlatformFulfillment({
  connection,
  orderNo,
  outboundId,
  trackingNumber,
  carrierName,
  carrierServiceName,
}: {
  connection: PlatformConnection;
  orderNo: string;
  outboundId: string;
  trackingNumber: string;
  carrierName?: string;
  carrierServiceName?: string;
}): Promise<PlatformGatewayFulfillmentResult> {
  if (connection.syncMode === "manual_csv") return { ok: true, raw: { skipped: "manual_csv" } };
  if (connection.syncMode === "api_sandbox") return { ok: true, raw: { sandbox: true, orderNo, trackingNumber } };
  if (connection.platform === "amazon") {
    const token = tokenFor(connection) || "";
    return pushConfiguredPlatformFulfillment({
      connection,
      platformHeader: "Amazon SP-API",
      fallbackPath: "/orders/v0/orders/{orderNo}/shipmentConfirmation",
      defaultBase: "https://sellingpartnerapi-eu.amazon.com",
      orderNo,
      outboundId,
      trackingNumber,
      carrierName,
      carrierServiceName,
      extraHeaders: { "x-amz-access-token": token },
    });
  }
  if (connection.platform === "tiktok_shop") {
    const token = tokenFor(connection) || "";
    return pushConfiguredPlatformFulfillment({
      connection,
      platformHeader: "TikTok Shop",
      fallbackPath: "/fulfillment/202309/orders/{orderNo}/shipping_info/update",
      defaultBase: "https://open-api.tiktokglobalshop.com",
      orderNo,
      outboundId,
      trackingNumber,
      carrierName,
      carrierServiceName,
      extraHeaders: { "x-tts-access-token": token },
    });
  }
  if (connection.platform === "shopify") return pushShopifyFulfillment({ connection, orderNo, outboundId, trackingNumber, carrierName, carrierServiceName });
  if (connection.platform === "ebay") return pushEbayFulfillment({ connection, orderNo, outboundId, trackingNumber, carrierName, carrierServiceName });

  const token = tokenFor(connection);
  const endpoint = endpointFor(connection, "fulfillment");
  if (!token) return { ok: false, error: "缺少平台 API Token，无法回传发货追踪号。" };
  if (!endpoint) return { ok: false, error: "缺少平台发货回传地址，请配置 *_FULFILLMENT_URL 或 *_API_BASE_URL。" };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Sheffield-Platform": connection.platform },
    body: JSON.stringify({ orderNo, outboundId, trackingNumber, carrierName, carrierServiceName }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) return { ok: false, error: `平台发货回传连接失败：${response.error instanceof Error ? response.error.message : "网络异常"}` };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : `平台接口返回 ${response.status}`;
    return { ok: false, raw: payload, error: message };
  }
  return { ok: true, raw: payload };
}
