import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";

export type DocumentRefType = "billing" | "inquiry" | "inbound" | "logistics" | "outbound" | "return" | "sku" | "approval" | "general";
export type DocumentCategory = "payment_proof" | "packing_list" | "label" | "invoice" | "exception_photo" | "other";

export type DocumentRecord = {
  id: string;
  customerCode: string;
  refType: DocumentRefType;
  refId: string;
  category: DocumentCategory;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  note?: string;
  storageProvider?: "postgres" | "local" | "object";
  objectUrl?: string;
  scanStatus?: "pending" | "clean" | "blocked";
  scanNote?: string;
  previewAllowed?: boolean;
  uploadedByRole: "customer" | "staff";
  uploadedBy: string;
  uploadedAt: string;
};

export type DocumentStoreData = {
  documents: DocumentRecord[];
};

const dataRoot = process.env.VERCEL ? path.join("/tmp", "warehouse-system-data") : path.join(process.cwd(), ".local-data");
const documentStorePath = path.join(dataRoot, "documents.json");
const uploadRoot = path.join(dataRoot, "uploads");

function makeId() {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `DOC-${yyyymmdd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function cleanFileName(value: string) {
  return value.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(0, 120) || "upload.bin";
}

function documentSecret() {
  return process.env.DOCUMENT_TOKEN_SECRET || process.env.SESSION_SECRET || process.env.AUTH_SECRET || "local-document-token-secret";
}

export function signDocumentToken(id: string, expiresAt: number) {
  const payload = `${id}.${expiresAt}`;
  const signature = createHmac("sha256", documentSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyDocumentToken(token: string | null, id: string) {
  if (!token) return false;
  const [tokenId, expiresAtText, signature] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (tokenId !== id || !Number.isFinite(expiresAt) || expiresAt < Date.now() || !signature) return false;
  return signDocumentToken(tokenId, expiresAt) === token;
}

type DocumentScanResult = {
  status: "clean" | "blocked";
  note: string;
};

function basicScanDocument(bytes: Buffer, mimeType: string, originalName: string): DocumentScanResult {
  const lowerName = originalName.toLowerCase();
  const blockedExtensions = [".exe", ".bat", ".cmd", ".js", ".vbs", ".scr", ".ps1"];
  if (blockedExtensions.some((suffix) => lowerName.endsWith(suffix))) return { status: "blocked" as const, note: "文件类型存在执行风险，已阻止上传。" };
  if (/javascript|x-msdownload|x-sh/i.test(mimeType)) return { status: "blocked" as const, note: "文件 MIME 类型存在风险，已阻止上传。" };
  const head = bytes.subarray(0, 256).toString("utf8").toLowerCase();
  if (head.includes("<script") || head.includes("powershell")) return { status: "blocked" as const, note: "文件内容命中基础安全扫描规则，已阻止上传。" };
  return { status: "clean" as const, note: "基础安全扫描通过。" };
}

async function externalVirusScan(bytes: Buffer, mimeType: string, originalName: string, storedName: string): Promise<DocumentScanResult | null> {
  const endpoint = process.env.VIRUS_SCAN_WEBHOOK_URL || process.env.CLAMAV_SCAN_URL;
  if (!endpoint) return null;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.VIRUS_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.VIRUS_SCAN_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      originalName,
      storedName,
      mimeType,
      size: bytes.length,
      bytesBase64: bytes.toString("base64"),
    }),
  }).catch((error: unknown) => ({ error }));

  if ("error" in response) {
    return {
      status: "blocked",
      note: `外部病毒扫描服务连接失败，已阻止上传：${response.error instanceof Error ? response.error.message : "网络异常"}`,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    status?: string;
    clean?: boolean;
    infected?: boolean;
    blocked?: boolean;
    note?: string;
    message?: string;
    threat?: string;
  };
  if (!response.ok) return { status: "blocked", note: payload.message || payload.note || `外部病毒扫描服务返回 ${response.status}，已阻止上传。` };
  if (payload.infected || payload.blocked || payload.clean === false || payload.status === "blocked" || payload.status === "infected") {
    return { status: "blocked", note: payload.threat || payload.message || payload.note || "外部病毒扫描未通过，已阻止上传。" };
  }
  return { status: "clean", note: payload.note || payload.message || "基础安全扫描和外部病毒扫描均已通过。" };
}

async function scanDocument(bytes: Buffer, mimeType: string, originalName: string, storedName: string): Promise<DocumentScanResult> {
  const basic = basicScanDocument(bytes, mimeType, originalName);
  if (basic.status === "blocked") return basic;
  const external = await externalVirusScan(bytes, mimeType, originalName, storedName);
  return external ?? basic;
}

function canPreview(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

async function uploadObjectDocument(storedName: string, bytes: Buffer, mimeType: string) {
  const endpoint = process.env.OBJECT_STORAGE_UPLOAD_URL || process.env.BLOB_UPLOAD_URL;
  const token = process.env.OBJECT_STORAGE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (!endpoint || !token) return null;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key: storedName, mimeType, bytesBase64: bytes.toString("base64") }),
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => ({}))) as { url?: string; objectUrl?: string };
  return payload.url || payload.objectUrl || null;
}

async function readObjectDocument(record: DocumentRecord) {
  const token = process.env.OBJECT_STORAGE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  const downloadEndpoint = process.env.OBJECT_STORAGE_DOWNLOAD_URL || process.env.BLOB_DOWNLOAD_URL;
  if (downloadEndpoint) {
    const response = await fetch(downloadEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        key: `${record.customerCode}/${record.storedName}`,
        storedName: record.storedName,
        customerCode: record.customerCode,
        objectUrl: record.objectUrl,
      }),
    }).catch((error: unknown) => ({ error }));
    if ("error" in response) throw new Error(`Object storage download gateway failed: ${response.error instanceof Error ? response.error.message : "network error"}`);
    if (!response.ok) throw new Error(`Object storage download gateway returned ${response.status}.`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return Buffer.from(await response.arrayBuffer());
    const payload = (await response.json().catch(() => ({}))) as { bytesBase64?: string; url?: string; objectUrl?: string };
    if (payload.bytesBase64) return Buffer.from(payload.bytesBase64, "base64");
    const signedUrl = payload.url || payload.objectUrl;
    if (!signedUrl) throw new Error("Object storage download gateway did not return bytes or a signed URL.");
    const signedResponse = await fetch(signedUrl, { cache: "no-store" });
    if (!signedResponse.ok) throw new Error(`Object storage signed URL returned ${signedResponse.status}.`);
    return Buffer.from(await signedResponse.arrayBuffer());
  }

  if (!record.objectUrl) throw new Error("Document object URL is missing.");
  const response = await fetch(record.objectUrl, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error("Document object storage fetch failed.");
  return Buffer.from(await response.arrayBuffer());
}

async function readDocumentStore(): Promise<DocumentStoreData> {
  if (hasPostgresConfig()) {
    const sql = getSql();
    const rows = await sql<Array<{
      id: string;
      customer_code: string;
      ref_type: DocumentRefType;
      ref_id: string;
      category: DocumentCategory;
      original_name: string;
      stored_name: string;
      mime_type: string;
      size_bytes: number;
      note: string | null;
      uploaded_by_role: "customer" | "staff";
      uploaded_by: string;
      uploaded_at: Date | string;
      payload?: {
        objectUrl?: string;
        storageProvider?: DocumentRecord["storageProvider"];
        scanStatus?: DocumentRecord["scanStatus"];
        scanNote?: string;
        previewAllowed?: boolean;
      };
    }>>`
      select
        id,
        customer_code,
        ref_type,
        ref_id,
        category,
        original_name,
        stored_name,
        mime_type,
        size_bytes,
        note,
        uploaded_by_role,
        uploaded_by,
        uploaded_at,
        payload
      from warehouse_documents
      order by uploaded_at desc
    `;

    return {
      documents: rows.map((row) => ({
        id: row.id,
        customerCode: row.customer_code,
        refType: row.ref_type,
        refId: row.ref_id,
        category: row.category,
        originalName: row.original_name,
        storedName: row.stored_name,
        mimeType: row.mime_type,
        size: Number(row.size_bytes),
        note: row.note || undefined,
        storageProvider: row.payload?.storageProvider,
        objectUrl: row.payload?.objectUrl,
        scanStatus: row.payload?.scanStatus,
        scanNote: row.payload?.scanNote,
        previewAllowed: row.payload?.previewAllowed,
        uploadedByRole: row.uploaded_by_role,
        uploadedBy: row.uploaded_by,
        uploadedAt: new Date(row.uploaded_at).toISOString(),
      })),
    };
  }

  try {
    const raw = await readFile(documentStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DocumentStoreData>;
    return { documents: Array.isArray(parsed.documents) ? parsed.documents : [] };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { documents: [] };
    if (error instanceof SyntaxError) return { documents: [] };
    throw error;
  }
}

async function writeDocumentStore(data: DocumentStoreData) {
  if (hasPostgresConfig()) return;
  await mkdir(path.dirname(documentStorePath), { recursive: true });
  await writeFile(documentStorePath, JSON.stringify(data, null, 2), "utf8");
}

export async function getDocuments() {
  const data = await readDocumentStore();
  await writeDocumentStore(data);
  return data.documents;
}

export async function restoreDocumentsFromBackup(documents: DocumentRecord[]) {
  const normalized = documents.map((item) => ({
    ...item,
    note: item.note?.trim() || undefined,
    storageProvider: item.storageProvider ?? (hasPostgresConfig() ? "postgres" : "local"),
    objectUrl: item.objectUrl && item.objectUrl !== "已归档对象存储" ? item.objectUrl : undefined,
    scanStatus: item.scanStatus ?? "pending",
    previewAllowed: item.previewAllowed ?? canPreview(item.mimeType),
  }));

  if (hasPostgresConfig()) {
    const sql = getSql();
    for (const record of normalized) {
      await sql`
        insert into warehouse_documents (
          id, customer_code, ref_type, ref_id, category, original_name, stored_name, mime_type, size_bytes,
          note, uploaded_by_role, uploaded_by, uploaded_at, payload
        ) values (
          ${record.id}, ${record.customerCode}, ${record.refType}, ${record.refId}, ${record.category},
          ${record.originalName}, ${record.storedName}, ${record.mimeType}, ${record.size}, ${record.note ?? null},
          ${record.uploadedByRole}, ${record.uploadedBy}, ${record.uploadedAt},
          ${sql.json({ objectUrl: record.objectUrl, storageProvider: record.storageProvider, scanStatus: record.scanStatus, scanNote: record.scanNote, previewAllowed: record.previewAllowed })}
        )
        on conflict (id) do update set
          customer_code = excluded.customer_code,
          ref_type = excluded.ref_type,
          ref_id = excluded.ref_id,
          category = excluded.category,
          original_name = excluded.original_name,
          stored_name = excluded.stored_name,
          mime_type = excluded.mime_type,
          size_bytes = excluded.size_bytes,
          note = excluded.note,
          uploaded_by_role = excluded.uploaded_by_role,
          uploaded_by = excluded.uploaded_by,
          uploaded_at = excluded.uploaded_at,
          payload = excluded.payload
      `;
    }
    return normalized;
  }

  await writeDocumentStore({ documents: normalized });
  return normalized;
}

export async function getDocumentsForCustomer(customerCode: string) {
  const documents = await getDocuments();
  return documents.filter((item) => item.customerCode === customerCode);
}

export async function hasDocumentForRef({ customerCode, refType, refId }: { customerCode?: string; refType: DocumentRefType; refId: string }) {
  const documents = await getDocuments();
  return documents.some((item) => (!customerCode || item.customerCode === customerCode) && item.refType === refType && item.refId === refId);
}

export async function getDocumentById(id: string) {
  const documents = await getDocuments();
  return documents.find((item) => item.id === id) ?? null;
}

export function getDocumentFilePath(record: DocumentRecord) {
  return path.join(uploadRoot, record.customerCode, record.storedName);
}

export async function getDocumentBytes(record: DocumentRecord) {
  if (record.objectUrl) {
    return readObjectDocument(record);
  }

  if (hasPostgresConfig()) {
    const sql = getSql();
    const rows = await sql<Array<{ payload: { bytesBase64?: string } }>>`
      select payload
      from warehouse_documents
      where id = ${record.id}
      limit 1
    `;
    const bytesBase64 = rows[0]?.payload?.bytesBase64;
    if (!bytesBase64) throw new Error("Document file payload is missing.");
    return Buffer.from(bytesBase64, "base64");
  }

  return readFile(getDocumentFilePath(record));
}

async function updateDocumentRecordSecurity(record: DocumentRecord) {
  if (hasPostgresConfig()) {
    const sql = getSql();
    const rows = await sql<Array<{ payload?: Record<string, unknown> }>>`
      select payload
      from warehouse_documents
      where id = ${record.id}
      limit 1
    `;
    const payload = {
      ...(rows[0]?.payload ?? {}),
      objectUrl: record.objectUrl,
      storageProvider: record.storageProvider,
      scanStatus: record.scanStatus,
      scanNote: record.scanNote,
      previewAllowed: record.previewAllowed,
    };
    await sql`
      update warehouse_documents
      set payload = ${sql.json(payload)}
      where id = ${record.id}
    `;
    return record;
  }

  const data = await readDocumentStore();
  const index = data.documents.findIndex((item) => item.id === record.id);
  if (index === -1) return null;
  data.documents[index] = record;
  await writeDocumentStore(data);
  return record;
}

export async function updateDocumentSecurityStatus({
  id,
  scanStatus,
  scanNote,
}: {
  id: string;
  scanStatus: NonNullable<DocumentRecord["scanStatus"]>;
  scanNote: string;
}) {
  const record = await getDocumentById(id);
  if (!record) return { document: null, error: "未找到文件。" };
  const updated: DocumentRecord = {
    ...record,
    scanStatus,
    scanNote: scanNote.trim() || (scanStatus === "clean" ? "人工复核通过。" : scanStatus === "blocked" ? "人工复核拦截。" : "等待安全扫描。"),
    previewAllowed: scanStatus === "clean" ? canPreview(record.mimeType) : false,
  };
  await updateDocumentRecordSecurity(updated);
  return { document: updated };
}

export async function rescanDocumentSecurity(id: string) {
  const record = await getDocumentById(id);
  if (!record) return { document: null, error: "未找到文件。" };
  const bytes = await getDocumentBytes(record);
  const scan = await scanDocument(bytes, record.mimeType, record.originalName, record.storedName);
  const updated: DocumentRecord = {
    ...record,
    scanStatus: scan.status,
    scanNote: scan.note,
    previewAllowed: scan.status === "clean" ? canPreview(record.mimeType) : false,
  };
  await updateDocumentRecordSecurity(updated);
  return { document: updated };
}

export async function addDocument({
  customerCode,
  refType,
  refId,
  category,
  originalName,
  mimeType,
  size,
  bytes,
  note,
  uploadedByRole,
  uploadedBy,
}: {
  customerCode: string;
  refType: DocumentRefType;
  refId: string;
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  size: number;
  bytes: Buffer;
  note?: string;
  uploadedByRole: "customer" | "staff";
  uploadedBy: string;
}) {
  const data = await readDocumentStore();
  const id = makeId();
  const storedName = `${id}-${cleanFileName(originalName)}`;
  const scan = await scanDocument(bytes, mimeType, originalName, storedName);
  if (scan.status === "blocked") throw new Error(scan.note);
  const objectUrl = await uploadObjectDocument(`${customerCode}/${storedName}`, bytes, mimeType);
  const record: DocumentRecord = {
    id,
    customerCode,
    refType,
    refId,
    category,
    originalName,
    storedName,
    mimeType,
    size,
    note: note?.trim(),
    storageProvider: objectUrl ? "object" : hasPostgresConfig() ? "postgres" : "local",
    objectUrl: objectUrl || undefined,
    scanStatus: scan.status,
    scanNote: scan.note,
    previewAllowed: canPreview(mimeType),
    uploadedByRole,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };

  if (hasPostgresConfig()) {
    const sql = getSql();
    await sql`
      insert into warehouse_documents (
        id, customer_code, ref_type, ref_id, category, original_name, stored_name, mime_type, size_bytes,
        note, uploaded_by_role, uploaded_by, uploaded_at, payload
      ) values (
        ${record.id}, ${record.customerCode}, ${record.refType}, ${record.refId}, ${record.category},
        ${record.originalName}, ${record.storedName}, ${record.mimeType}, ${record.size}, ${record.note ?? null},
        ${record.uploadedByRole}, ${record.uploadedBy}, ${record.uploadedAt}, ${sql.json({ bytesBase64: objectUrl ? undefined : bytes.toString("base64"), objectUrl, storageProvider: record.storageProvider, scanStatus: record.scanStatus, scanNote: record.scanNote, previewAllowed: record.previewAllowed })}
      )
      on conflict (id) do update set
        customer_code = excluded.customer_code,
        ref_type = excluded.ref_type,
        ref_id = excluded.ref_id,
        category = excluded.category,
        original_name = excluded.original_name,
        stored_name = excluded.stored_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        note = excluded.note,
        uploaded_by_role = excluded.uploaded_by_role,
        uploaded_by = excluded.uploaded_by,
        uploaded_at = excluded.uploaded_at,
        payload = excluded.payload
    `;
    return record;
  }

  await mkdir(path.join(uploadRoot, customerCode), { recursive: true });
  await writeFile(getDocumentFilePath(record), bytes);
  data.documents.unshift(record);
  await writeDocumentStore(data);
  return record;
}

export function documentCategoryLabel(category: DocumentCategory) {
  const labels: Record<DocumentCategory, string> = {
    payment_proof: "付款凭证",
    packing_list: "装箱单",
    label: "面单/标签",
    invoice: "发票",
    exception_photo: "异常照片",
    other: "其他资料",
  };
  return labels[category];
}

export function documentStorageProviderLabel(provider?: DocumentRecord["storageProvider"]) {
  const labels: Record<NonNullable<DocumentRecord["storageProvider"]>, string> = {
    postgres: "数据库归档",
    local: "本地文件",
    object: "对象存储",
  };
  return provider ? labels[provider] ?? provider : "未记录";
}

export function documentScanStatusLabel(status?: DocumentRecord["scanStatus"]) {
  const labels: Record<NonNullable<DocumentRecord["scanStatus"]>, string> = {
    pending: "待扫描",
    clean: "已通过",
    blocked: "已拦截",
  };
  return status ? labels[status] ?? status : "待扫描";
}

export function documentRefLabel(refType: DocumentRefType) {
  const labels: Record<DocumentRefType, string> = {
    billing: "账单",
    inquiry: "询盘",
    inbound: "入库",
    logistics: "物流",
    outbound: "出库",
    return: "退货",
    sku: "SKU",
    approval: "审批",
    general: "通用",
  };
  return labels[refType];
}
