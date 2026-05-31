"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ReceiptText, Save } from "lucide-react";
import type { InquiryQuoteDraft, InquiryStatus } from "@/lib/localStore";

const statusOptions: Array<{ value: InquiryStatus; label: string }> = [
  { value: "new", label: "新询盘" },
  { value: "contacted", label: "已联系" },
  { value: "quoted", label: "已报价" },
  { value: "waiting_customer", label: "待客户确认" },
  { value: "quote_accepted", label: "客户已确认" },
  { value: "quote_question", label: "客户有疑问" },
  { value: "converted_to_inbound", label: "已转入库预报" },
  { value: "closed", label: "已关闭" },
];

type OpsInquiryWorkflowProps = {
  id: string;
  status: InquiryStatus;
  followUpNote?: string;
  nextFollowUpAt?: string;
  quoteDraft?: InquiryQuoteDraft;
  suggestedFollowUpNote?: string;
  suggestedQuoteNotes?: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

function moneyDefault(value?: number) {
  return typeof value === "number" ? String(value) : "";
}

export function OpsInquiryWorkflow({
  id,
  status,
  followUpNote,
  nextFollowUpAt,
  quoteDraft,
  suggestedFollowUpNote,
  suggestedQuoteNotes,
}: OpsInquiryWorkflowProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const effectiveFollowUpNote = followUpNote ?? suggestedFollowUpNote ?? "";
  const effectiveQuoteNotes = quoteDraft?.notes ?? suggestedQuoteNotes ?? "";

  if (!mounted) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: String(data.get("status") ?? ""),
          followUpNote: String(data.get("followUpNote") ?? ""),
          nextFollowUpAt: String(data.get("nextFollowUpAt") ?? ""),
          monthlyFee: String(data.get("monthlyFee") ?? ""),
          inboundFee: String(data.get("inboundFee") ?? ""),
          storageFee: String(data.get("storageFee") ?? ""),
          outboundFee: String(data.get("outboundFee") ?? ""),
          returnFee: String(data.get("returnFee") ?? ""),
          fbaFee: String(data.get("fbaFee") ?? ""),
          valueAddedFee: String(data.get("valueAddedFee") ?? ""),
          validUntil: String(data.get("validUntil") ?? ""),
          quoteNotes: String(data.get("quoteNotes") ?? ""),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败，请稍后再试。");
      setMessage("已保存报价和跟进状态");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmit}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ReceiptText size={16} className="text-[#0E7490]" />
            报价跟进
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">推进询盘状态，记录报价、有效期和下次跟进时间。</p>
        </div>
        {quoteDraft?.updatedAt ? <span className="text-xs font-semibold text-slate-500">报价方案已保存</span> : null}
      </div>

      {suggestedFollowUpNote || suggestedQuoteNotes ? (
        <div className="mt-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950">
          <p className="font-semibold text-slate-950">系统建议</p>
          {suggestedFollowUpNote ? <p className="mt-1">跟进备注：{suggestedFollowUpNote}</p> : null}
          {suggestedQuoteNotes ? <p className="mt-1">报价说明：{suggestedQuoteNotes}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="跟进状态">
          <select className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={status} name="status">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="下次跟进日期">
          <input className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={nextFollowUpAt ?? ""} name="nextFollowUpAt" type="date" />
        </Field>
        <Field label="报价有效期">
          <input className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={quoteDraft?.validUntil ?? ""} name="validUntil" type="date" />
        </Field>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="月度总报价 GBP">
          <input className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={moneyDefault(quoteDraft?.monthlyFee)} min="0" name="monthlyFee" step="0.01" type="number" />
        </Field>
        <Field label="入库费">
          <input className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={moneyDefault(quoteDraft?.inboundFee)} min="0" name="inboundFee" step="0.01" type="number" />
        </Field>
        <Field label="仓储费">
          <input className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={moneyDefault(quoteDraft?.storageFee)} min="0" name="storageFee" step="0.01" type="number" />
        </Field>
        <Field label="出库操作费">
          <input className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={moneyDefault(quoteDraft?.outboundFee)} min="0" name="outboundFee" step="0.01" type="number" />
        </Field>
        <Field label="退货处理费">
          <input className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={moneyDefault(quoteDraft?.returnFee)} min="0" name="returnFee" step="0.01" type="number" />
        </Field>
        <Field label="FBA Prep 费">
          <input className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={moneyDefault(quoteDraft?.fbaFee)} min="0" name="fbaFee" step="0.01" type="number" />
        </Field>
        <Field label="增值服务费">
          <input className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={moneyDefault(quoteDraft?.valueAddedFee)} min="0" name="valueAddedFee" step="0.01" type="number" />
        </Field>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="报价说明">
          <textarea className="min-h-24 rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={effectiveQuoteNotes} name="quoteNotes" />
        </Field>
        <Field label="客服跟进备注">
          <textarea className="min-h-24 rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={effectiveFollowUpNote} name="followUpNote" />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {submitting ? "保存中" : "保存报价跟进"}
        </button>
        {message ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} /> {message}
          </span>
        ) : null}
        {error ? <span className="text-sm font-semibold text-rose-600">{error}</span> : null}
      </div>
    </form>
  );
}
