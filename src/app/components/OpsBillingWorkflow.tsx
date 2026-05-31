"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import type { BillingRecord } from "@/lib/warehouseCoreStore";

type Props = {
  id: string;
  status: BillingRecord["status"];
  reviewNote?: string;
};

const statusOptions: Array<{ value: BillingRecord["status"]; label: string }> = [
  { value: "pending_confirmation", label: "待客户确认" },
  { value: "confirmed", label: "客户已确认" },
  { value: "payment_submitted", label: "付款待复核" },
  { value: "paid", label: "已付款" },
  { value: "disputed", label: "费用异议" },
];

export function OpsBillingWorkflow({ id, status, reviewNote }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<BillingRecord["status"]>(status);
  const [note, setNote] = useState(reviewNote ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/billing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reviewNote: note }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "保存失败，请稍后重试。");
        return;
      }

      router.refresh();
    });
  }

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
      <button
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        disabled={isPending}
        onClick={save}
        type="button"
      >
        <Save size={14} />
        保存复核
      </button>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
