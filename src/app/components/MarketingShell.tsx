import Link from "next/link";
import Image from "next/image";
import { currentSurface, surfaceHref, type RuntimeSurface } from "@/lib/surfaceLinks";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Globe2,
  Home,
  Search,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";

const navGroups = [
  {
    label: "客户官网",
    items: [
      { href: surfaceHref("marketing", "/"), label: "首页" },
      { href: surfaceHref("marketing", "/services/warehousing"), label: "海外仓服务" },
      { href: surfaceHref("customer", "/portal"), label: "用户工作台" },
      { href: surfaceHref("marketing", "/news"), label: "新闻资讯" },
      { href: surfaceHref("marketing", "/about"), label: "关于我们" },
    ],
  },
  {
    label: "客户操作",
    items: [
      { href: surfaceHref("customer", "/login"), label: "客户登录" },
      { href: surfaceHref("customer", "/inquiry"), label: "提交需求" },
      { href: surfaceHref("customer", "/inbound"), label: "入库预报" },
      { href: surfaceHref("customer", "/skus"), label: "SKU 档案" },
      { href: surfaceHref("customer", "/outbound"), label: "出库申请" },
      { href: surfaceHref("customer", "/returns"), label: "退货预报" },
      { href: surfaceHref("customer", "/tracking"), label: "查进度" },
      { href: surfaceHref("customer", "/supplement"), label: "补交资料" },
    ],
  },
  {
    label: "内部后台",
    items: [
      { href: surfaceHref("admin", "/ops"), label: "运营后台" },
      { href: surfaceHref("admin", "/warehouse"), label: "仓库作业台" },
    ],
  },
];

export const warehouseAddress = {
  city: "Sheffield, South Yorkshire, UK",
  full: "Unit 16, The Old Mill, 682-686 Retford Rd, Sheffield S13 9WG, United Kingdom",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=Unit%2016%2C%20The%20Old%20Mill%2C%20682-686%20Retford%20Rd%2C%20Sheffield%20S13%209WG%2C%20United%20Kingdom",
};

const trackingLinks = [
  ["Royal Mail 查询", "https://www.royalmail.com/track-your-item#/"],
  ["Parcelforce 查询", "https://www.parcelforce.com/track-trace"],
  ["DPD 查询", "https://track.dpd.co.uk/"],
] as const;

const serviceDropdownItems = [
  { href: surfaceHref("marketing", "/services/first-mile"), label: "头程清关", note: "运输协同 / 清关资料 / 到仓衔接" },
  { href: surfaceHref("marketing", "/services/warehousing"), label: "仓储中转", note: "本地暂存 / 库存记录 / FBA 中转" },
  { href: surfaceHref("marketing", "/services/fulfillment"), label: "一件代发", note: "拣货复核 / 打包贴单 / 尾程交接" },
  { href: surfaceHref("marketing", "/services/prep"), label: "贴标换标", note: "FNSKU 贴标 / 分箱打托 / 换箱重包" },
  { href: surfaceHref("marketing", "/services/after-sales"), label: "售后维修", note: "退货质检 / 维修翻新 / 重上架处理" },
] as const;

export function MarketingHeader({ surface: surfaceOverride }: { surface?: RuntimeSurface } = {}) {
  const surface = surfaceOverride ?? currentSurface();
  const primaryNavItems = navGroups[0].items;

  return (
    <header className="marketing-site-header fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/16 text-white backdrop-blur-sm">
      <div className="site-header-inner">
        <Link className="site-header-brand" href={surface === "admin" ? surfaceHref("admin", "/ops") : surfaceHref("marketing", "/")}>
            <span className="brand-logo-mark brand-logo-mark-marketing">
              <Image alt="" height={80} src="/assets/uk-station-logo.png" width={80} />
            </span>
            <span className="site-header-brand-copy">
              <span className="block font-semibold tracking-tight text-slate-950">英国驿站</span>
              <span className="block text-xs text-slate-500 sm:text-sm">英国仓配 · 自营系统</span>
            </span>
        </Link>

        <nav className="site-header-nav">
          {primaryNavItems.map((item) =>
            item.label === "海外仓服务" ? (
              <div className="marketing-nav-menu" key={item.href}>
                <Link aria-haspopup="true" href={item.href}>
                  {item.label}
                </Link>
                <div className="marketing-service-dropdown">
                  {serviceDropdownItems.map((service) => (
                    <Link href={service.href} key={service.href}>
                      <span>{service.label}</span>
                      <small>{service.note}</small>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="site-header-right">
          <LanguageSwitcher tone="dark" />
        </div>

        <nav className="site-header-mobile-nav">
          {primaryNavItems.slice(0, 4).map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter({ surface: surfaceOverride }: { surface?: RuntimeSurface } = {}) {
  const surface = surfaceOverride ?? currentSurface();

  if (surface === "customer") {
    return (
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold text-slate-950">客户服务支持</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">入库资料、到仓进度、费用账单和异常处理都可以在客户工作台继续跟进。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={surfaceHref("customer", "/tracking")}>
              <Search size={16} /> 查进度
            </Link>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={surfaceHref("customer", "/supplement")}>
              <FileText size={16} /> 补交资料
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-slate-950">英国仓库地址</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{warehouseAddress.full}</p>
          <p className="mt-2 text-xs text-slate-500">仓库到访、送货和提货请提前预约。</p>
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-950">友情链接</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-sm text-slate-600">
              {trackingLinks.map(([label, href], index) => (
                <span className="inline-flex items-center gap-3" key={href}>
                  <a className="font-semibold text-[#0E7490] hover:text-[#0F766E]" href={href} rel="noreferrer" target="_blank">
                    {label}
                  </a>
                  {index < trackingLinks.length - 1 ? <span className="text-slate-300">|</span> : null}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PageShell({ children, surface }: { children: React.ReactNode; surface?: RuntimeSurface }) {
  const resolvedSurface = surface ?? currentSurface();

  return (
    <main className={`marketing-shell-fixed-header surface-${resolvedSurface} min-h-screen bg-[var(--background)] text-slate-950`}>
      <MarketingHeader surface={resolvedSurface} />
      {children}
      <MarketingFooter surface={resolvedSurface} />
    </main>
  );
}

export function PageHero({
  eyebrow,
  title,
  body,
  actions,
  surface: surfaceOverride,
  showPanel = true,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  actions?: React.ReactNode;
  surface?: RuntimeSurface;
  showPanel?: boolean;
}) {
  const surface = surfaceOverride ?? currentSurface();
  const heroPadding =
    surface === "marketing" && showPanel
      ? "px-4 py-8 text-white sm:px-6 sm:py-12 lg:grid-cols-[1fr_360px] lg:items-end lg:px-8 lg:py-16"
      : surface === "marketing"
        ? "px-4 py-8 text-white sm:px-6 sm:py-12 lg:px-8 lg:py-16"
      : "px-4 py-8 text-white sm:px-6 lg:grid-cols-[1fr_340px] lg:items-end lg:px-8 lg:py-10";
  const panel =
    surface === "customer"
      ? {
          eyebrow: "客户工作台",
          items: [
            ["业务状态", "资料、报价、异常优先处理"],
            ["货件进度", "预报、到仓、上架一屏查看"],
            ["费用账单", "费用来源和状态可核对"],
          ],
        }
      : surface === "admin"
        ? {
            eyebrow: "OPS CONTROL",
            items: [
              ["询盘队列", "新客户、报价、转入库"],
              ["仓库作业", "收货、上架、拣货、异常"],
              ["账单复核", "计费事件和客户确认"],
            ],
          }
        : {
            eyebrow: "英国仓服务核验",
            items: [
              ["中文客服", "报价、资料、异常统一跟进"],
              ["英国本地履约", "入仓、出库、退货、FBA"],
              ["费用可核对", "对应货件、订单和处理记录"],
            ],
          };

  return (
    <section className="hero-bg overflow-hidden">
      <div className={`mx-auto grid max-w-7xl gap-8 ${heroPadding}`}>
        <div>
          {eyebrow ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold backdrop-blur">
              <ShieldCheck size={16} />
              {eyebrow}
            </span>
          ) : null}
          <h1 className={`${eyebrow ? "mt-6 sm:mt-7" : ""} ${surface === "marketing" ? "text-[1.95rem] sm:text-5xl" : "text-[1.85rem] sm:text-4xl"} max-w-4xl font-semibold leading-[1.08] tracking-tight`}>{title}</h1>
          {body ? <p className="mt-5 max-w-2xl text-[0.96rem] leading-7 text-slate-100 sm:text-lg">{body}</p> : null}
          {actions ? <div className="hero-actions mt-7 grid gap-3 sm:flex sm:flex-wrap">{actions}</div> : null}
        </div>
        {showPanel ? <div className="hidden rounded-lg border border-white/15 bg-white/10 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur lg:block">
          <p className="text-xs font-semibold uppercase text-cyan-100">{panel.eyebrow}</p>
          <div className="mt-4 space-y-3">
            {panel.items.map(([label, value]) => (
              <div className="rounded-md border border-white/10 bg-white/8 p-3" key={label}>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{value}</p>
              </div>
            ))}
          </div>
        </div> : null}
      </div>
    </section>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-slate-800" href={href} prefetch={false}>
      {children} <ArrowRight size={16} />
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50" href={href} prefetch={false}>
      {children}
    </Link>
  );
}

export function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{body}</p>
    </div>
  );
}

export function InfoCard({
  title,
  body,
  icon: Icon = CheckCircle2,
  meta,
}: {
  title: string;
  body: string;
  icon?: typeof CheckCircle2;
  meta?: string;
}) {
  return (
    <div className="metric-card p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
          <Icon size={20} />
        </span>
        {meta ? <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{meta}</span> : null}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

export const serviceItems = [
  { title: "英国一件代发", body: "店铺出单后完成拣货、包装、贴单、称重、出库交接和追踪状态回传。适合 TikTok Shop、eBay、Shopify 等需要英国本地发货的卖家。", icon: Truck, meta: "订单履约" },
  { title: "FBA 中转补货", body: "支持 FNSKU 贴标、箱标、分箱、换箱、打托、预约 Amazon FC 和送仓交接。适合 Amazon UK 卖家做补仓、换箱和库存节奏管理。", icon: PackageCheck, meta: "Amazon UK" },
  { title: "退货换标质检", body: "接收英国本地退件，按规则拍照、质检、换标、重上架、转寄或销毁。适合需要英国 RMA 地址和退货二次处理的卖家。", icon: Building2, meta: "RMA" },
  { title: "仓储暂存与库存管理", body: "货物到仓后按 SKU 清点上架，库存数量和变动记录可查。适合旺季备货、小批量试仓和英国本地库存周转。", icon: Warehouse, meta: "库存" },
  { title: "质检拍照与异常处理", body: "对退货件、破损件、数量异常件拍照反馈，方便卖家判断重上架、转寄或销毁。适合少件、破损、标签异常等需要图片反馈的场景。", icon: ShieldCheck, meta: "异常" },
  { title: "英国本地尾程派送", body: "出库后交由 Royal Mail、FedEx、UPS 等英国本地尾程渠道派送，提供运单号和配送状态，适合一件代发到买家或批量转运。", icon: ReceiptText, meta: "尾程" },
];

export const trustSignals = [
  { title: "英国本地仓地址可核验", body: "可提供英国仓地址与到仓资料，用于英国履约、退货接收和 FBA 中转安排。", icon: MapPin },
  { title: "中文客服协同", body: "英国仓操作配合中文客服，处理入库、异常、退货、账单和资料补交。", icon: Globe2 },
  { title: "合规资料留痕", body: "VAT、EORI、授权文件、外箱标签、装箱单和进口资料都有留档状态。", icon: ShieldCheck },
  { title: "手机端跟进", body: "客户可在手机端查状态、确认异常、补交资料、查看账单。", icon: Home },
];
