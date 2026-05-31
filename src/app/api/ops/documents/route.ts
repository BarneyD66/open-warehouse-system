import { NextResponse } from "next/server";
import { addDocument, getDocuments, type DocumentCategory, type DocumentRefType } from "@/lib/documentStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

const refTypes = new Set(["billing", "inbound", "logistics", "outbound", "sku", "general"]);
const categories = new Set(["payment_proof", "packing_list", "label", "invoice", "exception_photo", "other"]);
const maxFileSize = 8 * 1024 * 1024;

export async function GET(request: Request) {
  await requireStaffSession();
  const url = new URL(request.url);
  const customerCode = url.searchParams.get("customerCode");
  const refType = url.searchParams.get("refType");
  const refId = url.searchParams.get("refId");
  const documents = await getDocuments();

  return NextResponse.json({
    documents: documents.filter((item) =>
      (!customerCode || item.customerCode === customerCode) &&
      (!refType || item.refType === refType) &&
      (!refId || item.refId === refId)
    ),
  });
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const form = await request.formData();
  const file = form.get("file");
  const customerCode = String(form.get("customerCode") ?? "");
  const refType = String(form.get("refType") ?? "");
  const refId = String(form.get("refId") ?? "");
  const category = String(form.get("category") ?? "other");
  const note = String(form.get("note") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ error: "请先选择要上传的文件" }, { status: 400 });
  if (!customerCode.trim()) return NextResponse.json({ error: "请选择客户" }, { status: 400 });
  if (!refTypes.has(refType)) return NextResponse.json({ error: "不支持的关联类型" }, { status: 400 });
  if (!refId.trim()) return NextResponse.json({ error: "请填写关联单据编号" }, { status: 400 });
  if (!categories.has(category)) return NextResponse.json({ error: "不支持的文件分类" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: "不能上传空文件" }, { status: 400 });
  if (file.size > maxFileSize) return NextResponse.json({ error: "文件大小不能超过 8MB" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const document = await addDocument({
    customerCode: customerCode.trim(),
    refType: refType as DocumentRefType,
    refId,
    category: category as DocumentCategory,
    originalName: file.name || "upload.bin",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    bytes,
    note,
    uploadedByRole: "staff",
    uploadedBy: staff.displayName || staff.username,
  });

  return NextResponse.json({ document });
}
