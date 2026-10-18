import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import {
  documentCategoryLabel,
  documentRefLabel,
  documentScanStatusLabel,
  documentStorageProviderLabel,
  getDocuments,
  type DocumentRecord,
} from "@/lib/documentStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function attachmentHeader(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download.csv";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function csvResponse(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\ufeff${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentHeader(filename),
    },
  });
}

function fileSizeKb(size: number) {
  return Math.round((size / 1024) * 10) / 10;
}

function scanRank(row: DocumentRecord) {
  if (row.scanStatus === "blocked") return 0;
  if (!row.scanStatus || row.scanStatus === "pending") return 1;
  return 2;
}

export async function GET(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "documents-security-report"), 30, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "导出过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData) && !canAccessOpsModule(staff, "permissions", expansionData)) {
    return NextResponse.json({ error: "当前角色无权导出文件安全台账。" }, { status: 403 });
  }

  const url = new URL(request.url);
  const customerCode = (url.searchParams.get("customerCode") ?? "").trim().toUpperCase();
  const scanStatus = (url.searchParams.get("scanStatus") ?? "").trim();
  const storageProvider = (url.searchParams.get("storageProvider") ?? "").trim();
  const format = (url.searchParams.get("format") ?? "csv").trim().toLowerCase();

  const rows = (await getDocuments())
    .filter((row) => !customerCode || row.customerCode.toUpperCase() === customerCode)
    .filter((row) => !scanStatus || (row.scanStatus ?? "pending") === scanStatus)
    .filter((row) => !storageProvider || (row.storageProvider ?? "") === storageProvider)
    .sort((a, b) => scanRank(a) - scanRank(b) || new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "report",
      targetId: "documents-security",
      summary: "导出文件安全台账",
      note: `客户：${customerCode || "全部"}；扫描状态：${scanStatus || "全部"}；存储方式：${storageProvider || "全部"}；行数：${rows.length}`,
    });
  }

  const payload = rows.map((row) => ({
    documentId: row.id,
    customerCode: row.customerCode,
    refType: row.refType,
    refTypeLabel: documentRefLabel(row.refType),
    refId: row.refId,
    category: row.category,
    categoryLabel: documentCategoryLabel(row.category),
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeKb: fileSizeKb(row.size),
    storageProvider: row.storageProvider ?? "unknown",
    storageProviderLabel: documentStorageProviderLabel(row.storageProvider),
    scanStatus: row.scanStatus ?? "pending",
    scanStatusLabel: documentScanStatusLabel(row.scanStatus),
    scanNote: row.scanNote ?? "",
    previewAllowed: Boolean(row.previewAllowed),
    uploadedByRole: row.uploadedByRole,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
  }));

  if (format === "json") return NextResponse.json({ rows: payload, generatedAt: new Date().toISOString() });

  return csvResponse("文件安全台账.csv", [
    ["文件编号", "客户编号", "关联类型", "关联类型代码", "关联单号", "分类", "分类代码", "文件名", "MIME 类型", "大小KB", "存储方式", "存储方式代码", "扫描状态", "扫描状态代码", "扫描说明", "在线预览", "上传角色", "上传人", "上传时间"],
    ...rows.map((row) => [
      row.id,
      row.customerCode,
      documentRefLabel(row.refType),
      row.refType,
      row.refId,
      documentCategoryLabel(row.category),
      row.category,
      row.originalName,
      row.mimeType,
      fileSizeKb(row.size),
      documentStorageProviderLabel(row.storageProvider),
      row.storageProvider ?? "unknown",
      documentScanStatusLabel(row.scanStatus),
      row.scanStatus ?? "pending",
      row.scanNote ?? "",
      row.previewAllowed ? "支持" : "不支持",
      row.uploadedByRole === "customer" ? "客户" : "员工",
      row.uploadedBy,
      row.uploadedAt,
    ]),
  ]);
}
