"use client";

import { ChangeEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";

type UploadResult = {
  updated: number;
  skipped: number;
  results: Array<{ row: number; returnId: string; status: "updated" | "skipped"; message: string }>;
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

export function CustomerReturnTrackingBulkPanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    startTransition(async () => {
      const csv = await file.text();
      const response = await fetch("/api/returns/tracking-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as UploadResult & { error?: string };
      if (!response.ok) {
        setError(payload.error || "退货追踪号导入失败，请检查模板内容");
        return;
      }
      setResult(payload);
      router.refresh();
    });
    event.target.value = "";
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">批量补充退货追踪号</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">按模板上传 RMA 单号和买家退货追踪号，系统会批量更新您的退货预报。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/returns/tracking-upload">
            <Download size={14} />
            下载模板
          </a>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800">
            {isPending ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            上传 CSV
            <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={upload} type="file" />
          </label>
        </div>
      </div>
      {result ? (
        <div className="mt-3 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-950">
          <p className="font-semibold">已更新 {result.updated} 条，跳过 {result.skipped} 条。</p>
          {result.results.filter((item) => item.status === "skipped").length > 0 ? (
            <div className="mt-2 space-y-1 text-xs text-amber-900">
              {result.results
                .filter((item) => item.status === "skipped")
                .slice(0, 5)
                .map((item) => (
                  <p key={`${item.row}-${item.returnId}`}>第 {item.row} 行：{item.returnId || "未填写单号"}，{item.message}</p>
                ))}
            </div>
          ) : null}
          <button
            className="mt-3 inline-flex min-h-8 items-center rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
            onClick={() =>
              downloadCsv("退货追踪号导入结果.csv", [
                ["行号", "退货单号", "状态", "处理结果"],
                ...result.results.map((item) => [item.row, item.returnId, item.status === "updated" ? "已更新" : "已跳过", item.message]),
              ])
            }
            type="button"
          >
            下载导入结果
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}
