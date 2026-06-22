"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, LocateFixed, LogOut, PackageCheck, Radio, RotateCcw, ScanLine, Truck } from "lucide-react";

type ScanMode = "outbound" | "purchase" | "return";
type OutboundScanAction = "pick" | "sort" | "pack" | "ship" | "intercept";
type PurchaseScanAction = "receive" | "putaway";
type ReturnScanAction = "receive" | "inspect";
type ScanAction = OutboundScanAction | PurchaseScanAction | ReturnScanAction;

type ScanLog = {
  id: string;
  action: ScanAction;
  code: string;
  codeType: string;
  skuCode?: string;
  locationCode?: string;
  weightKg?: number;
  operator: string;
  scannedAt: string;
};

export type PdaOutboundTask = {
  id: string;
  label: string;
  status: string;
  customerCode: string;
  channel: string;
  workMode: string;
  pickWaveNo?: string;
  pickListNo?: string;
  basketNo?: string;
  requiredQty: number;
  pickedQty: number;
  sortedQty: number;
  packedQty: number;
  skuLines: Array<{ skuCode: string; quantity: number }>;
  lastScans?: ScanLog[];
};

export type PdaPurchaseTask = {
  id: string;
  label: string;
  status: string;
  supplierName: string;
  customerCode: string;
  trackingNumber?: string;
  totalExpectedQty: number;
  totalReceivedQty: number;
  totalPutawayQty: number;
  lines: Array<{ skuCode: string; expectedQty: number; receivedQty: number; putawayQty: number; locationCode?: string }>;
  scanLogs?: ScanLog[];
};

export type PdaReturnTask = {
  id: string;
  label: string;
  status: string;
  customerCode: string;
  platform: string;
  originalOrderNo?: string;
  buyerReturnTracking?: string;
  locationCode?: string;
  inspectionResult?: string;
  skuLines: Array<{ skuCode: string; quantity: number }>;
  scanLogs?: ScanLog[];
};

type ScanResult = {
  message?: string;
  error?: string;
  codeType?: string;
  order?: {
    id: string;
    status: string;
    scanProgress?: {
      pickedQtyBySku?: Record<string, number>;
      sortedQtyBySku?: Record<string, number>;
      packedQtyBySku?: Record<string, number>;
      lastScans?: ScanLog[];
    };
    exceptions?: Array<{ id: string; status: string; severity: string; message: string }>;
  } | null;
  purchase?: PdaPurchaseTask | null;
  returnOrder?: PdaReturnTask | null;
};

const modeOptions: Array<{ value: ScanMode; label: string; icon: typeof Truck }> = [
  { value: "outbound", label: "出库", icon: Truck },
  { value: "purchase", label: "到货", icon: PackageCheck },
  { value: "return", label: "退货", icon: RotateCcw },
];

const outboundActions: Array<{ value: OutboundScanAction; label: string }> = [
  { value: "pick", label: "拣货" },
  { value: "sort", label: "分拣" },
  { value: "pack", label: "复核" },
  { value: "ship", label: "签出" },
  { value: "intercept", label: "截单" },
];

const purchaseActions: Array<{ value: PurchaseScanAction; label: string }> = [
  { value: "receive", label: "签收" },
  { value: "putaway", label: "上架" },
];

const returnActions: Array<{ value: ReturnScanAction; label: string }> = [
  { value: "receive", label: "到仓" },
  { value: "inspect", label: "质检" },
];

const actionLabels: Record<ScanAction, string> = {
  pick: "拣货",
  sort: "分拣",
  pack: "复核",
  ship: "签出",
  intercept: "截单",
  receive: "签收",
  putaway: "上架",
  inspect: "质检",
};

function countScanned(progress?: Record<string, number>) {
  return Object.values(progress ?? {}).reduce((sum, qty) => sum + qty, 0);
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function compactTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function ProgressBar({ label, value, total }: { label: string; value: number; total: number }) {
  const done = percent(value, total);
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span className="font-mono text-slate-900">
          {value}/{total}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={done >= 100 ? "h-full bg-emerald-500" : "h-full bg-cyan-600"} style={{ width: `${done}%` }} />
      </div>
    </div>
  );
}

export function PdaScanConsole({
  staffLabel,
  outboundTasks,
  purchaseTasks,
  returnTasks,
}: {
  staffLabel: string;
  outboundTasks: PdaOutboundTask[];
  purchaseTasks: PdaPurchaseTask[];
  returnTasks: PdaReturnTask[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ScanMode>("outbound");
  const [outboundAction, setOutboundAction] = useState<OutboundScanAction>("pick");
  const [purchaseAction, setPurchaseAction] = useState<PurchaseScanAction>("receive");
  const [returnAction, setReturnAction] = useState<ReturnScanAction>("receive");
  const [activeOrderId, setActiveOrderId] = useState(outboundTasks[0]?.id ?? "");
  const [activePurchaseId, setActivePurchaseId] = useState(purchaseTasks[0]?.id ?? "");
  const [activeReturnId, setActiveReturnId] = useState(returnTasks[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const action = mode === "return" ? returnAction : mode === "purchase" ? purchaseAction : outboundAction;
  const activeOutbound = outboundTasks.find((task) => task.id === activeOrderId);
  const activePurchase = result?.purchase?.id === activePurchaseId ? result.purchase : purchaseTasks.find((task) => task.id === activePurchaseId);
  const activeReturn = result?.returnOrder?.id === activeReturnId ? result.returnOrder : returnTasks.find((task) => task.id === activeReturnId);
  const progress = result?.order?.id === activeOrderId ? result.order.scanProgress : undefined;
  const pickedQty = progress ? countScanned(progress.pickedQtyBySku) : activeOutbound?.pickedQty ?? 0;
  const sortedQty = progress ? countScanned(progress.sortedQtyBySku) : activeOutbound?.sortedQty ?? 0;
  const packedQty = progress ? countScanned(progress.packedQtyBySku) : activeOutbound?.packedQty ?? 0;
  const requiredQty = activeOutbound?.requiredQty ?? 0;
  const lastScans = useMemo(() => {
    if (mode === "return") return activeReturn?.scanLogs ?? [];
    if (mode === "purchase") return activePurchase?.scanLogs ?? [];
    return progress?.lastScans ?? activeOutbound?.lastScans ?? [];
  }, [activeOutbound, activePurchase, activeReturn, mode, progress]);

  const currentTaskLabel =
    mode === "return"
      ? activeReturn
        ? `${activeReturn.platform} / ${activeReturn.customerCode}`
        : "未选择退货任务"
      : mode === "purchase"
        ? activePurchase
          ? `${activePurchase.supplierName} / ${activePurchase.customerCode}`
          : "未选择到货任务"
        : activeOutbound
          ? `${activeOutbound.channel} / ${activeOutbound.customerCode}`
          : "未选择出库任务";

  const skuPreview =
    mode === "return"
      ? activeReturn?.skuLines ?? []
      : mode === "purchase"
        ? activePurchase?.lines.map((line) => ({ skuCode: line.skuCode, quantity: line.expectedQty })) ?? []
        : activeOutbound?.skuLines ?? [];

  function focusScanner() {
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }

  function resetResult() {
    setResult(null);
    setCode("");
    focusScanner();
  }

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setResult({ error: "请先扫描或输入条码。" });
      focusScanner();
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/warehouse/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: mode,
          action,
          code: trimmedCode,
          activeOrderId,
          activePurchaseId,
          activeReturnId,
          locationCode,
          weightKg,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ScanResult;
      setResult(payload);
      if (payload.order?.id) setActiveOrderId(payload.order.id);
      if (payload.purchase?.id) setActivePurchaseId(payload.purchase.id);
      if (payload.returnOrder?.id) setActiveReturnId(payload.returnOrder.id);
      if (response.ok) setCode("");
      focusScanner();
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-3 px-3 py-3">
        <header className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">PDA 作业台</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">扫码处理</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${online ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                <Radio size={13} />
                {online ? "在线" : "离线"}
              </span>
              <Link className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700" href="/warehouse" title="返回仓库工作台">
                <LocateFixed size={17} />
              </Link>
              <form action="/api/logout?next=/ops-login" method="post">
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white" title="退出登录" type="submit">
                  <LogOut size={17} />
                </button>
              </form>
            </div>
          </div>
          <p className="mt-2 truncate text-xs font-semibold text-slate-500">{staffLabel}</p>
        </header>

        <section className="grid grid-cols-3 gap-2">
          {modeOptions.map((item) => {
            const Icon = item.icon;
            const active = mode === item.value;
            return (
              <button
                className={`flex min-h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold ${active ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                key={item.value}
                onClick={() => {
                  setMode(item.value);
                  resetResult();
                }}
                type="button"
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </section>

        <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" onSubmit={submit}>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-cyan-600"
              onChange={(event) => {
                if (mode === "return") setReturnAction(event.target.value as ReturnScanAction);
                else if (mode === "purchase") setPurchaseAction(event.target.value as PurchaseScanAction);
                else setOutboundAction(event.target.value as OutboundScanAction);
                focusScanner();
              }}
              value={action}
            >
              {(mode === "return" ? returnActions : mode === "purchase" ? purchaseActions : outboundActions).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-cyan-600"
              onChange={(event) => {
                if (mode === "return") setActiveReturnId(event.target.value);
                else if (mode === "purchase") setActivePurchaseId(event.target.value);
                else setActiveOrderId(event.target.value);
                resetResult();
              }}
              value={mode === "return" ? activeReturnId : mode === "purchase" ? activePurchaseId : activeOrderId}
            >
              <option value="">先扫单号或选择任务</option>
              {(mode === "return" ? returnTasks : mode === "purchase" ? purchaseTasks : outboundTasks).map((task) => (
                <option key={task.id} value={task.id}>
                  {task.id} / {task.label}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-3 flex min-h-16 items-center gap-3 rounded-md border-2 border-cyan-500 bg-cyan-50 px-3">
            <ScanLine className="shrink-0 text-cyan-700" size={24} />
            <input
              ref={inputRef}
              autoComplete="off"
              autoFocus
              className="min-h-12 flex-1 bg-transparent text-xl font-semibold text-slate-950 outline-none"
              onChange={(event) => setCode(event.target.value)}
              placeholder="扫描条码后回车"
              value={code}
            />
          </label>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_112px]">
            <input className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600" onChange={(event) => setLocationCode(event.target.value)} placeholder="库位，可选" value={locationCode} />
            <input className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600" inputMode="decimal" onChange={(event) => setWeightKg(event.target.value)} placeholder="重量 kg" value={weightKg} />
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="animate-spin" size={16} /> : <ScanLine size={16} />}
              提交
            </button>
          </div>
        </form>

        <section className={`rounded-lg border p-3 shadow-sm ${result?.error ? "border-rose-200 bg-rose-50" : result?.message ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="flex items-start gap-2">
            {result?.error ? <AlertTriangle className="mt-0.5 text-rose-700" size={18} /> : <CheckCircle2 className="mt-0.5 text-emerald-700" size={18} />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500">扫码反馈</p>
              <p className={`mt-1 text-base font-semibold ${result?.error ? "text-rose-800" : "text-slate-950"}`}>{result?.error || result?.message || `当前动作：${actionLabels[action]}`}</p>
              {result?.codeType ? <p className="mt-1 text-xs font-mono text-slate-500">codeType: {result.codeType}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">当前任务</p>
              <h2 className="mt-1 truncate text-base font-semibold">{mode === "return" ? activeReturn?.id ?? "-" : mode === "purchase" ? activePurchase?.id ?? "-" : activeOutbound?.id ?? "-"}</h2>
              <p className="mt-1 truncate text-xs text-slate-500">{currentTaskLabel}</p>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
              {mode === "return" ? activeReturn?.status ?? "-" : mode === "purchase" ? activePurchase?.status ?? "-" : activeOutbound?.status ?? "-"}
            </span>
          </div>

          {mode === "outbound" ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ProgressBar label="拣货" total={requiredQty} value={pickedQty} />
              <ProgressBar label="分拣" total={requiredQty} value={sortedQty} />
              <ProgressBar label="复核" total={requiredQty} value={packedQty} />
            </div>
          ) : mode === "purchase" ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ProgressBar label="签收" total={activePurchase?.totalExpectedQty ?? 0} value={activePurchase?.totalReceivedQty ?? 0} />
              <ProgressBar label="上架" total={activePurchase?.totalReceivedQty ?? 0} value={activePurchase?.totalPutawayQty ?? 0} />
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
              <p className="text-slate-600">库位：{activeReturn?.locationCode || "待定"}</p>
              <p className="mt-1 text-slate-600">质检：{activeReturn?.inspectionResult || "待处理"}</p>
            </div>
          )}

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-xs font-semibold text-slate-500">SKU</p>
            <div className="mt-2 grid gap-1">
              {skuPreview.slice(0, 4).map((line) => (
                <p className="truncate font-mono text-xs text-slate-700" key={line.skuCode}>
                  {line.skuCode} x {line.quantity}
                </p>
              ))}
              {skuPreview.length === 0 ? <p className="text-xs text-slate-500">暂无 SKU 明细</p> : null}
            </div>
          </div>
        </section>

        <section className="mb-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">最近扫码</h2>
            <span className="text-xs font-semibold text-slate-400">{lastScans.length} 条</span>
          </div>
          <div className="mt-2 grid gap-2">
            {lastScans.slice(0, 6).map((scan) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2" key={scan.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-800">{actionLabels[scan.action] ?? scan.action}</span>
                  <span className="font-mono text-slate-400">{compactTime(scan.scannedAt)}</span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-slate-500">{scan.skuCode || scan.locationCode || scan.code}</p>
              </div>
            ))}
            {lastScans.length === 0 ? <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">暂无扫码记录</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
