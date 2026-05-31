"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import type { InboundReceivingException, InboundReceivingExceptionStatus, InboundReceivingExceptionType } from "@/lib/localStore";

type Props = {
  inboundId: string;
  exception?: InboundReceivingException;
  mode: "create" | "resolve";
};

const typeOptions: Array<{ value: InboundReceivingExceptionType; label: string }> = [
  { value: "short_received", label: "少货" },
  { value: "over_received", label: "多货" },
  { value: "damaged", label: "破损" },
  { value: "sku_mismatch", label: "SKU 不符" },
  { value: "label_issue", label: "标签异常" },
  { value: "missing_document", label: "资料缺失" },
  { value: "manual", label: "其他异常" },
];

const statusOptions: Array<{ value: InboundReceivingExceptionStatus; label: string }> = [
  { value: "investigating", label: "处理中" },
  { value: "resolved", label: "已处理" },
  { value: "ignored", label: "忽略" },
];

export function InboundExceptionActions({ inboundId, exception, mode }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [type, setType] = useState<InboundReceivingExceptionType>("short_received");
  const [severity, setSeverity] = useState<"warning" | "critical">("critical");
  const [skuCode, setSkuCode] = useState("");
  const [cartonNo, setCartonNo] = useState("");
  const [expectedQty, setExpectedQty] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<InboundReceivingExceptionStatus>(exception?.status === "open" ? "investigating" : exception?.status ?? "investigating");
  const [note, setNote] = useState(exception?.resolutionNote ?? "");

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/warehouse/inbounds/${encodeURIComponent(inboundId)}/exceptions`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:
          mode === "create"
            ? JSON.stringify({ type, severity, skuCode, cartonNo, expectedQty, actualQty, message })
            : JSON.stringify({ exceptionId: exception?.id, status, note }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "保存失败，请稍后重试。");
        return;
      }
      if (mode === "create") {
        setSkuCode("");
        setCartonNo("");
        setExpectedQty("");
        setActualQty("");
        setMessage("");
      }
      router.refresh();
    });
  }

  if (mode === "resolve") {
    if (!exception) return null;
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
          <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setStatus(event.target.value as InboundReceivingExceptionStatus)} value={status}>
            {statusOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <input className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="处理说明，如已拍照/已通知客户/已按实收上架" value={note} />
          <button className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={save} type="button">
            {isPending ? <Loader2 className="animate-spin" size={13} /> : <ShieldAlert size={13} />}
            更新
          </button>
        </div>
        {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
        <AlertTriangle size={14} />
        记录收货差异
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <select className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-amber-500" onChange={(event) => setType(event.target.value as InboundReceivingExceptionType)} value={type}>
          {typeOptions.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <select className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-amber-500" onChange={(event) => setSeverity(event.target.value as "warning" | "critical")} value={severity}>
          <option value="critical">严重异常</option>
          <option value="warning">提醒复核</option>
        </select>
        <input className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-amber-500" onChange={(event) => setSkuCode(event.target.value)} placeholder="SKU，可选" value={skuCode} />
        <input className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-amber-500" onChange={(event) => setCartonNo(event.target.value)} placeholder="箱号/包裹号，可选" value={cartonNo} />
        <input className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-amber-500" inputMode="numeric" onChange={(event) => setExpectedQty(event.target.value)} placeholder="预报数量" value={expectedQty} />
        <input className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-amber-500" inputMode="numeric" onChange={(event) => setActualQty(event.target.value)} placeholder="实收数量" value={actualQty} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-amber-500" onChange={(event) => setMessage(event.target.value)} placeholder="差异说明，如 A 箱外箱破损，SKU-001 少 2 件" value={message} />
        <button className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md bg-amber-900 px-3 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60" disabled={isPending} onClick={save} type="button">
          {isPending ? <Loader2 className="animate-spin" size={13} /> : <AlertTriangle size={13} />}
          记录异常
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
