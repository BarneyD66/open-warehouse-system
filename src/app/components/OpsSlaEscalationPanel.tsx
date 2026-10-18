import Link from "next/link";
import { AlertTriangle, BellRing, Clock3 } from "lucide-react";
import type { NotificationItem } from "@/lib/notificationStore";

type Props = {
  items: NotificationItem[];
};

const sourceLabel: Partial<Record<NotificationItem["source"], string>> = {
  inquiry: "询盘",
  inbound: "入库",
  billing: "费用",
  inventory: "库存",
  outbound: "出库",
  returns: "退货",
  logistics: "物流",
  document: "资料",
  work_order: "工单",
  approval: "审批",
  system: "系统",
};

function levelLabel(item: NotificationItem) {
  if (item.slaLevel === "overdue") return "已超时";
  if (item.slaLevel === "near_due") return "即将超时";
  if (item.severity === "critical") return "高优先级";
  return "待跟进";
}

function levelClass(item: NotificationItem) {
  if (item.slaLevel === "overdue" || item.severity === "critical") return "border-rose-200 bg-rose-50 text-rose-800";
  if (item.slaLevel === "near_due" || item.severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function dateText(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function OpsSlaEscalationPanel({ items }: Props) {
  const riskItems = items
    .filter((item) => item.severity === "critical" || item.slaLevel === "overdue" || item.slaLevel === "near_due")
    .sort((a, b) => {
      const score = (item: NotificationItem) => (item.slaLevel === "overdue" ? 4 : item.severity === "critical" ? 3 : item.slaLevel === "near_due" ? 2 : 1);
      return score(b) - score(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  const overdueCount = riskItems.filter((item) => item.slaLevel === "overdue").length;
  const nearDueCount = riskItems.filter((item) => item.slaLevel === "near_due").length;
  const criticalCount = riskItems.filter((item) => item.severity === "critical").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <BellRing size={18} className="text-[#0E7490]" />
            SLA 升级看板
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">把超时、即将超时和高优先级待办集中展示，方便老板和运营快速判断今天最该先处理什么。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-rose-700">高优先级</p>
            <p className="mt-1 text-xl font-semibold text-rose-950">{criticalCount}</p>
          </div>
          <div className="rounded-md border border-rose-100 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold text-rose-700">已超时</p>
            <p className="mt-1 text-xl font-semibold text-rose-950">{overdueCount}</p>
          </div>
          <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-800">即将超时</p>
            <p className="mt-1 text-xl font-semibold text-amber-950">{nearDueCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {riskItems.slice(0, 6).map((item) => (
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={item.id}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${levelClass(item)}`}>
                  {item.slaLevel === "overdue" ? <AlertTriangle size={14} /> : <Clock3 size={14} />}
                  {levelLabel(item)}
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{sourceLabel[item.source] ?? item.source}</span>
                {item.customerCode ? <span className="font-mono text-xs font-semibold text-slate-500">{item.customerCode}</span> : null}
              </div>
              <p className="mt-2 font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{dateText(item.createdAt)}</span>
                <span className="font-mono">{item.sourceId}</span>
                {item.channels?.length ? <span>通知：{item.channels.join("、")}</span> : null}
              </div>
            </div>
            <Link className="inline-flex min-h-9 items-center justify-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800" href={item.href}>
              去处理
            </Link>
          </div>
        ))}
        {riskItems.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">暂无超时或高优先级 SLA 提醒。</div> : null}
      </div>
      {riskItems.length > 6 ? <p className="mt-3 text-xs text-slate-500">已展示最高优先级的 6 条，其余可在下方运营待办中心继续查看。</p> : null}
    </section>
  );
}
