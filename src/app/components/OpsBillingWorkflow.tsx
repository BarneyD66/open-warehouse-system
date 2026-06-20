"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, Save, XCircle } from "lucide-react";
import type { BillingRecord } from "@/lib/warehouseCoreStore";

type Props = {
  id: string;
  status: BillingRecord["status"];
  reviewNote?: string;
  paymentReference?: string;
};

const statusOptions: Array<{ value: BillingRecord["status"]; label: string }> = [
  { value: "pending_confirmation", label: "待客户确认" },
  { value: "confirmed", label: "客户已确认" },
  { value: "payment_submitted", label: "付款待复核" },
  { value: "paid", label: "已付款" },
  { value: "disputed", label: "费用异议" },
];

export function OpsBillingWorkflow({ id, status, reviewNote, paymentReference }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<BillingRecord["status"]>(status);
  const [note, setNote] = useState(reviewNote ?? "");
  const [reference, setReference] = useState(paymentReference ?? "");
  const [error, setError] = useState("");

  function submit(payload: Record<string, unknown>) {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/billing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "保存失败，请稍后重试。");
        return;
      }

      router.refresh();
    });
  }

  function save() {
    submit({ status: nextStatus, reviewNote: note });
  }

  function reviewPayment(action: "mark_paid" | "reject_payment" | "resolve_dispute" | "reopen") {
    submit({ action, reviewNote: note, paymentReference: reference });
  }

  const canRejectPayment = status === "payment_submitted";
  const canResolveDispute = status === "disputed";

  return (
    <div className="grid min-w-[260px] gap-2">
      <select
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNextStatus(event.target.value as BillingRecord["status"])}
        value={nextStatus}
      >
        {statusOptions.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <textarea
        className="min-h-16 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNote(event.target.value)}
        placeholder="复核备注"
        value={note}
      />
      <input
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setReference(event.target.value)}
        placeholder="付款参考号 / 银行流水号"
        value={reference}
      />
      <button
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        disabled={isPending}
        onClick={save}
        type="button"
      >
        <Save size={14} />
        保存复核
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          disabled={isPending}
          onClick={() => reviewPayment("mark_paid")}
          type="button"
        >
          <CheckCircle2 size={14} />
          确认到账
        </button>
        <button
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          disabled={isPending || !canRejectPayment}
          onClick={() => reviewPayment("reject_payment")}
          type="button"
        >
          <XCircle size={14} />
          驳回付款
        </button>
        <button
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
          disabled={isPending || !canResolveDispute}
          onClick={() => reviewPayment("resolve_dispute")}
          type="button"
        >
          <CheckCircle2 size={14} />
          解除异议
        </button>
        <button
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          disabled={isPending}
          onClick={() => reviewPayment("reopen")}
          type="button"
        >
          <RotateCcw size={14} />
          重新打开
        </button>
      </div>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
