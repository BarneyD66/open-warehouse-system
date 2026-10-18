import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { addDocument } from "@/lib/documentStore";
import { supplementInbound } from "@/lib/localStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";

export const runtime = "nodejs";

const maxFileSize = Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024);
const maxFileSizeMb = Math.floor(maxFileSize / 1024 / 1024);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function saveSupplementDocuments({
  customerCode,
  username,
  inboundId,
  supplementNote,
  files,
}: {
  customerCode: string;
  username: string;
  inboundId: string;
  supplementNote?: string;
  files: File[];
}) {
  const uploadedNames: string[] = [];
  for (const file of files) {
    if (!file.name || file.size <= 0) continue;
    if (file.size > maxFileSize) throw new Error(`文件大小不能超过 ${maxFileSizeMb}MB`);

    const document = await addDocument({
      customerCode,
      refType: "inbound",
      refId: inboundId,
      category: "packing_list",
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      bytes: Buffer.from(await file.arrayBuffer()),
      note: supplementNote || "客户补充入库资料",
      uploadedByRole: "customer",
      uploadedBy: username,
    });
    uploadedNames.push(`${document.originalName}（资料编号：${document.id}）`);
  }
  return uploadedNames;
}

async function parseRequest(request: Request, session: { customerCode: string; username: string }) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const id = clean(form.get("id"));
    const supplementNote = clean(form.get("supplementNote"));
    const manualNames = form
      .getAll("attachmentNames")
      .map((name) => clean(name))
      .filter(Boolean);
    const files = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
    const savedNames = id ? await saveSupplementDocuments({ customerCode: session.customerCode, username: session.username, inboundId: id, supplementNote, files }) : [];

    return {
      id,
      tracking: clean(form.get("tracking")),
      supplementNote,
      attachmentNames: [...manualNames, ...savedNames],
      savedFiles: savedNames.length,
    };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return {
    id: clean(body.id),
    tracking: clean(body.tracking),
    supplementNote: clean(body.supplementNote),
    attachmentNames: Array.isArray(body.attachmentNames) ? body.attachmentNames.map((name) => clean(name)).filter(Boolean) : [],
    savedFiles: 0,
  };
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "customer-supplement-upload"), 20, 10 * 60_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "提交过于频繁，请稍后再试。" }, { status: 429 });
  }

  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) {
    return NextResponse.json({ error: "请先登录客户工作台。" }, { status: 401 });
  }

  const parsed = await parseRequest(request, session).catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "资料上传失败，请稍后重试。",
  }));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { id, tracking, supplementNote, attachmentNames, savedFiles } = parsed;
  if (!id) {
    return NextResponse.json({ error: "请填写入库预报编号。" }, { status: 400 });
  }

  if (!tracking && attachmentNames.length === 0 && !supplementNote) {
    return NextResponse.json({ error: "请至少补充追踪号、附件资料或备注说明。" }, { status: 400 });
  }

  const updated = await supplementInbound({ id, tracking, attachmentNames, supplementNote, customerCode: session.customerCode });
  if (!updated) {
    return NextResponse.json({ error: "未找到对应入库预报。" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    tracking: updated.tracking,
    attachmentNames: updated.attachmentNames,
    savedFiles,
    updatedAt: updated.updatedAt,
  });
}
