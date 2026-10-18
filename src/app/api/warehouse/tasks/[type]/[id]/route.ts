import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getInboundSubmission, inboundStatusLabel, updateInboundWorkflow, type InboundStatus } from "@/lib/localStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { putawayInboundInventory, updateCoreOutboundOrderStatus, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ type: string; id: string }>;
};

const inboundStatuses = new Set<InboundStatus>(["arrived", "receiving", "received", "putaway_completed", "on_hold", "exception"]);
const outboundStatuses = new Set<CoreOutboundOrder["status"]>(["picking", "packing_check", "handover", "shipped", "blocked"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const { type, id: rawId } = await context.params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = clean(body.status);
  const note = clean(body.note);
  const location = clean(body.location);
  const operator = staff.displayName || staff.username;

  if (type === "inbound") {
    if (!inboundStatuses.has(status as InboundStatus)) return NextResponse.json({ error: "无效的仓库入库状态" }, { status: 400 });
    const before = await getInboundSubmission(id);
    if (!before) return NextResponse.json({ error: "未找到入库任务" }, { status: 404 });

    const taskNote = [location ? `库位：${location}` : "", note].filter(Boolean).join("；");
    const putawayResult =
      status === "putaway_completed" && before.status !== "putaway_completed"
        ? await putawayInboundInventory({
            customerCode: before.customerCode ?? "",
            inboundId: before.id,
            skuLines: before.skuLines ?? [],
            locationCode: location,
            operator,
            note: taskNote,
          })
        : null;
    if (putawayResult?.errors?.length) {
      return NextResponse.json({ error: putawayResult.errors.join("；"), errors: putawayResult.errors }, { status: 400 });
    }

    const updated = await updateInboundWorkflow({
      id,
      status: status as InboundStatus,
      opsNote: taskNote,
    });

    if (!updated) return NextResponse.json({ error: "未找到入库任务" }, { status: 404 });

    if (status === "putaway_completed" && before.status !== "putaway_completed") {
      await recordAuditLog({
        action: "inbound_putaway",
        actorRole: "staff",
        actorName: `${operator} / ${staff.role}`,
        targetType: "inbound",
        targetId: updated.id,
        customerCode: updated.customerCode,
        summary: `入库上架完成，写入 ${putawayResult?.movementCount ?? 0} 条库存流水`,
        note: taskNote,
        before: { status: before.status },
        after: { status: updated.status, movementCount: putawayResult?.movementCount ?? 0 },
      });
    } else {
      await recordAuditLog({
        action: "warehouse_task_update",
        actorRole: "staff",
        actorName: `${operator} / ${staff.role}`,
        targetType: "warehouse_task",
        targetId: updated.id,
        customerCode: updated.customerCode,
        summary: `入库任务更新为${inboundStatusLabel(updated.status)}`,
        note: taskNote,
        before: { status: before.status },
        after: { status: updated.status },
      });
    }

    return NextResponse.json({ task: updated });
  }

  if (type === "outbound") {
    if (!outboundStatuses.has(status as CoreOutboundOrder["status"])) return NextResponse.json({ error: "无效的仓库出库状态" }, { status: 400 });
    const order = await updateCoreOutboundOrderStatus({
      id,
      status: status as CoreOutboundOrder["status"],
      operator,
      note,
    });
    if (!order) return NextResponse.json({ error: "未找到出库任务" }, { status: 404 });

    await recordAuditLog({
      action: status === "shipped" ? "outbound_ship" : "warehouse_task_update",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: order.id,
      customerCode: order.customerCode,
      summary: `出库任务更新为${status}`,
      note,
      after: { status: order.status },
    });

    return NextResponse.json({ task: order });
  }

  return NextResponse.json({ error: "无效的仓库任务类型" }, { status: 400 });
}
