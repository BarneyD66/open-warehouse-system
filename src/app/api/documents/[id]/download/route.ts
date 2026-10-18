import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { parseCustomerSession } from "@/lib/customerAuth";
import { getDocumentById, getDocumentBytes, verifyDocumentToken } from "@/lib/documentStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";

function actorFromSessions(input: {
  hasValidToken: boolean;
  customerSession: ReturnType<typeof parseCustomerSession>;
  staffSession: ReturnType<typeof parseStaffSession>;
}) {
  if (input.staffSession) {
    return {
      actorRole: "staff" as const,
      actorName: `${input.staffSession.displayName} / ${input.staffSession.role}`,
    };
  }
  if (input.customerSession) {
    return {
      actorRole: "customer" as const,
      actorName: input.customerSession.username,
    };
  }
  return {
    actorRole: "system" as const,
    actorName: input.hasValidToken ? "安全下载链接" : "unknown",
  };
}

async function handleGet(request: Request, id: string) {
  const rate = checkRateLimit(rateLimitKey(request, "document-download"), 120, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "下载过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const url = new URL(request.url);
  const hasValidToken = verifyDocumentToken(url.searchParams.get("token"), id);
  const cookieStore = await cookies();
  const customerSession = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staffSession = parseStaffSession(cookieStore.get(staffCookieName)?.value);

  if (!hasValidToken && !customerSession && !staffSession) return NextResponse.json({ error: "请先登录后再下载文件。" }, { status: 401 });

  const document = await getDocumentById(id);
  if (!document) return NextResponse.json({ error: "未找到文件。" }, { status: 404 });
  if (!hasValidToken && customerSession && !staffSession && document.customerCode !== customerSession.customerCode) {
    return NextResponse.json({ error: "当前账号无权下载该文件。" }, { status: 403 });
  }
  if (document.scanStatus !== "clean") return NextResponse.json({ error: "文件尚未通过安全扫描，不能下载。" }, { status: 403 });

  const actor = actorFromSessions({ hasValidToken, customerSession, staffSession });
  await recordAuditLog({
    action: "document_download",
    actorRole: actor.actorRole,
    actorName: actor.actorName,
    targetType: "document",
    targetId: document.id,
    customerCode: document.customerCode,
    summary: "下载业务资料",
    note: `${document.originalName} / ${document.refType} / ${document.refId}`,
    after: {
      mimeType: document.mimeType,
      size: document.size,
      storageProvider: document.storageProvider,
      usedSignedToken: hasValidToken,
    },
  });

  const file = await getDocumentBytes(document);
  return new NextResponse(file, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrorCapture(request, "/api/documents/[id]/download", () => handleGet(request, id), { refId: id });
}
