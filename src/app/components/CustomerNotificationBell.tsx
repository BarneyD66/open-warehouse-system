"use client";

import { SubmissionButton, submissionFetch } from "./SubmissionFeedback";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, CheckCircle2, Info, Loader2, X } from "lucide-react";
import type { NotificationItem, NotificationSeverity } from "@/lib/notificationStore";

const severityClass: Record<NotificationSeverity, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-cyan-200 bg-cyan-50 text-cyan-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === "critical" || severity === "warning") return <AlertTriangle size={15} />;
  if (severity === "success") return <CheckCircle2 size={15} />;
  return <Info size={15} />;
}

function dateText(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

async function requestNotifications() {
  try {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return null;
    const result = (await response.json()) as { items?: NotificationItem[] };
    return Array.isArray(result.items) ? result.items : [];
  } catch {
    return null;
  }
}

export function CustomerNotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void requestNotifications().then((result) => {
      if (!active) return;
      if (result) setItems(result);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const unreadCount = items.filter((item) => item.unread).length;
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  function openDrawer() {
    setIsOpen(true);
    if (items.length === 0) setIsLoading(true);
    void requestNotifications().then((result) => {
      if (result) setItems(result);
      setIsLoading(false);
    });
  }

  function markRead(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id }),
      keepalive: true,
    });
  }

  async function markAllRead() {

    const ids=items.filter((item) => item.unread).map((item) => item.id);
    if (ids.length===0) return false;
    await submissionFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all", ids }),
      keepalive: true,
    });
    setItems((current) => current.map((item) => ({ ...item, unread: false })));

    return true;

  }

  return (
    <>
      <button
        aria-controls="customer-notification-drawer"
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `消息中心，${unreadCount} 条未读` : "消息中心"}
        className={`relative isolate inline-flex h-11 w-11 overflow-visible rounded-lg border shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 ${
          isOpen
            ? "border-cyan-300 bg-cyan-50 text-cyan-800"
            : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
        }`}
        onClick={openDrawer}
        type="button"
      >
        <Bell aria-hidden="true" className="m-auto" size={19} />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="pointer-events-none absolute right-0.5 top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[13px] font-bold leading-none text-white ring-2 ring-white shadow-[0_2px_6px_rgba(225,29,72,0.35)]">
            {unreadLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? createPortal(
        <div className="fixed inset-0 z-[100] isolate flex justify-end overscroll-contain" role="presentation">
          <button aria-label="关闭消息中心" className="absolute inset-0 bg-slate-950/35" onClick={() => setIsOpen(false)} type="button" />
          <aside aria-labelledby="customer-notification-title" aria-modal="true" className="relative flex h-dvh w-full min-w-0 max-w-md flex-col overflow-hidden bg-white shadow-2xl sm:w-[28rem]" id="customer-notification-drawer" role="dialog">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950" id="customer-notification-title">
                  <Bell className="text-cyan-700" size={18} />
                  消息中心
                </h2>
                <p className="mt-1 text-xs text-slate-500">业务异常、待处理事项和最新进度会显示在这里。</p>
              </div>
              <button aria-label="关闭消息中心" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setIsOpen(false)} type="button">
                <X size={17} />
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">{unreadCount > 0 ? `${unreadCount} 条未读` : "暂无未读消息"}</span>
              {unreadCount > 0 ? (
                <SubmissionButton className="text-xs font-semibold text-cyan-700 hover:text-cyan-900" onClick={markAllRead} type="button">
                  全部标记已读
                </SubmissionButton>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {isLoading && items.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="animate-spin" size={17} />
                  正在加载消息
                </div>
              ) : items.length > 0 ? (
                <div className="grid gap-2">
                  {items.slice(0, 12).map((item) => (
                    <article className={`rounded-lg border p-3 ${item.unread ? "border-cyan-200 bg-cyan-50/50" : "border-slate-200 bg-white"}`} key={item.id}>
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${severityClass[item.severity]}`}>
                          <SeverityIcon severity={item.severity} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                            {item.unread ? <span aria-label="未读" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-500" /> : null}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-400">{dateText(item.createdAt)}</span>
                            <Link className="shrink-0 text-xs font-semibold text-cyan-700 hover:text-cyan-900" href={item.href} onClick={() => { markRead(item.id); setIsOpen(false); }}>
                              立即查看
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
                  暂无消息，有需要处理的业务时会在这里提醒您。
                </div>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
