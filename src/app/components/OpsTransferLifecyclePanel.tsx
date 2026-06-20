"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, PackageCheck, PackageSearch, Send, Truck, type LucideIcon } from "lucide-react";
import type { DocumentRecord } from "@/lib/documentStore";
import type { ApprovalTimelineEvent, TransferLifecycleAction, TransferOrder } from "@/lib/warehouseCoreStore";
import { DocumentUploadPanel } from "./DocumentUploadPanel";

const statusLabel: Record<TransferOrder["status"], string> = {
  new: "新调拨",
  approved: "已审批",
  picking: "拣货中",
  in_transit: "在途",
  partially_received: "部分签收",
  received: "已签收",
  exception: "异常",
  cancelled: "已取消",
};

const statusClass: Record<TransferOrder["status"], string> = {
  new: "border-cyan-200 bg-cyan-50 text-cyan-800",
  approved: "border-violet-200 bg-violet-50 text-violet-800",
  picking: "border-amber-200 bg-amber-50 text-amber-800",
  in_transit: "border-blue-200 bg-blue-50 text-blue-800",
  partially_received: "border-amber-200 bg-amber-50 text-amber-800",
  received: "border-emerald-200 bg-emerald-50 text-emerald-800",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
};

const actionMeta: Record<TransferLifecycleAction, { label: string; icon: LucideIcon; className: string }> = {
  approve: { label: "审批", icon: ClipboardCheck, className: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" },
  start_picking: { label: "开始拣货", icon: PackageSearch, className: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" },
  ship: { label: "发出", icon: Send, className: "bg-slate-950 text-white hover:bg-slate-800" },
  partial_receive: { label: "部分签收", icon: PackageCheck, className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" },
  receive: { label: "全部签收", icon: CheckCircle2, className: "bg-cyan-700 text-white hover:bg-cyan-800" },
  mark_exception: { label: "标记异常", icon: AlertTriangle, className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
  cancel: { label: "取消", icon: AlertTriangle, className: "border-slate-200 bg-white text-slate-500 hover:bg-slate-50" },
};

function numberText(value?: number) {
  return (value ?? 0).toLocaleString("zh-CN");
}

function ApprovalTimelineList({ events }: { events?: ApprovalTimelineEvent[] }) {
  const latest = (events ?? []).slice(0, 3);
  if (latest.length === 0) return null;
  return (
    <div className="mt-2 grid gap-1 rounded-md bg-slate-50 p-2">
      <p className="text-[11px] font-semibold text-slate-500">审批记录</p>
      {latest.map((event) => (
        <div className="text-[11px] leading-4 text-slate-600" key={event.id}>
          <p className="font-semibold text-slate-900">{event.label} · {event.actor}</p>
          <p>{new Date(event.occurredAt).toLocaleString("zh-CN", { hour12: false })}</p>
          {event.note ? <p className="text-slate-500">{event.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function nextActions(status: TransferOrder["status"]): TransferLifecycleAction[] {
  if (status === "new") return ["approve", "start_picking", "cancel"];
  if (status === "approved") return ["start_picking", "ship", "cancel"];
  if (status === "picking") return ["ship", "mark_exception", "cancel"];
  if (status === "in_transit") return ["partial_receive", "receive", "mark_exception"];
  if (status === "partially_received") return ["partial_receive", "receive", "mark_exception"];
  if (status === "exception") return ["ship", "partial_receive", "receive", "cancel"];
  return [];
}

export function OpsTransferLifecyclePanel({ rows, documents = [] }: { rows: TransferOrder[]; documents?: DocumentRecord[] }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const activeRows = rows.filter((item) => !["received", "cancelled"].includes(item.status));
  const inTransit = rows.filter((item) => item.status === "in_transit" || item.status === "partially_received").length;
  const exceptions = rows.filter((item) => item.status === "exception").length;
  const receiveTotal = rows.reduce((sum, item) => sum + item.receivedQty, 0);

  function progressTransfer(row: TransferOrder, transferAction: TransferLifecycleAction) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress_transfer",
          transferId: row.id,
          transferAction,
          quantity: Number(quantities[row.id] || row.quantity),
          trackingNumber: tracking[row.id],
          note: notes[row.id],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; transfer?: TransferOrder };
      if (!response.ok) {
        setError(payload.error || "调拨单推进失败");
        return;
      }
      setMessage(`${row.id} 已更新为 ${payload.transfer ? statusLabel[payload.transfer.status] : "新状态"}`);
      window.setTimeout(() => window.location.reload(), 350);
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-700">Transfer</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-950">
            <Truck size={18} className="text-cyan-700" />
            调拨单作业流
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            调拨单从审批、拣货、发出、在途到签收逐步推进；签收数量会写入目的仓库存流水，异常可单独标记。
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["在办", activeRows.length],
            ["在途", inTransit],
            ["异常", exceptions],
            ["已签收", receiveTotal],
          ].map(([label, value]) => (
            <div className="min-w-20 rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={label}>
              <p className="text-[11px] font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {message ? <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1120px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">调拨单</th>
              <th className="px-4 py-3">路径</th>
              <th className="px-4 py-3">数量</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">作业录入</th>
              <th className="px-4 py-3 text-right">动作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 8).map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 align-top">
                  <p className="font-mono text-xs font-semibold text-slate-950">{row.id}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{row.skuCode}</p>
                  {row.relatedPlanId ? <p className="mt-1 text-[11px] text-cyan-700">补货计划 {row.relatedPlanId}</p> : null}
                </td>
                <td className="px-4 py-3 align-top text-xs text-slate-600">
                  <p>{row.fromWarehouseCode}</p>
                  <p className="text-slate-400">→</p>
                  <p>{row.toWarehouseCode}</p>
                </td>
                <td className="px-4 py-3 align-top text-xs text-slate-600">
                  <p>计划 {numberText(row.quantity)}</p>
                  <p className="mt-1">发出 {numberText(row.shippedQty)} / 签收 {numberText(row.receivedQty)}</p>
                  <div className="mt-2 h-2 w-28 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${Math.min(100, Math.max(0, row.progress))}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass[row.status]}`}>{statusLabel[row.status]}</span>
                  {row.trackingNumber ? <p className="mt-2 font-mono text-[11px] text-slate-500">{row.trackingNumber}</p> : null}
                  {row.exceptionNote ? <p className="mt-2 max-w-44 text-[11px] leading-4 text-rose-700">{row.exceptionNote}</p> : null}
                  <ApprovalTimelineList events={row.approvalTimeline} />
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="grid gap-2">
                    <input className="h-9 w-28 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-cyan-500" min={0} onChange={(event) => setQuantities((prev) => ({ ...prev, [row.id]: event.target.value }))} placeholder="数量" type="number" value={quantities[row.id] ?? ""} />
                    <input className="h-9 w-40 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-cyan-500" onChange={(event) => setTracking((prev) => ({ ...prev, [row.id]: event.target.value }))} placeholder="运输单号" value={tracking[row.id] ?? ""} />
                    <input className="h-9 w-48 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-cyan-500" onChange={(event) => setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))} placeholder="作业备注" value={notes[row.id] ?? ""} />
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap justify-end gap-2">
                    {nextActions(row.status).map((action) => {
                      const meta = actionMeta[action];
                      const Icon = meta.icon;
                      return (
                        <button className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold disabled:opacity-60 ${meta.className}`} disabled={pending} key={action} onClick={() => progressTransfer(row, action)} type="button">
                          <Icon size={14} />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                  {row.status === "new" ? (
                    <div className="mt-3 min-w-64 text-left">
                      <DocumentUploadPanel
                        category="other"
                        customerCode={row.customerCode}
                        documents={documents.filter((document) => document.refType === "approval" && document.refId === row.id)}
                        refId={row.id}
                        refType="approval"
                        title="调拨审批附件"
                        uploadEndpoint="/api/ops/documents"
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={6}>
                  暂无调拨单
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
