"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, ClipboardList, FileText, MessageCircle, PackageCheck, RefreshCcw, Sparkles, Truck } from "lucide-react";
import { surfaceHref } from "@/lib/surfaceLinks";

type AdvisorState = {
  platform: string;
  stage: string;
  volume: string;
  fba: boolean;
  returns: boolean;
};

const platforms = ["Amazon UK", "TikTok Shop", "eBay UK", "Shopify", "B2B 外贸"];
const stages = [
  { value: "comparing", label: "还在比价" },
  { value: "trial", label: "想先小批量试仓" },
  { value: "ready", label: "已经准备发货" },
  { value: "selling", label: "已经稳定出单" },
  { value: "after-sales", label: "主要处理退货" },
];
const volumes = ["0-100 单/月", "100-500 单/月", "500-2000 单/月", "2000+ 单/月"];

function buildPlan(state: AdvisorState) {
  const isAmazon = state.platform === "Amazon UK";
  const isFulfillment = ["TikTok Shop", "eBay UK", "Shopify"].includes(state.platform) || state.stage === "selling";
  const serviceKey = state.returns && state.fba ? "returns-fba" : state.returns ? "returns" : state.fba || isAmazon ? "fba" : isFulfillment ? "fulfillment" : "trial";

  if (state.stage === "trial" || (state.volume === "0-100 单/月" && state.stage !== "selling")) {
    return {
      title: "小批量试仓方案",
      serviceKey: "trial",
      summary: "先用一小批货跑通入仓、出库、退货和账单核对，确认费用口径后再放量。",
      steps: ["确认品类、SKU、箱数和预计到仓时间", "准备装箱单、外箱标签和产品尺寸重量", "客服复核费用口径后再安排入仓"],
      tone: "emerald",
      icon: PackageCheck,
    };
  }

  if (serviceKey === "returns-fba") {
    return {
      title: "退货 + FBA 补仓组合方案",
      serviceKey,
      summary: "退货处理和 FBA 补仓需要拆成两条费用口径，分别确认质检换标、贴标分箱和送仓准备。",
      steps: ["确认退货接收、拍照质检和重上架规则", "确认 FNSKU、箱标、分箱、打托和送仓计划", "客服拆分报价，避免费用混在一起"],
      tone: "violet",
      icon: RefreshCcw,
    };
  }

  if (serviceKey === "returns") {
    return {
      title: "英国本地退货处理方案",
      serviceKey,
      summary: "适合需要英国本地退件接收、拍照质检、换标重上架、转寄或销毁的卖家。",
      steps: ["确认平台退货规则和退件接收方式", "确认质检、拍照、换标和处置标准", "客服给出退货处理单价和异常确认方式"],
      tone: "amber",
      icon: RefreshCcw,
    };
  }

  if (serviceKey === "fba") {
    return {
      title: "Amazon UK FBA 中转补仓方案",
      serviceKey,
      summary: "适合需要贴 FNSKU、换箱分箱、打托、预约送仓或从英国仓补货到 Amazon FC 的卖家。",
      steps: ["确认 FNSKU、箱标和 Amazon 送仓资料", "确认箱数、托盘、贴标、换箱和打托需求", "客服复核 FBA prep 和送仓相关费用"],
      tone: "sky",
      icon: Truck,
    };
  }

  if (serviceKey === "fulfillment") {
    return {
      title: "英国本地一件代发方案",
      serviceKey,
      summary: "适合 TikTok、Shopify、eBay 等店铺订单，需要仓储、拣货复核、打包贴单、尾程交接和追踪号回传。",
      steps: ["确认月单量、SKU 和订单来源", "确认包材、尾程渠道和追踪号回传方式", "客服按入仓、仓储、出库和尾程拆清报价"],
      tone: "cyan",
      icon: Truck,
    };
  }

  return {
    title: "先咨询，再确定服务组合",
    serviceKey: "trial",
    summary: "当前信息适合先由 AI 做预判断，再让中文客服确认能否接收、怎么入仓、费用由哪些项目组成。",
    steps: ["补充平台、品类、SKU 和首批货量", "说明是否涉及 FBA、退货或一件代发", "客服复核后输出正式方案"],
    tone: "slate",
    icon: ClipboardList,
  };
}

export function AIPlanAdvisor() {
  const [state, setState] = useState<AdvisorState>({
    platform: "Amazon UK",
    stage: "trial",
    volume: "0-100 单/月",
    fba: true,
    returns: false,
  });
  const plan = useMemo(() => buildPlan(state), [state]);
  const Icon = plan.icon;
  const inquiryHref = surfaceHref("customer", `/inquiry?service=${encodeURIComponent(plan.serviceKey)}`);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
            <Bot size={21} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#0E7490]">AI 方案助手</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">先聊几句，判断该选哪种英国仓方案</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">AI 先做预评估，中文客服再复核费用、资料和入仓可行性。</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">您主要在哪个平台销售？</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {platforms.map((platform) => (
                <button
                  className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${state.platform === platform ? "border-cyan-200 bg-cyan-50 text-[#0E7490]" : "border-slate-200 bg-white text-slate-700"}`}
                  key={platform}
                  onClick={() => setState((current) => ({ ...current, platform, fba: platform === "Amazon UK" }))}
                  type="button"
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">您现在处在哪个阶段？</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {stages.map((stage) => (
                <button
                  className={`min-h-11 rounded-md border px-3 text-left text-sm font-semibold ${state.stage === stage.value ? "border-cyan-200 bg-cyan-50 text-[#0E7490]" : "border-slate-200 bg-white text-slate-700"}`}
                  key={stage.value}
                  onClick={() => setState((current) => ({ ...current, stage: stage.value, returns: stage.value === "after-sales" ? true : current.returns }))}
                  type="button"
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">预计月单量是多少？</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {volumes.map((volume) => (
                <button
                  className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${state.volume === volume ? "border-cyan-200 bg-cyan-50 text-[#0E7490]" : "border-slate-200 bg-white text-slate-700"}`}
                  key={volume}
                  onClick={() => setState((current) => ({ ...current, volume }))}
                  type="button"
                >
                  {volume}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
              <input checked={state.fba} className="h-4 w-4 accent-[#0E7490]" onChange={(event) => setState((current) => ({ ...current, fba: event.target.checked }))} type="checkbox" />
              需要 FBA 中转 / 补仓
            </label>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
              <input checked={state.returns} className="h-4 w-4 accent-[#0E7490]" onChange={(event) => setState((current) => ({ ...current, returns: event.target.checked }))} type="checkbox" />
              需要退货接收 / 换标
            </label>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-lg bg-slate-950 p-5 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(103,232,249,0.2),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-md border border-cyan-200/25 bg-cyan-100/10 px-3 py-2 text-sm font-semibold text-cyan-100">
            <Sparkles size={16} />
            AI 推荐结果
          </div>
          <div className="mt-6 rounded-lg border border-white/12 bg-white/8 p-5 backdrop-blur">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-cyan-200 text-slate-950">
              <Icon size={22} />
            </span>
            <h3 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">{plan.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">{plan.summary}</p>
          </div>

          <div className="mt-4 grid gap-3">
            {plan.steps.map((step, index) => (
              <div className="flex gap-3 rounded-md border border-white/10 bg-white/5 p-4" key={step}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-sm font-semibold text-slate-950">{index + 1}</span>
                <p className="text-sm leading-6 text-slate-200">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-emerald-200/25 bg-emerald-300/10 p-4">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-200" size={18} />
              <p className="text-sm leading-6 text-emerald-50">AI 只做预判断，正式报价、能否接收、入仓资料和异常规则会由中文客服复核。</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100" href={inquiryHref}>
              带着方案找客服确认 <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10" href={surfaceHref("marketing", "/pricing")}>
              先看费用结构 <FileText size={16} />
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <MessageCircle className="text-cyan-100" size={20} />
            <p className="text-sm leading-6 text-slate-300">客服会看到您选择的方向，再继续确认 SKU、箱数、尺寸重量、标签和到仓时间。</p>
          </div>
        </div>
      </section>
    </div>
  );
}
