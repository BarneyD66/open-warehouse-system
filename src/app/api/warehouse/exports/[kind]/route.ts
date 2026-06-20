import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { getLocationUtilization, getWarehouseCoreData, outboundClaimStatusLabel, outboundWorkModeLabel, warehouseLocationStatusLabel, warehouseLocationZoneTypeLabel } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ kind: string }>;
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function attachmentHeader(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download.csv";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function csvResponse(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\ufeff${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentHeader(filename),
    },
  });
}

const outboundStatusLabels: Record<string, string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待面单",
  packing_check: "打包复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
};

const interceptStatusLabels: Record<string, string> = {
  none: "无截单",
  requested: "已申请截单",
  intercepted: "已截单",
  returned: "已回库",
  failed: "截单失败",
};

export async function GET(_request: Request, context: RouteContext) {
  await requireStaffSession();
  const { kind } = await context.params;
  const data = await getWarehouseCoreData();

  if (kind === "locations") {
    return csvResponse("仓库库位.csv", [
      ["库位编码", "仓库编号", "库区", "库位类型", "状态", "容量 CBM", "件数容量", "当前占用件数", "剩余件数", "允许混放 SKU", "备注", "更新时间"],
      ...data.locations.map((item) => {
        const utilization = getLocationUtilization(data, item.locationCode);
        return [
          item.locationCode,
          item.warehouseCode,
          item.zone,
          warehouseLocationZoneTypeLabel(item.zoneType),
          warehouseLocationStatusLabel(item.status),
          item.capacityCbm ?? "",
          item.capacityQty ?? "",
          utilization.usedQty,
          utilization.remainingQty ?? "",
          item.allowMixedSku === false ? "否" : "是",
          item.note ?? "",
          item.updatedAt,
        ];
      }),
    ]);
  }

  if (kind === "inventory") {
    return csvResponse("仓库库存.csv", [
      ["客户编号", "SKU 编码", "仓库编号", "库位编码", "可用库存", "销售占用", "冻结库存", "残次品库存", "在途入库", "库存合计", "预警库存", "库龄天数", "更新时间"],
      ...data.inventoryBalances.map((item) => [
        item.customerCode,
        item.skuCode,
        item.warehouseCode,
        item.locationCode ?? "",
        item.availableQty,
        item.reservedQty,
        item.frozenQty ?? 0,
        item.defectiveQty ?? 0,
        item.inboundQty,
        item.availableQty + item.reservedQty + (item.frozenQty ?? 0) + (item.defectiveQty ?? 0),
        item.alertQty,
        item.agingDays,
        item.updatedAt,
      ]),
    ]);
  }

  if (kind === "outbound-template") {
    return csvResponse("出库订单导入模板.csv", [
      ["销售平台", "平台订单号", "客户编号", "SKU 编码", "数量", "物流渠道", "收件人", "收件地址", "要求发货日期", "备注"],
      ["Shopify", "平台订单-001", "CUST-202605-0001", "SKU-001", 1, "Royal Mail 48", "张三", "英国伦敦示例街10号", "2026-05-26", "请按默认包材发货"],
    ]);
  }

  if (kind === "outbound") {
    return csvResponse("仓库出库订单.csv", [
      ["出库单号", "客户编号", "作业模式", "波次号", "拣货单号", "拣货员", "篮号/格口", "物流渠道", "订单数", "状态", "承运商", "服务名称", "追踪号", "最新轨迹", "重打次数", "截单状态", "未处理异常数", "严重异常数", "最近异常说明", "改派要求", "签收证明", "赔付金额", "赔付状态", "预计运费", "实际运费", "创建时间", "更新时间"],
      ...data.outboundOrders.map((item) => {
        const openExceptions = (item.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
        const latestException = openExceptions[0] ?? item.exceptions?.[0];
        const latestTracking = item.trackingEvents?.[0];
        return [
          item.id,
          item.customerCode,
          outboundWorkModeLabel(item.workMode),
          item.pickWaveNo ?? "",
          item.pickListNo ?? "",
          item.assignedPicker ?? "",
          item.basketNo ?? "",
          item.channel,
          item.orderCount,
          outboundStatusLabels[item.status] ?? item.status,
          item.carrierName ?? "",
          item.carrierServiceName ?? "",
          item.trackingNumber ?? "",
          latestTracking ? `${latestTracking.label}${latestTracking.detail ? `：${latestTracking.detail}` : ""}` : "",
          item.reprintLogs?.length ?? 0,
          interceptStatusLabels[item.interceptStatus ?? "none"] ?? item.interceptStatus ?? "无截单",
          openExceptions.length,
          openExceptions.filter((exception) => exception.severity === "critical").length,
          latestException?.message ?? "",
          latestException?.redeliveryRequired ? latestException.redeliveryNote ?? "需要改派" : "",
          latestException?.proofUrl ?? "",
          latestException?.claimAmount ?? "",
          latestException?.claimStatus ? outboundClaimStatusLabel[latestException.claimStatus] : "",
          item.shippingFee ?? "",
          item.actualShippingFee ?? "",
          item.createdAt,
          item.updatedAt ?? "",
        ];
      }),
    ]);
  }

  if (kind === "outbound-legacy") {
    return csvResponse("仓库出库订单.csv", [
      ["出库单号", "客户编号", "作业模式", "波次号", "拣货单号", "拣货员", "篮号/格口", "物流渠道", "订单数", "状态", "承运商", "追踪号", "重打次数", "截单状态", "未处理异常数", "严重异常数", "最近异常说明", "预估运费", "实际运费", "创建时间", "更新时间"],
      ...data.outboundOrders.map((item) => {
        const openExceptions = (item.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
        return [
          item.id,
          item.customerCode,
          outboundWorkModeLabel(item.workMode),
          item.pickWaveNo ?? "",
          item.pickListNo ?? "",
          item.assignedPicker ?? "",
          item.basketNo ?? "",
          item.channel,
          item.orderCount,
          outboundStatusLabels[item.status] ?? item.status,
          item.carrierName ?? "",
          item.trackingNumber ?? "",
          item.reprintLogs?.length ?? 0,
          interceptStatusLabels[item.interceptStatus ?? "none"] ?? item.interceptStatus ?? "无截单",
          openExceptions.length,
          openExceptions.filter((exception) => exception.severity === "critical").length,
          openExceptions[0]?.message ?? "",
          item.shippingFee ?? "",
          item.actualShippingFee ?? "",
          item.createdAt,
          item.updatedAt ?? "",
        ];
      }),
    ]);
  }

  return NextResponse.json({ error: "不支持的导出类型" }, { status: 400 });
}
