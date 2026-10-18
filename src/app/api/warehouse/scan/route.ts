import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { requireStaffSession } from "@/lib/staffAuth";
import { scanCoreOutboundTask, scanPurchaseReceiptTask, scanReturnOrderTask, type OutboundScanAction, type PurchaseReceiptScanAction, type ReturnScanAction } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const scanActions = new Set<OutboundScanAction>(["pick", "sort", "pack", "ship", "intercept"]);
const purchaseScanActions = new Set<PurchaseReceiptScanAction>(["receive", "putaway"]);
const returnScanActions = new Set<ReturnScanAction>(["receive", "inspect"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function handlePost(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = clean(body.scope) || "outbound";
  const action = clean(body.action);
  const code = clean(body.code);
  const operator = staff.displayName || staff.username;

  if (!code) return NextResponse.json({ error: "请扫描或输入条码" }, { status: 400 });

  if (scope === "purchase") {
    const purchaseAction = action as PurchaseReceiptScanAction;
    if (!purchaseScanActions.has(purchaseAction)) return NextResponse.json({ error: "不支持的采购到货扫码动作" }, { status: 400 });

    const result = await scanPurchaseReceiptTask({
      action: purchaseAction,
      code,
      activePurchaseId: clean(body.activePurchaseId),
      locationCode: clean(body.locationCode),
      operator,
    });

    if (result.error && result.purchase) {
      await recordAuditLog({
        action: "warehouse_scan_exception",
        actorRole: "staff",
        actorName: `${operator} / ${staff.role}`,
        targetType: "inbound",
        targetId: result.purchase.id,
        customerCode: result.purchase.customerCode,
        summary: result.error,
        note: `purchase:${purchaseAction} / ${code}`,
        after: { status: result.purchase.status, codeType: result.codeType, scanLogs: result.purchase.scanLogs },
      });
    }

    if (result.error) return NextResponse.json({ error: result.error, purchase: result.purchase, codeType: result.codeType }, { status: 400 });

    if (result.purchase) {
      await recordAuditLog({
        action: "warehouse_scan",
        actorRole: "staff",
        actorName: `${operator} / ${staff.role}`,
        targetType: "inbound",
        targetId: result.purchase.id,
        customerCode: result.purchase.customerCode,
        summary: result.message || "采购到货扫码作业",
        note: `purchase:${purchaseAction} / ${code}`,
        after: { status: result.purchase.status, codeType: result.codeType, scanLogs: result.purchase.scanLogs },
      });
    }

    return NextResponse.json(result);
  }

  if (scope === "return") {
    const returnAction = action as ReturnScanAction;
    if (!returnScanActions.has(returnAction)) return NextResponse.json({ error: "不支持的退货扫码动作" }, { status: 400 });

    const result = await scanReturnOrderTask({
      action: returnAction,
      code,
      activeReturnId: clean(body.activeReturnId),
      locationCode: clean(body.locationCode),
      operator,
    });

    if (result.error && result.returnOrder) {
      await recordAuditLog({
        action: "warehouse_scan_exception",
        actorRole: "staff",
        actorName: `${operator} / ${staff.role}`,
        targetType: "return",
        targetId: result.returnOrder.id,
        customerCode: result.returnOrder.customerCode,
        summary: result.error,
        note: `return:${returnAction} / ${code}`,
        after: { status: result.returnOrder.status, codeType: result.codeType, scanLogs: result.returnOrder.scanLogs },
      });
    }

    if (result.error) return NextResponse.json({ error: result.error, returnOrder: result.returnOrder, codeType: result.codeType }, { status: 400 });

    if (result.returnOrder) {
      await recordAuditLog({
        action: "warehouse_scan",
        actorRole: "staff",
        actorName: `${operator} / ${staff.role}`,
        targetType: "return",
        targetId: result.returnOrder.id,
        customerCode: result.returnOrder.customerCode,
        summary: result.message || "退货 RMA 扫码作业",
        note: `return:${returnAction} / ${code}`,
        after: { status: result.returnOrder.status, codeType: result.codeType, scanLogs: result.returnOrder.scanLogs },
      });
    }

    return NextResponse.json(result);
  }

  const outboundAction = action as OutboundScanAction;
  if (!scanActions.has(outboundAction)) return NextResponse.json({ error: "不支持的扫码动作" }, { status: 400 });

  const result = await scanCoreOutboundTask({
    action: outboundAction,
    code,
    activeOrderId: clean(body.activeOrderId),
    weightKg: parseNumber(body.weightKg),
    locationCode: clean(body.locationCode),
    operator,
  });

  if (result.error && result.order) {
    await recordAuditLog({
      action: "warehouse_scan_exception",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: result.order.id,
      customerCode: result.order.customerCode,
      summary: result.error,
      note: `${outboundAction} / ${code}`,
      after: { status: result.order.status, codeType: result.codeType, exceptions: result.order.exceptions },
    });
  }

  if (result.error) return NextResponse.json({ error: result.error, order: result.order, codeType: result.codeType }, { status: 400 });

  if (result.order) {
    await recordAuditLog({
      action: "warehouse_scan",
      actorRole: "staff",
      actorName: `${operator} / ${staff.role}`,
      targetType: "outbound",
      targetId: result.order.id,
      customerCode: result.order.customerCode,
      summary: result.message || "仓库扫码作业",
      note: `${outboundAction} / ${code}`,
      after: { status: result.order.status, codeType: result.codeType, scanProgress: result.order.scanProgress },
    });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return withApiErrorCapture(request, "/api/warehouse/scan", () => handlePost(request));
}
