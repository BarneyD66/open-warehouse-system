import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, outboundWorkModeLabel, returnOrderStatusLabel, type CoreOutboundOrder, type OutboundScanRecord, type ReturnOrder, type ReturnScanRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type ScanReportRow = {
  module: "出库" | "退货/RMA";
  sourceId: string;
  customerCode: string;
  action: string;
  code: string;
  codeType: string;
  skuCode?: string;
  quantity?: number;
  locationCode?: string;
  weightKg?: number;
  operator: string;
  scannedAt: string;
  status: string;
  detail: string;
};

const outboundActionLabel: Record<OutboundScanRecord["action"], string> = {
  pick: "拣货",
  sort: "配货",
  pack: "复核",
  ship: "签出",
  intercept: "截单",
};

const returnActionLabel: Record<ReturnScanRecord["action"], string> = {
  receive: "退货到仓",
  inspect: "退货质检",
};

const outboundStatusLabels: Record<CoreOutboundOrder["status"], string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待生成面单",
  packing_check: "打包复核",
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

function outboundRows(outbounds: CoreOutboundOrder[]): ScanReportRow[] {
  return outbounds.flatMap((order) =>
    (order.scanProgress?.lastScans ?? []).map((scan) => ({
      module: "出库" as const,
      sourceId: order.id,
      customerCode: order.customerCode,
      action: outboundActionLabel[scan.action],
      code: scan.code,
      codeType: scan.codeType,
      skuCode: scan.skuCode,
      quantity: scan.quantity,
      locationCode: scan.locationCode,
      weightKg: scan.weightKg,
      operator: scan.operator,
      scannedAt: scan.scannedAt,
      status: outboundStatusLabels[order.status] ?? order.status,
      detail: [order.channel, order.workMode ? outboundWorkModeLabel(order.workMode) : "", order.pickWaveNo, order.pickListNo, order.trackingNumber].filter(Boolean).join(" / "),
    })),
  );
}

function returnRows(returns: ReturnOrder[]): ScanReportRow[] {
  return returns.flatMap((order) =>
    (order.scanLogs ?? []).map((scan) => ({
      module: "退货/RMA" as const,
      sourceId: order.id,
      customerCode: order.customerCode,
      action: returnActionLabel[scan.action],
      code: scan.code,
      codeType: scan.codeType,
      skuCode: scan.skuCode,
      locationCode: scan.locationCode,
      operator: scan.operator,
      scannedAt: scan.scannedAt,
      status: returnOrderStatusLabel(order.status),
      detail: [order.platform, order.originalOrderNo, order.buyerReturnTracking, order.locationCode].filter(Boolean).join(" / "),
    })),
  );
}

function applyFilters(rows: ScanReportRow[], url: URL) {
  const moduleFilter = url.searchParams.get("module")?.trim();
  const action = url.searchParams.get("action")?.trim();
  const customerCode = url.searchParams.get("customerCode")?.trim().toUpperCase();
  const operator = url.searchParams.get("operator")?.trim().toLowerCase();
  const keyword = url.searchParams.get("keyword")?.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.module, row.sourceId, row.customerCode, row.action, row.code, row.codeType, row.skuCode, row.locationCode, row.operator, row.status, row.detail].join(" ").toLowerCase();
    return (
      (!moduleFilter || moduleFilter === "all" || row.module === moduleFilter) &&
      (!action || action === "all" || row.action === action) &&
      (!customerCode || row.customerCode.toUpperCase() === customerCode) &&
      (!operator || row.operator.toLowerCase().includes(operator)) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出扫码报表" }, { status: 403 });

  const url = new URL(request.url);
  const coreData = await getWarehouseCoreData();
  const rows = applyFilters([...outboundRows(coreData.outboundOrders), ...returnRows(coreData.returnOrders)], url).sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName,
      targetType: "report",
      targetId: "warehouse-scans",
      summary: "导出仓库扫码留痕报表",
      note: "覆盖出库拣货/复核/签出和退货到仓/质检扫描",
      after: {
        module: url.searchParams.get("module") ?? "all",
        action: url.searchParams.get("action") ?? "all",
        customerCode: url.searchParams.get("customerCode") ?? "",
        operator: url.searchParams.get("operator") ?? "",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  return csvResponse("仓库扫码留痕报表.csv", [
    ["模块", "关联单号", "客户编号", "扫码动作", "扫描内容", "条码类型", "SKU", "数量", "库位", "重量KG", "操作人", "扫描时间", "单据状态", "单据说明"],
    ...rows.map((row) => [row.module, row.sourceId, row.customerCode, row.action, row.code, row.codeType, row.skuCode ?? "", row.quantity ?? "", row.locationCode ?? "", row.weightKg ?? "", row.operator, row.scannedAt, row.status, row.detail]),
  ]);
}
