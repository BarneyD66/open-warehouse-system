import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { hasDocumentForRef } from "@/lib/documentStore";
import { canRequestInventoryAdjustment, canReviewInventoryAdjustment, requireStaffSession } from "@/lib/staffAuth";
import { approvalRuleForTrigger, approvalRuleNote, getOpsExpansionData } from "@/lib/opsExpansionStore";
import { secondConfirmationError } from "@/lib/staffPermissions";
import { createInventoryAdjustmentRequest, getWarehouseCoreData, reviewInventoryAdjustmentRequest, validateLocationMove, type InventoryControlAction } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNonNegative(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function adjustmentQuantity(input: { availableDelta: number; reservedDelta: number; quantity: number; controlAction: InventoryControlAction }) {
  if (input.quantity > 0) return input.quantity;
  if (input.controlAction === "manual_adjust") return Math.abs(input.availableDelta) + Math.abs(input.reservedDelta);
  return 0;
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  if (!canRequestInventoryAdjustment(staff.role)) return NextResponse.json({ error: "当前角色不能提交库存调整" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const customerCode = clean(body.customerCode);
  const balanceId = clean(body.balanceId);
  const skuCode = clean(body.skuCode).toUpperCase();
  const availableDelta = numeric(body.availableDelta);
  const reservedDelta = numeric(body.reservedDelta);
  const quantity = optionalNonNegative(body.quantity) ?? 0;
  const controlAction = (clean(body.controlAction) || "manual_adjust") as InventoryControlAction;
  const nextLocationCode = clean(body.nextLocationCode).toUpperCase();
  const reason = clean(body.note);
  const actionNeedsQuantity = ["freeze", "release", "defective", "restore"].includes(controlAction);

  if (!customerCode || !skuCode) return NextResponse.json({ error: "请选择客户并填写 SKU" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "请填写库存调整原因" }, { status: 400 });
  if (actionNeedsQuantity && quantity <= 0) return NextResponse.json({ error: "请填写大于 0 的处理数量" }, { status: 400 });
  if (controlAction === "move_location" && !nextLocationCode) return NextResponse.json({ error: "移库时请填写目标库位" }, { status: 400 });
  if (controlAction === "move_location") {
    const data = await getWarehouseCoreData();
    const balance = balanceId
      ? data.inventoryBalances.find((item) => item.id === balanceId && item.customerCode === customerCode && item.skuCode === skuCode)
      : data.inventoryBalances.find((item) => item.customerCode === customerCode && item.skuCode === skuCode);
    if (!balance) return NextResponse.json({ error: "未找到对应库存记录" }, { status: 404 });
    const validation = validateLocationMove(data, balance, nextLocationCode);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    if (!balance) return NextResponse.json({ error: "未找到对应库存记录" }, { status: 404 });
    if ((balance.locationCode || "") === nextLocationCode) return NextResponse.json({ error: "目标库位不能和当前库位相同" }, { status: 400 });
    const targetLocation = data.locations.find((item) => item.locationCode === nextLocationCode);
    if (!targetLocation) return NextResponse.json({ error: "目标库位不存在，请先在库位管理中创建" }, { status: 400 });
    if (targetLocation.status !== "active") return NextResponse.json({ error: "目标库位不是可用状态，不能移入" }, { status: 400 });
  }
  if (controlAction === "manual_adjust" && availableDelta === 0 && reservedDelta === 0 && body.alertQty === undefined && body.agingDays === undefined) {
    return NextResponse.json({ error: "请填写要提交的库存变更内容" }, { status: 400 });
  }
  const expansionData = await getOpsExpansionData();
  const trigger = controlAction === "move_location" ? "manual_inbound_outbound" : "inventory_adjustment";
  const approvalRule = approvalRuleForTrigger(expansionData, trigger, 0, adjustmentQuantity({ availableDelta, reservedDelta, quantity, controlAction }));
  const approvalNote = approvalRuleNote(approvalRule);

  const adjustment = await createInventoryAdjustmentRequest({
    balanceId,
    customerCode,
    skuCode,
    availableDelta,
    reservedDelta,
    alertQty: optionalNonNegative(body.alertQty),
    agingDays: optionalNonNegative(body.agingDays),
    controlAction,
    quantity,
    nextLocationCode,
    reason: `${reason} / ${approvalNote}`,
    requestedBy: staff.displayName || staff.username,
    requestedByRole: staff.role,
  });

  if (!adjustment) return NextResponse.json({ error: "未找到对应库存记录" }, { status: 404 });

  await recordAuditLog({
    action: "inventory_adjustment_request",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "inventory_adjustment",
    targetId: adjustment.id,
    customerCode,
    summary: `提交库存管控审批：${skuCode}`,
    note: reason,
    after: adjustment,
  });

  return NextResponse.json({ adjustment });
}

export async function PATCH(request: Request) {
  const staff = await requireStaffSession();
  if (!canReviewInventoryAdjustment(staff.role)) return NextResponse.json({ error: "当前角色不能审核库存调整" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = clean(body.id);
  const action = clean(body.action);
  const reviewNote = clean(body.reviewNote);
  if (!id) return NextResponse.json({ error: "缺少库存调整单号" }, { status: 400 });
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "无效的审核操作" }, { status: 400 });
  if (action === "reject" && !reviewNote) return NextResponse.json({ error: "驳回时请填写原因" }, { status: 400 });
  const [coreData, expansionData] = await Promise.all([getWarehouseCoreData(), getOpsExpansionData()]);
  const currentAdjustment = coreData.inventoryAdjustments.find((item) => item.id === id);
  if (!currentAdjustment) return NextResponse.json({ error: "未找到库存调整单" }, { status: 404 });
  const trigger = currentAdjustment.controlAction === "move_location" ? "manual_inbound_outbound" : currentAdjustment.requestedByRole === "stocktake" ? "stocktake_difference" : "inventory_adjustment";
  const approvalRule = approvalRuleForTrigger(
    expansionData,
    trigger,
    0,
    currentAdjustment.quantity ?? Math.abs(currentAdjustment.availableDelta) + Math.abs(currentAdjustment.reservedDelta) + Math.abs(currentAdjustment.frozenDelta ?? 0) + Math.abs(currentAdjustment.defectiveDelta ?? 0),
  );
  if (approvalRule && !approvalRule.approverRoles.includes(staff.role)) return NextResponse.json({ error: `当前审批规则要求 ${approvalRule.approverRoles.join("、")} 审批` }, { status: 403 });
  if (action === "approve" && approvalRule?.requireReason && !reviewNote) return NextResponse.json({ error: "当前审批规则要求填写审批原因" }, { status: 400 });
  const secondConfirmError = secondConfirmationError({
    staff,
    action: "库存调整审批",
    confirmation: clean(body.confirmation),
    expected: id,
    data: expansionData,
  });
  if (secondConfirmError) return NextResponse.json({ error: secondConfirmError }, { status: 400 });
  if (action === "approve" && approvalRule?.requireAttachment) {
    const hasAttachment = await hasDocumentForRef({ customerCode: currentAdjustment.customerCode, refType: "approval", refId: currentAdjustment.id });
    if (!hasAttachment) return NextResponse.json({ error: "当前审批规则要求先上传审批附件" }, { status: 400 });
  }

  const result = await reviewInventoryAdjustmentRequest({
    id,
    decision: action,
    reviewNote,
    reviewedBy: staff.displayName || staff.username,
  });

  if (!result.adjustment) return NextResponse.json({ error: result.error || "未找到库存调整单" }, { status: 404 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditLog({
    action: action === "approve" ? "inventory_adjustment_approve" : "inventory_adjustment_reject",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "inventory_adjustment",
    targetId: result.adjustment.id,
    customerCode: result.adjustment.customerCode,
    summary: `${action === "approve" ? "审批通过" : "驳回"}库存调整：${result.adjustment.skuCode}`,
    note: reviewNote,
    before: {
      availableQty: result.adjustment.beforeAvailableQty,
      reservedQty: result.adjustment.beforeReservedQty,
      frozenQty: result.adjustment.beforeFrozenQty ?? 0,
      defectiveQty: result.adjustment.beforeDefectiveQty ?? 0,
    },
    after: result.balance ?? result.adjustment,
  });

  return NextResponse.json(result);
}
