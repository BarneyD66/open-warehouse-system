"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Layers3, Play, ShieldAlert, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WmsPolicy } from "@/lib/opsExpansionStore";
import type { CoreOutboundOrder, InventoryBalance, InventoryLot, WarehouseLocation } from "@/lib/warehouseCoreStore";

type Props = {
  balances: InventoryBalance[];
  locations: WarehouseLocation[];
  lots: InventoryLot[];
  outboundOrders?: CoreOutboundOrder[];
  policies: WmsPolicy[];
};

type OutboundLotPlan = {
  order: CoreOutboundOrder;
  requiredQty: number;
  allocatedQty: number;
  shortageQty: number;
  allocations: Array<{
    skuCode: string;
    requiredQty: number;
    allocatedQty: number;
    shortageQty: number;
    lots: Array<{
      lotId: string;
      lotNo: string;
      quantity: number;
      availableQty: number;
      locationCode?: string;
      expiryDate?: string;
      daysUntilExpiry?: number;
    }>;
  }>;
};

function totalQty(balance: InventoryBalance) {
  return balance.availableQty + balance.reservedQty + (balance.frozenQty ?? 0) + (balance.defectiveQty ?? 0) + (balance.inboundQty ?? 0);
}

function daysUntil(expiryDate?: string) {
  if (!expiryDate) return undefined;
  const expiry = new Date(`${expiryDate}T00:00:00`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  if (!Number.isFinite(expiry) || !Number.isFinite(today)) return undefined;
  return Math.ceil((expiry - today) / 86_400_000);
}

function locationRisk(location: WarehouseLocation, balances: InventoryBalance[]) {
  const usedQty = balances.reduce((sum, balance) => sum + totalQty(balance), 0);
  const skuCount = balances.filter((balance) => totalQty(balance) > 0).length;
  const occupancyRate = typeof location.capacityQty === "number" && location.capacityQty > 0 ? usedQty / location.capacityQty : undefined;
  const reasons = [
    typeof location.capacityQty !== "number" || location.capacityQty <= 0 ? "未设置件数容量" : "",
    typeof location.capacityQty === "number" && location.capacityQty > 0 && usedQty > location.capacityQty ? "已超容量" : "",
    typeof occupancyRate === "number" && occupancyRate >= 0.9 && usedQty <= (location.capacityQty ?? 0) ? "接近满仓" : "",
    location.status !== "active" && usedQty > 0 ? "停用/预留库位仍有库存" : "",
    location.allowMixedSku === false && skuCount > 1 ? "禁止混放但存在多个 SKU" : "",
  ].filter(Boolean);
  return {
    usedQty,
    skuCount,
    occupancyRate,
    reasons,
    highRisk: reasons.some((reason) => reason.includes("超容量") || reason.includes("停用") || reason.includes("混放")),
  };
}

function lotRisk(lot: InventoryLot) {
  const days = daysUntil(lot.expiryDate);
  const reasons = [
    lot.status === "blocked" ? "批次已冻结" : "",
    lot.status === "expired" || (typeof days === "number" && days < 0) ? "批次已过期" : "",
    typeof days === "number" && days >= 0 && days <= 45 && lot.status !== "depleted" ? "45 天内临期" : "",
    (lot.serialNumberStatuses ?? []).some((item) => item.status === "blocked") ? "存在冻结序列号" : "",
    lot.availableQty <= 0 && lot.reservedQty > 0 ? "仅剩预留库存" : "",
  ].filter(Boolean);
  return {
    days,
    reasons,
    highRisk: reasons.some((reason) => reason.includes("过期") || reason.includes("冻结")),
  };
}

function balanceRisk(balance: InventoryBalance) {
  return [
    balance.availableQty < balance.alertQty ? "低于安全库存" : "",
    (balance.frozenQty ?? 0) > 0 ? `冻结 ${balance.frozenQty}` : "",
    (balance.defectiveQty ?? 0) > 0 ? `残次 ${balance.defectiveQty}` : "",
    balance.agingDays >= 120 ? `库龄 ${balance.agingDays} 天` : "",
    !balance.locationCode ? "未绑定库位" : "",
  ].filter(Boolean);
}

function percent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function lotEffectiveStatus(lot: InventoryLot) {
  if (lot.status === "blocked" || lot.status === "depleted") return lot.status;
  if (!lot.expiryDate) return lot.status;
  return lot.expiryDate < new Date().toISOString().slice(0, 10) ? "expired" : lot.status;
}

function buildOutboundLotPlans(outboundOrders: CoreOutboundOrder[], lots: InventoryLot[]): OutboundLotPlan[] {
  return outboundOrders
    .filter((order) => ["pending_review", "picking", "label_pending", "packing_check", "handover"].includes(order.status))
    .map((order) => {
      const allocations = (order.skuLines ?? []).map((line) => {
        let remaining = Math.max(0, Math.floor(line.quantity));
        const candidates = lots
          .filter((lot) => lot.customerCode === order.customerCode && lot.skuCode === line.skuCode && lot.availableQty > 0)
          .filter((lot) => lotEffectiveStatus(lot) === "active")
          .sort((left, right) => {
            const expiryLeft = left.expiryDate || "9999-12-31";
            const expiryRight = right.expiryDate || "9999-12-31";
            if (expiryLeft !== expiryRight) return expiryLeft.localeCompare(expiryRight);
            return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
          });
        const pickedLots: OutboundLotPlan["allocations"][number]["lots"] = [];
        for (const lot of candidates) {
          if (remaining <= 0) break;
          const quantity = Math.min(remaining, lot.availableQty);
          if (quantity <= 0) continue;
          pickedLots.push({
            lotId: lot.id,
            lotNo: lot.lotNo,
            quantity,
            availableQty: lot.availableQty,
            locationCode: lot.locationCode,
            expiryDate: lot.expiryDate,
            daysUntilExpiry: daysUntil(lot.expiryDate),
          });
          remaining -= quantity;
        }
        const allocatedQty = pickedLots.reduce((sum, item) => sum + item.quantity, 0);
        return {
          skuCode: line.skuCode,
          requiredQty: Math.max(0, Math.floor(line.quantity)),
          allocatedQty,
          shortageQty: Math.max(0, remaining),
          lots: pickedLots,
        };
      });
      return {
        order,
        requiredQty: allocations.reduce((sum, item) => sum + item.requiredQty, 0),
        allocatedQty: allocations.reduce((sum, item) => sum + item.allocatedQty, 0),
        shortageQty: allocations.reduce((sum, item) => sum + item.shortageQty, 0),
        allocations,
      };
    })
    .filter((plan) => plan.requiredQty > 0)
    .sort((left, right) => right.shortageQty - left.shortageQty || new Date(left.order.createdAt).getTime() - new Date(right.order.createdAt).getTime());
}

export function OpsWmsRuleCompliancePanel({ balances, locations, lots, outboundOrders = [], policies }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const balancesByLocation = useMemo(() => {
    const map = new Map<string, InventoryBalance[]>();
    balances.forEach((balance) => {
      if (!balance.locationCode) return;
      map.set(balance.locationCode, [...(map.get(balance.locationCode) ?? []), balance]);
    });
    return map;
  }, [balances]);

  const locationRows = locations
    .map((location) => ({ location, risk: locationRisk(location, balancesByLocation.get(location.locationCode) ?? []) }))
    .filter((row) => row.risk.reasons.length > 0)
    .sort((a, b) => Number(b.risk.highRisk) - Number(a.risk.highRisk) || (b.risk.occupancyRate ?? 0) - (a.risk.occupancyRate ?? 0));
  const lotRows = lots
    .map((lot) => ({ lot, risk: lotRisk(lot) }))
    .filter((row) => row.risk.reasons.length > 0)
    .sort((a, b) => Number(b.risk.highRisk) - Number(a.risk.highRisk) || (a.risk.days ?? 9999) - (b.risk.days ?? 9999));
  const inventoryRows = balances
    .map((balance) => ({ balance, risks: balanceRisk(balance) }))
    .filter((row) => row.risks.length > 0)
    .sort((a, b) => b.risks.length - a.risks.length || b.balance.agingDays - a.balance.agingDays);
  const activePolicies = policies.filter((policy) => policy.status === "active");
  const pausedPolicies = policies.filter((policy) => policy.status !== "active");
  const outboundLotPlans = useMemo(() => buildOutboundLotPlans(outboundOrders, lots), [outboundOrders, lots]);
  const outboundPlanShortages = outboundLotPlans.filter((plan) => plan.shortageQty > 0).length;
  const outboundPlanExpiringLots = outboundLotPlans.reduce(
    (sum, plan) => sum + plan.allocations.flatMap((allocation) => allocation.lots).filter((lot) => typeof lot.daysUntilExpiry === "number" && lot.daysUntilExpiry >= 0 && lot.daysUntilExpiry <= 45).length,
    0,
  );

  function runReview(kind: "lots" | "locations") {
    setMessage("");
    setError("");
    const endpoint = kind === "lots" ? "/api/ops/inventory-lots/risk-review" : "/api/ops/warehouse/locations/risk-review";
    const body = kind === "lots" ? { limit: 80, expiryWarningDays: 45 } : { limit: 120, occupancyWarningRate: 0.9 };
    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: Record<string, number>;
      };
      if (!response.ok) {
        setError(payload.error || "WMS 规则巡检失败，请稍后重试。");
        return;
      }
      if (kind === "lots") {
        setMessage(`批次风险巡检完成：扫描 ${payload.summary?.scannedLots ?? 0} 个，复核 ${payload.summary?.reviewed ?? 0} 个，标记过期 ${payload.summary?.expiredMarked ?? 0} 个，生成工单 ${payload.summary?.workOrders ?? 0} 个。`);
      } else {
        setMessage(`库位风险巡检完成：扫描 ${payload.summary?.scannedLocations ?? 0} 个，复核 ${payload.summary?.reviewed ?? 0} 个，高风险 ${payload.summary?.highRisk ?? 0} 个，生成工单 ${payload.summary?.workOrders ?? 0} 个。`);
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ClipboardCheck size={18} className="text-[#0E7490]" />
            深层 WMS 规则合规看板
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">集中检查库区/货架/库位容量、批次效期、序列号、冻结库存、残次品库存和 WMS 策略是否存在作业风险。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={isPending || lots.length === 0} onClick={() => runReview("lots")} type="button">
            <ShieldAlert size={15} />
            巡检批次风险
          </button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || locations.length === 0} onClick={() => runReview("locations")} type="button">
            <Play size={15} />
            巡检库位风险
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">有效策略</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{activePolicies.length}</p>
        </div>
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-800">策略待确认</p>
          <p className="mt-1 text-xl font-semibold text-amber-950">{pausedPolicies.length}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">库位风险</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{locationRows.length}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">批次风险</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{lotRows.length}</p>
        </div>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-cyan-800">库存风险</p>
          <p className="mt-1 text-xl font-semibold text-cyan-950">{inventoryRows.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-600">可导出报表</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">3</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Warehouse size={15} className="text-rose-700" />
            库位容量/混放风险
          </h3>
          <div className="mt-3 grid gap-2">
            {locationRows.slice(0, 5).map(({ location, risk }) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={location.locationCode}>
                <p className="font-mono font-semibold text-slate-950">{location.locationCode}</p>
                <p className="mt-1">{location.zone} / 已用 {risk.usedQty}{typeof location.capacityQty === "number" ? ` / 容量 ${location.capacityQty}` : ""} / 利用率 {percent(risk.occupancyRate)}</p>
                <p className={risk.highRisk ? "mt-1 text-rose-700" : "mt-1 text-amber-800"}>{risk.reasons.join("、")}</p>
              </div>
            ))}
            {locationRows.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无明显库位容量或混放风险。</p> : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Layers3 size={15} className="text-amber-700" />
            批次/效期/序列号风险
          </h3>
          <div className="mt-3 grid gap-2">
            {lotRows.slice(0, 5).map(({ lot, risk }) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={lot.id}>
                <p className="font-mono font-semibold text-slate-950">{lot.lotNo}</p>
                <p className="mt-1">{lot.customerCode} / {lot.skuCode} / {lot.locationCode || lot.warehouseCode}</p>
                <p className={risk.highRisk ? "mt-1 text-rose-700" : "mt-1 text-amber-800"}>
                  {risk.reasons.join("、")}
                  {typeof risk.days === "number" ? ` / 距效期 ${risk.days} 天` : ""}
                </p>
              </div>
            ))}
            {lotRows.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                暂无批次、效期或序列号高风险。
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={15} className="text-cyan-700" />
            冻结/残次/库龄风险
          </h3>
          <div className="mt-3 grid gap-2">
            {inventoryRows.slice(0, 5).map(({ balance, risks }) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={balance.id}>
                <p className="font-semibold text-slate-950">{balance.customerCode} / {balance.skuCode}</p>
                <p className="mt-1">{balance.warehouseCode} / {balance.locationCode || "未绑定库位"} / 可用 {balance.availableQty}</p>
                <p className="mt-1 text-amber-800">{risks.join("、")}</p>
              </div>
            ))}
            {inventoryRows.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无冻结、残次、低库存或库龄风险。</p> : null}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ClipboardCheck size={15} className="text-cyan-700" />
              出库批次分配建议
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">按 FEFO 先到期先出规则，给待出库任务预估应拣批次、库位、临期提示和缺货缺口，仓库拣货前可以先看这里。</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="font-semibold text-slate-500">待分配单</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{outboundLotPlans.length}</p>
            </div>
            <div className="rounded-md border border-rose-100 bg-white px-3 py-2">
              <p className="font-semibold text-rose-700">有缺口</p>
              <p className="mt-1 text-lg font-semibold text-rose-900">{outboundPlanShortages}</p>
            </div>
            <div className="rounded-md border border-amber-100 bg-white px-3 py-2">
              <p className="font-semibold text-amber-700">临期批次</p>
              <p className="mt-1 text-lg font-semibold text-amber-900">{outboundPlanExpiringLots}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {outboundLotPlans.slice(0, 5).map((plan) => (
            <div className="rounded-md border border-slate-200 bg-white p-3" key={plan.order.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-slate-950">{plan.order.id}</p>
                  <p className="mt-1 text-xs text-slate-500">{plan.order.customerCode} / {plan.order.channel} / {plan.order.pickWaveNo || "待生成波次"}</p>
                </div>
                <span className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-semibold ${plan.shortageQty > 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                  {plan.shortageQty > 0 ? `缺口 ${plan.shortageQty}` : `已覆盖 ${plan.allocatedQty}/${plan.requiredQty}`}
                </span>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {plan.allocations.map((allocation) => (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600" key={`${plan.order.id}-${allocation.skuCode}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono font-semibold text-slate-950">{allocation.skuCode}</p>
                      <span className={allocation.shortageQty > 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>
                        {allocation.allocatedQty}/{allocation.requiredQty}{allocation.shortageQty > 0 ? `，缺 ${allocation.shortageQty}` : ""}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1">
                      {allocation.lots.slice(0, 3).map((lot) => (
                        <p className="truncate" key={lot.lotId}>
                          {lot.locationCode || "未绑定库位"} / {lot.lotNo} / 拣 {lot.quantity} 件{lot.expiryDate ? ` / 效期 ${lot.expiryDate}` : ""}{typeof lot.daysUntilExpiry === "number" && lot.daysUntilExpiry <= 45 ? ` / 临期 ${lot.daysUntilExpiry} 天` : ""}
                        </p>
                      ))}
                      {allocation.lots.length === 0 ? <p className="text-rose-700">暂无可用批次，请先补货、移库或处理冻结/过期批次。</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {outboundLotPlans.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">暂无待分配批次的出库任务。</p> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/locations">
          导出库位报表
        </Link>
        <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/inventory-lots">
          导出批次报表
        </Link>
        <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/outbound-lot-allocation">
          导出出库批次建议
        </Link>
        <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/inventory">
          导出库存报表
        </Link>
      </div>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}
