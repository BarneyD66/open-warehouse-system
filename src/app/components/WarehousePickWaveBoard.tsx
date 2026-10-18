import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Scale, ScanLine } from "lucide-react";
import { buildPickWaveProgressRows, type PickWaveProgressRow, type PickWaveProgressStatus } from "@/lib/pickWaveProgress";
import type { CoreOutboundOrder } from "@/lib/warehouseCoreStore";

const statusTone: Record<PickWaveProgressStatus, string> = {
  有异常: "border-rose-200 bg-rose-50 text-rose-800",
  疑似卡住: "border-amber-200 bg-amber-50 text-amber-800",
  待称重: "border-violet-200 bg-violet-50 text-violet-800",
  复核中: "border-cyan-200 bg-cyan-50 text-cyan-800",
  分拣中: "border-cyan-200 bg-cyan-50 text-cyan-800",
  拣货中: "border-cyan-200 bg-cyan-50 text-cyan-800",
  待交接: "border-slate-200 bg-slate-50 text-slate-700",
  待开始: "border-slate-200 bg-white text-slate-600",
  已完成: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

function ProgressBar({ label, value, total, tone = "cyan" }: { label: string; value: number; total: number; tone?: "cyan" | "emerald" | "violet" }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 1000) / 10) : 100;
  const color = tone === "emerald" ? "bg-emerald-500" : tone === "violet" ? "bg-violet-500" : "bg-cyan-600";
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-mono text-slate-500">{value}/{total}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function WaveCard({ row }: { row: PickWaveProgressRow }) {
  const printHref = `/warehouse/print/pick-list/batch?ids=${encodeURIComponent(row.orderIds.join(","))}`;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-slate-500">{row.waveNo}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-slate-950">{row.workMode}</h3>
          <p className="mt-1 truncate text-xs text-slate-500">{row.carrierSummary}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-semibold ${statusTone[row.status]}`}>{row.status}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <ProgressBar label="拣货" total={row.requiredQty} value={row.pickedQty} />
        <ProgressBar label="分拣" total={row.requiredQty} value={row.sortedQty} tone="violet" />
        <ProgressBar label="复核" total={row.requiredQty} value={row.packedQty} tone="emerald" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-semibold text-slate-950">{row.orderCount}</p>
          <p className="mt-1 text-slate-500">订单</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-semibold text-slate-950">{row.skuCount}</p>
          <p className="mt-1 text-slate-500">SKU</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-semibold text-slate-950">{row.pendingWeightOrders}</p>
          <p className="mt-1 text-slate-500">待称重</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <p className="font-semibold text-slate-800">{row.nextAction}</p>
        <p className="mt-1">最新扫码：{formatDate(row.latestScanAt)}{typeof row.idleHours === "number" ? ` / 停滞 ${row.idleHours} 小时` : ""}</p>
        <p className="mt-1">拣货员：{row.assignedPicker}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={printHref}>
          打印本波次
        </Link>
        {row.exceptionCount > 0 ? (
          <span className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800">
            <AlertTriangle size={13} />
            异常 {row.exceptionCount}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function WarehousePickWaveBoard({ orders }: { orders: CoreOutboundOrder[] }) {
  const rows = buildPickWaveProgressRows(orders).slice(0, 8);
  const activeRows = rows.filter((row) => row.status !== "已完成");
  const stuckRows = rows.filter((row) => row.status === "疑似卡住" || row.status === "有异常");
  const pendingWeight = rows.reduce((sum, row) => sum + row.pendingWeightOrders, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-700">Wave Board</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-950">
            <ScanLine size={18} className="text-cyan-700" />
            出库波次进度看板
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">按波次聚合拣货、二次分拣、打包复核和称重进度，适合仓库手机端现场查看，也方便老板快速判断卡点。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-[360px]">
          <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-cyan-800">
            <PackageCheck className="mx-auto" size={16} />
            <p className="mt-1 text-lg font-semibold">{activeRows.length}</p>
            <p>执行中</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <Clock className="mx-auto" size={16} />
            <p className="mt-1 text-lg font-semibold">{stuckRows.length}</p>
            <p>卡点/异常</p>
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-800">
            <Scale className="mx-auto" size={16} />
            <p className="mt-1 text-lg font-semibold">{pendingWeight}</p>
            <p>待称重</p>
          </div>
        </div>
      </div>

      {rows.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {rows.map((row) => (
            <WaveCard key={row.waveNo} row={row} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          暂无已生成波次的出库任务。
        </div>
      )}

      {rows.some((row) => row.status === "已完成") ? (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={14} />
          已完成波次会保留在看板末尾，便于交接复盘。
        </div>
      ) : null}
    </section>
  );
}
