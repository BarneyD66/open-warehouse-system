import { AlertTriangle, Download, ListChecks, MailWarning } from "lucide-react";
import Link from "next/link";
import type { CustomerSelfServiceOpsReport, CustomerSelfServiceOpsRisk, CustomerSelfServiceOpsRow } from "@/lib/customerSelfServiceOpsReport";
import { OpsCustomerSelfServiceReminderButton } from "./OpsCustomerSelfServiceReminderButton";

const riskClass: Record<CustomerSelfServiceOpsRisk, string> = {
  正常: "border-emerald-200 bg-emerald-50 text-emerald-800",
  关注: "border-amber-200 bg-amber-50 text-amber-800",
  高风险: "border-rose-200 bg-rose-50 text-rose-800",
};

function metric(label: string, value: number, tone: "slate" | "cyan" | "emerald" | "amber" | "rose") {
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

function dateText(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function rowTone(row: CustomerSelfServiceOpsRow) {
  if (row.overdueCount > 0 || row.riskLevel === "高风险") return "border-rose-200 bg-rose-50";
  if (row.nearDueCount > 0 || row.riskLevel === "关注") return "border-amber-200 bg-amber-50";
  return "border-slate-200 bg-white";
}

export function OpsCustomerSelfServicePanel({ report }: { report: CustomerSelfServiceOpsReport }) {
  const riskRows = report.rows.filter((row) => row.actionCount > 0 || row.overdueCount > 0 || row.urgentCount > 0 || row.financeReviewWorkOrders > 0).slice(0, 8);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ListChecks size={18} className="text-cyan-700" />
            客户自助待办监控
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            按客户集中查看资料补充、账单付款、物流异常确认、退货处理和工单沟通，优先处理超时和紧急客户。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OpsCustomerSelfServiceReminderButton disabled={report.summary.urgentActions === 0 && report.summary.overdueActions === 0 && report.summary.nearDueActions === 0} />
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/customer-self-service">
            <Download size={14} />
            导出汇总
          </Link>
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/reports/customer-self-service?detail=1">
            <Download size={14} />
            导出明细
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-9">
        {metric("客户总数", report.summary.customers, "slate")}
        {metric("活跃客户", report.summary.activeCustomers, "cyan")}
        {metric("高风险客户", report.summary.highRiskCustomers, report.summary.highRiskCustomers > 0 ? "rose" : "emerald")}
        {metric("超时客户", report.summary.overdueCustomers, report.summary.overdueCustomers > 0 ? "rose" : "emerald")}
        {metric("紧急事项", report.summary.urgentActions, report.summary.urgentActions > 0 ? "rose" : "emerald")}
        {metric("已超时", report.summary.overdueActions, report.summary.overdueActions > 0 ? "rose" : "emerald")}
        {metric("即将超时", report.summary.nearDueActions, report.summary.nearDueActions > 0 ? "amber" : "emerald")}
        {metric("财务复核", report.summary.financeReviewWorkOrders, report.summary.financeReviewWorkOrders > 0 ? "amber" : "emerald")}
        {metric("可下载资料", report.summary.downloadableItems, "slate")}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={16} className="text-amber-700" />
            优先处理客户
          </h3>
          <div className="mt-3 grid gap-2">
            {riskRows.length > 0 ? (
              riskRows.map((row) => (
                <article className={`rounded-md border p-3 ${rowTone(row)}`} key={row.customerCode}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${riskClass[row.riskLevel]}`}>{row.riskLevel}</span>
                        <span className="font-mono text-xs font-semibold text-slate-600">{row.customerCode}</span>
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-slate-950">{row.companyName}</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {row.topActionModule || "暂无模块"} / {row.topActionTitle || "暂无待办"}
                      </p>
                    </div>
                    <div className="text-left text-xs text-slate-500 md:text-right">
                      <p>待处理 {row.actionCount} / 超时 {row.overdueCount}</p>
                      <p className="mt-1">截止 {dateText(row.topActionDueAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600">紧急 {row.urgentCount}</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600">账单 {row.billingDue}</span>
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800">财务复核 {row.financeReviewWorkOrders}</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600">退货 {row.returnsNeedDecision}</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600">异常 {row.openExceptions}</span>
                    {row.reminderChannels ? <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 font-semibold text-cyan-800">提醒 {row.reminderChannels}</span> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">暂无需要集中跟进的客户自助待办。</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <MailWarning size={16} className="text-cyan-700" />
            运营处理口径
          </h3>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
            <p className="rounded-md bg-slate-50 p-3">已超时或紧急客户：优先电话/微信确认，并触发站内信和邮件提醒。</p>
            <p className="rounded-md bg-slate-50 p-3">入库缺追踪号、物流异常确认、退货处理方式：会直接影响仓库识别、派送售后和库位占用。</p>
            <p className="rounded-md bg-slate-50 p-3">账单待确认或逾期：同步进入账单和客户信用风险视图，必要时暂停高风险客户出库。</p>
            <p className="rounded-md bg-slate-50 p-3">导出明细可给客服逐条跟进，导出汇总适合每日晨会看风险客户。</p>
          </div>
        </div>
      </div>
    </section>
  );
}
