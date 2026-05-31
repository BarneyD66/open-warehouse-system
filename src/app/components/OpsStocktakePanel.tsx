"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ClipboardCheck, PackageSearch, Send } from "lucide-react";
import type { StocktakeBatch } from "@/lib/warehouseCoreStore";

export type StocktakeCandidate = {
  balanceId: string;
  customerCode: string;
  skuCode: string;
  warehouseCode: string;
  locationCode?: string;
  systemAvailableQty: number;
  systemReservedQty: number;
  alertQty: number;
  agingDays: number;
  inboundQty: number;
  riskLabels: string[];
};

const statusLabel: Record<StocktakeBatch["status"], string> = {
  draft: "待盘点",
  counting: "盘点中",
  pending_approval: "待审批",
  completed: "已完成",
  cancelled: "已取消",
};

function numberText(value: number) {
  return value.toLocaleString("zh-CN");
}

export function OpsStocktakePanel({ candidates, batches }: { candidates: StocktakeCandidate[]; batches: StocktakeBatch[] }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const activeBatch = useMemo(() => batches.find((item) => item.status === "draft" || item.status === "counting"), [batches]);
  const openBatches = batches.filter((item) => item.status !== "completed" && item.status !== "cancelled");
  const pendingApprovalBatches = batches.filter((item) => item.status === "pending_approval");
  const recentClosedBatches = batches.filter((item) => item.status === "completed" || item.status === "cancelled").slice(0, 3);

  function post(body: Record<string, unknown>, successText: string) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/stocktakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "操作失败");
        return;
      }
      setMessage(successText);
      window.setTimeout(() => window.location.reload(), 350);
    });
  }

  function createBatch() {
    post(
      {
        action: "create_batch",
        balanceIds: candidates.slice(0, 8).map((item) => item.balanceId),
        note: "按库存风险自动创建盘点批次",
      },
      "已创建盘点批次",
    );
  }

  function countItem(batchId: string, balanceId: string, systemAvailableQty: number) {
    const value = counts[`${batchId}:${balanceId}`] ?? String(systemAvailableQty);
    post({ action: "count_item", batchId, balanceId, countedAvailableQty: Number(value), note: "仓库/运营盘点录入" }, "已保存实盘数");
  }

  function submitBatch(batchId: string) {
    post({ action: "submit_batch", batchId }, "盘点差异已提交审批");
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-700">Stocktake</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-950">
            <ClipboardCheck size={18} className="text-cyan-700" />
            库存盘点批次
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            按 SKU、仓库和库位创建盘点任务，仓库录入实盘数后自动生成差异审批，审批通过才写入库存流水并关闭盘点批次。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={pending || candidates.length === 0} onClick={createBatch} type="button">
            <PackageSearch size={16} />
            创建风险盘点
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          ["候选 SKU", candidates.length],
          ["未完批次", openBatches.length],
          ["待审批次", pendingApprovalBatches.length],
          ["当前批次", activeBatch?.id ?? "-"],
        ].map(([label, value]) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={label}>
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      {message ? <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      {activeBatch ? (
        <div className="mt-4 rounded-md border border-slate-200">
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">{activeBatch.id} / {statusLabel[activeBatch.status]}</h3>
              <p className="mt-1 text-xs text-slate-500">{activeBatch.warehouseCode} / {activeBatch.itemCount} 个 SKU</p>
            </div>
            <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-60" disabled={pending || activeBatch.items.some((item) => typeof item.countedAvailableQty !== "number")} onClick={() => submitBatch(activeBatch.id)} type="button">
              <Send size={14} />
              提交差异审批
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU / 库位</th>
                  <th className="px-4 py-3">账面</th>
                  <th className="px-4 py-3">实盘</th>
                  <th className="px-4 py-3">差异</th>
                  <th className="px-4 py-3 text-right">保存</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeBatch.items.map((item) => {
                  const key = `${activeBatch.id}:${item.balanceId}`;
                  const currentValue = counts[key] ?? String(item.countedAvailableQty ?? item.systemAvailableQty);
                  const diff = Number(currentValue) - item.systemAvailableQty;
                  return (
                    <tr key={item.balanceId}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-slate-950">{item.skuCode}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.customerCode} / {item.locationCode || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        可售 {numberText(item.systemAvailableQty)} / 占用 {numberText(item.systemReservedQty)}
                      </td>
                      <td className="px-4 py-3">
                        <input className="h-9 w-28 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500" min={0} onChange={(event) => setCounts((prev) => ({ ...prev, [key]: event.target.value }))} type="number" value={currentValue} />
                      </td>
                      <td className={`px-4 py-3 text-xs font-semibold ${diff === 0 ? "text-emerald-700" : "text-rose-700"}`}>{diff > 0 ? `+${diff}` : diff}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={pending} onClick={() => countItem(activeBatch.id, item.balanceId, item.systemAvailableQty)} type="button">
                          <CheckCircle2 size={14} />
                          保存
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {pendingApprovalBatches.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">待审批盘点批次</p>
          <div className="mt-2 grid gap-2">
            {pendingApprovalBatches.slice(0, 4).map((batch) => (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs text-slate-600" key={batch.id}>
                <span className="font-mono font-semibold text-slate-950">{batch.id}</span>
                <span>{batch.warehouseCode} / 差异 {batch.differenceCount} 行 / 合计 {batch.totalDifferenceQty > 0 ? `+${batch.totalDifferenceQty}` : batch.totalDifferenceQty}</span>
                <span>审批全部完成后自动关闭</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recentClosedBatches.length > 0 ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-900">最近完成盘点</p>
          <div className="mt-2 grid gap-2">
            {recentClosedBatches.map((batch) => (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-600" key={batch.id}>
                <span className="font-mono font-semibold text-slate-950">{batch.id}</span>
                <span>{statusLabel[batch.status]} / 差异 {batch.differenceCount} 行</span>
                <span>{batch.completedBy ? `${batch.completedBy} 完成` : batch.updatedAt ? "已更新" : "已关闭"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">风险 SKU</th>
              <th className="px-4 py-3">仓库 / 库位</th>
              <th className="px-4 py-3">库存</th>
              <th className="px-4 py-3">风险</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.slice(0, 8).map((item) => (
              <tr key={item.balanceId}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-semibold text-slate-950">{item.skuCode}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.customerCode}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{item.warehouseCode} / {item.locationCode || "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">可售 {numberText(item.systemAvailableQty)} / 安全 {numberText(item.alertQty)} / 库龄 {numberText(item.agingDays)} 天</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(item.riskLabels.length ? item.riskLabels : ["常规抽盘"]).map((label) => (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800" key={label}>{label}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {candidates.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>暂无盘点候选 SKU</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
