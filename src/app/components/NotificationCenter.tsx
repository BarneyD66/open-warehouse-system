"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
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

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === "critical" || severity === "warning") return <AlertTriangle size={16} />;
  if (severity === "success") return <CheckCircle2 size={16} />;
  return <Info size={16} />;
}

export function NotificationCenter({ title, emptyText, items, compact = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [closingId, setClosingId] = useState("");

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

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Bell size={17} className="text-[#0E7490]" />
          {title}
        </h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{items.length}</span>
      </div>
      <div className={compact ? "divide-y divide-slate-100" : "grid gap-2 p-3"}>
        {items.length > 0 ? (
          items.slice(0, compact ? 5 : 12).map((item) => (
            <div className={compact ? "grid gap-2 px-4 py-3" : "rounded-md border border-slate-200 bg-slate-50 p-3"} key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${severityClass[item.severity]}`}>
                      <SeverityIcon severity={item.severity} />
                      {item.severity === "critical" ? "紧急" : item.severity === "warning" ? "待处理" : item.severity === "success" ? "已完成" : "提醒"}
                    </span>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{item.sourceId}</p>
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
              <Link className="inline-flex w-fit text-xs font-semibold text-cyan-700 hover:text-cyan-900" href={item.href}>
                去处理
              </Link>
            </div>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">{emptyText}</div>
        )}
      </div>
    </section>
  );
}
