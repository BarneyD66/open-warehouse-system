"use client";

import { SubmissionForm, SubmissionButton, submissionFetch, submissionTransition, SubmissionFileInput } from "./SubmissionFeedback";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, ImagePlus, PackagePlus, Send, Tags, Upload } from "lucide-react";
import { compressSkuImage, skuImageInputMaxBytes } from "./skuImageClient";

type SkuFormState = {
  skuCode: string;
  productName: string;
  barcode: string;
  category: string;
  imageUrl: string;
  alertQty: string;
};

type OutboundFormState = {
  channel: string;
  orderCount: string;
  skuLines: string;
  recipientName: string;
  deliveryAddress: string;
  requestedShipDate: string;
  note: string;
};

type ReturnFormState = {
  platform: string;
  originalOrderNo: string;
  buyerReturnTracking: string;
  expectedArrivalDate: string;
  skuLines: string;
  returnReason: string;
  customerNote: string;
};

type OutboundImportPreview = {
  totalRows: number;
  readyRows: number;
  readyOrders: number;
  skippedRows: number;
  errors: string[];
  warnings: string[];
  rows: Array<{ row: number; orderNo: string; skuCode: string; quantity: number; channel: string; status: "ready" | "skipped"; issue?: string }>;
};

const skuInitialState: SkuFormState = {
  skuCode: "",
  productName: "",
  barcode: "",
  category: "",
  imageUrl: "",
  alertQty: "0",
};

const outboundInitialState: OutboundFormState = {
  channel: "Royal Mail 48",
  orderCount: "1",
  skuLines: "",
  recipientName: "",
  deliveryAddress: "",
  requestedShipDate: "",
  note: "",
};

const returnInitialState: ReturnFormState = {
  platform: "",
  originalOrderNo: "",
  buyerReturnTracking: "",
  expectedArrivalDate: "",
  skuLines: "",
  returnReason: "",
  customerNote: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

const inputClass = "min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-500";
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

function previewImageStyle(imageUrl: string) {
  const safeUrl = imageUrl.trim().replace(/["\\\n\r]/g, "");
  return safeUrl ? { backgroundImage: `url("${safeUrl}")` } : undefined;
}

function outboundPreviewReportRows(preview: OutboundImportPreview) {
  const issueText = [...preview.errors, ...preview.warnings].join("\n");
  return [
    ["行号", "订单号", "SKU 编码", "数量", "物流渠道", "状态", "异常/提醒"],
    ...preview.rows.map((row) => [row.row, row.orderNo, row.skuCode, row.quantity, row.channel, row.status === "ready" ? "可导入" : "需处理", row.issue ?? ""]),
    ["汇总", "", "", "", "", `可创建 ${preview.readyOrders} 单，异常 ${preview.skippedRows} 行`, issueText],
  ];
}

export function CustomerSkuForm() {
  const router = useRouter();
  const [form, setForm] = useState(skuInitialState);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(key: keyof SkuFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage("");
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("请上传 JPG、PNG 或 WebP 格式的商品图片。");
      return;
    }
    if (file.size > skuImageInputMaxBytes) {
      setError("请选择 10MB 以内的商品图片。");
      return;
    }

    setImageProcessing(true);
    try {
      const compressed = await compressSkuImage(file);
      update("imageUrl", compressed.dataUrl);
      setMessage(`图片已自动处理完成（${Math.max(1, Math.round(compressed.size / 1024))}KB），可以直接创建 SKU。`);
    } catch {
      setError("图片处理失败，请更换一张图片后重试。");
    } finally {
      setImageProcessing(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();
    setMessage("");
    setError("");
    return await submissionTransition(startTransition, async () => {
      const response=await submissionFetch("/api/skus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload=(await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error||"SKU 建档失败，请稍后重试。");
        return false;
      }
      setForm(skuInitialState);
      setMessage("SKU 已创建，并已初始化库存底表。");
      router.refresh();

      return true;
    });

    return true;

  }

  return (
    <SubmissionForm className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
      <div className="flex items-center gap-2">
        <Tags size={18} className="text-[#0E7490]" />
        <h2 className="text-base font-semibold text-slate-950">新增 SKU</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="SKU 编码">
          <input className={inputClass} onChange={(event) => update("skuCode", event.target.value)} placeholder="YOUR-SKU-001" required value={form.skuCode} />
        </Field>
        <Field label="商品名称">
          <input className={inputClass} onChange={(event) => update("productName", event.target.value)} placeholder="商品中文名 / 英文名" required value={form.productName} />
        </Field>
        <Field label="条码">
          <input className={inputClass} onChange={(event) => update("barcode", event.target.value)} placeholder="EAN / UPC，可选" value={form.barcode} />
        </Field>
        <Field label="分类">
          <input className={inputClass} onChange={(event) => update("category", event.target.value)} placeholder="服饰 / 家居 / 小件商品" value={form.category} />
        </Field>
        <div className="md:col-span-2">
          <Field label="商品图片">
            <div className="grid gap-3 sm:grid-cols-[1fr_112px]">
              <div className="grid gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white ${imageProcessing ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-800"}`}>
                    <ImagePlus size={16} />
                    {imageProcessing ? "正在处理..." : "上传商品图"}
                    <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={imageProcessing} onChange={uploadImage} type="file" />
                  </label>
                  <button
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={imageProcessing || !form.imageUrl.trim()}
                    onClick={() => {
                      update("imageUrl", "");
                      setMessage("");
                    }}
                    type="button"
                  >
                    清除图片
                  </button>
                </div>
                <input className={inputClass} onChange={(event) => update("imageUrl", event.target.value)} placeholder="也可以粘贴商品主图链接" type="text" value={form.imageUrl.startsWith("data:image/") ? "已上传本地图片，可在右侧预览" : form.imageUrl} />
                <span className="text-xs font-normal leading-5 text-slate-500">支持 JPG、PNG、WebP，单张不超过 10MB；上传后会自动优化。建议使用商品正面图，方便仓库核对外观。</span>
              </div>
              <div
                className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 bg-cover bg-center text-xs font-semibold text-slate-400"
                style={previewImageStyle(form.imageUrl)}
              >
                {form.imageUrl.trim() ? null : (
                  <span className="inline-flex items-center gap-1">
                    <ImagePlus size={16} />
                    图片预览
                  </span>
                )}
              </div>
            </div>
          </Field>
        </div>
        <Field label="库存预警值">
          <input className={inputClass} min="0" onChange={(event) => update("alertQty", event.target.value)} type="number" value={form.alertQty} />
        </Field>
      </div>
      <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || imageProcessing} type="submit">
        <PackagePlus size={16} />
        创建 SKU
      </button>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </SubmissionForm>
  );
}

export function CustomerSkuBulkTools() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function importCsv(file: File) {
    
    if (!file) return false;
    setMessage("");
    setError("");
    return await submissionTransition(startTransition, async () => {
      const csv = await file.text();
      const response = await submissionFetch("/api/skus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import_csv", csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { imported?: number; updated?: number; errors?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "SKU 导入失败，请检查模板。");
        return false;
      }
      const errors = payload.errors?.length ? `，${payload.errors.length} 行需复核` : "";
      setMessage(`已导入 ${payload.imported ?? 0} 个 SKU，更新 ${payload.updated ?? 0} 个 SKU${errors}`);
      router.refresh();
    
      return true;
});
    
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">SKU 批量导入导出</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">按模板批量维护 SKU、条码、分类和库存预警值。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/skus?format=template">
            <Download size={16} />
            下载模板
          </a>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/skus?format=csv">
            <Download size={16} />
            导出 SKU
          </a>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
            <Upload size={16} />
            导入 CSV
            <SubmissionFileInput accept=".csv,text/csv" className="sr-only" disabled={isPending} onUpload={importCsv} type="file" />
          </label>
        </div>
      </div>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}

export function CustomerOutboundBulkTools({ disabledReason, mode = "standard" }: { disabledReason?: string; mode?: "standard" | "tiktokClient" } = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("客户订单上传.csv");
  const [preview, setPreview] = useState<OutboundImportPreview | null>(null);
  const isTikTokClient = mode === "tiktokClient";

  async function importCsv(file: File) {
    
    if (!file) return false;
    setMessage("");
    setError("");
    setPreview(null);
    return await submissionTransition(startTransition, async () => {
      const csv = await file.text();
      setCsvText(csv);
      setCsvFileName(file.name || "客户订单上传.csv");
      const response = await submissionFetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview_import_csv", fileName: file.name, csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { preview?: OutboundImportPreview; error?: string };
      if (!response.ok) {
        setError(payload.error || (isTikTokClient ? "订单文件校验失败，请检查文件格式和必填信息。" : "出库订单预检失败，请检查模板内容。"));
        return false;
      }
      if (!payload.preview) {
        setError(isTikTokClient ? "暂时没有获取到校验结果，请重新上传订单文件。" : "未获取到预检结果，请重新上传模板。");
        return false;
      }
      setPreview(payload.preview);
      setMessage(
        isTikTokClient
          ? `校验完成：${payload.preview.readyOrders} 个订单可以提交给仓库，${payload.preview.skippedRows} 行需要修改。`
          : `预检完成：可创建 ${payload.preview.readyOrders} 个出库申请，${payload.preview.skippedRows} 行需要处理。`,
      );
    
      return true;
});
    
  }

  async function confirmImport() {

    if (!csvText) return false;
    setMessage("");
    setError("");
    return await submissionTransition(startTransition, async () => {
      const response=await submissionFetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import_csv", fileName: csvFileName, csv: csvText }),
      });
      const payload=(await response.json().catch(() => ({}))) as { imported?: number; skipped?: number; errors?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error||(isTikTokClient? "订单提交失败，请根据校验提示修改后再试。":"出库订单导入失败，请根据预检异常修正后再试。"));
        return false;
      }
      const warning=payload.errors?.length? `，${payload.errors.length} 条提醒需复核`:"";
      setPreview(null);
      setCsvText("");
      setCsvFileName("客户订单上传.csv");
      setMessage(isTikTokClient? `已提交 ${payload.imported??0} 个订单给仓库处理${warning}`:`已生成 ${payload.imported??0} 个出库申请${warning}`);
      router.refresh();

      return true;
    });

    return true;

  }

  async function saveDraft() {

    if (!csvText) return false;
    setMessage("");
    setError("");
    return await submissionTransition(startTransition, async () => {
      const response=await submissionFetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "save_import_draft", fileName: csvFileName, csv: csvText }),
      });
      const payload=(await response.json().catch(() => ({}))) as { batch?: { id?: string }; archiveWarning?: string; error?: string };
      if (!response.ok) {
        setError(payload.error||"保存预检草稿失败，请稍后再试。");
        return false;
      }
      setMessage(payload.archiveWarning||`预检草稿与原始 CSV 已保存${payload.batch?.id? `：${payload.batch.id}`:"。"}，后续可继续提交处理。`);
      router.refresh();

      return true;
    });

    return true;

  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{isTikTokClient ? "订单文件上传与校验" : "平台订单 CSV 预检"}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {isTikTokClient
              ? "请上传从平台卖家后台导出的待发货订单文件。我们会先校验订单号、商品编码、数量、收件信息和库存，确认无误后再交给仓库处理。"
              : "从平台卖家后台导出的待发货订单文件可先上传预检。系统会按订单号合并 SKU，检查 SKU、数量、收件人、地址和库存，再生成出库申请。"}
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <a className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto" href="/api/outbounds?format=template">
            <Download size={16} />
            下载订单模板
          </a>
          <label className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">
            <Upload size={16} />
            选择订单文件
            <SubmissionFileInput accept=".csv,text/csv" className="sr-only" disabled={isPending} onUpload={importCsv} type="file" />
          </label>
          {!isTikTokClient ? (
            <a className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto" href="/api/outbounds?format=csv">
              <Download size={16} />
              批量导出发货结果
            </a>
          ) : null}
          {preview ? (
            <>
              <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" disabled={isPending || !preview} onClick={() => preview && downloadCsv(isTikTokClient ? "订单问题报告.csv" : "出库订单异常报告.csv", outboundPreviewReportRows(preview))} type="button">
                <Download size={16} />
                {isTikTokClient ? "下载问题报告" : "下载异常报告"}
              </button>
              {!isTikTokClient ? (
                <SubmissionButton className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" disabled={isPending || !preview} onClick={saveDraft} type="button">
                  <Upload size={16} />
                  保存草稿
                </SubmissionButton>
              ) : null}
              <SubmissionButton className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-900 px-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" disabled={isPending || !preview || preview.readyOrders === 0 || Boolean(disabledReason)} onClick={confirmImport} type="button">
                <Upload size={16} />
                {isTikTokClient ? "提交给仓库处理" : "确认创建"}
              </SubmissionButton>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600 md:grid-cols-4">
        <p><span className="font-semibold text-slate-950">1. 导出订单：</span>{isTikTokClient ? "在平台后台筛选待发货订单并导出文件。" : "在平台后台筛选待发货订单。"}</p>
        <p><span className="font-semibold text-slate-950">2. 上传校验：</span>{isTikTokClient ? "先检查字段、商品编码、地址和库存。" : "先查看异常行，不直接发货。"}</p>
        <p><span className="font-semibold text-slate-950">3. 确认提交：</span>{isTikTokClient ? "校验通过后再交给仓库处理。" : "通过后生成出库申请。"}</p>
        <p><span className="font-semibold text-slate-950">4. 等待反馈：</span>{isTikTokClient ? "发货后客服会反馈物流追踪号。" : "发货后上传 tracking。"}</p>
      </div>
      {disabledReason ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{disabledReason}</p> : null}
      {preview ? (
        <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-white px-2 py-1 font-semibold">总行数 {preview.totalRows}</span>
            <span className="rounded-md bg-white px-2 py-1 font-semibold">{isTikTokClient ? "可提交" : "可创建"} {preview.readyOrders} 单</span>
            {!isTikTokClient ? <span className="rounded-md bg-white px-2 py-1 font-semibold">可导入行 {preview.readyRows}</span> : null}
            <span className="rounded-md bg-white px-2 py-1 font-semibold">{isTikTokClient ? "需修改" : "异常行"} {preview.skippedRows} 行</span>
          </div>
          {preview.rows.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-md border border-cyan-100 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">行号</th>
                    <th className="px-2 py-2">订单号</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2">数量</th>
                    <th className="px-2 py-2">渠道</th>
                    <th className="px-2 py-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((row, index) => (
                    <tr className="border-t border-slate-100" key={`${row.row}-${row.orderNo}-${row.skuCode}-${index}`}>
                      <td className="px-2 py-2">{row.row}</td>
                      <td className="px-2 py-2">{row.orderNo || "-"}</td>
                      <td className="px-2 py-2">{row.skuCode || "-"}</td>
                      <td className="px-2 py-2">{row.quantity || "-"}</td>
                      <td className="px-2 py-2">{row.channel || "-"}</td>
                      <td className="px-2 py-2">{row.status === "ready" ? (isTikTokClient ? "可提交" : "可导入") : (isTikTokClient ? "需修改" : "需处理")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {[...preview.errors, ...preview.warnings].length > 0 ? (
            <div className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              {[...preview.errors, ...preview.warnings].slice(0, 5).map((item) => (
                <p key={item}>{item}</p>
              ))}
              {[...preview.errors, ...preview.warnings].length > 5 ? <p>还有 {[...preview.errors, ...preview.warnings].length - 5} 条异常或提醒，请修正模板后重新上传。</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}

export function CustomerOutboundForm({ disabledReason }: { disabledReason?: string } = {}) {
  const router = useRouter();
  const [form, setForm] = useState(outboundInitialState);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(key: keyof OutboundFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();
    setMessage("");
    setError("");
    return await submissionTransition(startTransition, async () => {
      const response=await submissionFetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload=(await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error||"出库申请提交失败，请稍后重试。");
        return false;
      }
      setForm(outboundInitialState);
      setMessage("出库申请已提交，我们会进行库存和面单复核。");
      router.refresh();

      return true;
    });

    return true;

  }

  return (
    <SubmissionForm className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
      <div className="flex items-center gap-2">
        <Send size={18} className="text-[#0E7490]" />
        <h2 className="text-base font-semibold text-slate-950">创建出库申请</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="尾程渠道">
          <input className={inputClass} onChange={(event) => update("channel", event.target.value)} required value={form.channel} />
        </Field>
        <Field label="订单数">
          <input className={inputClass} min="1" onChange={(event) => update("orderCount", event.target.value)} required type="number" value={form.orderCount} />
        </Field>
        <Field label="收件人 *">
          <input className={inputClass} onChange={(event) => update("recipientName", event.target.value)} required value={form.recipientName} />
        </Field>
        <Field label="期望发货日">
          <input className={inputClass} onChange={(event) => update("requestedShipDate", event.target.value)} type="date" value={form.requestedShipDate} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3">
        <Field label="出库 SKU 明细">
          <textarea
            className="min-h-28 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-500"
            onChange={(event) => update("skuLines", event.target.value)}
            placeholder={"每行一个 SKU：\nYOUR-SKU-001,2\nYOUR-SKU-002,1"}
            required
            value={form.skuLines}
          />
        </Field>
        <Field label="完整收件地址（含英国邮编）*">
          <textarea
            className="min-h-24 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-500"
            onChange={(event) => update("deliveryAddress", event.target.value)}
            placeholder="姓名、门牌街道、城市、英国邮编"
            required
            value={form.deliveryAddress}
          />
        </Field>
        <Field label="补充说明">
          <input className={inputClass} onChange={(event) => update("note", event.target.value)} placeholder="可选，例如需要拍照、合单、加固包装" value={form.note} />
        </Field>
      </div>
      <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || Boolean(disabledReason)} type="submit">
        <Send size={16} />
        提交出库申请
      </button>
      {disabledReason ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{disabledReason}</p> : null}
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </SubmissionForm>
  );
}

export function CustomerReturnForm() {
  const router = useRouter();
  const [form, setForm] = useState(returnInitialState);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(key: keyof ReturnFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();
    setMessage("");
    setError("");
    return await submissionTransition(startTransition, async () => {
      const response=await submissionFetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload=(await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error||"退货预报提交失败，请稍后重试。");
        return false;
      }
      setForm(returnInitialState);
      setMessage("退货预报已提交，我们会继续确认退货指引、到仓和质检处理。");
      router.refresh();

      return true;
    });

    return true;

  }

  return (
    <SubmissionForm className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
      <div className="flex items-center gap-2">
        <PackagePlus size={18} className="text-[#0E7490]" />
        <h2 className="text-base font-semibold text-slate-950">创建退货预报</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="销售平台">
          <input className={inputClass} onChange={(event) => update("platform", event.target.value)} placeholder="Amazon、eBay、TikTok Shop、Shopify 等" required value={form.platform} />
        </Field>
        <Field label="原订单号">
          <input className={inputClass} onChange={(event) => update("originalOrderNo", event.target.value)} placeholder="平台订单号，可选" value={form.originalOrderNo} />
        </Field>
        <Field label="买家退货追踪号">
          <input className={inputClass} onChange={(event) => update("buyerReturnTracking", event.target.value)} placeholder="Royal Mail / Evri / DPD，可后补" value={form.buyerReturnTracking} />
        </Field>
        <Field label="预计到仓日期">
          <input className={inputClass} onChange={(event) => update("expectedArrivalDate", event.target.value)} type="date" value={form.expectedArrivalDate} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3">
        <Field label="退货 SKU 明细">
          <textarea
            className="min-h-28 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-500"
            onChange={(event) => update("skuLines", event.target.value)}
            placeholder={"每行一个 SKU：\nYOUR-SKU-001,1\nYOUR-SKU-002,2"}
            required
            value={form.skuLines}
          />
        </Field>
        <Field label="退货原因">
          <textarea className="min-h-24 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-500" onChange={(event) => update("returnReason", event.target.value)} placeholder="例如买家无理由退货、包装破损、尺码不合适、疑似故障。" required value={form.returnReason} />
        </Field>
        <Field label="处理偏好">
          <input className={inputClass} onChange={(event) => update("customerNote", event.target.value)} placeholder="例如可售请重新上架，破损请拍照确认，无法二售请报废。" value={form.customerNote} />
        </Field>
      </div>
      <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} type="submit">
        <Send size={16} />
        提交退货预报
      </button>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </SubmissionForm>
  );
}
