import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, Globe2, PackageCheck, ShieldCheck } from "lucide-react";
import { PageShell } from "../components/MarketingShell";
import { surfaceHref } from "@/lib/surfaceLinks";

const aboutHighlights = [
  "英国本地仓储、履约、FBA 中转和退货处理一体衔接",
  "中文客服跟进报价、资料、异常、账单和后续开通",
  "自研系统记录入库、出库、退货、异常和费用节点",
  "适合试仓起量、多平台经营和需要英国本地售后的卖家",
];

const capabilityCards = [
  {
    title: "本地仓配",
    body: "货到英国后，收货、清点、上架、出库和尾程交接都有记录。",
    icon: PackageCheck,
  },
  {
    title: "中文协同",
    body: "报价、资料补交、异常说明和账单核对，用中文把关键节点说清楚。",
    icon: Globe2,
  },
  {
    title: "流程留痕",
    body: "入仓、退货、FBA、贴标和费用项目尽量对应到货件和处理记录。",
    icon: ClipboardCheck,
  },
  {
    title: "稳步放量",
    body: "先用小批量跑通流程，再根据数据决定库存、渠道和补货节奏。",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      <section className="about-premium-hero">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.92fr] lg:px-8 lg:py-16">
          <div className="self-center">
            <p className="section-eyebrow">公司简介</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              英国驿站，服务中国卖家的英国仓储、履约和售后中心。
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600">
              我们专注为跨境卖家提供英国本地仓配服务，把入仓、库存、出库、FBA 中转、退货处理和费用核对放在同一条清晰链路里，让您先跑通流程，再稳步放量。
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {aboutHighlights.map((item) => (
                <div className="flex gap-3 rounded-md border border-slate-200 bg-white/78 p-3 text-sm font-semibold leading-6 text-slate-800 shadow-sm" key={item}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#0E7490]" size={18} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="about-premium-image">
            <Image alt="英国驿站仓库操作现场" className="object-cover" fill priority sizes="(min-width: 1024px) 540px, 100vw" src="/assets/uk-warehouse-brand-control-desk.png" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-10 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8 lg:py-14">
        <div className="about-premium-panel">
          <p className="section-eyebrow">我们的团队</p>
          <h2>懂仓库，也懂中国卖家的沟通方式。</h2>
          <p>
            团队围绕仓储运营、跨境电商、客服协同和系统建设展开工作。我们更关心实际业务是否能落地：资料是否齐、仓库是否能接、费用是否能核对、异常是否有人继续跟进。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {capabilityCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="about-capability-card" key={card.title}>
                <Icon size={22} />
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="about-philosophy-band">
          <div>
            <p className="section-eyebrow">我们的理念</p>
            <h2>让英国仓配更清楚、更稳定。</h2>
          </div>
          <p>
            对正在试仓、起量或多平台经营的卖家来说，真正重要的不是一个低价标签，而是入仓、出库、退货、FBA 和费用核对能不能长期稳定运转。英国驿站希望成为您在英国市场可持续经营的本地协同伙伴。
          </p>
          <Link className="clean-primary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold text-white" href={surfaceHref("customer", "/inquiry")}>
            提交需求 <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
