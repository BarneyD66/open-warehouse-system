import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { reportPurchaseReceiptDiscrepancy, resolvePurchaseReceiptDiscrepancy, type PurchaseReceiptDiscrepancyStatus, type PurchaseReceiptDiscrepancyType } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const discrepancyTypes = new Set<PurchaseReceiptDiscrepancyType>(["shortage", "overage", "damaged", "wrong_sku", "missing_label", "other"]);
const resolutionStatuses = new Set<Extract<PurchaseReceiptDiscrepancyStatus, "resolved" | "ignored">>(["resolved", "ignored"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: unknown) {
  const text = clean(value);
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function splitUrls(value: unknown) {
  return clean(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const type = clean(body.type) as PurchaseReceiptDiscrepancyType;
  const operator = staff.displayName || staff.username;

  if (!discrepancyTypes.has(type)) return NextResponse.json({ error: "请选择有效的采购到货差异类型" }, { status: 400 });

  const result = await reportPurchaseReceiptDiscrepancy({
    id,
    type,
    severity: clean(body.severity) === "warning" ? "warning" : "critical",
    skuCode: clean(body.skuCode),
    expectedQty: optionalNumber(body.expectedQty),
    actualQty: optionalNumber(body.actualQty),
    affectedQty: optionalNumber(body.affectedQty),
    description: clean(body.description),
    photoUrls: Array.isArray(body.photoUrls) ? body.photoUrls.map((item) => clean(item)).filter(Boolean) : splitUrls(body.photoUrls),
    operator,
  });

  if (result.error || !result.order || !result.discrepancy) {
    return NextResponse.json({ error: result.error || "采购到货差异登记失败", order: result.order }, { status: result.order ? 400 : 404 });
  }

  await recordAuditLog({
    action: "inbound_exception_create",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "inbound",
    targetId: result.order.id,
    customerCode: result.order.customerCode,
    summary: "采购到货差异已登记并生成客户待确认工单",
    note: result.discrepancy.description,
    after: {
      status: result.order.status,
      discrepancy: result.discrepancy,
      workOrderId: result.workOrder?.id,
    },
  });

  return NextResponse.json({ order: result.order, discrepancy: result.discrepancy, workOrder: result.workOrder });
}

export async function PATCH(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const discrepancyId = clean(body.discrepancyId);
  const status = clean(body.status) as Extract<PurchaseReceiptDiscrepancyStatus, "resolved" | "ignored">;
  const operator = staff.displayName || staff.username;

  if (!discrepancyId) return NextResponse.json({ error: "请选择需要处理的采购到货差异" }, { status: 400 });
  if (!resolutionStatuses.has(status)) return NextResponse.json({ error: "不支持的采购到货差异处理状态" }, { status: 400 });

  const result = await resolvePurchaseReceiptDiscrepancy({
    id,
    discrepancyId,
    status,
    note: clean(body.note),
    operator,
  });

  if (result.error || !result.order || !result.discrepancy) {
    return NextResponse.json({ error: result.error || "采购到货差异处理失败", order: result.order }, { status: result.order ? 400 : 404 });
  }

  await recordAuditLog({
    action: "inbound_exception_update",
    actorRole: "staff",
    actorName: `${operator} / ${staff.role}`,
    targetType: "inbound",
    targetId: result.order.id,
    customerCode: result.order.customerCode,
    summary: status === "resolved" ? "采购到货差异已处理" : "采购到货差异已忽略",
    note: result.discrepancy.resolutionNote,
    after: {
      status: result.order.status,
      discrepancy: result.discrepancy,
      exceptionNote: result.order.exceptionNote,
    },
  });

  return NextResponse.json({ order: result.order, discrepancy: result.discrepancy });
}
