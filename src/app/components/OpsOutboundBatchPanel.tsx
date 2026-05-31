"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Printer, Save } from "lucide-react";
import type { CoreOutboundOrder } from "@/lib/warehouseCoreStore";

type Props = {
  rows: Array<Pick<CoreOutboundOrder, "id" | "customerCode" | "channel" | "orderCount" | "status">>;
};

const options: Array<{ value: CoreOutboundOrder["status"]; label: string }> = [
  { value: "pending_review", label: "待审核" },
  { value: "picking", label: "拣货中" },
  { value: "label_pending", label: "待面单" },
  { value: "packing_check", label: "包装复核" },
  { value: "handover", label: "待交运" },
  { value: "shipped", label: "已发货" },
  { value: "blocked", label: "异常阻塞" },
];

export function OpsOutboundBatchPanel({ rows }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CoreOutboundOrder["status"]>("picking");
  const [note, setNote] = useState("批量处理");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const openIds = useMemo(() => rows.filter((row) => row.status !== "shipped").map((row) => row.id), [rows]);
  const printHref = selectedIds.length > 0 ? `/warehouse/print/pick-list/batch?ids=${encodeURIComponent(selectedIds.join(","))}` : "#";

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function applyBatch() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/outbounds/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status, note }),
      });
      const payload = (await response.json().catch(() => ({}))) as { updated?: number; missing?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "批量处理失败，请稍后重试。");
        return;
      }
      setMessage(`已批量更新 ${payload.updated ?? 0} 个出库申请${payload.missing?.length ? `，${payload.missing.length} 个未找到` : ""}`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ClipboardList size={17} className="text-[#0E7490]" />
            出库批量处理
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">选择多张客户出库申请，可批量推进状态或生成合并拣货单。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSelectedIds(openIds)} type="button">
            选择未发货
          </button>
          <button className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSelectedIds([])} type="button">
            清空
          </button>
          <a className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${selectedIds.length ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"}`} href={printHref}>
            <Printer size={16} />
            批量拣货单
          </a>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_1fr_auto]">
        <div className="flex flex-wrap gap-2">
          {rows.slice(0, 12).map((row) => (
            <button
              className={`min-h-9 rounded-md border px-3 text-left text-xs font-semibold ${selectedSet.has(row.id) ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              key={row.id}
              onClick={() => toggle(row.id)}
              type="button"
            >
              <span className="font-mono">{row.id}</span>
              <span className="ml-2 text-slate-500">{row.customerCode}</span>
            </button>
          ))}
        </div>
        <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setStatus(event.target.value as CoreOutboundOrder["status"])} value={status}>
          {options.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="批量备注" value={note} />
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || selectedIds.length === 0} onClick={applyBatch} type="button">
          <Save size={16} />
          批量保存
        </button>
      </div>

      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}
