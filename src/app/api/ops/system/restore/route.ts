import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { recordAuditLog } from "@/lib/auditLogStore";
import { restoreDocumentsFromBackup, type DocumentRecord } from "@/lib/documentStore";
import { restoreOpsExpansionData, type OpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { restoreWarehouseCoreData, type WarehouseCoreData } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const restoreConfirmText = "RESTORE_WAREHOUSE_SYSTEM";

type BackupPayload = {
  version?: string;
  generatedAt?: string;
  generatedBy?: string;
  coreData?: Partial<WarehouseCoreData>;
  expansionData?: Partial<OpsExpansionData>;
  documents?: Partial<DocumentRecord>[];
};

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function validateBackup(payload: BackupPayload) {
  const issues = [
    payload.version !== "warehouse-backup-v1" ? "备份版本不匹配，请上传 warehouse-backup-v1 格式。" : "",
    !payload.coreData || !Array.isArray(payload.coreData.inventoryBalances) ? "缺少 coreData.inventoryBalances。" : "",
    !payload.coreData || !Array.isArray(payload.coreData.outboundOrders) ? "缺少 coreData.outboundOrders。" : "",
    !payload.coreData || !Array.isArray(payload.coreData.billingRecords) ? "缺少 coreData.billingRecords。" : "",
    !payload.expansionData || !Array.isArray(payload.expansionData.batchOperationPlans) ? "缺少 expansionData.batchOperationPlans。" : "",
    !payload.expansionData || !Array.isArray(payload.expansionData.selfServiceWorkOrders) ? "缺少 expansionData.selfServiceWorkOrders。" : "",
    !Array.isArray(payload.documents) ? "缺少 documents 数组。" : "",
  ].filter(Boolean);

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      version: payload.version || "",
      generatedAt: payload.generatedAt || "",
      generatedBy: payload.generatedBy || "",
      inventoryBalances: countArray(payload.coreData?.inventoryBalances),
      outboundOrders: countArray(payload.coreData?.outboundOrders),
      returnOrders: countArray(payload.coreData?.returnOrders),
      billingRecords: countArray(payload.coreData?.billingRecords),
      batchPlans: countArray(payload.expansionData?.batchOperationPlans),
      platformConnections: countArray(payload.expansionData?.platformConnections),
      workOrders: countArray(payload.expansionData?.selfServiceWorkOrders),
      reportSchedules: countArray(payload.expansionData?.reportSchedules),
      documents: countArray(payload.documents),
    },
  };
}

async function handlePost(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-system-restore"), 5, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "系统恢复操作过于频繁，请稍后再试。", resetAt: rate.resetAt }, { status: 429 });

  const staff = await requireStaffSession();
  if (staff.role !== "admin") return NextResponse.json({ error: "只有系统管理员可以执行系统恢复" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean; confirmText?: string; backup?: BackupPayload };
  const backup = body.backup;
  if (!backup) return NextResponse.json({ error: "缺少备份内容，请传入 backup 字段。" }, { status: 400 });

  const validation = validateBackup(backup);
  const dryRun = body.dryRun !== false;
  if (!validation.ok) return NextResponse.json({ ...validation, ok: false, dryRun }, { status: 400 });
  if (dryRun) return NextResponse.json({ ...validation, ok: true, dryRun: true, message: "备份预检通过，未写入数据。", confirmText: restoreConfirmText });
  if (body.confirmText !== restoreConfirmText) {
    return NextResponse.json({ ...validation, error: `执行恢复前必须填写确认短语：${restoreConfirmText}`, ok: false, dryRun: false }, { status: 400 });
  }

  const [coreData, expansionData, documents] = await Promise.all([
    restoreWarehouseCoreData(backup.coreData as WarehouseCoreData),
    restoreOpsExpansionData(backup.expansionData as OpsExpansionData),
    restoreDocumentsFromBackup(backup.documents as DocumentRecord[]),
  ]);

  await recordAuditLog({
    action: "system_restore",
    actorRole: "staff",
    actorName: staff.displayName || staff.username,
    targetType: "system",
    targetId: backup.generatedAt || "warehouse-backup",
    summary: "执行系统备份恢复",
    note: `恢复备份：${backup.generatedAt || "未知时间"} / ${backup.generatedBy || "未知导出人"}`,
    after: validation.summary,
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    restoredAt: new Date().toISOString(),
    summary: {
      ...validation.summary,
      inventoryBalances: coreData.inventoryBalances.length,
      outboundOrders: coreData.outboundOrders.length,
      batchPlans: expansionData.batchOperationPlans.length,
      documents: documents.length,
    },
  });
}

export async function POST(request: Request) {
  return withApiErrorCapture(request, "/api/ops/system/restore", () => handlePost(request));
}
