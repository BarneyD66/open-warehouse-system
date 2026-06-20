"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, PauseCircle, RotateCcw, Save } from "lucide-react";
import type { CustomerAccountStatus } from "@/lib/customerAccountStore";
import type { DocumentRecord } from "@/lib/documentStore";
import { DocumentUploadPanel } from "./DocumentUploadPanel";

type Props = {
  customerCode: string;
  status: CustomerAccountStatus;
  documents?: DocumentRecord[];
  paymentTermDays?: number;
  creditLimit?: number;
  billingCycle?: "prepaid" | "weekly" | "monthly";
};

const text = {
  unverified: "\u672a\u8ba4\u8bc1",
  verified: "\u5df2\u8ba4\u8bc1",
  paused: "\u6682\u505c",
  verify: "\u8ba4\u8bc1",
  needMore: "\u5f85\u8865",
  pause: "\u6682\u505c",
  saveReview: "\u4fdd\u5b58\u5ba1\u6838",
  saveFailed: "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",
  notePlaceholder: "\u5ba1\u6838\u5907\u6ce8\uff0c\u4f8b\u5982\uff1aVAT \u5df2\u6838\u5bf9\uff0c\u5e73\u53f0\u5e97\u94fa\u5f85\u8865\u3002",
};

const statusOptions: Array<{ value: CustomerAccountStatus; label: string }> = [
  { value: "unverified", label: text.unverified },
  { value: "verified", label: text.verified },
  { value: "paused", label: text.paused },
];

function statusText(status: CustomerAccountStatus) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

export function OpsCustomerStatusWorkflow({ customerCode, status, documents = [], paymentTermDays, creditLimit, billingCycle }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<CustomerAccountStatus>(status);
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [termDays, setTermDays] = useState(String(paymentTermDays ?? 7));
  const [limit, setLimit] = useState(creditLimit === undefined ? "" : String(creditLimit));
  const [cycle, setCycle] = useState<"prepaid" | "weekly" | "monthly">(billingCycle ?? "monthly");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const needsSensitiveConfirm = nextStatus === "paused" || status === "paused";

  function save(statusOverride?: CustomerAccountStatus, noteOverride?: string) {
    const targetStatus = statusOverride ?? nextStatus;
    const reviewNote = noteOverride ?? note;
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/customers/${encodeURIComponent(customerCode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus, note: reviewNote, confirmation, paymentTermDays: termDays, creditLimit: limit, billingCycle: cycle }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || text.saveFailed);
        return;
      }

      setNextStatus(targetStatus);
      setNote("");
      setConfirmation("");
      setMessage(`\u5df2\u66f4\u65b0\u4e3a${statusText(targetStatus)}\u3002`);
      router.refresh();
    });
  }

  function chooseSensitiveStatus(targetStatus: CustomerAccountStatus, prompt: string) {
    setNextStatus(targetStatus);
    setNote("");
    setConfirmation("");
    setMessage("");
    setError(prompt);
  }

  return (
    <div className="grid min-w-[280px] gap-2">
      <div className="grid grid-cols-3 gap-2">
        <button
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          disabled={isPending}
          onClick={() => (status === "paused" ? chooseSensitiveStatus("verified", "恢复客户账号前，请填写恢复原因并输入客户编号确认。") : save("verified", "\u8d44\u6599\u5ba1\u6838\u901a\u8fc7\uff0c\u8d26\u53f7\u5df2\u8ba4\u8bc1\u3002"))}
          type="button"
        >
          <CheckCircle2 size={13} />
          {text.verify}
        </button>
        <button
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          disabled={isPending}
          onClick={() => (status === "paused" ? chooseSensitiveStatus("unverified", "恢复为未认证前，请填写恢复原因并输入客户编号确认。") : save("unverified", "\u8d44\u6599\u9700\u8981\u8865\u5145\uff0c\u8d26\u53f7\u6062\u590d\u4e3a\u672a\u8ba4\u8bc1\u3002"))}
          type="button"
        >
          <RotateCcw size={13} />
          {text.needMore}
        </button>
        <button
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          disabled={isPending}
          onClick={() => chooseSensitiveStatus("paused", "暂停客户账号前，请填写暂停原因并输入客户编号确认。")}
          type="button"
        >
          <PauseCircle size={13} />
          {text.pause}
        </button>
      </div>
      <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNextStatus(event.target.value as CustomerAccountStatus)} value={nextStatus}>
        {statusOptions.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <textarea className="min-h-16 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder={text.notePlaceholder} value={note} />
      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
        <p className="text-[11px] font-semibold text-slate-500">账期与额度</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" min="0" onChange={(event) => setTermDays(event.target.value)} placeholder="账期天数" type="number" value={termDays} />
          <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" min="0" onChange={(event) => setLimit(event.target.value)} placeholder="信用额度 GBP" type="number" value={limit} />
          <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setCycle(event.target.value as "prepaid" | "weekly" | "monthly")} value={cycle}>
            <option value="prepaid">预付</option>
            <option value="weekly">周结</option>
            <option value="monthly">月结</option>
          </select>
        </div>
      </div>
      {needsSensitiveConfirm ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="text-[11px] font-semibold text-amber-900">暂停/恢复客户账号属于敏感操作，请填写原因并输入客户编号确认。</p>
          <input
            className="mt-2 h-9 w-full rounded-md border border-amber-200 bg-white px-2 font-mono text-xs text-slate-800 outline-none focus:border-amber-500"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={`输入 ${customerCode} 确认`}
            value={confirmation}
          />
        </div>
      ) : null}
      <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => save()} type="button">
        {isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
        {text.saveReview}
      </button>
      <DocumentUploadPanel
        category="other"
        customerCode={customerCode}
        documents={documents.filter((document) => document.refType === "approval" && document.refId === `customer-status:${customerCode}`)}
        refId={`customer-status:${customerCode}`}
        refType="approval"
        title="客户状态审批附件"
        uploadEndpoint="/api/ops/documents"
      />
      {message ? <p className="text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
