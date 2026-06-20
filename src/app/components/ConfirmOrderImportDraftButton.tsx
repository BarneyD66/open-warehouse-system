"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

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

export function CancelOrderImportDraftButton({ batchId, disabled }: { batchId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function cancelDraft() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_order_import_draft", id: batchId, reason: "运营在导入详情页取消同步预检草稿" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "取消草稿失败，请刷新后再试。");
        return;
      }
      setMessage("草稿已取消，不会再生成出库单。");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || isPending}
        onClick={cancelDraft}
        type="button"
      >
        <XCircle size={16} />
        {isPending ? "正在取消" : "取消草稿"}
      </button>
      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
