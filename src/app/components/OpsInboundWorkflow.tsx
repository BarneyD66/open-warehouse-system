"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Loader2, PackageCheck, Save } from "lucide-react";
import type { InboundStatus } from "@/lib/localStore";

const statusOptions: Array<{ value: InboundStatus; label: string }> = [
  { value: "submitted", label: "已提交" },
  { value: "docs_review", label: "资料审核中" },
  { value: "docs_review_passed", label: "资料已通过" },
  { value: "appointment_confirmed", label: "已预约入仓" },
  { value: "arrived", label: "已到仓" },
  { value: "receiving", label: "收货验收中" },
  { value: "received", label: "已收货" },
  { value: "putaway_completed", label: "已上架" },
  { value: "on_hold", label: "暂缓处理" },
  { value: "exception", label: "异常处理中" },
  { value: "closed", label: "已关闭" },
  { value: "cancelled", label: "已取消" },
];

type OpsInboundWorkflowProps = {
  id: string;
  status: InboundStatus;
  appointmentAt?: string;
  opsNote?: string;
  exceptionNote?: string;
  missingRequired: string[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

export function OpsInboundWorkflow({ id, status, appointmentAt, opsNote, exceptionNote, missingRequired }: OpsInboundWorkflowProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!mounted) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/inbounds/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: String(data.get("status") ?? ""),
          appointmentAt: String(data.get("appointmentAt") ?? ""),
          opsNote: String(data.get("opsNote") ?? ""),
          exceptionNote: String(data.get("exceptionNote") ?? ""),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败，请稍后再试。");
      setMessage("已更新入库状态");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-4 rounded-lg border border-slate-200 bg-white p-4" onSubmit={handleSubmit}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <PackageCheck size={16} className="text-[#0E7490]" />
            入库状态推进
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">更新 ASN 状态、预约时间、运营备注和异常说明。</p>
        </div>
        {missingRequired.length > 0 ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            仍缺：{missingRequired.join("、")}
          </span>
        ) : (
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">资料可审核</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="入库状态">
          <select className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={status === "pending_review" ? "submitted" : status} name="status">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="预约 / 到仓时间">
          <input className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={appointmentAt ?? ""} name="appointmentAt" type="datetime-local" />
        </Field>
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950">
          <p className="flex items-center gap-1 font-semibold text-slate-950">
            <CalendarClock size={14} /> 状态建议
          </p>
          <p className="mt-1">{missingRequired.length > 0 ? "资料未齐时建议保持资料审核中或暂缓处理。" : "资料齐全后可推进到资料已通过或预约入仓。"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="运营备注">
          <textarea className="min-h-20 rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={opsNote ?? ""} name="opsNote" />
        </Field>
        <Field label="异常说明">
          <textarea className="min-h-20 rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={exceptionNote ?? ""} name="exceptionNote" />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {submitting ? "保存中" : "保存入库状态"}
        </button>
        {message ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} /> {message}
          </span>
        ) : null}
        {error ? <span className="text-sm font-semibold text-rose-600">{error}</span> : null}
      </div>
    </form>
  );
}
