"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";

type TaskType = "inbound" | "outbound";

type Props = {
  id: string;
  type: TaskType;
  status: string;
  options: Array<{ value: string; label: string }>;
  locationEnabled?: boolean;
  note?: string;
};

export function WarehouseTaskAction({ id, type, status, options, locationEnabled = false, note }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState(status);
  const [location, setLocation] = useState("");
  const [nextNote, setNextNote] = useState(note ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/warehouse/tasks/${type}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, location, note: nextNote }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "保存失败，请稍后重试。");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <select
        className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNextStatus(event.target.value)}
        value={nextStatus}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {locationEnabled ? (
        <input
          className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
          onChange={(event) => setLocation(event.target.value)}
          placeholder="库位，如 A-01-03"
          value={location}
        />
      ) : null}
      <input
        className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNextNote(event.target.value)}
        placeholder="作业备注"
        value={nextNote}
      />
      <button
        className="inline-flex min-h-9 min-w-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        disabled={isPending}
        onClick={save}
        type="button"
      >
        {isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
        保存作业
      </button>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
