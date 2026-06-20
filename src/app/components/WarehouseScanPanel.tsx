"use client";

import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ScanLine, Search, ShieldAlert } from "lucide-react";

type ScanRecord = {
  id: string;
  type: "inbound" | "outbound" | "inventory" | "location" | "purchase" | "return";
  title: string;
  detail: string;
  tokens: string[];
};

type ScanMode = "outbound" | "purchase" | "return";
type OutboundScanAction = "pick" | "sort" | "pack" | "ship" | "intercept";
type PurchaseScanAction = "receive" | "putaway";
type ReturnScanAction = "receive" | "inspect";
type PurchaseDiscrepancyType = "shortage" | "overage" | "damaged" | "wrong_sku" | "missing_label" | "other";

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
  action: OutboundScanAction | PurchaseScanAction | ReturnScanAction;
  code: string;
  codeType: string;
  skuCode?: string;
  locationCode?: string;
  weightKg?: number;
  operator: string;
  scannedAt: string;
};

type ScanPurchaseTask = {
  id: string;
  label: string;
  status: string;
  supplierName: string;
  customerCode: string;
  trackingNumber?: string;
  totalExpectedQty: number;
  totalReceivedQty: number;
  totalPutawayQty: number;
  lines: Array<{ skuCode: string; productName?: string; expectedQty: number; receivedQty: number; putawayQty: number; locationCode?: string }>;
  scanLogs?: ScanLog[];
  exceptionNote?: string;
  discrepancyReports?: Array<{
    id: string;
    type: PurchaseDiscrepancyType;
    status: string;
    severity: string;
    skuCode?: string;
    affectedQty?: number;
    description: string;
    workOrderId?: string;
    createdAt: string;
  }>;
};

type ScanReturnTask = {
  id: string;
  label: string;
  status: string;
  customerCode: string;
  platform: string;
  originalOrderNo?: string;
  buyerReturnTracking?: string;
  expectedArrivalDate?: string;
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
  purchase?: ScanPurchaseTask | null;
  returnOrder?: ScanReturnTask | null;
};

const typeLabel: Record<ScanRecord["type"], string> = {
  inbound: "入库",
  outbound: "出库",
  inventory: "库存",
  location: "库位",
  purchase: "采购",
  return: "退货",
};

const scanActions: Array<{ value: OutboundScanAction; label: string; hint: string }> = [
  { value: "pick", label: "拣货", hint: "扫波次/拣货单后，扫库位和 SKU。" },
  { value: "sort", label: "配货", hint: "扫篮号/格口，再扫 SKU。" },
  { value: "pack", label: "打包复核", hint: "扫出库单或面单，再逐个扫 SKU。" },
  { value: "ship", label: "称重签出", hint: "扫出货标签/出库单，填重量后签出。" },
  { value: "intercept", label: "截单回库", hint: "扫出库单/SKU，确认回库位。" },
];

const purchaseScanActions: Array<{ value: PurchaseScanAction; label: string; hint: string }> = [
  { value: "receive", label: "到货签收", hint: "先扫采购单号或追踪号，再逐个扫 SKU，数量进入待上架库存。" },
  { value: "putaway", label: "库位上架", hint: "先扫采购单号或追踪号，再扫库位和 SKU，数量转为可售库存。" },
];

const returnScanActions: Array<{ value: ReturnScanAction; label: string; hint: string }> = [
  { value: "receive", label: "退货到仓", hint: "扫描 RMA 单号、买家退货追踪号或原平台订单号，确认退件已到仓。" },
  { value: "inspect", label: "退货质检", hint: "选择退货单后扫描 SKU 或库位，记录质检过程并同步客户售后工单。" },
];

const purchaseDiscrepancyTypes: Array<{ value: PurchaseDiscrepancyType; label: string }> = [
  { value: "shortage", label: "少货" },
  { value: "overage", label: "多货" },
  { value: "damaged", label: "破损" },
  { value: "wrong_sku", label: "错 SKU" },
  { value: "missing_label", label: "缺标签" },
  { value: "other", label: "其他差异" },
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

const actionLabel: Record<OutboundScanAction | PurchaseScanAction | ReturnScanAction, string> = {
  pick: "拣货",
  sort: "配货",
  pack: "复核",
  ship: "签出",
  intercept: "截单",
  receive: "签收",
  putaway: "上架",
  inspect: "质检",
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

export function WarehouseScanPanel({
  records,
  outboundTasks = [],
  purchaseTasks = [],
  returnTasks = [],
}: {
  records: ScanRecord[];
  outboundTasks?: ScanOutboundTask[];
  purchaseTasks?: ScanPurchaseTask[];
  returnTasks?: ScanReturnTask[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("outbound");
  const [scanAction, setScanAction] = useState<OutboundScanAction>("pick");
  const [purchaseAction, setPurchaseAction] = useState<PurchaseScanAction>("receive");
  const [returnAction, setReturnAction] = useState<ReturnScanAction>("receive");
  const [activeOrderId, setActiveOrderId] = useState("");
  const [activePurchaseId, setActivePurchaseId] = useState("");
  const [activeReturnId, setActiveReturnId] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [discrepancyType, setDiscrepancyType] = useState<PurchaseDiscrepancyType>("shortage");
  const [discrepancySkuCode, setDiscrepancySkuCode] = useState("");
  const [discrepancyActualQty, setDiscrepancyActualQty] = useState("");
  const [discrepancyAffectedQty, setDiscrepancyAffectedQty] = useState("");
  const [discrepancyDescription, setDiscrepancyDescription] = useState("");
  const [discrepancyPhotoUrls, setDiscrepancyPhotoUrls] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const cleanedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!cleanedQuery) return records.slice(0, 6);
    return records.filter((record) => record.tokens.some((token) => token.toLowerCase().includes(cleanedQuery))).slice(0, 8);
  }, [cleanedQuery, records]);
  const activeTask = outboundTasks.find((task) => task.id === activeOrderId);
  const activePurchaseTask = result?.purchase ?? purchaseTasks.find((task) => task.id === activePurchaseId);
  const activeReturnTask = result?.returnOrder ?? returnTasks.find((task) => task.id === activeReturnId);
  const resultProgress = result?.order?.scanProgress;
  const currentRequiredQty = activeTask?.requiredQty ?? 0;
  const currentPickedQty = resultProgress ? countScanned(resultProgress.pickedQtyBySku) : activeTask?.pickedQty ?? 0;
  const currentSortedQty = resultProgress ? countScanned(resultProgress.sortedQtyBySku) : activeTask?.sortedQty ?? 0;
  const currentPackedQty = resultProgress ? countScanned(resultProgress.packedQtyBySku) : activeTask?.packedQty ?? 0;
  const currentLastScans = resultProgress?.lastScans ?? activeTask?.lastScans ?? [];
  const purchaseLastScans = activePurchaseTask?.scanLogs ?? [];
  const returnLastScans = activeReturnTask?.scanLogs ?? [];
  const currentExceptions = (result?.order?.exceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
  const purchaseHint = purchaseScanActions.find((item) => item.value === purchaseAction)?.hint ?? "";
  const returnHint = returnScanActions.find((item) => item.value === returnAction)?.hint ?? "";
  const nextStep =
    scanMode === "return"
      ? activeReturnTask
        ? activeReturnTask.status === "received"
          ? "下一步：扫描 SKU 或库位，记录质检结果并同步客户售后工单。"
          : activeReturnTask.status === "inspection"
            ? "下一步：补充质检照片、处理方式或继续扫描其他 SKU。"
            : "下一步：扫描退货追踪号或 RMA 单号，确认退件到仓。"
        : "下一步：先扫描 RMA 单号、买家退货追踪号或原平台订单号。"
      : scanMode === "purchase"
      ? activePurchaseTask
        ? activePurchaseTask.totalReceivedQty < activePurchaseTask.totalExpectedQty
          ? "下一步：继续扫码签收 SKU，数量会进入待上架库存。"
          : activePurchaseTask.totalPutawayQty < activePurchaseTask.totalReceivedQty
            ? "下一步：扫描库位和 SKU，上架后转为可售库存。"
            : "下一步：该采购到货单已完成，可处理下一单。"
        : "下一步：先扫描采购到货单号或追踪号。"
      : currentRequiredQty > 0 && currentPickedQty < currentRequiredQty
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
      const isPurchase = scanMode === "purchase";
      const isReturn = scanMode === "return";
      const response = await fetch("/api/warehouse/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: scanMode,
          action: isReturn ? returnAction : isPurchase ? purchaseAction : scanAction,
          code: scanCode,
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
      if (response.ok) {
        setScanCode("");
        router.refresh();
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
    });
  }

  function submitPurchaseDiscrepancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePurchaseTask?.id) {
      setResult({ error: "请先选择或扫描采购到货单，再登记差异。" });
      return;
    }
    if (!discrepancyDescription.trim()) {
      setResult({ error: "请填写差异说明，例如少几件、外箱是否破损、是否需要客户确认。" });
      return;
    }

    startTransition(async () => {
      const selectedLine = activePurchaseTask.lines.find((line) => line.skuCode === discrepancySkuCode);
      const response = await fetch(`/api/warehouse/purchase-receipts/${encodeURIComponent(activePurchaseTask.id)}/discrepancies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: discrepancyType,
          severity: discrepancyType === "missing_label" ? "warning" : "critical",
          skuCode: discrepancySkuCode,
          expectedQty: selectedLine?.expectedQty,
          actualQty: discrepancyActualQty,
          affectedQty: discrepancyAffectedQty,
          description: discrepancyDescription,
          photoUrls: discrepancyPhotoUrls,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; order?: ScanPurchaseTask; workOrder?: { id: string } };
      if (!response.ok) {
        setResult({ error: payload.error || "采购到货差异登记失败。" });
        return;
      }
      setResult({
        message: `差异已登记${payload.workOrder?.id ? `，已生成客户待确认工单 ${payload.workOrder.id}` : ""}。`,
        purchase: payload.order,
      });
      setDiscrepancyDescription("");
      setDiscrepancyActualQty("");
      setDiscrepancyAffectedQty("");
      setDiscrepancyPhotoUrls("");
      router.refresh();
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
          <div className="grid gap-2 sm:grid-cols-[160px_180px_1fr]">
            <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setScanMode(event.target.value as ScanMode)} value={scanMode}>
              <option value="outbound">出库作业</option>
              <option value="purchase">采购到货</option>
              <option value="return">退货/RMA</option>
            </select>
            {scanMode === "return" ? (
              <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setReturnAction(event.target.value as ReturnScanAction)} value={returnAction}>
                {returnScanActions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            ) : scanMode === "purchase" ? (
              <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setPurchaseAction(event.target.value as PurchaseScanAction)} value={purchaseAction}>
                {purchaseScanActions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            ) : (
              <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setScanAction(event.target.value as OutboundScanAction)} value={scanAction}>
                {scanActions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            )}
            {scanMode === "return" ? (
              <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setActiveReturnId(event.target.value)} value={activeReturnId}>
                <option value="">先扫描 RMA、退货追踪号或手动选择退货单</option>
                {returnTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.id} / {task.platform} / {task.customerCode}</option>
                ))}
              </select>
            ) : scanMode === "purchase" ? (
              <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setActivePurchaseId(event.target.value)} value={activePurchaseId}>
                <option value="">先扫描采购单号/追踪号或手动选择到货单</option>
                {purchaseTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.id} / {task.supplierName} / {task.customerCode}</option>
                ))}
              </select>
            ) : (
              <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" onChange={(event) => setActiveOrderId(event.target.value)} value={activeOrderId}>
                <option value="">先扫描任务码或手动选择出库单</option>
                {outboundTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.id} / {task.label}</option>
                ))}
              </select>
            )}
          </div>
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-cyan-300 bg-cyan-50/60 px-3 focus-within:border-cyan-600">
            <ScanLine size={18} className="text-cyan-700" />
            <input
              ref={inputRef}
              autoComplete="off"
              autoFocus
              className="min-h-10 flex-1 bg-transparent text-base font-semibold text-slate-950 outline-none"
              onChange={(event) => setScanCode(event.target.value)}
              placeholder={scanMode === "return" ? "扫描 RMA、退货追踪号、原订单号、SKU 或库位后回车" : scanMode === "purchase" ? "扫描采购单号、追踪号、SKU 或库位后回车" : "扫描出库单、波次、拣货单、SKU、库位、篮号后回车"}
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
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{scanMode === "return" ? activeReturnTask?.id || "未选择" : scanMode === "purchase" ? activePurchaseTask?.id || "未选择" : activeTask?.id || result?.order?.id || "未选择"}</p>
            <p className="mt-1 text-xs text-slate-500">
              {scanMode === "return"
                ? activeReturnTask
                  ? `${activeReturnTask.platform} / ${activeReturnTask.customerCode} / ${activeReturnTask.buyerReturnTracking || activeReturnTask.originalOrderNo || "退货追踪号待补"}`
                  : "先扫 RMA 单号、退货追踪号、原订单号或手动选择退货单。"
                : scanMode === "purchase"
                ? activePurchaseTask
                  ? `${activePurchaseTask.supplierName} / ${activePurchaseTask.customerCode} / ${activePurchaseTask.trackingNumber || "追踪号待补"}`
                  : "先扫采购到货单、追踪号或手动选择到货单。"
                : activeTask
                  ? `${activeTask.workMode} / ${activeTask.pickWaveNo || "待生成波次"} / ${activeTask.basketNo || "无篮号"}`
                  : "先扫出库单、波次号或拣货单号。"}
            </p>
            <p className="mt-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-cyan-800">{nextStep}</p>
          </div>
          <div className={`rounded-md border p-3 ${result?.error ? "border-rose-200 bg-rose-50" : result?.message ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              {result?.error ? <ShieldAlert size={14} className="text-rose-700" /> : <CheckCircle2 size={14} className="text-emerald-700" />}
              扫码反馈
            </p>
            <p className={`mt-1 text-sm font-semibold ${result?.error ? "text-rose-800" : "text-slate-950"}`}>{result?.error || result?.message || (scanMode === "return" ? returnHint : scanMode === "purchase" ? purchaseHint : scanActions.find((item) => item.value === scanAction)?.hint)}</p>
            {result?.order?.scanProgress ? (
              <p className="mt-1 text-xs text-slate-500">
                拣货 {countScanned(result.order.scanProgress.pickedQtyBySku)} / 配货 {countScanned(result.order.scanProgress.sortedQtyBySku)} / 复核 {countScanned(result.order.scanProgress.packedQtyBySku)}
              </p>
            ) : null}
            {result?.purchase ? (
              <p className="mt-1 text-xs text-slate-500">
                预计 {result.purchase.totalExpectedQty} / 已签收 {result.purchase.totalReceivedQty} / 已上架 {result.purchase.totalPutawayQty}
              </p>
            ) : null}
            {result?.returnOrder ? (
              <p className="mt-1 text-xs text-slate-500">
                退货状态 {result.returnOrder.status} / 库位 {result.returnOrder.locationCode || "待定"} / 质检 {result.returnOrder.inspectionResult || "待质检"}
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
            {scanMode === "return" ? (
              <>
                <div className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-xs text-cyan-900">
                  <p className="font-semibold">退货/RMA 作业</p>
                  <p className="mt-1">状态：{activeReturnTask?.status || "未选择"}；库位：{activeReturnTask?.locationCode || "待定"}</p>
                  <p className="mt-1">质检：{activeReturnTask?.inspectionResult || "待质检"}</p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600">
                  {activeReturnTask?.skuLines.slice(0, 4).map((line) => (
                    <p className="truncate" key={`${activeReturnTask.id}-${line.skuCode}`}>
                      {line.skuCode}：{line.quantity} 件
                    </p>
                  )) || "选择退货单后显示 SKU 明细。"}
                </div>
              </>
            ) : scanMode === "purchase" ? (
              <>
                <ProgressLine label="签收进度" total={activePurchaseTask?.totalExpectedQty ?? 0} value={activePurchaseTask?.totalReceivedQty ?? 0} />
                <ProgressLine label="上架进度" total={activePurchaseTask?.totalReceivedQty ?? 0} value={activePurchaseTask?.totalPutawayQty ?? 0} />
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600">
                  {activePurchaseTask?.lines.slice(0, 3).map((line) => (
                    <p className="truncate" key={`${activePurchaseTask.id}-${line.skuCode}`}>
                      {line.skuCode}：签收 {line.receivedQty}/{line.expectedQty}，上架 {line.putawayQty}/{line.receivedQty}
                    </p>
                  )) || "选择采购到货单后显示 SKU 明细。"}
                </div>
                {activePurchaseTask?.exceptionNote ? <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{activePurchaseTask.exceptionNote}</p> : null}
                <form className="grid gap-2 rounded-md border border-amber-200 bg-amber-50/70 p-3" onSubmit={submitPurchaseDiscrepancy}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-amber-950">登记到货差异</p>
                    <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-amber-800">
                      {activePurchaseTask?.discrepancyReports?.filter((item) => item.status === "open" || item.status === "customer_pending").length ?? 0} 条待确认
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500" onChange={(event) => setDiscrepancyType(event.target.value as PurchaseDiscrepancyType)} value={discrepancyType}>
                      {purchaseDiscrepancyTypes.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                    <select className="h-9 rounded-md border border-amber-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500" onChange={(event) => setDiscrepancySkuCode(event.target.value)} value={discrepancySkuCode}>
                      <option value="">选择 SKU，可选</option>
                      {activePurchaseTask?.lines.map((line) => (
                        <option key={line.skuCode} value={line.skuCode}>{line.skuCode}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className="h-9 rounded-md border border-amber-200 px-2 text-xs outline-none focus:border-amber-500" inputMode="numeric" onChange={(event) => setDiscrepancyActualQty(event.target.value)} placeholder="实收数量，可选" value={discrepancyActualQty} />
                    <input className="h-9 rounded-md border border-amber-200 px-2 text-xs outline-none focus:border-amber-500" inputMode="numeric" onChange={(event) => setDiscrepancyAffectedQty(event.target.value)} placeholder="影响数量，可选" value={discrepancyAffectedQty} />
                  </div>
                  <textarea className="min-h-20 rounded-md border border-amber-200 bg-white px-2 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-amber-500" onChange={(event) => setDiscrepancyDescription(event.target.value)} placeholder="说明差异情况，例如少货 2 件、外箱破损、标签缺失、需客户确认补发或赔付。" value={discrepancyDescription} />
                  <input className="h-9 rounded-md border border-amber-200 px-2 text-xs outline-none focus:border-amber-500" onChange={(event) => setDiscrepancyPhotoUrls(event.target.value)} placeholder="照片/凭证链接，可用逗号或换行分隔" value={discrepancyPhotoUrls} />
                  <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60" disabled={isPending || !activePurchaseTask} type="submit">
                    登记差异并通知客户
                  </button>
                </form>
              </>
            ) : (
              <>
                <ProgressLine label="拣货进度" total={currentRequiredQty} value={currentPickedQty} />
                <ProgressLine label="配货进度" total={currentRequiredQty} value={currentSortedQty} />
                <ProgressLine label="复核进度" total={currentRequiredQty} value={currentPackedQty} />
              </>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">最近扫码记录</p>
              <span className="text-[11px] text-slate-400">{scanMode === "return" ? returnLastScans.length : scanMode === "purchase" ? purchaseLastScans.length : currentLastScans.length} 条</span>
            </div>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
              {(scanMode === "return" ? returnLastScans : scanMode === "purchase" ? purchaseLastScans : currentLastScans).slice(0, 6).map((scan) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5" key={scan.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{actionLabel[scan.action] ?? scan.action}</span>
                    <span className="text-slate-400">{formatScanTime(scan.scannedAt)}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{scan.skuCode || scan.code} / {scan.operator}</p>
                </div>
              ))}
              {(scanMode === "return" ? returnLastScans : scanMode === "purchase" ? purchaseLastScans : currentLastScans).length === 0 ? <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">暂无扫码记录</p> : null}
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
