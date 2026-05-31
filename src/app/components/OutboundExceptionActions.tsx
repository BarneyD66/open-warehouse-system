"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import type { OutboundExceptionRecord, OutboundExceptionStatus } from "@/lib/warehouseCoreStore";

type Props = {
  orderId: string;
  exception: OutboundExceptionRecord;
};

const statusOptions: Array<{ value: OutboundExceptionStatus; label: string }> = [
  { value: "investigating", label: "处理中" },
  { value: "resolved", label: "已处理" },
  { value: "ignored", label: "忽略" },
];

export function OutboundExceptionActions({ orderId, exception }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<OutboundExceptionStatus>(exception.status === "open" ? "investigating" : exception.status);
  const [note, setNote] = useState(exception.resolutionNote ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/warehouse/outbounds/${encodeURIComponent(orderId)}/exceptions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exceptionId: exception.id, status, note }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "异常处理失败，请稍后重试。");
        return;
      }
      router.refresh();
    });
  }

  if (exception.status === "resolved" || exception.status === "ignored") {
    return (
      <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 size={13} />
        已关闭
      </p>
    );
  }

  return (
    <div className="mt-2 grid gap-2">
      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
        <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setStatus(event.target.value as OutboundExceptionStatus)} value={status}>
          {statusOptions.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <input className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="处理说明，如已核对实物/已重新扫描" value={note} />
        <button className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={save} type="button">
          {isPending ? <Loader2 className="animate-spin" size={13} /> : <ShieldAlert size={13} />}
          更新
        </button>
      </div>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
