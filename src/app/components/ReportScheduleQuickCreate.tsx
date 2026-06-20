"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";

type QuickScheduleView = {
  id: string;
  name: string;
  description: string;
};

type Props = {
  views: QuickScheduleView[];
};

function splitRecipients(value: string) {
  return value
    .split(/[,\n，；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ReportScheduleQuickCreate({ views }: Props) {
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [activeViewId, setActiveViewId] = useState("");
  const [isPending, startTransition] = useTransition();

  function createSchedule(view: QuickScheduleView) {
    const recipientList = splitRecipients(recipients);
    setMessage("");
    setActiveViewId(view.id);
    startTransition(async () => {
      const response = await fetch("/api/ops/reports/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewId: view.id,
          name: `${view.name} 每日发送`,
          cadence: "daily",
          recipients: recipientList,
          status: recipientList.length > 0 ? "active" : "paused",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(payload.error || "定时报表创建失败，请稍后重试。");
        return;
      }

      setMessage(recipientList.length > 0 ? `已创建并启用：${view.name}。` : `已创建草稿：${view.name}，补充收件人后可启用。`);
    });
  }

  return (
    <div className="mt-3 rounded-md border border-cyan-200 bg-white p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <CalendarClock size={15} className="text-cyan-700" />
            一键创建每日发送
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">填写邮箱后可直接启用；不填邮箱会先保存为暂停状态，方便稍后补收件人。</p>
        </div>
        <input
          className="min-h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-700 outline-none focus:border-cyan-500 lg:max-w-sm"
          onChange={(event) => setRecipients(event.target.value)}
          placeholder="收件人邮箱，多个用逗号分隔"
          value={recipients}
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {views.map((view) => (
          <button
            className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left text-xs hover:border-cyan-300 hover:bg-cyan-50 disabled:opacity-60"
            disabled={isPending}
            key={view.id}
            onClick={() => createSchedule(view)}
            type="button"
          >
            <span className="block font-semibold text-slate-950">{isPending && activeViewId === view.id ? "创建中..." : view.name}</span>
            <span className="mt-1 block leading-5 text-slate-500">{view.description}</span>
          </button>
        ))}
      </div>
      {message ? <p className="mt-3 text-xs font-semibold text-cyan-800">{message}</p> : null}
    </div>
  );
}
