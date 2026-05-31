import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";

export type DocumentRefType = "billing" | "inbound" | "logistics" | "outbound" | "sku" | "general";
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
        uploaded_at
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

export async function getDocumentsForCustomer(customerCode: string) {
  const documents = await getDocuments();
  return documents.filter((item) => item.customerCode === customerCode);
}

export async function getDocumentById(id: string) {
  const documents = await getDocuments();
  return documents.find((item) => item.id === id) ?? null;
}

export function getDocumentFilePath(record: DocumentRecord) {
  return path.join(uploadRoot, record.customerCode, record.storedName);
}

export async function getDocumentBytes(record: DocumentRecord) {
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
        ${record.uploadedByRole}, ${record.uploadedBy}, ${record.uploadedAt}, ${sql.json({ bytesBase64: bytes.toString("base64") })}
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

export function documentRefLabel(refType: DocumentRefType) {
  const labels: Record<DocumentRefType, string> = {
    billing: "账单",
    inbound: "入库",
    logistics: "物流",
    outbound: "出库",
    sku: "SKU",
    general: "通用",
  };
  return labels[refType];
}
