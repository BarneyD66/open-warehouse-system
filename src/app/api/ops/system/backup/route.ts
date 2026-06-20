import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getDocuments } from "@/lib/documentStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function attachmentHeader(filename: string) {
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function handleGet(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-system-backup"), 5, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "系统备份导出过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  if (staff.role !== "admin") return NextResponse.json({ error: "只有系统管理员可以导出系统备份" }, { status: 403 });
  const [coreData, expansionData, documents] = await Promise.all([getWarehouseCoreData(), getOpsExpansionData(), getDocuments()]);
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    generatedBy: staff.username,
    version: "warehouse-backup-v1",
    coreData,
    expansionData,
    documents: documents.map((item) => ({ ...item, objectUrl: item.objectUrl ? "已归档对象存储" : undefined })),
  };

  await recordAuditLog({
    action: "system_backup_export",
    actorRole: "staff",
    actorName: staff.displayName || staff.username,
    targetType: "system",
    targetId: generatedAt,
    summary: "导出系统备份",
    note: "备份包含核心仓储数据、运营扩展数据和文件索引；对象存储原始地址不会直接暴露。",
    after: {
      version: payload.version,
      customers: coreData.customers.length,
      skus: coreData.skus.length,
      inventoryBalances: coreData.inventoryBalances.length,
      outboundOrders: coreData.outboundOrders.length,
      returnOrders: coreData.returnOrders.length,
      billingRecords: coreData.billingRecords.length,
      documents: documents.length,
      batchPlans: expansionData.batchOperationPlans.length,
      workOrders: expansionData.selfServiceWorkOrders.length,
    },
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": attachmentHeader(`仓储系统备份-${generatedAt.slice(0, 10)}.json`),
    },
  });
}

export async function GET(request: Request) {
  return withApiErrorCapture(request, "/api/ops/system/backup", () => handleGet(request));
}
