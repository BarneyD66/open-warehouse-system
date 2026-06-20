import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { buildPickWaveProgressRows } from "@/lib/pickWaveProgress";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.floor(parsed))) : 50;
}

async function handleGet(request: Request) {
  await requireStaffSession();
  const url = new URL(request.url);
  const status = clean(url.searchParams.get("status"));
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  const limit = parseLimit(url.searchParams.get("limit"));
  const coreData = await getWarehouseCoreData();
  const rows = buildPickWaveProgressRows(coreData.outboundOrders)
    .filter((row) => !status || status === "all" || row.status === status)
    .filter((row) => {
      if (!keyword) return true;
      return [row.waveNo, row.workMode, row.assignedPicker, row.carrierSummary, row.status, row.nextAction, ...row.orderIds].join(" ").toLowerCase().includes(keyword);
    })
    .slice(0, limit);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: {
      waveCount: rows.length,
      activeWaves: rows.filter((row) => row.status !== "已完成").length,
      riskWaves: rows.filter((row) => row.status === "有异常" || row.status === "疑似卡住").length,
      pendingWeightOrders: rows.reduce((sum, row) => sum + row.pendingWeightOrders, 0),
    },
    rows,
  });
}

export async function GET(request: Request) {
  return withApiErrorCapture(request, "/api/warehouse/outbounds/pick-waves", () => handleGet(request));
}
