import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileWarning, PoundSterling } from "lucide-react";
import { PageShell } from "@/app/components/MarketingShell";
import { getOpsExpansionData, type CarrierBillImportRow } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ id: string }>;
};

function dateTimeLabel(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function money(value?: number) {
  return typeof value === "number" ? `£${value.toFixed(2)}` : "-";
}

function statusPill(row: CarrierBillImportRow) {
  if (row.status === "skipped") return <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">未匹配</span>;
  if (typeof row.diffAmount === "number" && Math.abs(row.diffAmount) >= 1) return <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">有差异</span>;
  return <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">已匹配</span>;
}

function metric(label: string, value: string | number, tone: "slate" | "emerald" | "amber" | "rose") {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "rose" ? "text-rose-700" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

export default async function OpsCarrierBillDetailPage({ params }: PageProps) {
  await requireStaffSession();
  const { id } = await params;
  const data = await getOpsExpansionData();
  const batch = data.carrierBillImportBatches.find((item) => item.id === id);
  if (!batch) notFound();

  const diffRows = batch.rows.filter((row) => typeof row.diffAmount === "number" && Math.abs(row.diffAmount) >= 1);
  const skippedRows = batch.rows.filter((row) => row.status === "skipped");

  return (
    <PageShell surface="admin">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800" href="/ops?section=logistics">
              <ArrowLeft size={16} />
              返回物流核对
            </Link>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-cyan-800">承运商账单核对批次</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{batch.id}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {batch.fileName} / {batch.carrierName} / {batch.createdBy} / {dateTimeLabel(batch.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/api/ops/mabang-modules?batchId=${encodeURIComponent(batch.id)}&report=carrier-bill-detail`}>
                  <Download size={16} />
                  导出核对明细
                </Link>
                {batch.diffRows > 0 ? <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">存在运费差异</span> : null}
                {batch.skippedRows > 0 ? <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">存在未匹配行</span> : null}
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {metric("总行数", batch.totalRows, "slate")}
            {metric("匹配行", batch.matchedRows, "emerald")}
            {metric("未匹配", batch.skippedRows, batch.skippedRows > 0 ? "rose" : "emerald")}
            {metric("差异行", batch.diffRows, batch.diffRows > 0 ? "amber" : "emerald")}
            {metric("账单总额", money(batch.totalBilledAmount), "slate")}
            {metric("差异合计", money(batch.totalDiffAmount), Math.abs(batch.totalDiffAmount) >= 1 ? "amber" : "emerald")}
          </section>

          {(diffRows.length > 0 || skippedRows.length > 0) ? (
            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <h2 className="flex items-center gap-2 font-semibold">
                  <PoundSterling size={17} />
                  运费差异
                </h2>
                <p className="mt-2 leading-6">差异达到 £1 的行会自动进入“账单争议”工单；差异达到 £5 会标记为紧急。</p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <h2 className="flex items-center gap-2 font-semibold">
                  <FileWarning size={17} />
                  未匹配行
                </h2>
                <p className="mt-2 leading-6">未匹配通常是追踪号不一致、出库单号缺失或承运商账单未带内部单号，需要运营人工复核。</p>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">行级核对结果</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[1080px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-3 py-3">行号</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">追踪号</th>
                    <th className="px-3 py-3">出库单</th>
                    <th className="px-3 py-3">客户编号</th>
                    <th className="px-3 py-3">承运商</th>
                    <th className="px-3 py-3">预估运费</th>
                    <th className="px-3 py-3">实际运费</th>
                    <th className="px-3 py-3">差异</th>
                    <th className="px-3 py-3">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {batch.rows.length > 0 ? (
                    batch.rows.map((row, index) => (
                      <tr key={`${row.row}-${row.trackingNumber}-${row.outboundId}-${index}`}>
                        <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.row}</td>
                        <td className="px-3 py-3">{statusPill(row)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">{row.trackingNumber || "-"}</td>
                        <td className="px-3 py-3 font-mono text-xs text-cyan-800">{row.outboundId || "-"}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">{row.customerCode || "-"}</td>
                        <td className="px-3 py-3 text-slate-700">{row.carrierName || "-"} {row.serviceName || ""}</td>
                        <td className="px-3 py-3">{money(row.expectedAmount)}</td>
                        <td className="px-3 py-3">{money(row.billedAmount)}</td>
                        <td className={`px-3 py-3 font-semibold ${typeof row.diffAmount === "number" && Math.abs(row.diffAmount) >= 1 ? "text-amber-700" : "text-slate-700"}`}>{money(row.diffAmount)}</td>
                        <td className="max-w-sm px-3 py-3 text-xs leading-5 text-slate-600">{row.issue || (typeof row.diffAmount === "number" && Math.abs(row.diffAmount) >= 1 ? "已生成账单争议工单" : "-")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-10 text-center text-sm text-slate-500" colSpan={10}>
                        暂无账单行。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
