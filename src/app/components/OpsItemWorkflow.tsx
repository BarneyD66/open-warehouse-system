"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import type { OpsKind } from "@/lib/opsStore";

type OpsItemWorkflowProps = {
  id: string;
  kind: OpsKind;
  status: string;
  owner: string;
  note?: string;
  options: Array<{ value: string; label: string }>;
};

export function OpsItemWorkflow({ id, kind, status, owner, note, options }: OpsItemWorkflowProps) {
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
      const response = await fetch(`/api/ops/${kind}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: String(data.get("status") ?? ""),
          owner: String(data.get("owner") ?? ""),
          note: String(data.get("note") ?? ""),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败，请稍后再试。");
      setMessage("已保存");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid min-w-[460px] grid-cols-[130px_110px_1fr_88px] items-center gap-2" onSubmit={handleSubmit}>
      <select className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#0E7490]" defaultValue={status} name="status">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#0E7490]" defaultValue={owner} name="owner" />
      <input className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#0E7490]" defaultValue={note ?? ""} name="note" />
      <button className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md bg-slate-950 px-2 text-xs font-semibold text-white disabled:opacity-60" disabled={submitting} type="submit">
        {submitting ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
        保存
      </button>
      {message ? (
        <span className="col-span-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={13} /> {message}
        </span>
      ) : null}
      {error ? <span className="col-span-4 text-xs font-semibold text-rose-600">{error}</span> : null}
    </form>
  );
}
