"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import type { AuditLogRecord } from "@/lib/auditLogStore";

type BackupSummary = {
  version: string;
  generatedAt: string;
  generatedBy: string;
  inventoryBalances: number;
  outboundOrders: number;
  returnOrders: number;
  billingRecords: number;
  batchPlans: number;
  platformConnections: number;
  workOrders: number;
  reportSchedules: number;
  documents: number;
};

type RestoreResponse = {
  ok?: boolean;
  dryRun?: boolean;
  message?: string;
  error?: string;
  confirmText?: string;
  issues?: string[];
  summary?: BackupSummary;
};

type Props = {
  recentLogs: AuditLogRecord[];
};

const confirmText = "RESTORE_WAREHOUSE_SYSTEM";

function dateText(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function SummaryGrid({ summary }: { summary: BackupSummary }) {
  const rows = [
    ["库存余额", summary.inventoryBalances],
    ["出库单", summary.outboundOrders],
    ["退货单", summary.returnOrders],
    ["账单", summary.billingRecords],
    ["批量任务", summary.batchPlans],
    ["平台连接", summary.platformConnections],
    ["客户工单", summary.workOrders],
    ["报表计划", summary.reportSchedules],
    ["文件索引", summary.documents],
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div className="rounded-md border border-slate-200 bg-white p-3" key={label}>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function OpsBackupRestorePanel({ recentLogs }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [backupText, setBackupText] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [result, setResult] = useState<RestoreResponse | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const backupLogs = useMemo(
    () => recentLogs.filter((item) => item.action === "system_backup_export" || item.action === "system_restore").slice(0, 5),
    [recentLogs],
  );

  function parseBackup() {
    const text = backupText.trim();
    if (!text) throw new Error("请先选择或粘贴备份 JSON。");
    return JSON.parse(text) as unknown;
  }

  async function readFile(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    setResult(null);
    const text = await file.text();
    setBackupText(text);
    setMessage(`已读取备份文件：${file.name}`);
  }

  function submit(dryRun: boolean) {
    setError("");
    setMessage("");
    startTransition(async () => {
      let backup: unknown;
      try {
        backup = parseBackup();
      } catch (parseError) {
        setError(parseError instanceof Error ? parseError.message : "备份 JSON 解析失败。");
        return;
      }

      const response = await fetch("/api/ops/system/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, dryRun, confirmText: dryRun ? undefined : confirmValue.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as RestoreResponse;
      setResult(payload);
      if (!response.ok || payload.ok === false) {
        setError(payload.error || payload.issues?.join("；") || "备份预检或恢复失败。");
        return;
      }
      setMessage(dryRun ? payload.message || "备份预检通过，未写入数据。" : "系统恢复已执行，页面数据已刷新。");
      if (!dryRun) router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-cyan-700" />
            <h2 className="text-base font-semibold text-slate-950">备份与恢复治理</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            用于正式上线后的人工快照、恢复前预检和恢复审计。恢复会覆盖当前仓储、运营扩展和文件索引数据，必须先预检，再填写确认短语。
          </p>
        </div>
        <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800" href="/api/ops/system/backup">
          <Download size={15} />
          导出系统备份
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            选择备份文件
            <input
              accept="application/json,.json"
              className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
              onChange={(event) => readFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            或粘贴备份 JSON
            <textarea
              className="min-h-40 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              onChange={(event) => setBackupText(event.target.value)}
              placeholder='{"version":"warehouse-backup-v1", ...}'
              value={backupText}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 disabled:opacity-60" disabled={isPending} onClick={() => submit(true)} type="button">
              {isPending ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
              预检备份
            </button>
            <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-800 disabled:opacity-60" disabled={isPending || confirmValue.trim() !== confirmText} onClick={() => submit(false)} type="button">
              {isPending ? <Loader2 className="animate-spin" size={15} /> : <RotateCcw size={15} />}
              执行恢复
            </button>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            恢复确认短语
            <input
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              onChange={(event) => setConfirmValue(event.target.value)}
              placeholder={confirmText}
              value={confirmValue}
            />
          </label>
          {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        </div>

        <div className="grid gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              {result?.ok ? <CheckCircle2 size={16} className="text-emerald-700" /> : <AlertTriangle size={16} className="text-amber-700" />}
              <p className="text-sm font-semibold text-slate-950">备份预检摘要</p>
            </div>
            {result?.summary ? (
              <div className="mt-3 grid gap-3">
                <div className="grid gap-1 text-xs leading-5 text-slate-600">
                  <p>版本：{result.summary.version || "-"}</p>
                  <p>导出时间：{dateText(result.summary.generatedAt)}</p>
                  <p>导出人：{result.summary.generatedBy || "-"}</p>
                </div>
                <SummaryGrid summary={result.summary} />
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">选择备份文件并点击预检后，会在这里显示可恢复的数据范围。</p>
            )}
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-950">最近备份/恢复审计</p>
            <div className="mt-3 grid gap-2">
              {backupLogs.length > 0 ? (
                backupLogs.map((log) => (
                  <div className="rounded-md border border-slate-200 bg-white p-3" key={log.id}>
                    <p className="text-xs font-semibold text-slate-500">{dateText(log.createdAt)}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{log.summary}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{log.actorName} / {log.note || log.targetId}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-center text-sm text-slate-500">暂无备份或恢复审计记录</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
