import { Bot, CheckCircle2, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";
import { AIPlanAdvisor } from "../components/AIPlanAdvisor";
import { PageHero, PageShell, PrimaryLink, SecondaryLink, SectionTitle } from "../components/MarketingShell";
import { surfaceHref } from "@/lib/surfaceLinks";

const handoff: Array<{ title: string; body: string; icon: LucideIcon }> = [
  { title: "AI 先判断", body: "根据平台、阶段、月单量、FBA 和退货需求给出推荐方向。", icon: Bot },
  { title: "客服再复核", body: "正式报价、能否接收、入仓资料和异常处理由中文客服确认。", icon: MessageCircle },
  { title: "资料更清楚", body: "客户带着推荐方案提交需求，客服不用从零开始反复追问。", icon: CheckCircle2 },
];

const integrationRoadmap = [
  ["第一阶段", "人工 + 文件导入", "客户先用表单、CSV、SKU 表和装箱单提交需求，客服复核后进入仓库作业。适合先跑通真实业务。"],
  ["第二阶段", "店铺授权连接", "接 TikTok Shop、Shopify、eBay 等 OAuth 授权，拉取订单、SKU、收货地址和履约状态。"],
  ["第三阶段", "履约自动回传", "仓库出库后把承运商、追踪号、发货状态回传平台，同时保留异常人工确认。"],
  ["第四阶段", "内容与销售分析", "YouTube / TikTok 内容 API 用于看视频、达人或内容效果，不直接替代订单履约接口。"],
];

export default function AdvisorPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="AI 方案助手"
        title="先和 AI 聊几句，再让客服确认最适合的英国仓方案。"
        body="客户不一定知道该选一件代发、FBA 中转、退货处理还是小批量试仓。AI 先做预判断，中文客服再把费用、资料和入仓要求确认清楚。"
        actions={
          <>
            <PrimaryLink href="#ai-advisor">开始 AI 预评估</PrimaryLink>
            <SecondaryLink href={surfaceHref("customer", "/inquiry?service=trial")}>直接找客服</SecondaryLink>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section id="ai-advisor" className="scroll-mt-28">
          <AIPlanAdvisor />
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <SectionTitle
            eyebrow="AI + 客服"
            title="不是让 AI 替代客服，而是让客户更快说清需求"
            body="第一步用 AI 把客户的业务场景归类，第二步由客服复核报价和资料，既有智能入口，也保留人工服务的可信度。"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {handoff.map(({ title, body, icon: Icon }) => (
              <div className="metric-card p-5" key={title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-slate-950 p-5 text-white sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-cyan-200">平台 API 对接路线</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">先把业务跑通，再逐步接 TikTok、YouTube 和店铺 API</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                订单履约类 API 和内容分析类 API 要分开处理。TikTok Shop 更偏订单、商品、物流回传；YouTube 更偏内容、频道和数据分析，不能拿来直接做仓库履约。
              </p>
            </div>
            <div className="grid gap-3">
              {integrationRoadmap.map(([stage, title, body]) => (
                <div className="rounded-md border border-white/10 bg-white/6 p-4" key={stage}>
                  <p className="text-xs font-semibold text-cyan-100">{stage}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-[#0E7490] shadow-sm">
                <Sparkles size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0E7490]">产品定位</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">AI 做方案入口，客服做可信交付</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">这样既能显得更智能，也不会让客户担心无人负责。</p>
              </div>
            </div>
            <PrimaryLink href={surfaceHref("customer", "/inquiry?service=trial")}>提交给客服复核</PrimaryLink>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
