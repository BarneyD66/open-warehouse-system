import { calculateInboundMetrics } from "@/lib/inboundMetrics";
import { parseInboundSkuLines } from "@/lib/inboundInput";

export function InboundSkuMetricsPreview({ value }: { value: string }) {
  const parsed = parseInboundSkuLines(value);
  const metrics = calculateInboundMetrics(parsed.lines);
  const hasInput = value.trim().length > 0;
  const hasIssues = parsed.invalidLineNumbers.length > 0 || parsed.duplicateSkuCodes.length > 0;

  return (
    <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50/60 p-3" aria-live="polite">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-950">系统自动汇总</p>
        <p className="text-xs leading-5 text-slate-600">无需重复填写，保存时会按 SKU 明细重新计算。</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["SKU 种类", `${metrics.skuCount} 种`],
          ["商品总数量", `${metrics.totalProductQty} 件`],
          ["箱数 / 托数", `${metrics.cartons}`],
        ].map(([label, metric]) => (
          <div className="rounded-md border border-cyan-100 bg-white p-2.5" key={label}>
            <p className="text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">{label}</p>
            <p className="mt-1 text-base font-semibold text-slate-950 sm:text-lg">{metric}</p>
          </div>
        ))}
      </div>
      {hasInput && hasIssues ? (
        <div className="mt-3 space-y-1 text-xs font-semibold leading-5 text-rose-700" role="alert">
          {parsed.invalidLineNumbers.length ? <p>第 {parsed.invalidLineNumbers.join("、")} 行格式不完整。</p> : null}
          {parsed.duplicateSkuCodes.length ? <p>重复 SKU：{parsed.duplicateSkuCodes.join("、")}，请合并为一行。</p> : null}
        </div>
      ) : null}
    </div>
  );
}
