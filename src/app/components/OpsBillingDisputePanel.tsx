"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Download, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { BillingTimeline } from "./BillingTimeline";
import { DocumentUploadPanel } from "./DocumentUploadPanel";
import type { DocumentRecord } from "@/lib/documentStore";
import type { CustomerWorkOrder } from "@/lib/opsExpansionStore";
import type { BillingRecord, CustomerProfile } from "@/lib/warehouseCoreStore";

type Props = {
  customers: CustomerProfile[];
  records: BillingRecord[];
  workOrders?: CustomerWorkOrder[];
  documents?: DocumentRecord[];
};

type FinanceReviewConclusion = "keep_bill" | "fee_adjustment" | "compensation";

const adjustmentStatusOptions = ["待审批", "已审批", "已入账", "待核销", "已驳回/有争议", "已核销"] as const;
const adjustmentAttachmentOptions = ["附件已归档", "人工确认已归档", "附件已确认", "缺少附件", "附件待补", "不要求附件", "无需附件", "附件未记录"] as const;

function formatMoney(value: number) {
  return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

function overdueDays(record: BillingRecord) {
  if (!record.dueDate || record.status === "paid") return 0;
  const dueMs = new Date(record.dueDate).getTime();
  if (!Number.isFinite(dueMs)) return 0;
  return Math.max(0, Math.ceil((Date.now() - dueMs) / (24 * 60 * 60 * 1000)));
}

function disputeText(record: BillingRecord) {
  return record.customerMessage || record.statementCustomerMessage || "客户已提出费用异议，等待运营/财务复核。";
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
  if (record.status === "payment_submitted") return "待核销";
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

function approvalStatusTone(record: BillingRecord) {
  const label = adjustmentApprovalStatusLabel(record);
  if (label === "已核销" || label === "已入账") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (label === "已驳回/有争议") return "border-rose-200 bg-rose-50 text-rose-800";
  if (label === "待审批" || label === "待核销") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

function approvalRefId(record: BillingRecord) {
  return record.workOrderId || `adjustment:${record.id}`;
}

function linkedBillingRecordForWorkOrder(workOrder: CustomerWorkOrder, records: BillingRecord[]) {
  const referenceNo = workOrder.referenceNo?.trim();
  const byDirectReference = referenceNo
    ? records.find((record) => record.id === referenceNo || record.refId === referenceNo || record.statementId === referenceNo || record.workOrderId === workOrder.id)
    : records.find((record) => record.workOrderId === workOrder.id);
  if (byDirectReference) return byDirectReference;

  const haystack = [workOrder.title, workOrder.description, workOrder.internalNote, workOrder.referenceNo].filter(Boolean).join(" ");
  if (!haystack) return null;
  return (
    records.find((record) => {
      if (record.customerCode !== workOrder.customerCode) return false;
      return [record.id, record.refId, record.statementId].filter(Boolean).some((token) => haystack.includes(String(token)));
    }) ?? null
  );
}

export function OpsBillingDisputePanel({ customers, records, workOrders = [], documents = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [workOrderNotes, setWorkOrderNotes] = useState<Record<string, string>>({});
  const [workOrderConclusions, setWorkOrderConclusions] = useState<Record<string, FinanceReviewConclusion>>({});
  const [workOrderAmounts, setWorkOrderAmounts] = useState<Record<string, string>>({});
  const [workOrderConfirmations, setWorkOrderConfirmations] = useState<Record<string, string>>({});
  const [workOrderAttachmentConfirmed, setWorkOrderAttachmentConfirmed] = useState<Record<string, boolean>>({});
  const [adjustmentStatusFilter, setAdjustmentStatusFilter] = useState("all");
  const [adjustmentAttachmentFilter, setAdjustmentAttachmentFilter] = useState("all");
  const [adjustmentKindFilter, setAdjustmentKindFilter] = useState("all");
  const [error, setError] = useState("");
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.customerCode, customer])), [customers]);
  const disputedRecords = useMemo(
    () =>
      records
        .filter((record) => record.status === "disputed")
        .sort((a, b) => {
          const overdueDelta = overdueDays(b) - overdueDays(a);
          if (overdueDelta !== 0) return overdueDelta;
          return new Date(a.updatedAt ?? a.createdAt).getTime() - new Date(b.updatedAt ?? b.createdAt).getTime();
        }),
    [records],
  );
  const disputedAmount = disputedRecords.reduce((sum, record) => sum + record.amount, 0);
  const overdueCount = disputedRecords.filter((record) => overdueDays(record) > 0).length;
  const oldest = disputedRecords[0];
  const financeReviewWorkOrders = useMemo(
    () =>
      workOrders
        .filter((item) => item.financeReviewRequired && item.status !== "resolved" && item.status !== "cancelled")
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
          return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
        }),
    [workOrders],
  );
  const adjustmentApprovalRecords = useMemo(
    () =>
      records
        .filter((record) => record.adjustmentKind)
        .filter((record) => adjustmentKindFilter === "all" || record.adjustmentKind === adjustmentKindFilter)
        .filter((record) => adjustmentStatusFilter === "all" || adjustmentApprovalStatusLabel(record) === adjustmentStatusFilter)
        .filter((record) => adjustmentAttachmentFilter === "all" || adjustmentAttachmentStatusLabel(record) === adjustmentAttachmentFilter)
        .sort((a, b) => new Date(b.updatedAt ?? b.generatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.generatedAt ?? a.createdAt).getTime()),
    [adjustmentAttachmentFilter, adjustmentKindFilter, adjustmentStatusFilter, records],
  );
  const adjustmentPendingCount = records.filter((record) => record.adjustmentKind && ["待审批", "待核销", "已驳回/有争议"].includes(adjustmentApprovalStatusLabel(record))).length;
  const adjustmentLedgerTotal = adjustmentApprovalRecords.reduce((sum, record) => sum + Math.abs(record.amount), 0);

  function submit(record: BillingRecord, mode: "resolve" | "return") {
    const note = notes[record.id]?.trim() || (mode === "resolve" ? "已复核客户费用异议，账单恢复为已确认。" : "费用异议需客户重新确认，账单退回待确认。");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/billing/${encodeURIComponent(record.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "resolve" ? { action: "resolve_dispute", reviewNote: note } : { status: "pending_confirmation", reviewNote: note }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "账单争议处理失败，请稍后重试。");
        return;
      }

      setNotes((current) => ({ ...current, [record.id]: "" }));
      router.refresh();
    });
  }

  function reviewFinanceWorkOrder(workOrder: CustomerWorkOrder, status: "processing" | "waiting_customer" | "resolved", billingRecordId?: string) {
    const note = workOrderNotes[workOrder.id]?.trim();
    const reviewConclusion = workOrderConclusions[workOrder.id] ?? "keep_bill";
    const adjustmentAmount = workOrderAmounts[workOrder.id]?.trim();
    const confirmation = workOrderConfirmations[workOrder.id]?.trim();
    const approvalAttachmentConfirmed = workOrderAttachmentConfirmed[workOrder.id] === true;
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review_finance_work_order", id: workOrder.id, status, note, billingRecordId, reviewConclusion, adjustmentAmount, confirmation, approvalAttachmentConfirmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "费用复核工单处理失败，请稍后重试。");
        return;
      }

      setWorkOrderNotes((current) => ({ ...current, [workOrder.id]: "" }));
      setWorkOrderAmounts((current) => ({ ...current, [workOrder.id]: "" }));
      setWorkOrderConfirmations((current) => ({ ...current, [workOrder.id]: "" }));
      setWorkOrderAttachmentConfirmed((current) => ({ ...current, [workOrder.id]: false }));
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-rose-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <AlertTriangle size={18} className="text-rose-600" />
            账单争议复核队列
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">集中处理客户提出的费用异议，财务可查看金额、逾期、客户说明，并将账单解除异议或退回客户确认。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[460px] sm:grid-cols-4">
          <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-rose-700">争议账单</p>
            <p className="mt-1 text-xl font-semibold text-rose-950">{disputedRecords.length}</p>
          </div>
          <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-800">争议金额</p>
            <p className="mt-1 text-xl font-semibold text-amber-950">{formatMoney(disputedAmount)}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-600">已逾期</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{overdueCount}</p>
          </div>
          <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-indigo-700">待复核工单</p>
            <p className="mt-1 text-xl font-semibold text-indigo-950">{financeReviewWorkOrders.length}</p>
          </div>
        </div>
      </div>

      {oldest ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <Clock3 size={14} />
          最早待处理：{oldest.id} / {customerMap.get(oldest.customerCode)?.companyName ?? oldest.customerCode} / 逾期 {overdueDays(oldest)} 天
        </div>
      ) : null}

      {financeReviewWorkOrders.length > 0 ? (
        <div className="mt-4 rounded-md border border-indigo-100 bg-indigo-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-indigo-950">待财务复核工单</h3>
              <p className="mt-1 text-xs leading-5 text-indigo-800">客户提交的账单争议、运费差异和物流费用复核会自动进入这里，财务可先查看证据包再处理账单。</p>
            </div>
            <a className="inline-flex min-h-9 items-center justify-center rounded-md border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-800 hover:border-indigo-300" href="/api/downloads?kind=logistics-evidence">
              下载物流证据包
            </a>
          </div>
          <div className="mt-3 grid gap-2">
            {financeReviewWorkOrders.slice(0, 5).map((item) => {
              const customer = customerMap.get(item.customerCode);
              const linkedBillingRecord = linkedBillingRecordForWorkOrder(item, records);
              const adjustmentRecords = records.filter((record) => record.workOrderId === item.id && record.adjustmentKind);
              return (
                <article className="rounded-md border border-indigo-100 bg-white p-3 text-xs leading-5" key={item.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-slate-500">{item.id}</span>
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800">财务复核</span>
                    {item.riskTag === "logistics_fee_review" ? <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-semibold text-indigo-800">运费差异</span> : null}
                    {item.riskTag === "billing_dispute" ? <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 font-semibold text-orange-800">账单争议</span> : null}
                  </div>
                  <p className="mt-2 font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-slate-500">{customer?.companyName ?? item.customerCode} / {item.customerCode} / {item.category}{item.referenceNo ? ` / ${item.referenceNo}` : ""}</p>
                  {linkedBillingRecord ? (
                    <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                      已匹配账单：{linkedBillingRecord.id} / {linkedBillingRecord.title} / £{linkedBillingRecord.amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })} / {linkedBillingRecord.status}
                    </p>
                  ) : (
                    <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 font-semibold text-slate-500">未自动匹配账单，完成复核只会关闭工单，不会改动账单状态。</p>
                  )}
                  {adjustmentRecords.length > 0 ? (
                    <div className="mt-2 grid gap-1">
                      {adjustmentRecords.map((record) => (
                        <p className="rounded-md bg-cyan-50 px-2 py-1 font-semibold text-cyan-800" key={record.id}>
                          已生成{record.adjustmentKind === "compensation" ? "赔付抵扣" : "费用调账"}：{record.id} / {formatMoney(record.amount)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-slate-600">{item.description}</p>
                  {item.internalNote ? <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-amber-900">内部提示：{item.internalNote}</p> : null}
                  {item.linkedDownloadHref ? (
                    <a className="mt-2 inline-flex min-h-8 items-center rounded-md border border-slate-200 px-3 font-semibold text-slate-800 hover:border-slate-300" href={item.linkedDownloadHref}>
                      查看证据/账单
                    </a>
                  ) : null}
                  <div className="mt-3 grid gap-2 xl:grid-cols-[1fr_160px_120px_150px_auto]">
                    <input
                      className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                      onChange={(event) => setWorkOrderNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="复核说明，可同步给客户，例如：请补充承运商扣费截图。"
                      value={workOrderNotes[item.id] ?? ""}
                    />
                    <select
                      className="min-h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
                      onChange={(event) => setWorkOrderConclusions((current) => ({ ...current, [item.id]: event.target.value as FinanceReviewConclusion }))}
                      value={workOrderConclusions[item.id] ?? "keep_bill"}
                    >
                      <option value="keep_bill">维持原账单</option>
                      <option value="fee_adjustment">同意调账</option>
                      <option value="compensation">赔付抵扣</option>
                    </select>
                    <input
                      className="min-h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-500"
                      inputMode="decimal"
                      onChange={(event) => setWorkOrderAmounts((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="金额GBP"
                      value={workOrderAmounts[item.id] ?? ""}
                    />
                    <input
                      className="min-h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-500"
                      onChange={(event) => setWorkOrderConfirmations((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder={`二次确认 ${item.id}`}
                      value={workOrderConfirmations[item.id] ?? ""}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <button className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-2 font-semibold text-cyan-800 disabled:opacity-60" disabled={isPending} onClick={() => reviewFinanceWorkOrder(item, "processing", linkedBillingRecord?.id)} type="button">
                        接单
                      </button>
                      <button className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 font-semibold text-amber-800 disabled:opacity-60" disabled={isPending} onClick={() => reviewFinanceWorkOrder(item, "waiting_customer", linkedBillingRecord?.id)} type="button">
                        需补充
                      </button>
                      <button className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 font-semibold text-emerald-800 disabled:opacity-60" disabled={isPending} onClick={() => reviewFinanceWorkOrder(item, "resolved", linkedBillingRecord?.id)} type="button">
                        完成
                      </button>
                    </div>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      checked={workOrderAttachmentConfirmed[item.id] === true}
                      className="h-4 w-4 rounded border-slate-300"
                      onChange={(event) => setWorkOrderAttachmentConfirmed((current) => ({ ...current, [item.id]: event.target.checked }))}
                      type="checkbox"
                    />
                    审批附件已上传或已归档
                  </label>
                  <DocumentUploadPanel
                    category="other"
                    customerCode={item.customerCode}
                    documents={documents.filter((document) => document.refType === "approval" && document.refId === item.id && document.customerCode === item.customerCode)}
                    refId={item.id}
                    refType="approval"
                    title="财务复核审批附件"
                    uploadEndpoint="/api/ops/documents"
                  />
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-md border border-cyan-100 bg-cyan-50 p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-cyan-950">调账/赔付审批台账</h3>
            <p className="mt-1 text-xs leading-5 text-cyan-800">把已生成的费用调账、赔付抵扣按审批状态、附件状态和类型集中展示，方便财务复核、补附件、导出和追溯。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800">待跟进 {adjustmentPendingCount}</span>
            <span className="rounded-md border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-800">当前金额 {formatMoney(adjustmentLedgerTotal)}</span>
            <a
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-xs font-semibold text-cyan-800 hover:border-cyan-300"
              href={`/api/ops/reports/finance-adjustments?kind=${encodeURIComponent(adjustmentKindFilter)}&approvalStatus=${encodeURIComponent(adjustmentStatusFilter)}&attachmentStatus=${encodeURIComponent(adjustmentAttachmentFilter)}`}
            >
              <Download size={14} />
              导出当前筛选
            </a>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-cyan-900">
            调账类型
            <select className="min-h-9 rounded-md border border-cyan-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setAdjustmentKindFilter(event.target.value)} value={adjustmentKindFilter}>
              <option value="all">全部类型</option>
              <option value="fee_adjustment">费用调账</option>
              <option value="compensation">赔付抵扣</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-cyan-900">
            审批/入账状态
            <select className="min-h-9 rounded-md border border-cyan-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setAdjustmentStatusFilter(event.target.value)} value={adjustmentStatusFilter}>
              <option value="all">全部状态</option>
              {adjustmentStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-cyan-900">
            附件状态
            <select className="min-h-9 rounded-md border border-cyan-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setAdjustmentAttachmentFilter(event.target.value)} value={adjustmentAttachmentFilter}>
              <option value="all">全部附件状态</option>
              {adjustmentAttachmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-2">
          {adjustmentApprovalRecords.slice(0, 8).map((record) => {
            const customer = customerMap.get(record.customerCode);
            const refId = approvalRefId(record);
            const approvalDocuments = documents.filter((document) => document.refType === "approval" && document.refId === refId && document.customerCode === record.customerCode);
            return (
              <article className="rounded-md border border-cyan-100 bg-white p-3 text-xs leading-5" key={record.id}>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-slate-500">{record.id}</span>
                      <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 font-semibold text-cyan-800">{adjustmentLabel(record)}</span>
                      <span className={`rounded-md border px-2 py-1 font-semibold ${approvalStatusTone(record)}`}>{adjustmentApprovalStatusLabel(record)}</span>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">{adjustmentAttachmentStatusLabel(record)}</span>
                    </div>
                    <p className="mt-2 font-semibold text-slate-950">{record.title}</p>
                    <p className="mt-1 text-slate-500">
                      {customer?.companyName ?? record.customerCode} / {record.customerCode} / 金额 {formatMoney(record.amount)}
                    </p>
                    <p className="mt-1 text-slate-500">
                      来源工单 {record.workOrderId || "未记录"} / 来源账单 {record.adjustmentSourceRecordId || "未记录"} / 审批附件引用 {refId}
                    </p>
                    {record.adjustmentApprovalRuleName || record.adjustmentApprovalRuleNote ? (
                      <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-amber-900">
                        审批规则：{record.adjustmentApprovalRuleName || "未命名规则"}{record.adjustmentApprovalRuleNote ? ` / ${record.adjustmentApprovalRuleNote}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a className="inline-flex min-h-8 items-center rounded-md border border-slate-200 px-2.5 font-semibold text-slate-700 hover:bg-slate-50" href={`/api/ops/reports/finance-adjustments?keyword=${encodeURIComponent(record.id)}`}>
                      导出该记录
                    </a>
                    <span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 font-semibold text-slate-600">附件 {approvalDocuments.length} 个</span>
                  </div>
                </div>
                <div className="mt-2">
                  <BillingTimeline compact emptyText="暂无调账/赔付处理记录" events={record.approvalTimeline} title="审批与入账进度" />
                </div>
                <DocumentUploadPanel
                  category="other"
                  customerCode={record.customerCode}
                  documents={approvalDocuments}
                  refId={refId}
                  refType="approval"
                  title="调账/赔付审批附件"
                  uploadEndpoint="/api/ops/documents"
                />
              </article>
            );
          })}
          {adjustmentApprovalRecords.length === 0 ? (
            <div className="rounded-md border border-cyan-100 bg-white px-4 py-6 text-center text-sm text-cyan-700">当前筛选下暂无调账/赔付审批记录。</div>
          ) : null}
        </div>
        {adjustmentApprovalRecords.length > 8 ? <p className="mt-3 text-xs text-cyan-700">已展示最新 8 条，完整明细可用当前筛选导出。</p> : null}
      </div>

      <div className="mt-4 grid gap-3">
        {disputedRecords.slice(0, 8).map((record) => {
          const customer = customerMap.get(record.customerCode);
          const days = overdueDays(record);
          return (
            <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={record.id}>
              <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1.2fr]">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-500">{record.id}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">{record.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {customer?.companyName ?? record.customerCode} / {record.customerCode} / {record.refType} {record.refId}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-white px-3 py-2">
                    <p className="font-semibold text-slate-500">金额</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{formatMoney(record.amount)}</p>
                  </div>
                  <div className="rounded-md bg-white px-3 py-2">
                    <p className="font-semibold text-slate-500">到期</p>
                    <p className={days > 0 ? "mt-1 text-sm font-semibold text-rose-700" : "mt-1 text-sm font-semibold text-slate-950"}>{days > 0 ? `逾期 ${days} 天` : record.dueDate || "-"}</p>
                  </div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                  <p className="font-semibold text-slate-900">客户说明</p>
                  <p className="mt-1">{disputeText(record)}</p>
                        {record.reviewNote || record.statementReviewNote ? <p className="mt-2 text-slate-500">上次复核：{record.reviewNote || record.statementReviewNote}</p> : null}
                        <div className="mt-2">
                          <BillingTimeline compact emptyText="暂无账单处理记录" events={record.approvalTimeline} title="账单处理进度" />
                        </div>
                      </div>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto]">
                <textarea
                  className="min-h-10 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
                  onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                  placeholder="填写复核说明，例如：已核对仓租和操作费，客户异议成立/不成立。"
                  value={notes[record.id] ?? ""}
                />
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    disabled={isPending}
                    onClick={() => submit(record, "resolve")}
                    type="button"
                  >
                    <CheckCircle2 size={14} />
                    解除异议
                  </button>
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    disabled={isPending}
                    onClick={() => submit(record, "return")}
                    type="button"
                  >
                    <RotateCcw size={14} />
                    退回确认
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {disputedRecords.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">暂无待复核的账单争议。</div>
        ) : null}
      </div>
      {disputedRecords.length > 8 ? <p className="mt-3 text-xs text-slate-500">已展示最紧急的 8 条争议，其余可在下方账单复核表继续处理。</p> : null}
      {error ? <p className="mt-3 text-xs font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}
