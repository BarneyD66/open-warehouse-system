"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, CreditCard, FileText } from "lucide-react";
import type { BillingRecord } from "@/lib/warehouseCoreStore";

type CustomerBillingAction = "confirm" | "dispute" | "submit_payment" | "request_invoice";

type Props = {
  record: BillingRecord;
};

export function CustomerBillingActions({ record }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState("");

  function submit(action: CustomerBillingAction) {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/billing/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message, paymentReference }),
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
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      {record.status === "paid" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <span className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={15} />
            付款已复核
          </span>
        </div>
      ) : null}

      {record.status === "payment_submitted" ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
          已提交付款凭证，等待运营复核。{record.paymentReference ? `参考号：${record.paymentReference}` : null}
        </div>
      ) : null}

      {record.status === "confirmed" ? (
        <div className="grid gap-2">
          <label className="text-xs font-semibold text-slate-500" htmlFor={`payment-${record.id}`}>
            付款参考号
          </label>
          <input
            className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500"
            id={`payment-${record.id}`}
            onChange={(event) => setPaymentReference(event.target.value)}
            placeholder="例如银行流水号、转账参考号"
            value={paymentReference}
          />
          <textarea
            className="min-h-20 rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-cyan-500"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="补充付款说明，可选"
            value={message}
          />
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-fit"
            disabled={isPending}
            onClick={() => submit("submit_payment")}
            type="button"
          >
            <CreditCard size={16} />
            提交付款凭证
          </button>
        </div>
      ) : null}

      {!["paid", "payment_submitted", "confirmed"].includes(record.status) ? (
        <div className="grid gap-2">
          <textarea
            className="min-h-20 rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-cyan-500"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="确认或提出异议时，可填写说明"
            value={message}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={isPending}
              onClick={() => submit("confirm")}
              type="button"
            >
              <CheckCircle2 size={16} />
              确认账单
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              disabled={isPending}
              onClick={() => submit("dispute")}
              type="button"
            >
              <AlertCircle size={16} />
              提出异议
            </button>
          </div>
        </div>
      ) : null}

      <InvoiceRequestAction isPending={isPending} onRequest={() => submit("request_invoice")} record={record} />
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}

function InvoiceRequestAction({ record, isPending, onRequest }: { record: BillingRecord; isPending: boolean; onRequest: () => void }) {
  if (record.invoiceStatus === "issued") {
    return <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">发票已开具</p>;
  }

  if (record.invoiceStatus === "requested") {
    return <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">已申请开票，等待运营处理</p>;
  }

  if (record.invoiceStatus === "voided") {
    return <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">发票已作废，请联系运营重新处理</p>;
  }

  return (
    <button
      className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60 sm:w-fit"
      disabled={isPending}
      onClick={onRequest}
      type="button"
    >
      <FileText size={16} />
      申请开票
    </button>
  );
}
