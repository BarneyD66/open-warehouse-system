import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getIntegrationProbeRecords } from "@/lib/integrationProbeStore";
import { buildIntegrationAcceptanceReport, integrationAcceptanceCsvRows } from "@/lib/integrationAcceptanceReport";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { evaluateProductionIntegrationReadiness } from "@/lib/productionIntegrationReadiness";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

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
  const rate = checkRateLimit(rateLimitKey(request, "integration-acceptance-report"), 40, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "导出过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData) && !canAccessOpsModule(staff, "logistics", expansionData)) {
    return NextResponse.json({ error: "当前角色无权导出生产集成验收记录。" }, { status: 403 });
  }

  const url = new URL(request.url);
  const [readiness, probes] = await Promise.all([evaluateProductionIntegrationReadiness(), getIntegrationProbeRecords(500)]);
  const report = buildIntegrationAcceptanceReport({ readiness, probes });

  if (!["saved_view", "scheduled_report"].includes(url.searchParams.get("auditSource") ?? "")) {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "integration-acceptance",
      summary: "导出生产集成验收记录",
      note: `验收通过 ${report.summary.passed} 项，等待探测 ${report.summary.waiting} 项，配置待补 ${report.summary.blocked} 项，联调失败 ${report.summary.failed} 项`,
      after: report.summary,
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ report });
  return csvResponse("生产集成验收记录.csv", integrationAcceptanceCsvRows(report));
}
