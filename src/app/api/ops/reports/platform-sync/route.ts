import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData, type PlatformSyncJob } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";

type PlatformSyncRow = {
  jobId: string;
  connectionId: string;
  platform: string;
  storeName: string;
  customerCode: string;
  syncMode: string;
  syncModeCode: string;
  result: string;
  resultCode: string;
  pulledRows: number;
  readyOrders: number;
  skippedRows: number;
  issueCount: number;
  cancelledRows: number;
  cancelledOrders: string;
  importBatchId: string;
  error: string;
  createdBy: string;
  createdAt: string;
  nextAction: string;
};

const syncModeLabels: Record<string, string> = {
  manual_csv: "手工 CSV",
  api_sandbox: "API 沙箱",
  api_live: "API 正式",
};

function clean(value: string | null) {
  return value?.trim() ?? "";
}

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

function resultLabel(job: PlatformSyncJob) {
  return job.status === "completed" ? "已完成" : "失败";
}

function cancelledOrderSummary(job: PlatformSyncJob) {
  return (job.cancelledOrders ?? [])
    .map((order) => `${order.orderNo}${order.matchedOutboundId ? ` / 出库单 ${order.matchedOutboundId}` : ""}${order.outboundStatus ? ` / 出库状态 ${order.outboundStatus}` : ""}${order.reason ? ` / ${order.reason}` : ""}`)
    .join("; ");
}

function nextAction(job: PlatformSyncJob) {
  if (job.status === "failed") return job.error ? "检查平台授权、接口地址或字段映射后重新同步。" : "检查同步配置后重新同步。";
  if ((job.cancelledRows ?? 0) > 0) return "复核平台取消/作废订单，必要时截单、取消面单、释放库存或联系客户。";
  if (job.issueCount > 0 || job.skippedRows > 0) return "下载同步预检批次，处理异常行后再确认创建出库单。";
  if (job.orderImportBatchId) return "进入导入批次确认创建出库单。";
  return "无需处理。";
}

function buildRows(jobs: PlatformSyncJob[]): PlatformSyncRow[] {
  return jobs.map((job) => ({
    jobId: job.id,
    connectionId: job.platformConnectionId,
    platform: job.platform,
    storeName: job.storeName,
    customerCode: job.customerCode,
    syncMode: syncModeLabels[job.syncMode] ?? job.syncMode,
    syncModeCode: job.syncMode,
    result: resultLabel(job),
    resultCode: job.status,
    pulledRows: job.pulledRows,
    readyOrders: job.readyOrders,
    skippedRows: job.skippedRows,
    issueCount: job.issueCount,
    cancelledRows: job.cancelledRows ?? 0,
    cancelledOrders: cancelledOrderSummary(job),
    importBatchId: job.orderImportBatchId ?? "",
    error: job.error ?? "",
    createdBy: job.createdBy,
    createdAt: job.createdAt,
    nextAction: nextAction(job),
  }));
}

function applyFilters(rows: PlatformSyncRow[], url: URL) {
  const platform = clean(url.searchParams.get("platform")).toLowerCase();
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const result = clean(url.searchParams.get("result"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.jobId, row.connectionId, row.platform, row.storeName, row.customerCode, row.importBatchId, row.error, row.createdBy, row.cancelledOrders, row.nextAction].join(" ").toLowerCase();
    return (
      (!platform || platform === "all" || row.platform.toLowerCase().includes(platform)) &&
      (!customerCode || row.customerCode.toLowerCase().includes(customerCode)) &&
      (!result || result === "all" || row.resultCode === result || row.result === result) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出平台同步任务报表。" }, { status: 403 });

  const url = new URL(request.url);
  const rows = applyFilters(buildRows(expansionData.platformSyncJobs), url).sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "platform-sync",
      summary: "导出平台同步任务报表",
      note: `行数：${rows.length}`,
      after: {
        platform: url.searchParams.get("platform") ?? "all",
        customerCode: url.searchParams.get("customerCode") ?? "",
        result: url.searchParams.get("result") ?? "all",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ rows, filters: Object.fromEntries(url.searchParams.entries()), generatedAt: new Date().toISOString() });

  return csvResponse("平台同步任务报表.csv", [
    ["同步任务号", "平台连接号", "平台", "店铺名称", "客户编号", "同步模式", "同步模式代码", "结果", "结果代码", "拉取行数", "可创建订单", "跳过行数", "问题数", "取消/作废订单数", "取消/作废订单明细", "导入批次号", "失败原因", "执行人", "创建时间", "下一步处理"],
    ...rows.map((row) => [
      row.jobId,
      row.connectionId,
      row.platform,
      row.storeName,
      row.customerCode,
      row.syncMode,
      row.syncModeCode,
      row.result,
      row.resultCode,
      row.pulledRows,
      row.readyOrders,
      row.skippedRows,
      row.issueCount,
      row.cancelledRows,
      row.cancelledOrders,
      row.importBatchId,
      row.error,
      row.createdBy,
      row.createdAt,
      row.nextAction,
    ]),
  ]);
}
