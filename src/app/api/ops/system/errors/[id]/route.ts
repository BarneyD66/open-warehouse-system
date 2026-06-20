import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getProductionErrorEvents, updateProductionErrorEvent, type ProductionErrorHandlingStatus } from "@/lib/productionErrorStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const statusByAction: Record<string, ProductionErrorHandlingStatus> = {
  acknowledge: "acknowledged",
  resolve: "resolved",
  reopen: "open",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "overview", expansionData) && !canAccessOpsModule(staff, "permissions", expansionData)) {
    return NextResponse.json({ error: "当前账号无权查看生产错误事件。" }, { status: 403 });
  }

  const { id } = await params;
  const event = (await getProductionErrorEvents({ limit: 2000 })).find((item) => item.id === id);
  if (!event) return NextResponse.json({ error: "未找到生产错误事件。" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-production-error-update"), 60, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "生产错误处理过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "overview", expansionData) && !canAccessOpsModule(staff, "permissions", expansionData)) {
    return NextResponse.json({ error: "当前账号无权处理生产错误事件。" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action);
  const status = statusByAction[action];
  if (!status) return NextResponse.json({ error: "不支持的生产错误处理动作。" }, { status: 400 });

  const before = (await getProductionErrorEvents({ limit: 2000 })).find((item) => item.id === id);
  const result = await updateProductionErrorEvent({
    id,
    status,
    handledBy: staff.displayName || staff.username,
    note: clean(body.note),
  });
  if (result.error || !result.event) return NextResponse.json({ error: result.error || "生产错误处理失败。" }, { status: 404 });

  await recordAuditLog({
    action: "production_error_update",
    actorRole: "staff",
    actorName: `${staff.displayName || staff.username} / ${staff.role}`,
    targetType: "system",
    targetId: id,
    summary: `生产错误已更新为 ${status}`,
    note: clean(body.note),
    before,
    after: result.event,
  });

  return NextResponse.json({ event: result.event });
}
