import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, ReceiptText } from "lucide-react";
import { CustomerStatementActions } from "@/app/components/CustomerStatementActions";
import { DocumentUploadPanel } from "@/app/components/DocumentUploadPanel";
import { PrintButton } from "@/app/components/PrintButton";
import { PageShell } from "@/app/components/MarketingShell";
import { billingMonthLabel, filterBillingRecords } from "@/lib/billingUtils";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getDocumentsForCustomer } from "@/lib/documentStore";
import { billingInvoiceStatusLabel, billingStatusLabel, getWarehouseCoreDataForCustomer, type BillingRecord } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ month: string }>;
};

function money(value: number) {
  return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function dateLabel(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function statementStatus(records: BillingRecord[]) {
  if (records.length > 0 && records.every((record) => record.statementStatus === "locked")) return "已锁账";
  return "待锁账";
}

export default async function CustomerBillingStatementPage({ params }: PageProps) {
  const [{ month }, session] = await Promise.all([params, requireCustomerSession()]);
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const [coreData, documents] = await Promise.all([
    getWarehouseCoreDataForCustomer(session.customerCode),
    getDocumentsForCustomer(session.customerCode),
  ]);
  const records = filterBillingRecords(coreData.billingRecords, { month }).sort((a, b) => new Date(a.dueDate || a.createdAt).getTime() - new Date(b.dueDate || b.createdAt).getTime());
  if (records.length === 0) notFound();

  const customer = coreData.customer;
  const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);
  const paidAmount = records.filter((record) => record.status === "paid").reduce((sum, record) => sum + record.amount, 0);
  const payableAmount = records.filter((record) => ["draft", "pending_confirmation", "confirmed", "payment_submitted"].includes(record.status)).reduce((sum, record) => sum + record.amount, 0);
  const issuedInvoices = records.filter((record) => record.invoiceStatus === "issued").length;
  const statementId = records.find((record) => record.statementId)?.statementId || `STMT-${session.customerCode}-${month}`;
  const statementDocuments = documents.filter((document) => document.refType === "billing" && document.refId === statementId);
  const confirmedAt = records.find((record) => record.statementCustomerConfirmedAt)?.statementCustomerConfirmedAt;
  const paymentSubmittedAt = records.find((record) => record.statementPaymentSubmittedAt)?.statementPaymentSubmittedAt;

  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950 print:bg-white print:pt-0">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-0">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Link className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 print:hidden" href="/billing">
                  <ArrowLeft size={16} />
                  返回费用账单
                </Link>
                <p className="text-sm font-semibold text-cyan-800">客户月结单</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{billingMonthLabel(month)}</h1>
                <p className="mt-2 font-mono text-sm text-slate-500">{statementId}</p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/api/billing/export?month=${month}`}>
                  <FileSpreadsheet size={16} />
                  导出 CSV
                </Link>
                <PrintButton />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["客户", customer?.companyName || session.customerCode],
                ["客户编号", session.customerCode],
                ["月结状态", statementStatus(records)],
                ["账单数量", `${records.length} 张`],
              ].map(([label, value]) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={label}>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["总金额", money(totalAmount), "text-slate-950"],
                ["待结算", money(payableAmount), "text-amber-800"],
                ["已支付", money(paidAmount), "text-emerald-800"],
              ].map(([label, value, color]) => (
                <div className="rounded-md border border-slate-200 bg-white p-4" key={label}>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          <CustomerStatementActions month={month} records={records} />

          <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr] print:hidden">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">确认与付款记录</h2>
              <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">客户确认</p>
                  <p className="mt-2 font-semibold text-slate-950">{dateLabel(confirmedAt)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">付款提交</p>
                  <p className="mt-2 font-semibold text-slate-950">{dateLabel(paymentSubmittedAt)}</p>
                </div>
              </div>
              {records.find((record) => record.statementCustomerMessage)?.statementCustomerMessage ? (
                <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">客户说明：{records.find((record) => record.statementCustomerMessage)?.statementCustomerMessage}</p>
              ) : null}
              {records.find((record) => record.statementPaymentReference)?.statementPaymentReference ? (
                <p className="mt-3 rounded-md bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">付款参考号：{records.find((record) => record.statementPaymentReference)?.statementPaymentReference}</p>
              ) : null}
            </div>
            <DocumentUploadPanel
              category="payment_proof"
              documents={statementDocuments}
              refId={statementId}
              refType="billing"
              title="月结单 PDF / 付款资料归档"
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <ReceiptText size={17} className="text-[#0E7490]" />
                月结明细
              </h2>
              <p className="text-sm font-semibold text-slate-500">{issuedInvoices} 张已开票</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">账单</th>
                    <th className="px-4 py-3">业务</th>
                    <th className="px-4 py-3">费用明细</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">到期日</th>
                    <th className="px-4 py-3 text-right">金额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-slate-950">{record.id}</p>
                        <p className="mt-1 text-xs text-slate-500">{record.title}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{record.refType}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{record.refId}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {record.feeLines?.length ? record.feeLines.map((line) => (
                          <p key={`${record.id}-${line.feeCode}`}>{line.label}: {line.quantity}{line.unitLabel} x {money(line.unitPrice)}</p>
                        )) : <p className="text-slate-400">-</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{billingStatusLabel(record.status)}</p>
                        <p className="mt-1 text-xs text-slate-500">{billingInvoiceStatusLabel(record.invoiceStatus)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{dateLabel(record.dueDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-950">{money(record.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-slate-950">
                  <tr>
                    <td className="px-4 py-3 text-right" colSpan={5}>合计</td>
                    <td className="px-4 py-3 text-right">{money(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
