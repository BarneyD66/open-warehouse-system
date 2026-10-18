import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { rescanDocumentSecurity, updateDocumentSecurityStatus, type DocumentRecord } from "@/lib/documentStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SecurityAction = "rescan" | "mark_clean" | "block" | "mark_pending";

const allowedActions = new Set<SecurityAction>(["rescan", "mark_clean", "block", "mark_pending"]);

function actionLabel(action: SecurityAction) {
  const labels: Record<SecurityAction, string> = {
    rescan: "重新安全扫描",
    mark_clean: "人工放行",
    block: "人工拦截",
    mark_pending: "标记待扫描",
  };
  return labels[action];
}

function statusForAction(action: Exclude<SecurityAction, "rescan">): NonNullable<DocumentRecord["scanStatus"]> {
  if (action === "mark_clean") return "clean";
  if (action === "block") return "blocked";
  return "pending";
}

export async function POST(request: Request, context: RouteContext) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-document-security"), 60, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "文件安全操作过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "permissions", expansionData) && !canAccessOpsModule(staff, "reports", expansionData)) {
    return NextResponse.json({ error: "当前角色无权处理文件安全状态。" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; note?: string };
  const action = String(body.action ?? "").trim() as SecurityAction;
  if (!allowedActions.has(action)) return NextResponse.json({ error: "不支持的文件安全操作。" }, { status: 400 });

  const result =
    action === "rescan"
      ? await rescanDocumentSecurity(decodeURIComponent(id)).catch((error: unknown) => ({ document: null, error: error instanceof Error ? error.message : "安全复扫失败。" }))
      : await updateDocumentSecurityStatus({
          id: decodeURIComponent(id),
          scanStatus: statusForAction(action),
          scanNote: String(body.note ?? "").trim() || `${staff.displayName || staff.username} 执行${actionLabel(action)}。`,
        });

  if (!result.document) return NextResponse.json({ error: result.error || "文件安全状态处理失败。" }, { status: 404 });

  await recordAuditLog({
    action: "document_security_review",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "document",
    targetId: result.document.id,
    customerCode: result.document.customerCode,
    summary: actionLabel(action),
    note: result.document.scanNote,
    after: {
      scanStatus: result.document.scanStatus,
      scanNote: result.document.scanNote,
      previewAllowed: result.document.previewAllowed,
      storageProvider: result.document.storageProvider,
      originalName: result.document.originalName,
      refType: result.document.refType,
      refId: result.document.refId,
    },
  });

  return NextResponse.json({ document: result.document });
}
