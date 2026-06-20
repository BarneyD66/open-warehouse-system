"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Printer, Route, Save } from "lucide-react";
import type { CoreOutboundOrder, OutboundDocumentType, OutboundWorkMode } from "@/lib/warehouseCoreStore";

type Props = {
  order: Pick<CoreOutboundOrder, "id" | "workMode" | "assignedPicker" | "basketNo" | "status" | "interceptStatus">;
};

const workModes: Array<{ value: OutboundWorkMode; label: string }> = [
  { value: "single_item_batch", label: "集中分拣" },
  { value: "cart_sort", label: "拣货车分拣" },
  { value: "order_pick", label: "按单分拣" },
];

const documentTypes: Array<{ value: OutboundDocumentType; label: string }> = [
  { value: "pick_list", label: "拣货单" },
  { value: "shipping_label", label: "出货标签" },
  { value: "carrier_label", label: "快递面单" },
  { value: "invoice", label: "发票" },
];

export function WarehouseOutboundWorkflowActions({ order }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [workMode, setWorkMode] = useState<OutboundWorkMode>(order.workMode ?? "single_item_batch");
  const [assignedPicker, setAssignedPicker] = useState(order.assignedPicker ?? "");
  const [basketNo, setBasketNo] = useState(order.basketNo ?? "");
  const [documentType, setDocumentType] = useState<OutboundDocumentType>("pick_list");
  const [reason, setReason] = useState("");
  const [restockLocationCode, setRestockLocationCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function submit(action: "assign_work_mode" | "reprint_document" | "request_intercept" | "intercept_restock", success: string) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/warehouse/outbounds/${encodeURIComponent(order.id)}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, workMode, assignedPicker, basketNo, documentType, reason, restockLocationCode }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "操作失败，请稍后重试。");
        return;
      }
      setMessage(success);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setWorkMode(event.target.value as OutboundWorkMode)} value={workMode}>
          {workModes.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <input className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setAssignedPicker(event.target.value)} placeholder="拣货员" value={assignedPicker} />
        <input className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setBasketNo(event.target.value)} placeholder="篮号/格口号" value={basketNo} />
        <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => submit("assign_work_mode", "已生成下架/拣货任务。")} type="button">
          <Route size={14} />
          生成下架任务
        </button>
      </div>

      <div className="grid gap-2 border-t border-slate-200 pt-2 sm:grid-cols-[1fr_1fr_auto]">
        <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setDocumentType(event.target.value as OutboundDocumentType)} value={documentType}>
          {documentTypes.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <input className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setReason(event.target.value)} placeholder="重打/截单原因" value={reason} />
        <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60" disabled={isPending} onClick={() => submit("reprint_document", "已记录重打日志。")} type="button">
          <Printer size={14} />
          记录重打
        </button>
      </div>

      <div className="grid gap-2 border-t border-slate-200 pt-2 sm:grid-cols-[1fr_auto_auto]">
        <input className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setRestockLocationCode(event.target.value)} placeholder="截单回库位，如 A-01-03" value={restockLocationCode} />
        <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60" disabled={isPending || order.status === "shipped" || order.interceptStatus === "completed"} onClick={() => submit("request_intercept", "已申请截单，等待复核回库。")} type="button">
          <Ban size={14} />
          申请截单
        </button>
        <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" disabled={isPending || order.status === "shipped" || order.interceptStatus === "completed"} onClick={() => submit("intercept_restock", "已按审批要求截单并释放预占库存。")} type="button">
          <Ban size={14} />
          审批回库
        </button>
      </div>

      {message ? <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Save size={12} />{message}</p> : null}
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
