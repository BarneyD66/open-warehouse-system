"use client";

import { ChangeEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

type UploadResult = {
  updated: number;
  skipped: number;
  results: Array<{ row: number; returnId: string; customerCode?: string; status: "updated" | "skipped"; message: string }>;
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function OpsReturnTrackingUploadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setResult(null);
    startTransition(async () => {
      const csv = await file.text();
      const response = await fetch("/api/ops/returns/tracking-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as UploadResult & { error?: string };
      if (!response.ok) {
        setMessage(payload.error || "导入失败");
        return;
      }
      setMessage(`已更新 ${payload.updated ?? 0} 条，跳过 ${payload.skipped ?? 0} 条`);
      setResult(payload);
      router.refresh();
    });
    event.target.value = "";
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        {isPending ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
        批量导入退货追踪号
        <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={upload} type="file" />
      </label>
      {result ? (
        <button
          className="inline-flex min-h-8 items-center justify-center rounded-md border border-cyan-200 bg-white px-2 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50"
          onClick={() =>
            downloadCsv("运营退货追踪号导入结果.csv", [
              ["行号", "客户编号", "退货单号", "状态", "处理结果"],
              ...result.results.map((item) => [item.row, item.customerCode ?? "", item.returnId, item.status === "updated" ? "已更新" : "已跳过", item.message]),
            ])
          }
          type="button"
        >
          下载结果
        </button>
      ) : null}
      {message ? <span className="text-[11px] font-semibold text-cyan-700">{message}</span> : null}
    </span>
  );
}
