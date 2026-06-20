import { NextResponse } from "next/server";
import { evaluateOpsSystemHealth, type OpsSystemHealthStatus } from "@/lib/opsSystemHealth";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusLabels: Record<OpsSystemHealthStatus, string> = {
  healthy: "健康",
  degraded: "需关注",
  critical: "严重",
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
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-system-health"), 30, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "生产健康检查查询过于频繁，请稍后再试", resetAt: rate.resetAt }, { status: 429 });

  await requireStaffSession();
  const health = await evaluateOpsSystemHealth();
  const format = new URL(request.url).searchParams.get("format")?.trim();

  if (format === "csv") {
    return csvResponse("生产健康检查.csv", [
      ["生成时间", health.generatedAt],
      ["环境", health.environment],
      ["总体状态", statusLabels[health.status]],
      ["健康评分", health.score],
      [],
      ["检查项", "状态", "负责人", "详情", "处理入口"],
      ...health.checks.map((check) => [
        check.label,
        statusLabels[check.status],
        check.owner,
        check.detail,
        check.actionHref ?? "",
      ]),
      [],
      ["指标", "数值"],
      ["客户数", health.metrics.customers],
      ["SKU 数", health.metrics.skus],
      ["出库单数", health.metrics.outboundOrders],
      ["账单数", health.metrics.billingRecords],
      ["开放告警", health.metrics.openAlerts],
      ["异常任务", health.metrics.exceptionJobs],
      ["开放生产错误", health.metrics.openProductionErrors],
      ["失败/阻塞集成探测", health.metrics.failedIntegrationProbes],
      ["正式员工账号", health.metrics.managedStaffAccounts],
    ]);
  }

  return NextResponse.json({ health }, { status: health.status === "critical" ? 503 : 200 });
}
