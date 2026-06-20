import { AlertTriangle, BarChart3, CalendarClock, Download, FileDown, TimerReset } from "lucide-react";
import Link from "next/link";
import type { ReportCenterData, ReportCenterRisk } from "@/lib/reportCenter";
import { ReportScheduleQuickCreate } from "./ReportScheduleQuickCreate";
import { ReportScheduleRowActions } from "./ReportScheduleRowActions";

type Props = {
  data: ReportCenterData;
};

const riskClass: Record<ReportCenterRisk, string> = {
  正常: "border-emerald-200 bg-emerald-50 text-emerald-800",
  关注: "border-amber-200 bg-amber-50 text-amber-800",
  高风险: "border-rose-200 bg-rose-50 text-rose-800",
};

function dateText(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function metric(label: string, value: number | string, tone: "slate" | "cyan" | "emerald" | "amber" | "rose" = "slate") {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div className={`rounded-md border p-3 ${classes[tone]}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function OpsReportCenterPanel({ data }: Props) {
  const riskModules = data.modules.filter((item) => item.riskLevel !== "正常").slice(0, 6);
  const financeModule = data.modules.find((item) => item.module === "finance_adjustments");
  const launchGuardModule = data.modules.find((item) => item.module === "launch_guard");
  const primaryModules = [...data.modules]
    .sort((left, right) => {
      const rank: Record<ReportCenterRisk, number> = { 高风险: 0, 关注: 1, 正常: 2 };
      return rank[left.riskLevel] - rank[right.riskLevel] || right.activeScheduleCount - left.activeScheduleCount || right.viewCount - left.viewCount;
    })
    .slice(0, 10);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <BarChart3 size={18} className="text-cyan-700" />
            报表中心
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            集中管理保存视图、定时报表、最近导出和高风险报表入口。日常先看高风险模块，再进入明细报表导出或配置定时发送。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/center?format=csv">
            <Download size={14} />
            导出总览
          </Link>
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/reports/schedules/run" target="_blank">
            <CalendarClock size={14} />
            定时任务接口
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {metric("保存视图", data.summary.savedViews, "cyan")}
        {metric("启用定时", data.summary.activeSchedules, "emerald")}
        {metric("暂停/归档", `${data.summary.pausedSchedules}/${data.summary.archivedSchedules}`, data.summary.pausedSchedules + data.summary.archivedSchedules > 0 ? "amber" : "slate")}
        {metric("投递失败", data.summary.failedSchedules + data.summary.failedNotificationDeliveries, data.summary.failedSchedules + data.summary.failedNotificationDeliveries > 0 ? "rose" : "emerald")}
        {metric("近期导出", data.summary.recentExports, "slate")}
        {metric("高风险模块", data.summary.highRiskModules, data.summary.highRiskModules > 0 ? "rose" : "emerald")}
      </div>

      {riskModules.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <AlertTriangle size={16} />
            优先查看
          </h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {riskModules.map((item) => (
              <Link className="rounded-md border border-amber-200 bg-white p-3 text-sm hover:border-amber-300 hover:bg-amber-50" href={item.href} key={item.module}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${riskClass[item.riskLevel]}`}>{item.riskLevel}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.riskReason}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {financeModule ? (
        <div className="mt-4 rounded-md border border-cyan-100 bg-cyan-50 p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-cyan-950">财务审批常用视图</h3>
              <p className="mt-1 text-xs leading-5 text-cyan-800">把调账/赔付审批里最常用的待处理、缺附件、争议和待核销筛选直接放在报表中心，适合财务日清。</p>
            </div>
            <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${riskClass[financeModule.riskLevel]}`}>{financeModule.riskReason}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Link className="rounded-md border border-cyan-200 bg-white p-3 text-sm font-semibold text-slate-800 hover:border-cyan-300 hover:bg-cyan-50" href="/api/ops/reports/views/SYS-VIEW-FINANCE-PENDING-APPROVAL">
              待审批调账/赔付
              <span className="mt-1 block text-xs font-normal text-slate-500">审批规则已命中，等待财务或管理员处理。</span>
            </Link>
            <Link className="rounded-md border border-cyan-200 bg-white p-3 text-sm font-semibold text-slate-800 hover:border-cyan-300 hover:bg-cyan-50" href="/api/ops/reports/views/SYS-VIEW-FINANCE-MISSING-ATTACHMENT">
              附件待补
              <span className="mt-1 block text-xs font-normal text-slate-500">先补审批附件，再完成调账或赔付入账。</span>
            </Link>
            <Link className="rounded-md border border-cyan-200 bg-white p-3 text-sm font-semibold text-slate-800 hover:border-cyan-300 hover:bg-cyan-50" href="/api/ops/reports/views/SYS-VIEW-FINANCE-DISPUTED">
              争议待复核
              <span className="mt-1 block text-xs font-normal text-slate-500">客户或财务驳回后，需要重新确认处理口径。</span>
            </Link>
            <Link className="rounded-md border border-cyan-200 bg-white p-3 text-sm font-semibold text-slate-800 hover:border-cyan-300 hover:bg-cyan-50" href="/api/ops/reports/views/SYS-VIEW-FINANCE-PAYMENT-REVIEW">
              付款待核销
              <span className="mt-1 block text-xs font-normal text-slate-500">客户已提交付款或抵扣，需要财务确认到账。</span>
            </Link>
          </div>
          <ReportScheduleQuickCreate
            views={[
              { id: "SYS-VIEW-FINANCE-PENDING-APPROVAL", name: "待审批调账/赔付", description: "每日发送审批规则已命中的待处理清单。" },
              { id: "SYS-VIEW-FINANCE-MISSING-ATTACHMENT", name: "附件待补", description: "每日发送需要补审批附件的记录。" },
              { id: "SYS-VIEW-FINANCE-DISPUTED", name: "争议待复核", description: "每日发送驳回或有争议的调账/赔付。" },
              { id: "SYS-VIEW-FINANCE-PAYMENT-REVIEW", name: "付款待核销", description: "每日发送等待财务核销的记录。" },
            ]}
          />
        </div>
      ) : null}

      {launchGuardModule ? (
        <div className="mt-4 rounded-md border border-violet-100 bg-violet-50 p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-violet-950">上线复核常用视图</h3>
              <p className="mt-1 text-xs leading-5 text-violet-800">把上线体检、生产集成、系统健康和系统告警合成一份老板视角清单，适合上线前每天自动发送。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${riskClass[launchGuardModule.riskLevel]}`}>{launchGuardModule.riskReason}</span>
              <Link className="inline-flex min-h-8 items-center gap-2 rounded-md border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-800 hover:bg-violet-50" href="/api/ops/reports/views/SYS-VIEW-LAUNCH-GUARD">
                <FileDown size={14} />
                导出复核包
              </Link>
            </div>
          </div>
          <ReportScheduleQuickCreate
            views={[
              { id: "SYS-VIEW-LAUNCH-GUARD", name: "上线复核包", description: "每日发送上线阻塞项、负责人和下一步动作。" },
            ]}
          />
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">报表模块</th>
              <th className="px-4 py-3">保存视图</th>
              <th className="px-4 py-3">定时报表</th>
              <th className="px-4 py-3">最近导出</th>
              <th className="px-4 py-3">风险</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {primaryModules.map((item) => (
              <tr key={item.module}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{item.description}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{item.viewCount}</td>
                <td className="px-4 py-3 text-slate-700">
                  <p>启用 {item.activeScheduleCount}</p>
                  <p className="mt-1 text-xs text-slate-500">暂停 {item.pausedScheduleCount} / 失败 {item.failedScheduleCount}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <p>{item.recentExportCount} 次</p>
                  <p className="mt-1 text-xs text-slate-500">{dateText(item.lastExportAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${riskClass[item.riskLevel]}`}>{item.riskLevel}</span>
                  <p className="mt-1 text-xs text-slate-500">{item.riskReason}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={item.href}>
                    <FileDown size={14} />
                    导出
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <TimerReset size={16} className="text-cyan-700" />
            定时报表状态
          </h3>
          <div className="mt-3 grid gap-2">
            {data.scheduleRows.length > 0 ? (
              data.scheduleRows.slice(0, 5).map((item) => (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-xs" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">{item.status}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{item.moduleLabel} / {item.cadence} / {item.recipients}</p>
                  <p className="mt-1 text-slate-500">最近执行：{dateText(item.lastRunAt)} / 投递：{item.lastDeliveryStatus}</p>
                  {item.lastDeliveryNote ? <p className="mt-1 text-slate-500">{item.lastDeliveryNote}</p> : null}
                  <ReportScheduleRowActions row={item} />
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">暂无定时报表，可先在马帮对标模块里保存视图并配置计划。</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Download size={16} className="text-cyan-700" />
            最近导出
          </h3>
          <div className="mt-3 grid gap-2">
            {data.recentExports.length > 0 ? (
              data.recentExports.slice(0, 6).map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">{item.reportName}</p>
                    <span className="text-slate-500">{dateText(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{item.actorName}{item.note ? ` / ${item.note}` : ""}</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">暂无报表导出记录。</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
