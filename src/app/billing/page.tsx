import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, FileText, PackageCheck, ReceiptText, Truck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { billingMonthLabel, summarizeBillingMonths } from "@/lib/billingUtils";
import { getDocumentsForCustomer } from "@/lib/documentStore";
import { getSubmissionsForCustomer, type InboundSubmission, type InquirySubmission, type Submission } from "@/lib/localStore";
import { getOpsWorkbenchData } from "@/lib/opsStore";
import { billingInvoiceStatusLabel, billingStatusLabel, getWarehouseCoreDataForCustomer, type BillingRecord } from "@/lib/warehouseCoreStore";
import { CustomerBillingActions } from "../components/CustomerBillingActions";
import { DocumentUploadPanel } from "../components/DocumentUploadPanel";
import { PageShell } from "../components/MarketingShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose";

const toneClass: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
};

function isInbound(item: Submission): item is InboundSubmission {
  return item.type === "inbound";
}

function isInquiry(item: Submission): item is InquirySubmission {
  return item.type === "inquiry";
}

function pill(label: string, tone: Tone = "slate") {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>{label}</span>;
}

function money(value?: number) {
  return typeof value === "number" ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}` : "待确认";
}

function dateLabel(value?: string) {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function billingTone(status: BillingRecord["status"]): Tone {
  if (status === "paid" || status === "confirmed") return "emerald";
  if (status === "pending_confirmation" || status === "payment_submitted") return "amber";
  if (status === "disputed") return "rose";
  return "cyan";
}

function refTypeLabel(refType: BillingRecord["refType"]) {
  const labels: Record<BillingRecord["refType"], string> = {
    quote: "报价",
    inbound: "入库",
    outbound: "出库",
    logistics: "物流",
    storage: "仓储",
    return: "退货",
    manual: "人工服务",
  };
  return labels[refType];
}

export default async function BillingPage() {
  const session = await requireCustomerSession();
  const [submissions, opsData, coreData, documents] = await Promise.all([
    getSubmissionsForCustomer(session.customerCode),
    getOpsWorkbenchData(),
    getWarehouseCoreDataForCustomer(session.customerCode),
    getDocumentsForCustomer(session.customerCode),
  ]);

  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);
  const quoted = inquiries.filter((item) => item.quoteDraft);
  const logistics = opsData.logistics.filter((item) => item.customerCode === session.customerCode);
  const outbound = opsData.outbound.filter((item) => item.customerCode === session.customerCode);
  const billingRecords = [...coreData.billingRecords].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const documentsByBillingId = new Map<string, typeof documents>();
  documents.forEach((item) => {
    const key = item.refType === "billing" ? item.refId : "";
    if (!key) return;
    documentsByBillingId.set(key, [...(documentsByBillingId.get(key) ?? []), item]);
  });
  const pendingBills = billingRecords.filter((item) => ["draft", "pending_confirmation", "confirmed", "payment_submitted"].includes(item.status));
  const payableAmount = pendingBills.reduce((sum, item) => sum + item.amount, 0);
  const estimatedLogisticsDelta = logistics.reduce((sum, item) => sum + (item.costDelta ?? 0), 0);
  const monthlySummaries = summarizeBillingMonths(billingRecords);

  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  {pill(`客户编号 ${session.customerCode}`, "cyan")}
                  {pendingBills.length > 0 ? pill(`${pendingBills.length} 张待确认账单`, "amber") : pill("暂无待确认账单", "emerald")}
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">费用账单</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  统一查看报价、入库、出库、仓储和物流相关费用。当前 MVP 已接入正式账单底表，后续可以继续补支付凭证、发票和对账流程。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/portal">
                  返回工作台
                </Link>
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800" href="/tracking">
                  查进度 <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "正式账单", value: billingRecords.length, icon: ReceiptText, tone: billingRecords.length > 0 ? "cyan" : "slate" },
              { label: "待确认金额", value: money(payableAmount), icon: CreditCard, tone: payableAmount > 0 ? "amber" : "emerald" },
              { label: "报价方案", value: quoted.length, icon: FileText, tone: quoted.length > 0 ? "amber" : "slate" },
              { label: "费用差异", value: estimatedLogisticsDelta > 0 ? money(estimatedLogisticsDelta) : "暂无", icon: Truck, tone: estimatedLogisticsDelta > 0 ? "rose" : "emerald" },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={label}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-md ${toneClass[tone as Tone]}`}>
                  <Icon size={18} />
                </span>
                <p className="mt-4 text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">月度对账</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">按账单到期月份汇总费用，可下载 CSV 给财务核对、留档或转发开票。</p>
              </div>
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/billing/export">
                导出全部账单 CSV
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {monthlySummaries.length > 0 ? (
                monthlySummaries.slice(0, 6).map((item) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={item.month}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{billingMonthLabel(item.month)}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.count} 张账单</p>
                      </div>
                      {pill(item.payableAmount > 0 ? "待结算" : "已归档", item.payableAmount > 0 ? "amber" : "emerald")}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <p className="text-slate-500">总额</p>
                      <p className="text-right font-semibold text-slate-950">{money(item.totalAmount)}</p>
                      <p className="text-slate-500">待结算</p>
                      <p className="text-right font-semibold text-amber-800">{money(item.payableAmount)}</p>
                      <p className="text-slate-500">已支付</p>
                      <p className="text-right font-semibold text-emerald-800">{money(item.paidAmount)}</p>
                      <p className="text-slate-500">已锁账</p>
                      <p className="text-right font-semibold text-emerald-800">{item.lockedCount} 张</p>
                      <p className="text-slate-500">已开票</p>
                      <p className="text-right font-semibold text-cyan-800">{item.invoiceIssuedCount} 张</p>
                    </div>
                    <Link className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800" href={`/api/billing/export?month=${item.month}`}>
                      导出本月明细
                    </Link>
                    <Link className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/billing/statements/${item.month}`}>
                      查看月结单
                    </Link>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">暂无可对账账单</div>
              )}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <ReceiptText size={17} className="text-[#0E7490]" />
                <h2 className="text-base font-semibold text-slate-950">正式账单</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {billingRecords.length > 0 ? (
                  billingRecords.map((item) => (
                    <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={item.id}>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                          {pill(refTypeLabel(item.refType), "slate")}
                          {pill(billingInvoiceStatusLabel(item.invoiceStatus), item.invoiceStatus === "issued" ? "emerald" : item.invoiceStatus === "requested" ? "amber" : item.invoiceStatus === "voided" ? "rose" : "slate")}
                          {item.statementStatus === "locked" ? pill("已锁账", "emerald") : null}
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-slate-950">{item.title}</h3>
                        {item.feeLines?.length ? (
                          <div className="mt-2 grid gap-1 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-950">
                            {item.feeLines.map((line) => (
                              <p key={`${item.id}-${line.feeCode}`}>
                                {line.label}: {line.quantity}{line.unitLabel} x £{line.unitPrice.toLocaleString("en-GB", { maximumFractionDigits: 2 })} = {money(line.amount)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          关联 {item.refId} / 到期 {dateLabel(item.dueDate)} / 创建 {dateLabel(item.createdAt)}
                        </p>
                        {item.note ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.note}</p> : null}
                        {item.customerMessage ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">客户说明：{item.customerMessage}</p> : null}
                        {item.reviewNote ? <p className="mt-3 rounded-md bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">运营复核：{item.reviewNote}</p> : null}
                        <CustomerBillingActions record={item} />
                        <DocumentUploadPanel
                          category="payment_proof"
                          documents={(documentsByBillingId.get(item.id) ?? []).filter((document) => document.category === "payment_proof")}
                          refId={item.id}
                          refType="billing"
                          title="付款凭证与账单资料"
                        />
                        <DocumentUploadPanel
                          category="invoice"
                          documents={(documentsByBillingId.get(item.id) ?? []).filter((document) => document.category === "invoice")}
                          refId={item.id}
                          refType="billing"
                          title="发票资料"
                        />
                      </div>
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        {pill(billingStatusLabel(item.status), billingTone(item.status))}
                        <p className="text-xl font-semibold tracking-tight text-slate-950">{money(item.amount)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">暂无正式账单</div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                  <FileText size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">报价方案</h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {quoted.length > 0 ? (
                    quoted.map((item) => (
                      <div className="px-4 py-4" key={item.id}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                            <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.service}</h3>
                          </div>
                          {pill(item.quoteResponse?.decision === "accepted" ? "客户已确认" : "待确认", item.quoteResponse?.decision === "accepted" ? "emerald" : "amber")}
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <p>月度报价：{money(item.quoteDraft?.monthlyFee)}</p>
                          <p>入库费：{money(item.quoteDraft?.inboundFee)}</p>
                          <p>仓储费：{money(item.quoteDraft?.storageFee)}</p>
                          <p>出库操作费：{money(item.quoteDraft?.outboundFee)}</p>
                          <p>退货处理费：{money(item.quoteDraft?.returnFee)}</p>
                          <p>FBA Prep：{money(item.quoteDraft?.fbaFee)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">暂无报价方案</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                  <PackageCheck size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">费用关联记录</h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {inbounds.slice(0, 3).map((item) => (
                    <div className="grid gap-2 px-4 py-4 md:grid-cols-[1fr_auto]" key={item.id}>
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">入库预报</h3>
                        <p className="mt-2 text-sm text-slate-600">{item.cartons} 箱 / {item.skuCount} SKU / {dateLabel(item.createdAt)}</p>
                      </div>
                      {pill("费用待复核", "slate")}
                    </div>
                  ))}
                  {outbound.slice(0, 3).map((item) => (
                    <div className="grid gap-2 px-4 py-4 md:grid-cols-[1fr_auto]" key={item.id}>
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.channel}</h3>
                        <p className="mt-2 text-sm text-slate-600">{item.orderCount} 单 / 截止 {item.deadline}</p>
                      </div>
                      {pill("待生成账单", "cyan")}
                    </div>
                  ))}
                  {inbounds.length + outbound.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-500">暂无费用关联记录</div> : null}
                </div>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <CheckCircle2 size={16} />
                  账单 MVP 范围
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  当前已能从正式账单底表读取费用、状态、关联业务和到期日。下一步补客户确认、付款记录、凭证上传和运营复核动作。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
