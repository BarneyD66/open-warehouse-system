"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, RotateCcw, ShieldAlert } from "lucide-react";

type SecurityAction = "rescan" | "mark_clean" | "block";

type Props = {
  documentId: string;
  scanStatus?: "pending" | "clean" | "blocked";
};

const actionCopy: Record<SecurityAction, { label: string; success: string; tone: string }> = {
  rescan: {
    label: "复扫",
    success: "安全复扫已完成。",
    tone: "border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50",
  },
  mark_clean: {
    label: "放行",
    success: "文件已人工放行。",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },
  block: {
    label: "拦截",
    success: "文件已人工拦截。",
    tone: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
  },
};

function iconFor(action: SecurityAction, pending: boolean) {
  if (pending) return <Loader2 className="animate-spin" size={13} />;
  if (action === "rescan") return <RotateCcw size={13} />;
  if (action === "mark_clean") return <CheckCircle2 size={13} />;
  return <ShieldAlert size={13} />;
}

export function DocumentSecurityActions({ documentId, scanStatus }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<SecurityAction | "">("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function submit(action: SecurityAction) {
    setMessage("");
    setError("");
    setPendingAction(action);
    startTransition(async () => {
      const response = await fetch(`/api/ops/documents/${encodeURIComponent(documentId)}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setPendingAction("");
      if (!response.ok) {
        setError(payload.error || "文件安全状态处理失败，请稍后重试。");
        return;
      }
      setMessage(actionCopy[action].success);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${actionCopy.rescan.tone}`}
          disabled={isPending}
          onClick={() => submit("rescan")}
          type="button"
        >
          {iconFor("rescan", pendingAction === "rescan")}
          复扫
        </button>
        {scanStatus !== "clean" ? (
          <button
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${actionCopy.mark_clean.tone}`}
            disabled={isPending}
            onClick={() => submit("mark_clean")}
            type="button"
          >
            {iconFor("mark_clean", pendingAction === "mark_clean")}
            放行
          </button>
        ) : null}
        {scanStatus !== "blocked" ? (
          <button
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${actionCopy.block.tone}`}
            disabled={isPending}
            onClick={() => submit("block")}
            type="button"
          >
            {iconFor("block", pendingAction === "block")}
            拦截
          </button>
        ) : null}
      </div>
      {message ? <p className="text-right text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="max-w-[14rem] text-right text-xs leading-5 text-rose-700">{error}</p> : null}
    </div>
  );
}
