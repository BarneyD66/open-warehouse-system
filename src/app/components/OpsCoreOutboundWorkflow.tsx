"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import type { CoreOutboundOrder } from "@/lib/warehouseCoreStore";

type Props = {
  id: string;
  status: CoreOutboundOrder["status"];
  note?: string;
};

const options: Array<{ value: CoreOutboundOrder["status"]; label: string }> = [
  { value: "pending_review", label: "待审核" },
  { value: "picking", label: "拣货中" },
  { value: "label_pending", label: "待面单" },
  { value: "packing_check", label: "包装复核" },
  { value: "handover", label: "待交运" },
  { value: "shipped", label: "已发货" },
  { value: "blocked", label: "异常阻塞" },
];

export function OpsCoreOutboundWorkflow({ id, status, note }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<CoreOutboundOrder["status"]>(status);
  const [nextNote, setNextNote] = useState(note ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/outbounds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note: nextNote }),
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
    <div className="grid min-w-[260px] gap-2">
      <select
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNextStatus(event.target.value as CoreOutboundOrder["status"])}
        value={nextStatus}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500"
        onChange={(event) => setNextNote(event.target.value)}
        placeholder="操作备注"
        value={nextNote}
      />
      <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={save} type="button">
        <Save size={14} />
        保存进度
      </button>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
