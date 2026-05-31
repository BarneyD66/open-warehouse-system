"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import type { ReturnOrder, ReturnResolution } from "@/lib/warehouseCoreStore";

type Props = {
  id: string;
  status: ReturnOrder["status"];
  inspectionResult?: string;
  opsNote?: string;
  locationCode?: string;
  resolution?: ReturnResolution;
};

const statusOptions: Array<{ value: ReturnOrder["status"]; label: string }> = [
  { value: "requested", label: "待审核" },
  { value: "label_sent", label: "已发退货指引" },
  { value: "in_transit", label: "退货在途" },
  { value: "received", label: "已到仓" },
  { value: "inspection", label: "质检中" },
  { value: "restocked", label: "已重新上架" },
  { value: "repair", label: "维修处理中" },
  { value: "disposed", label: "已报废" },
  { value: "closed", label: "已关闭" },
  { value: "exception", label: "异常处理" },
];

const resolutionOptions: Array<{ value: "" | ReturnResolution; label: string }> = [
  { value: "", label: "处理结果待定" },
  { value: "restock", label: "重新上架" },
  { value: "repair", label: "维修/翻新" },
  { value: "dispose", label: "报废" },
  { value: "reship", label: "转寄/重发" },
];

export function OpsReturnWorkflow({ id, status, inspectionResult, opsNote, locationCode, resolution }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<ReturnOrder["status"]>(status);
  const [nextResolution, setNextResolution] = useState<"" | ReturnResolution>(resolution ?? "");
  const [nextInspectionResult, setNextInspectionResult] = useState(inspectionResult ?? "");
  const [nextLocationCode, setNextLocationCode] = useState(locationCode ?? "");
  const [nextOpsNote, setNextOpsNote] = useState(opsNote ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/returns/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          resolution: nextResolution,
          inspectionResult: nextInspectionResult,
          locationCode: nextLocationCode,
          opsNote: nextOpsNote,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "保存退货处理失败，请稍后重试。");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid min-w-[280px] gap-2">
      <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNextStatus(event.target.value as ReturnOrder["status"])} value={nextStatus}>
        {statusOptions.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNextResolution(event.target.value as "" | ReturnResolution)} value={nextResolution}>
        {resolutionOptions.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNextLocationCode(event.target.value)} placeholder="重新上架库位，如 A-01-03" value={nextLocationCode} />
      <textarea className="min-h-16 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNextInspectionResult(event.target.value)} placeholder="质检结果，如外箱破损、商品完好、缺配件" value={nextInspectionResult} />
      <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setNextOpsNote(event.target.value)} placeholder="运营备注" value={nextOpsNote} />
      <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={save} type="button">
        <Save size={14} />
        保存退货进度
      </button>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
