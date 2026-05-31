import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { scanCoreOutboundTask, type OutboundScanAction } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const scanActions = new Set<OutboundScanAction>(["pick", "sort", "pack", "ship", "intercept"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action) as OutboundScanAction;
  const code = clean(body.code);
  const operator = staff.displayName || staff.username;

  if (!scanActions.has(action)) return NextResponse.json({ error: "不支持的扫码动作" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "请扫描或输入条码" }, { status: 400 });

  const result = await scanCoreOutboundTask({
    action,
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
      note: `${action} / ${code}`,
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
      note: `${action} / ${code}`,
      after: { status: result.order.status, codeType: result.codeType, scanProgress: result.order.scanProgress },
    });
  }

  return NextResponse.json(result);
}
