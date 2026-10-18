"use client";

import { SubmissionForm, submissionFetch, submissionTransition } from "./SubmissionFeedback";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { ImagePlus, Pencil, Save, X } from "lucide-react";
import { compressSkuImage, skuImageInputMaxBytes } from "./skuImageClient";

type EditableSku = {
  skuCode: string;
  productName: string;
  barcode?: string;
  category?: string;
  imageUrl?: string;
  alertQty: number;
};

type EditForm = {
  productName: string;
  barcode: string;
  category: string;
  imageUrl: string;
  alertQty: string;
};

function initialForm(sku: EditableSku): EditForm {
  return {
    productName: sku.productName,
    barcode: sku.barcode ?? "",
    category: sku.category ?? "",
    imageUrl: sku.imageUrl ?? "",
    alertQty: String(sku.alertQty),
  };
}

function previewImageStyle(imageUrl: string) {
  const safeUrl = imageUrl.trim().replace(/["\\\n\r]/g, "");
  return safeUrl ? { backgroundImage: `url("${safeUrl}")` } : undefined;
}

const inputClass = "min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500";

export function CustomerSkuEditButton({ sku }: { sku: EditableSku }) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(() => initialForm(sku));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isPending, open]);

  function openEditor() {
    setForm(initialForm(sku));
    setError("");
    setSaved(false);
    setOpen(true);
  }

  function update(key: keyof EditForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
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
    } catch {
      setError("图片处理失败，请更换一张图片后重试。");
    } finally {
      setImageProcessing(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();
    setError("");
    setSaved(false);
    return await submissionTransition(startTransition, async () => {
      const response=await submissionFetch("/api/skus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuCode: sku.skuCode, ...form }),
      });
      const result=(await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error||"商品资料保存失败，请稍后再试。");
        return false;
      }
      setOpen(false);
      setSaved(true);
      router.refresh();

      return true;
    });

    return true;

  }

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <button className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-cyan-300 hover:text-cyan-800" onClick={openEditor} type="button">
          <Pencil size={14} /> 修改
        </button>
        {saved ? <span className="text-xs font-medium text-emerald-700">已保存</span> : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) setOpen(false);
          }}
        >
          <section aria-labelledby={titleId} aria-modal="true" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl" role="dialog">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-950" id={titleId}>修改商品资料</h2>
                <p className="mt-1 text-xs text-slate-500">保存后会立即更新客户工作台和管理后台。</p>
              </div>
              <button aria-label="关闭修改窗口" className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" disabled={isPending} onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <SubmissionForm className="grid gap-5 p-4 sm:p-6" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  SKU 编码
                  <input className={`${inputClass} cursor-not-allowed bg-slate-50 font-mono text-slate-500`} readOnly value={sku.skuCode} />
                  <span className="text-xs font-normal leading-5 text-slate-500">编码已关联库存和订单，创建后保持不变。</span>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  商品名称
                  <input autoFocus className={inputClass} onChange={(event) => update("productName", event.target.value)} required value={form.productName} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  条码
                  <input className={inputClass} onChange={(event) => update("barcode", event.target.value)} placeholder="EAN / UPC，可选" value={form.barcode} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  分类
                  <input className={inputClass} onChange={(event) => update("category", event.target.value)} placeholder="服饰 / 家居 / 汽配" value={form.category} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700 sm:col-span-2">
                  库存预警值
                  <input className={inputClass} min="0" onChange={(event) => update("alertQty", event.target.value)} type="number" value={form.alertQty} />
                </label>
              </div>

              <div className="grid gap-3">
                <span className="text-sm font-semibold text-slate-700">商品图片</span>
                <div className="grid gap-3 sm:grid-cols-[1fr_112px]">
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                        <ImagePlus size={16} /> {imageProcessing ? "正在处理" : "重新上传"}
                        <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={imageProcessing || isPending} onChange={uploadImage} type="file" />
                      </label>
                      <button className="min-h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50" disabled={!form.imageUrl || imageProcessing || isPending} onClick={() => update("imageUrl", "")} type="button">
                        清除图片
                      </button>
                    </div>
                    <input className={inputClass} onChange={(event) => update("imageUrl", event.target.value)} placeholder="也可以粘贴商品主图链接" value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl} />
                    <p className="text-xs leading-5 text-slate-500">支持 JPG、PNG、WebP，原图不超过 10MB；上传后自动优化。</p>
                  </div>
                  <div className="h-28 rounded-md border border-dashed border-slate-200 bg-slate-50 bg-cover bg-center" style={previewImageStyle(form.imageUrl)}>
                    {form.imageUrl ? null : <ImagePlus className="m-auto mt-10 text-slate-300" size={24} />}
                  </div>
                </div>
              </div>

              {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button className="min-h-11 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={isPending} onClick={() => setOpen(false)} type="button">取消</button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60" disabled={isPending || imageProcessing} type="submit">
                  <Save size={16} /> {isPending ? "正在保存" : "保存修改"}
                </button>
              </div>
            </SubmissionForm>
          </section>
        </div>
      ) : null}
    </>
  );
}
