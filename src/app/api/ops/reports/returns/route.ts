import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getDocuments, type DocumentRecord } from "@/lib/documentStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, returnOrderStatusLabel, returnResolutionLabel, type ReturnOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type OpsReturnFilter = "all" | "missing-tracking" | "awaiting" | "inspection" | "needs-decision" | "confirmed" | "open";

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

function normalizeFilter(value: string | null): OpsReturnFilter {
  if (value === "missing-tracking" || value === "awaiting" || value === "inspection" || value === "needs-decision" || value === "confirmed" || value === "open") return value;
  return "all";
}

function filterReturns(rows: ReturnOrder[], activeFilter: OpsReturnFilter, keyword = "") {
  const query = keyword.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (activeFilter === "missing-tracking") return !row.buyerReturnTracking && !["closed", "disposed", "restocked"].includes(row.status);
      if (activeFilter === "awaiting") return ["requested", "label_sent", "in_transit"].includes(row.status);
      if (activeFilter === "inspection") return row.status === "received" || row.status === "inspection";
      if (activeFilter === "needs-decision") return ["received", "inspection", "repair", "exception"].includes(row.status) && !row.customerResolutionDecision;
      if (activeFilter === "confirmed") return Boolean(row.customerResolutionDecision);
      if (activeFilter === "open") return !["closed", "disposed", "restocked"].includes(row.status);
      return true;
    })
    .filter((row) => {
      if (!query) return true;
      return [row.id, row.customerCode, row.platform, row.originalOrderNo, row.buyerReturnTracking, row.returnReason, ...row.skuLines.map((line) => line.skuCode)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
}

function documentsForReturn(documents: DocumentRecord[], item: ReturnOrder) {
  return documents.filter((document) => document.refType === "return" && document.refId === item.id);
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出退货报表" }, { status: 403 });

  const url = new URL(request.url);
  const activeFilter = normalizeFilter(url.searchParams.get("returnStatus"));
  const keyword = url.searchParams.get("returnQuery") ?? "";
  const [coreData, documents] = await Promise.all([getWarehouseCoreData(), getDocuments()]);
  const rows = filterReturns(coreData.returnOrders, activeFilter, keyword).sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName,
      targetType: "report",
      targetId: "returns-rma",
      summary: "导出退货/RMA报表",
      note: "按运营后台当前筛选条件导出",
      after: {
        module: "returns",
        filter: activeFilter,
        keyword,
        rowCount: rows.length,
      },
    });
  }

  return csvResponse("运营退货RMA报表.csv", [
    [
      "客户编号",
      "退货单号",
      "平台",
      "原订单号",
      "买家退货追踪号",
      "退货原因",
      "SKU 明细",
      "状态",
      "质检结果",
      "处理方式",
      "客户确认方式",
      "客户确认备注",
      "客户确认时间",
      "处理库位",
      "售后工单号",
      "质检附件数",
      "质检附件名称",
      "预计到仓",
      "到仓时间",
      "质检时间",
      "关闭时间",
      "创建时间",
      "更新时间",
    ],
    ...rows.map((item) => {
      const returnDocuments = documentsForReturn(documents, item);
      return [
        item.customerCode,
        item.id,
        item.platform,
        item.originalOrderNo ?? "",
        item.buyerReturnTracking ?? "",
        item.returnReason,
        item.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join(" | "),
        returnOrderStatusLabel(item.status),
        item.inspectionResult ?? "",
        item.resolution ? returnResolutionLabel(item.resolution) : "",
        item.customerResolutionDecision ? returnResolutionLabel(item.customerResolutionDecision) : "",
        item.customerResolutionNote ?? "",
        item.customerResolutionConfirmedAt ?? "",
        item.locationCode ?? "",
        item.workOrderId ?? "",
        returnDocuments.length,
        returnDocuments.map((document) => document.originalName).join(" | "),
        item.expectedArrivalDate ?? "",
        item.receivedAt ?? "",
        item.inspectedAt ?? "",
        item.closedAt ?? "",
        item.createdAt,
        item.updatedAt ?? "",
      ];
    }),
  ]);
}
