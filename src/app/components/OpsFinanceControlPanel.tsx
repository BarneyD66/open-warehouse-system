import Link from "next/link";
import { AlertTriangle, Banknote, CheckCircle2, Download, FileWarning, ReceiptText, ShieldAlert } from "lucide-react";
import type { CustomerWorkOrder } from "@/lib/opsExpansionStore";
import { billingInvoiceStatusLabel, billingStatusLabel, evaluateCustomerCreditRisk, type BillingRecord, type CustomerProfile, type CustomerCreditRisk } from "@/lib/warehouseCoreStore";

type Props = {
  customers: CustomerProfile[];
  records: BillingRecord[];
  workOrders?: CustomerWorkOrder[];
};

type FinanceIssue = {
  id: string;
  tone: "rose" | "amber" | "cyan" | "emerald";
  type: string;
  customerCode: string;
  title: string;
  amount?: number;
  detail: string;
  nextAction: string;
  href: string;
  sortScore: number;
};

const toneClass: Record<FinanceIssue["tone"], string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
};

function pill(label: string, tone: FinanceIssue["tone"]) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>{label}</span>;
}

function money(value: number) {
  return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function billingMonth(record: BillingRecord) {
  return (record.statementMonth || record.dueDate || record.createdAt).slice(0, 7);
}

function daysOverdue(record: BillingRecord) {
  if (!record.dueDate || record.status === "paid") return 0;
  const dueMs = new Date(`${record.dueDate}T23:59:59`).getTime();
  if (!Number.isFinite(dueMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - dueMs) / 86_400_000));
}

function dueSoon(record: BillingRecord) {
  if (!record.dueDate || record.status === "paid") return false;
  const dueMs = new Date(`${record.dueDate}T23:59:59`).getTime();
  if (!Number.isFinite(dueMs)) return false;
  const diff = dueMs - Date.now();
  return diff >= 0 && diff <= 7 * 86_400_000;
}

function hoursSince(value?: string) {
  const time = value ? new Date(value).getTime() : Date.now();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.round((Date.now() - time) / 36_000) / 100);
}

function customerName(customers: CustomerProfile[], customerCode: string) {
  const customer = customers.find((item) => item.customerCode === customerCode);
  return customer?.companyName || customerCode;
}

function creditRiskIssue(risk: CustomerCreditRisk, customers: CustomerProfile[]): FinanceIssue | null {
  if (risk.status === "clear") return null;
  const blocked = risk.status === "blocked";
  return {
    id: `credit-${risk.customerCode}`,
    tone: blocked ? "rose" : "amber",
    type: blocked ? "信用阻塞" : "信用关注",
    customerCode: risk.customerCode,
    title: `${customerName(customers, risk.customerCode)} / ${risk.customerCode}`,
    amount: risk.outstandingAmount,
    detail: risk.reasons.join("；") || `未结金额 ${money(risk.outstandingAmount)}`,
    nextAction: blocked ? "先处理逾期、预付欠款或信用额度超限，再继续放行新出库。" : "关注账期和信用额度，必要时提前提醒客户付款。",
    href: "/api/ops/reports/customer-credit",
    sortScore: blocked ? 95 : 55,
  };
}

function adjustmentLabel(record: BillingRecord) {
  if (record.adjustmentKind === "fee_adjustment") return "费用调账";
  if (record.adjustmentKind === "compensation") return "赔付抵扣";
  return "财务调整";
}

function adjustmentApprovalStatusLabel(record: BillingRecord) {
  if (record.adjustmentApprovalStatus === "pending_approval") return "待审批";
  if (record.adjustmentApprovalStatus === "approved") return "已审批";
  if (record.adjustmentApprovalStatus === "posted") return "已入账";
  if (record.adjustmentApprovalStatus === "rejected") return "已驳回/有争议";
  if (record.adjustmentApprovalStatus === "paid") return "已核销";
  if (record.status === "paid") return "已核销";
  if (record.status === "confirmed") return "已入账";
  if (record.status === "disputed") return "已驳回/有争议";
  return "已审批";
}

function adjustmentAttachmentStatusLabel(record: BillingRecord) {
  if (record.adjustmentAttachmentStatus === "archived") return "附件已归档";
  if (record.adjustmentAttachmentStatus === "confirmed") return "附件已确认";
  if (record.adjustmentAttachmentStatus === "missing") return "附件待补";
  if (record.adjustmentAttachmentStatus === "not_required") return "无需附件";
  return "附件未记录";
}

function buildIssues(records: BillingRecord[], customers: CustomerProfile[], workOrders: CustomerWorkOrder[]) {
  const financeReviewIssues: FinanceIssue[] = workOrders
    .filter((item) => item.financeReviewRequired && item.status !== "resolved" && item.status !== "cancelled")
    .map((item) => {
      const age = hoursSince(item.updatedAt ?? item.createdAt);
      return {
        id: `finance-work-order-${item.id}`,
        tone: age >= 24 || item.priority === "urgent" ? "rose" : "amber",
        type: "财务复核",
        customerCode: item.customerCode,
        title: `${item.id} / ${item.title}`,
        detail: `${customerName(customers, item.customerCode)} / 已等待 ${age} 小时 / ${item.referenceNo || "未关联账单"}`,
        nextAction: "确认维持账单、同意调账或赔付抵扣；如命中审批规则，需要补齐原因、附件和二次确认。",
        href: "/api/ops/reports/finance-adjustments?kind=work_order",
        sortScore: age >= 24 || item.priority === "urgent" ? 92 : 68,
      } satisfies FinanceIssue;
    });

  const adjustmentIssues: FinanceIssue[] = records
    .filter((record) => record.adjustmentKind)
    .map((record) => ({
      id: `finance-adjustment-${record.id}`,
      tone: Math.abs(record.amount) >= 100 ? "rose" : record.adjustmentKind === "compensation" ? "emerald" : "amber",
      type: adjustmentLabel(record),
      customerCode: record.customerCode,
      title: `${record.id} / ${record.title}`,
      amount: record.amount,
      detail: `${customerName(customers, record.customerCode)} / ${adjustmentApprovalStatusLabel(record)} / ${adjustmentAttachmentStatusLabel(record)} / 来源工单 ${record.workOrderId || "未记录"} / 原账单 ${record.adjustmentSourceRecordId || "未记录"}`,
      nextAction: record.status === "paid" ? "已核销，保留审计追溯。" : "确认客户账单、月结抵扣或付款核销状态是否已同步。",
      href: "/api/ops/reports/finance-adjustments",
      sortScore: Math.abs(record.amount) >= 100 ? 86 : 52,
    }));

  const overdueIssues: FinanceIssue[] = records
    .filter((record) => record.status !== "paid" && daysOverdue(record) > 0)
    .map((record) => {
      const days = daysOverdue(record);
      return {
        id: `overdue-${record.id}`,
        tone: days >= 30 ? "rose" : "amber",
        type: "逾期应收",
        customerCode: record.customerCode,
        title: `${record.id} / ${record.title}`,
        amount: record.amount,
        detail: `${customerName(customers, record.customerCode)} / 逾期 ${days} 天 / ${billingStatusLabel(record.status)}`,
        nextAction: record.status === "payment_submitted" ? "优先核对付款参考号，确认到账后核销。" : "提醒客户付款或提交付款凭证，必要时暂停高风险出库。",
        href: "/api/ops/reports/billing-aging",
        sortScore: days >= 30 ? 90 : 70,
      } satisfies FinanceIssue;
    });

  const paymentIssues: FinanceIssue[] = records
    .filter((record) => record.status === "payment_submitted")
    .map((record) => ({
      id: `payment-${record.id}`,
      tone: "cyan",
      type: "待核销",
      customerCode: record.customerCode,
      title: `${record.id} / ${record.title}`,
      amount: record.amount,
      detail: `${customerName(customers, record.customerCode)} / 付款参考 ${record.paymentReference || record.statementPaymentReference || "未填写"}`,
      nextAction: "核对银行流水和付款参考号，确认无误后标记到账；不符则驳回付款。",
      href: "/api/ops/reports/payment-reconciliation?status=待财务复核",
      sortScore: 65,
    }));

  const disputeIssues: FinanceIssue[] = records
    .filter((record) => record.status === "disputed")
    .map((record) => ({
      id: `dispute-${record.id}`,
      tone: "rose",
      type: "账单争议",
      customerCode: record.customerCode,
      title: `${record.id} / ${record.title}`,
      amount: record.amount,
      detail: `${customerName(customers, record.customerCode)} / ${record.customerMessage || record.statementCustomerMessage || "客户已提出费用异议"}`,
      nextAction: "先复核争议费用口径，确认后解除争议或退回客户重新确认。",
      href: "/api/ops/reports/payment-reconciliation?status=争议处理中",
      sortScore: 88,
    }));

  const invoiceIssues: FinanceIssue[] = records
    .filter((record) => record.invoiceStatus === "requested" || (record.status === "paid" && (!record.invoiceStatus || record.invoiceStatus === "not_requested")))
    .map((record) => ({
      id: `invoice-${record.id}`,
      tone: record.invoiceStatus === "requested" ? "amber" : "cyan",
      type: record.invoiceStatus === "requested" ? "待开票" : "可补开发票",
      customerCode: record.customerCode,
      title: `${record.id} / ${record.title}`,
      amount: record.amount,
      detail: `${customerName(customers, record.customerCode)} / ${billingInvoiceStatusLabel(record.invoiceStatus)}`,
      nextAction: record.invoiceStatus === "requested" ? "根据客户开票申请开具发票并更新发票状态。" : "如客户后续申请发票，可从账单操作中登记开票。",
      href: "/api/ops/reports/payment-reconciliation",
      sortScore: record.invoiceStatus === "requested" ? 58 : 25,
    }));

  const creditIssues = customers
    .map((customer) => creditRiskIssue(evaluateCustomerCreditRisk({ billingRecords: records, customers }, customer.customerCode), customers))
    .filter((item): item is FinanceIssue => Boolean(item));

  return [...financeReviewIssues, ...creditIssues, ...disputeIssues, ...overdueIssues, ...paymentIssues, ...adjustmentIssues, ...invoiceIssues]
    .sort((a, b) => b.sortScore - a.sortScore || (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 12);
}

export function OpsFinanceControlPanel({ customers, records, workOrders = [] }: Props) {
  const openRecords = records.filter((record) => record.status !== "paid");
  const overdueRecords = openRecords.filter((record) => daysOverdue(record) > 0);
  const paymentSubmitted = records.filter((record) => record.status === "payment_submitted");
  const disputed = records.filter((record) => record.status === "disputed");
  const invoiceRequested = records.filter((record) => record.invoiceStatus === "requested");
  const adjustmentRecords = records.filter((record) => record.adjustmentKind);
  const adjustmentAmount = adjustmentRecords.reduce((sum, record) => sum + record.amount, 0);
  const financeReviewWorkOrders = workOrders.filter((item) => item.financeReviewRequired && item.status !== "resolved" && item.status !== "cancelled");
  const lockedStatements = records.filter((record) => record.statementStatus === "locked");
  const dueSoonRecords = openRecords.filter(dueSoon);
  const creditRisks = customers
    .map((customer) => evaluateCustomerCreditRisk({ billingRecords: records, customers }, customer.customerCode))
    .filter((risk) => risk.status !== "clear");
  const issues = buildIssues(records, customers, workOrders);
  const openAmount = openRecords.reduce((sum, record) => sum + record.amount, 0);
  const overdueAmount = overdueRecords.reduce((sum, record) => sum + record.amount, 0);
  const monthSet = new Set(records.map(billingMonth));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Banknote size={18} className="text-[#0E7490]" />
            财务实账总控
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">集中查看应收、逾期、付款核销、账单争议、客户信用额度、发票和月结锁定状态，帮助财务每天先处理会影响发货的事项。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/billing-aging">
            <Download size={14} />
            应收账龄
          </Link>
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/reports/payment-reconciliation">
            <Download size={14} />
            核销台账
          </Link>
          <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100" href="/api/ops/reports/customer-credit">
            <Download size={14} />
            信用风险
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">未结金额</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{money(openAmount)}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">逾期金额</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{money(overdueAmount)}</p>
        </div>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-cyan-800">待核销</p>
          <p className="mt-1 text-xl font-semibold text-cyan-950">{paymentSubmitted.length}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">争议账单</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{disputed.length}</p>
        </div>
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-800">待开票</p>
          <p className="mt-1 text-xl font-semibold text-amber-950">{invoiceRequested.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-600">月结月份</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{monthSet.size}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <Link className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 hover:bg-amber-100" href="/api/ops/reports/finance-adjustments?kind=work_order">
          <p className="text-[11px] font-semibold">财务复核工单</p>
          <p className="mt-1 text-xl font-semibold">{financeReviewWorkOrders.length}</p>
        </Link>
        <Link className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-900 hover:bg-cyan-100" href="/api/ops/reports/finance-adjustments">
          <p className="text-[11px] font-semibold">调账/赔付记录</p>
          <p className="mt-1 text-xl font-semibold">{adjustmentRecords.length}</p>
        </Link>
        <Link className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900 hover:bg-emerald-100" href="/api/ops/reports/finance-adjustments">
          <p className="text-[11px] font-semibold">调账/赔付净额</p>
          <p className="mt-1 text-xl font-semibold">{money(adjustmentAmount)}</p>
        </Link>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileWarning size={15} className="text-amber-700" />
            今日优先处理
          </h3>
          <div className="mt-3 grid gap-2">
            {issues.slice(0, 8).map((issue) => (
              <div className="rounded-md bg-white p-3" key={issue.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {pill(issue.type, issue.tone)}
                  <span className="font-mono text-xs font-semibold text-slate-500">{issue.customerCode}</span>
                  {typeof issue.amount === "number" ? <span className="text-xs font-semibold text-slate-600">{money(issue.amount)}</span> : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-950">{issue.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{issue.detail}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-cyan-800">下一步：{issue.nextAction}</p>
                <Link className="mt-2 inline-flex text-xs font-semibold text-slate-700 hover:text-cyan-800" href={issue.href}>
                  查看台账
                </Link>
              </div>
            ))}
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                暂无高优先级财务阻塞项。
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ReceiptText size={15} className="text-cyan-700" />
            财务关账检查
          </h3>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="rounded-md bg-white p-3">
              <p className="font-semibold text-slate-950">付款核销</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">待核销 {paymentSubmitted.length} 笔，争议 {disputed.length} 笔。</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <p className="font-semibold text-slate-950">调账/赔付</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">待复核工单 {financeReviewWorkOrders.length} 个，已生成调账/赔付 {adjustmentRecords.length} 笔，净额 {money(adjustmentAmount)}。</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <p className="font-semibold text-slate-950">账期风险</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">逾期 {overdueRecords.length} 笔，7 天内到期 {dueSoonRecords.length} 笔，信用风险客户 {creditRisks.length} 个。</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <p className="font-semibold text-slate-950">发票/月结</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">待开票 {invoiceRequested.length} 笔，已锁定月结记录 {lockedStatements.length} 笔。</p>
            </div>
            {creditRisks.some((risk) => risk.status === "blocked") ? (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900">
                <ShieldAlert className="mt-0.5 shrink-0" size={15} />
                <p>存在信用阻塞客户，新出库会受到限制。请先处理逾期、预付欠款或信用额度超限。</p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
                <p>当前未发现信用阻塞客户，可继续按正常账期复核。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {overdueRecords.length > 0 || disputed.length > 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <p>建议先处理账单争议和逾期应收，再进行新一轮批量出库放行与月结锁定。</p>
        </div>
      ) : null}
    </section>
  );
}
