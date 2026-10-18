import Link from "next/link";
import { AlertTriangle, ArrowRight, Download, FileCheck2, ListChecks } from "lucide-react";
import type { CustomerSelfServiceAction, CustomerSelfServiceCenterData, CustomerSelfServiceActionSeverity } from "@/lib/customerSelfServiceCenter";

const severityClass: Record<CustomerSelfServiceActionSeverity, string> = {
  "紧急": "border-rose-200 bg-rose-50 text-rose-800",
  "待处理": "border-amber-200 bg-amber-50 text-amber-800",
  "正常": "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function dateText(value?: string) {
  if (!value) return "待更新";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

function SeverityPill({ severity }: { severity: CustomerSelfServiceActionSeverity }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${severityClass[severity]}`}>{severity}</span>;
}

function slaText(item: CustomerSelfServiceAction) {
  if (item.slaLevel === "overdue") return item.overdueHours ? `已超时 ${item.overdueHours} 小时` : "已超时";
  if (item.slaLevel === "near_due") return "即将超时";
  if (item.slaLevel === "normal") return "正常跟进";
  return "";
}

const slaClass: Record<NonNullable<CustomerSelfServiceAction["slaLevel"]>, string> = {
  overdue: "border-rose-200 bg-rose-50 text-rose-800",
  near_due: "border-amber-200 bg-amber-50 text-amber-800",
  normal: "border-slate-200 bg-slate-50 text-slate-600",
};

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ActionRow({ item }: { item: CustomerSelfServiceAction }) {
  return (
    <article className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{item.module}</span>
          <span className="font-mono text-xs font-semibold text-slate-500">{item.sourceId}</span>
          <SeverityPill severity={item.severity} />
          {item.slaLevel ? <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${slaClass[item.slaLevel]}`}>{slaText(item)}</span> : null}
        </div>
        <h3 className="mt-2 text-sm font-semibold text-slate-950">{item.title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">下一步：{item.nextAction}</p>
        <p className="mt-2 text-xs text-slate-400">
          {item.status} / {dateText(item.createdAt)}{item.dueAt ? ` / 截止 ${dateText(item.dueAt)}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {item.downloadableHref ? (
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={item.downloadableHref}>
            下载
            <Download size={14} />
          </Link>
        ) : null}
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800" href={item.href}>
          去处理
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}

export function CustomerSelfServiceActionPanel({ data }: { data: CustomerSelfServiceCenterData }) {
  const visibleActions = data.actions.slice(0, 8);

  return (
    <section className="rounded-lg border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase text-cyan-700">自助中心</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">我的操作清单</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-100 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/self-service/actions?format=csv">
            导出清单
            <Download size={14} />
          </Link>
          <ListChecks size={18} className="text-slate-400" />
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile label="待处理事项" value={data.summary.actionCount} />
          <SummaryTile label="紧急事项" value={data.summary.urgentCount} />
          <SummaryTile label="可下载资料" value={data.summary.downloadableCount} />
          <SummaryTile label="异常/风险" value={data.summary.openExceptions} />
        </div>

        {visibleActions.length > 0 ? (
          <div className="grid gap-3">
            {visibleActions.map((item) => (
              <ActionRow item={item} key={item.id} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <FileCheck2 className="mx-auto text-emerald-600" size={22} />
            <p className="mt-3 text-sm font-semibold text-slate-950">当前没有需要您处理的事项</p>
            <p className="mt-1 text-sm text-slate-500">面单、签收证明、库存报表和费用明细仍可在下载中心自助获取。</p>
          </div>
        )}

        {data.summary.urgentCount > 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <p>存在紧急事项，请优先处理追踪号、逾期账单、物流异常或退货确认；超时事项会进入站内信和邮件提醒队列。</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
