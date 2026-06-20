import { NextResponse } from "next/server";
import { getAuditLogs, type AuditActorRole, type AuditLogRecord } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";

const actorRoleLabels: Record<AuditActorRole, string> = {
  customer: "客户",
  staff: "员工",
  system: "系统",
};

const targetTypeLabels: Record<AuditLogRecord["targetType"], string> = {
  customer_account: "客户账号",
  customer_profile: "客户资料",
  staff_account: "员工账号",
  inventory_adjustment: "库存调整",
  inventory_lot: "库存批次",
  warehouse_location: "仓库库位",
  warehouse_task: "仓库任务",
  inbound: "入库",
  outbound: "出库",
  return: "退货",
  billing: "账单",
  notification_delivery: "通知投递",
  document: "业务资料",
  report: "报表导出",
  system: "系统运维",
};

const actionLabels: Partial<Record<AuditLogRecord["action"], string>> = {
  customer_register: "客户注册",
  customer_profile_update: "客户资料更新",
  customer_status_update: "客户状态变更",
  customer_password_change: "客户修改密码",
  customer_password_reset: "客户重置密码",
  document_upload: "文件上传",
  document_upload_rejected: "文件上传被拒绝",
  document_preview: "文件预览",
  document_download: "文件下载",
  document_security_review: "文件安全复核",
  staff_login_success: "员工登录成功",
  staff_login_failed: "员工登录失败",
  staff_account_update: "员工账号维护",
  staff_role_change_review: "员工角色变更审批",
  inventory_adjustment_request: "库存调整申请",
  inventory_adjustment_approve: "库存调整通过",
  inventory_adjustment_reject: "库存调整驳回",
  inventory_lot_create: "批次创建",
  inventory_lot_reserve: "批次预占",
  inventory_lot_release: "批次释放",
  inventory_lot_consume: "批次消耗",
  inventory_lot_block: "批次冻结",
  inventory_lot_activate: "批次启用",
  inventory_lot_update: "批次更新",
  inventory_lot_risk_review_due: "批次风险巡检",
  warehouse_location_update: "库位维护",
  warehouse_location_risk_review_due: "库位风险巡检",
  warehouse_task_update: "仓库任务更新",
  warehouse_scan: "扫码作业",
  warehouse_scan_exception: "扫码异常",
  outbound_delivery_exception_create: "物流异常创建",
  outbound_delivery_exception_update: "物流异常更新",
  outbound_exception_update: "出库异常更新",
  inbound_exception_create: "入库异常创建",
  inbound_exception_update: "入库异常更新",
  inbound_putaway: "入库上架",
  outbound_work_mode_assign: "出库模式分配",
  outbound_document_reprint: "单据重打",
  outbound_intercept_request: "截单申请",
  outbound_intercept_restock: "拦截回库",
  outbound_ship: "出库发货",
  outbound_status_batch_update: "出库状态批量更新",
  outbound_shipping_label_update: "出库物流面单更新",
  batch_job_run_due: "到期任务批量执行",
  batch_job_retry_due: "到期任务批量重试",
  outbound_pick_wave_batch: "批量生成拣货波次",
  outbound_batch_weighing: "批量称重",
  platform_orders_sync_due: "平台订单到期同步",
  platform_cancellation_review_due: "平台取消订单复核",
  billing_auto_generate: "自动生成费用账单",
  billing_record_review: "账单状态复核",
  billing_payment_review: "账单付款复核",
  billing_payment_import: "银行流水导入核销",
  billing_invoice_review: "账单开票复核",
  carrier_label_retry_due: "承运商面单批量重试",
  carrier_tracking_sync_due: "承运商轨迹同步",
  platform_fulfillment_retry_due: "平台发货回传批量重试",
  notification_delivery_retry: "通知投递重试",
  notification_delivery_retry_due: "到期通知批量重试",
  notification_generate_due: "到期通知生成",
  notification_rule_update: "SLA 提醒规则更新",
  automation_run_due: "生产自动化调度",
  automation_task_update: "自动化任务处理",
  report_export: "报表导出",
  integration_probe: "集成联调探测",
  system_alert_update: "系统告警处理",
  production_error_update: "生产错误处理",
  system_backup_export: "系统备份导出",
  system_restore: "系统恢复",
};

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

function clean(value: string | null) {
  return value?.trim() || undefined;
}

function payloadText(value: unknown) {
  if (!value) return "";
  const text = JSON.stringify(value);
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(500, Math.floor(parsed))) : 500;
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  const canExport = canAccessOpsModule(staff, "permissions", expansionData) || canAccessOpsModule(staff, "reports", expansionData);
  if (!canExport) return NextResponse.json({ error: "当前角色无权导出审计日志" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const logs = await getAuditLogs({
    customerCode: clean(searchParams.get("customerCode")),
    action: clean(searchParams.get("action")) as AuditLogRecord["action"] | undefined,
    actorRole: clean(searchParams.get("actorRole")) as AuditActorRole | undefined,
    targetType: clean(searchParams.get("targetType")) as AuditLogRecord["targetType"] | undefined,
    targetId: clean(searchParams.get("targetId")),
    keyword: clean(searchParams.get("keyword")),
    dateFrom: clean(searchParams.get("dateFrom")),
    dateTo: clean(searchParams.get("dateTo")),
    limit: parseLimit(searchParams.get("limit")),
  });

  return csvResponse("操作日志导出.csv", [
    ["日志编号", "发生时间", "操作动作", "操作者类型", "操作者", "业务类型", "关联单号", "客户编号", "操作说明", "备注", "操作前", "操作后"],
    ...logs.map((log) => [
      log.id,
      log.createdAt,
      actionLabels[log.action] ?? log.action,
      actorRoleLabels[log.actorRole] ?? log.actorRole,
      log.actorName,
      targetTypeLabels[log.targetType] ?? log.targetType,
      log.targetId,
      log.customerCode ?? "",
      log.summary,
      log.note ?? "",
      payloadText(log.before),
      payloadText(log.after),
    ]),
  ]);
}
