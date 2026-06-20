import { NextResponse } from "next/server";
import { evaluateLaunchReadiness } from "@/lib/launchReadiness";
import { requireStaffSession } from "@/lib/staffAuth";

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

const statusLabel = {
  pass: "可上线",
  warn: "需复核",
  fail: "阻塞",
} as const;

export async function GET(request: Request) {
  await requireStaffSession();
  const readiness = await evaluateLaunchReadiness();
  const url = new URL(request.url);

  if (url.searchParams.get("format") === "csv") {
    return csvResponse(`上线体检清单-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["生成时间", "环境", "总体状态", "上线评分", "检查项", "状态", "负责人", "详情", "客户数", "客户账号数", "资料数", "账单数", "未完成出库单", "未关闭退货单", "库位数", "启用物流渠道", "平台连接数", "正式员工账号数"],
      ...readiness.checks.map((check) => [
        readiness.generatedAt,
        readiness.environment,
        statusLabel[readiness.status],
        readiness.score,
        check.label,
        statusLabel[check.status],
        check.owner,
        check.detail,
        readiness.metrics.customers,
        readiness.metrics.customerAccounts,
        readiness.metrics.documents,
        readiness.metrics.billingRecords,
        readiness.metrics.openOutboundOrders,
        readiness.metrics.openReturns,
        readiness.metrics.locations,
        readiness.metrics.activeLogisticsChannels,
        readiness.metrics.platformConnections,
        readiness.metrics.managedStaffAccounts,
      ]),
    ]);
  }

  return NextResponse.json({ readiness });
}
