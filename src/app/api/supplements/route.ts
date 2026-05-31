import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCustomerSession } from "@/lib/customerAuth";
import { supplementInbound } from "@/lib/localStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function saveFiles(id: string, files: File[]) {
  if (files.length === 0) return [];
  const baseDir = process.env.VERCEL ? "/tmp/warehouse-system-data" : path.join(process.cwd(), ".local-data");
  const folder = path.join(baseDir, "uploads", safeSegment(id));
  await mkdir(folder, { recursive: true });

  const savedNames: string[] = [];
  for (const file of files) {
    if (!file.name || file.size === 0) continue;
    const safeName = `${Date.now()}-${safeSegment(file.name)}`;
    await writeFile(path.join(folder, safeName), Buffer.from(await file.arrayBuffer()));
    savedNames.push(file.name);
  }
  return savedNames;
}

async function parseRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const files = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
    const manualNames = form
      .getAll("attachmentNames")
      .map((name) => clean(name))
      .filter(Boolean);
    const id = clean(form.get("id"));
    const savedNames = id ? await saveFiles(id, files) : [];

    return {
      id,
      tracking: clean(form.get("tracking")),
      supplementNote: clean(form.get("supplementNote")),
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
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) {
    return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  }

  const { id, tracking, supplementNote, attachmentNames, savedFiles } = await parseRequest(request);
  if (!id) {
    return NextResponse.json({ error: "请填写入库预报编号" }, { status: 400 });
  }

  if (!tracking && attachmentNames.length === 0 && !supplementNote) {
    return NextResponse.json({ error: "请至少补充追踪号、附件名称或备注说明" }, { status: 400 });
  }

  const updated = await supplementInbound({ id, tracking, attachmentNames, supplementNote, customerCode: session.customerCode });
  if (!updated) {
    return NextResponse.json({ error: "未找到对应入库预报" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    tracking: updated.tracking,
    attachmentNames: updated.attachmentNames,
    savedFiles,
    updatedAt: updated.updatedAt,
  });
}
