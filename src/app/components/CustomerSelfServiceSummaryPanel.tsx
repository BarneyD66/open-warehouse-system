import Link from "next/link";
import { AlertTriangle, ArrowRight, Download, FileCheck2, PackageCheck, ReceiptText, ShieldCheck } from "lucide-react";
import type { CustomerSelfServiceCenterData } from "@/lib/customerSelfServiceCenter";

type Props = {
  summary: CustomerSelfServiceCenterData["summary"];
  downloadReportCount: number;
  availableRecordCount: number;
  templateCount: number;
};

function quickCard({ href, title, body, count, tone }: { href: string; title: string; body: string; count: string | number; tone: "cyan" | "emerald" | "amber" | "rose" }) {
  const toneClass = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];

  return (
    <Link className="group grid min-h-28 gap-3 rounded-md border border-slate-200 bg-white p-3 transition hover:border-cyan-200 hover:bg-cyan-50/40" href={href}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{body}</p>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${toneClass}`}>{count}</span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-800">
        打开
        <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function CustomerSelfServiceSummaryPanel({ summary, downloadReportCount, availableRecordCount, templateCount }: Props) {
  const hasUrgent = summary.urgentCount > 0 || summary.openExceptions > 0;

  return (
    <section className="rounded-lg border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <ShieldCheck size={18} className="text-cyan-700" />
              客户资料包总览
            </h2>
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${hasUrgent ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {hasUrgent ? "有事项待确认" : "资料可自助获取"}
            </span>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">常用报表、模板、面单、签收证明、费用明细和异常确认集中在这里。需要下载资料先点资料索引，需要处理业务先看操作清单。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">报表入口</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{downloadReportCount}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">关联数据</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{availableRecordCount}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">模板</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{templateCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {quickCard({
          href: "/api/downloads?kind=self-service-index",
          title: "下载资料索引",
          body: "汇总全部报表、模板、工单服务和下载地址。",
          count: `${downloadReportCount} 项`,
          tone: "cyan",
        })}
        {quickCard({
          href: "/api/downloads?kind=self-service-actions",
          title: "下载操作清单",
          body: "查看待确认、待付款、异常确认和可下载资料。",
          count: summary.actionCount,
          tone: summary.urgentCount > 0 ? "amber" : "emerald",
        })}
        {quickCard({
          href: "/api/downloads?kind=labels",
          title: "面单列表",
          body: "已生成面单的出库单、承运商和追踪号。",
          count: summary.labels,
          tone: "cyan",
        })}
        {quickCard({
          href: "/api/downloads?kind=proofs",
          title: "签收证明",
          body: "已签收订单和可下载的 POD 签收证明。",
          count: summary.proofs,
          tone: "emerald",
        })}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <FileCheck2 size={15} className="text-cyan-700" />
            <p className="text-sm font-semibold text-slate-950">资料归档</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">当前归档文件 {summary.documents} 个，可预览/下载通过安全扫描的资料。</p>
          <Link className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800" href="/api/downloads?kind=documents">
            下载资料清单 <Download size={13} />
          </Link>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <ReceiptText size={15} className="text-amber-700" />
            <p className="text-sm font-semibold text-slate-950">费用与付款</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">待处理账单 {summary.billingDue} 个，可下载费用明细和付款核销记录。</p>
          <Link className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800" href="/api/downloads?kind=billing">
            下载费用明细 <Download size={13} />
          </Link>
        </div>
        <div className={`rounded-md border p-3 ${hasUrgent ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex items-center gap-2">
            {hasUrgent ? <AlertTriangle size={15} className="text-rose-700" /> : <PackageCheck size={15} className="text-emerald-700" />}
            <p className="text-sm font-semibold text-slate-950">异常与售后</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-700">开放异常 {summary.openExceptions} 个，退货待确认 {summary.returnsNeedDecision} 个。</p>
          <Link className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800" href="/api/downloads?kind=exceptions">
            下载异常中心 <Download size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
