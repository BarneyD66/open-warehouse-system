"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, CheckCircle2, Loader2, MapPin, Send, XCircle } from "lucide-react";
import type { InventoryAdjustmentRequest, InventoryBalance, WarehouseLocation, WarehouseLocationZoneType } from "@/lib/warehouseCoreStore";

type Props = {
  balances: InventoryBalance[];
  locations: WarehouseLocation[];
  adjustments: InventoryAdjustmentRequest[];
  canReview?: boolean;
};

const statusLabels: Record<InventoryAdjustmentRequest["status"], string> = {
  pending: "待审批",
  approved: "已完成",
  rejected: "已驳回",
};

const statusClass: Record<InventoryAdjustmentRequest["status"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
};

const zoneTypeLabels: Record<WarehouseLocationZoneType, string> = {
  standard: "常规库位",
  receiving: "收货暂存",
  returns: "退货处理",
  defective: "残次品位",
  frozen: "冻结库存位",
  oversize: "大件库位",
};

function balanceQty(balance: InventoryBalance) {
  return balance.availableQty + balance.reservedQty + (balance.frozenQty ?? 0) + (balance.defectiveQty ?? 0);
}

export function WarehouseInventoryMovePanel({ balances, locations, adjustments, canReview = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeLocations = useMemo(() => locations.filter((item) => item.status === "active"), [locations]);
  const [balanceId, setBalanceId] = useState(balances[0]?.id ?? "");
  const [targetLocation, setTargetLocation] = useState(activeLocations[0]?.locationCode ?? "");
  const [note, setNote] = useState("");
  const [reviewNoteById, setReviewNoteById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = balances.find((item) => item.id === balanceId);
  const moveTasks = adjustments.filter((item) => item.controlAction === "move_location").slice(0, 8);
  const pendingMoveTasks = moveTasks.filter((item) => item.status === "pending");

  const targetOptions = useMemo(() => {
    if (!selected) return activeLocations;
    return activeLocations.filter((item) => item.locationCode !== selected.locationCode);
  }, [activeLocations, selected]);
  const effectiveTargetLocation = targetOptions.some((item) => item.locationCode === targetLocation) ? targetLocation : targetOptions[0]?.locationCode ?? "";

  const utilizationByLocation = useMemo(() => {
    const result = new Map<string, { usedQty: number; skuKeys: Set<string> }>();
    for (const balance of balances) {
      if (!balance.locationCode) continue;
      const current = result.get(balance.locationCode) ?? { usedQty: 0, skuKeys: new Set<string>() };
      const totalQty = balanceQty(balance);
      current.usedQty += totalQty;
      if (totalQty > 0) current.skuKeys.add(`${balance.customerCode}:${balance.skuCode}`);
      result.set(balance.locationCode, current);
    }
    return result;
  }, [balances]);

  const selectedTarget = locations.find((item) => item.locationCode === effectiveTargetLocation);
  const selectedTargetUsage = selectedTarget ? utilizationByLocation.get(selectedTarget.locationCode) ?? { usedQty: 0, skuKeys: new Set<string>() } : undefined;
  const movingQty = selected ? balanceQty(selected) : 0;
  const remainingAfterMove = selectedTarget?.capacityQty === undefined || !selectedTargetUsage ? undefined : selectedTarget.capacityQty - selectedTargetUsage.usedQty - movingQty;
  const targetWarning =
    selectedTarget && typeof remainingAfterMove === "number" && remainingAfterMove < 0
      ? `容量不足：还差 ${Math.abs(remainingAfterMove)} 件`
      : selectedTarget?.allowMixedSku === false && selectedTargetUsage && selectedTargetUsage.skuKeys.size > 0
        ? "该库位不允许混放，提交后系统会再次校验"
        : "";

  function submitMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!selected) {
      setError("请选择要移库的库存记录。");
      return;
    }
    if (!effectiveTargetLocation) {
      setError("请选择目标库位。");
      return;
    }
    if (selected.locationCode === effectiveTargetLocation) {
      setError("目标库位不能和当前库位相同。");
      return;
    }
    if (!note.trim()) {
      setError("请填写移库原因，方便审批和追踪。");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/ops/inventory-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balanceId: selected.id,
          customerCode: selected.customerCode,
          skuCode: selected.skuCode,
          controlAction: "move_location",
          nextLocationCode: effectiveTargetLocation,
          note,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "移库申请提交失败，请稍后重试。");
        return;
      }
      setNote("");
      setMessage("移库申请已提交，审批通过后会更新库存库位。");
      router.refresh();
    });
  }

  function review(id: string, action: "approve" | "reject") {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/inventory-adjustments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reviewNote: reviewNoteById[id] ?? "" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "移库审批失败，请稍后重试。");
        return;
      }
      setMessage(action === "approve" ? "移库已审批通过，库存库位已更新。" : "移库申请已驳回。");
      setReviewNoteById((current) => ({ ...current, [id]: "" }));
      router.refresh();
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submitMove}>
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={18} className="text-cyan-700" />
          <h2 className="text-base font-semibold text-slate-950">移库作业</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">选择库存记录和目标库位，系统会先校验库位状态、件数容量和混放规则，再进入审批。</p>
        <label className="mt-4 grid gap-1 text-xs font-semibold text-slate-500">
          库存记录
          <select className="min-h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setBalanceId(event.target.value)} value={balanceId}>
            {balances.map((item) => (
              <option key={item.id} value={item.id}>
                {item.customerCode} / {item.skuCode} / {item.locationCode || "未上架"} / 合计 {balanceQty(item)}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">当前库位</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{selected?.locationCode || "未上架"}</p>
            <p className="mt-1 text-xs text-slate-500">本次移库 {movingQty} 件</p>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            目标库位
            <select className="min-h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setTargetLocation(event.target.value)} value={effectiveTargetLocation}>
              <option value="">请选择可用库位</option>
              {targetOptions.map((item) => {
                const usage = utilizationByLocation.get(item.locationCode);
                const capacity = item.capacityQty ? `${usage?.usedQty ?? 0}/${item.capacityQty} 件` : `${usage?.usedQty ?? 0} 件`;
                return (
                  <option key={item.locationCode} value={item.locationCode}>
                    {item.locationCode} / {zoneTypeLabels[item.zoneType ?? "standard"]} / {capacity}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        {selectedTarget ? (
          <div className={`mt-3 rounded-md border p-3 text-xs ${targetWarning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            <p className="font-semibold">{selectedTarget.locationCode} / {zoneTypeLabels[selectedTarget.zoneType ?? "standard"]}</p>
            <p className="mt-1">
              当前占用 {selectedTargetUsage?.usedQty ?? 0} 件{selectedTarget.capacityQty ? `，容量 ${selectedTarget.capacityQty} 件，移入后剩余 ${Math.max(0, remainingAfterMove ?? 0)} 件` : "，未设置件数上限"}。
            </p>
            <p className="mt-1">混放规则：{selectedTarget.allowMixedSku === false ? "不允许不同 SKU 混放" : "允许不同 SKU 混放"}</p>
            {targetWarning ? <p className="mt-1 font-semibold">{targetWarning}</p> : null}
          </div>
        ) : null}
        <textarea className="mt-3 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="移库原因，例如释放拣货位、合并库位、异常区转常规位。" value={note} />
        <button className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || balances.length === 0 || activeLocations.length === 0} type="submit">
          {isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          提交移库申请
        </button>
        {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      </form>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">移库任务队列</h2>
            <p className="mt-1 text-sm text-slate-500">待审批 {pendingMoveTasks.length} 条，最近显示 8 条移库记录。</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
            <MapPin size={13} />
            可用库位 {activeLocations.length}
          </span>
        </div>
        <div className="grid gap-3 p-4">
          {moveTasks.map((item) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-500">{item.id} / {item.skuCode}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{item.beforeLocationCode || "未上架"} {"->"} {item.nextLocationCode}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.customerCode} / {item.requestedBy} / {item.reason}</p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}>{statusLabels[item.status]}</span>
              </div>
              {canReview && item.status === "pending" ? (
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <input className="min-h-9 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-cyan-500" onChange={(event) => setReviewNoteById((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="审批备注，驳回时必填" value={reviewNoteById[item.id] ?? ""} />
                  <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={isPending} onClick={() => review(item.id, "approve")} type="button">
                    <CheckCircle2 size={14} />
                    通过
                  </button>
                  <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60" disabled={isPending} onClick={() => review(item.id, "reject")} type="button">
                    <XCircle size={14} />
                    驳回
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {moveTasks.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">暂无移库任务</div> : null}
        </div>
      </div>
    </section>
  );
}
