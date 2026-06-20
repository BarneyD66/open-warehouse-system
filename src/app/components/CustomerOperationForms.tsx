"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, PackagePlus, Send, Tags, Upload } from "lucide-react";

type SkuFormState = {
  skuCode: string;
  productName: string;
  barcode: string;
  category: string;
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
  platform: "TikTok Shop",
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
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(key: keyof SkuFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/skus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "SKU 建档失败，请稍后重试。");
        return;
      }
      setForm(skuInitialState);
      setMessage("SKU 已创建，并已初始化库存底表。");
      router.refresh();
    });
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
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
          <input className={inputClass} onChange={(event) => update("category", event.target.value)} placeholder="服饰 / 家居 / FBA" value={form.category} />
        </Field>
        <Field label="库存预警值">
          <input className={inputClass} min="0" onChange={(event) => update("alertQty", event.target.value)} type="number" value={form.alertQty} />
        </Field>
      </div>
      <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} type="submit">
        <PackagePlus size={16} />
        创建 SKU
      </button>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </form>
  );
}

export function CustomerSkuBulkTools() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const csv = await file.text();
      const response = await fetch("/api/skus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import_csv", csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { imported?: number; updated?: number; errors?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "SKU 导入失败，请检查模板。");
        return;
      }
      const errors = payload.errors?.length ? `，${payload.errors.length} 行需复核` : "";
      setMessage(`已导入 ${payload.imported ?? 0} 个 SKU，更新 ${payload.updated ?? 0} 个 SKU${errors}`);
      router.refresh();
    });
    event.target.value = "";
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
            <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={importCsv} type="file" />
          </label>
        </div>
      </div>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}

export function CustomerOutboundBulkTools({ disabledReason }: { disabledReason?: string } = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<OutboundImportPreview | null>(null);

  function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    setPreview(null);
    startTransition(async () => {
      const csv = await file.text();
      setCsvText(csv);
      const response = await fetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview_import_csv", csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { preview?: OutboundImportPreview; error?: string };
      if (!response.ok) {
        setError(payload.error || "出库订单预检失败，请检查模板内容。");
        return;
      }
      if (!payload.preview) {
        setError("未获取到预检结果，请重新上传模板。");
        return;
      }
      setPreview(payload.preview);
      setMessage(`预检完成：可创建 ${payload.preview.readyOrders} 个出库申请，${payload.preview.skippedRows} 行需要处理。`);
    });
    event.target.value = "";
  }

  function confirmImport() {
    if (!csvText) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import_csv", csv: csvText }),
      });
      const payload = (await response.json().catch(() => ({}))) as { imported?: number; skipped?: number; errors?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "出库订单导入失败，请根据预检异常修正后再试。");
        return;
      }
      const warning = payload.errors?.length ? `，${payload.errors.length} 条提醒需复核` : "";
      setPreview(null);
      setCsvText("");
      setMessage(`已生成 ${payload.imported ?? 0} 个出库申请${warning}`);
      router.refresh();
    });
  }

  function saveDraft() {
    if (!csvText) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "save_import_draft", fileName: "客户出库订单预检草稿.csv", csv: csvText }),
      });
      const payload = (await response.json().catch(() => ({}))) as { batch?: { id?: string }; error?: string };
      if (!response.ok) {
        setError(payload.error || "保存预检草稿失败，请稍后再试。");
        return;
      }
      setMessage(`预检草稿已保存${payload.batch?.id ? `：${payload.batch.id}` : "。"}，运营可在后台导入记录中查看。`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">批量导入出库订单</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">按模板上传平台订单、收件人、地址和 SKU 明细，系统会按订单号合并 SKU 并生成出库申请。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/outbounds?format=template">
            <Download size={16} />
            下载模板
          </a>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/outbounds?format=csv">
            <Download size={16} />
            导出出库单
          </a>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
            <Upload size={16} />
            上传并预检
            <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={importCsv} type="file" />
          </label>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={isPending || !preview} onClick={() => preview && downloadCsv("出库订单异常报告.csv", outboundPreviewReportRows(preview))} type="button">
            <Download size={16} />
            下载异常报告
          </button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={isPending || !preview} onClick={saveDraft} type="button">
            <Upload size={16} />
            保存草稿
          </button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-cyan-900 px-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={isPending || !preview || preview.readyOrders === 0 || Boolean(disabledReason)} onClick={confirmImport} type="button">
            <Upload size={16} />
            确认创建
          </button>
        </div>
      </div>
      {disabledReason ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{disabledReason}</p> : null}
      {preview ? (
        <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-white px-2 py-1 font-semibold">总行数 {preview.totalRows}</span>
            <span className="rounded-md bg-white px-2 py-1 font-semibold">可创建 {preview.readyOrders} 单</span>
            <span className="rounded-md bg-white px-2 py-1 font-semibold">可导入行 {preview.readyRows}</span>
            <span className="rounded-md bg-white px-2 py-1 font-semibold">异常行 {preview.skippedRows}</span>
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
                      <td className="px-2 py-2">{row.status === "ready" ? "可导入" : "需处理"}</td>
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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/outbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "出库申请提交失败，请稍后重试。");
        return;
      }
      setForm(outboundInitialState);
      setMessage("出库申请已提交，运营会进行库存和面单复核。");
      router.refresh();
    });
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
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
        <Field label="收件人">
          <input className={inputClass} onChange={(event) => update("recipientName", event.target.value)} placeholder="可选" value={form.recipientName} />
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
        <Field label="地址/备注">
          <textarea
            className="min-h-24 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-500"
            onChange={(event) => update("deliveryAddress", event.target.value)}
            placeholder="收件地址、平台订单号、包装要求等"
            value={form.deliveryAddress}
          />
        </Field>
        <Field label="运营备注">
          <input className={inputClass} onChange={(event) => update("note", event.target.value)} placeholder="可选，例如需要拍照、合单、FBA 中转" value={form.note} />
        </Field>
      </div>
      <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || Boolean(disabledReason)} type="submit">
        <Send size={16} />
        提交出库申请
      </button>
      {disabledReason ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{disabledReason}</p> : null}
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </form>
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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "退货预报提交失败，请稍后重试。");
        return;
      }
      setForm(returnInitialState);
      setMessage("退货预报已提交，运营会确认退货指引、到仓和质检处理。");
      router.refresh();
    });
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
      <div className="flex items-center gap-2">
        <PackagePlus size={18} className="text-[#0E7490]" />
        <h2 className="text-base font-semibold text-slate-950">创建退货预报</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="销售平台">
          <input className={inputClass} onChange={(event) => update("platform", event.target.value)} required value={form.platform} />
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
    </form>
  );
}
