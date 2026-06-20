import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, suggestOutboundLotAllocations, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type OutboundLotAllocationReportRow = {
  outboundId: string;
  customerCode: string;
  status: string;
  channel: string;
  pickWaveNo: string;
  pickListNo: string;
  skuCode: string;
  requiredQty: number;
  allocatedQty: number;
  shortageQty: number;
  lotNo: string;
  lotPickQty: number | "";
  lotAvailableQty: number | "";
  warehouseLocation: string;
  expiryDate: string;
  daysUntilExpiry: number | "";
  risk: string;
  createdAt: string;
  updatedAt: string;
};

const outboundStatusLabel: Record<CoreOutboundOrder["status"], string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待面单",
  packing_check: "包装复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
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

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function riskText(shortageQty: number, daysUntilExpiry: number | "") {
  if (shortageQty > 0) return "批次库存不足";
  if (typeof daysUntilExpiry === "number" && daysUntilExpiry < 0) return "批次已过期";
  if (typeof daysUntilExpiry === "number" && daysUntilExpiry <= 45) return "临期优先拣货";
  return "正常";
}

function buildRows(data: Awaited<ReturnType<typeof getWarehouseCoreData>>) {
  const rows: OutboundLotAllocationReportRow[] = [];
  const activeOrders = data.outboundOrders.filter((order) => ["pending_review", "picking", "label_pending", "packing_check", "handover"].includes(order.status));
  for (const order of activeOrders) {
    const allocations = suggestOutboundLotAllocations(order, data.inventoryLots);
    for (const allocation of allocations) {
      if (allocation.lots.length === 0) {
        rows.push({
          outboundId: order.id,
          customerCode: order.customerCode,
          status: outboundStatusLabel[order.status] ?? order.status,
          channel: order.channel,
          pickWaveNo: order.pickWaveNo ?? "",
          pickListNo: order.pickListNo ?? "",
          skuCode: allocation.skuCode,
          requiredQty: allocation.requiredQty,
          allocatedQty: allocation.allocatedQty,
          shortageQty: allocation.shortageQty,
          lotNo: "",
          lotPickQty: "",
          lotAvailableQty: "",
          warehouseLocation: "",
          expiryDate: "",
          daysUntilExpiry: "",
          risk: riskText(allocation.shortageQty, ""),
          createdAt: order.createdAt,
          updatedAt: order.updatedAt ?? order.createdAt,
        });
        continue;
      }
      for (const lot of allocation.lots) {
        rows.push({
          outboundId: order.id,
          customerCode: order.customerCode,
          status: outboundStatusLabel[order.status] ?? order.status,
          channel: order.channel,
          pickWaveNo: order.pickWaveNo ?? "",
          pickListNo: order.pickListNo ?? "",
          skuCode: allocation.skuCode,
          requiredQty: allocation.requiredQty,
          allocatedQty: allocation.allocatedQty,
          shortageQty: allocation.shortageQty,
          lotNo: lot.lotNo,
          lotPickQty: lot.quantity,
          lotAvailableQty: lot.availableQty,
          warehouseLocation: lot.locationCode ?? "",
          expiryDate: lot.expiryDate ?? "",
          daysUntilExpiry: lot.daysUntilExpiry ?? "",
          risk: riskText(allocation.shortageQty, lot.daysUntilExpiry ?? ""),
          createdAt: order.createdAt,
          updatedAt: order.updatedAt ?? order.createdAt,
        });
      }
    }
  }
  return rows;
}

function applyFilters(rows: OutboundLotAllocationReportRow[], url: URL) {
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const skuCode = clean(url.searchParams.get("skuCode")).toLowerCase();
  const outboundId = clean(url.searchParams.get("outboundId")).toLowerCase();
  const risk = clean(url.searchParams.get("risk"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.outboundId, row.customerCode, row.channel, row.pickWaveNo, row.pickListNo, row.skuCode, row.lotNo, row.warehouseLocation, row.risk].join(" ").toLowerCase();
    return (
      (!customerCode || row.customerCode.toLowerCase().includes(customerCode)) &&
      (!skuCode || row.skuCode.toLowerCase().includes(skuCode)) &&
      (!outboundId || row.outboundId.toLowerCase().includes(outboundId)) &&
      (!risk || risk === "all" || row.risk === risk) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出出库批次分配报表。" }, { status: 403 });

  const url = new URL(request.url);
  const data = await getWarehouseCoreData();
  const rows = applyFilters(buildRows(data), url).sort((left, right) => right.shortageQty - left.shortageQty || left.outboundId.localeCompare(right.outboundId) || left.skuCode.localeCompare(right.skuCode));

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "outbound-lot-allocation",
      summary: "导出出库批次分配建议报表",
      note: `行数：${rows.length}`,
      after: {
        customerCode: url.searchParams.get("customerCode") ?? "",
        skuCode: url.searchParams.get("skuCode") ?? "",
        outboundId: url.searchParams.get("outboundId") ?? "",
        risk: url.searchParams.get("risk") ?? "all",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("出库批次分配建议.csv", [
    ["出库单号", "客户编号", "出库状态", "物流渠道", "波次号", "拣货单号", "SKU", "需求数量", "已分配数量", "缺口数量", "批次号", "本批次建议拣货", "批次可用库存", "建议库位", "效期", "距到期天数", "风险提示", "创建时间", "更新时间"],
    ...rows.map((row) => [
      row.outboundId,
      row.customerCode,
      row.status,
      row.channel,
      row.pickWaveNo,
      row.pickListNo,
      row.skuCode,
      row.requiredQty,
      row.allocatedQty,
      row.shortageQty,
      row.lotNo,
      row.lotPickQty,
      row.lotAvailableQty,
      row.warehouseLocation,
      row.expiryDate,
      row.daysUntilExpiry,
      row.risk,
      row.createdAt,
      row.updatedAt,
    ]),
  ]);
}
