"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, CheckCircle2, Lock, PackagePlus, Play, ShieldAlert } from "lucide-react";
import type { InventoryBalance, InventoryLot } from "@/lib/warehouseCoreStore";

type Props = {
  balances: InventoryBalance[];
  lots: InventoryLot[];
};

const statusLabels: Record<InventoryLot["status"], string> = {
  active: "可用",
  reserved: "已预留",
  blocked: "已冻结",
  expired: "已过期",
  depleted: "已用完",
};

function daysUntil(date?: string) {
  if (!date) return null;
  const diff = new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.ceil(diff / 86400000);
}

function tone(status: InventoryLot["status"], expiryDate?: string) {
  const days = daysUntil(expiryDate);
  if (status === "blocked" || status === "expired" || (typeof days === "number" && days < 0)) return "border-rose-200 bg-rose-50 text-rose-800";
  if (typeof days === "number" && days <= 45) return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "reserved") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (status === "depleted") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function serialStatusText(lot: InventoryLot) {
  if (!lot.serialNumberStatuses?.length) return lot.serialNumbers?.length ? `${lot.serialNumbers.length} 个序列号` : lot.id;
  const counts = lot.serialNumberStatuses.reduce(
    (map, item) => ({ ...map, [item.status]: (map[item.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  return [
    counts.active ? `可用 ${counts.active}` : "",
    counts.reserved ? `预留 ${counts.reserved}` : "",
    counts.consumed ? `已出库 ${counts.consumed}` : "",
    counts.blocked ? `冻结 ${counts.blocked}` : "",
  ].filter(Boolean).join(" / ");
}

export function OpsInventoryLotPanel({ balances, lots }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedBalanceId, setSelectedBalanceId] = useState(balances[0]?.id ?? "");
  const [lotNo, setLotNo] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [serialNumbers, setSerialNumbers] = useState("");
  const [note, setNote] = useState("");
  const [actionQty, setActionQty] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedBalance = balances.find((item) => item.id === selectedBalanceId);
  const expiringCount = lots.filter((item) => {
    const days = daysUntil(item.expiryDate);
    return typeof days === "number" && days >= 0 && days <= 45 && item.status !== "depleted";
  }).length;
  const blockedCount = lots.filter((item) => item.status === "blocked" || item.status === "expired").length;
  const lotQty = lots.reduce((sum, item) => sum + item.availableQty, 0);
  const latestLots = useMemo(() => [...lots].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()), [lots]);

  function post(body: Record<string, unknown>, success: string) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/inventory-lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "批次操作失败，请检查填写内容。");
        return;
      }
      setMessage(success);
      window.location.reload();
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBalance) {
      setError("请选择 SKU。");
      return;
    }
    post(
      {
        action: "create",
        customerCode: selectedBalance.customerCode,
        skuCode: selectedBalance.skuCode,
        warehouseCode: selectedBalance.warehouseCode,
        locationCode: locationCode || selectedBalance.locationCode,
        lotNo,
        quantity,
        expiryDate,
        serialNumbers,
        note,
      },
      "库存批次已登记。",
    );
  }

  function lotAction(id: string, action: "reserve" | "release" | "consume" | "block" | "activate") {
    post({ id, action, quantity: actionQty[id] || 0, note: `批次${statusLabels[action === "activate" ? "active" : action === "block" ? "blocked" : "reserved"] ?? action}` }, "批次状态已更新。");
  }

  function reviewLotRisks() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/inventory-lots/risk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 80, expiryWarningDays: 45 }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { scannedLots?: number; reviewed?: number; expiredMarked?: number; workOrders?: number; failed?: number };
      };
      if (!response.ok) {
        setError(payload.error || "库存批次风险巡检失败，请稍后再试。");
        return;
      }
      setMessage(`库存批次风险巡检完成：扫描 ${payload.summary?.scannedLots ?? 0} 个批次，复核 ${payload.summary?.reviewed ?? 0} 个，标记过期 ${payload.summary?.expiredMarked ?? 0} 个，工单 ${payload.summary?.workOrders ?? 0} 个，失败 ${payload.summary?.failed ?? 0} 个。`);
      window.location.reload();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <CalendarClock size={18} className="text-cyan-700" />
            批次 / 效期 / 序列号台账
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">登记批次号、效期和序列号，支持冻结、预留、释放和消耗，为后续先进先出和效期拦截打底。</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["批次可用", lotQty],
              ["临期批次", expiringCount],
              ["冻结/过期", blockedCount],
            ].map(([label, value]) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={label}>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <button className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={isPending || lots.length === 0} onClick={reviewLotRisks} type="button">
            <ShieldAlert size={16} />
            巡检批次风险
          </button>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            SKU
            <select className="min-h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setSelectedBalanceId(event.target.value)} value={selectedBalanceId}>
              {balances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.customerCode} / {item.skuCode} / {item.warehouseCode}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="min-h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setLotNo(event.target.value)} placeholder="批次号" required value={lotNo} />
            <input className="min-h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" min="1" onChange={(event) => setQuantity(event.target.value)} placeholder="数量" required type="number" value={quantity} />
            <input className="min-h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setExpiryDate(event.target.value)} type="date" value={expiryDate} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="min-h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setLocationCode(event.target.value)} placeholder="库位，如 A-01-03" value={locationCode} />
            <input className="min-h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setSerialNumbers(event.target.value)} placeholder="序列号，逗号或换行分隔" value={serialNumbers} />
          </div>
          <input className="min-h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="备注" value={note} />
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending || balances.length === 0} type="submit">
            <PackagePlus size={16} />
            登记批次
          </button>
          {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
          {error ? <p className="rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">批次</th>
              <th className="px-4 py-3">客户 / SKU</th>
              <th className="px-4 py-3">库位</th>
              <th className="px-4 py-3">数量</th>
              <th className="px-4 py-3">效期</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {latestLots.slice(0, 10).map((lot) => {
              const days = daysUntil(lot.expiryDate);
              return (
                <tr key={lot.id}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-950">{lot.lotNo}</p>
                    <p className="mt-1 text-xs text-slate-500">{serialStatusText(lot)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{lot.customerCode}</p>
                    <p className="mt-1 font-mono text-xs font-semibold text-slate-950">{lot.skuCode}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{lot.warehouseCode}</p>
                    <p className="mt-1 text-xs text-slate-500">{lot.locationCode || "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>可用 {lot.availableQty} / 预留 {lot.reservedQty}</p>
                    <p className="mt-1 text-xs text-slate-500">总数 {lot.quantity}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone(lot.status, lot.expiryDate)}`}>{statusLabels[lot.status]}</span>
                    <p className="mt-1 text-xs text-slate-500">{lot.expiryDate || "无效期"}{typeof days === "number" ? ` / ${days} 天` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <input className="h-9 w-20 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-cyan-500" min="0" onChange={(event) => setActionQty((current) => ({ ...current, [lot.id]: event.target.value }))} placeholder="数量" type="number" value={actionQty[lot.id] ?? ""} />
                      <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800" onClick={() => lotAction(lot.id, "reserve")} type="button"><Lock size={13} />预留</button>
                      <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-800" onClick={() => lotAction(lot.id, "release")} type="button"><CheckCircle2 size={13} />释放</button>
                      <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700" onClick={() => lotAction(lot.id, "consume")} type="button"><Play size={13} />消耗</button>
                      <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-800" onClick={() => lotAction(lot.id, "block")} type="button"><ShieldAlert size={13} />冻结</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {latestLots.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>暂无批次台账，先从上方登记一个批次。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
