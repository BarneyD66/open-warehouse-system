"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Plus, ShieldAlert, Upload } from "lucide-react";
import type { InventoryBalance, WarehouseLocation, WarehouseLocationZoneType } from "@/lib/warehouseCoreStore";

const zoneTypeLabels: Record<WarehouseLocationZoneType, string> = {
  standard: "常规库位",
  receiving: "收货暂存",
  returns: "退货处理",
  defective: "残次品位",
  frozen: "冻结库存位",
  oversize: "大件库位",
};

const statusLabels: Record<WarehouseLocation["status"], string> = {
  active: "可用",
  blocked: "停用",
  reserved: "预留",
};

function balanceQty(balance: InventoryBalance) {
  return balance.availableQty + balance.reservedQty + (balance.frozenQty ?? 0) + (balance.defectiveQty ?? 0);
}

function usageRisk(item: WarehouseLocation, usedQty: number, skuCount: number) {
  const rate = typeof item.capacityQty === "number" && item.capacityQty > 0 ? usedQty / item.capacityQty : undefined;
  const risks = [
    item.status !== "active" ? statusLabels[item.status] : "",
    typeof item.capacityQty !== "number" || item.capacityQty <= 0 ? "未设容量" : "",
    typeof item.capacityQty === "number" && item.capacityQty > 0 && usedQty > item.capacityQty ? "已超容量" : "",
    typeof rate === "number" && rate >= 0.9 && usedQty <= (item.capacityQty ?? Number.POSITIVE_INFINITY) ? "接近满仓" : "",
    item.allowMixedSku === false && skuCount > 1 ? "混 SKU 风险" : "",
    item.status === "active" && usedQty === 0 ? "空库位" : "",
  ].filter(Boolean);
  return { rate, risks: risks.length ? risks : ["正常"] };
}

export function WarehouseLocationManager({ locations, balances = [] }: { locations: WarehouseLocation[]; balances?: InventoryBalance[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locationCode, setLocationCode] = useState("");
  const [zone, setZone] = useState("MAIN");
  const [zoneType, setZoneType] = useState<WarehouseLocationZoneType>("standard");
  const [capacityQty, setCapacityQty] = useState("");
  const [capacityCbm, setCapacityCbm] = useState("");
  const [allowMixedSku, setAllowMixedSku] = useState(true);
  const [note, setNote] = useState("");
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const utilizationByLocation = useMemo(() => {
    const result = new Map<string, { usedQty: number; skuCount: number }>();
    for (const balance of balances) {
      if (!balance.locationCode) continue;
      const qty = balanceQty(balance);
      const current = result.get(balance.locationCode) ?? { usedQty: 0, skuCount: 0 };
      current.usedQty += qty;
      current.skuCount += qty > 0 ? 1 : 0;
      result.set(balance.locationCode, current);
    }
    return result;
  }, [balances]);

  const locationUsageRows = useMemo(
    () =>
      locations.map((item) => {
        const usage = utilizationByLocation.get(item.locationCode) ?? { usedQty: 0, skuCount: 0 };
        const risk = usageRisk(item, usage.usedQty, usage.skuCount);
        return { item, usage, risk };
      }),
    [locations, utilizationByLocation],
  );

  const riskCount = locationUsageRows.filter((row) => row.risk.risks.some((risk) => risk !== "正常" && risk !== "空库位")).length;
  const emptyCount = locationUsageRows.filter((row) => row.risk.risks.includes("空库位")).length;
  const fullCount = locationUsageRows.filter((row) => row.risk.risks.includes("接近满仓") || row.risk.risks.includes("已超容量")).length;

  function submitLocation() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/warehouse/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationCode,
          zone,
          zoneType,
          note,
          status: "active",
          capacityQty: capacityQty ? Number(capacityQty) : undefined,
          capacityCbm: capacityCbm ? Number(capacityCbm) : undefined,
          allowMixedSku,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "保存库位失败。");
        return;
      }
      setLocationCode("");
      setCapacityQty("");
      setCapacityCbm("");
      setNote("");
      setMessage("库位已保存。");
      router.refresh();
    });
  }

  function importCsv() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/warehouse/locations", {
        method: "POST",
        headers: { "Content-Type": "text/csv; charset=utf-8" },
        body: csv,
      });
      const payload = (await response.json().catch(() => ({}))) as { imported?: number; errors?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "导入失败。");
        return;
      }
      setCsv("");
      setMessage(`已导入 ${payload.imported ?? 0} 个库位${payload.errors?.length ? `，${payload.errors.length} 条需要复核` : ""}。`);
      router.refresh();
    });
  }

  function reviewLocationRisks() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/warehouse/locations/risk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 120, occupancyWarningRate: 0.9 }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { scannedLocations?: number; reviewed?: number; highRisk?: number; workOrders?: number; alreadyHandled?: number };
      };
      if (!response.ok) {
        setError(payload.error || "库位风险巡检失败，请稍后再试。");
        return;
      }
      setMessage(
        `库位风险巡检完成：扫描 ${payload.summary?.scannedLocations ?? 0} 个库位，复核 ${payload.summary?.reviewed ?? 0} 个，高风险 ${payload.summary?.highRisk ?? 0} 个，新增工单 ${payload.summary?.workOrders ?? 0} 个，已有工单 ${payload.summary?.alreadyHandled ?? 0} 个。`,
      );
      router.refresh();
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">库位管理</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">维护库区、容量和混放规则；移库、上架和扫码时，系统会校验目标库位是否可用、是否超容量。</p>
        <div className="mt-3 grid gap-2">
          <input className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setLocationCode(event.target.value)} placeholder="库位编码，如 A-01-03" value={locationCode} />
          <input className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setZone(event.target.value)} placeholder="库区，如 A 区 / 退货区" value={zone} />
          <select className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setZoneType(event.target.value as WarehouseLocationZoneType)} value={zoneType}>
            {Object.entries(zoneTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" min="0" onChange={(event) => setCapacityQty(event.target.value)} placeholder="件数容量，如 120" type="number" value={capacityQty} />
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" min="0" onChange={(event) => setCapacityCbm(event.target.value)} placeholder="体积容量 CBM，可选" step="0.01" type="number" value={capacityCbm} />
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input checked={allowMixedSku} onChange={(event) => setAllowMixedSku(event.target.checked)} type="checkbox" />
            允许不同 SKU 混放
          </label>
          <input className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="备注，如只放小件、只放退货待检" value={note} />
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} onClick={submitLocation} type="button">
            {isPending ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
            新增/更新库位
          </button>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700">批量导入 CSV</p>
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 p-3 font-mono text-xs outline-none focus:border-cyan-500"
            onChange={(event) => setCsv(event.target.value)}
            placeholder={"库位编码,仓库编码,库区,状态,容量CBM,备注,库位类型,件数容量,允许混放SKU\nA-01-04,SHEFFIELD-MAIN,A区,active,1.2,常规小件位,standard,120,是"}
            value={csv}
          />
          <button className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={isPending || !csv.trim()} onClick={importCsv} type="button">
            {isPending ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
            导入库位
          </button>
        </div>
        {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">库位列表</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">现场作业优先关注满仓、未设容量、停用和混放风险，避免扫码上架后返工。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/warehouse/exports/locations">
              导出库位 CSV
            </Link>
            <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={isPending || locations.length === 0} onClick={reviewLocationRisks} type="button">
              <ShieldAlert size={14} />
              巡检库位风险
            </button>
          </div>
        </div>
        <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
          {[
            ["风险库位", riskCount, "text-rose-700"],
            ["接近满仓", fullCount, "text-amber-700"],
            ["空库位", emptyCount, "text-cyan-700"],
          ].map(([label, value, className]) => (
            <div className="rounded-md border border-slate-200 bg-white p-3" key={label}>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className={`mt-1 text-2xl font-semibold ${className}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="max-w-full overflow-x-auto [contain:paint]">
          <table className="w-full min-w-full table-fixed text-left text-sm lg:min-w-[920px]">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">库位</th>
                <th className="px-4 py-3">库区</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">容量</th>
                <th className="px-4 py-3">混放</th>
                <th className="px-4 py-3">风险</th>
                <th className="px-4 py-3">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {locationUsageRows.slice(0, 12).map(({ item, usage, risk }) => {
                const remaining = typeof item.capacityQty === "number" ? Math.max(0, item.capacityQty - usage.usedQty) : undefined;
                const capacityTone = risk.risks.includes("已超容量") ? "text-rose-700" : risk.risks.includes("接近满仓") ? "text-amber-700" : "text-slate-600";
                return (
                  <tr key={item.locationCode}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-950">{item.locationCode}</td>
                    <td className="px-4 py-3 text-slate-600">{item.zone}</td>
                    <td className="px-4 py-3 text-slate-600">{zoneTypeLabels[item.zoneType ?? "standard"]}</td>
                    <td className="px-4 py-3 text-slate-600">{statusLabels[item.status]}</td>
                    <td className={`px-4 py-3 ${capacityTone}`}>
                      {usage.usedQty}
                      {typeof item.capacityQty === "number" ? ` / ${item.capacityQty} 件` : " 件"}
                      {typeof remaining === "number" ? <p className="mt-1 text-xs">剩余 {remaining} 件</p> : null}
                      {typeof risk.rate === "number" ? <p className="mt-1 text-xs">利用率 {Math.round(risk.rate * 1000) / 10}%</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.allowMixedSku === false ? "不允许" : "允许"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {risk.risks.map((label) => (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${
                              label === "正常" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : label === "空库位" ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-amber-200 bg-amber-50 text-amber-800"
                            }`}
                            key={label}
                          >
                            {label !== "正常" && label !== "空库位" ? <AlertTriangle size={12} /> : null}
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.note || "-"}</td>
                  </tr>
                );
              })}
              {locations.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    暂无库位
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
