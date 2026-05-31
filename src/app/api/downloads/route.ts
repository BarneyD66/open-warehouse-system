import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customerAuth";
import { billingExportRows } from "@/lib/billingUtils";
import { getWarehouseCoreDataForCustomer, outboundClaimStatusLabel, outboundDeliveryExceptionTypeLabel } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const outboundStatusLabel: Record<string, string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待面单",
  packing_check: "打包复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
};

const labelStatusLabel: Record<string, string> = {
  not_requested: "未申请",
  pending: "待生成",
  rated: "已计费",
  generated: "已生成",
  failed: "生成失败",
};

const exceptionStatusLabel: Record<string, string> = {
  open: "待处理",
  investigating: "处理中",
  resolved: "已处理",
  ignored: "已忽略",
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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

export async function GET(request: Request) {
  const session = await requireCustomerSession();
  const kind = new URL(request.url).searchParams.get("kind") || "inventory";
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);

  if (kind === "inventory") {
    return csvResponse(`库存报表-${session.customerCode}.csv`, [
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

  if (kind === "outbound") {
    return csvResponse(`出库明细-${session.customerCode}.csv`, [
      ["出库单号", "物流渠道", "订单数", "状态", "收件人", "追踪号", "承运商", "服务名称", "预计运费", "最新轨迹", "创建时间", "SKU 明细", "收件地址"],
      ...data.outboundOrders.map((item) => {
        const latest = item.trackingEvents?.[0];
        return [
          item.id,
          item.channel,
          item.orderCount,
          outboundStatusLabel[item.status] ?? item.status,
          item.recipientName ?? "",
          item.trackingNumber ?? "",
          item.carrierName ?? "",
          item.carrierServiceName ?? "",
          item.shippingFee ?? "",
          latest ? `${latest.label}${latest.detail ? `：${latest.detail}` : ""}` : "",
          item.createdAt,
          (item.skuLines ?? []).map((line) => `${line.skuCode} x ${line.quantity}`).join(" | "),
          item.deliveryAddress ?? "",
        ];
      }),
    ]);
  }

  if (kind === "billing") {
    return csvResponse(`费用明细-${session.customerCode}.csv`, billingExportRows(data.billingRecords));
  }

  if (kind === "labels") {
    return csvResponse(`面单列表-${session.customerCode}.csv`, [
      ["出库单号", "面单状态", "追踪号", "承运商", "服务名称", "收件人", "创建时间", "面单链接"],
      ...data.outboundOrders.map((item) => [
        item.id,
        labelStatusLabel[item.labelStatus ?? "not_requested"] ?? item.labelStatus ?? "未申请",
        item.trackingNumber ?? "",
        item.carrierName ?? "",
        item.carrierServiceName ?? "",
        item.recipientName ?? "",
        item.createdAt,
        item.labelStatus === "generated" ? `/warehouse/print/label/${item.id}` : "",
      ]),
    ]);
  }

  if (kind === "proofs") {
    return csvResponse(`签收证明-${session.customerCode}.csv`, [
      ["出库单号", "追踪号", "签收状态", "签收证明链接", "最新节点", "最新说明", "最新地点", "发生时间"],
      ...data.outboundOrders.map((item) => {
        const delivered = item.trackingEvents?.find((event) => event.status === "delivered");
        const latest = item.trackingEvents?.[0];
        const proofException = item.exceptions?.find((event) => event.proofUrl);
        return [
          item.id,
          item.trackingNumber ?? "",
          delivered ? "已签收" : "待签收",
          proofException?.proofUrl ?? "",
          delivered?.label ?? latest?.label ?? "",
          delivered?.detail ?? latest?.detail ?? "",
          delivered?.location ?? latest?.location ?? "",
          delivered?.occurredAt ?? latest?.occurredAt ?? "",
        ];
      }),
    ]);
  }

  if (kind === "delivery-exceptions") {
    return csvResponse(`物流异常与赔付-${session.customerCode}.csv`, [
      ["出库单号", "追踪号", "异常类型", "异常状态", "严重程度", "异常说明", "改派要求", "签收证明链接", "赔付金额", "赔付状态", "赔付备注", "创建时间", "处理时间"],
      ...data.outboundOrders.flatMap((item) =>
        (item.exceptions ?? []).map((exception) => [
          item.id,
          item.trackingNumber ?? "",
          exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : outboundDeliveryExceptionTypeLabel.manual,
          exceptionStatusLabel[exception.status] ?? exception.status,
          exception.severity === "critical" ? "严重" : "提醒",
          exception.message,
          exception.redeliveryRequired ? exception.redeliveryNote ?? "需要改派" : "",
          exception.proofUrl ?? "",
          exception.claimAmount ?? "",
          exception.claimStatus ? outboundClaimStatusLabel[exception.claimStatus] : "",
          exception.claimNote ?? "",
          exception.createdAt,
          exception.resolvedAt ?? "",
        ]),
      ),
    ]);
  }

  return NextResponse.json({ error: "不支持的下载类型" }, { status: 400 });
}
