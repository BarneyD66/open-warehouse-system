import { outboundWorkModeLabel, type CoreOutboundOrder } from "./warehouseCoreStore";

export type PickWaveProgressStatus = "有异常" | "疑似卡住" | "待称重" | "复核中" | "分拣中" | "拣货中" | "待交接" | "待开始" | "已完成";

export type PickWaveProgressRow = {
  waveNo: string;
  workMode: string;
  assignedPicker: string;
  orderIds: string[];
  sampleOrders: Array<{
    id: string;
    customerCode: string;
    status: CoreOutboundOrder["status"];
    basketNo?: string;
    pickListNo?: string;
    trackingNumber?: string;
  }>;
  orderCount: number;
  customerCount: number;
  skuCount: number;
  requiredQty: number;
  pickedQty: number;
  sortedQty: number;
  packedQty: number;
  pickGap: number;
  sortGap: number;
  packGap: number;
  pickRate: number;
  sortRate: number;
  packRate: number;
  shippedOrders: number;
  pendingWeightOrders: number;
  exceptionCount: number;
  severeExceptionCount: number;
  carrierSummary: string;
  latestScanAt: string;
  idleHours: number | "";
  status: PickWaveProgressStatus;
  nextAction: string;
};

function sumRecord(record?: Record<string, number>) {
  return Object.values(record ?? {}).reduce((sum, value) => sum + value, 0);
}

function requiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? order.orderCount;
}

function latestScanAt(orders: CoreOutboundOrder[]) {
  return (
    orders
      .flatMap((order) => order.scanProgress?.lastScans ?? [])
      .map((scan) => scan.scannedAt)
      .sort()
      .at(-1) ?? ""
  );
}

function rate(done: number, required: number) {
  if (required <= 0) return 100;
  return Math.min(100, Math.round((done / required) * 1000) / 10);
}

function idleHours(latestAt: string, orders: CoreOutboundOrder[]): number | "" {
  const base = latestAt || orders.map((order) => order.updatedAt || order.createdAt).sort().at(-1) || "";
  const timestamp = new Date(base).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return Math.max(0, Math.round(((Date.now() - timestamp) / 3_600_000) * 10) / 10);
}

function waveStatus(input: {
  orders: CoreOutboundOrder[];
  pickGap: number;
  sortGap: number;
  packGap: number;
  pendingWeightOrders: number;
  exceptionCount: number;
  idleHours: number | "";
}): PickWaveProgressStatus {
  if (input.orders.every((order) => order.status === "shipped")) return "已完成";
  if (input.exceptionCount > 0 || input.orders.some((order) => order.status === "blocked" || order.labelStatus === "failed")) return "有异常";
  if (typeof input.idleHours === "number" && input.idleHours >= 4 && !input.orders.every((order) => order.status === "shipped")) return "疑似卡住";
  if (input.pendingWeightOrders > 0 && input.pickGap === 0 && input.sortGap === 0 && input.packGap === 0) return "待称重";
  if (input.packGap > 0 && input.pickGap === 0 && input.sortGap === 0) return "复核中";
  if (input.sortGap > 0 && input.pickGap === 0) return "分拣中";
  if (input.pickGap > 0) return "拣货中";
  if (input.orders.some((order) => order.status === "handover")) return "待交接";
  return "待开始";
}

function nextAction(status: PickWaveProgressStatus, row: Pick<PickWaveProgressRow, "pickGap" | "sortGap" | "packGap" | "pendingWeightOrders" | "severeExceptionCount">) {
  if (status === "有异常") return row.severeExceptionCount > 0 ? "先处理严重异常，再继续复核或交接。" : "处理波次内未关闭异常。";
  if (status === "疑似卡住") return "复核最新扫码记录，确认拣货员、库位或缺货问题。";
  if (status === "待称重") return "完成称重校验，再生成或复核面单。";
  if (row.pickGap > 0) return "继续扫码拣货，补齐未拣数量。";
  if (row.sortGap > 0) return "继续二次分拣，补齐未分拣数量。";
  if (row.packGap > 0) return "继续打包复核，补齐复核数量。";
  if (status === "待交接") return "打印交接清单并完成承运商交接。";
  if (status === "已完成") return "无需处理。";
  return "启动波次作业或重新分配拣货员。";
}

export function buildPickWaveProgressRows(orders: CoreOutboundOrder[]): PickWaveProgressRow[] {
  const groups = new Map<string, CoreOutboundOrder[]>();
  orders
    .filter((order) => order.pickWaveNo || order.pickListNo)
    .forEach((order) => {
      const waveNo = order.pickWaveNo || order.pickListNo || "未生成波次";
      groups.set(waveNo, [...(groups.get(waveNo) ?? []), order]);
    });

  return Array.from(groups.entries())
    .map(([waveNo, groupOrders]) => {
      const skuCodes = new Set(groupOrders.flatMap((order) => order.skuLines?.map((line) => line.skuCode) ?? []));
      const customers = new Set(groupOrders.map((order) => order.customerCode));
      const carriers = new Set(groupOrders.map((order) => order.carrierServiceName || order.carrierName || order.channel).filter(Boolean));
      const exceptions = groupOrders.flatMap((order) => order.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
      const workModes = new Set(groupOrders.map((order) => (order.workMode ? outboundWorkModeLabel(order.workMode) : "")));
      const pickers = new Set(groupOrders.map((order) => order.assignedPicker || "").filter(Boolean));
      const required = groupOrders.reduce((sum, order) => sum + requiredQty(order), 0);
      const picked = groupOrders.reduce((sum, order) => sum + sumRecord(order.scanProgress?.pickedQtyBySku), 0);
      const sorted = groupOrders.reduce((sum, order) => sum + sumRecord(order.scanProgress?.sortedQtyBySku), 0);
      const packed = groupOrders.reduce((sum, order) => sum + sumRecord(order.scanProgress?.packedQtyBySku), 0);
      const latest = latestScanAt(groupOrders);
      const idle = idleHours(latest, groupOrders);
      const pendingWeightOrders = groupOrders.filter((order) => !order.packageWeightKg || order.packageWeightKg <= 0).length;
      const rowBase = {
        pickGap: Math.max(0, required - picked),
        sortGap: Math.max(0, required - sorted),
        packGap: Math.max(0, required - packed),
        pendingWeightOrders,
        severeExceptionCount: exceptions.filter((exception) => exception.severity === "critical").length,
      };
      const status = waveStatus({ orders: groupOrders, exceptionCount: exceptions.length, idleHours: idle, ...rowBase });
      const row: PickWaveProgressRow = {
        waveNo,
        workMode: Array.from(workModes).filter(Boolean).join(" / ") || "未分配",
        assignedPicker: Array.from(pickers).join(" / ") || "未分配",
        orderIds: groupOrders.map((order) => order.id),
        sampleOrders: groupOrders.slice(0, 4).map((order) => ({
          id: order.id,
          customerCode: order.customerCode,
          status: order.status,
          basketNo: order.basketNo,
          pickListNo: order.pickListNo,
          trackingNumber: order.trackingNumber,
        })),
        orderCount: groupOrders.length,
        customerCount: customers.size,
        skuCount: skuCodes.size,
        requiredQty: required,
        pickedQty: picked,
        sortedQty: sorted,
        packedQty: packed,
        pickRate: rate(picked, required),
        sortRate: rate(sorted, required),
        packRate: rate(packed, required),
        shippedOrders: groupOrders.filter((order) => order.status === "shipped").length,
        exceptionCount: exceptions.length,
        carrierSummary: Array.from(carriers).join(" / ") || "未匹配",
        latestScanAt: latest,
        idleHours: idle,
        status,
        nextAction: "",
        ...rowBase,
      };
      row.nextAction = nextAction(status, row);
      return row;
    })
    .sort((left, right) => {
      const rank: Record<PickWaveProgressStatus, number> = { 有异常: 0, 疑似卡住: 1, 待称重: 2, 复核中: 3, 分拣中: 4, 拣货中: 5, 待交接: 6, 待开始: 7, 已完成: 8 };
      return rank[left.status] - rank[right.status] || right.latestScanAt.localeCompare(left.latestScanAt) || left.waveNo.localeCompare(right.waveNo);
    });
}
