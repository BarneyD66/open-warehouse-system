"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, Loader2, RotateCcw, XCircle } from "lucide-react";
import type { SystemAlert } from "@/lib/systemAlertStore";

type Props = {
  alert: Pick<SystemAlert, "id" | "handlingStatus" | "handlingNote">;
};

type AlertAction = "acknowledge" | "snooze" | "resolve" | "reopen";

const actionMeta: Record<AlertAction, { label: string; className: string }> = {
  acknowledge: { label: "确认跟进", className: "border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50" },
  snooze: { label: "搁置24小时", className: "border-amber-200 bg-white text-amber-800 hover:bg-amber-50" },
  resolve: { label: "关闭告警", className: "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50" },
  reopen: { label: "重新打开", className: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" },
};

function ActionIcon({ action, pending }: { action: AlertAction; pending: boolean }) {
  if (pending) return <Loader2 className="animate-spin" size={13} />;
  if (action === "acknowledge") return <CheckCircle2 size={13} />;
  if (action === "snooze") return <Clock3 size={13} />;
  if (action === "resolve") return <XCircle size={13} />;
  return <RotateCcw size={13} />;
}

export function SystemAlertActions({ alert }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState(alert.handlingNote ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function submit(action: AlertAction) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/ops/system/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id, action, note, snoozeHours: action === "snooze" ? 24 : undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "告警处理失败，请稍后重试。");
        return;
      }
      setMessage(action === "resolve" ? "告警已关闭。" : action === "snooze" ? "告警已搁置 24 小时。" : action === "reopen" ? "告警已重新打开。" : "告警已确认跟进。");
      router.refresh();
    });
  }

  const actions: AlertAction[] = alert.handlingStatus === "resolved" ? ["reopen"] : ["acknowledge", "snooze", "resolve"];

  return (
    <div className="mt-3 grid gap-2">
      <input
        className="min-h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNote(event.target.value)}
        placeholder="处理备注，例如已联系仓库、等待承运商回复"
        value={note}
      />
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold disabled:opacity-60 ${actionMeta[action].className}`}
            disabled={isPending}
            key={action}
            onClick={() => submit(action)}
            type="button"
          >
            <ActionIcon action={action} pending={isPending} />
            {actionMeta[action].label}
          </button>
        ))}
      </div>
      {message ? <p className="text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
