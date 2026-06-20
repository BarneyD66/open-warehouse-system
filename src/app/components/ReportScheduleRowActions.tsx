"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Pause, Play, RefreshCw, Save } from "lucide-react";

type ScheduleActionRow = {
  id: string;
  viewId: string;
  name: string;
  cadenceValue: "daily" | "weekly" | "monthly";
  recipientList: string[];
  statusValue: "active" | "paused" | "archived";
};

type Props = {
  row: ScheduleActionRow;
};

function splitRecipients(value: string) {
  return value
    .split(/[,\n，；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ReportScheduleRowActions({ row }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cadence, setCadence] = useState(row.cadenceValue);
  const [recipients, setRecipients] = useState(row.recipientList.join(", "));
  const [message, setMessage] = useState("");

  function updateSchedule(status = row.statusValue) {
    const recipientList = splitRecipients(recipients);
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/ops/reports/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          viewId: row.viewId,
          name: row.name,
          cadence,
          recipients: recipientList,
          status,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(payload.error || "定时报表更新失败，请稍后重试。");
        return;
      }

      setMessage(status === "active" ? "已启用定时报表。" : status === "paused" ? "已暂停定时报表。" : status === "archived" ? "已归档定时报表。" : "已保存定时报表。");
      router.refresh();
    });
  }

  function runNow() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/ops/reports/schedules/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, scheduleId: row.id }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(payload.error || "定时报表立即执行失败，请稍后重试。");
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as { sent?: number; skipped?: number; failed?: number };
      setMessage(`已执行：发送 ${payload.sent ?? 0}，待配置 ${payload.skipped ?? 0}，失败 ${payload.failed ?? 0}。`);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
      <div className="grid gap-2 lg:grid-cols-[120px_1fr_auto]">
        <select className="min-h-9 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setCadence(event.target.value as typeof cadence)} value={cadence}>
          <option value="daily">每日</option>
          <option value="weekly">每周</option>
          <option value="monthly">每月</option>
        </select>
        <input
          className="min-h-9 rounded-md border border-slate-200 px-3 text-xs text-slate-700 outline-none focus:border-cyan-500"
          onChange={(event) => setRecipients(event.target.value)}
          placeholder="收件人邮箱，多个用逗号分隔"
          value={recipients}
        />
        <div className="grid grid-cols-5 gap-2">
          <button className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isPending} onClick={() => updateSchedule(row.statusValue)} type="button">
            <Save size={13} />
            保存
          </button>
          <button className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60" disabled={isPending} onClick={() => updateSchedule("active")} type="button">
            <Play size={13} />
            启用
          </button>
          <button className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={isPending} onClick={() => updateSchedule("paused")} type="button">
            <Pause size={13} />
            暂停
          </button>
          <button className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending} onClick={runNow} type="button">
            <RefreshCw size={13} />
            执行
          </button>
          <button className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60" disabled={isPending} onClick={() => updateSchedule("archived")} type="button">
            <Archive size={13} />
            归档
          </button>
        </div>
      </div>
      {message ? <p className="mt-2 text-xs font-semibold text-cyan-800">{message}</p> : null}
    </div>
  );
}
