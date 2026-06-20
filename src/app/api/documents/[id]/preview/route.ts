import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { parseCustomerSession } from "@/lib/customerAuth";
import { getDocumentById, getDocumentBytes } from "@/lib/documentStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";

function actorFromSessions(customerSession: ReturnType<typeof parseCustomerSession>, staffSession: ReturnType<typeof parseStaffSession>) {
  if (staffSession) {
    return {
      actorRole: "staff" as const,
      actorName: `${staffSession.displayName} / ${staffSession.role}`,
    };
  }
  return {
    actorRole: "customer" as const,
    actorName: customerSession?.username || "unknown",
  };
}

async function handleGet(request: Request, id: string) {
  const rate = checkRateLimit(rateLimitKey(request, "document-preview"), 120, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "预览过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const cookieStore = await cookies();
  const customerSession = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staffSession = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!customerSession && !staffSession) return NextResponse.json({ error: "请先登录后再预览文件。" }, { status: 401 });

  const document = await getDocumentById(id);
  if (!document) return NextResponse.json({ error: "未找到文件。" }, { status: 404 });
  if (customerSession && !staffSession && document.customerCode !== customerSession.customerCode) return NextResponse.json({ error: "当前账号无权预览该文件。" }, { status: 403 });
  if (document.scanStatus !== "clean") return NextResponse.json({ error: "文件尚未通过安全扫描，不能预览。" }, { status: 403 });
  if (!document.previewAllowed) return NextResponse.json({ error: "该文件类型不支持在线预览，请下载后查看。" }, { status: 400 });

  const actor = actorFromSessions(customerSession, staffSession);
  await recordAuditLog({
    action: "document_preview",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "document",
    targetId: document.id,
    customerCode: document.customerCode,
    summary: "预览业务资料",
    note: `${document.originalName} / ${document.refType} / ${document.refId}`,
    after: {
      mimeType: document.mimeType,
      size: document.size,
      storageProvider: document.storageProvider,
    },
  });

  const file = await getDocumentBytes(document);
  return new NextResponse(file, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrorCapture(request, "/api/documents/[id]/preview", () => handleGet(request, id), { refId: id });
}
