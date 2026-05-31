"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, PackageCheck, Send } from "lucide-react";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function inputClass() {
  return "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0E7490]";
}

function textAreaClass() {
  return "min-h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#0E7490]";
}

export function CustomerInquiryForm() {
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "提交失败，请稍后再试。");
      setSuccessId(payload.id);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (successId) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="text-emerald-700" size={34} />
        <h2 className="mt-4 text-xl font-semibold text-slate-950">需求已提交</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">
          报价需求编号：<span className="font-mono font-semibold">{successId}</span>。客服会在运营后台继续评估并生成报价。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" href="/portal">
            返回工作台
          </Link>
          <button className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700" onClick={() => setSuccessId("")} type="button">
            继续提交
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="公司 / 店铺名称" required>
          <input className={inputClass()} name="company" required />
        </Field>
        <Field label="联系人" required>
          <input className={inputClass()} name="contact" required />
        </Field>
        <Field label="手机 / 微信" required>
          <input className={inputClass()} name="phone" required />
        </Field>
        <Field label="邮箱">
          <input className={inputClass()} name="email" type="email" />
        </Field>
        <Field label="销售平台" required>
          <select className={inputClass()} name="platform" required>
            <option>Amazon UK</option>
            <option>eBay UK</option>
            <option>TikTok Shop</option>
            <option>Shopify</option>
            <option>B2B 外贸</option>
          </select>
        </Field>
        <Field label="月单量 / 货量" required>
          <select className={inputClass()} name="volume" required>
            <option>0-100 单</option>
            <option>100-500 单</option>
            <option>500-2000 单</option>
            <option>2000+ 单</option>
            <option>先试仓</option>
          </select>
        </Field>
        <Field label="需要的服务" required>
          <select className={inputClass()} name="service" required>
            <option>仓储 + 一件代发</option>
            <option>FBA 中转补货</option>
            <option>退货换标处理</option>
            <option>贴标 / 质检 / 拍照</option>
            <option>英国本地尾程配送</option>
          </select>
        </Field>
        <Field label="尾程需求">
          <select className={inputClass()} name="tailDeliveryNeed">
            <option>待确认</option>
            <option>需要 Royal Mail / DPD 等尾程</option>
            <option>只做仓储中转</option>
            <option>需要 FBA 送仓</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="补充说明">
            <textarea className={textAreaClass()} name="note" placeholder="例如：首批 20 箱，约 80 个 SKU，需要先做试仓和退货处理。" />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          {submitting ? "提交中" : "提交需求"}
        </button>
        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      </div>
    </form>
  );
}

export function CustomerInboundForm() {
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [error, setError] = useState("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError("");

    const documentTypes = data.getAll("documentTypes").map(String).filter(Boolean);
    const payload = {
      ...Object.fromEntries(data.entries()),
      cartons: Number(data.get("cartons")),
      skuCount: Number(data.get("skuCount")),
      attachmentNames: documentTypes,
    };

    try {
      const response = await fetch("/api/inbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "提交失败，请稍后再试。");
      setSuccessId(result.id);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (successId) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="text-emerald-700" size={34} />
        <h2 className="mt-4 text-xl font-semibold text-slate-950">入库预报已提交</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">
          ASN 编号：<span className="font-mono font-semibold">{successId}</span>。仓库会继续审核资料、追踪号和预约到仓安排。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" href="/portal">
            返回工作台
          </Link>
          <button className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700" onClick={() => setSuccessId("")} type="button">
            继续提交
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="客户 / 店铺名称">
          <input className={inputClass()} name="customer" />
        </Field>
        <Field label="联系人" required>
          <input className={inputClass()} name="contact" required />
        </Field>
        <Field label="手机 / 微信" required>
          <input className={inputClass()} name="phone" required />
        </Field>
        <Field label="平台">
          <select className={inputClass()} name="platform">
            <option>Amazon UK</option>
            <option>eBay UK</option>
            <option>TikTok Shop</option>
            <option>Shopify</option>
            <option>B2B 外贸</option>
          </select>
        </Field>
        <Field label="预计到仓日期" required>
          <input className={inputClass()} min={today} name="eta" required type="date" />
        </Field>
        <Field label="运输方式" required>
          <select className={inputClass()} name="transport" required>
            <option value="">请选择</option>
            <option>快递</option>
            <option>卡车</option>
            <option>海运卡派</option>
            <option>空派</option>
            <option>自送</option>
          </select>
        </Field>
        <Field label="承运商 / 追踪号">
          <input className={inputClass()} name="tracking" placeholder="可后续补交" />
        </Field>
        <Field label="箱数 / 托数" required>
          <input className={inputClass()} min="1" name="cartons" required type="number" />
        </Field>
        <Field label="SKU 数量" required>
          <input className={inputClass()} min="1" name="skuCount" required type="number" />
        </Field>
        <Field label="主要品名 / SKU" required>
          <input className={inputClass()} name="productName" required />
        </Field>
        <Field label="服务需求">
          <select className={inputClass()} name="service">
            <option>新货入仓</option>
            <option>FBA 中转</option>
            <option>退货入仓</option>
            <option>贴标 / 换标 / 质检 / 拍照</option>
          </select>
        </Field>
        <Field label="货物属性">
          <select className={inputClass()} name="attribute">
            <option>普通货物</option>
            <option>带电</option>
            <option>易碎</option>
            <option>需人工确认</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="SKU 明细">
            <textarea className={textAreaClass()} name="skuLines" placeholder={"每行一个 SKU，例如：\nSKU-A1001, 收纳盒, 120, 6\nSKU-B2002, 挂钩套装, 80, 4"} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <p className="text-sm font-semibold text-slate-700">已有资料</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {["装箱单", "SKU 清单", "外箱标签", "追踪号/承运信息", "标签文件", "VAT/EORI 或授权资料"].map((item) => (
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" key={item}>
                <input className="h-4 w-4 accent-[#0E7490]" name="documentTypes" type="checkbox" value={item} />
                {item}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <PackageCheck size={16} />}
          {submitting ? "提交中" : "提交入库预报"}
        </button>
        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      </div>
    </form>
  );
}

export function CustomerSupplementForm({ initialAsn = "" }: { initialAsn?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError("");

    const manualNames = String(data.get("manualAttachmentNames") ?? "")
      .split(/\r?\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean);
    const attachmentNames = [...data.getAll("attachmentNames").map(String), ...manualNames].filter(Boolean);

    try {
      const response = await fetch("/api/supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: String(data.get("id") ?? "").trim(),
          tracking: String(data.get("tracking") ?? "").trim(),
          supplementNote: String(data.get("supplementNote") ?? "").trim(),
          attachmentNames,
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "提交失败，请稍后再试。");
      setSuccessId(payload.id);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (successId) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="text-emerald-700" size={34} />
        <h2 className="mt-4 text-xl font-semibold text-slate-950">资料已补交</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">
          已更新 ASN：<span className="font-mono font-semibold">{successId}</span>。客服和仓库会继续审核资料。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" href="/portal">
            返回工作台
          </Link>
          <button className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700" onClick={() => setSuccessId("")} type="button">
            继续补交
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <Field label="入库预报编号 ASN" required>
          <input className={inputClass()} defaultValue={initialAsn} name="id" placeholder="例如：入库-UK-202605-1987" required />
        </Field>
        <Field label="承运商 / 追踪号">
          <input className={inputClass()} name="tracking" placeholder="例如：Royal Mail RM123456789GB" />
        </Field>
        <div>
          <p className="text-sm font-semibold text-slate-700">补交资料类型</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {["装箱单", "SKU 清单", "外箱标签", "物流面单", "标签文件", "VAT/EORI 或授权资料", "产品图片", "异常照片"].map((item) => (
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" key={item}>
                <input className="h-4 w-4 accent-[#0E7490]" name="attachmentNames" type="checkbox" value={item} />
                {item}
              </label>
            ))}
          </div>
        </div>
        <Field label="附件名称补充">
          <textarea className={textAreaClass()} name="manualAttachmentNames" placeholder={"可填写文件名，每行一个，例如：\npacking-list.xlsx\ncarton-labels.pdf"} />
        </Field>
        <Field label="补充说明">
          <textarea className={textAreaClass()} name="supplementNote" placeholder="例如：已补齐追踪号和外箱标签，请继续审核。" />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          {submitting ? "提交中" : "提交补充资料"}
        </button>
        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      </div>
    </form>
  );
}
