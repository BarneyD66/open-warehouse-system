"use client";

import { useMemo, useState, useTransition } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, RefreshCw, Search } from "lucide-react";
import Link from "next/link";

type OpsLogLevel = "critical" | "warning" | "info";
type OpsLogSource = "alert" | "job" | "audit" | "webhook" | "automation" | "error";

type OpsLogEntry = {
  id: string;
  level: OpsLogLevel;
  source: OpsLogSource;
  category: string;
  title: string;
  detail: string;
  refId?: string;
  customerCode?: string;
  actorName?: string;
  actionHref?: string;
  createdAt: string;
};

type OpsLogResponse = {
  generatedAt?: string;
  summary?: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  entries?: OpsLogEntry[];
  error?: string;
};

type ErrorActionResponse = {
  event?: {
    id: string;
    handlingStatus: string;
  };
  error?: string;
};

const levelLabels: Record<OpsLogLevel, string> = {
  critical: "严重",
  warning: "提醒",
  info: "信息",
};

const sourceLabels: Record<OpsLogSource, string> = {
  alert: "系统告警",
  job: "任务队列",
  audit: "操作审计",
  webhook: "Webhook 回调",
  automation: "自动化调度",
  error: "生产错误",
};

function tone(level: OpsLogLevel) {
  if (level === "critical") return "border-rose-200 bg-rose-50 text-rose-800";
  if (level === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value || "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function queryString(filters: { keyword: string; level: string; source: string }, format?: "csv") {
  const params = new URLSearchParams();
  params.set("limit", "120");
  if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());
  if (filters.level) params.set("level", filters.level);
  if (filters.source) params.set("source", filters.source);
  if (format) params.set("format", format);
  return params.toString();
}

export function OpsSystemLogPanel() {
  const [filters, setFilters] = useState({ keyword: "", level: "", source: "" });
  const [data, setData] = useState<OpsLogResponse>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const exportHref = useMemo(() => `/api/ops/system/logs?${queryString(filters, "csv")}`, [filters]);

  function load(options: { keepMessage?: boolean } = {}) {
    setError("");
    if (!options.keepMessage) setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/system/logs?${queryString(filters)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as OpsLogResponse;
      if (!response.ok) {
        setError(payload.error || "生产日志加载失败，请稍后再试。");
        return;
      }
      setData(payload);
    });
  }

  function handleProductionError(entry: OpsLogEntry, action: "acknowledge" | "resolve") {
    if (!entry.refId) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/system/errors/${encodeURIComponent(entry.refId ?? "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: action === "resolve" ? "已从生产日志检索关闭。" : "已从生产日志检索确认。",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ErrorActionResponse;
      if (!response.ok || !payload.event) {
        setError(payload.error || "生产错误处理失败，请稍后再试。");
        return;
      }
      setMessage(action === "resolve" ? `生产错误 ${payload.event.id} 已关闭。` : `生产错误 ${payload.event.id} 已确认。`);
      load({ keepMessage: true });
    });
  }

  const entries = data.entries ?? [];
  const summary = data.summary ?? { total: entries.length, critical: 0, warning: 0, info: entries.length };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Activity size={18} className="text-cyan-700" />
            生产日志检索
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            汇总系统告警、任务队列、Webhook 回调、自动化失败和关键审计记录，方便上线后快速定位异常来源、责任模块和处理入口。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={exportHref}>
            <Download size={14} />
            导出日志
          </Link>
          <button className="inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-60" disabled={isPending} onClick={() => load()} type="button">
            <RefreshCw className={isPending ? "animate-spin" : ""} size={14} />
            刷新
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">日志总数</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{summary.total}</p>
        </div>
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-700">严重</p>
          <p className="mt-1 text-xl font-semibold text-rose-900">{summary.critical}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700">提醒</p>
          <p className="mt-1 text-xl font-semibold text-amber-900">{summary.warning}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-500">生成时间</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{data.generatedAt ? timeLabel(data.generatedAt) : "-"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_10rem_10rem_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            placeholder="搜索单号、客户、错误、操作人"
            value={filters.keyword}
          />
        </label>
        <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))} value={filters.level}>
          <option value="">全部级别</option>
          <option value="critical">严重</option>
          <option value="warning">提醒</option>
          <option value="info">信息</option>
        </select>
        <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))} value={filters.source}>
          <option value="">全部来源</option>
          <option value="alert">系统告警</option>
          <option value="job">任务队列</option>
          <option value="webhook">Webhook 回调</option>
          <option value="automation">自动化调度</option>
          <option value="error">生产错误</option>
          <option value="audit">操作审计</option>
        </select>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 disabled:opacity-60" disabled={isPending} onClick={() => load()} type="button">
          <Search size={15} />
          检索
        </button>
      </div>

      {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {message ? <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <div className="mt-4 grid gap-2">
        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">点击“检索”或“刷新”后查看生产日志。</div>
        ) : (
          entries.slice(0, 12).map((entry) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={entry.id}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone(entry.level)}`}>{levelLabels[entry.level]}</span>
                    <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{sourceLabels[entry.source]}</span>
                    <span className="text-xs font-semibold text-slate-500">{timeLabel(entry.createdAt)}</span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-950">{entry.title}</p>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600">{entry.detail}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.refId ? `关联：${entry.refId}` : "无关联单号"}{entry.customerCode ? ` / 客户：${entry.customerCode}` : ""}{entry.actorName ? ` / 操作人：${entry.actorName}` : ""}
                  </p>
                </div>
                {entry.actionHref ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {entry.source === "error" && entry.refId ? (
                      <>
                        <button className="inline-flex min-h-8 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60" disabled={isPending} onClick={() => handleProductionError(entry, "acknowledge")} type="button">
                          <AlertTriangle size={13} />
                          确认
                        </button>
                        <button className="inline-flex min-h-8 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60" disabled={isPending} onClick={() => handleProductionError(entry, "resolve")} type="button">
                          <CheckCircle2 size={13} />
                          关闭
                        </button>
                      </>
                    ) : null}
                    <Link className="inline-flex min-h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50" href={entry.actionHref}>
                      去处理
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {summary.critical > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={14} />
          存在严重日志时，建议先处理 Webhook 失败、自动化失败和异常任务，再继续批量发货或账单锁定。
        </p>
      ) : null}
    </section>
  );
}
