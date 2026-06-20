"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Search, ShieldCheck } from "lucide-react";
import type { AuditLogRecord } from "@/lib/auditLogStore";

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

const actorRoleLabels: Record<AuditLogRecord["actorRole"], string> = {
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

function dateText(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function compactPayload(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const text = JSON.stringify(value);
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function payloadRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadAuditCsv(rows: AuditLogRecord[]) {
  const csvRows = [
    ["日志编号", "发生时间", "操作动作", "操作者类型", "操作者", "业务类型", "关联单号", "客户编号", "操作说明", "备注", "操作后摘要"],
    ...rows.map((log) => [
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
      compactPayload(log.after),
    ]),
  ];
  const blob = new Blob([`\ufeff${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "操作日志筛选结果.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function OpsAuditLogPanel({ logs }: { logs: AuditLogRecord[] }) {
  const [keyword, setKeyword] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [targetType, setTargetType] = useState("");
  const [action, setAction] = useState("");

  const actionOptions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);
  const staffLoginSummary = useMemo(() => {
    const failed = logs.filter((log) => log.action === "staff_login_failed");
    const success = logs.filter((log) => log.action === "staff_login_success");
    const locked = failed.filter((log) => payloadRecord(log.after).status === "locked");
    const failedByAccount = failed.reduce((map, log) => {
      map.set(log.targetId, (map.get(log.targetId) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
    const topFailedAccounts = Array.from(failedByAccount.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);
    return { failed, success, locked, topFailedAccounts };
  }, [logs]);
  const filteredLogs = useMemo(() => {
    const cleanKeyword = keyword.trim().toLowerCase();
    return logs
      .filter((log) => !actorRole || log.actorRole === actorRole)
      .filter((log) => !targetType || log.targetType === targetType)
      .filter((log) => !action || log.action === action)
      .filter((log) => {
        if (!cleanKeyword) return true;
        return [log.summary, log.note, log.actorName, log.targetId, log.customerCode, actionLabels[log.action], targetTypeLabels[log.targetType]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(cleanKeyword);
      })
      .slice(0, 80);
  }, [action, actorRole, keyword, logs, targetType]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-700">Audit</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-950">
            <ShieldCheck size={18} className="text-cyan-700" />
            操作日志检索
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            按客户、单号、操作人、动作和业务类型追溯关键操作，方便老板、运营、仓库和财务复盘库存、账单、物流异常和文件访问过程。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            当前显示 {filteredLogs.length} / {logs.length} 条
          </span>
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={filteredLogs.length === 0}
            onClick={() => downloadAuditCsv(filteredLogs)}
            type="button"
          >
            <Download size={14} />
            导出当前筛选
          </button>
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800" href="/api/ops/audit-logs?limit=500">
            <Download size={14} />
            导出全部日志
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          关键词
          <span className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
            <Search size={15} className="text-slate-400" />
            <input className="min-w-0 flex-1 text-sm font-normal outline-none" onChange={(event) => setKeyword(event.target.value)} placeholder="客户编号、单号、操作人、备注" value={keyword} />
          </span>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          操作者类型
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setActorRole(event.target.value)} value={actorRole}>
            <option value="">全部</option>
            {Object.entries(actorRoleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          业务类型
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setTargetType(event.target.value)} value={targetType}>
            <option value="">全部</option>
            {Object.entries(targetTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          操作动作
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setAction(event.target.value)} value={action}>
            <option value="">全部</option>
            {actionOptions.map((value) => (
              <option key={value} value={value}>
                {actionLabels[value] ?? value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {staffLoginSummary.failed.length + staffLoginSummary.success.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-emerald-800">员工登录成功</p>
            <p className="mt-1 text-xl font-semibold text-emerald-950">{staffLoginSummary.success.length}</p>
          </div>
          <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-800">员工登录失败</p>
            <p className="mt-1 text-xl font-semibold text-amber-950">{staffLoginSummary.failed.length}</p>
          </div>
          <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-rose-700">触发锁定</p>
            <p className="mt-1 text-xl font-semibold text-rose-950">{staffLoginSummary.locked.length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-500">失败最多账号</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">
              {staffLoginSummary.topFailedAccounts.length > 0 ? staffLoginSummary.topFailedAccounts.map(([account, count]) => `${account} ${count}次`).join("，") : "暂无"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">动作</th>
              <th className="px-4 py-3">操作人</th>
              <th className="px-4 py-3">关联对象</th>
              <th className="px-4 py-3">说明</th>
              <th className="px-4 py-3">变更摘要</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 align-top text-xs text-slate-600">{dateText(log.createdAt)}</td>
                <td className="px-4 py-3 align-top">
                  <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{actionLabels[log.action] ?? log.action}</span>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">
                  <p className="font-semibold text-slate-900">{log.actorName}</p>
                  <p className="mt-1 text-xs text-slate-500">{actorRoleLabels[log.actorRole]}</p>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">
                  <p>{targetTypeLabels[log.targetType]}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{log.targetId}</p>
                  {log.customerCode ? <p className="mt-1 font-mono text-xs text-slate-500">{log.customerCode}</p> : null}
                </td>
                <td className="px-4 py-3 align-top text-slate-700">
                  <p>{log.summary}</p>
                  {log.note ? <p className="mt-1 text-xs text-slate-500">{log.note}</p> : null}
                </td>
                <td className="px-4 py-3 align-top font-mono text-xs text-slate-500">{compactPayload(log.after) || "-"}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  暂无匹配日志
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
