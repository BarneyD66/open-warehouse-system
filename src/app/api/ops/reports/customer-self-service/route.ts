import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { buildCustomerSelfServiceOpsReport, customerSelfServiceOpsDetailCsvRows, customerSelfServiceOpsSummaryCsvRows } from "@/lib/customerSelfServiceOpsReport";
import { getDocuments } from "@/lib/documentStore";
import { getSubmissions } from "@/lib/localStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const url = new URL(request.url);
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出客户自助待办报表" }, { status: 403 });

  const [submissions, coreData, documents] = await Promise.all([getSubmissions(), getWarehouseCoreData(), getDocuments()]);
  const report = buildCustomerSelfServiceOpsReport({
    submissions,
    coreData,
    documents,
    workOrders: expansionData.selfServiceWorkOrders,
  });
  const detail = url.searchParams.get("detail") === "1";

  if (url.searchParams.get("format") === "json") {
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  }

  await recordAuditLog({
    action: "report_export",
    actorRole: "staff",
    actorName: staff.displayName || staff.username,
    targetType: "report",
    targetId: detail ? "customer-self-service-detail" : "customer-self-service-summary",
    summary: detail ? "导出客户自助待办明细" : "导出客户自助待办汇总",
    note: `客户 ${report.summary.customers} 个，高风险 ${report.summary.highRiskCustomers} 个，超时事项 ${report.summary.overdueActions} 条`,
    after: {
      module: "customer_self_service",
      detail,
      summary: report.summary,
    },
  });

  return csvResponse(detail ? "客户自助待办明细.csv" : "客户自助待办汇总.csv", detail ? customerSelfServiceOpsDetailCsvRows(report) : customerSelfServiceOpsSummaryCsvRows(report));
}
