"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bot, MessageCircle, PackageCheck, Sparkles, X } from "lucide-react";
import { surfaceHref } from "@/lib/surfaceLinks";

const quickQuestions = [
  {
    label: "我做 TikTok 小件发货",
    title: "建议先看一件代发",
    body: "适合英国本地仓储、拣货复核、打包贴单、尾程交接和追踪号回传。客服会继续确认月单量、SKU、包材和尾程渠道。",
    href: "/inquiry?source=ai-concierge&service=fulfillment&platform=TikTok%20Shop%20UK&stage=stable-orders&aiIntent=TikTok%20%E5%B0%8F%E4%BB%B6%E4%B8%80%E4%BB%B6%E4%BB%A3%E5%8F%91%E6%96%B9%E6%A1%88",
  },
  {
    label: "我要补 Amazon FBA",
    title: "建议看 FBA 中转补仓",
    body: "适合 FNSKU 贴标、箱标、分箱、打托、预约送仓和从英国仓补货到 Amazon FC。",
    href: "/inquiry?source=ai-concierge&service=fba&platform=Amazon%20UK&stage=fba-restock&aiIntent=Amazon%20UK%20FBA%20%E4%B8%AD%E8%BD%AC%E8%A1%A5%E4%BB%93%E6%96%B9%E6%A1%88",
  },
  {
    label: "先小批量试仓",
    title: "建议先做试仓方案",
    body: "先用一小批货跑通入仓、出库、退货和费用核对，确认费用口径后再放量。",
    href: "/inquiry?source=ai-concierge&service=trial&stage=trial&aiIntent=%E5%B0%8F%E6%89%B9%E9%87%8F%E8%AF%95%E4%BB%93%E6%96%B9%E6%A1%88",
  },
  {
    label: "英国退货怎么处理",
    title: "建议看退货处理",
    body: "适合本地退件接收、拍照质检、换标重上架、转寄或销毁。客服会确认平台规则和处理标准。",
    href: "/inquiry?source=ai-concierge&service=returns&stage=returns&aiIntent=%E8%8B%B1%E5%9B%BD%E9%80%80%E8%B4%A7%E5%A4%84%E7%90%86%E6%96%B9%E6%A1%88",
  },
];

export function FloatingAIConcierge() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const answer = useMemo(() => quickQuestions[active], [active]);

  return (
    <div className="floating-ai-concierge fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-50 sm:bottom-6 sm:right-6">
      {open ? (
        <section className="floating-ai-panel mb-3 w-[calc(100vw-2rem)] max-w-[320px] overflow-hidden rounded-lg border border-cyan-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:mb-4 sm:max-w-[360px]">
          <div className="bg-slate-950 p-3 text-white sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-slate-950 sm:h-10 sm:w-10">
                  <Bot size={19} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-cyan-100">AI 专属客服</p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">先为您判断英国仓方案</h2>
                </div>
              </div>
              <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} type="button" aria-label="关闭 AI 客服">
                <X size={17} />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">AI 先做预判断，中文客服再复核报价、资料和能否接收。</p>
          </div>

          <div className="max-h-[58vh] overflow-y-auto p-3 sm:max-h-[66vh] sm:p-4">
            <div className="rounded-lg bg-cyan-50 p-3">
              <div className="flex gap-2">
                <Sparkles className="mt-0.5 shrink-0 text-[#0E7490]" size={17} />
                <p className="text-sm leading-6 text-slate-700">您可以先选一个最接近的情况，我们会给出推荐方向。</p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:mt-4">
              {quickQuestions.map((item, index) => (
                <button
                  className={`min-h-10 rounded-md border px-3 text-left text-sm font-semibold ${active === index ? "border-cyan-200 bg-cyan-50 text-[#0E7490]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  key={item.label}
                  onClick={() => setActive(index)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:mt-4 sm:p-4">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[#0E7490] shadow-sm">
                  <PackageCheck size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{answer.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{answer.body}</p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-3 mt-3 grid gap-2 border-t border-slate-100 bg-white/95 px-3 pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0">
              <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" href={surfaceHref("customer", answer.href)}>
                带着方案找客服确认 <ArrowRight size={16} />
              </Link>
              <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={surfaceHref("marketing", "/advisor")}>
                进入完整 AI 评估
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <button
        className="floating-ai-trigger group flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200 bg-slate-950 text-white shadow-[0_18px_50px_rgba(8,47,73,0.34)] ring-4 ring-cyan-100/60 transition hover:-translate-y-0.5 hover:bg-[#083344] sm:h-[4.35rem] sm:w-[4.35rem]"
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-label="打开 AI 专属客服"
      >
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-200 text-[9px] font-bold text-slate-950 sm:h-5 sm:w-5 sm:text-[10px]">AI</span>
        {open ? <X size={22} /> : <MessageCircle size={23} />}
      </button>
    </div>
  );
}
