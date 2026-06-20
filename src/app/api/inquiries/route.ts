import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { addDocument } from "@/lib/documentStore";
import { addInquiry } from "@/lib/localStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";

export const runtime = "nodejs";

const publicLeadCustomerCode = "PUBLIC_LEAD";
const maxFileSize = Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024);
const maxFileSizeMb = Math.floor(maxFileSize / 1024 / 1024);

type InquiryPayload = {
  body: Record<string, unknown>;
  files: File[];
  declaredDocs: string[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(values: unknown[]) {
  return values.map((value) => clean(value)).filter(Boolean);
}

async function parsePayload(request: Request): Promise<InquiryPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const body = Object.fromEntries(form.entries());
    return {
      body,
      files: form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0),
      declaredDocs: cleanList(form.getAll("documentTypes")),
    };
  }

  return {
    body: (await request.json()) as Record<string, unknown>,
    files: [],
    declaredDocs: [],
  };
}

async function saveInquiryDocuments({
  customerCode,
  inquiryId,
  files,
}: {
  customerCode: string;
  inquiryId: string;
  files: File[];
}) {
  const uploaded: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (file.size > maxFileSize) {
      errors.push(`${file.name || "未命名文件"} 超过 ${maxFileSizeMb}MB`);
      continue;
    }

    const document = await addDocument({
      customerCode,
      refType: "inquiry",
      refId: inquiryId,
      category: "other",
      originalName: file.name || "upload.bin",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      bytes: Buffer.from(await file.arrayBuffer()),
      note: "客户提交询盘时同步上传",
      uploadedByRole: "customer",
      uploadedBy: customerCode === publicLeadCustomerCode ? "public-inquiry" : customerCode,
    }).catch((error: unknown) => {
      if (error instanceof Error) return { error: error.message };
      return { error: "文件上传失败" };
    });

    if ("error" in document) {
      errors.push(`${file.name || "未命名文件"}：${document.error}`);
    } else {
      uploaded.push(document.id);
    }
  }

  return { uploaded, errors };
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "public-inquiry-submit"), 30, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "提交过于频繁，请稍后再试。" }, { status: 429 });

  const { body, files, declaredDocs } = await parsePayload(request);
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  const company = clean(body.company);
  const contact = clean(body.contact);
  const phone = clean(body.phone);
  const email = clean(body.email);
  const platform = clean(body.platform);
  const volume = clean(body.volume);
  const service = clean(body.service);

  if (!company || !contact || (!phone && !email) || !platform || !volume || !service) {
    return NextResponse.json({ error: "缺少必填字段。" }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确。" }, { status: 400 });
  }

  const noteParts = [
    clean(body.note),
    declaredDocs.length > 0 ? `资料清单：${declaredDocs.join("、")}` : "",
    files.length > 0 ? `上传文件：${files.map((file) => file.name || "未命名文件").join("、")}` : "",
  ].filter(Boolean);

  const submission = await addInquiry({
    customerCode: session?.customerCode,
    company,
    contact,
    phone,
    email,
    platform,
    volume,
    service,
    leadIntent: clean(body.leadIntent),
    origin: clean(body.origin),
    tailDeliveryNeed: clean(body.tailDeliveryNeed),
    note: noteParts.join("\n"),
    quoteEstimate: clean(body.quoteEstimate),
  });

  const documentResult = files.length > 0
    ? await saveInquiryDocuments({ customerCode: session?.customerCode || publicLeadCustomerCode, inquiryId: submission.id, files })
    : { uploaded: [], errors: [] };

  return NextResponse.json({
    id: submission.id,
    status: submission.status,
    uploadedFiles: documentResult.uploaded.length,
    uploadErrors: documentResult.errors,
  });
}
