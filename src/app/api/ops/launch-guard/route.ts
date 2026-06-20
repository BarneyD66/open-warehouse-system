import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getIntegrationProbeRecords } from "@/lib/integrationProbeStore";
import { buildIntegrationAcceptanceReport } from "@/lib/integrationAcceptanceReport";
import { buildLaunchGuardTasks, guardStatusLabel, summarizeLaunchGuard } from "@/lib/launchGuard";
import { evaluateLaunchReadiness } from "@/lib/launchReadiness";
import { evaluateOpsSystemHealth } from "@/lib/opsSystemHealth";
import { evaluateProductionIntegrationReadiness } from "@/lib/productionIntegrationReadiness";
import { requireStaffSession } from "@/lib/staffAuth";
import { getSystemAlerts } from "@/lib/systemAlertStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvResponse(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\ufeff${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const [launchReadiness, integrationReadiness, systemHealth, alerts, probes] = await Promise.all([
    evaluateLaunchReadiness(),
    evaluateProductionIntegrationReadiness(),
    evaluateOpsSystemHealth(),
    getSystemAlerts(),
    getIntegrationProbeRecords(500),
  ]);
  const integrationAcceptanceReport = buildIntegrationAcceptanceReport({ readiness: integrationReadiness, probes });
  const input = { launchReadiness, integrationReadiness, systemHealth, alerts, integrationAcceptanceReport };
  const tasks = buildLaunchGuardTasks(input);
  const summary = summarizeLaunchGuard(tasks, input);
  const url = new URL(request.url);

  if (url.searchParams.get("format") === "csv") {
    const taskRows =
      tasks.length > 0
        ? tasks.map((task, index) => [
            summary.generatedAt,
            summary.ready ? "可进入上线复核" : summary.blocked > 0 ? "存在阻塞项" : "仍需复核",
            summary.score,
            summary.blocked,
            summary.warning,
            index + 1,
            task.source,
            guardStatusLabel[task.status],
            task.owner,
            task.title,
            task.detail,
            task.nextAction,
            task.href ?? "",
          ])
        : [[summary.generatedAt, "可进入上线复核", summary.score, 0, 0, 1, "上线守门板", "已就绪", "运营", "暂无待处理事项", "当前上线体检、生产集成、系统健康和告警均未发现阻塞项。", "保持上线前复核节奏。", "/ops?section=overview"]];

    if (!["saved_view", "scheduled_report"].includes(url.searchParams.get("auditSource") ?? "")) {
      await recordAuditLog({
        action: "report_export",
        actorRole: "staff",
        actorName: staff.displayName || staff.username,
        targetType: "report",
        targetId: "launch-guard",
        summary: "导出上线复核包",
        note: `阻塞项 ${summary.blocked} 个，关注项 ${summary.warning} 个，总评分 ${summary.score}`,
        after: summary,
      });
    }

    return csvResponse(`上线复核包-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["生成时间", "总体结论", "总评分", "阻塞项", "关注项", "序号", "来源", "状态", "负责人", "事项", "详情", "下一步动作", "处理入口"],
      ...taskRows,
    ]);
  }

  return NextResponse.json({
    guard: {
      summary,
      tasks,
      sourceScores: {
        launchReadiness: launchReadiness.score,
        integrationReadiness: integrationReadiness.score,
        systemHealth: systemHealth.score,
        integrationAcceptance: integrationAcceptanceReport.score,
      },
      generatedAt: summary.generatedAt,
    },
  });
}
