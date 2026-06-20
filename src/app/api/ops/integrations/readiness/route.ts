import { NextResponse } from "next/server";
import { evaluateProductionIntegrationReadiness } from "@/lib/productionIntegrationReadiness";
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

const groupLabel = {
  carrier: "承运商 API",
  platform: "平台订单 API",
  storage: "文件与对象存储",
  notification: "通知投递",
  reporting: "报表投递",
  security: "生产安全",
} as const;

const statusLabel = {
  ready: "可上线",
  partial: "待补齐",
  blocked: "阻塞",
} as const;

export async function GET(request: Request) {
  await requireStaffSession();
  const readiness = await evaluateProductionIntegrationReadiness();
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    return csvResponse(`生产集成配置清单-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["分组", "集成项", "状态", "模式", "评分", "概要", "环境变量", "已配置", "是否必填", "变量说明", "下一步动作"],
      ...readiness.items.flatMap((item) => {
        const envRows = item.env.length > 0 ? item.env : [{ name: "", present: false, required: false, description: "无环境变量要求" }];
        return envRows.map((env) => [
          groupLabel[item.group],
          item.name,
          statusLabel[item.status],
          item.mode ?? "",
          readiness.score,
          item.summary,
          env.name,
          env.present ? "是" : "否",
          env.required ? "必填" : "建议配置",
          env.description,
          item.nextActions.join("；"),
        ]);
      }),
    ]);
  }
  return NextResponse.json({ readiness });
}
