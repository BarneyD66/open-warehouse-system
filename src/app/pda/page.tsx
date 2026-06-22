import type { Metadata } from "next";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, outboundWorkModeLabel, type CoreOutboundOrder, type PurchaseReceiptStatus, type ReturnOrderStatus } from "@/lib/warehouseCoreStore";
import { PdaScanConsole, type PdaOutboundTask, type PdaPurchaseTask, type PdaReturnTask } from "../components/PdaScanConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PDA 扫码作业台",
};

const outboundStatusLabels: Record<CoreOutboundOrder["status"], string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待面单",
  packing_check: "打包复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
};

const purchaseStatusLabels: Record<PurchaseReceiptStatus, string> = {
  draft: "草稿",
  in_transit: "在途",
  arrived: "已到仓",
  partially_received: "部分签收",
  received: "已签收",
  putaway_completed: "已上架",
  exception: "异常",
  cancelled: "已取消",
};

const returnStatusLabels: Record<ReturnOrderStatus, string> = {
  requested: "待审核",
  label_sent: "退货指引已发",
  in_transit: "退货在途",
  received: "已到仓",
  inspection: "质检中",
  restocked: "已上架",
  repair: "维修中",
  disposed: "已处理",
  closed: "已关闭",
  exception: "异常",
};

function requiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function scannedQty(progress?: Record<string, number>) {
  return Object.values(progress ?? {}).reduce((sum, value) => sum + value, 0);
}

export default async function PdaPage() {
  const [staff, coreData] = await Promise.all([requireStaffSession(), getWarehouseCoreData()]);
  const outboundTasks: PdaOutboundTask[] = coreData.outboundOrders
    .filter((item) => item.status !== "shipped")
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .map((item) => ({
      id: item.id,
      label: `${item.channel} / ${item.orderCount} 单`,
      status: outboundStatusLabels[item.status],
      customerCode: item.customerCode,
      channel: item.channel,
      workMode: outboundWorkModeLabel(item.workMode),
      pickWaveNo: item.pickWaveNo,
      pickListNo: item.pickListNo,
      basketNo: item.basketNo,
      requiredQty: requiredQty(item),
      pickedQty: scannedQty(item.scanProgress?.pickedQtyBySku),
      sortedQty: scannedQty(item.scanProgress?.sortedQtyBySku),
      packedQty: scannedQty(item.scanProgress?.packedQtyBySku),
      skuLines: item.skuLines ?? [],
      lastScans: item.scanProgress?.lastScans,
    }));

  const purchaseTasks: PdaPurchaseTask[] = coreData.purchaseReceipts
    .filter((item) => !["putaway_completed", "cancelled"].includes(item.status))
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .map((item) => ({
      id: item.id,
      label: `${item.supplierName} / ${item.totalReceivedQty}/${item.totalExpectedQty}`,
      status: purchaseStatusLabels[item.status],
      supplierName: item.supplierName,
      customerCode: item.customerCode,
      trackingNumber: item.trackingNumber,
      totalExpectedQty: item.totalExpectedQty,
      totalReceivedQty: item.totalReceivedQty,
      totalPutawayQty: item.totalPutawayQty,
      lines: item.lines.map((line) => ({
        skuCode: line.skuCode,
        expectedQty: line.expectedQty,
        receivedQty: line.receivedQty,
        putawayQty: line.putawayQty,
        locationCode: line.locationCode,
      })),
      scanLogs: item.scanLogs,
    }));

  const returnTasks: PdaReturnTask[] = coreData.returnOrders
    .filter((item) => !["closed", "disposed"].includes(item.status))
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .map((item) => ({
      id: item.id,
      label: `${item.platform} / ${item.customerCode}`,
      status: returnStatusLabels[item.status],
      customerCode: item.customerCode,
      platform: item.platform,
      originalOrderNo: item.originalOrderNo,
      buyerReturnTracking: item.buyerReturnTracking,
      locationCode: item.locationCode,
      inspectionResult: item.inspectionResult,
      skuLines: item.skuLines,
      scanLogs: item.scanLogs,
    }));

  return <PdaScanConsole outboundTasks={outboundTasks} purchaseTasks={purchaseTasks} returnTasks={returnTasks} staffLabel={`${staff.displayName || staff.username} / ${staff.role}`} />;
}
