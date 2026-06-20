"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Bell, CheckCircle2, Info, SlidersHorizontal, X } from "lucide-react";
import type { NotificationItem, NotificationSeverity } from "@/lib/notificationStore";

type Props = {
  title: string;
  emptyText: string;
  items: NotificationItem[];
  compact?: boolean;
};

const severityClass: Record<NotificationSeverity, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-cyan-200 bg-cyan-50 text-cyan-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const slaClass: Record<"normal" | "near_due" | "overdue", string> = {
  overdue: "border-rose-200 bg-rose-50 text-rose-800",
  near_due: "border-amber-200 bg-amber-50 text-amber-800",
  normal: "border-slate-200 bg-white text-slate-600",
};

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === "critical" || severity === "warning") return <AlertTriangle size={16} />;
  if (severity === "success") return <CheckCircle2 size={16} />;
  return <Info size={16} />;
}

function severityLabel(severity: NotificationSeverity) {
  if (severity === "critical") return "紧急";
  if (severity === "warning") return "待处理";
  if (severity === "success") return "已完成";
  return "提醒";
}

function slaLabel(level?: "normal" | "near_due" | "overdue") {
  if (level === "overdue") return "已超时";
  if (level === "near_due") return "即将超时";
  if (level === "normal") return "正常跟进";
  return "";
}

function channelLabel(channel: string) {
  if (channel === "in_app") return "站内信";
  if (channel === "email") return "邮件";
  if (channel === "sms") return "短信";
  if (channel === "wechat") return "微信";
  return channel;
}

function dateText(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function NotificationCenter({ title, emptyText, items, compact = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [closingId, setClosingId] = useState("");
  const [preferenceOpen, setPreferenceOpen] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState("");

  function dismiss(id: string) {
    setClosingId(id);
    startTransition(async () => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", id }),
      });
      if (response.ok) router.refresh();
      setClosingId("");
    });
  }

  function markRead(id: string) {
    startTransition(async () => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", id }),
      });
      if (response.ok) router.refresh();
    });
  }

  function markAllRead() {
    startTransition(async () => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all", ids: items.map((item) => item.id) }),
      });
      if (response.ok) router.refresh();
    });
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreferenceMessage("");
    const formData = new FormData(event.currentTarget);
    const channels = formData.getAll("channels").map(String);
    const severities = formData.getAll("severities").map(String);
    startTransition(async () => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_subscription",
          sources: ["inquiry", "inbound", "billing", "inventory", "outbound", "returns", "logistics", "document", "work_order", "approval", "system"],
          severities,
          channels,
          enabled: true,
        }),
      });
      setPreferenceMessage(response.ok ? "通知偏好已保存" : "通知偏好保存失败");
      if (response.ok) router.refresh();
    });
  }

  const unreadCount = items.filter((item) => item.unread).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Bell size={17} className="text-[#0E7490]" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={() => setPreferenceOpen((value) => !value)} type="button" aria-label="通知偏好">
            <SlidersHorizontal size={15} />
          </button>
          {unreadCount > 0 ? (
            <button className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" disabled={isPending} onClick={markAllRead} type="button">
              未读 {unreadCount}
            </button>
          ) : null}
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{items.length}</span>
        </div>
      </div>
      {preferenceOpen ? (
        <form className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm" onSubmit={savePreferences}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-slate-950">通知偏好</p>
              <p className="mt-1 text-xs text-slate-500">保存后，后续站内信和外部通知会按这些渠道与级别生成。</p>
            </div>
            <button className="inline-flex min-h-9 w-fit items-center justify-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              保存偏好
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-wrap gap-2">
              {[
                ["in_app", "站内信"],
                ["email", "邮件"],
                ["sms", "短信"],
                ["wechat", "微信"],
              ].map(([value, label]) => (
                <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" key={value}>
                  <input defaultChecked={value === "in_app"} name="channels" type="checkbox" value={value} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["critical", "紧急"],
                ["warning", "待处理"],
                ["info", "提醒"],
                ["success", "已完成"],
              ].map(([value, label]) => (
                <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" key={value}>
                  <input defaultChecked={value === "critical" || value === "warning"} name="severities" type="checkbox" value={value} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {preferenceMessage ? <p className="text-xs font-semibold text-cyan-800">{preferenceMessage}</p> : null}
        </form>
      ) : null}
      <div className={compact ? "divide-y divide-slate-100" : "grid gap-2 p-3"}>
        {items.length > 0 ? (
          items.slice(0, compact ? 5 : 12).map((item) => (
            <div className={compact ? "grid gap-2 px-4 py-3" : "rounded-md border border-slate-200 bg-slate-50 p-3"} key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.unread ? <span className="h-2 w-2 rounded-full bg-cyan-500" aria-label="未读" /> : null}
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${severityClass[item.severity]}`}>
                      <SeverityIcon severity={item.severity} />
                      {severityLabel(item.severity)}
                    </span>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{item.sourceId}</span>
                    <span>{dateText(item.createdAt)}</span>
                    {item.slaLevel ? <span className={`rounded-md border px-2 py-1 font-semibold ${slaClass[item.slaLevel]}`}>{slaLabel(item.slaLevel)}</span> : null}
                    {item.channels?.length ? <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600">{item.channels.map(channelLabel).join("、")}</span> : null}
                  </div>
                </div>
                <button
                  aria-label="关闭待办"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  disabled={isPending && closingId === item.id}
                  onClick={() => dismiss(item.id)}
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link className="inline-flex w-fit text-xs font-semibold text-cyan-700 hover:text-cyan-900" href={item.href} onClick={() => markRead(item.id)}>
                  去处理
                </Link>
                {item.unread ? (
                  <button className="inline-flex w-fit text-xs font-semibold text-slate-500 hover:text-slate-800" disabled={isPending} onClick={() => markRead(item.id)} type="button">
                    标记已读
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">{emptyText}</div>
        )}
      </div>
    </section>
  );
}
