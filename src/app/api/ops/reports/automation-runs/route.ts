import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { automationRunStatusLabel, automationTaskHandlingStatusLabel, automationTaskStatusLabel, getAutomationRuns, type AutomationRunRecord, type AutomationTaskRunRecord } from "@/lib/automationRunStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";

type AutomationTaskReportRow = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  actorName: string;
  trigger: string;
  runStatus: string;
  taskName: string;
  taskKey: string;
  taskStatus: string;
  httpStatus: number;
  endpoint: string;
  summary: string;
  handlingStatus: string;
  assignedTo: string;
  retryCount: number;
  lastRetryAt: string;
  lastRetryStatus: string;
  handlingNote: string;
  nextAction: string;
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

function taskRows(runs: AutomationRunRecord[]): AutomationTaskReportRow[] {
  return runs.flatMap((run) =>
    run.results.map((task: AutomationTaskRunRecord) => ({
      runId: run.id,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationSeconds: Math.round(run.durationMs / 100) / 10,
      actorName: run.actorName,
      trigger: run.trigger === "cron" ? "定时任务" : "手动执行",
      runStatus: automationRunStatusLabel(run.status),
      taskName: task.name,
      taskKey: task.key,
      taskStatus: automationTaskStatusLabel(task.status),
      httpStatus: task.httpStatus,
      endpoint: task.endpoint,
      summary: task.summary,
      handlingStatus: automationTaskHandlingStatusLabel(task.handlingStatus),
      assignedTo: task.assignedTo ?? "",
      retryCount: task.retryCount ?? 0,
      lastRetryAt: task.lastRetryAt ?? "",
      lastRetryStatus: task.lastRetryStatus ? automationTaskStatusLabel(task.lastRetryStatus) : "",
      handlingNote: task.handlingNote ?? "",
      nextAction: task.status === "completed" ? "无需处理" : run.nextAction,
    })),
  );
}

function summaryFor(runs: AutomationRunRecord[]) {
  const rows = taskRows(runs);
  return {
    runCount: runs.length,
    completedRuns: runs.filter((item) => item.status === "completed").length,
    failedRuns: runs.filter((item) => item.status !== "completed").length,
    taskCount: rows.length,
    failedTasks: rows.filter((item) => item.taskStatus !== "完成").length,
    latestRunAt: runs[0]?.startedAt ?? "",
  };
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData) && !canAccessOpsModule(staff, "overview", expansionData)) {
    return NextResponse.json({ error: "当前角色无权查看自动化运行记录。" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = clean(url.searchParams.get("status")) as AutomationRunRecord["status"] | "";
  const taskStatus = clean(url.searchParams.get("taskStatus")) as AutomationTaskRunRecord["status"] | "";
  const handlingStatus = clean(url.searchParams.get("handlingStatus")) as NonNullable<AutomationTaskRunRecord["handlingStatus"]> | "";
  const keyword = clean(url.searchParams.get("keyword"));
  const dateFrom = clean(url.searchParams.get("dateFrom"));
  const dateTo = clean(url.searchParams.get("dateTo"));
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const runs = await getAutomationRuns({
    status: status || undefined,
    taskStatus: taskStatus || undefined,
    handlingStatus: handlingStatus || undefined,
    keyword: keyword || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit,
  });
  const rows = taskRows(runs);
  const summary = summaryFor(runs);

  if (!["saved_view", "scheduled_report"].includes(url.searchParams.get("auditSource") ?? "")) {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "automation-runs",
      summary: "查看/导出自动化运行记录",
      note: `运行 ${summary.runCount} 次，失败任务 ${summary.failedTasks} 个。`,
      after: {
        status,
        taskStatus,
        handlingStatus,
        keyword,
        dateFrom,
        dateTo,
        runCount: summary.runCount,
        rowCount: rows.length,
      },
    });
  }

  if (url.searchParams.get("format") === "json") return NextResponse.json({ generatedAt: new Date().toISOString(), summary, runs, rows });

  return csvResponse("自动化运行记录.csv", [
    ["运行编号", "开始时间", "结束时间", "耗时秒", "执行人", "触发方式", "运行状态", "子任务", "任务编码", "任务状态", "HTTP 状态", "接口", "结果摘要", "处理状态", "指派负责人", "重试次数", "最近重试时间", "最近重试结果", "处理备注", "下一步处理"],
    ...rows.map((row) => [
      row.runId,
      row.startedAt,
      row.finishedAt,
      row.durationSeconds,
      row.actorName,
      row.trigger,
      row.runStatus,
      row.taskName,
      row.taskKey,
      row.taskStatus,
      row.httpStatus,
      row.endpoint,
      row.summary,
      row.handlingStatus,
      row.assignedTo,
      row.retryCount,
      row.lastRetryAt,
      row.lastRetryStatus,
      row.handlingNote,
      row.nextAction,
    ]),
  ]);
}
