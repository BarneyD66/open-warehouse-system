"use client";

import { useRouter } from "next/navigation";
import type { ElementType } from "react";
import { useState, useTransition } from "react";
import { CheckCircle2, RotateCw, Send, XCircle } from "lucide-react";
import type { OutboundCustomerExceptionDecision } from "@/lib/warehouseCoreStore";

type Props = {
  orderId: string;
  exceptionId: string;
  redeliveryRequired?: boolean;
  hasClaim?: boolean;
  hasProof?: boolean;
  currentDecision?: string;
};

const decisionButtons: Array<{ decision: OutboundCustomerExceptionDecision; label: string; icon: ElementType; tone: string; when?: "redelivery" | "claim" | "proof" }> = [
  { decision: "redelivery_confirmed", label: "确认改派", icon: RotateCw, tone: "border-cyan-200 bg-cyan-50 text-cyan-800", when: "redelivery" },
  { decision: "accepted", label: "确认无误", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800", when: "proof" },
  { decision: "claim_question", label: "赔付疑问", icon: Send, tone: "border-amber-200 bg-amber-50 text-amber-800", when: "claim" },
  { decision: "rejected", label: "不认可", icon: XCircle, tone: "border-rose-200 bg-rose-50 text-rose-800" },
];

export function CustomerExceptionDecisionActions({ orderId, exceptionId, redeliveryRequired, hasClaim, hasProof, currentDecision }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const visibleButtons = decisionButtons.filter((item) => {
    if (item.when === "redelivery") return redeliveryRequired;
    if (item.when === "claim") return hasClaim;
    if (item.when === "proof") return hasProof;
    return true;
  });

  function submit(decision: OutboundCustomerExceptionDecision) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/outbounds/${encodeURIComponent(orderId)}/delivery-exceptions/${encodeURIComponent(exceptionId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error || "异常确认失败，请稍后重试。");
        return;
      }
      setNote("");
      setMessage(payload.message || "已提交确认结果。");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">{currentDecision ? `已提交：${currentDecision}` : "在线确认处理方案"}</p>
        <div className="flex flex-wrap gap-2">
          {visibleButtons.map((item) => {
            const Icon = item.icon;
            return (
              <button className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold disabled:opacity-60 ${item.tone}`} disabled={isPending} key={item.decision} onClick={() => submit(item.decision)} type="button">
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <input className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="可补充改派地址、收件时间、赔付疑问或拒绝原因" value={note} />
      {message ? <p className="mt-2 text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
