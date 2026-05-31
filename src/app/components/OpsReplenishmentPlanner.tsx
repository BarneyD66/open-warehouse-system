"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, ClipboardList, RefreshCw, TrendingUp } from "lucide-react";
import type { ReplenishmentPlan, ReplenishmentSuggestion, TransferOrder } from "@/lib/warehouseCoreStore";

const statusLabel: Record<ReplenishmentSuggestion["status"], string> = {
  replenish_now: "建议补货",
  watch: "关注",
  healthy: "正常",
};

const statusClass: Record<ReplenishmentSuggestion["status"], string> = {
  replenish_now: "border-rose-200 bg-rose-50 text-rose-700",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function numberText(value: number) {
  return value.toLocaleString("zh-CN");
}

export function OpsReplenishmentPlanner({
  suggestions,
  plans,
  transferOrders,
}: {
  suggestions: ReplenishmentSuggestion[];
  plans: ReplenishmentPlan[];
  transferOrders: TransferOrder[];
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const riskySuggestions = useMemo(() => suggestions.filter((item) => item.status !== "healthy").slice(0, 8), [suggestions]);
  const activePlans = plans.filter((item) => !["received", "cancelled"].includes(item.status));
  const activeTransfers = transferOrders.filter((item) => !["received", "cancelled"].includes(item.status));
  const recommendedTotal = riskySuggestions.reduce((sum, item) => sum + item.recommendedQty, 0);

  function postAction(action: "create_plan" | "create_transfer", item: ReplenishmentSuggestion) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/ops/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          balanceId: item.balanceId,
          plannedQty: item.recommendedQty || item.alertQty,
          quantity: item.recommendedQty || item.alertQty,
          toWarehouseCode: item.warehouseCode,
          note: item.reason,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; plan?: ReplenishmentPlan; transfer?: TransferOrder };
      if (!response.ok) {
        setError(payload.error || "操作失败");
        return;
      }
      setMessage(action === "create_plan" ? `已生成补货计划 ${payload.plan?.id ?? ""}` : `已创建调拨单 ${payload.transfer?.id ?? ""}`);
      window.setTimeout(() => window.location.reload(), 350);
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-700">Replenishment</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-950">
            <TrendingUp size={18} className="text-cyan-700" />
            补货建议与调拨计划
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            按可售、占用、在途和安全库存测算补货量，运营可直接生成补货计划或跨仓调拨单。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["预警 SKU", riskySuggestions.length],
            ["建议补货", recommendedTotal],
            ["在办单据", activePlans.length + activeTransfers.length],
          ].map(([label, value]) => (
            <div className="min-w-24 rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={label}>
              <p className="text-[11px] font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {message ? <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">SKU / 仓库</th>
              <th className="px-4 py-3">库存</th>
              <th className="px-4 py-3">测算</th>
              <th className="px-4 py-3">建议</th>
              <th className="px-4 py-3 text-right">动作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {riskySuggestions.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 align-top">
                  <p className="font-mono text-xs font-semibold text-slate-950">{item.skuCode}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.customerCode} / {item.warehouseCode}</p>
                  {item.locationCode ? <p className="mt-1 font-mono text-[11px] text-cyan-700">库位 {item.locationCode}</p> : null}
                </td>
                <td className="px-4 py-3 align-top text-xs text-slate-600">
                  <p>可售 {numberText(item.availableQty)} / 占用 {numberText(item.reservedQty)}</p>
                  <p className="mt-1">在途 {numberText(item.inboundQty)} / 安全 {numberText(item.alertQty)}</p>
                </td>
                <td className="px-4 py-3 align-top text-xs text-slate-600">
                  <p>预计日销 {numberText(item.dailySalesEstimate)}</p>
                  <p className="mt-1">覆盖 {numberText(item.daysOfCover)} 天</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}>{statusLabel[item.status]}</span>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-slate-600">建议数量 {numberText(item.recommendedQty)}。{item.reason}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={pending} onClick={() => postAction("create_plan", item)} type="button">
                      <ClipboardList size={14} />
                      补货计划
                    </button>
                    <button className="inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={pending} onClick={() => postAction("create_transfer", item)} type="button">
                      <ArrowRightLeft size={14} />
                      调拨单
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {riskySuggestions.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                  暂无需要补货的 SKU
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ClipboardList size={16} className="text-cyan-700" />
            最近补货计划
          </h3>
          <div className="mt-3 grid gap-2">
            {plans.slice(0, 4).map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-xs" key={item.id}>
                <span className="font-mono font-semibold text-slate-900">{item.id}</span>
                <span className="text-slate-500">{item.skuCode}</span>
                <span className="font-semibold text-slate-700">{numberText(item.plannedQty)}</span>
                <span className="text-slate-500">{item.status}</span>
              </div>
            ))}
            {plans.length === 0 ? <p className="text-xs text-slate-500">暂无补货计划</p> : null}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <RefreshCw size={16} className="text-cyan-700" />
            最近调拨单
          </h3>
          <div className="mt-3 grid gap-2">
            {transferOrders.slice(0, 4).map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-xs" key={item.id}>
                <span className="font-mono font-semibold text-slate-900">{item.id}</span>
                <span className="text-slate-500">{item.fromWarehouseCode} → {item.toWarehouseCode}</span>
                <span className="font-semibold text-slate-700">{numberText(item.quantity)}</span>
                <span className="text-slate-500">{item.status}</span>
              </div>
            ))}
            {transferOrders.length === 0 ? <p className="text-xs text-slate-500">暂无调拨单</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
