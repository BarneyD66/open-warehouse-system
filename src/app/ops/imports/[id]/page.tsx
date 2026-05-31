import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, ListFilter } from "lucide-react";
import { ConfirmOrderImportDraftButton } from "@/app/components/ConfirmOrderImportDraftButton";
import { PageShell } from "@/app/components/MarketingShell";
import { getOrderImportBatchById, type ImportedOrderIssue, type ImportedOrderRow, type OrderImportBatch } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; level?: string }>;
};

const sourceLabels: Record<string, string> = {
  amazon: "Amazon",
  tiktok_shop: "TikTok Shop",
  shopify: "Shopify",
  ebay: "eBay",
  csv: "CSV 导入",
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

function batchStatusLabel(batch: OrderImportBatch) {
  if (batch.status === "draft") return "预检草稿";
  if (batch.skippedRows > 0 || batch.issues.some((issue) => issue.level === "error")) return "已创建，有异常";
  return "已创建";
}

function rowStatusLabel(status: ImportedOrderRow["status"]) {
  if (status === "ready") return "可导入";
  if (status === "created") return "已创建";
  return "需处理";
}

function pillClass(tone: "slate" | "cyan" | "emerald" | "amber" | "rose") {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return `inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classes[tone]}`;
}

function rowTone(status: ImportedOrderRow["status"], issues: ImportedOrderIssue[]) {
  if (issues.some((issue) => issue.level === "error") || status === "skipped") return "rose";
  if (issues.length > 0) return "amber";
  if (status === "created") return "emerald";
  if (status === "ready") return "cyan";
  return "slate";
}

function issuesForRow(batch: OrderImportBatch) {
  const issueMap = new Map<number, ImportedOrderIssue[]>();
  batch.issues.forEach((issue) => {
    const current = issueMap.get(issue.row) ?? [];
    current.push(issue);
    issueMap.set(issue.row, current);
  });
  return issueMap;
}

function filteredRows(batch: OrderImportBatch, status: string, level: string) {
  const issueMap = issuesForRow(batch);
  return batch.rows.filter((row) => {
    const rowIssues = issueMap.get(row.row) ?? [];
    const statusMatched = status === "all" || row.status === status || (status === "problem" && (row.status === "skipped" || rowIssues.length > 0));
    const levelMatched = level === "all" || rowIssues.some((issue) => issue.level === level);
    return statusMatched && levelMatched;
  });
}

function metric(label: string, value: string | number, tone: "slate" | "cyan" | "emerald" | "amber" | "rose") {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : tone === "emerald" ? "text-emerald-700" : tone === "cyan" ? "text-cyan-800" : "text-slate-950"}`}>
        {value}
      </p>
    </div>
  );
}

export default async function OpsOrderImportDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams, requireStaffSession()]);
  const batch = await getOrderImportBatchById(id);
  if (!batch) notFound();

  const status = query.status ?? "all";
  const level = query.level ?? "all";
  const rows = filteredRows(batch, status, level);
  const issueMap = issuesForRow(batch);
  const errorCount = batch.issues.filter((issue) => issue.level === "error").length;
  const warningCount = batch.issues.filter((issue) => issue.level === "warning").length;
  const createdCount = batch.rows.filter((row) => row.status === "created").length;
  const readyCount = batch.rows.filter((row) => row.status === "ready").length;
  const filters = [
    ["全部", "all", "all"],
    ["只看异常", "problem", "all"],
    ["错误行", "problem", "error"],
    ["提醒行", "problem", "warning"],
    ["可导入", "ready", "all"],
    ["已创建", "created", "all"],
  ] as const;

  return (
    <PageShell surface="admin">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Link className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800" href="/ops?section=outbound">
                  <ArrowLeft size={16} />
                  返回出库作业
                </Link>
                <p className="text-sm font-semibold text-cyan-800">订单导入批次复核</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{batch.id}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {sourceLabels[batch.source] ?? batch.source} / {batch.fileName} / {batch.createdBy} / {dateTimeLabel(batch.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={pillClass(batch.status === "draft" ? "amber" : errorCount > 0 ? "rose" : "emerald")}>{batchStatusLabel(batch)}</span>
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/api/ops/mabang-modules?batchId=${encodeURIComponent(batch.id)}&report=issues`}>
                  <Download size={16} />
                  下载异常报告
                </Link>
                {batch.status === "draft" ? <ConfirmOrderImportDraftButton batchId={batch.id} disabled={readyCount <= 0} /> : null}
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800" href="/ops?section=outbound">
                  <FileSpreadsheet size={16} />
                  重新上传修正版
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {metric("总行数", batch.totalRows, "slate")}
            {metric("可导入行", batch.readyRows ?? readyCount, "cyan")}
            {metric("可创建订单", batch.readyOrders ?? batch.createdOrders, "cyan")}
            {metric("已创建", batch.createdOrders || createdCount, "emerald")}
            {metric("错误", errorCount, errorCount > 0 ? "rose" : "emerald")}
            {metric("提醒", warningCount, warningCount > 0 ? "amber" : "emerald")}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <ListFilter size={18} className="text-cyan-700" />
                行级复核
              </h2>
              <div className="flex flex-wrap gap-2">
                {filters.map(([label, nextStatus, nextLevel]) => (
                  <Link
                    className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold ${
                      status === nextStatus && level === nextLevel ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    href={`/ops/imports/${batch.id}?status=${nextStatus}&level=${nextLevel}`}
                    key={label}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-3 py-3">行号</th>
                    <th className="px-3 py-3">订单号</th>
                    <th className="px-3 py-3">客户编号</th>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">数量</th>
                    <th className="px-3 py-3">物流渠道</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">异常/提醒</th>
                    <th className="px-3 py-3">出库单</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.length > 0 ? (
                    rows.map((row, index) => {
                      const rowIssues = issueMap.get(row.row) ?? [];
                      return (
                        <tr key={`${row.row}-${row.orderNo}-${row.skuCode}-${index}`}>
                          <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.row}</td>
                          <td className="px-3 py-3 font-semibold text-slate-950">{row.orderNo || "-"}</td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-600">{row.customerCode || "-"}</td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-800">{row.skuCode || "-"}</td>
                          <td className="px-3 py-3">{row.quantity || "-"}</td>
                          <td className="px-3 py-3">{row.channel || "-"}</td>
                          <td className="px-3 py-3">
                            <span className={pillClass(rowTone(row.status, rowIssues))}>{rowStatusLabel(row.status)}</span>
                          </td>
                          <td className="max-w-sm px-3 py-3">
                            {rowIssues.length > 0 || row.issue ? (
                              <div className="space-y-1 text-xs leading-5 text-slate-700">
                                {row.issue ? <p>{row.issue}</p> : null}
                                {rowIssues.map((issue) => (
                                  <p className={issue.level === "error" ? "text-rose-700" : "text-amber-700"} key={`${row.row}-${issue.message}`}>
                                    {issue.level === "error" ? "错误" : "提醒"}：{issue.message}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-600">{row.outboundId || "-"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-3 py-10 text-center text-sm text-slate-500" colSpan={9}>
                        当前筛选下暂无记录。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {batch.issues.some((issue) => !batch.rows.some((row) => row.row === issue.row)) ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">未匹配到具体行的异常</p>
                <div className="mt-2 grid gap-1 text-xs leading-5">
                  {batch.issues
                    .filter((issue) => !batch.rows.some((row) => row.row === issue.row))
                    .map((issue) => (
                      <p key={`${issue.row}-${issue.message}`}>
                        第 {issue.row} 行 / {issue.level === "error" ? "错误" : "提醒"}：{issue.message}
                      </p>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <p>复核建议：先处理错误行，再处理提醒行；修正模板后返回出库作业重新上传预检。草稿不会创建出库单，确认导入后才会生成出库申请。</p>
              <p className="mt-1">确认导入时间：{dateTimeLabel(batch.confirmedAt)}</p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
