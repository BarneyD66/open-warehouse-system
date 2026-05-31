"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileCheck2, FileX2, RotateCcw, Save } from "lucide-react";

type OpsStatementAction = "mark_paid" | "issue_invoice" | "void_invoice" | "reopen";

type Props = {
  customerCode: string;
  month: string;
};

export function OpsStatementActions({ customerCode, month }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentReference, setPaymentReference] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");

  function submit(action: OpsStatementAction) {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/billing/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerCode, month, action, paymentReference, reviewNote }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "保存失败，请稍后重试。");
        return;
      }

      setPaymentReference("");
      setReviewNote("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">月结单运营处理</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">按整月登记收款、批量开票或撤回付款状态，适合月末对账和财务复核。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => submit("mark_paid")} type="button">
            <Save size={16} />
            登记已收款
          </button>
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending} onClick={() => submit("issue_invoice")} type="button">
            <FileCheck2 size={16} />
            批量已开票
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[260px_1fr_auto]">
        <input
          className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500"
          onChange={(event) => setPaymentReference(event.target.value)}
          placeholder="收款参考号，可选"
          value={paymentReference}
        />
        <input
          className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500"
          onChange={(event) => setReviewNote(event.target.value)}
          placeholder="复核备注，可选"
          value={reviewNote}
        />
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isPending} onClick={() => submit("reopen")} type="button">
            <RotateCcw size={16} />
            撤回收款
          </button>
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" disabled={isPending} onClick={() => submit("void_invoice")} type="button">
            <FileX2 size={16} />
            作废开票
          </button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}
