import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDocumentById, getDocumentBytes } from "@/lib/documentStore";
import { parseCustomerSession } from "@/lib/customerAuth";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const customerSession = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staffSession = parseStaffSession(cookieStore.get(staffCookieName)?.value);

  if (!customerSession && !staffSession) return NextResponse.json({ error: "请先登录后再下载文件" }, { status: 401 });

  const document = await getDocumentById(id);
  if (!document) return NextResponse.json({ error: "未找到文件" }, { status: 404 });
  if (customerSession && !staffSession && document.customerCode !== customerSession.customerCode) {
    return NextResponse.json({ error: "当前账号无权下载该文件" }, { status: 403 });
  }

  const file = await getDocumentBytes(document);
  return new NextResponse(file, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
    },
  });
}
