"use client";

import { CheckCircle2, Clock3, MessageSquare, XCircle } from "lucide-react";
import type { ApprovalTimelineEvent } from "@/lib/warehouseCoreStore";

type Props = {
  events?: ApprovalTimelineEvent[];
  title?: string;
  emptyText?: string;
  compact?: boolean;
};

const toneClass: Record<ApprovalTimelineEvent["action"], string> = {
  submitted: "border-cyan-200 bg-cyan-50 text-cyan-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  locked: "border-slate-300 bg-slate-100 text-slate-700",
  unlocked: "border-amber-200 bg-amber-50 text-amber-800",
  commented: "border-slate-200 bg-white text-slate-700",
};

function iconFor(action: ApprovalTimelineEvent["action"]) {
  if (action === "approved" || action === "locked") return <CheckCircle2 size={14} />;
  if (action === "rejected") return <XCircle size={14} />;
  if (action === "submitted") return <Clock3 size={14} />;
  return <MessageSquare size={14} />;
}

function dateText(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function BillingTimeline({ events = [], title = "处理进度", emptyText = "暂无处理记录", compact = false }: Props) {
  const rows = [...events].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  return (
    <section className={compact ? "rounded-md border border-slate-200 bg-white p-3" : "rounded-md border border-slate-200 bg-slate-50 p-3"}>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {rows.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {rows.map((event) => (
            <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 sm:grid-cols-[auto_1fr]" key={event.id}>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${toneClass[event.action]}`}>{iconFor(event.action)}</span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{event.label}</p>
                  <span className="font-mono text-[11px] text-slate-500">{dateText(event.occurredAt)}</span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-600">{event.actor}</span>
                </div>
                {event.note ? <p className="mt-1 text-slate-600">{event.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{emptyText}</p>
      )}
    </section>
  );
}
