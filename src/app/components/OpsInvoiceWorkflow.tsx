"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileCheck2 } from "lucide-react";
import type { BillingInvoiceStatus } from "@/lib/warehouseCoreStore";

type Props = {
  id: string;
  invoiceStatus?: BillingInvoiceStatus;
  invoiceNote?: string;
};

const invoiceOptions: Array<{ value: BillingInvoiceStatus; label: string }> = [
  { value: "not_requested", label: "未申请开票" },
  { value: "requested", label: "已申请开票" },
  { value: "issued", label: "已开票" },
  { value: "voided", label: "已作废" },
];

export function OpsInvoiceWorkflow({ id, invoiceStatus = "not_requested", invoiceNote }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<BillingInvoiceStatus>(invoiceStatus);
  const [note, setNote] = useState(invoiceNote ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/billing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceStatus: nextStatus, invoiceNote: note }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "开票状态保存失败，请稍后重试。");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="mt-3 grid min-w-[260px] gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <select
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNextStatus(event.target.value as BillingInvoiceStatus)}
        value={nextStatus}
      >
        {invoiceOptions.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNote(event.target.value)}
        placeholder="发票号或开票备注"
        value={note}
      />
      <button
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60"
        disabled={isPending}
        onClick={save}
        type="button"
      >
        <FileCheck2 size={14} />
        保存开票状态
      </button>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
