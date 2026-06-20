"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellRing, Loader2 } from "lucide-react";

type GenerateSummary = {
  staffItems?: number;
  customerItems?: number;
  customerSelfServiceDigest?: number;
  customerSelfServiceOverdue?: number;
  generated?: number;
  queued?: number;
  blocked?: number;
};

export function OpsCustomerSelfServiceReminderButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function generateDueNotifications() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/notifications/generate-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200, includeCustomers: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; summary?: GenerateSummary };
      if (!response.ok) {
        setError(payload.error || "生成客户提醒失败，请稍后重试。");
        return;
      }
      const summary = payload.summary ?? {};
      setMessage(`已刷新提醒：客户待办 ${summary.customerItems ?? 0} 条，自助摘要 ${summary.customerSelfServiceDigest ?? 0} 条，超时 ${summary.customerSelfServiceOverdue ?? 0} 条，新投递 ${summary.generated ?? 0} 条，阻塞 ${summary.blocked ?? 0} 条。`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <button
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isPending}
        onClick={generateDueNotifications}
        type="button"
      >
        {isPending ? <Loader2 className="animate-spin" size={14} /> : <BellRing size={14} />}
        生成到期提醒
      </button>
      {message ? <p className="max-w-xs text-xs leading-5 text-emerald-700">{message}</p> : null}
      {error ? <p className="max-w-xs text-xs leading-5 text-rose-700">{error}</p> : null}
    </div>
  );
}
