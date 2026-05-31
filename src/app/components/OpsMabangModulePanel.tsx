"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BarChart3,
  Cable,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  PackageSearch,
  Play,
  PoundSterling,
  RadioTower,
  Save,
  ShieldCheck,
  Upload,
  Warehouse,
  XCircle,
} from "lucide-react";
import type { BatchOperationStatus, CustomerWorkOrderStatus, OpsExpansionData, OrderImportPreview } from "@/lib/opsExpansionStore";

type Props = {
  data: OpsExpansionData;
  module: "overview" | "inquiry" | "inbound" | "inventory" | "outbound" | "logistics" | "billing";
};

type ExportKind = "order-imports" | "platforms" | "batch-plans" | "wms-policies" | "logistics-channels" | "carrier-bills" | "billing-rules" | "work-orders" | "report-views" | "permissions";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

const inputClass = "h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const textareaClass = "min-h-24 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";

function ExportLink({ kind, children }: { kind: ExportKind; children: React.ReactNode }) {
  return (
    <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/api/ops/mabang-modules?export=${kind}`}>
      <Download size={15} />
      {children}
    </Link>
  );
}

function Panel({ title, icon, children, aside }: { title: string; icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          {icon}
          {title}
        </h2>
        {aside ? <div className="flex flex-wrap gap-2">{aside}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function statusPill(status: string) {
  const tone = status === "active" || status === "connected" || status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "exception" || status === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : status === "processing" || status === "sandbox" ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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

function orderPreviewReportRows(preview: OrderImportPreview) {
  const issueByRow = new Map(preview.issues.map((issue) => [issue.row, `${issue.level === "error" ? "错误" : "提醒"}：${issue.message}`]));
  return [
    ["行号", "订单号", "客户编号", "SKU 编码", "数量", "物流渠道", "状态", "异常/提醒"],
    ...preview.rows.map((row) => [row.row, row.orderNo, row.customerCode, row.skuCode, row.quantity, row.channel, row.status === "ready" ? "可导入" : "需处理", row.issue ?? issueByRow.get(row.row) ?? ""]),
    ...preview.issues
      .filter((issue) => !preview.rows.some((row) => row.row === issue.row))
      .map((issue) => [issue.row, "", "", "", "", "", issue.level === "error" ? "错误" : "提醒", issue.message]),
  ];
}

function formObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

export function OpsMabangModulePanel({ data, module }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importPreview, setImportPreview] = useState<OrderImportPreview | null>(null);
  const [platformCsv, setPlatformCsv] = useState("销售平台,平台订单号,客户编号,SKU 编码,数量,物流渠道,收件人,收件地址,要求发货日期,备注\nAmazon,ORDER-001,CUST-202605-0001,SKU-001,1,Royal Mail 48,张三,\"10 Example Street, London, UK\",2026-05-26,请按默认包材发货");

  function submit(body: Record<string, unknown>, success: string) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "保存失败，请检查填写内容。");
        return;
      }
      setMessage(success);
      router.refresh();
    });
  }

  function runOrderPreview() {
    setMessage("");
    setError("");
    setImportPreview(null);
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview_orders_csv", source: "csv", csv: platformCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { preview?: OrderImportPreview; error?: string };
      if (!response.ok || !payload.preview) {
        setError(payload.error || "订单预检失败，请检查 CSV 内容。");
        return;
      }
      setImportPreview(payload.preview);
      setMessage(`预检完成：可创建 ${payload.preview.readyOrders} 个出库单，${payload.preview.skippedRows} 行需要处理。`);
    });
  }

  function confirmOrderImport() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_orders_csv", source: "csv", fileName: "平台订单导入.csv", csv: platformCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { batch?: { createdOrders?: number; skippedRows?: number }; error?: string };
      if (!response.ok) {
        setError(payload.error || "订单导入失败，请根据预检异常修正后再试。");
        return;
      }
      setImportPreview(null);
      setMessage(`已创建 ${payload.batch?.createdOrders ?? 0} 个出库单，${payload.batch?.skippedRows ?? 0} 行未导入。`);
      router.refresh();
    });
  }

  function saveOrderDraft() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_order_import_draft", source: "csv", fileName: "平台订单预检草稿.csv", csv: platformCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { batch?: { id?: string }; error?: string };
      if (!response.ok) {
        setError(payload.error || "保存预检草稿失败，请稍后再试。");
        return;
      }
      setMessage(`预检草稿已保存${payload.batch?.id ? `：${payload.batch.id}` : "。"}，可在最近导入批次中继续追踪。`);
      router.refresh();
    });
  }

  function uploadCarrierBill(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const csv = await file.text();
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_carrier_bill_csv", fileName: file.name, csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        batch?: { matchedRows?: number; skippedRows?: number; diffRows?: number; totalDiffAmount?: number };
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error || "承运商账单导入失败，请检查模板格式。");
        return;
      }
      setMessage(`账单已核对：匹配 ${payload.batch?.matchedRows ?? 0} 行，跳过 ${payload.batch?.skippedRows ?? 0} 行，差异 ${payload.batch?.diffRows ?? 0} 行，差异合计 £${(payload.batch?.totalDiffAmount ?? 0).toFixed(2)}。`);
      router.refresh();
    });
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>, success: string, extra?: Record<string, unknown>) {
    event.preventDefault();
    submit({ ...formObject(event.currentTarget), ...extra }, success);
  }

  function updateBatch(id: string, status: BatchOperationStatus) {
    submit({ action: "update_batch_status", id, status }, `批量任务已更新为 ${status}。`);
  }

  function updateWorkOrder(id: string, status: CustomerWorkOrderStatus) {
    submit({ action: "update_work_order", id, status }, `工单已更新为 ${status}。`);
  }

  const feedback = (
    <>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </>
  );

  if (module === "outbound") {
    return (
      <div className="grid gap-4">
        <Panel
          icon={<FileSpreadsheet size={18} className="text-cyan-700" />}
          title="平台订单导入和字段映射"
          aside={
            <>
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=orders">
                <Upload size={15} />
                下载导入模板
              </Link>
              <ExportLink kind="order-imports">导出导入记录</ExportLink>
              <ExportLink kind="platforms">导出平台配置</ExportLink>
            </>
          }
        >
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="grid gap-4">
              <form className="grid gap-3" onSubmit={(event) => submitForm(event, "平台字段映射已保存。")}>
                <input name="action" type="hidden" value="upsert_platform" />
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="平台">
                    <select className={inputClass} name="platform" defaultValue="amazon">
                      <option value="amazon">Amazon</option>
                      <option value="tiktok_shop">TikTok Shop</option>
                      <option value="shopify">Shopify</option>
                      <option value="ebay">eBay</option>
                      <option value="csv">CSV</option>
                    </select>
                  </Field>
                  <Field label="店铺名称">
                    <input className={inputClass} name="storeName" placeholder="客户店铺名称" required />
                  </Field>
                  <Field label="客户编号">
                    <input className={inputClass} name="customerCode" placeholder="客户编号" required />
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="同步方式">
                    <select className={inputClass} name="syncMode" defaultValue="manual_csv">
                      <option value="manual_csv">CSV 手工导入</option>
                      <option value="api_sandbox">API 沙箱</option>
                      <option value="api_live">API 正式</option>
                    </select>
                  </Field>
                  <Field label="状态">
                    <select className={inputClass} name="status" defaultValue="connected">
                      <option value="draft">草稿</option>
                      <option value="connected">已连接</option>
                      <option value="paused">暂停</option>
                      <option value="error">异常</option>
                    </select>
                  </Field>
                </div>
                <Field label="字段映射">
                  <textarea className={textareaClass} name="mappingText" defaultValue={"orderNo:订单号\nskuCode:SKU\nquantity:数量\nrecipientName:收件人\ndeliveryAddress:地址"} />
                </Field>
                <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
                  <Cable size={15} />
                  保存平台映射
                </button>
              </form>

              <div>
                <Field label="订单 CSV">
                  <textarea
                    className={`${textareaClass} font-mono text-xs`}
                    onChange={(event) => {
                      setPlatformCsv(event.target.value);
                      setImportPreview(null);
                    }}
                    value={platformCsv}
                  />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={isPending} onClick={runOrderPreview} type="button">
                    <FileSpreadsheet size={15} />
                    先预检异常
                  </button>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-white px-4 text-sm font-semibold text-cyan-800 disabled:opacity-60" disabled={isPending || !importPreview} onClick={() => importPreview && downloadCsv("平台订单异常报告.csv", orderPreviewReportRows(importPreview))} type="button">
                    <Download size={15} />
                    下载异常报告
                  </button>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={isPending || !importPreview} onClick={saveOrderDraft} type="button">
                    <Save size={15} />
                    保存预检草稿
                  </button>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending || !importPreview || importPreview.readyOrders === 0} onClick={confirmOrderImport} type="button">
                    <Upload size={15} />
                    确认创建出库单
                  </button>
                </div>
              </div>
              {importPreview ? (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">总行数 {importPreview.totalRows}</span>
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">可创建 {importPreview.readyOrders} 单</span>
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">可导入行 {importPreview.readyRows}</span>
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">异常行 {importPreview.skippedRows}</span>
                  </div>
                  {importPreview.rows.length > 0 ? (
                    <div className="mt-3 max-h-40 overflow-auto rounded-md border border-cyan-100 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-2 py-2">行号</th>
                            <th className="px-2 py-2">订单号</th>
                            <th className="px-2 py-2">客户</th>
                            <th className="px-2 py-2">SKU</th>
                            <th className="px-2 py-2">数量</th>
                            <th className="px-2 py-2">状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.rows.slice(0, 10).map((row, index) => (
                            <tr className="border-t border-slate-100" key={`${row.row}-${row.orderNo}-${row.skuCode}-${index}`}>
                              <td className="px-2 py-2">{row.row}</td>
                              <td className="px-2 py-2">{row.orderNo || "-"}</td>
                              <td className="px-2 py-2">{row.customerCode || "-"}</td>
                              <td className="px-2 py-2">{row.skuCode || "-"}</td>
                              <td className="px-2 py-2">{row.quantity || "-"}</td>
                              <td className="px-2 py-2">{row.status === "ready" ? "可导入" : "需处理"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {importPreview.issues.length > 0 ? (
                    <div className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      {importPreview.issues.slice(0, 5).map((issue) => (
                        <p key={`${issue.row}-${issue.message}`}>
                          第 {issue.row} 行 / {issue.level === "error" ? "错误" : "提醒"}：{issue.message}
                        </p>
                      ))}
                      {importPreview.issues.length > 5 ? <p>还有 {importPreview.issues.length - 5} 条异常或提醒，请导出导入记录后继续复核。</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {feedback}
            </div>
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-slate-950">最近导入批次</h3>
              {data.orderImportBatches.length === 0 ? <Empty text="暂无导入批次。先下载模板，填入真实客户编号和 SKU 后导入。" /> : data.orderImportBatches.slice(0, 5).map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <Link className="font-semibold text-cyan-800 hover:text-cyan-950" href={`/ops/imports/${item.id}`}>
                      {item.id}
                    </Link>
                    {statusPill(item.status === "draft" ? "draft" : item.skippedRows > 0 ? "exception" : "completed")}
                  </div>
                  <p className="mt-2 text-slate-600">
                    {item.status === "draft" ? "预检草稿" : "已创建"} / 总行数 {item.totalRows} / 可创建 {item.readyOrders ?? item.createdOrders} / 异常 {item.skippedRows}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.source} / {item.createdBy}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/ops/imports/${item.id}`}>
                      查看详情
                    </Link>
                    <Link className="inline-flex min-h-8 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50" href={`/api/ops/mabang-modules?batchId=${encodeURIComponent(item.id)}&report=issues`}>
                      下载报告
                    </Link>
                  </div>
                  {item.issues.length > 0 ? (
                    <div className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      {item.issues.slice(0, 3).map((issue) => (
                        <p key={`${item.id}-${issue.row}-${issue.message}`}>
                          第 {issue.row} 行 / {issue.level === "error" ? "错误" : "提醒"}：{issue.message}
                        </p>
                      ))}
                      {item.issues.length > 3 ? <p>还有 {item.issues.length - 3} 条异常，可导出导入记录继续复核。</p> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (module === "inbound" || module === "inventory") {
    return (
      <div className="grid gap-4">
        <Panel icon={<ClipboardList size={18} className="text-cyan-700" />} title="批量作业中心" aside={<ExportLink kind="batch-plans">导出批量任务</ExportLink>}>
          <form className="grid gap-3" onSubmit={(event) => submitForm(event, "批量作业任务已进入队列。")}>
            <input name="action" type="hidden" value="create_batch_plan" />
            <input name="targetModule" type="hidden" value={module} />
            <div className="grid gap-3 md:grid-cols-[1fr_190px_150px]">
              <Field label="任务名称">
                <input className={inputClass} name="title" defaultValue={module === "inventory" ? "批量改库位 / 移库" : "批量入库资料导入"} required />
              </Field>
              <Field label="任务类型">
                <select className={inputClass} name="kind" defaultValue={module === "inventory" ? "location_move" : "inbound_import"}>
                  <option value="sku_import">批量导入 SKU</option>
                  <option value="inbound_import">批量入库</option>
                  <option value="location_move">批量改库位</option>
                  <option value="picking_wave">批量生成拣货波次</option>
                  <option value="weighing">批量称重</option>
                  <option value="tracking_upload">批量上传追踪号</option>
                  <option value="export">批量导出</option>
                </select>
              </Field>
              <Field label="记录数">
                <input className={inputClass} name="recordCount" min="0" type="number" defaultValue={0} />
              </Field>
            </div>
            <Field label="备注">
              <input className={inputClass} name="note" placeholder="例如：按模板导入后进入运营复核队列" />
            </Field>
            <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              <Save size={15} />
              创建批量任务
            </button>
          </form>
          <div className="mt-4 grid gap-2">
            {data.batchOperationPlans.length === 0 ? <Empty text="暂无批量任务。可以先创建导入、改库位、拣货波次或追踪号上传任务。" /> : data.batchOperationPlans.slice(0, 6).map((item) => (
              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:flex-row lg:items-center lg:justify-between" key={item.id}>
                <div>
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-slate-600">{item.kind} / {item.targetModule} / {item.recordCount} 条</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {statusPill(item.status)}
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700" onClick={() => updateBatch(item.id, "processing")} type="button"><Play size={13} />开始</button>
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700" onClick={() => updateBatch(item.id, "completed")} type="button"><CheckCircle2 size={13} />完成</button>
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-700" onClick={() => updateBatch(item.id, "exception")} type="button"><XCircle size={13} />异常</button>
                </div>
              </div>
            ))}
          </div>
          {feedback}
        </Panel>

        <Panel icon={<Warehouse size={18} className="text-cyan-700" />} title="WMS 库区、库位与库存控制策略" aside={<ExportLink kind="wms-policies">导出 WMS 策略</ExportLink>}>
          <form className="grid gap-3" onSubmit={(event) => submitForm(event, "WMS 控制策略已保存。")}>
            <input name="action" type="hidden" value="upsert_wms_policy" />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="仓库编码">
                <input className={inputClass} name="warehouseCode" defaultValue="SHEFFIELD-MAIN" required />
              </Field>
              <Field label="策略名称">
                <input className={inputClass} name="name" defaultValue="库位容量与先进先出策略" required />
              </Field>
            </div>
            <Field label="库位层级">
              <input className={inputClass} name="zonePath" defaultValue="仓库 > 库区 > 货架 > 层 > 库位" />
            </Field>
            <Field label="容量规则">
              <input className={inputClass} name="capacityRule" defaultValue="按库位 CBM、SKU 件数、冻结状态和残次品状态校验。" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="库存控制">
                <textarea className={textareaClass} name="stockControls" defaultValue={"冻结库存\n残次品库存\n移库\n盘盈盘亏审批"} />
              </Field>
              <Field label="批次控制">
                <textarea className={textareaClass} name="batchControls" defaultValue={"先进先出\n批次号\n效期管理\n序列号管理"} />
              </Field>
            </div>
            <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              <PackageSearch size={15} />
              保存 WMS 策略
            </button>
          </form>
        </Panel>
      </div>
    );
  }

  if (module === "logistics") {
    return (
      <div className="grid gap-4">
        <Panel icon={<RadioTower size={18} className="text-cyan-700" />} title="真实物流渠道闭环配置" aside={<ExportLink kind="logistics-channels">导出物流渠道</ExportLink>}>
          <form className="grid gap-3" onSubmit={(event) => submitForm(event, "物流渠道配置已保存。")}>
            <input name="action" type="hidden" value="upsert_logistics_channel" />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="承运商">
                <input className={inputClass} name="carrierName" placeholder="Royal Mail / Evri / DPD" required />
              </Field>
              <Field label="服务">
                <input className={inputClass} name="serviceName" placeholder="Tracked 24/48" required />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="API 模式">
                <select className={inputClass} name="apiMode" defaultValue="sandbox">
                  <option value="manual">手工</option>
                  <option value="sandbox">沙箱</option>
                  <option value="live">正式</option>
                </select>
              </Field>
              <Field label="状态">
                <select className={inputClass} name="status" defaultValue="sandbox">
                  <option value="draft">草稿</option>
                  <option value="sandbox">沙箱</option>
                  <option value="active">启用</option>
                  <option value="paused">暂停</option>
                </select>
              </Field>
              <Field label="轨迹回传地址">
                <input className={inputClass} name="trackingWebhook" placeholder="/api/webhooks/carriers/provider" />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="能力">
                <textarea className={textareaClass} name="enabledFeatures" defaultValue={"面单购买\n轨迹自动回传\n派送失败处理\n签收证明\n物流赔付"} />
              </Field>
              <Field label="附加费规则">
                <textarea className={textareaClass} name="surchargeRules" defaultValue={"偏远附加费\n燃油费\n超尺寸费\n渠道黑名单"} />
              </Field>
            </div>
            <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              <Save size={15} />
              保存物流渠道
            </button>
          </form>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.logisticsChannels.length === 0 ? <Empty text="暂无物流渠道。先配置承运商、API 模式和附加费规则。" /> : data.logisticsChannels.map((item) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{item.carrierName} / {item.serviceName}</p>
                  {statusPill(item.status)}
                </div>
                <p className="mt-2 text-slate-600">{item.apiMode} / {item.enabledFeatures.join("、") || "未配置能力"}</p>
              </div>
            ))}
          </div>
          {feedback}
        </Panel>

        <Panel
          icon={<PoundSterling size={18} className="text-cyan-700" />}
          title="承运商账单导入与运费差异核对"
          aside={
            <>
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=carrier-bill">
                <Download size={15} />
                下载账单模板
              </Link>
              <ExportLink kind="carrier-bills">导出核对批次</ExportLink>
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-slate-600">上传承运商账单后，系统会按追踪号或出库单号匹配出库单，把实际运费写回订单，并统计与预估运费的差异。</p>
              <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                <Upload size={15} />
                上传承运商账单 CSV
                <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={uploadCarrierBill} type="file" />
              </label>
              <div className="mt-4 rounded-md border border-cyan-100 bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">匹配规则</p>
                <p>优先按追踪号匹配；没有追踪号时按出库单号匹配。差异绝对值达到 £1 会计入差异行。</p>
              </div>
            </div>
            <div className="grid gap-2">
              {data.carrierBillImportBatches.length === 0 ? (
                <Empty text="暂无承运商账单核对批次。导入真实账单后可在这里追踪匹配、跳过和差异情况。" />
              ) : (
                data.carrierBillImportBatches.slice(0, 6).map((item) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                      {statusPill(item.diffRows > 0 || item.skippedRows > 0 ? "exception" : "completed")}
                    </div>
                    <p className="mt-2 font-semibold text-slate-950">{item.fileName}</p>
                    <p className="mt-1 text-slate-600">
                      匹配 {item.matchedRows}/{item.totalRows} 行 / 跳过 {item.skippedRows} 行 / 差异 {item.diffRows} 行
                    </p>
                    <p className="mt-1 text-xs text-slate-500">账单 £{item.totalBilledAmount.toFixed(2)} / 差异 £{item.totalDiffAmount.toFixed(2)} / {item.createdBy}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          {feedback}
        </Panel>
      </div>
    );
  }

  if (module === "billing") {
    return (
      <Panel icon={<PoundSterling size={18} className="text-cyan-700" />} title="费用规则、月结与付款核销配置" aside={<ExportLink kind="billing-rules">导出费用规则</ExportLink>}>
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "费用规则已保存，后续生成账单可复用。")}>
          <input name="action" type="hidden" value="upsert_billing_rule" />
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="费用名称">
              <input className={inputClass} name="feeName" placeholder="仓租 / 操作费 / 偏远附加费" required />
            </Field>
            <Field label="费用类型">
              <select className={inputClass} name="feeType" defaultValue="operation">
                <option value="storage">仓租</option>
                <option value="operation">操作费</option>
                <option value="labeling">贴标/换箱</option>
                <option value="return">退货质检</option>
                <option value="oversize">超尺寸</option>
                <option value="remote_area">偏远</option>
                <option value="fuel">燃油</option>
                <option value="manual">人工服务</option>
              </select>
            </Field>
            <Field label="单位">
              <input className={inputClass} name="unitLabel" placeholder="单 / 箱 / 件 / 月" required />
            </Field>
            <Field label="单价">
              <input className={inputClass} name="unitPrice" type="number" step="0.01" min="0" defaultValue="0" />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="结算周期">
              <select className={inputClass} name="settlementCycle" defaultValue="monthly">
                <option value="realtime">实时</option>
                <option value="weekly">周结</option>
                <option value="monthly">月结</option>
              </select>
            </Field>
            <Field label="客户范围">
              <select className={inputClass} name="customerScope" defaultValue="verified">
                <option value="all">全部客户</option>
                <option value="verified">认证客户</option>
                <option value="custom">指定客户</option>
              </select>
            </Field>
          </div>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <Save size={15} />
            保存费用规则
          </button>
        </form>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {data.billingRules.length === 0 ? <Empty text="暂无费用规则。上线前至少配置仓租、出库操作、贴标、退货质检和物流附加费。" /> : data.billingRules.map((item) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-950">{item.feeName}</p>
                {statusPill(item.status)}
              </div>
              <p className="mt-2 text-slate-600">£{item.unitPrice} / {item.unitLabel} / {item.settlementCycle}</p>
            </div>
          ))}
        </div>
        {feedback}
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="xl:col-span-3">
        <Panel icon={<Cable size={18} className="text-cyan-700" />} title="客户自助工单处理队列" aside={<ExportLink kind="work-orders">导出工单</ExportLink>}>
          <div className="grid gap-3">
            {data.selfServiceWorkOrders.length === 0 ? (
              <Empty text="暂无客户自助工单。客户可在工作台提交物流异常、库存调整、账单争议、退货售后或资料补充。" />
            ) : (
              data.selfServiceWorkOrders.slice(0, 8).map((item) => (
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={item.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                      {statusPill(item.status)}
                      {item.priority === "urgent" ? <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">紧急</span> : null}
                    </div>
                    <h3 className="mt-2 font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-slate-600">{item.customerCode} / {item.category}{item.referenceNo ? ` / ${item.referenceNo}` : ""}</p>
                    <p className="mt-2 line-clamp-2 text-slate-600">{item.description}</p>
                    {item.customerContact ? <p className="mt-1 text-xs text-slate-500">联系方式：{item.customerContact}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800" onClick={() => updateWorkOrder(item.id, "processing")} type="button">
                      <Play size={13} />
                      接单
                    </button>
                    <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-violet-200 bg-white px-2 text-xs font-semibold text-violet-800" onClick={() => updateWorkOrder(item.id, "waiting_customer")} type="button">
                      <Upload size={13} />
                      待补充
                    </button>
                    <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-800" onClick={() => updateWorkOrder(item.id, "resolved")} type="button">
                      <CheckCircle2 size={13} />
                      关闭
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {feedback}
        </Panel>
      </div>

      <Panel icon={<BarChart3 size={18} className="text-cyan-700" />} title="高级筛选、保存视图与运营报表" aside={<ExportLink kind="report-views">导出视图</ExportLink>}>
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "报表视图已保存。")}>
          <input name="action" type="hidden" value="save_report_view" />
          <Field label="视图名称">
            <input className={inputClass} name="name" defaultValue="仓库效率与异常率看板" required />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="报表模块">
              <select className={inputClass} name="module" defaultValue="warehouse">
                <option value="orders">订单</option>
                <option value="warehouse">仓库效率</option>
                <option value="logistics">物流</option>
                <option value="billing">账单</option>
                <option value="profit">利润/成本</option>
                <option value="sla">SLA</option>
              </select>
            </Field>
            <Field label="所属角色">
              <input className={inputClass} name="ownerRole" defaultValue="ops" />
            </Field>
          </div>
          <Field label="筛选条件">
            <textarea className={textareaClass} name="filters" defaultValue={"warehouse=SHEFFIELD-MAIN\nstatus=not_closed\nrange=last_30_days"} />
          </Field>
          <Field label="指标">
            <textarea className={textareaClass} name="metrics" defaultValue={"入库 SLA\n出库 SLA\n异常率\n仓库效率\n利润/成本"} />
          </Field>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <Save size={15} />
            保存视图
          </button>
        </form>
        {feedback}
      </Panel>

      <Panel icon={<LockKeyhole size={18} className="text-cyan-700" />} title="权限矩阵与敏感操作审计" aside={<ExportLink kind="permissions">导出权限</ExportLink>}>
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "角色权限已保存。", { requireSecondConfirm: new FormData(event.currentTarget).get("requireSecondConfirm") === "on" })}>
          <input name="action" type="hidden" value="upsert_role_permissions" />
          <Field label="角色">
            <select className={inputClass} name="role" defaultValue="ops">
              <option value="admin">Admin</option>
              <option value="ops">运营</option>
              <option value="warehouse">仓库</option>
              <option value="finance">财务</option>
            </select>
          </Field>
          <Field label="可访问模块">
            <textarea className={textareaClass} name="allowedModules" defaultValue={"询盘\n入库\n库存\n出库\n物流\n账单"} />
          </Field>
          <Field label="敏感操作">
            <textarea className={textareaClass} name="sensitiveActions" defaultValue={"账单锁定\n库存调整审批\n客户暂停/解封"} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input className="h-4 w-4 rounded border-slate-300" defaultChecked name="requireSecondConfirm" type="checkbox" />
            敏感操作需要二次确认
          </label>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <ShieldCheck size={15} />
            保存权限
          </button>
        </form>
      </Panel>

      <Panel icon={<Cable size={18} className="text-cyan-700" />} title="客户自助下载、模板与工单">
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "客户自助配置已保存。")}>
          <input name="action" type="hidden" value="update_self_service" />
          <Field label="可下载内容">
            <textarea className={textareaClass} name="enabledDownloads" defaultValue={data.selfService.enabledDownloads.join("\n")} />
          </Field>
          <Field label="工单类型">
            <textarea className={textareaClass} name="workOrderCategories" defaultValue={data.selfService.workOrderCategories.join("\n")} />
          </Field>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <Save size={15} />
            保存自助配置
          </button>
        </form>
      </Panel>
    </div>
  );
}
