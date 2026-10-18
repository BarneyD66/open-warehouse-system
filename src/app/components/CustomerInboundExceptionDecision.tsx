"use client";

import { SubmissionButton, submissionFetch, submissionTransition } from "./SubmissionFeedback";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { InboundExceptionCustomerDecision, InboundReceivingException } from "@/lib/localStore";

const decisionLabels: Record<InboundExceptionCustomerDecision, string> = {
  accept_actual: "接受按实收数量处理",
  request_recount: "要求仓库重新复核",
  request_reship: "安排补发缺货",
  return_excess: "退回多收货品",
  dispose_damaged: "同意处理破损品",
};

const decisions = Object.entries(decisionLabels) as Array<[InboundExceptionCustomerDecision, string]>;

export function CustomerInboundExceptionDecision({ inboundId, exception }: { inboundId: string; exception: InboundReceivingException }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [decision, setDecision] = useState<InboundExceptionCustomerDecision>(exception.customerDecision ?? "accept_actual");
  const [note, setNote] = useState(exception.customerDecisionNote ?? "");
  const [error, setError] = useState("");
  const closed = exception.status === "resolved" || exception.status === "ignored";

  async function submit() {

    setError("");
    return await submissionTransition(startTransition, async () => {
      const response=await submissionFetch(`/api/inbounds/${encodeURIComponent(inboundId)}/exceptions/${encodeURIComponent(exception.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const payload=(await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error||"处理方案保存失败，请稍后再试。");
        return false;
      }
      router.refresh();

      return true;
    });

    return true;

  }

  if (exception.customerDecision) {
    return (
      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={15} />已确认：{decisionLabels[exception.customerDecision]}</p>
        {exception.customerDecisionNote ? <p className="mt-1 text-xs leading-5">备注：{exception.customerDecisionNote}</p> : null}
      </div>
    );
  }

  if (closed) return <p className="mt-3 text-xs text-slate-500">该异常已由仓库关闭，无需客户确认。</p>;

  return (
    <div className="mt-3 grid gap-2 rounded-md border border-cyan-200 bg-cyan-50 p-3">
      <p className="text-xs font-semibold text-cyan-950">请选择处理方案</p>
      <select className="min-h-10 rounded-md border border-cyan-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-600" onChange={(event) => setDecision(event.target.value as InboundExceptionCustomerDecision)} value={decision}>
        {decisions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <textarea className="min-h-20 rounded-md border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600" onChange={(event) => setNote(event.target.value)} placeholder="可补充数量、补发时间或其他要求" value={note} />
      <SubmissionButton className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-cyan-900 px-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} onClick={submit} type="button">
        {isPending ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
        确认处理方案
      </SubmissionButton>
      {error ? <p className="text-xs font-semibold text-rose-700" role="alert">{error}</p> : null}
    </div>
  );
}
