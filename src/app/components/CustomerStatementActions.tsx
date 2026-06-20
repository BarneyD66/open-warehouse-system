"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, CreditCard, FileText } from "lucide-react";
import type { BillingRecord } from "@/lib/warehouseCoreStore";

type StatementAction = "confirm" | "dispute" | "submit_payment" | "request_invoice";

type Props = {
  month: string;
  records: BillingRecord[];
};

export function CustomerStatementActions({ month, records }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState("");

  const allPaid = records.every((record) => record.status === "paid");
  const hasPaymentSubmitted = records.some((record) => record.status === "payment_submitted");
  const hasDispute = records.some((record) => record.status === "disputed");
  const paymentRejection = records.find((record) => record.paymentRejectionNote || record.statementPaymentRejectionNote);
  const canSubmitPayment = records.some((record) => ["confirmed", "pending_confirmation", "draft"].includes(record.status));

  function submit(action: StatementAction) {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/billing/statement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, action, message, paymentReference }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "操作失败，请稍后重试。");
        return;
      }

      setMessage("");
      setPaymentReference("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">月结单确认</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">按整月确认费用、提交付款参考号或申请开票，系统会同步更新本月所有明细账单。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allPaid ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={16} />
              已完成收款
            </span>
          ) : null}
          {hasPaymentSubmitted ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800">
              <CreditCard size={16} />
              付款待复核
            </span>
          ) : null}
          {hasDispute ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-800">
              <AlertCircle size={16} />
              有费用异议
            </span>
          ) : null}
          {paymentRejection ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800">
              <AlertCircle size={16} />
              付款被驳回
            </span>
          ) : null}
        </div>
      </div>

      {paymentRejection ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          付款复核未通过：{paymentRejection.paymentRejectionNote || paymentRejection.statementPaymentRejectionNote}
        </div>
      ) : null}

      {!allPaid ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="grid gap-2">
            <textarea
              className="min-h-24 rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-cyan-500"
              onChange={(event) => setMessage(event.target.value)}
              placeholder="确认说明、异议原因或开票备注"
              value={message}
            />
            <input
              className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500"
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="付款参考号，提交付款时必填"
              value={paymentReference}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => submit("confirm")} type="button">
              <CheckCircle2 size={16} />
              确认整月费用
            </button>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending || !canSubmitPayment} onClick={() => submit("submit_payment")} type="button">
              <CreditCard size={16} />
              提交付款
            </button>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isPending} onClick={() => submit("request_invoice")} type="button">
              <FileText size={16} />
              申请开票
            </button>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" disabled={isPending} onClick={() => submit("dispute")} type="button">
              <AlertCircle size={16} />
              提出异议
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}
