"use client";

import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ScanLine, Search, ShieldAlert } from "lucide-react";

type ScanRecord = {
  id: string;
  type: "inbound" | "outbound" | "inventory" | "location";
  title: string;
  detail: string;
  tokens: string[];
};

type OutboundScanAction = "pick" | "sort" | "pack" | "ship" | "intercept";

type ScanOutboundTask = {
  id: string;
  label: string;
  status: string;
  workMode: string;
  pickWaveNo?: string;
  pickListNo?: string;
  basketNo?: string;
  requiredQty: number;
  pickedQty: number;
  sortedQty: number;
  packedQty: number;
  lastScans?: ScanLog[];
};

type ScanLog = {
  id: string;
  action: OutboundScanAction;
  code: string;
  codeType: string;
  skuCode?: string;
  locationCode?: string;
  weightKg?: number;
  operator: string;
  scannedAt: string;
};

type ScanResult = {
  message?: string;
  error?: string;
  codeType?: string;
  order?: {
    id: string;
    status: string;
    pickWaveNo?: string;
    pickListNo?: string;
    basketNo?: string;
    scanProgress?: {
      pickedQtyBySku?: Record<string, number>;
      sortedQtyBySku?: Record<string, number>;
      packedQtyBySku?: Record<string, number>;
      lastScans?: ScanLog[];
    };
    exceptions?: Array<{
      id: string;
      status: "open" | "investigating" | "resolved" | "ignored";
      severity: "warning" | "critical";
      message: string;
      code?: string;
      operator: string;
      createdAt: string;
    }>;
  } | null;
};

const typeLabel: Record<ScanRecord["type"], string> = {
  inbound: "入库",
  outbound: "出库",
  inventory: "库存",
  location: "库位",
};

const scanActions: Array<{ value: OutboundScanAction; label: string; hint: string }> = [
  { value: "pick", label: "拣货", hint: "扫波次/拣货单后，扫库位和 SKU。" },
  { value: "sort", label: "配货", hint: "扫篮号/格口，再扫 SKU。" },
  { value: "pack", label: "打包复核", hint: "扫出库单或面单，再逐个扫 SKU。" },
  { value: "ship", label: "称重签出", hint: "扫出货标签/出库单，填重量后签出。" },
  { value: "intercept", label: "截单回库", hint: "扫出库单/SKU，确认回库位。" },
];

function countScanned(progress?: Record<string, number>) {
  return Object.values(progress ?? {}).reduce((sum, qty) => sum + qty, 0);
}

function progressPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function formatScanTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

const actionLabel: Record<OutboundScanAction, string> = {
  pick: "拣货",
  sort: "配货",
  pack: "复核",
  ship: "签出",
  intercept: "截单",
};

function ProgressLine({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = progressPercent(value, total);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-mono text-slate-500">{value}/{total}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${percent >= 100 ? "bg-emerald-500" : "bg-cyan-600"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function WarehouseScanPanel({ records, outboundTasks = [] }: { records: ScanRecord[]; outboundTasks?: ScanOutboundTask[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanAction, setScanAction] = useState<OutboundScanAction>("pick");
  const [activeOrderId, setActiveOrderId] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const cleanedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!cleanedQuery) return records.slice(0, 6);
    return records.filter((record) => record.tokens.some((token) => token.toLowerCase().includes(cleanedQuery))).slice(0, 8);
  }, [cleanedQuery, records]);
  const activeTask = outboundTasks.find((task) => task.id === activeOrderId);
  const resultProgress = result?.order?.scanProgress;
  const currentRequiredQty = activeTask?.requiredQty ?? 0;
  const currentPickedQty = resultProgress ? countScanned(resultProgress.pickedQtyBySku) : activeTask?.pickedQty ?? 0;
  const currentSortedQty = resultProgress ? countScanned(resultProgress.sortedQtyBySku) : activeTask?.sortedQty ?? 0;
  const currentPackedQty = resultProgress ? countScanned(resultProgress.packedQtyBySku) : activeTask?.packedQty ?? 0;
  const currentLastScans = resultProgress?.lastScans ?? activeTask?.lastScans ?? [];
  const currentExceptions = (result?.order?.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
  const nextStep =
    currentRequiredQty > 0 && currentPickedQty < currentRequiredQty
      ? "下一步：继续拣货，扫库位或 SKU。"
      : currentRequiredQty > 0 && currentPackedQty < currentRequiredQty
        ? "下一步：进入打包复核，逐个扫描 SKU。"
        : result?.order?.status === "handover"
          ? "下一步：称重签出并交接承运商。"
          : "下一步：先扫描任务码或选择出库单。";

  function submitScan(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!scanCode.trim()) {
      setResult({ error: "请扫描或输入条码。" });
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/warehouse/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: scanAction, code: scanCode, activeOrderId, locationCode, weightKg }),
      });
      const payload = (await response.json().catch(() => ({}))) as ScanResult;
      setResult(payload);
      if (payload.order?.id) setActiveOrderId(payload.order.id);
      if (response.ok) {
        setScanCode("");
        router.refresh();
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
    });
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="flex items-center gap-2">
          <ScanLine size={18} className="text-[#0E7490]" />
          <h2 className="text-base font-semibold text-slate-950">扫码作业台</h2>
        </div>
        <form className="mt-3 grid gap-3" onSubmit={submitScan}>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setScanAction(event.target.value as OutboundScanAction)} value={scanAction}>
              {scanActions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setActiveOrderId(event.target.value)} value={activeOrderId}>
              <option value="">先扫描任务码或手动选择出库单</option>
              {outboundTasks.map((task) => (
                <option key={task.id} value={task.id}>{task.id} / {task.label}</option>
              ))}
            </select>
          </div>
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-cyan-300 bg-cyan-50/60 px-3 focus-within:border-cyan-600">
            <ScanLine size={18} className="text-cyan-700" />
            <input
              ref={inputRef}
              autoComplete="off"
              autoFocus
              className="min-h-10 flex-1 bg-transparent text-base font-semibold text-slate-950 outline-none"
              onChange={(event) => setScanCode(event.target.value)}
              placeholder="扫描出库单、波次、拣货单、SKU、库位、篮号后回车"
              value={scanCode}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setLocationCode(event.target.value)} placeholder="回库位/当前库位，可选" value={locationCode} />
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" inputMode="decimal" onChange={(event) => setWeightKg(event.target.value)} placeholder="签出重量 kg，可选" value={weightKg} />
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="animate-spin" size={16} /> : <ScanLine size={16} />}
              确认扫码
            </button>
          </div>
        </form>

        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">当前任务</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{activeTask?.id || result?.order?.id || "未选择"}</p>
            <p className="mt-1 text-xs text-slate-500">{activeTask ? `${activeTask.workMode} / ${activeTask.pickWaveNo || "待生成波次"} / ${activeTask.basketNo || "无篮号"}` : "先扫出库单、波次号或拣货单号。"}</p>
            <p className="mt-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-cyan-800">{nextStep}</p>
          </div>
          <div className={`rounded-md border p-3 ${result?.error ? "border-rose-200 bg-rose-50" : result?.message ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              {result?.error ? <ShieldAlert size={14} className="text-rose-700" /> : <CheckCircle2 size={14} className="text-emerald-700" />}
              扫码反馈
            </p>
            <p className={`mt-1 text-sm font-semibold ${result?.error ? "text-rose-800" : "text-slate-950"}`}>{result?.error || result?.message || scanActions.find((item) => item.value === scanAction)?.hint}</p>
            {result?.order?.scanProgress ? (
              <p className="mt-1 text-xs text-slate-500">
                拣货 {countScanned(result.order.scanProgress.pickedQtyBySku)} / 配货 {countScanned(result.order.scanProgress.sortedQtyBySku)} / 复核 {countScanned(result.order.scanProgress.packedQtyBySku)}
              </p>
            ) : null}
            {currentExceptions.length ? (
              <div className="mt-2 rounded-md border border-rose-200 bg-white px-2 py-1.5 text-xs text-rose-800">
                <p className="font-semibold">当前出库单有 {currentExceptions.length} 条未处理扫码异常</p>
                <p className="mt-1 truncate">{currentExceptions[0].severity === "critical" ? "严重异常" : "提醒"}：{currentExceptions[0].message}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-white p-3 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3">
            <ProgressLine label="拣货进度" total={currentRequiredQty} value={currentPickedQty} />
            <ProgressLine label="配货进度" total={currentRequiredQty} value={currentSortedQty} />
            <ProgressLine label="复核进度" total={currentRequiredQty} value={currentPackedQty} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">最近扫码记录</p>
              <span className="text-[11px] text-slate-400">{currentLastScans.length} 条</span>
            </div>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
              {currentLastScans.slice(0, 6).map((scan) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5" key={scan.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{actionLabel[scan.action] ?? scan.action}</span>
                    <span className="text-slate-400">{formatScanTime(scan.scannedAt)}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{scan.skuCode || scan.code} / {scan.operator}</p>
                </div>
              ))}
              {currentLastScans.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">暂无扫码记录</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Search size={17} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-950">扫码检索</h3>
        </div>
        <label className="mt-3 flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-cyan-500">
          <Search size={16} className="text-slate-400" />
          <input
            autoComplete="off"
            className="min-h-8 flex-1 bg-transparent text-sm text-slate-950 outline-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入 ASN、出库单、SKU、追踪号、库位"
            value={query}
          />
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {matches.map((record) => (
            <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={`${record.type}-${record.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-800">{typeLabel[record.type]}</span>
                <span className="font-mono text-[11px] text-slate-500">{record.id}</span>
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-slate-950">{record.title}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{record.detail}</p>
            </article>
          ))}
          {matches.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">没有匹配记录</div> : null}
        </div>
      </div>
    </section>
  );
}
