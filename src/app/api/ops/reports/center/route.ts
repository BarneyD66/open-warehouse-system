import { NextResponse } from "next/server";
import { getAuditLogs, recordAuditLog } from "@/lib/auditLogStore";
import { getAutomationRuns } from "@/lib/automationRunStore";
import { getDocuments } from "@/lib/documentStore";
import { getIntegrationProbeRecords } from "@/lib/integrationProbeStore";
import { buildIntegrationAcceptanceReport } from "@/lib/integrationAcceptanceReport";
import { buildLaunchGuardTasks } from "@/lib/launchGuard";
import { evaluateLaunchReadiness } from "@/lib/launchReadiness";
import { getNotificationDeliveries } from "@/lib/notificationStore";
import { evaluateOpsSystemHealth } from "@/lib/opsSystemHealth";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { evaluateProductionIntegrationReadiness } from "@/lib/productionIntegrationReadiness";
import { buildReportCenterData, reportCenterCsvRows } from "@/lib/reportCenter";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getSystemAlerts } from "@/lib/systemAlertStore";
import { getWarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

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
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权查看报表中心。" }, { status: 403 });

  const [auditLogs, coreData, notificationDeliveries, automationRuns, documents, launchReadiness, integrationReadiness, systemHealth, alerts, integrationProbes] = await Promise.all([
    getAuditLogs({ limit: 500 }),
    getWarehouseCoreData(),
    getNotificationDeliveries(500),
    getAutomationRuns({ limit: 100 }),
    getDocuments(),
    evaluateLaunchReadiness(),
    evaluateProductionIntegrationReadiness(),
    evaluateOpsSystemHealth(),
    getSystemAlerts(),
    getIntegrationProbeRecords(500),
  ]);
  const integrationAcceptanceReport = buildIntegrationAcceptanceReport({ readiness: integrationReadiness, probes: integrationProbes });
  const launchGuardTasks = buildLaunchGuardTasks({ launchReadiness, integrationReadiness, systemHealth, alerts, integrationAcceptanceReport });
  const data = buildReportCenterData({ expansionData, auditLogs, coreData, notificationDeliveries, automationRuns, documents, launchGuardTasks, integrationAcceptanceReport });
  const url = new URL(request.url);

  if (url.searchParams.get("format") === "csv") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "report-center",
      summary: "导出报表中心总览",
      note: `模块 ${data.modules.length} 个，保存视图 ${data.summary.savedViews} 个`,
      after: data.summary,
    });
    return csvResponse("报表中心总览.csv", reportCenterCsvRows(data));
  }

  return NextResponse.json(data);
}
