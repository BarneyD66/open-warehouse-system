"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

export function ConfirmOrderImportDraftButton({ batchId, disabled }: { batchId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function confirmDraft() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_order_import_draft", id: batchId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { batch?: { createdOrders?: number; skippedRows?: number }; error?: string };
      if (!response.ok) {
        setError(payload.error || "确认导入失败，请刷新后再试。");
        return;
      }
      setMessage(`已创建 ${payload.batch?.createdOrders ?? 0} 个出库单，${payload.batch?.skippedRows ?? 0} 行未导入。`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-cyan-900 px-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || isPending}
        onClick={confirmDraft}
        type="button"
      >
        <CheckCircle2 size={16} />
        {isPending ? "正在导入" : "确认导入可创建行"}
      </button>
      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
