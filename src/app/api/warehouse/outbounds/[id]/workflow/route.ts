import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { hasDocumentForRef } from "@/lib/documentStore";
import { approvalRuleForTrigger, approvalRuleNote, getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import {
  assignOutboundWorkMode,
  getWarehouseCoreData,
  interceptCoreOutboundOrder,
  recordOutboundDocumentReprint,
  requestCoreOutboundIntercept,
  type OutboundDocumentType,
  type OutboundWorkMode,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const workModes = new Set<OutboundWorkMode>(["single_item_batch", "cart_sort", "order_pick"]);
const documentTypes = new Set<OutboundDocumentType>(["pick_list", "shipping_label", "carrier_label", "invoice"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function outboundQuantity(order: Awaited<ReturnType<typeof getWarehouseCoreData>>["outboundOrders"][number]) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? order.orderCount;
}

export async function POST(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action);
  const operator = staff.displayName || staff.username;

  if (action === "assign_work_mode") {
    const requestedMode = clean(body.workMode);
    const workMode = workModes.has(requestedMode as OutboundWorkMode) ? (requestedMode as OutboundWorkMode) : undefined;
    const order = await assignOutboundWorkMode({
      id,
      workMode,
      assignedPicker: clean(body.assignedPicker),
      basketNo: clean(body.basketNo),
      operator,
      note: clean(body.note),
    });
    if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

    await recordAuditLog({
      action: "outbound_work_mode_assign",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: order.id,
      customerCode: order.customerCode,
      summary: `生成出库作业任务：${order.pickWaveNo || order.pickListNo || order.id}`,
      after: { status: order.status, workMode: order.workMode, pickWaveNo: order.pickWaveNo },
    });

    return NextResponse.json({ order });
  }

  if (action === "reprint_document") {
    const requestedType = clean(body.documentType);
    if (!documentTypes.has(requestedType as OutboundDocumentType)) return NextResponse.json({ error: "不支持的重打单据类型" }, { status: 400 });
    const order = await recordOutboundDocumentReprint({
      id,
      documentType: requestedType as OutboundDocumentType,
      reason: clean(body.reason),
      operator,
    });
    if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

    await recordAuditLog({
      action: "outbound_document_reprint",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: order.id,
      customerCode: order.customerCode,
      summary: "仓库重打出库单据",
      note: clean(body.reason),
      after: { reprintCount: order.reprintLogs?.length ?? 0 },
    });

    return NextResponse.json({ order });
  }

  if (action === "request_intercept") {
    const result = await requestCoreOutboundIntercept({
      id,
      reason: clean(body.reason),
      operator,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.order ? 400 : 404 });
    const order = result.order;
    if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

    await recordAuditLog({
      action: "outbound_intercept_request",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: order.id,
      customerCode: order.customerCode,
      summary: "出库截单申请已提交",
      note: clean(body.reason),
      after: { status: order.status, interceptStatus: order.interceptStatus, interceptReason: order.interceptReason },
    });

    return NextResponse.json({ order });
  }

  if (action === "intercept_restock") {
    const coreData = await getWarehouseCoreData();
    const currentOrder = coreData.outboundOrders.find((item) => item.id === id);
    if (!currentOrder) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });
    const expansionData = await getOpsExpansionData();
    const approvalRule = approvalRuleForTrigger(expansionData, "outbound_intercept", 0, outboundQuantity(currentOrder));
    const reason = clean(body.reason);
    if (approvalRule && !approvalRule.approverRoles.includes(staff.role)) return NextResponse.json({ error: `当前审批规则要求 ${approvalRule.approverRoles.join("、")} 审批` }, { status: 403 });
    if (approvalRule?.requireReason && !reason) return NextResponse.json({ error: "当前审批规则要求填写截单审批原因" }, { status: 400 });
    if (approvalRule?.requireAttachment) {
      const hasAttachment = await hasDocumentForRef({ customerCode: currentOrder.customerCode, refType: "approval", refId: `outbound-intercept:${id}` });
      if (!hasAttachment) return NextResponse.json({ error: "当前审批规则要求先上传截单审批附件" }, { status: 400 });
    }
    const result = await interceptCoreOutboundOrder({
      id,
      reason: [reason, approvalRule ? approvalRuleNote(approvalRule) : ""].filter(Boolean).join(" / "),
      restockLocationCode: clean(body.restockLocationCode),
      operator,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.order ? 400 : 404 });
    const order = result.order;
    if (!order) return NextResponse.json({ error: "未找到出库单" }, { status: 404 });

    await recordAuditLog({
      action: "outbound_intercept_restock",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: order.id,
      customerCode: order.customerCode,
      summary: "出库截单并释放预占库存",
      note: clean(body.reason),
      after: { status: order.status, interceptStatus: order.interceptStatus, restockLocationCode: order.restockLocationCode },
    });

    return NextResponse.json({ order });
  }

  return NextResponse.json({ error: "不支持的出库作业操作" }, { status: 400 });
}
