import type { InboundSubmission } from "./localStore";
import type { WarehouseCoreData } from "./warehouseCoreStore";

export type WarehouseTelegramEvent = { title: string; customerCode?: string; reference: string; details: string[] };
export type CoreNotificationSnapshot = Pick<WarehouseCoreData, "skus" | "outboundOrders" | "returnOrders" | "purchaseReceipts"> & { skuAlertQuantities: Record<string, number[]> };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const quantity = (value: unknown) => typeof value === "number" ? String(value) : "未录入";

function event(title: string, row: { id?: string; skuCode?: string; customerCode?: string }, details: string[]): WarehouseTelegramEvent {
  return { title, reference: row.id || row.skuCode || "", customerCode: row.customerCode, details: details.filter(Boolean) };
}

const inboundTitles: Record<string, string> = {
  arrived: "确认到仓", receiving: "开始收货", partially_received: "部分收货", received: "收货完成",
  partially_putaway: "部分上架", putaway_completed: "上架完成", exception: "入库异常", on_hold: "入库暂停",
};

export function buildInboundTelegramEvents(before: InboundSubmission | null, row: InboundSubmission): WarehouseTelegramEvent[] {
  const result: WarehouseTelegramEvent[] = [];
  const lines = (row.skuLines || []).map(line => `${line.skuCode}：预报 ${quantity(line.expectedQty)} / 实收 ${quantity(line.receivedQty)} / 上架 ${quantity(line.putawayQty)}${line.locationCode ? ` / ${line.locationCode}` : ""}`).join("；");
  const base = [`状态：${row.status}`, `预计到仓：${row.eta}`, `箱数：${row.cartons}`, lines, row.opsNote || row.supplementNote || ""];
  if (!before) result.push(event("入库预报提交", row, base));
  else {
    const fields = ["eta", "cartons", "skuCount", "totalProductQty", "productName", "transport", "tracking", "attachmentNames", "supplementNote", "contact", "phone", "platform", "attribute", "service"] as const;
    const forecast = (item: InboundSubmission) => item.skuLines?.map(line => [line.skuCode, line.productName, line.expectedQty, line.cartonCount]);
    if (fields.some(key => !same(before[key], row[key])) || !same(forecast(before), forecast(row))) result.push(event("入库预报修改", row, base));
    if (row.status !== before.status && inboundTitles[row.status]) {
      const latest = row.events?.at(-1);
      result.push(event(inboundTitles[row.status], row, [...base, `原状态：${before.status}`, latest?.messageInternal || latest?.messageCustomer || ""]));
    }
    const received = (item: InboundSubmission) => item.skuLines?.map(line => [line.skuCode, line.receivedQty]);
    const putaway = (item: InboundSubmission) => item.skuLines?.map(line => [line.skuCode, line.putawayQty, line.locationCode]);
    if (!same(received(before), received(row)) && ["receiving", "partially_received", "received", "exception"].includes(row.status) && row.status === before.status) result.push(event("收货数量更新", row, base));
    if (!same(putaway(before), putaway(row)) && ["partially_putaway", "putaway_completed"].includes(row.status) && row.status === before.status) result.push(event("上架数量更新", row, base));
    if (row.exceptionNote && row.exceptionNote !== before.exceptionNote) result.push(event("入库异常说明", row, [...base, row.exceptionNote]));
  }
  const oldExceptions = new Map((before?.receivingExceptions || []).map(item => [item.id, item]));
  for (const item of row.receivingExceptions || []) {
    if (same(oldExceptions.get(item.id), item)) continue;
    result.push(event("收货差异 / 异常", row, [
      `异常编号：${item.id}`, `类型：${item.type} / ${item.status}`, item.skuCode ? `SKU：${item.skuCode}` : "",
      `预期：${quantity(item.expectedQty)} / 实际：${quantity(item.actualQty)}`, item.message,
      item.resolutionNote || "",
    ]));
  }
  return result;
}

export function snapshotCoreNotifications(data: WarehouseCoreData): CoreNotificationSnapshot {
  // Retain only the collections that can produce warehouse events, not inventory or billing data.
  const skuAlertQuantities = snapshotSkuAlerts(data);
  return structuredClone({ skus: data.skus, outboundOrders: data.outboundOrders, returnOrders: data.returnOrders, purchaseReceipts: data.purchaseReceipts, skuAlertQuantities });
}

export function buildCoreTelegramEvents(before: CoreNotificationSnapshot, data: WarehouseCoreData): WarehouseTelegramEvent[] {
  const result: WarehouseTelegramEvent[] = [];
  const currentAlerts = snapshotSkuAlerts(data);
  const oldSkus = new Map(before.skus.map(row => [`${row.customerCode}:${row.skuCode}`, row]));
  for (const row of data.skus) {
    const key = `${row.customerCode}:${row.skuCode}`;
    const old = oldSkus.get(key);
    if (!same(old, row) || !same(before.skuAlertQuantities[key], currentAlerts[key])) result.push(event(old ? "SKU 修改" : "SKU 新增", row, [
      `商品：${row.productName}`, row.barcode ? `条码：${row.barcode}` : "", `状态：${row.status}`, row.category ? `分类：${row.category}` : "",
      currentAlerts[key]?.length ? `库存预警数量：${currentAlerts[key].join(" / ")}` : "",
    ]));
  }
  const oldOrders = new Map(before.outboundOrders.map(row => [row.id, row]));
  for (const row of data.outboundOrders) {
    const old = oldOrders.get(row.id);
    const details = [
      row.platformOrderNo ? `平台订单号：${row.platformOrderNo}` : "", `状态：${row.status}`, `渠道：${row.channel}`,
      `订单数：${row.orderCount}`, `追踪单号：${row.trackingNumber || "未录入"}`,
      (row.skuLines || []).map(line => `${line.skuCode} × ${line.quantity}`).join("；"), row.note ? `备注：${row.note}` : "",
    ];
    if (!old) result.push(event("新订单 / 订单上传", row, details));
    if (row.status === "shipped" && (old?.status !== "shipped" || old?.trackingNumber !== row.trackingNumber)) result.push(event("发货签出", row, details));
    if (row.interceptStatus && row.interceptStatus !== "none" && old?.interceptStatus !== row.interceptStatus) {
      result.push(event("截单 / 拦截", row, [...details, `拦截状态：${row.interceptStatus}`, row.interceptReason || ""]));
    }
    if (row.status === "blocked" && old?.status !== "blocked" && (!row.interceptStatus || row.interceptStatus === "none")) result.push(event("订单异常阻塞", row, details));
    const oldItems = new Map((old?.exceptions || []).map(item => [item.id, item]));
    for (const item of row.exceptions || []) {
      if (!same(oldItems.get(item.id), item)) result.push(event("订单异常", row, [...details, `异常编号：${item.id}`, `异常状态：${item.status}`, item.message, item.resolutionNote || ""]));
    }
  }
  const oldReturns = new Map(before.returnOrders.map(row => [row.id, row]));
  for (const row of data.returnOrders) {
    const old = oldReturns.get(row.id);
    const details = [
      `状态：${row.status}`, row.originalOrderNo ? `原订单：${row.originalOrderNo}` : "", row.buyerReturnTracking ? `退货追踪号：${row.buyerReturnTracking}` : "",
      row.inspectionResult ? `质检结果：${row.inspectionResult}` : "", row.resolution ? `处理方案：${row.resolution}` : "", row.opsNote || "",
    ];
    if ((row.receivedAt && row.receivedAt !== old?.receivedAt) || (row.status === "received" && old?.status !== "received")) result.push(event("退货到仓", row, details));
    if ((row.inspectionResult && row.inspectionResult !== old?.inspectionResult) || (row.status === "inspection" && old?.status !== "inspection") || (row.resolution && row.resolution !== old?.resolution)) result.push(event("退货质检 / 处理结果", row, details));
    if (row.status === "exception" && old?.status !== "exception") result.push(event("退货异常", row, details));
  }
  const oldReceipts = new Map(before.purchaseReceipts.map(row => [row.id, row]));
  for (const row of data.purchaseReceipts) {
    const old = oldReceipts.get(row.id);
    // Inbound prealert mirroring is not a second prealert submission notification.
    const details = [
      `状态：${row.status}`, `预计 ${row.totalExpectedQty} / 实收 ${row.totalReceivedQty} / 上架 ${row.totalPutawayQty}`,
      ...row.lines.map(line => `${line.skuCode}：预计 ${line.expectedQty} / 实收 ${line.receivedQty} / 上架 ${line.putawayQty}`),
      row.exceptionNote || "", row.note || "",
    ];
    if (row.arrivedAt && row.arrivedAt !== old?.arrivedAt) result.push(event("采购收货确认到仓", row, details));
    if (row.totalReceivedQty !== (old?.totalReceivedQty ?? 0) || (row.receivedAt && row.receivedAt !== old?.receivedAt)) result.push(event("采购收货 / 数量差异", row, details));
    if (row.status === "putaway_completed" && old?.status !== "putaway_completed") result.push(event("采购上架完成", row, details));
    const oldItems = new Map((old?.discrepancyReports || []).map(item => [item.id, item]));
    for (const item of row.discrepancyReports || []) {
      if (!same(oldItems.get(item.id), item)) result.push(event("采购收货异常", row, [...details,
        `异常编号：${item.id} / ${item.type} / ${item.status}`, `预期 ${quantity(item.expectedQty)} / 实际 ${quantity(item.actualQty)}`, item.description,
      ]));
    }
  }
  return result;
}

function snapshotSkuAlerts(data: WarehouseCoreData) {
  const quantities: Record<string, number[]> = {};
  for (const balance of data.inventoryBalances) (quantities[`${balance.customerCode}:${balance.skuCode}`] ||= []).push(balance.alertQty);
  for (const values of Object.values(quantities)) values.sort((a, b) => a - b);
  return quantities;
}

export function renderWarehouseTelegramEvent(event: WarehouseTelegramEvent) {
  const text = [`【${event.title}】`, `客户：${event.customerCode || "未关联"}`, `业务编号：${event.reference}`, ...event.details].join("\n");
  // Plain text avoids HTML injection. Leave room below Telegram's 4096-character limit.
  const chars = Array.from(text);
  return chars.length > 3500 ? chars.slice(0, 3490).join("") + "\n…详情请查后台" : text;
}
