"use client";

import { SubmissionForm, submissionFetch, readableSubmissionError } from "./SubmissionFeedback";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save, X } from "lucide-react";
import type { InboundSubmission } from "@/lib/localStore";
import { InboundSkuMetricsPreview } from "./InboundSkuMetricsPreview";

const standardDocuments = ["装箱单", "商品编码清单", "外箱标签", "追踪号/承运信息", "物流面单", "标签文件", "清关或授权资料", "产品图片", "异常照片"];

function EditField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span>{label}{required ? <span className="ml-1 text-rose-600">*</span> : null}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function inputClass() {
  return "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
}

function skuLinesValue(item: InboundSubmission) {
  return (item.skuLines ?? [])
    .map((line) => [line.skuCode, line.productName ?? "", line.expectedQty ?? "", line.cartonCount ?? ""].join(", "))
    .join("\n");
}

function optionsWithCurrent(options: string[], current?: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

export function CustomerInboundEditor({ item, editable }: { item: InboundSubmission; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const initialSkuLinesText = useMemo(() => skuLinesValue(item), [item]);
  const [skuLinesText, setSkuLinesText] = useState(initialSkuLinesText);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const documentOptions = useMemo(() => Array.from(new Set([...standardDocuments, ...(item.attachmentNames ?? [])])), [item.attachmentNames]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submissionFormElement=event.currentTarget;

    try {

      event.preventDefault();
      const data=new FormData(submissionFormElement);
      setSubmitting(true);
      setError("");
      setSaved(false);

      const manualAttachmentNames=String(data.get("manualAttachmentNames")??"")
        .split(/\r?\n|,|，/)
        .map((name) => name.trim())
        .filter(Boolean);

      const payload={
        ...Object.fromEntries(data.entries()),
        attachmentNames: Array.from(new Set([...data.getAll("documentTypes").map(String).filter(Boolean), ...manualAttachmentNames])),
      };

      try {
        const response=await submissionFetch(`/api/inbounds/${encodeURIComponent(item.id)}/customer`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result=(await response.json()) as { id?: string; error?: string };
        if (!response.ok||!result.id) throw new Error(result.error||"保存失败，请稍后再试。");
        setEditing(false);
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error? err.message:"保存失败，请稍后再试。");

        throw readableSubmissionError(err);
      } finally {
        setSubmitting(false);
      }

      return true;
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={!editable}
          onClick={() => {
            setEditing(true);
            setSkuLinesText(initialSkuLinesText);
            setError("");
            setSaved(false);
          }}
          type="button"
        >
          <Pencil size={14} />
          修改 / 补充资料
        </button>
        {!editable ? <span className="text-xs text-slate-500">仓库已开始处理，如需修改请联系服务团队。</span> : null}
        {saved ? <span className="text-xs font-semibold text-emerald-700" role="status">修改已保存</span> : null}
      </div>
    );
  }

  return (
    <SubmissionForm className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50/50 p-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 border-b border-cyan-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold text-slate-950">修改 / 补充入库资料</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">到仓信息、追踪号和资料可在这里一次更新；保存后原入库编号不会改变。</p>
        </div>
        <button className="inline-flex min-h-9 items-center gap-1 self-start rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700" onClick={() => setEditing(false)} type="button">
          <X size={14} />取消
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <EditField label="客户 / 店铺名称">
          <input className={inputClass()} defaultValue={item.customer ?? ""} name="customer" />
        </EditField>
        <EditField label="联系人">
          <input className={inputClass()} defaultValue={item.contact} name="contact" />
        </EditField>
        <EditField label="平台">
          <select className={inputClass()} defaultValue={item.platform ?? ""} name="platform">
            <option value="">未选择</option>
            {optionsWithCurrent(["TikTok Shop", "eBay UK", "Shopify", "Amazon UK", "独立站", "其他平台"], item.platform).map((option) => <option key={option}>{option}</option>)}
          </select>
        </EditField>
        <EditField label="预计到仓日期" required>
          <input className={inputClass()} defaultValue={item.eta} min={today} name="eta" required type="date" />
        </EditField>
        <EditField label="运输方式" required>
          <select className={inputClass()} defaultValue={item.transport} name="transport" required>
            <option value="">请选择</option>
            {optionsWithCurrent(["快递", "卡车", "海运卡派", "空派", "自送"], item.transport).map((option) => <option key={option}>{option}</option>)}
          </select>
        </EditField>
        <EditField label="承运商 / 追踪号">
          <input className={inputClass()} defaultValue={item.tracking ?? ""} name="tracking" placeholder="可后续补交" />
        </EditField>
        <EditField label="主要品名" required>
          <input className={inputClass()} defaultValue={item.productName} name="productName" required />
        </EditField>
        <EditField label="服务需求">
          <select className={inputClass()} defaultValue={item.service ?? ""} name="service">
            <option value="">未选择</option>
            {optionsWithCurrent(["新货入仓", "平台订单处理备货", "退货入仓", "贴标 / 换标 / 质检 / 拍照"], item.service).map((option) => <option key={option}>{option}</option>)}
          </select>
        </EditField>
        <EditField label="货物属性">
          <select className={inputClass()} defaultValue={item.attribute ?? ""} name="attribute">
            <option value="">未选择</option>
            {optionsWithCurrent(["普通货物", "带电", "易碎", "需人工确认"], item.attribute).map((option) => <option key={option}>{option}</option>)}
          </select>
        </EditField>
        <div className="md:col-span-2">
          <EditField label="SKU 明细" required>
            <textarea
              className={`${inputClass()} min-h-28 py-3`}
              name="skuLines"
              onChange={(event) => setSkuLinesText(event.target.value)}
              placeholder="每行一个 SKU，格式：SKU编码, 商品名称, 商品数量, 箱数/托数（如 2、2箱或 2托）"
              required
              value={skuLinesText}
            />
          </EditField>
          <InboundSkuMetricsPreview value={skuLinesText} />
        </div>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-semibold text-slate-700">已有 / 补充资料</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {documentOptions.map((document) => (
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700" key={document}>
                <input className="h-4 w-4 accent-cyan-700" defaultChecked={item.attachmentNames.includes(document)} name="documentTypes" type="checkbox" value={document} />
                {document}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2">
          <EditField label="其他资料名称（可选）">
            <textarea
              className={`${inputClass()} min-h-20 py-3`}
              name="manualAttachmentNames"
              placeholder="每行一个，例如：packing-list.xlsx"
            />
          </EditField>
        </div>
        <div className="md:col-span-2">
          <EditField label="补充说明（可选）">
            <textarea
              className={`${inputClass()} min-h-24 py-3`}
              defaultValue={item.supplementNote ?? ""}
              name="supplementNote"
              placeholder="例如：已补齐追踪号和外箱标签，请继续审核。"
            />
          </EditField>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {submitting ? "保存中" : "保存修改"}
        </button>
        {error ? <p className="text-sm font-semibold text-rose-600" role="alert">{error}</p> : null}
      </div>
    </SubmissionForm>
  );
}
