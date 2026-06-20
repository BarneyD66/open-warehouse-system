"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, SlidersHorizontal, XCircle } from "lucide-react";
import type { DocumentRecord } from "@/lib/documentStore";
import type { ApprovalTimelineEvent, InventoryAdjustmentRequest, InventoryBalance, InventoryControlAction } from "@/lib/warehouseCoreStore";
import { DocumentUploadPanel } from "./DocumentUploadPanel";

type Props = {
  balances: InventoryBalance[];
  adjustments: InventoryAdjustmentRequest[];
  canReview: boolean;
  documents?: DocumentRecord[];
};

function formatDelta(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function statusLabel(status: InventoryAdjustmentRequest["status"]) {
  if (status === "approved") return "已通过";
  if (status === "rejected") return "已驳回";
  return "待审批";
}

function ApprovalTimelineList({ events }: { events?: ApprovalTimelineEvent[] }) {
  const latest = (events ?? []).slice(0, 3);
  if (latest.length === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500">审批记录</p>
      <div className="mt-2 grid gap-2">
        {latest.map((event) => (
          <div className="grid gap-1 border-l-2 border-cyan-500 pl-2 text-[11px] text-slate-600" key={event.id}>
            <p className="font-semibold text-slate-900">{event.label} · {event.actor}</p>
            <p>{new Date(event.occurredAt).toLocaleString("zh-CN", { hour12: false })}</p>
            {event.note ? <p className="leading-4 text-slate-500">{event.note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const controlActionLabels: Record<InventoryControlAction, string> = {
  manual_adjust: "手工调整",
  freeze: "冻结库存",
  release: "释放冻结",
  defective: "转残次品",
  restore: "恢复良品",
  move_location: "移库",
};

export function OpsInventoryAdjustmentForm({ balances, adjustments, canReview, documents = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(balances[0]?.id ?? "");
  const [availableDelta, setAvailableDelta] = useState("0");
  const [reservedDelta, setReservedDelta] = useState("0");
  const [controlAction, setControlAction] = useState<InventoryControlAction>("manual_adjust");
  const [quantity, setQuantity] = useState("");
  const [nextLocationCode, setNextLocationCode] = useState("");
  const [alertQty, setAlertQty] = useState("");
  const [agingDays, setAgingDays] = useState("");
  const [note, setNote] = useState("");
  const [reviewNoteById, setReviewNoteById] = useState<Record<string, string>>({});
  const [reviewConfirmationById, setReviewConfirmationById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = balances.find((item) => item.id === selectedId);
  const selectedFrozenQty = selected?.frozenQty ?? 0;
  const selectedDefectiveQty = selected?.defectiveQty ?? 0;
  const pendingAdjustments = adjustments.filter((item) => item.status === "pending");
  const recentAdjustments = adjustments.filter((item) => item.status !== "pending").slice(0, 4);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!selected) {
      setError("请选择要调整的 SKU。");
      return;
    }
    if (!note.trim()) {
      setError("请填写调整原因，方便后续审批和追责。");
      return;
    }
    if (["freeze", "release", "defective", "restore"].includes(controlAction) && Number(quantity) <= 0) {
      setError("请填写大于 0 的处理数量。");
      return;
    }
    if (controlAction === "move_location" && !nextLocationCode.trim()) {
      setError("移库时请填写目标库位。");
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
          availableDelta,
          reservedDelta,
          controlAction,
          quantity,
          nextLocationCode,
          alertQty,
          agingDays,
          note,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "库存调整申请提交失败，请稍后重试。");
        return;
      }
      setMessage("已提交库存调整审批，审批通过后才会写入库存流水。");
      setAvailableDelta("0");
      setReservedDelta("0");
      setQuantity("");
      setNextLocationCode("");
      setAlertQty("");
      setAgingDays("");
      setNote("");
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
        body: JSON.stringify({ id, action, reviewNote: reviewNoteById[id] ?? "", confirmation: reviewConfirmationById[id] ?? "" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "库存调整审批失败，请稍后重试。");
        return;
      }
      setMessage(action === "approve" ? "库存调整已审批通过，并写入库存流水。" : "库存调整申请已驳回。");
      setReviewNoteById((current) => ({ ...current, [id]: "" }));
      setReviewConfirmationById((current) => ({ ...current, [id]: "" }));
      router.refresh();
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-[#0E7490]" />
          <h2 className="text-base font-semibold text-slate-950">库存调整 / 盘点申请</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">提交后进入审批队列，只有管理员或运营审批通过后才会变更库存。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-500 md:col-span-2">
            SKU
            <select className="min-h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setSelectedId(event.target.value)} value={selectedId}>
              {balances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.customerCode} / {item.skuCode} / 可用 {item.availableQty} / 冻结 {item.frozenQty ?? 0} / 残次 {item.defectiveQty ?? 0}
                </option>
              ))}
            </select>
            {selected ? (
              <span className="mt-1 text-[11px] font-semibold text-slate-500">
                当前：可用 {selected.availableQty} / 占用 {selected.reservedQty} / 冻结 {selectedFrozenQty} / 残次 {selectedDefectiveQty} / 在途 {selected.inboundQty}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            管控动作
            <select className="min-h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setControlAction(event.target.value as InventoryControlAction)} value={controlAction}>
              {Object.entries(controlActionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            处理数量
            <input className="min-h-10 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500" disabled={controlAction === "manual_adjust" || controlAction === "move_location"} min="0" onChange={(event) => setQuantity(event.target.value)} placeholder="冻结/残次/释放时填写" type="number" value={quantity} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            可用增减
            <input className="min-h-10 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-400" disabled={controlAction !== "manual_adjust"} onChange={(event) => setAvailableDelta(event.target.value)} type="number" value={availableDelta} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            占用增减
            <input className="min-h-10 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-400" disabled={controlAction !== "manual_adjust"} onChange={(event) => setReservedDelta(event.target.value)} type="number" value={reservedDelta} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500 md:col-span-2">
            目标库位
            <input className="min-h-10 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-400" disabled={controlAction !== "move_location"} onChange={(event) => setNextLocationCode(event.target.value)} placeholder="例如 A-01-03" value={nextLocationCode} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            新预警值
            <input className="min-h-10 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500" min="0" onChange={(event) => setAlertQty(event.target.value)} placeholder="不变" type="number" value={alertQty} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            新库龄
            <input className="min-h-10 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500" min="0" onChange={(event) => setAgingDays(event.target.value)} placeholder="不变" type="number" value={agingDays} />
          </label>
        </div>
        <textarea className="mt-3 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500" onChange={(event) => setNote(event.target.value)} placeholder="调整原因，例如盘点差异、破损扣减、补录入库。" value={note} />
        <button className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || balances.length === 0} type="submit">
          {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
          提交审批
        </button>
        {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">库存调整审批</h2>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{pendingAdjustments.length} 条待审批</span>
        </div>
        <div className="mt-4 grid gap-3">
          {pendingAdjustments.length > 0 ? (
            pendingAdjustments.slice(0, 5).map((item) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-slate-950">{item.skuCode}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.customerCode} / {item.warehouseCode}</p>
                  </div>
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{statusLabel(item.status)}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <p>可用 {item.beforeAvailableQty} {"->"} {item.beforeAvailableQty + item.availableDelta} ({formatDelta(item.availableDelta)})</p>
                  <p>占用 {item.beforeReservedQty} {"->"} {item.beforeReservedQty + item.reservedDelta} ({formatDelta(item.reservedDelta)})</p>
                  <p>冻结 {item.beforeFrozenQty ?? 0} {"->"} {(item.beforeFrozenQty ?? 0) + (item.frozenDelta ?? 0)} ({formatDelta(item.frozenDelta ?? 0)})</p>
                  <p>残次 {item.beforeDefectiveQty ?? 0} {"->"} {(item.beforeDefectiveQty ?? 0) + (item.defectiveDelta ?? 0)} ({formatDelta(item.defectiveDelta ?? 0)})</p>
                  <p>{controlActionLabels[item.controlAction ?? "manual_adjust"]} / {item.requestedBy}</p>
                </div>
                {item.nextLocationCode ? <p className="mt-2 rounded-md bg-cyan-50 p-2 text-xs font-semibold text-cyan-800">库位 {item.beforeLocationCode || "-"} {"->"} {item.nextLocationCode}</p> : null}
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.reason}</p>
                <ApprovalTimelineList events={item.approvalTimeline} />
                {canReview ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                    <input
                      className="min-h-9 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-cyan-500"
                      onChange={(event) => setReviewNoteById((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="审批备注，驳回时必填"
                      value={reviewNoteById[item.id] ?? ""}
                    />
                    <input
                      className="min-h-9 rounded-md border border-slate-200 px-2 font-mono text-xs outline-none focus:border-cyan-500"
                      onChange={(event) => setReviewConfirmationById((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder={`二次确认：${item.id}`}
                      value={reviewConfirmationById[item.id] ?? ""}
                    />
                    <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={isPending} onClick={() => review(item.id, "approve")} type="button">
                      <CheckCircle2 size={14} />
                      通过
                    </button>
                    <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60" disabled={isPending} onClick={() => review(item.id, "reject")} type="button">
                      <XCircle size={14} />
                      驳回
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 rounded-md bg-slate-100 p-2 text-xs font-semibold text-slate-500">当前角色只能提交申请，审批需由管理员或运营处理。</p>
                )}
                {canReview ? (
                  <DocumentUploadPanel
                    category="other"
                    customerCode={item.customerCode}
                    documents={documents.filter((document) => document.refType === "approval" && document.refId === item.id)}
                    refId={item.id}
                    refType="approval"
                    title="审批附件"
                    uploadEndpoint="/api/ops/documents"
                  />
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">暂无待审批库存调整</div>
          )}
        </div>
        {recentAdjustments.length > 0 ? (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold text-slate-500">最近审批结果</p>
            <div className="mt-2 grid gap-2">
              {recentAdjustments.map((item) => (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600" key={item.id}>
                  <span className="font-mono font-semibold text-slate-900">{item.skuCode}</span>
                  <span>{controlActionLabels[item.controlAction ?? "manual_adjust"]} / 可用 {formatDelta(item.availableDelta)} / 冻结 {formatDelta(item.frozenDelta ?? 0)} / 残次 {formatDelta(item.defectiveDelta ?? 0)}</span>
                  <span>{statusLabel(item.status)}</span>
                  {item.approvalTimeline?.[0] ? <span className="basis-full text-[11px] text-slate-500">最近审批：{item.approvalTimeline[0].label} / {item.approvalTimeline[0].actor}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
