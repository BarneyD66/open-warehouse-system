import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { batchGenerateOutboundPickWaves, batchUpdateCoreOutboundOrderStatus, type CoreOutboundOrder, type OutboundPickWaveStrategy } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const outboundStatuses = new Set(["pending_review", "picking", "label_pending", "packing_check", "handover", "shipped", "blocked"]);

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const operator = staff.displayName || staff.username;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "status" | "generate_pick_wave";
    ids?: string[];
    status?: CoreOutboundOrder["status"];
    strategy?: OutboundPickWaveStrategy;
    assignedPicker?: string;
    note?: string;
  };

  const ids = Array.isArray(body.ids) ? body.ids.map((item) => String(item).trim()).filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "请选择需要批量处理的出库申请。" }, { status: 400 });
  }

  if (body.action === "generate_pick_wave") {
    const result = await batchGenerateOutboundPickWaves({
      ids,
      operator,
      strategy: body.strategy,
      assignedPicker: body.assignedPicker,
      note: body.note,
    });
    await recordAuditLog({
      action: "outbound_pick_wave_batch",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: "pick-wave-batch",
      summary: `批量生成拣货波次：更新 ${result.updated.length} 单，生成 ${result.waves.length} 个波次。`,
      note: result.skipped.slice(0, 5).map((item) => `${item.id}：${item.reason}`).join("；"),
      after: {
        ids,
        strategy: body.strategy ?? "work_mode",
        assignedPicker: body.assignedPicker ?? "",
        waves: result.waves,
        missing: result.missing,
        skipped: result.skipped,
      },
    });
    return NextResponse.json({
      updated: result.updated.length,
      missing: result.missing,
      skipped: result.skipped,
      waves: result.waves,
    });
  }

  if (!body.status || !outboundStatuses.has(body.status)) {
    return NextResponse.json({ error: "不支持的出库状态。" }, { status: 400 });
  }

  const result = await batchUpdateCoreOutboundOrderStatus({
    ids,
    status: body.status,
    note: body.note,
    operator,
  });

  await recordAuditLog({
    action: "outbound_status_batch_update",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "outbound",
    targetId: "outbound-status-batch",
    summary: `批量更新出库状态：更新 ${result.updated.length} 单。`,
    note: body.note,
    after: {
      ids,
      status: body.status,
      updated: result.updated.map((item) => item.id),
      missing: result.missing,
    },
  });

  return NextResponse.json({
    updated: result.updated.length,
    missing: result.missing,
  });
}
