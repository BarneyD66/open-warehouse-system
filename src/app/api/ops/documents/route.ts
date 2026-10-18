import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { addDocument, getDocuments, type DocumentCategory, type DocumentRefType } from "@/lib/documentStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

const refTypes = new Set(["billing", "inquiry", "inbound", "logistics", "outbound", "return", "sku", "approval", "general"]);
const categories = new Set(["payment_proof", "packing_list", "label", "invoice", "exception_photo", "other"]);
const maxFileSize = Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024);
const maxFileSizeMb = Math.max(1, Math.floor(maxFileSize / 1024 / 1024));

export async function GET(request: Request) {
  await requireStaffSession();
  const url = new URL(request.url);
  const customerCode = url.searchParams.get("customerCode");
  const refType = url.searchParams.get("refType");
  const refId = url.searchParams.get("refId");
  const documents = await getDocuments();

  return NextResponse.json({
    documents: documents.filter((item) => (!customerCode || item.customerCode === customerCode) && (!refType || item.refType === refType) && (!refId || item.refId === refId)),
  });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-document-upload"), 40, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "上传过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const form = await request.formData();
  const file = form.get("file");
  const customerCode = String(form.get("customerCode") ?? "");
  const refType = String(form.get("refType") ?? "");
  const refId = String(form.get("refId") ?? "");
  const category = String(form.get("category") ?? "other");
  const note = String(form.get("note") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ error: "请先选择要上传的文件。" }, { status: 400 });
  if (!customerCode.trim()) return NextResponse.json({ error: "请选择客户。" }, { status: 400 });
  if (!refTypes.has(refType)) return NextResponse.json({ error: "不支持的关联类型。" }, { status: 400 });
  if (!refId.trim()) return NextResponse.json({ error: "请填写关联单据编号。" }, { status: 400 });
  if (!categories.has(category)) return NextResponse.json({ error: "不支持的文件分类。" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: "不能上传空文件。" }, { status: 400 });
  if (file.size > maxFileSize) return NextResponse.json({ error: `文件大小不能超过 ${maxFileSizeMb}MB。` }, { status: 400 });

  const document = await addDocument({
    customerCode: customerCode.trim().toUpperCase(),
    refType: refType as DocumentRefType,
    refId: refId.trim(),
    category: category as DocumentCategory,
    originalName: file.name || "upload.bin",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    bytes: Buffer.from(await file.arrayBuffer()),
    note,
    uploadedByRole: "staff",
    uploadedBy: staff.displayName || staff.username,
  }).catch((error: unknown) => {
    if (error instanceof Error) return { error: error.message };
    return { error: "文件上传失败，请稍后重试。" };
  });

  if ("error" in document) {
    await recordAuditLog({
      action: "document_upload_rejected",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "document",
      targetId: `${refType}:${refId.trim()}:${file.name || "upload.bin"}`,
      customerCode: customerCode.trim().toUpperCase(),
      summary: "员工上传客户资料被安全策略拒绝",
      note: document.error,
      after: {
        refType,
        refId: refId.trim(),
        category,
        originalName: file.name || "upload.bin",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
    });
    return NextResponse.json({ error: document.error }, { status: 400 });
  }

  await recordAuditLog({
    action: "document_upload",
    actorRole: "staff",
    actorName: `${staff.displayName} / ${staff.role}`,
    targetType: "document",
    targetId: document.id,
    customerCode: document.customerCode,
    summary: "员工上传客户业务资料",
    note: `${document.refType} / ${document.refId} / ${document.originalName}`,
    after: {
      category: document.category,
      mimeType: document.mimeType,
      size: document.size,
      storageProvider: document.storageProvider,
      scanStatus: document.scanStatus,
    },
  });

  return NextResponse.json({ document });
}
