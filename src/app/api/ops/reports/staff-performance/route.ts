import { NextResponse } from "next/server";
import { getAuditLogs, recordAuditLog, type AuditLogRecord } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, type CoreOutboundOrder, type ReturnOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type StaffPerformanceRow = {
  operator: string;
  roleHint: string;
  scanCount: number;
  exceptionCount: number;
  inboundPutawayCount: number;
  outboundPickCount: number;
  outboundSortCount: number;
  outboundPackCount: number;
  outboundWeighingCount: number;
  outboundInterceptRequestCount: number;
  outboundInterceptRestockCount: number;
  outboundShipCount: number;
  returnScanCount: number;
  reportExportCount: number;
  billingActionCount: number;
  auditActionCount: number;
  lastActionAt: string;
  score: number;
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

function inDateRange(value: string | undefined, dateFrom: string, dateTo: string) {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    if (Number.isFinite(from) && time < from) return false;
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59`).getTime();
    if (Number.isFinite(to) && time > to) return false;
  }
  return true;
}

function normalizeOperator(value?: string) {
  return (value || "系统").trim() || "系统";
}

function ensureRow(rows: Map<string, StaffPerformanceRow>, operator: string) {
  const cleanOperator = normalizeOperator(operator);
  const existing = rows.get(cleanOperator);
  if (existing) return existing;
  const created: StaffPerformanceRow = {
    operator: cleanOperator,
    roleHint: cleanOperator.includes("/") ? cleanOperator.split("/").at(-1)?.trim() || "" : "",
    scanCount: 0,
    exceptionCount: 0,
    inboundPutawayCount: 0,
    outboundPickCount: 0,
    outboundSortCount: 0,
    outboundPackCount: 0,
    outboundWeighingCount: 0,
    outboundInterceptRequestCount: 0,
    outboundInterceptRestockCount: 0,
    outboundShipCount: 0,
    returnScanCount: 0,
    reportExportCount: 0,
    billingActionCount: 0,
    auditActionCount: 0,
    lastActionAt: "",
    score: 0,
  };
  rows.set(cleanOperator, created);
  return created;
}

function bumpLastAction(row: StaffPerformanceRow, occurredAt?: string) {
  if (!occurredAt) return;
  if (!row.lastActionAt || new Date(occurredAt).getTime() > new Date(row.lastActionAt).getTime()) row.lastActionAt = occurredAt;
}

function applyAuditRows(rows: Map<string, StaffPerformanceRow>, logs: AuditLogRecord[]) {
  logs
    .filter((log) => log.actorRole === "staff")
    .forEach((log) => {
      const row = ensureRow(rows, log.actorName);
      row.auditActionCount += 1;
      if (log.action === "warehouse_scan") row.scanCount += 1;
      if (log.action === "warehouse_scan_exception" || log.action.includes("exception")) row.exceptionCount += 1;
      if (log.action === "inbound_putaway") row.inboundPutawayCount += 1;
      if (log.action === "outbound_intercept_request") row.outboundInterceptRequestCount += 1;
      if (log.action === "outbound_intercept_restock") row.outboundInterceptRestockCount += 1;
      if (log.action === "outbound_batch_weighing") row.outboundWeighingCount += 1;
      if (log.action === "outbound_ship") row.outboundShipCount += 1;
      if (log.action === "report_export") row.reportExportCount += 1;
      if (log.action.includes("billing")) row.billingActionCount += 1;
      bumpLastAction(row, log.createdAt);
    });
}

function applyOutboundScanRows(rows: Map<string, StaffPerformanceRow>, orders: CoreOutboundOrder[], dateFrom: string, dateTo: string) {
  orders.forEach((order) => {
    (order.scanProgress?.lastScans ?? [])
      .filter((scan) => inDateRange(scan.scannedAt, dateFrom, dateTo))
      .forEach((scan) => {
        const row = ensureRow(rows, scan.operator);
        row.scanCount += 1;
        if (scan.action === "pick") row.outboundPickCount += 1;
        if (scan.action === "sort") row.outboundSortCount += 1;
        if (scan.action === "pack") row.outboundPackCount += 1;
        if (scan.action === "ship") row.outboundShipCount += 1;
        if (scan.action === "intercept") row.outboundInterceptRestockCount += 1;
        bumpLastAction(row, scan.scannedAt);
      });
    (order.operationLogs ?? [])
      .filter((log) => inDateRange(log.occurredAt, dateFrom, dateTo))
      .forEach((log) => {
        const row = ensureRow(rows, log.operator);
        row.auditActionCount += 1;
        if (log.action.includes("exception")) row.exceptionCount += 1;
        if (log.action === "scan_pick") row.outboundPickCount += 1;
        if (log.action === "scan_sort") row.outboundSortCount += 1;
        if (log.action === "scan_pack") row.outboundPackCount += 1;
        if (log.action === "scan_intercept" || log.action === "intercept_completed") row.outboundInterceptRestockCount += 1;
        if (log.action === "intercept_requested") row.outboundInterceptRequestCount += 1;
        if (log.detail?.includes("称重") || log.detail?.toLowerCase().includes("weight")) row.outboundWeighingCount += 1;
        if (log.action === "scan_ship" || log.action === "status_changed") row.outboundShipCount += log.detail?.includes("shipped") ? 1 : 0;
        bumpLastAction(row, log.occurredAt);
      });
  });
}

function applyReturnScanRows(rows: Map<string, StaffPerformanceRow>, returns: ReturnOrder[], dateFrom: string, dateTo: string) {
  returns.forEach((order) => {
    (order.scanLogs ?? [])
      .filter((scan) => inDateRange(scan.scannedAt, dateFrom, dateTo))
      .forEach((scan) => {
        const row = ensureRow(rows, scan.operator);
        row.scanCount += 1;
        row.returnScanCount += 1;
        bumpLastAction(row, scan.scannedAt);
      });
  });
}

function score(row: StaffPerformanceRow) {
  return (
    row.scanCount +
    row.inboundPutawayCount * 3 +
    row.outboundPickCount * 2 +
    row.outboundSortCount * 2 +
    row.outboundPackCount * 3 +
    row.outboundWeighingCount * 3 +
    row.outboundInterceptRequestCount * 2 +
    row.outboundInterceptRestockCount * 4 +
    row.outboundShipCount * 4 +
    row.returnScanCount * 2 +
    row.reportExportCount +
    row.billingActionCount * 2 -
    row.exceptionCount * 2
  );
}

function applyFilters(rows: StaffPerformanceRow[], url: URL) {
  const operator = clean(url.searchParams.get("operator")).toLowerCase();
  const moduleFilter = clean(url.searchParams.get("module")).toLowerCase();
  return rows.filter((row) => {
    const modulePass =
      !moduleFilter ||
      moduleFilter === "all" ||
      (moduleFilter === "warehouse" && (row.scanCount > 0 || row.inboundPutawayCount > 0 || row.outboundPickCount > 0 || row.outboundSortCount > 0 || row.outboundPackCount > 0 || row.outboundWeighingCount > 0 || row.outboundShipCount > 0 || row.returnScanCount > 0)) ||
      (moduleFilter === "outbound_review" && (row.outboundPickCount > 0 || row.outboundSortCount > 0 || row.outboundPackCount > 0 || row.outboundWeighingCount > 0 || row.outboundInterceptRequestCount > 0 || row.outboundInterceptRestockCount > 0)) ||
      (moduleFilter === "billing" && row.billingActionCount > 0) ||
      (moduleFilter === "reports" && row.reportExportCount > 0) ||
      (moduleFilter === "exceptions" && row.exceptionCount > 0);
    return (!operator || row.operator.toLowerCase().includes(operator)) && modulePass;
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出员工绩效报表" }, { status: 403 });

  const url = new URL(request.url);
  const dateFrom = clean(url.searchParams.get("dateFrom"));
  const dateTo = clean(url.searchParams.get("dateTo"));
  const [logs, coreData] = await Promise.all([
    getAuditLogs({ actorRole: "staff", dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 500 }),
    getWarehouseCoreData(),
  ]);

  const rows = new Map<string, StaffPerformanceRow>();
  applyAuditRows(rows, logs);
  applyOutboundScanRows(rows, coreData.outboundOrders, dateFrom, dateTo);
  applyReturnScanRows(rows, coreData.returnOrders, dateFrom, dateTo);

  const filteredRows = applyFilters(
    Array.from(rows.values()).map((row) => ({ ...row, score: score(row) })).sort((a, b) => b.score - a.score || b.scanCount - a.scanCount || a.operator.localeCompare(b.operator)),
    url,
  );

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "staff-performance",
      summary: "导出员工绩效报表",
      note: `日期：${dateFrom || "不限"} 至 ${dateTo || "不限"}；行数：${filteredRows.length}`,
      after: {
        dateFrom,
        dateTo,
        operator: url.searchParams.get("operator") ?? "",
        module: url.searchParams.get("module") ?? "all",
        rowCount: filteredRows.length,
      },
    });
  }

  return csvResponse("员工绩效报表.csv", [
    ["员工", "角色提示", "综合分", "扫码次数", "扫码/业务异常", "入库上架", "出库拣货", "出库分拣", "出库复核", "出库称重", "截单申请", "截单回库", "出库签出", "退货扫描", "报表导出", "账单操作", "审计动作数", "最近操作时间"],
    ...filteredRows.map((row) => [
      row.operator,
      row.roleHint,
      row.score,
      row.scanCount,
      row.exceptionCount,
      row.inboundPutawayCount,
      row.outboundPickCount,
      row.outboundSortCount,
      row.outboundPackCount,
      row.outboundWeighingCount,
      row.outboundInterceptRequestCount,
      row.outboundInterceptRestockCount,
      row.outboundShipCount,
      row.returnScanCount,
      row.reportExportCount,
      row.billingActionCount,
      row.auditActionCount,
      row.lastActionAt,
    ]),
  ]);
}
