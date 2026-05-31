"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, Unlock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { billingMonthKey, billingMonthLabel } from "@/lib/billingUtils";
import type { BillingRecord, CustomerProfile } from "@/lib/warehouseCoreStore";

type Props = {
  customers: CustomerProfile[];
  records: BillingRecord[];
};

export function OpsBillingStatementLockPanel({ customers, records }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const monthOptions = useMemo(() => [...new Set(records.map((record) => billingMonthKey(record)))].sort((a, b) => b.localeCompare(a)), [records]);
  const customerOptions = useMemo(
    () => customers.filter((customer) => records.some((record) => record.customerCode === customer.customerCode)),
    [customers, records],
  );
  const [month, setMonth] = useState(monthOptions[0] ?? "");
  const [customerCode, setCustomerCode] = useState(customerOptions[0]?.customerCode ?? "");
  const [error, setError] = useState("");

  const scopedRecords = records.filter((record) => record.customerCode === customerCode && billingMonthKey(record) === month);
  const lockedCount = scopedRecords.filter((record) => record.statementStatus === "locked").length;
  const totalAmount = scopedRecords.reduce((sum, record) => sum + record.amount, 0);
  const isLocked = scopedRecords.length > 0 && lockedCount === scopedRecords.length;

  function submit(action: "lock" | "unlock") {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/billing/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerCode, month, action }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "月结状态保存失败，请稍后重试。");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          月份
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setMonth(event.target.value)} value={month}>
            {monthOptions.map((item) => (
              <option key={item} value={item}>
                {billingMonthLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          客户
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setCustomerCode(event.target.value)} value={customerCode}>
            {customerOptions.map((item) => (
              <option key={item.customerCode} value={item.customerCode}>
                {item.companyName} / {item.customerCode}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={isPending || scopedRecords.length === 0 || isLocked}
            onClick={() => submit("lock")}
            type="button"
          >
            <Lock size={15} />
            锁定月结
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={isPending || scopedRecords.length === 0 || !isLocked}
            onClick={() => submit("unlock")}
            type="button"
          >
            <Unlock size={15} />
            解除锁定
          </button>
          {scopedRecords.length > 0 ? (
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/ops/billing/statements/${customerCode}/${month}`}>
              查看月结单
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">{scopedRecords.length} 张账单</span>
        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">£{totalAmount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</span>
        <span className={`rounded-md border px-2 py-1 ${isLocked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {isLocked ? "已锁账" : "未锁账"}
        </span>
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
