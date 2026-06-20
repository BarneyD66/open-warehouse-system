"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, ClipboardCheck, Copy, FileUp, Loader2, PackageCheck, Search, Send } from "lucide-react";
import Link from "next/link";

type FormErrors = Record<string, string>;

export type InitialInquiryQuote = {
  platform?: string;
  volume?: string;
  service?: string;
  note?: string;
  quoteEstimate?: string;
  intentLabel?: string;
  currentStage?: string;
  hasDocs?: string;
  firstInboundPlan?: string;
  fbaNeed?: string;
  returnNeed?: string;
  serviceNeeds?: string[];
};

type TrackingResult = {
  id: string;
  type: "inquiry" | "inbound";
  createdAt: string;
  status: string;
  nextAction: string;
  timeline?: Array<{
    id: string;
    occurredAt: string;
    message: string;
    operator: "system" | "customer" | "ops";
  }>;
  title: string;
  contact: string;
  phone: string;
  summary: string;
  documentChecklist?: {
    ready: number;
    total: number;
    requiredReady: number;
    requiredTotal: number;
    missingRequired: string[];
    items: Array<{
      key: string;
      label: string;
      required: boolean;
      ready: boolean;
      hint: string;
      matchedBy?: string;
    }>;
  };
};

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-semibold text-slate-800">
      {children}
      {required ? <span className="ml-1 text-rose-600">*</span> : null}
    </label>
  );
}

function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-rose-600">{children}</p>;
}

function shortDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const inboundDocumentOptions = [
  "装箱单",
  "SKU 清单",
  "外箱标签",
  "标签文件",
  "VAT/EORI 或授权资料",
  "产品图片/异常图片",
];

export function InquiryForm({ initialQuote }: { initialQuote?: InitialInquiryQuote }) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [uploadSummary, setUploadSummary] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyInquiryId() {
    if (!successId || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(successId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: FormErrors = {};
    const company = String(data.get("company") ?? "").trim();
    const contact = String(data.get("contact") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const platform = String(data.get("platform") ?? "").trim();
    const volume = String(data.get("volume") ?? "").trim();
    const service = String(data.get("service") ?? "").trim();
    const leadIntent = String(data.get("leadIntent") ?? "").trim();
    const productCategory = String(data.get("productCategory") ?? "").trim();
    const skuCount = String(data.get("skuCount") ?? "").trim();
    const averageSizeWeight = String(data.get("averageSizeWeight") ?? "").trim();
    const firstInboundPlan = String(data.get("firstInboundPlan") ?? "").trim();
    const tailDeliveryNeed = String(data.get("tailDeliveryNeed") ?? "").trim();
    const fbaNeed = String(data.get("fbaNeed") ?? "").trim();
    const returnNeed = String(data.get("returnNeed") ?? "").trim();
    const currentStage = String(data.get("currentStage") ?? "").trim();
    const hasDocs = String(data.get("hasDocs") ?? "").trim();
    const serviceNeeds = data.getAll("serviceNeeds").map((value) => String(value).trim()).filter(Boolean);
    const note = String(data.get("note") ?? "").trim();
    const salesNote = [
      note,
      currentStage ? `当前进度：${currentStage}` : "",
      hasDocs ? `资料情况：${hasDocs}` : "",
      productCategory ? `产品品类：${productCategory}` : "",
      skuCount ? `SKU 数：${skuCount}` : "",
      averageSizeWeight ? `平均尺寸/重量：${averageSizeWeight}` : "",
      firstInboundPlan ? `首次入仓计划：${firstInboundPlan}` : "",
      tailDeliveryNeed ? `英国尾程派送：${tailDeliveryNeed}` : "",
      serviceNeeds.length > 0 ? `其他服务需求：${serviceNeeds.join("、")}` : "",
      fbaNeed ? `FBA 需求：${fbaNeed}` : "",
      returnNeed ? `退货需求：${returnNeed}` : "",
    ].filter(Boolean).join("\n");

    if (!company) nextErrors.company = "请填写公司或店铺名称。";
    if (!contact) nextErrors.contact = "请填写联系人。";
    if (!phone && !email) nextErrors.phone = "手机/微信和邮箱至少填写一个。";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "邮箱格式不正确。";
    if (!platform) nextErrors.platform = "请选择销售平台。";
    if (!volume) nextErrors.volume = "请选择预计月单量。";
    if (!service) nextErrors.service = "请选择主要服务需求。";

    setErrors(nextErrors);
    setSubmitError("");
    setUploadSummary("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const submitData = new FormData();
      const files = data.getAll("files").filter((file): file is File => file instanceof File && Boolean(file.name) && file.size > 0);
      const documentTypes = data.getAll("documentTypes").map((item) => String(item).trim()).filter(Boolean);
      [
        ["company", company],
        ["contact", contact],
        ["phone", phone],
        ["email", email],
        ["platform", platform],
        ["volume", volume],
        ["service", service],
        ["leadIntent", leadIntent],
        ["origin", String(data.get("origin") ?? "").trim()],
        ["tailDeliveryNeed", tailDeliveryNeed],
        ["note", salesNote],
        ["quoteEstimate", String(data.get("quoteEstimate") ?? "").trim()],
      ].forEach(([key, value]) => submitData.set(key, value));
      documentTypes.forEach((item) => submitData.append("documentTypes", item));
      files.forEach((file) => submitData.append("files", file));

      const response = await fetch("/api/inquiries", {
        method: "POST",
        body: submitData,
      });
      const payload = (await response.json()) as { id?: string; error?: string; uploadedFiles?: number; uploadErrors?: string[] };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "提交失败，请稍后再试。");
      }
      if ((payload.uploadedFiles ?? 0) > 0) {
        setUploadSummary(`已同步上传 ${payload.uploadedFiles} 个询盘资料文件，运营可在资料中心查看。`);
      }
      if (payload.uploadErrors?.length) {
        setUploadSummary(`询盘已提交，但部分附件未归档：${payload.uploadErrors.join("；")}`);
      }
      setSuccessId(payload.id);
      setCopied(false);
      form.reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (successId) {
    return (
      <div className="metric-card p-6">
        <CheckCircle2 size={34} className="text-emerald-600" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">需求已收到，客服将按资料跟进报价</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          咨询编号：<span className="font-mono font-semibold text-slate-950">{successId}</span>。客服会尽快根据平台、月单量、品类、SKU、尺寸重量和服务需求联系您确认报价。
        </p>
        <div className="mt-4 rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
          下一步：请保持微信或电话可联系。客服会先确认报价和入仓要求；已经准备发货的客户，可以继续创建入库预报，并保留这个咨询编号方便沟通。
        </div>
        {uploadSummary ? <p className="mt-3 rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">{uploadSummary}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800" onClick={copyInquiryId} type="button">
            <Copy size={16} />
            {copied ? "已复制编号" : "复制咨询编号"}
          </button>
          <button className="inline-flex min-h-11 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" onClick={() => setSuccessId("")}>
            继续提交
          </button>
          <Link className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800" href="/inbound">
            创建入库预报
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="metric-card inquiry-form-card grid gap-5 p-5 sm:p-6" onSubmit={handleSubmit}>
      {initialQuote?.quoteEstimate ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
          <div className="flex items-center gap-2 font-semibold text-slate-950">
            <Calculator size={17} />
            已带入费用预估，报价待客服确认
          </div>
          <p className="mt-2 text-cyan-900">{initialQuote.quoteEstimate}</p>
        </div>
      ) : null}
      <input name="quoteEstimate" type="hidden" defaultValue={initialQuote?.quoteEstimate ?? ""} />
      <input name="leadIntent" type="hidden" defaultValue={initialQuote?.intentLabel ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel required>公司/店铺名称</FieldLabel>
          <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="company" placeholder="例如：深圳蓝海科技" />
          <ErrorText>{errors.company}</ErrorText>
        </div>
        <div>
          <FieldLabel required>联系人</FieldLabel>
          <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="contact" placeholder="姓名" />
          <ErrorText>{errors.contact}</ErrorText>
        </div>
        <div>
          <FieldLabel required>微信 / 手机</FieldLabel>
          <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="phone" placeholder="优先填写微信号，方便发送报价和入仓资料" />
          <ErrorText>{errors.phone}</ErrorText>
        </div>
        <div>
          <FieldLabel>邮箱</FieldLabel>
          <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="email" placeholder="name@example.com" />
          <ErrorText>{errors.email}</ErrorText>
        </div>
        <div>
          <FieldLabel required>销售平台</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.platform ?? ""} name="platform">
            <option value="">请选择</option>
            <option>Amazon UK</option>
            <option>eBay UK</option>
            <option>TikTok Shop</option>
            <option>Shopify</option>
            <option>Temu</option>
            <option>B2B 外贸</option>
          </select>
          <ErrorText>{errors.platform}</ErrorText>
        </div>
        <div>
          <FieldLabel required>预计月单量</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.volume ?? ""} name="volume">
            <option value="">请选择</option>
            <option>0-100 单</option>
            <option>100-500 单</option>
            <option>500-2000 单</option>
            <option>2000+ 单</option>
          </select>
          <ErrorText>{errors.volume}</ErrorText>
        </div>
        <div>
          <FieldLabel required>主要服务需求</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.service ?? ""} name="service">
            <option value="">请选择</option>
            <option>仓储备货</option>
            <option>一件代发</option>
            <option>FBA 中转</option>
            <option>退货换标</option>
            <option>贴标/质检/拍照</option>
            <option>大货入仓/卡车派送</option>
          </select>
          <ErrorText>{errors.service}</ErrorText>
        </div>
        <div>
          <FieldLabel>是否需要英国尾程派送</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue="不确定，客服帮我判断" name="tailDeliveryNeed">
            <option>需要，一件代发到买家</option>
            <option>需要，批量转运/FBA送仓</option>
            <option>暂不需要，只做仓储/退货</option>
            <option>不确定，客服帮我判断</option>
          </select>
        </div>
        <div>
          <FieldLabel>货物所在地</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue="中国" name="origin">
            <option>中国</option>
            <option>英国</option>
            <option>欧盟</option>
            <option>其他</option>
          </select>
        </div>
      </div>

      <details className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-cyan-950">补充资料，让报价更准确</summary>
        <p className="mt-2 text-sm leading-6 text-cyan-900">品类、SKU、尺寸重量、入仓时间、FBA 和退货需求越清楚，客服越容易一次性判断仓储、出库、尾程和增值服务费用。</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>当前进度</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.currentStage ?? "还在比价"} name="currentStage">
            <option>还在比价</option>
            <option>已有货在路上</option>
            <option>货已在英国</option>
            <option>本周要发货</option>
            <option>准备长期合作</option>
          </select>
        </div>
        <div>
          <FieldLabel>是否已有资料</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.hasDocs ?? "暂时没有资料"} name="hasDocs">
            <option>暂时没有资料</option>
            <option>已有 SKU 表</option>
            <option>已有装箱单</option>
            <option>已有 FBA 标签/货件计划</option>
            <option>已有完整入仓资料</option>
          </select>
        </div>
        <div>
          <FieldLabel>产品品类</FieldLabel>
          <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="productCategory" placeholder="例如：家居、小家电、服饰、配件" />
        </div>
        <div>
          <FieldLabel>SKU 数量</FieldLabel>
          <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" inputMode="numeric" name="skuCount" placeholder="例如：30 个 SKU" />
        </div>
        <div>
          <FieldLabel>平均尺寸 / 重量</FieldLabel>
          <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="averageSizeWeight" placeholder="例如：30x20x10cm，0.8kg/件" />
        </div>
        <div>
          <FieldLabel>首次入仓计划</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.firstInboundPlan ?? "还在了解"} name="firstInboundPlan">
            <option>还在了解</option>
            <option>1-2 周内</option>
            <option>本月内</option>
            <option>1-3 个月内</option>
            <option>已有货在英国</option>
          </select>
        </div>
        <div>
          <FieldLabel>FBA 需求</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.fbaNeed ?? "暂无 FBA 需求"} name="fbaNeed">
            <option>暂无 FBA 需求</option>
            <option>需要 FNSKU 贴标</option>
            <option>需要换箱/分箱</option>
            <option>需要打托/预约送仓</option>
            <option>需要完整 FBA 中转方案</option>
          </select>
        </div>
        <div>
          <FieldLabel>退货需求</FieldLabel>
          <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.returnNeed ?? "暂无退货需求"} name="returnNeed">
            <option>暂无退货需求</option>
            <option>需要英国退货接收</option>
            <option>需要质检拍照</option>
            <option>需要换标重上架</option>
            <option>需要销毁/转寄规则</option>
          </select>
        </div>
      </div>

      <div>
        <FieldLabel>可能同时需要的服务</FieldLabel>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {["仓储备货", "一件代发", "FBA 中转", "退货接收", "换标重上架", "拍照质检"].map((item) => (
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700" key={item}>
              <input className="h-4 w-4 accent-[#0E7490]" defaultChecked={initialQuote?.serviceNeeds?.includes(item)} name="serviceNeeds" type="checkbox" value={item} />
              {item}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">主要服务需求上方先选一个主场景，多个附加需求可以在这里勾选。</p>
      </div>
      </details>

      <div>
        <FieldLabel>补充说明</FieldLabel>
        <textarea className="mt-2 min-h-28 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-[#0E7490]" defaultValue={initialQuote?.note ?? ""} name="note" placeholder="例如：预计每月 500 单，首批 80 箱，主要发 TikTok Shop，部分退货需要拍照质检。" />
      </div>

      <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit" disabled={submitting} type="submit">
        {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        {submitting ? "正在提交" : "提交需求，等待客服报价"}
      </button>
      <ErrorText>{submitError}</ErrorText>
    </form>
  );
}

export function InboundForm() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [uploadSummary, setUploadSummary] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [step, setStep] = useState(0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const steps = ["基础信息", "货物信息", "资料确认"];

  async function uploadInboundDocuments(inboundId: string, files: File[]) {
    let uploaded = 0;
    for (const file of files) {
      const form = new FormData();
      form.set("file", file);
      form.set("refType", "inbound");
      form.set("refId", inboundId);
      form.set("category", "packing_list");
      form.set("note", "客户提交入库预报时同步上传");

      const response = await fetch("/api/documents", { method: "POST", body: form });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `${file.name} 上传失败`);
      }
      uploaded += 1;
    }
    return uploaded;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: FormErrors = {};
    const contact = String(data.get("contact") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const eta = String(data.get("eta") ?? "").trim();
    const transport = String(data.get("transport") ?? "").trim();
    const cartons = Number(String(data.get("cartons") ?? "").trim());
    const skuCount = Number(String(data.get("skuCount") ?? "").trim());
    const productName = String(data.get("productName") ?? "").trim();
    const confirmed = data.get("confirm") === "on";

    if (!contact) nextErrors.contact = "请填写联系人。";
    if (!phone) nextErrors.phone = "请填写手机或微信。";
    if (!eta) nextErrors.eta = "请选择预计到仓日期。";
    if (eta && eta < today) nextErrors.eta = "预计到仓日期不能早于今天。";
    if (!transport) nextErrors.transport = "请选择运输方式。";
    if (!cartons || cartons <= 0) nextErrors.cartons = "箱数/托数必须大于 0。";
    if (!skuCount || skuCount <= 0) nextErrors.skuCount = "SKU 数量必须大于 0。";
    if (!productName) nextErrors.productName = "请填写主要品名或 SKU。";
    if (!confirmed) nextErrors.confirm = "请确认货物信息和入仓规则。";

    setErrors(nextErrors);
    setSubmitError("");
    setUploadSummary("");
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.contact || nextErrors.phone) setStep(0);
      else if (nextErrors.eta || nextErrors.transport || nextErrors.cartons || nextErrors.skuCount || nextErrors.productName) setStep(1);
      else setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const files = data.getAll("files").filter((file): file is File => file instanceof File && Boolean(file.name) && file.size > 0);
      const declaredDocs = data.getAll("documentTypes").map((item) => String(item).trim()).filter(Boolean);
      const response = await fetch("/api/inbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: String(data.get("customer") ?? "").trim(),
          contact,
          phone,
          platform: String(data.get("platform") ?? "").trim(),
          eta,
          transport,
          tracking: String(data.get("tracking") ?? "").trim(),
          cartons,
          skuCount,
          skuLines: String(data.get("skuLines") ?? "").trim(),
          productName,
          service: String(data.get("service") ?? "").trim(),
          attribute: String(data.get("attribute") ?? "").trim(),
          attachmentNames: Array.from(new Set([...declaredDocs, ...files.map((file) => file.name)])),
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "提交失败，请稍后再试。");
      }
      if (files.length > 0) {
        try {
          const uploaded = await uploadInboundDocuments(payload.id, files);
          setUploadSummary(`已同步上传 ${uploaded} 个资料文件，运营可在资料中心查看。`);
        } catch (error) {
          setUploadSummary(`入库预报已提交，但附件上传失败：${error instanceof Error ? error.message : "请稍后到补交资料页重新上传"}`);
        }
      }
      setSuccessId(payload.id);
      setStep(0);
      form.reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (successId) {
    return (
      <div className="metric-card p-6">
        <CheckCircle2 size={34} className="text-emerald-600" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">入库预报已提交</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          入库预报编号：<span className="font-mono font-semibold text-slate-950">{successId}</span>。状态：待审核。客户服务审核后会确认完整入仓要求和收货安排。
        </p>
        {uploadSummary ? <p className="mt-3 rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">{uploadSummary}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="inline-flex min-h-11 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" onClick={() => setSuccessId("")}>
            继续提交
          </button>
          <Link className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800" href="/inquiry?service=trial">
            补充报价需求
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="metric-card grid gap-6 p-5 sm:p-6" onSubmit={handleSubmit}>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((label, index) => (
          <button
            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold ${
              index === step ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600"
            }`}
            key={label}
            onClick={() => setStep(index)}
            type="button"
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs ${index === step ? "bg-cyan-200 text-slate-950" : "bg-slate-100 text-slate-500"}`}>
              {index + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      <section className={step === 0 ? "block" : "hidden"}>
        <h2 className="text-lg font-semibold text-slate-950">基础信息</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>客户/店铺名称</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="customer" placeholder="公司或店铺名称" />
          </div>
          <div>
            <FieldLabel required>联系人</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="contact" placeholder="姓名" />
            <ErrorText>{errors.contact}</ErrorText>
          </div>
          <div>
            <FieldLabel required>手机 / 微信</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="phone" placeholder="手机号或微信号" />
            <ErrorText>{errors.phone}</ErrorText>
          </div>
          <div>
            <FieldLabel>平台</FieldLabel>
            <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="platform">
              <option>Amazon UK</option>
              <option>eBay UK</option>
              <option>TikTok Shop</option>
              <option>Shopify</option>
              <option>B2B 外贸</option>
            </select>
          </div>
        </div>
      </section>

      <section className={step === 1 ? "block" : "hidden"}>
        <h2 className="text-lg font-semibold text-slate-950">入库货物信息</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel required>预计到仓日期</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" min={today} name="eta" type="date" />
            <ErrorText>{errors.eta}</ErrorText>
          </div>
          <div>
            <FieldLabel required>运输方式</FieldLabel>
            <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="transport">
              <option value="">请选择</option>
              <option>快递</option>
              <option>卡车</option>
              <option>海运卡派</option>
              <option>空派</option>
              <option>自送</option>
            </select>
            <ErrorText>{errors.transport}</ErrorText>
          </div>
          <div>
            <FieldLabel>承运商 / 追踪号</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="tracking" placeholder="承运商、追踪号、车牌或提单号" />
          </div>
          <div>
            <FieldLabel required>箱数 / 托数</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" min="1" name="cartons" placeholder="例如：18" type="number" />
            <ErrorText>{errors.cartons}</ErrorText>
          </div>
          <div>
            <FieldLabel required>SKU 数量</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" min="1" name="skuCount" placeholder="例如：12" type="number" />
            <ErrorText>{errors.skuCount}</ErrorText>
          </div>
          <div>
            <FieldLabel required>主要品名 / SKU</FieldLabel>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="productName" placeholder="例如：家居配件 / SKU-A1001" />
            <ErrorText>{errors.productName}</ErrorText>
          </div>
          <div className="md:col-span-2">
            <FieldLabel>SKU 明细行</FieldLabel>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-[#0E7490]"
              name="skuLines"
              placeholder={"每行一个 SKU，例如：\nSKU-A1001, 收纳盒, 120, 6\nSKU-B2002, 挂钩套装, 80, 4"}
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">格式：SKU 编码，品名，预计数量，箱数。没有明细时可先填写 SKU 数量。</p>
          </div>
        </div>
      </section>

      <section className={step === 2 ? "block" : "hidden"}>
        <h2 className="text-lg font-semibold text-slate-950">服务要求与文件</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>需要的服务</FieldLabel>
            <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="service">
              <option>新货入仓</option>
              <option>FBA 中转</option>
              <option>退货入仓</option>
              <option>贴标/换标/质检/拍照</option>
              <option>补货/大货入仓</option>
            </select>
          </div>
          <div>
            <FieldLabel>特殊属性</FieldLabel>
            <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]" name="attribute">
              <option>普通货物</option>
              <option>带电</option>
              <option>液体/粉末</option>
              <option>食品/化妆品</option>
              <option>需人工确认</option>
            </select>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">附件上传入口</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">支持装箱单、SKU 清单、标签文件、物流面单、产品图片等资料。</p>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm">
              <FileUp size={16} /> 选择文件
              <input className="sr-only" multiple name="files" type="file" />
            </label>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">资料清单预勾选</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">如果资料已经准备好，可以先勾选。后续也可以到“补交资料”继续上传文件。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {inboundDocumentOptions.map((item) => (
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" key={item}>
                <input className="h-4 w-4 accent-[#0E7490]" name="documentTypes" type="checkbox" value={item} />
                {item}
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className={step === 2 ? "block" : "hidden"}>
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
          <input className="mt-1 h-4 w-4 rounded border-slate-300" name="confirm" type="checkbox" />
          我确认货物信息真实准确，并了解未预报或信息不完整可能影响上架时效。
        </label>
        <ErrorText>{errors.confirm}</ErrorText>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {step > 0 ? (
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:w-fit"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            type="button"
          >
            上一步
          </button>
        ) : null}
        {step < steps.length - 1 ? (
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white sm:w-fit"
            onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            type="button"
          >
            下一步
          </button>
        ) : (
          <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <PackageCheck size={16} />}
            {submitting ? "正在提交" : "提交入库预报"}
          </button>
        )}
      </div>
      <ErrorText>{submitError}</ErrorText>
    </form>
  );
}

export function TrackingLookup() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TrackingResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const keyword = String(formData.get("q") ?? query).trim();
    setError("");
    setSearched(true);
    setQuery(keyword);

    if (keyword.length < 2) {
      setError("请输入咨询编号、入库预报编号、手机号、微信号或追踪号。");
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/tracking?q=${encodeURIComponent(keyword)}`);
      const payload = (await response.json()) as { results?: TrackingResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "查询失败，请稍后再试。");
      setResults(payload.results ?? []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "查询失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form className="metric-card p-5 sm:p-6" onSubmit={handleSubmit}>
        <FieldLabel required>输入编号或联系方式</FieldLabel>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            className="min-h-12 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]"
            name="q"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：咨询编号 / 入库预报编号 / 手机号 / 追踪号"
            value={query}
          />
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            {loading ? "查询中" : "查询进度"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">支持查询已提交的报价需求和入库预报；如无法查询，请核对编号、手机号或追踪号。</p>
        <ErrorText>{error}</ErrorText>
      </form>

      {results.length > 0 ? (
        <div className="grid gap-4">
          {results.map((item) => (
            <div className="metric-card p-5" key={item.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-[#0E7490]">
                      {item.type === "inquiry" ? "报价需求" : "入库预报"}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-500">{item.id}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  <ClipboardCheck size={16} /> {item.status}
                </span>
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">下一步</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.nextAction}</p>
              </div>
              {item.documentChecklist ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">入库资料清单</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        核心资料 {item.documentChecklist.requiredReady}/{item.documentChecklist.requiredTotal}，全部资料 {item.documentChecklist.ready}/{item.documentChecklist.total}
                      </p>
                    </div>
                    {item.documentChecklist.missingRequired.length > 0 ? (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                        待补 {item.documentChecklist.missingRequired.length} 项
                      </span>
                    ) : (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">核心资料已齐</span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {item.documentChecklist.items.map((doc) => (
                      <div className={`rounded-md border p-3 text-sm ${doc.ready ? "border-emerald-200 bg-emerald-50 text-emerald-900" : doc.required ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`} key={doc.key}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{doc.label}</p>
                          <span className="text-xs font-semibold">{doc.ready ? "已记录" : doc.required ? "必补" : "建议"}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 opacity-80">{doc.matchedBy || doc.hint}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {item.timeline && item.timeline.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">系统时间线</p>
                  <div className="mt-3 grid gap-3">
                    {item.timeline.map((event) => (
                      <div className="grid grid-cols-[88px_1fr] gap-3 text-sm" key={event.id}>
                        <span className="font-mono text-xs text-slate-400">{shortDateTime(event.occurredAt)}</span>
                        <div className="relative border-l border-slate-200 pl-4 text-slate-600">
                          <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0E7490]" />
                          <p className="leading-6">{event.message}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {event.operator === "ops" ? "客服/运营更新" : event.operator === "customer" ? "客户补充" : "系统记录"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : searched && !loading && !error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 text-amber-700" size={20} />
            <div>
              <h2 className="text-sm font-semibold text-amber-900">暂未查到记录</h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">请检查编号、手机号或追踪号是否正确。刚提交的记录可能需要稍等片刻再查询。</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SupplementForm({ initialAsn = "" }: { initialAsn?: string }) {
  const [asn, setAsn] = useState(initialAsn);
  const [tracking, setTracking] = useState("");
  const [attachmentText, setAttachmentText] = useState("");
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; attachmentNames: string[]; savedFiles: number } | null>(null);

  function attachmentNames() {
    return attachmentText
      .split(/[\n,，]/)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError("");
    setSuccess(null);
    const id = asn.trim();
    const quickDocs = formData.getAll("documentTypes").map((item) => String(item).trim()).filter(Boolean);
    const names = Array.from(new Set([...attachmentNames(), ...quickDocs]));
    const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);

    if (!id) {
      setError("请填写入库预报编号。");
      return;
    }
    if (!tracking.trim() && names.length === 0 && files.length === 0 && !note.trim()) {
      setError("请至少补充追踪号、附件名称或备注说明。");
      return;
    }

    setSubmitting(true);
    try {
      const payloadData = new FormData();
      payloadData.set("id", id);
      payloadData.set("tracking", tracking.trim());
      payloadData.set("supplementNote", note.trim());
      names.forEach((name) => payloadData.append("attachmentNames", name));
      files.forEach((file) => payloadData.append("files", file));

      const response = await fetch("/api/supplements", {
        method: "POST",
        body: payloadData,
      });
      const payload = (await response.json()) as { id?: string; attachmentNames?: string[]; savedFiles?: number; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "补交失败，请稍后再试。");
      setSuccess({ id: payload.id, attachmentNames: payload.attachmentNames ?? [], savedFiles: payload.savedFiles ?? 0 });
      setTracking("");
      setAttachmentText("");
      setSelectedFileNames([]);
      setNote("");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "补交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="metric-card p-6">
        <CheckCircle2 size={34} className="text-emerald-600" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">资料已补交</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          入库预报 <span className="font-mono font-semibold text-slate-950">{success.id}</span> 已更新，当前已记录 {success.attachmentNames.length} 个附件。客户服务会继续核对资料完整性。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" href="/portal">
            返回客户工作台
          </Link>
          <button className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800" onClick={() => setSuccess(null)}>
            继续补交
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="metric-card grid gap-5 p-5 sm:p-6" onSubmit={handleSubmit}>
      <div>
        <FieldLabel required>入库预报编号</FieldLabel>
        <input
          className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]"
          name="asn"
          onChange={(event) => setAsn(event.target.value)}
          placeholder="例如：入库预报编号 / 追踪号"
          value={asn}
        />
      </div>

      <div>
        <FieldLabel>承运商 / 追踪号</FieldLabel>
        <input
          className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E7490]"
          name="tracking"
          onChange={(event) => setTracking(event.target.value)}
          placeholder="例如：DHL 123456789 / 车牌 / 提单号"
          value={tracking}
        />
      </div>

      <div>
        <FieldLabel>上传附件</FieldLabel>
        <label className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:bg-slate-100">
          <FileUp size={22} className="text-[#0E7490]" />
          <span className="mt-2 text-sm font-semibold text-slate-950">选择装箱单、外箱标签、EORI 授权或标签文件</span>
          <span className="mt-1 text-xs leading-5 text-slate-500">可多选，请上传与该入库单相关的装箱单、外箱标签、标签或物流资料。</span>
          <input
            className="sr-only"
            multiple
            name="files"
            onChange={(event) => setSelectedFileNames(Array.from(event.target.files ?? []).map((file) => file.name))}
            type="file"
          />
        </label>
        {selectedFileNames.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedFileNames.map((name) => (
              <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-[#0E7490]" key={name}>
                {name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <FieldLabel>资料类型快捷勾选</FieldLabel>
        <p className="mt-1 text-xs leading-5 text-slate-500">勾选后系统会把对应资料类型写入该入库预报，用于生成审核清单。</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {inboundDocumentOptions.map((item) => (
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" key={item}>
              <input className="h-4 w-4 accent-[#0E7490]" name="documentTypes" type="checkbox" value={item} />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>附件名称补充</FieldLabel>
        <textarea
          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-[#0E7490]"
          name="attachments"
          onChange={(event) => setAttachmentText(event.target.value)}
          placeholder="每行一个，例如：装箱单.xlsx、外箱标签照片.jpg、EORI授权.pdf"
          value={attachmentText}
        />
        <p className="mt-2 text-xs leading-5 text-slate-500">文件暂时不在手边时，也可以先填写文件名称或说明，客服会继续跟进。</p>
      </div>

      <div>
        <FieldLabel>补充说明</FieldLabel>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-[#0E7490]"
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder="例如：外箱标签已贴在每箱右上角，预计周五上午送达。"
          value={note}
        />
      </div>

      <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit" disabled={submitting} type="submit">
        {submitting ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
        {submitting ? "正在补交" : "提交补充资料"}
      </button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
