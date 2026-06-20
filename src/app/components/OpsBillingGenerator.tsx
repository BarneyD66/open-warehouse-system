"use client";

import { useMemo, useState, useTransition } from "react";
import { Calculator, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DocumentRecord } from "@/lib/documentStore";
import type { InboundSubmission } from "@/lib/localStore";
import type { BillingFeeCode, BillingRefType, CoreOutboundOrder, CustomerProfile, ReturnOrder } from "@/lib/warehouseCoreStore";
import { DocumentUploadPanel } from "./DocumentUploadPanel";

type FeeRuleView = {
  feeCode: BillingFeeCode;
  label: string;
  refType: BillingRefType;
  unitLabel: string;
  unitPrice: number;
  description: string;
};

type RefOption = {
  id: string;
  label: string;
  quantity: number;
};

type Props = {
  customers: CustomerProfile[];
  inboundSubmissions: InboundSubmission[];
  outboundOrders: CoreOutboundOrder[];
  returnOrders: ReturnOrder[];
  documents?: DocumentRecord[];
};

const feeRules: FeeRuleView[] = [
  { feeCode: "inbound_carton", label: "入库收货", refType: "inbound", unitLabel: "箱", unitPrice: 0.35, description: "按入库箱数生成收货处理费" },
  { feeCode: "outbound_order", label: "出库基础处理", refType: "outbound", unitLabel: "单", unitPrice: 0.65, description: "按出库订单数生成基础拣配费" },
  { feeCode: "outbound_item", label: "出库 SKU 件数", refType: "outbound", unitLabel: "件", unitPrice: 0.18, description: "按商品件数生成拣货操作费" },
  { feeCode: "return_inspection", label: "退货质检", refType: "return", unitLabel: "件", unitPrice: 1.2, description: "按退货件数生成质检费" },
  { feeCode: "return_restock", label: "退货上架", refType: "return", unitLabel: "件", unitPrice: 0.45, description: "按重新入库件数生成上架费" },
  { feeCode: "return_disposal", label: "退货销毁", refType: "return", unitLabel: "件", unitPrice: 0.8, description: "按销毁件数生成处置费" },
  { feeCode: "storage_daily", label: "仓储日租", refType: "storage", unitLabel: "CBM/天", unitPrice: 0.62, description: "按体积和天数生成仓储费" },
  { feeCode: "manual_service", label: "人工服务", refType: "manual", unitLabel: "项", unitPrice: 1, description: "临时增值服务或费用调整" },
];

function money(value: number) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function OpsBillingGenerator({ customers, inboundSubmissions, outboundOrders, returnOrders, documents = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customerCode, setCustomerCode] = useState(customers[0]?.customerCode ?? "");
  const [feeCode, setFeeCode] = useState<BillingFeeCode>("outbound_order");
  const [refId, setRefId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"pending_confirmation" | "draft">("pending_confirmation");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const currentRule = feeRules.find((item) => item.feeCode === feeCode) ?? feeRules[0];
  const refOptions = useMemo<RefOption[]>(() => {
    if (currentRule.refType === "inbound") {
      return inboundSubmissions
        .filter((item) => !customerCode || item.customerCode === customerCode)
        .map((item) => ({ id: item.id, label: `${item.id} / ${item.customer || item.customerCode || "客户"} / ${item.cartons} 箱`, quantity: item.cartons || 1 }));
    }

    if (currentRule.refType === "outbound") {
      return outboundOrders
        .filter((item) => !customerCode || item.customerCode === customerCode)
        .map((item) => ({
          id: item.id,
          label: `${item.id} / ${item.channel} / ${item.orderCount} 单`,
          quantity: currentRule.feeCode === "outbound_item" ? item.skuLines?.reduce((sum, line) => sum + line.quantity, 0) || item.orderCount : item.orderCount,
        }));
    }

    if (currentRule.refType === "return") {
      return returnOrders
        .filter((item) => !customerCode || item.customerCode === customerCode)
        .filter((item) => {
          if (currentRule.feeCode === "return_restock") return item.status === "restocked" || item.resolution === "restock";
          if (currentRule.feeCode === "return_disposal") return item.status === "disposed" || item.resolution === "dispose";
          return ["received", "inspection", "restocked", "repair", "disposed", "closed", "exception"].includes(item.status);
        })
        .map((item) => ({
          id: item.id,
          label: `${item.id} / ${item.platform} / ${item.inspectionResult || item.status}`,
          quantity: item.skuLines.reduce((sum, line) => sum + line.quantity, 0) || 1,
        }));
    }

    return [];
  }, [currentRule.feeCode, currentRule.refType, customerCode, inboundSubmissions, outboundOrders, returnOrders]);

  const amount = Math.round((Number(quantity || 0) * currentRule.unitPrice) * 100) / 100;

  function updateFeeCode(nextFeeCode: BillingFeeCode) {
    const nextRule = feeRules.find((item) => item.feeCode === nextFeeCode) ?? feeRules[0];
    setFeeCode(nextFeeCode);
    setRefId("");
    setQuantity(nextRule.refType === "manual" ? "1" : "1");
  }

  function updateRef(nextRefId: string) {
    setRefId(nextRefId);
    const selected = refOptions.find((item) => item.id === nextRefId);
    if (selected) setQuantity(String(selected.quantity || 1));
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerCode, feeCode, quantity: Number(quantity), refId, dueDate, status, note }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "费用生成失败，请稍后重试。");
        return;
      }

      setNote("");
      router.refresh();
    });
  }

  function autoGenerate() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/billing/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerCode }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "自动生成费用失败，请稍后重试。");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Calculator size={18} className="text-[#0E7490]" />
            费用规则生成
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">按入库、出库、退货和仓储规则自动计算金额，并生成客户可确认的账单。</p>
        </div>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-right">
          <p className="text-xs font-semibold text-cyan-800">预计金额</p>
          <p className="font-mono text-lg font-semibold text-slate-950">£{money(Number.isFinite(amount) ? amount : 0)}</p>
        </div>
      </div>
      <div className="mt-3">
        <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending || !customerCode} onClick={autoGenerate} type="button">
          <Calculator size={14} />
          自动生成出库费和仓租
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          客户
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setCustomerCode(event.target.value)} value={customerCode}>
            {customers.map((item) => (
              <option key={item.customerCode} value={item.customerCode}>
                {item.companyName} / {item.customerCode}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          费用规则
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => updateFeeCode(event.target.value as BillingFeeCode)} value={feeCode}>
            {feeRules.map((item) => (
              <option key={item.feeCode} value={item.feeCode}>
                {item.label} / £{money(item.unitPrice)} 每{item.unitLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          关联单据
          {refOptions.length > 0 ? (
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => updateRef(event.target.value)} value={refId}>
              <option value="">按日期生成</option>
              {refOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : (
            <input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setRefId(event.target.value)} placeholder="例如：2026-05-storage" value={refId} />
          )}
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          数量
          <input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" min="0.01" onChange={(event) => setQuantity(event.target.value)} step="0.01" type="number" value={quantity} />
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_2fr_auto]">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          到期日
          <input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          生成状态
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setStatus(event.target.value as "pending_confirmation" | "draft")} value={status}>
            <option value="pending_confirmation">发送客户确认</option>
            <option value="draft">先保存草稿</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          备注
          <input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder={currentRule.description} value={note} />
        </label>
        <button className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || !customerCode || Number(quantity) <= 0} onClick={submit} type="button">
          <Send size={15} />
          生成账单
        </button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {feeCode === "manual_service" ? (
        <DocumentUploadPanel
          category="other"
          customerCode={customerCode}
          documents={documents.filter((document) => document.refType === "approval" && document.refId === `manual-fee:${customerCode}`)}
          refId={`manual-fee:${customerCode}`}
          refType="approval"
          title="手工费用审批附件"
          uploadEndpoint="/api/ops/documents"
        />
      ) : null}
    </section>
  );
}
