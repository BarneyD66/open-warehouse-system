"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Globe2,
  Home,
  Layers3,
  LayoutDashboard,
  LogIn,
  type LucideIcon,
  MapPin,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { newsArticles } from "./news/data";
import { currentSurface, surfaceHref } from "@/lib/surfaceLinks";

type SiteLanguage = "zh" | "en";

function useSiteLanguage() {
  const [language, setLanguage] = useState<SiteLanguage>(() => {
    if (typeof window === "undefined") return "zh";
    const saved = window.localStorage.getItem("uk-station-language");
    return saved === "en" ? "en" : "zh";
  });

  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const next = (event as CustomEvent<SiteLanguage>).detail;
      setLanguage(next === "en" ? "en" : "zh");
    };

    window.addEventListener("uk-station-language-change", syncLanguage);
    return () => window.removeEventListener("uk-station-language-change", syncLanguage);
  }, []);

  return language;
}

const views = [
  { id: "site", label: "客户官网", icon: Home },
  { id: "customer", label: "客户工作台", icon: LayoutDashboard },
  { id: "warehouse", label: "海外仓后台", icon: Warehouse },
  { id: "model", label: "内部数据蓝图", icon: Layers3 },
  { id: "roadmap", label: "实施计划", icon: ClipboardCheck },
] as const;

const homeNavGroups = [
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
    ],
  },
  {
    label: "内部后台",
    items: [{ href: surfaceHref("admin", "/ops"), label: "运营后台" }],
  },
];

type ViewId = (typeof views)[number]["id"];
type Tone = "good" | "warn" | "danger" | "info" | "neutral";
type ServiceAccent = "cyan" | "slate" | "emerald" | "amber" | "indigo" | "rose";

const platformBadges = ["Amazon UK", "eBay UK", "TikTok Shop", "Temu", "Shopify", "B2B 外贸"];

const premiumProofs = [
  "英国仓地址可核验",
  "中文客服",
  "退货拍照质检",
  "FBA 贴标补仓",
  "库存状态可查",
  "账单明细可核对",
  "尾程渠道可选",
  "新客户可试仓",
];

const industryServiceCards: Array<{
  title: string;
  body: string;
  meta: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "入仓资料与到仓协同",
    body: "发货前确认 SKU、装箱单、外箱标签、预计到仓时间和运输信息，减少无预报和资料缺失。",
    meta: "入仓预报",
    href: surfaceHref("customer", "/inbound"),
    icon: ClipboardCheck,
  },
  {
    title: "英国海外仓储",
    body: "货到英国仓后完成清点、拍照、上架和库存记录，适合热销 SKU 前置备货。",
    meta: "库存上架",
    href: surfaceHref("marketing", "/services"),
    icon: Warehouse,
  },
  {
    title: "一件代发",
    body: "店铺出单后完成拣货、复核、打包、贴单和追踪号回传，承接英国本地订单。",
    meta: "订单履约",
    href: surfaceHref("marketing", "/services"),
    icon: Truck,
  },
  {
    title: "退货质检与换标",
    body: "英国退件到仓后可按规则拍照、质检、换标、重上架、转寄或销毁。",
    meta: "退货处理",
    href: surfaceHref("customer", "/inquiry?service=returns"),
    icon: RefreshCcw,
  },
  {
    title: "FBA 中转补仓",
    body: "支持 FNSKU 贴标、箱标、分箱、换箱、打托和 Amazon UK 送仓准备。",
    meta: "FBA Prep",
    href: surfaceHref("customer", "/inquiry?service=fba"),
    icon: PackageCheck,
  },
  {
    title: "费用账单核对",
    body: "仓储、出库、退货、包材和增值服务分别列明，便于月结对账。",
    meta: "账单透明",
    href: surfaceHref("marketing", "/pricing"),
    icon: ReceiptText,
  },
];

const industryProcess = [
  ["1", "提交需求", "平台、品类、SKU、货量"],
  ["2", "确认报价", "仓储、出库、退货、FBA"],
  ["3", "准备入仓", "装箱单、标签、预计到仓"],
  ["4", "货到英国仓", "收货、清点、上架"],
  ["5", "日常履约", "发货、退货、对账"],
];

const homepageConversionCards: Array<{
  title: string;
  body: string;
  badge: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "先小批量跑通流程",
    body: "首批货可以先验证入仓、出库、退货和账单核对，再决定是否扩大备货。",
    badge: "适合新客户",
    href: surfaceHref("customer", "/inquiry?service=trial"),
    icon: Warehouse,
  },
  {
    title: "按平台给履约建议",
    body: "Amazon UK、TikTok Shop、eBay、Shopify 和外贸客户的重点不同，先按渠道确认服务组合。",
    badge: "平台方案",
    href: surfaceHref("marketing", "/services"),
    icon: ShoppingCart,
  },
  {
    title: "报价前先把费用拆清",
    body: "仓储、入库、出库、退货、FBA、包材和尾程分开说明，合作前先知道费用来自哪里。",
    badge: "费用透明",
    href: surfaceHref("marketing", "/pricing"),
    icon: ReceiptText,
  },
];

const premiumExperienceCards = [
  {
    title: "先确认能不能接住您的货",
    body: "英国仓现场、处理场景和状态记录放在前面，合作前先判断服务是否适合。",
    image: "/assets/uk-warehouse-exterior.png",
    meta: "英国仓现场",
    icon: Warehouse,
  },
  {
    title: "费用和状态放在台面上",
    body: "把仓储、出库、退货、FBA 和账单核对讲清楚，降低客户第一次合作的不确定感。",
    image: "/assets/uk-warehouse-premium-billing-desk.png",
    meta: "Cost clarity",
    icon: ReceiptText,
  },
  {
    title: "移动端也能完成关键动作",
    body: "客户后续可以在手机上查进度、补资料、看库存和确认异常，不依赖反复私聊。",
    image: "/assets/uk-warehouse-mobile-dashboard.png",
    meta: "Mobile ready",
    icon: LayoutDashboard,
  },
];

const focusedWarehouseAdvantages: Array<{
  title: string;
  body: string;
  proof: string;
  icon: LucideIcon;
}> = [
  {
    title: "更适合试仓和起量阶段",
    body: "您不需要一开始就把货量做得很大。先用小批量跑通入仓、出库、退货和账单，再决定是否扩大备货。",
    proof: "先试流程，再放量",
    icon: PackageCheck,
  },
  {
    title: "沟通链路更短",
    body: "报价、资料、异常和账单由中文客服统一跟进，减少多层工单和反复转述，问题更容易说清楚。",
    proof: "中文客服直连业务",
    icon: Users,
  },
  {
    title: "非标细节更愿意处理",
    body: "换标、拍照、退货质检、FBA 补仓、样品转寄和小批量外贸履约，更需要有人愿意逐件确认。",
    proof: "适合多 SKU 和细活",
    icon: RefreshCcw,
  },
  {
    title: "费用来源更容易核对",
    body: "我们把仓储、入库、出库、退货、FBA 和包材拆开说明，让客户知道钱花在哪个动作上。",
    proof: "先讲口径，再报价",
    icon: ReceiptText,
  },
];

const brandImageScenes: Array<{
  title: string;
  body: string;
  image: string;
  meta: string;
  icon: LucideIcon;
  size: "large" | "wide" | "small";
}> = [
  {
    title: "英国仓现场 + 系统状态",
    body: "货物到仓后，收货、上架、库存和异常状态都能按节点跟进。",
    image: "/assets/uk-warehouse-brand-hero.png",
    meta: "仓库现场",
    icon: Warehouse,
    size: "large",
  },
  {
    title: "费用和库存可核对",
    body: "按入库、出库、退货和包材说明账单来源。",
    image: "/assets/uk-warehouse-billing.png",
    meta: "费用清晰",
    icon: ReceiptText,
    size: "small",
  },
  {
    title: "退货、换标、FBA 细节可处理",
    body: "细节业务需要可拍照、可确认、可追踪。",
    image: "/assets/uk-warehouse-brand-returns-fba.png",
    meta: "退货/FBA",
    icon: RefreshCcw,
    size: "small",
  },
  {
    title: "先试仓，再放量",
    body: "适合起量阶段、多 SKU、多平台和需要中文跟进的卖家。",
    image: "/assets/uk-warehouse-brand-trial-workflow.png",
    meta: "试仓流程",
    icon: PackageCheck,
    size: "wide",
  },
];

const sellerScenarios: Array<{ title: string; pain: string; service: string; href: string; icon: LucideIcon }> = [
  {
    title: "Amazon UK 卖家",
    pain: "需要 FBA 补仓更灵活，退货能回到英国本地处理。",
    service: "FBA 中转、FNSKU 贴标、打托送仓、退货换标、库存节奏管理。",
    href: surfaceHref("customer", "/inquiry?service=Amazon%20UK"),
    icon: PackageCheck,
  },
  {
    title: "TikTok Shop 英国卖家",
    pain: "爆单后最怕发货慢、退货乱、异常确认靠微信追。",
    service: "英国本地一件代发、订单波次、尾程交运、退货质检与异常确认。",
    href: surfaceHref("customer", "/inquiry?service=TikTok%20Shop"),
    icon: ShoppingCart,
  },
  {
    title: "eBay / Shopify 卖家",
    pain: "多平台订单分散，需要一个稳定的英国仓发货节点。",
    service: "订单导入、库存锁定、拣货打包、追踪号回传、账单对账。",
    href: surfaceHref("customer", "/inquiry?service=Multi-channel"),
    icon: Globe2,
  },
  {
    title: "B2B 外贸小批量客户",
    pain: "样品、备货、本地转运和退货接收需要在英国有落点。",
    service: "小批量暂存、样品派送、本地转运、退货接收、定制化处理。",
    href: surfaceHref("customer", "/inquiry?service=B2B"),
    icon: Truck,
  },
];

const sellerPainPoints: Array<{
  pain: string;
  worry: string;
  answer: string;
  href: string;
  cta: string;
  icon: LucideIcon;
}> = [
  {
    pain: "不知道先准备什么",
    worry: "SKU、装箱单、外箱标签、VAT/EORI、ETA 信息散在聊天里，到仓后才发现缺资料。",
    answer: "先按入库预报把资料一次列清楚，到仓前预审，减少无预报、标签不清和资料缺失。",
    href: surfaceHref("customer", "/inquiry?service=trial"),
    cta: "看入仓步骤",
    icon: ClipboardCheck,
  },
  {
    pain: "怕费用后面不断加项",
    worry: "仓储、入库、出库、包材、尾程、退货和 FBA prep 混在一起，很难判断真实成本。",
    answer: "费用按入库、仓储、出库、退货、尾程和 FBA 分开说明，合作后每笔费用关联订单、ASN 或处理记录。",
    href: surfaceHref("marketing", "/pricing"),
    cta: "看费用说明",
    icon: ReceiptText,
  },
  {
    pain: "退货和换标最容易失控",
    worry: "退件到了英国后不知道能不能二次销售，换标、拍照、重上架、转寄都需要来回确认。",
    answer: "退货到仓后按规则拍照质检，客户确认后再换标、重上架、转寄、销毁或转 FBA。",
    href: surfaceHref("customer", "/inquiry?service=returns"),
    cta: "咨询退货处理",
    icon: RefreshCcw,
  },
  {
    pain: "旺季补仓和断货风险高",
    worry: "Amazon UK 库存不足、FBA 入仓排队、头程周期长，爆单时容易断货或错过销售窗口。",
    answer: "先把货放在英国仓，按库存节奏分批补 FBA 或转本地一件代发，降低断货风险。",
    href: surfaceHref("customer", "/inquiry?service=fba"),
    cta: "规划 FBA 补仓",
    icon: PackageCheck,
  },
  {
    pain: "担心服务商不透明",
    worry: "低价承诺很多，但地址、流程、账单、异常照片和库存记录都不清楚。",
    answer: "把仓库地址、资料要求、作业节点、异常照片和费用来源放到客户可查的流程里。",
    href: surfaceHref("customer", "/inquiry?service=trial"),
    cta: "先提交需求",
    icon: ShieldCheck,
  },
  {
    pain: "多平台库存和订单容易乱",
    worry: "Amazon、eBay、TikTok Shop、Shopify 订单分散，库存占用和发货状态容易不同步。",
    answer: "先用表格/手工流程跑通 SKU、库存、订单和退货，订单稳定后再评估平台接口对接。",
    href: surfaceHref("marketing", "/services"),
    cta: "看多平台服务",
    icon: Layers3,
  },
];

const trialOffers: Array<{
  title: string;
  badge: string;
  body: string;
  note: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "新客户试仓计划",
    badge: "首月仓储费可减免",
    body: "适合第一次把货放到英国仓的卖家，先用小批量库存验证入仓、发货、退货和账单流程。",
    note: "入库、尾程、包材和增值服务按实际业务确认。",
    href: surfaceHref("customer", "/inquiry?service=trial"),
    icon: Warehouse,
  },
  {
    title: "小批量入仓测试",
    badge: "低门槛开始",
    body: "不强迫一开始大批量入仓，先看品类、SKU、退货比例和订单节奏，再决定后续备货规模。",
    note: "适合 TikTok Shop、eBay、Shopify 和外贸样品客户。",
    href: surfaceHref("customer", "/inquiry?service=small-batch"),
    icon: Boxes,
  },
  {
    title: "费用结构诊断",
    badge: "先算清再合作",
    body: "先为您拆清仓储、入库、出库、退货、尾程和 FBA prep 可能产生的费用项。",
    note: "减少合作后才发现隐藏成本的情况。",
    href: surfaceHref("marketing", "/pricing"),
    icon: ReceiptText,
  },
  {
    title: "退货/FBA 方案评估",
    badge: "按场景报价",
    body: "退货质检、换标重上架、FBA 补仓、打托送仓都先按实际规则确认处理方式。",
    note: "适合 Amazon UK 和有英国本地退货需求的卖家。",
    href: surfaceHref("customer", "/inquiry?service=returns-fba"),
    icon: RefreshCcw,
  },
];

const premiumServicePanorama = [
  {
    title: "海外仓储",
    caption: "前置库存",
    body: "SKU、箱数、库位、可售库存和异常记录先在英国侧沉淀清楚。",
    image: "/assets/uk-warehouse-storage-putaway.png",
    icon: Warehouse,
  },
  {
    title: "一件代发",
    caption: "本地履约",
    body: "订单产生后完成拣货、复核、打包、贴单和尾程交接。",
    image: "/assets/uk-warehouse-pick-pack.png",
    icon: Truck,
  },
  {
    title: "退货处理",
    caption: "售后闭环",
    body: "退件到仓后按规则质检、拍照、换标、重上架或转寄。",
    image: "/assets/uk-warehouse-return-inspection.png",
    icon: RefreshCcw,
  },
  {
    title: "FBA 补仓",
    caption: "库存节奏",
    body: "按销售节奏分批贴标、打托、补仓，减少断货和库存压力。",
    image: "/assets/uk-warehouse-fba-prep.png",
    icon: PackageCheck,
  },
];

const premiumWorkflowFrames = [
  ["01", "发来需求", "平台、品类、SKU、月单量先说清楚"],
  ["02", "确认方案", "服务范围、费用口径、试仓方式先确认"],
  ["03", "入仓预报", "装箱单、外箱标签、ETA 和追踪号提前准备"],
  ["04", "英国履约", "入库、上架、发货、退货和 FBA 按节点推进"],
  ["05", "对账复盘", "费用来源、异常记录和下批备货一起核对"],
];

const heroMetrics = [
  { label: "仓库证明", value: "地址可核验", note: "适合本地发货、退货接收和 FBA 中转" },
  { label: "客户对接", value: "中文客服", note: "报价、资料、异常和账单统一跟进" },
  { label: "服务范围", value: "仓配退补", note: "入仓、上架、出库、退货、FBA" },
];

const primaryActions: Array<{ stage: string; title: string; desc: string; href: string; icon: LucideIcon; cta: string; highlight?: boolean }> = [
  {
    stage: "还在比价",
    title: "先把费用算清楚",
    desc: "按平台、月单量、库存体积、退货和 FBA 需求，先判断是否适合入仓。",
    href: surfaceHref("marketing", "/pricing"),
    icon: ReceiptText,
    cta: "开始估算",
    highlight: true,
  },
  {
    stage: "想确认能不能做",
    title: "让客服判断能不能做",
    desc: "提交平台、品类、月单量和服务需求，先确认服务口径和报价范围。",
    href: surfaceHref("customer", "/inquiry"),
    icon: FileText,
    cta: "提交需求",
  },
  {
    stage: "准备发货",
    title: "我有货要入仓",
    desc: "提交入库预报，补齐装箱单、外箱标签、追踪号和预约信息。",
    href: surfaceHref("customer", "/inbound"),
    icon: PackageCheck,
    cta: "创建预报",
  },
  {
    stage: "已经提交过",
    title: "登录查看进度和待处理事项",
    desc: "进入客户工作台后，查看当前状态、补资料和下一步。",
    href: surfaceHref("customer", "/portal"),
    icon: Search,
    cta: "登录查看",
  },
  {
    stage: "已注册客户日常运营",
    title: "登录查看库存",
    desc: "已注册客户登录后查看库存、订单、账单、异常和需要补交的资料。",
    href: surfaceHref("customer", "/login"),
    icon: LayoutDashboard,
    cta: "客户登录",
  },
];

const homeServiceScenes = [
  {
    title: "入仓收货与上架",
    body: "货到英国仓后按预报核对箱数、SKU、装箱单和外箱标签，异常可拍照反馈。",
    image: "/assets/uk-warehouse-hero.png",
    href: surfaceHref("marketing", "/services"),
  },
  {
    title: "订单拣货与打包",
    body: "店铺出单后完成拣货、复核、称重、贴单和尾程交接，适合英国本地一件代发。",
    image: "/assets/uk-warehouse-billing.png",
    href: surfaceHref("marketing", "/services"),
  },
  {
    title: "FBA 中转与补货",
    body: "按补货需求进行分箱、贴标、打托和送仓准备，帮助卖家更灵活安排库存。",
    image: "/assets/uk-warehouse-fba-prep.png",
    href: surfaceHref("marketing", "/services"),
  },
  {
    title: "退货质检与换标",
    body: "英国退件到仓后，可按指令拍照、质检、换标、重上架、转寄或销毁。",
    image: "/assets/uk-warehouse-support.png",
    href: surfaceHref("marketing", "/services"),
  },
];

const pageArchitecture: Array<{
  title: string;
  audience: string;
  purpose: string;
  routes: string[];
  href: string;
  cta: string;
  icon: LucideIcon;
  tone: Tone;
}> = [
  {
    title: "客户看到的公开官网",
    audience: "新客户 / 还没登录的中国卖家",
    purpose: "建立信任，讲清服务范围、费用结构和入仓流程，引导客户估价或提交询盘。",
    routes: ["/", "/services", "/pricing", "/help", "/inquiry"],
    href: surfaceHref("marketing", "/services"),
    cta: "查看客户官网",
    icon: Globe2,
    tone: "info",
  },
  {
    title: "客户登录后的工作台",
    audience: "已合作客户 / 正在发货或已提交资料的卖家",
    purpose: "客户登录后查看报价、补资料、创建入库预报、查进度、查看库存和账单。",
    routes: ["/login", "/portal", "/inquiry", "/inbound", "/tracking", "/supplement"],
    href: surfaceHref("customer", "/login"),
    cta: "登录工作台",
    icon: LayoutDashboard,
    tone: "good",
  },
  {
    title: "海外仓管理后台",
    audience: "我们内部客服、运营、仓库和财务",
    purpose: "内部处理询盘报价、入库预报审核、缺资料队列、追踪号补充和后续仓库作业。",
    routes: ["/ops", "后续仓库作业台"],
    href: surfaceHref("admin", "/ops"),
    cta: "进入运营后台",
    icon: Warehouse,
    tone: "warn",
  },
];

const inboundRequirements = [
  ["先建 SKU", "SKU、品名、条码、图片、尺寸重量和申报信息必须能对应到箱内货。"],
  ["再做入库预报", "填写箱数/托数、预计到仓、承运商、追踪号和服务需求。"],
  ["贴好外箱标签", "仓库按外箱标签识别批次，无预报或标签不清会进入异常。"],
  ["预约送仓", "送货、提货、到访都需要提前确认时间窗口和联系人。"],
  ["差异在线确认", "少货、多货、破损、无标签、资料缺失都会生成待处理事项。"],
];

const services: Array<{
  title: string;
  subtitle: string;
  desc: string;
  icon: LucideIcon;
  metric: string;
  client: string;
  warehouse: string;
  flow: string[];
  href: string;
  cta: string;
  accent: ServiceAccent;
}> = [
  {
    title: "到仓前协同",
    subtitle: "头程到英国仓不失控",
    desc: "确认发货方式、外箱标签、装箱单、ETA、VAT/EORI 资料和送仓预约，降低到仓后异常。",
    icon: Globe2,
    metric: "入仓准备",
    client: "准备外箱标签、装箱单、承运商信息和预计到仓时间。",
    warehouse: "提前建预报，核对资料，安排收货窗口和异常口径。",
    flow: ["资料预审", "入库预报", "预约送仓"],
    href: surfaceHref("customer", "/inbound"),
    cta: "创建入库预报",
    accent: "cyan",
  },
  {
    title: "英国海外仓储",
    subtitle: "收货、上架、库位和库存",
    desc: "货物到英国仓后完成收货验收、差异登记、库位上架、库存流水和库存预警。",
    icon: Warehouse,
    metric: "库存可视",
    client: "提交 SKU、箱数、托数、申报信息和服务要求。",
    warehouse: "按预报收货，拍照留痕，上架后生成可售库存。",
    flow: ["到仓验收", "差异处理", "库存上架"],
    href: surfaceHref("marketing", "/services"),
    cta: "查看仓储服务",
    accent: "slate",
  },
  {
    title: "一件代发服务",
    subtitle: "多平台订单本地履约",
    desc: "承接 Amazon、eBay、TikTok Shop、Shopify 等订单，完成拣货、复核、打包、交运和追踪号回传。",
    icon: ShoppingCart,
    metric: "订单履约",
    client: "导入订单或提交发货指令，确认渠道和包材要求。",
    warehouse: "锁库存、拣货复核、称重出库，并沉淀费用事件。",
    flow: ["订单校验", "拣货打包", "追踪回传"],
    href: surfaceHref("customer", "/inquiry?service=fulfillment"),
    cta: "查看履约流程",
    accent: "emerald",
  },
  {
    title: "尾程配送服务",
    subtitle: "英国本地派送与追踪",
    desc: "按包裹重量、尺寸和时效要求匹配 Royal Mail、Parcelforce、DPD 等尾程方案，支持追踪与异常跟进。",
    icon: Truck,
    metric: "本地派送",
    client: "选择时效、保险、签收和派送偏好。",
    warehouse: "生成面单，交接承运商，回传追踪号和派送状态。",
    flow: ["渠道匹配", "面单交接", "派送追踪"],
    href: surfaceHref("customer", "/portal"),
    cta: "登录查看",
    accent: "amber",
  },
  {
    title: "FBA 补仓中转",
    subtitle: "贴标、换箱、打托、送仓",
    desc: "支持 FNSKU 贴标、箱标、换箱、打托、装箱要求和发往 Amazon FC 的中转处理。",
    icon: Boxes,
    metric: "Amazon UK",
    client: "提供 FBA 货件计划、标签、箱规和送仓要求。",
    warehouse: "按 Amazon 要求处理外箱、标签、托盘和交仓资料。",
    flow: ["贴标换箱", "打托复核", "预约交仓"],
    href: surfaceHref("customer", "/inquiry?service=FBA%20Prep"),
    cta: "获取 FBA 方案",
    accent: "indigo",
  },
  {
    title: "退货与定制服务",
    subtitle: "质检、换标、拍照和 B2B",
    desc: "退件到仓后拍照质检，支持重上架、换标、销毁、转寄、本地转运和合同物流需求。",
    icon: RefreshCcw,
    metric: "增值服务",
    client: "确认退货处理规则、照片要求、换标规则和最终去向。",
    warehouse: "按工单执行质检、换标、重入库、销毁或转寄。",
    flow: ["退件识别", "质检拍照", "处理确认"],
    href: surfaceHref("customer", "/inquiry?service=Return%20%26%20Value-added"),
    cta: "提交退货需求",
    accent: "rose",
  },
];

const trustItems = [
  { label: "英国仓地址可核验", desc: "完整仓库地址可用于客户核验，适合本地履约、退货接收和 FBA 中转。", icon: MapPin },
  { label: "中文客服承接日常沟通", desc: "入库资料、异常、退货、账单用中文协同，减少跨时区沟通成本。", icon: Users },
  { label: "入仓资料和合规留痕", desc: "VAT/EORI、授权文件、外箱标签、装箱单和变更记录有据可查。", icon: ShieldCheck },
  { label: "库存与费用来源清楚", desc: "库存变化、出库操作和费用事件关联到入库单、订单和包裹。", icon: BarChart3 },
];

const workflow = [
  ["01", "提交需求/获取报价", "先确认平台、品类、货量、服务范围和费用结构。"],
  ["02", "建商品与 SKU", "准备 SKU、品名、条码、图片、尺寸重量和申报资料。"],
  ["03", "创建入库预报", "上传装箱单、外箱标签、预计到仓、运输方式和服务要求。"],
  ["04", "到仓验收/上架", "仓库核对预报、登记差异、上架为可售库存。"],
  ["05", "订单/退货/FBA", "订单履约、退货质检、FBA 贴标补仓进入对应流程。"],
  ["06", "费用对账", "费用关联入库单、订单、SKU、包裹和增值服务。"],
];

const mobileActions = [
  { title: "查库存", value: "328 SKU", desc: "可售、锁定、在途一屏看清", tone: "good" as Tone },
  { title: "确认异常", value: "6 件", desc: "入库差异、地址问题、退货质检", tone: "danger" as Tone },
  { title: "补交资料", value: "2 项", desc: "外箱标签、装箱单、EORI 授权", tone: "warn" as Tone },
  { title: "看账单", value: "£2,846", desc: "费用来源与待确认金额", tone: "info" as Tone },
];

const pricingRules: Array<{ title: string; desc: string; trigger: string; icon: LucideIcon }> = [
  { title: "仓储费", desc: "按 SKU、体积、库龄或托盘占用计费，支持低库存和滞销提醒。", trigger: "每日库存快照", icon: Warehouse },
  { title: "入库处理费", desc: "按箱、托、SKU 或差异处理计费，差异件必须关联照片和收货记录。", trigger: "ASN 收货上架", icon: PackageCheck },
  { title: "出库操作费", desc: "按订单、件数、包材、称重和面单生成计费，跟踪号可回传。", trigger: "订单出库确认", icon: Truck },
  { title: "退货/FBA 增值费", desc: "退货质检、换标、拍照、销毁、FBA prep、打托等按事件计费。", trigger: "客户确认处理", icon: RefreshCcw },
];

const integrationStages = [
  ["快速开始", "CSV / Excel / 手工录入", "客户可以先用表格导入订单、SKU 和入库资料，不用等平台接口。"],
  ["订单量稳定后", "Shopify / 订单 API", "独立站订单量稳定后再做自动同步，减少人工处理。"],
  ["后续扩展", "Amazon / eBay / TikTok / 承运商", "按客户渠道优先级逐步接平台和 Royal Mail、Parcelforce、DPD 等尾程服务。"],
];

const customerFlows = [
  { title: "创建入库预报", desc: "填 SKU、箱数、预计到仓、上传装箱单和外箱标签。", action: "ASN-UK-240531", tone: "info" as Tone },
  { title: "导入出库订单", desc: "CSV 导入后校验地址、SKU、库存并生成待履约订单。", action: "89 单待处理", tone: "warn" as Tone },
  { title: "确认退货方案", desc: "手机端查看质检照片，选择重上架、换标、销毁或转寄。", action: "12 件待确认", tone: "danger" as Tone },
];

const scanFlow = [
  ["扫描外箱标签", "ASN-UK-240522", "确认到仓批次"],
  ["登记差异", "少 2 件 / 破损 1 件", "拍照留痕"],
  ["分配库位", "BHM-A03-R2-S4", "生成上架任务"],
  ["复核出库", "WAVE-572", "称重、面单、交接"],
];

const qualityGates = [
  ["库存", "所有变化写入 InventoryLedger，余额可重算。"],
  ["费用", "所有收费来自 ChargeEvent，可追溯来源单据。"],
  ["异常", "必须有关联对象、责任方、SLA、处理记录。"],
  ["移动端", "390px 无横向滚动，客户可完成确认和补资料。"],
];

const customerMetrics = [
  { label: "可售库存 SKU", value: "328", note: "较昨日 +12", tone: "good" as Tone },
  { label: "待入库箱数", value: "146", note: "3 个 ASN", tone: "info" as Tone },
  { label: "今日待出库", value: "89", note: "TikTok 占 42%", tone: "warn" as Tone },
  { label: "未结费用", value: "£2,846", note: "约 RMB 25,988", tone: "danger" as Tone },
];

const warehouseMetrics = [
  { label: "今日预计到仓", value: "5 ASN", note: "238 箱 / 14 托", tone: "info" as Tone },
  { label: "待上架 SKU", value: "74", note: "退货区 18", tone: "warn" as Tone },
  { label: "待拣订单", value: "126", note: "截单前 2h", tone: "danger" as Tone },
  { label: "按时出库率", value: "96.8%", note: "本周 +1.4%", tone: "good" as Tone },
];

const inboundRows = [
  ["ASN-UK-240518", "深圳蓝海科技", "海运", "54 箱", "清关中", "预计 5月16日"],
  ["ASN-UK-240522", "宁波家居卖家", "卡车派送", "18 托", "待到仓", "预计 5月13日"],
  ["ASN-UK-240531", "义乌配件工厂", "空运", "38 箱", "待补资料", "缺 EORI 授权"],
];

const orderRows = [
  ["ORD-TK-88216", "TikTok Shop", "3 SKU", "Parcelforce 24", "待拣货", "£4.18"],
  ["ORD-EB-77105", "eBay", "1 SKU", "Royal Mail 48", "已出库", "£3.26"],
  ["ORD-SH-10389", "Shopify", "2 SKU", "DPD Local", "地址异常", "待确认"],
];

const warehouseTasks = [
  ["收货", "ASN-UK-240522", "18 托家居件，需拍照抽检", "09:30", "高"],
  ["上架", "PUT-1038", "退货区良品转标准货架", "10:15", "中"],
  ["拣货", "WAVE-572", "TikTok 爆单波次 64 单", "11:00", "高"],
  ["退货质检", "RMA-8842", "小家电功能检测 + 换标", "13:40", "中"],
];

const modelEntities = [
  "CustomerAccount",
  "CustomerComplianceProfile",
  "Sku",
  "InboundASN",
  "InventoryLedger",
  "SalesOrder",
  "ReturnOrder",
  "FbaTransfer",
  "ChargeEvent",
  "Invoice",
  "Ticket",
];

const roadmap = [
  { stage: "阶段 1", title: "品牌网站与体验版本", body: "升级官网首页、客户工作台、仓库后台和核心转化路径。", status: "进行中" },
  { stage: "阶段 2", title: "客户/SKU/ASN/库存", body: "实现账号、KYC、SKU、入库预报、收货上架和库存流水。", status: "下一步" },
  { stage: "阶段 3", title: "订单履约", body: "订单导入、库存锁定、拣货打包、出库、追踪号和日志。", status: "计划中" },
  { stage: "阶段 4", title: "退货/FBA/异常", body: "退货质检、换标、FBA 中转、异常中心和客户确认流。", status: "计划中" },
  { stage: "阶段 5", title: "计费与账单", body: "费率卡、计费事件、月结账单、付款凭证和财务确认。", status: "计划中" },
];

function toneClass(tone: Tone) {
  if (tone === "good") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "neutral") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function serviceAccentClass(accent: ServiceAccent, part: "icon" | "chip" | "bar" | "link") {
  const styles = {
    cyan: {
      icon: "bg-cyan-50 text-cyan-700 ring-cyan-100",
      chip: "bg-cyan-50 text-cyan-800 border-cyan-100",
      bar: "bg-cyan-500",
      link: "text-cyan-800 hover:text-cyan-950",
    },
    slate: {
      icon: "bg-slate-100 text-slate-800 ring-slate-200",
      chip: "bg-slate-100 text-slate-700 border-slate-200",
      bar: "bg-slate-700",
      link: "text-slate-800 hover:text-slate-950",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      chip: "bg-emerald-50 text-emerald-800 border-emerald-100",
      bar: "bg-emerald-500",
      link: "text-emerald-800 hover:text-emerald-950",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700 ring-amber-100",
      chip: "bg-amber-50 text-amber-800 border-amber-100",
      bar: "bg-amber-500",
      link: "text-amber-800 hover:text-amber-950",
    },
    indigo: {
      icon: "bg-indigo-50 text-indigo-700 ring-indigo-100",
      chip: "bg-indigo-50 text-indigo-800 border-indigo-100",
      bar: "bg-indigo-500",
      link: "text-indigo-800 hover:text-indigo-950",
    },
    rose: {
      icon: "bg-rose-50 text-rose-700 ring-rose-100",
      chip: "bg-rose-50 text-rose-800 border-rose-100",
      bar: "bg-rose-500",
      link: "text-rose-800 hover:text-rose-950",
    },
  } satisfies Record<ServiceAccent, Record<"icon" | "chip" | "bar" | "link", string>>;

  return styles[accent][part];
}

function StatusBadge({ children, tone = "info" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${toneClass(tone)}`}>
      <span className="status-dot bg-current" />
      {children}
    </span>
  );
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: Tone }) {
  return (
    <div className="metric-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <span
          className={`h-2 w-2 rounded-full ${
            tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : tone === "danger" ? "bg-rose-500" : "bg-sky-500"
          }`}
        />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{body}</p>
    </div>
  );
}

function IndustryServiceOverview() {
  return (
    <section className="luxury-surface p-5 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <SectionTitle
          eyebrow="服务项目"
          title="常用英国仓服务，一进来就能对上您的需求。"
          body="入仓、仓储、一件代发、退货、FBA 补仓和费用对账都放在前面。客户先判断能不能做、怎么开始、费用从哪里来。"
        />
        <Link className="inline-flex w-fit min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" href={surfaceHref("marketing", "/services")}>
          查看全部服务 <ArrowRight size={16} />
        </Link>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {industryServiceCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link className="shine-edge bento-card magnetic-card flex min-h-52 flex-col justify-between p-5" href={item.href} key={item.title}>
              <span>
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">{item.meta}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </span>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
                了解详情 <ChevronRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          {industryProcess.map(([index, title, body]) => (
            <div className="motion-progress rounded-md border border-slate-200 bg-white p-4" key={title}>
              <p className="font-mono text-xs font-semibold text-[#0E7490]">STEP {index}</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-950">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformSolutionSection() {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="cinema-stage signal-band flex min-h-[420px] flex-col justify-between p-6 text-white sm:p-8">
        <div>
          <p className="text-sm font-semibold text-cyan-200">按您的平台选择方案</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">Amazon、TikTok、eBay、Shopify 和外贸客户，不用看同一套说明。</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            不同平台的订单节奏、退货比例和补仓方式不一样。您只需要告诉我们平台、品类、货量和退货比例，我们再确认仓储、发货、退货和 FBA 是否适合。
          </p>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {["先判断", "再报价", "后入仓"].map((item) => (
            <div className="glass-tile p-4" key={item}>
              <p className="text-sm font-semibold text-white">{item}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">流程更清楚</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sellerScenarios.map((item) => {
          const Icon = item.icon;
          return (
            <Link className="bento-card magnetic-card flex min-h-52 flex-col justify-between p-5" href={item.href} key={item.title}>
              <span>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">可咨询</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.pain}</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">{item.service}</p>
              </span>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
                获取对应方案 <ChevronRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ConversionOfferBand() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {homepageConversionCards.map((card) => {
        const Icon = card.icon;
        return (
          <Link className="premium-panel magnetic-card flex min-h-56 flex-col justify-between p-5" href={card.href} key={card.title}>
            <span>
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Icon size={20} />
                </span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{card.badge}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
            </span>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
              继续了解 <ArrowRight size={15} />
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function UkFulfillmentGlobeSection() {
  return (
    <section className="uk-globe-stage overflow-hidden rounded-lg bg-slate-950 text-white">
      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-8 lg:p-10">
        <div className="reveal-rise max-w-xl">
          <p className="text-sm font-semibold text-cyan-200">为什么要把货放到英国仓</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:mt-4 sm:text-5xl">客户下单后，从英国本地发货更简单。</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:mt-5 sm:text-base sm:leading-8">
            这块只讲一个核心逻辑：先把热销库存放到英国仓，客户下单后由英国本地完成发货；退货、换标和 FBA 补仓也在英国侧处理，减少跨境来回折腾。
          </p>
          <div className="mt-5 grid gap-2 sm:mt-7 sm:grid-cols-2 sm:gap-3">
            {[
              ["本地发货", "订单产生后从英国仓拣货、打包、交给尾程。"],
              ["退货好处理", "退件回到英国仓后可质检、拍照、换标或重上架。"],
              ["FBA 补仓更灵活", "库存先在英国，再按销售节奏分批送 FBA。"],
              ["中文跟进", "报价、资料、异常和账单由中文客服对接。"],
            ].map(([title, body]) => (
              <div className="rounded-md border border-white/10 bg-white/7 p-3 backdrop-blur sm:p-4" key={title}>
                <p className="text-sm font-semibold text-cyan-100">{title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="uk-local-flow-panel relative min-h-[700px] overflow-hidden rounded-lg border border-white/12 bg-slate-950/72 sm:min-h-[620px] lg:min-h-[460px]">
          <Image
            alt="英国仓本地发货、退货和 FBA 补仓业务画面"
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 720px, 100vw"
            src="/assets/uk-warehouse-premium-operations.png"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.78),rgba(2,6,23,0.28)),linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.86))]" />
          <div className="absolute left-4 top-4 rounded-md border border-white/14 bg-slate-950/72 px-3 py-2 text-xs font-semibold text-cyan-50 backdrop-blur sm:left-5 sm:top-5 sm:text-sm">
            货在英国仓 → 英国本地履约
          </div>
          <div className="absolute inset-x-4 bottom-4 grid gap-3 sm:inset-x-5 sm:bottom-5 lg:grid-cols-3">
            {[
              ["01", "库存先进英国仓", "热销 SKU 先备到英国，客户下单后不用从国内单票直发。"],
              ["02", "订单本地发出", "仓库完成拣货、复核、打包、贴单，再交给英国尾程。"],
              ["03", "售后留在英国处理", "退货、换标、重上架和 FBA 补仓按规则处理。"],
            ].map(([index, title, body]) => (
              <div className="uk-local-flow-card" key={title}>
                <p className="font-mono text-xs font-semibold text-cyan-100">{index}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CinematicVisualStory() {
  const flow = [
    ["01", "入仓预报", "SKU、箱数、标签、预计到仓时间先确认"],
    ["02", "到仓验收", "核对箱数和标签，异常拍照留痕"],
    ["03", "库存上架", "完成清点后生成可售库存记录"],
    ["04", "订单出库", "拣货、打包、贴单并回传追踪号"],
    ["05", "退货/对账", "退货处理和费用来源都可核对"],
  ];

  const workspaceCards = [
    ["库存", "到仓、上架、可售、锁定"],
    ["订单", "待拣货、已出库、追踪号"],
    ["异常", "照片、说明、客户确认"],
    ["账单", "费用来源、单据、月结"],
  ];

  return (
    <div className="space-y-10">
      <section className="cinema-stage grid gap-8 p-5 text-white sm:p-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:p-10">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-cyan-200">英国仓履约全链路</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">货到英国仓后，关键节点都能看清。</h2>
          <p className="mt-5 text-base leading-8 text-slate-300">
            入仓、上架、出库、退货和账单不再散落在聊天记录里。您只需要知道当前状态、下一步动作和是否需要补资料。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cyan-200 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-100" href={surfaceHref("customer", "/inquiry")}>
              获取英国仓方案 <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="fulfillment-deck min-h-0 p-4 sm:p-5">
          <div className="relative min-h-[390px] overflow-hidden rounded-lg border border-white/12 bg-slate-950">
            <Image
              alt="英国仓现场收货、上架和出库作业"
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              src="/assets/uk-warehouse-home-hero-v2.png"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.22),rgba(2,6,23,0.08)),linear-gradient(180deg,rgba(2,6,23,0.06),rgba(2,6,23,0.76))]" />
            <div className="absolute left-4 top-4 rounded-md border border-white/14 bg-slate-950/68 px-3 py-2 backdrop-blur">
              <p className="text-xs font-semibold text-cyan-100">英国仓履约看板</p>
              <p className="mt-1 text-sm font-semibold text-white">状态按节点推进</p>
            </div>
            <div className="absolute right-4 top-4 rounded-md border border-emerald-300/20 bg-emerald-300/12 px-3 py-2 text-xs font-semibold text-emerald-100 backdrop-blur">可跟进</div>
            <div className="absolute inset-x-4 bottom-4 grid gap-3 lg:grid-cols-[1fr_0.72fr]">
              <div className="glass-tile p-4">
                <p className="text-xs font-semibold text-cyan-100">当前货件</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">ASN-UK-240531 到仓验收中</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">箱数、外箱标签和装箱单正在核对，异常会拍照记录。</p>
              </div>
              <div className="grid gap-2">
                {[
                  ["库存状态", "待上架"],
                  ["客户可见", "有记录"],
                  ["下一步", "生成库存"],
                ].map(([label, value]) => (
                  <div className="rounded-md border border-white/12 bg-slate-950/58 px-3 py-2 text-white backdrop-blur" key={label}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 grid gap-2 sm:grid-cols-5">
            {flow.map(([index, title, body]) => (
              <div className="rounded-md border border-white/12 bg-white/7 p-3 text-white" key={title}>
                <p className="font-mono text-xs font-semibold text-cyan-100">{index}</p>
                <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <SectionTitle
            eyebrow="高频业务场景"
            title="入仓、发货、退货、补仓，英国本地都有对应处理。"
            body="把跨境卖家最常遇到的履约动作放在一起：货到仓怎么收、订单怎么发、退货怎么处理、费用怎么核对。"
          />
          <Link className="inline-flex w-fit min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" href={surfaceHref("marketing", "/services")}>
            查看服务项目 <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {brandImageScenes.map((scene) => {
            const Icon = scene.icon;
            const span = scene.size === "large" ? "lg:col-span-2 lg:row-span-2" : scene.size === "wide" ? "lg:col-span-2" : "";
            return (
              <article className={`scene-card group ${span}`} key={scene.title}>
                <Image
                  alt={scene.title}
                  className={`object-cover transition duration-700 ${scene.size === "large" ? "object-[74%_center]" : ""}`}
                  fill
                  sizes={scene.size === "large" ? "(min-width: 1024px) 620px, 100vw" : "(min-width: 1024px) 320px, 100vw"}
                  src={scene.image}
                />
                <div className="absolute inset-x-4 bottom-4 z-10 rounded-lg border border-white/14 bg-slate-950/62 p-4 text-white shadow-2xl shadow-slate-950/25 backdrop-blur">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-200 text-slate-950">
                      <Icon size={18} />
                    </span>
                    <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-cyan-100 backdrop-blur">{scene.meta}</span>
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight">{scene.title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-200">{scene.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="luxury-surface grid gap-0 overflow-hidden lg:grid-cols-[1.08fr_0.92fr]">
        <div className="motion-frame relative min-h-[560px] bg-slate-950">
          <Image
            alt="客户工作台电脑与移动端视觉"
            className="motion-media object-cover"
            fill
            sizes="(min-width: 1024px) 680px, 100vw"
            src="/assets/uk-warehouse-premium-mobile-ops.png"
          />
          <div className="motion-scanline" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.78))]" />
          <div className="glass-tile absolute inset-x-5 bottom-5 p-5 text-white">
            <p className="text-sm font-semibold text-cyan-100">客户登录后看到结果</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">库存、订单、异常和费用，不再只靠聊天记录追。</h2>
          </div>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <p className="section-eyebrow">客户工作台</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-950">登录后，库存、订单、异常和账单都能集中查看。</h2>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            您可以查进度、补资料、看库存、看异常照片、核对费用，不用把重要信息散落在聊天记录里。
          </p>
          <div className="route-line mt-7" />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {workspaceCards.map(([title, body]) => (
              <div className="bento-card magnetic-card p-4" key={title}>
                <h3 className="text-base font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white" href={surfaceHref("customer", "/login")}>
              客户登录 <LogIn size={16} />
            </Link>
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700" href={surfaceHref("customer", "/portal")}>
              登录工作台 <Search size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="cinema-stage grid gap-0 overflow-hidden text-white lg:grid-cols-[0.72fr_1.28fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold text-cyan-200">新客户转化</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">先试仓，跑通流程，再决定长期备货。</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            对第一次使用英国仓的卖家，最好的承诺不是夸规模，而是让客户低风险验证入仓、出库、退货和账单。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cyan-200 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-100" href={surfaceHref("customer", "/inquiry?service=trial")}>
              申请试仓方案 <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white/10" href={surfaceHref("marketing", "/pricing")}>
              先看费用说明
            </Link>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-2 lg:p-8">
          {trialOffers.slice(0, 4).map((offer) => {
            const Icon = offer.icon;
            return (
              <Link className="glass-tile magnetic-card p-5" href={offer.href} key={offer.title}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-200 text-slate-950">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-md border border-cyan-100/20 bg-cyan-100/10 px-2 py-1 text-xs font-semibold text-cyan-100">{offer.badge}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{offer.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{offer.body}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PremiumBrandHero() {
  return (
    <section className="premium-landing-hero overflow-hidden rounded-lg bg-slate-950 text-white shadow-2xl shadow-slate-950/20">
      <div className="relative min-h-[720px]">
        <Image alt="英国仓库现场、客户工作台和本地履约服务" className="motion-media object-cover" fill priority sizes="(min-width: 1024px) 1280px, 100vw" src="/assets/uk-warehouse-brand-control-desk.png" />
        <div className="motion-scanline" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(103,232,249,0.18),transparent_28%),linear-gradient(90deg,rgba(2,6,23,0.98)_0%,rgba(2,6,23,0.84)_42%,rgba(2,6,23,0.34)_100%),linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.86))]" />
        <div className="relative flex min-h-[720px] flex-col justify-between p-5 sm:p-8 lg:p-12">
          <div className="max-w-4xl pt-10 sm:pt-16">
            <div className="inline-flex rounded-full border border-cyan-200/24 bg-cyan-100/10 px-4 py-2 text-sm font-semibold text-cyan-100 backdrop-blur">英国本地仓储 · 一件代发 · 退货/FBA · 中文跟进</div>
            <h1 className="premium-wordmark mt-8 max-w-4xl text-5xl font-semibold leading-[0.98] sm:text-7xl lg:text-8xl">
              英国仓配，
              <span className="block text-cyan-100">让跨境订单像本地生意。</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
              给中国跨境卖家的英国仓。先把库存放到英国，订单、退货、FBA 补仓和费用核对，都有清晰的本地处理路径。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="premium-button-primary inline-flex min-h-12 items-center gap-2 rounded-md bg-cyan-200 px-5 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-950/20 hover:bg-cyan-100" href={surfaceHref("customer", "/inquiry")}>
                获取英国仓方案 <ArrowRight size={16} />
              </Link>
              <Link className="premium-button-ghost inline-flex min-h-12 items-center gap-2 rounded-md border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15" href={surfaceHref("customer", "/login")}>
                客户登录 <LogIn size={16} />
              </Link>
            </div>
          </div>
          <div className="premium-hero-console mt-10 grid gap-3 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div className="rounded-lg border border-white/14 bg-slate-950/54 p-4 backdrop-blur-xl">
              <p className="text-xs font-semibold text-cyan-100">适合卖家</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Amazon UK", "TikTok Shop", "eBay", "Shopify", "外贸小批量"].map((item) => (
                  <span className="rounded-full border border-white/14 bg-white/9 px-3 py-2 text-sm font-semibold text-slate-100" key={item}>{item}</span>
                ))}
              </div>
            </div>
            <div className="premium-route-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-cyan-100">客户会看到的结果</p>
                  <h2 className="mt-1 text-2xl font-semibold">货在哪里、下一步做什么、费用从哪里来。</h2>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/24 bg-emerald-300/14 px-3 py-2 text-xs font-semibold text-emerald-100">
                  <span className="motion-pulse status-dot bg-emerald-300" />
                  状态可跟进
                </span>
              </div>
              <div className="premium-route-line mt-6">
                {["报价", "入仓", "上架", "出库", "退货/FBA", "对账"].map((item, index) => (
                  <span style={{ "--step": index } as CSSProperties} key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PremiumServicePanorama() {
  return (
    <section className="premium-service-panorama overflow-hidden rounded-lg bg-white shadow-2xl shadow-slate-950/8">
      <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative min-h-[520px] bg-slate-950 text-white">
          <Image alt="英国海外仓服务全景" className="object-cover" fill sizes="(min-width: 1024px) 600px, 100vw" src="/assets/uk-warehouse-brand-hero.png" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.82)),linear-gradient(90deg,rgba(2,6,23,0.68),rgba(2,6,23,0.1))]" />
          <div className="absolute inset-x-5 bottom-5 max-w-xl">
            <p className="text-sm font-semibold text-cyan-100">服务不是堆名词，而是把货跑起来</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">从入仓到售后，英国这一段有人接住。</h2>
            <p className="mt-4 text-sm leading-7 text-slate-200">把服务拆成客户能理解的四个动作：存、发、退、补。</p>
          </div>
        </div>
        <div className="bg-[linear-gradient(180deg,#ffffff,#f4f8fb)] p-5 sm:p-8 lg:p-10">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-eyebrow">服务项目</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">客户一眼能看懂我们做什么。</h2>
            </div>
            <Link className="inline-flex w-fit min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" href={surfaceHref("marketing", "/services")}>
              查看全部服务 <ArrowRight size={16} />
            </Link>
          </div>
          <div className="premium-service-list">
            {premiumServicePanorama.map((service, index) => {
              const Icon = service.icon;
              return (
                <Link className="premium-service-row group" href={surfaceHref("customer", "/inquiry")} key={service.title}>
                  <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-md bg-slate-100 sm:h-28 sm:w-36">
                    <Image alt={service.title} className="object-cover transition duration-700 group-hover:scale-[1.05]" fill sizes="160px" src={service.image} />
                    <div className="absolute inset-0 bg-slate-950/18" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]"><Icon size={18} /></span>
                      <span className="text-xs font-semibold text-slate-500">0{index + 1} · {service.caption}</span>
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{service.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{service.body}</p>
                  </div>
                  <ArrowRight className="hidden text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#0E7490] sm:block" size={18} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PremiumWorkflowShowcase() {
  return (
    <section className="premium-workflow-film overflow-hidden rounded-lg bg-slate-950 text-white">
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold text-cyan-200">操作流程</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">客户进来后，不会一头雾水。</h2>
          <p className="mt-5 text-sm leading-7 text-slate-300">先咨询、再确认、再入仓、再履约，最后对账复盘。客户知道自己在哪一步，也知道下一步要给什么资料。</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/20 bg-white/8 px-5 text-sm font-semibold text-white hover:bg-white/12" href={surfaceHref("customer", "/inbound")}>
              创建入库预报
            </Link>
          </div>
        </div>
        <div className="relative min-h-[560px]">
          <Image alt="英国仓履约流程画面" className="object-cover" fill sizes="(min-width: 1024px) 760px, 100vw" src="/assets/uk-warehouse-home-hero-v2.png" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.74),rgba(2,6,23,0.18)),linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.78))]" />
          <div className="absolute inset-x-4 bottom-4 grid gap-3 sm:inset-x-6 sm:bottom-6 lg:grid-cols-5">
            {premiumWorkflowFrames.map(([index, title, body]) => (
              <div className="premium-film-step" style={{ "--step": Number(index) } as CSSProperties} key={title}>
                <p className="font-mono text-xs font-semibold text-cyan-100">{index}</p>
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const cleanServiceSpotlights = [
  {
    id: "first-mile",
    label: "头程清关",
    title: "头程清关",
    english: "FIRST MILE & CUSTOMS CLEARANCE",
    body: "从中国发货到英国仓前，我们可以协同头程运输、资料准备和到仓安排。适合需要海运、空运、卡航或快递渠道的卖家，客服会先确认货物品类、箱数、时效要求和清关资料，再安排英国仓接收节奏。",
    points: ["头程运输协同", "清关资料提醒", "到仓预约衔接"],
    image: "/assets/uk-station-hero-first-mile.png",
  },
  {
    id: "warehousing",
    label: "仓储中转",
    title: "仓储中转",
    english: "WAREHOUSING & CROSS-DOCKING",
    body: "货到英国仓后可进行暂存、清点、上架、库存记录和中转出库。适合旺季备货、小批量试仓、FBA 补仓前置库存和 B2B 批量转运，让货物先进入英国本地库存池，再按销售和补货节奏发出。",
    points: ["本地暂存", "库存记录", "FBA / B2B 中转"],
    image: "/assets/uk-station-hero-fba.png",
  },
  {
    id: "fulfillment",
    label: "一件代发",
    title: "一件代发",
    english: "ORDER FULFILLMENT",
    body: "店铺出单后，英国仓完成拣货、复核、打包、贴单和尾程交接。适合 TikTok Shop、eBay、Shopify、Amazon FBM 和独立站卖家，帮助缩短英国买家的收货时间，并统一记录订单、包材和尾程费用。",
    points: ["拣货复核", "打包贴单", "尾程交接"],
    image: "/assets/uk-station-hero-fulfillment.png",
  },
  {
    id: "prep",
    label: "贴标换标",
    title: "贴标换标",
    english: "RE-LABELLING & PREP",
    body: "支持 FNSKU 贴标、外箱标签、换箱、分箱、打托、重新包装和平台要求的入仓准备。适合 Amazon UK FBA 补仓、退货重上架和标签异常处理，降低因为标签或包装问题导致的拒收风险。",
    points: ["FNSKU 贴标", "分箱打托", "换箱重包"],
    image: "/assets/uk-warehouse-fba-prep.png",
  },
  {
    id: "after-sales",
    label: "售后维修",
    title: "售后维修",
    english: "AFTER-SALES SERVICE & REPAIR",
    body: "支持英国本地退货接收、质检拍照、清洁整理、简单维修、配件更换、换标重上架或销毁处理。适合希望降低退货损耗、延长产品销售周期的卖家，尤其适用于电子、家居、数码配件等可复检品类。",
    points: ["退货质检", "维修翻新", "重上架 / 销毁"],
    image: "/assets/uk-station-hero-returns.png",
  },
];

const cleanServiceStats = [
  { value: "2000", unit: "㎡", unitEn: "sqm", label: "英国仓储操作空间", labelEn: "UK warehouse operating space" },
  { value: "5", unit: "年+", unitEn: "yrs+", label: "深耕英国本地仓配", labelEn: "UK local fulfillment experience" },
  { value: "100+", unit: "", unitEn: "", label: "服务卖家与外贸客户", labelEn: "Sellers and trade clients served" },
  { value: "6", unit: "大模块", unitEn: "modules", label: "覆盖头程、仓储、履约与售后", labelEn: "First mile, storage, fulfillment and after-sales" },
];

const cleanProcessSteps = [
  { index: "01", title: "提交需求", titleEn: "Submit Needs", body: "平台、品类、SKU、货量", bodyEn: "Platform, category, SKUs and volume", image: "/assets/uk-warehouse-mobile-dashboard.png" },
  { index: "02", title: "确认方案", titleEn: "Confirm Plan", body: "服务范围、费用怎么计算", bodyEn: "Service scope and pricing logic", image: "/assets/uk-warehouse-premium-operations.png" },
  { index: "03", title: "预约入仓", titleEn: "Book Inbound", body: "装箱单、外箱标签、预计到仓时间", bodyEn: "Packing list, carton labels and ETA", image: "/assets/uk-warehouse-hero.png" },
  { index: "04", title: "英国履约", titleEn: "UK Fulfillment", body: "入库、上架、出库", bodyEn: "Receiving, shelving and dispatch", image: "/assets/uk-warehouse-brand-control-desk.png" },
  { index: "05", title: "售后对账", titleEn: "Returns & Billing", body: "退货、FBA、费用核对", bodyEn: "Returns, FBA prep and billing review", image: "/assets/uk-warehouse-brand-returns-fba.png" },
];

const cleanPlatformStrip = [
  {
    icon: ShoppingCart,
    title: { zh: "平台卖家", en: "Marketplace Sellers" },
    body: { zh: "适合 TikTok Shop、eBay、Shopify 等需要英国本地发货、退货地址和售后处理的卖家。", en: "For TikTok Shop, eBay and Shopify sellers who need UK dispatch, return address and after-sales handling." },
    meta: { zh: "一件代发 / 英国退货", en: "Fulfillment / UK Returns" },
  },
  {
    icon: PackageCheck,
    title: { zh: "Amazon UK 卖家", en: "Amazon UK Sellers" },
    body: { zh: "适合需要 FBA 补仓、贴标换标、分箱打托、预约送仓和英国仓暂存的卖家。", en: "For FBA replenishment, labelling, carton split, palletising, booking and UK buffer storage." },
    meta: { zh: "FBA 中转 / 补仓", en: "FBA Prep / Replenishment" },
  },
  {
    icon: Truck,
    title: { zh: "B2B 外贸客户", en: "B2B Trade Clients" },
    body: { zh: "适合小批量周转、英国本地暂存、批量转运、样品寄送和客户指定地址派送。", en: "For small-batch transfer, UK storage, bulk forwarding, samples and delivery to nominated addresses." },
    meta: { zh: "批量转运 / 暂存", en: "Bulk Transfer / Storage" },
  },
  {
    icon: RefreshCcw,
    title: { zh: "测品与售后团队", en: "Testing & After-sales" },
    body: { zh: "适合先用一票货验证流程，并处理退货质检、拍照反馈、维修翻新、换标重上架。", en: "For trial shipments, return inspection, photo feedback, repair, refurbish, re-labelling and restock." },
    meta: { zh: "小批量试仓 / 维修翻新", en: "Trial Stock / Repair" },
  },
];

const cleanFooterColumns = [
  {
    title: { zh: "海外仓服务", en: "Warehouse Services" },
    links: [
      [{ zh: "头程清关", en: "First Mile & Customs" }, "/services/first-mile"],
      [{ zh: "仓储中转", en: "Warehousing" }, "/services/warehousing"],
      [{ zh: "一件代发", en: "Order Fulfillment" }, "/services/fulfillment"],
      [{ zh: "贴标换标", en: "Re-labelling" }, "/services/prep"],
      [{ zh: "售后维修", en: "After-sales Repair" }, "/services/after-sales"],
    ],
  },
  {
    title: { zh: "新闻资讯", en: "Insights" },
    links: [
      [{ zh: "行业新闻", en: "Industry News" }, "/news#news-category-industry"],
      [{ zh: "英国仓观察", en: "UK Warehouse Insights" }, "/news#news-category-warehouse"],
    ],
  },
  {
    title: { zh: "关于我们", en: "About" },
    links: [
      [{ zh: "公司简介", en: "Company Profile" }, "/about"],
      [{ zh: "用户工作台", en: "Customer Workspace" }, "/portal"],
      [{ zh: "帮助中心", en: "Help Center" }, "/help"],
      [{ zh: "提交需求", en: "Submit Needs" }, "/inquiry?service=trial"],
    ],
  },
] as const;

const cleanFooterTrackingLinks = [
  ["Royal Mail 查询", "https://www.royalmail.com/track-your-item#/"],
  ["Parcelforce 查询", "https://www.parcelforce.com/track-trace"],
  ["DPD 查询", "https://track.dpd.co.uk/"],
] as const;

const customerRoutePrefixes = ["/login", "/portal", "/account", "/inquiry", "/inbound", "/tracking", "/supplement", "/billing", "/skus", "/outbound"];

function footerHref(href: string) {
  return customerRoutePrefixes.some((prefix) => href === prefix || href.startsWith(`${prefix}?`) || href.startsWith(`${prefix}/`)) ? surfaceHref("customer", href) : surfaceHref("marketing", href);
}

const cleanNewsItems = newsArticles.map((article) => ({
  slug: article.slug,
  date: article.date.slice(0, 7).replace("-", "."),
  dateEn: article.date.slice(0, 7).replace("-", "."),
  title: article.title,
  titleEn: article.title,
  body: article.summary,
  bodyEn: article.summary,
  image: article.image,
}));

const cleanPartnerCarriers = [
  { name: "UPS", logo: "/assets/partners/ups.svg", note: { zh: "国际快递 / 英国派送", en: "International express / UK delivery" }, tone: "ups" },
  { name: "Parcelforce Worldwide", logo: "/assets/partners/parcelforce.svg", note: { zh: "英国包裹快递", en: "UK parcel courier" }, tone: "parcelforce" },
  { name: "Royal Mail", logo: "/assets/partners/royal-mail.svg", note: { zh: "英国邮政网络", en: "UK postal network" }, tone: "royal" },
  { name: "DPD", logo: "/assets/partners/dpd.svg", note: { zh: "英国包裹派送", en: "UK parcel delivery" }, tone: "dpd" },
  { name: "Yodel by InPost", logo: "/assets/partners/yodel.svg", note: { zh: "英国经济派送", en: "UK economy delivery" }, tone: "yodel" },
  { name: "InPost", logo: "/assets/partners/inpost.svg", note: { zh: "自提柜 / 本地派送", en: "Locker and local delivery" }, tone: "inpost" },
  { name: "DHL", logo: "/assets/partners/dhl.svg", note: { zh: "跨境快递渠道", en: "Cross-border courier" }, tone: "dhl" },
  { name: "FedEx", logo: "/assets/partners/fedex.svg", note: { zh: "国际快递服务", en: "International courier" }, tone: "fedex" },
];

const cleanHeroSlides = [
  {
    title: "英国驿站",
    subtitle: "中国卖家的一站式英国仓储、履约和售后中心",
    titleEn: "UK Station",
    subtitleEn: "One-stop UK warehousing, fulfillment and after-sales center for Chinese sellers",
    image: "/assets/uk-station-hero-brand.png",
    alt: "英国仓储履约中心现场",
  },
  {
    title: "自研仓储系统",
    subtitle: "每票货都有记录，进度、异常和费用清楚可查",
    titleEn: "Self-developed WMS",
    subtitleEn: "Every shipment stays traceable: progress, exceptions and billing records are clear",
    image: "/assets/uk-station-hero-system.png",
    alt: "仓库现场的自研仓储系统工作台",
  },
  {
    title: "头程运输与清关协同",
    subtitle: "从中国发货到英国仓，运输、资料和到仓安排一起跟进",
    titleEn: "First Mile & Customs",
    subtitleEn: "Freight, documents and UK warehouse receiving are coordinated before arrival",
    image: "/assets/uk-station-hero-first-mile.png",
    alt: "头程运输与港口清关协同",
  },
  {
    title: "英国仓储与 FBA 中转",
    subtitle: "支持暂存、贴标、分箱、打托和预约送仓",
    titleEn: "UK Storage & FBA Prep",
    subtitleEn: "Storage, labelling, carton split, palletising and Amazon UK delivery preparation",
    image: "/assets/uk-station-hero-fba.png",
    alt: "英国仓储与 FBA 中转处理",
  },
  {
    title: "英国本地一件代发",
    subtitle: "店铺出单后，英国仓完成拣货、打包和尾程交接",
    titleEn: "UK Order Fulfillment",
    subtitleEn: "Pick, pack and hand over local UK orders after your store receives sales",
    image: "/assets/uk-station-hero-fulfillment.png",
    alt: "英国本地一件代发打包台",
  },
  {
    title: "退货换标与翻新处理",
    subtitle: "支持退货接收、质检拍照、清洁整理、换标重上架和销毁处理",
    titleEn: "Returns & Refurbishment",
    subtitleEn: "Receive, inspect, photograph, re-label, refurbish, restock or dispose returns",
    image: "/assets/uk-station-hero-returns.png",
    alt: "英国退货质检换标与重新包装",
  },
];

function CleanBannerMedia({ activeIndex }: { activeIndex: number }) {
  return (
    <>
      {cleanHeroSlides.map((slide, index) => (
        <Image
          alt={slide.alt}
          className={`clean-banner-media clean-carousel-image object-cover ${index === activeIndex ? "is-active" : ""}`}
          fill
          key={slide.image}
          priority={index === 0}
          sizes="(min-width: 1024px) 1280px, 100vw"
          src={slide.image}
        />
      ))}
      <div className="clean-banner-depth" />
      <div className="clean-banner-signal" />
    </>
  );
}

function CleanBannerActions({ language }: { language: SiteLanguage }) {
  return (
    <div className="mt-8 flex justify-center">
      <Link className="clean-hero-discover-button inline-flex min-h-12 items-center justify-center gap-2 px-9 text-base font-semibold text-white" href={surfaceHref("customer", "/inquiry?service=trial")}>
        {language === "en" ? "Submit Needs" : "提交需求"} <ArrowRight size={17} />
      </Link>
    </div>
  );
}

function CleanPlatformStrip({ language }: { language: SiteLanguage }) {
  const renderCard = (item: (typeof cleanPlatformStrip)[number], hidden = false) => {
    const Icon = item.icon;

    return (
      <article className="clean-seller-fit-card" aria-hidden={hidden ? "true" : undefined} key={hidden ? `${item.title.zh}-repeat` : item.title.zh}>
        <div className="clean-seller-fit-card-head">
          <span className="clean-seller-fit-icon">
            <Icon size={17} strokeWidth={2.4} />
          </span>
          <small>{item.meta[language]}</small>
        </div>
        <strong>{item.title[language]}</strong>
        <p>{item.body[language]}</p>
        <span className="clean-seller-fit-card-foot">
          {language === "en" ? "Matched flow" : "匹配方案"}
          <ChevronRight size={14} />
        </span>
      </article>
    );
  };

  return (
    <section className="clean-platform-strip clean-platform-strip-attached overflow-hidden text-white">
      <div className="clean-seller-fit">
        <div className="clean-seller-fit-track" aria-label={language === "en" ? "Seller types" : "适合商家类型"}>
          {cleanPlatformStrip.map((item) => renderCard(item))}
          {cleanPlatformStrip.map((item) => renderCard(item, true))}
        </div>
      </div>
    </section>
  );
}

function CleanStatsBand({ language }: { language: SiteLanguage }) {
  return (
    <section className="clean-stats-band">
      {cleanServiceStats.map((stat) => (
        <div className="clean-stat-item" key={stat.label}>
          <p>
            <span>{stat.value}</span>
            <sup>{language === "en" ? stat.unitEn : stat.unit}</sup>
          </p>
          <h2>{language === "en" ? stat.labelEn : stat.label}</h2>
        </div>
      ))}
    </section>
  );
}

function CleanPartnerSection({ language }: { language: SiteLanguage }) {
  return (
    <section className="clean-partner-section">
      <div className="clean-partner-heading">
        <p>{language === "en" ? "Partners" : "合作伙伴"}</p>
        <h2>PARTNER</h2>
        <span />
      </div>
      <div className="clean-partner-grid">
        {cleanPartnerCarriers.map((carrier) => (
          <article className={`clean-partner-card is-${carrier.tone}`} key={carrier.name}>
            <Image alt={`${carrier.name} logo`} className="clean-partner-logo" height={84} src={carrier.logo} width={180} />
            <span>{carrier.note[language]}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function CleanNewsSection({ language }: { language: SiteLanguage }) {
  const [activeNews, setActiveNews] = useState(0);
  const visibleNewsItems = Array.from({ length: Math.min(3, cleanNewsItems.length) }, (_, offset) => cleanNewsItems[(activeNews + offset) % cleanNewsItems.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveNews((index) => (index + 1) % cleanNewsItems.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  const goToNews = (index: number) => {
    setActiveNews((index + cleanNewsItems.length) % cleanNewsItems.length);
  };

  return (
    <section className="clean-news-section">
      <div className="clean-news-heading">
        <div>
          <p>{language === "en" ? "Insights" : "新闻资讯"}</p>
          <h2>NEWS</h2>
        </div>
        <div className="clean-news-heading-actions">
          <Link className="clean-news-more" href={surfaceHref("marketing", "/news")}>
            {language === "en" ? "View More" : "查看更多"} <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="clean-news-carousel">
        <div className="clean-news-grid" key={activeNews}>
          {visibleNewsItems.map((item, index) => (
            <article className="clean-news-card" style={{ "--news-delay": `${index * 80}ms` } as CSSProperties} key={`${item.slug}-${activeNews}`}>
              <div className="clean-news-image">
                <Image alt={language === "en" ? item.titleEn : item.title} className="object-cover" fill sizes="(min-width: 1024px) 360px, 100vw" src={item.image} />
              </div>
              <div className="clean-news-body">
                <p className="clean-news-date">{language === "en" ? item.dateEn : item.date}</p>
                <h3>{language === "en" ? item.titleEn : item.title}</h3>
                <p>{language === "en" ? item.bodyEn : item.body}</p>
                <Link className="clean-news-source" href={surfaceHref("marketing", `/news/${item.slug}`)}>
                  {language === "en" ? "Read Article" : "查看详情"} <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="clean-news-dots">
          {cleanNewsItems.map((item, index) => (
            <button
              aria-label={`${language === "en" ? "Go to news" : "切换新闻"} ${index + 1}`}
              className={index === activeNews ? "is-active" : ""}
              key={item.slug}
              onClick={() => goToNews(index)}
              type="button"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CleanHomeBanner({ language }: { language: SiteLanguage }) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((index) => (index + 1) % cleanHeroSlides.length);
    }, 8200);

    return () => window.clearInterval(timer);
  }, []);

  const slide = cleanHeroSlides[activeSlide];

  return (
    <div className="clean-hero-stack">
      <section className="clean-hero clean-banner-hero relative overflow-hidden bg-slate-950">
        <CleanBannerMedia activeIndex={activeSlide} />
        <div className="clean-banner-content clean-carousel-content relative z-[3] flex min-h-[inherit] items-center justify-center px-5 py-10 text-center text-white sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <div className="mx-auto max-w-5xl">
            <h1 className="mt-6 text-[2.75rem] font-semibold leading-[0.98] tracking-tight sm:mt-8 sm:text-6xl lg:text-[4.6rem] xl:text-[5.2rem]">
              {language === "en" ? slide.titleEn : slide.title}
            </h1>
            <p className="mx-auto mt-5 max-w-4xl text-lg font-semibold leading-8 text-slate-100 sm:mt-6 sm:text-2xl lg:text-3xl">
              {language === "en" ? slide.subtitleEn : slide.subtitle}
            </p>
            <CleanBannerActions language={language} />
            <div className="mt-10 flex items-center justify-center gap-2">
              {cleanHeroSlides.map((item, index) => (
                <button
                  aria-label={`切换到${item.title}`}
                  className={`clean-carousel-dot ${index === activeSlide ? "is-active" : ""}`}
                  key={item.title}
                  onClick={() => setActiveSlide(index)}
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>
        <CleanPlatformStrip language={language} />
      </section>
    </div>
  );
}

function CleanMegaFooter({ language }: { language: SiteLanguage }) {
  return (
    <footer className="clean-mega-footer relative overflow-hidden text-white">
      <Image alt="英国仓配底部联系背景" className="object-cover" fill loading="eager" sizes="100vw" src="/assets/uk-station-hero-system.png" />
      <div className="clean-mega-footer-overlay absolute inset-0" />
      <div className="relative mx-auto flex min-h-[58svh] max-w-7xl flex-col justify-between px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr_0.72fr]">
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
            {cleanFooterColumns.map((column) => (
              <div key={column.title.zh}>
                <h3 className="text-base font-semibold text-white">{column.title[language]}</h3>
                <div className="mt-5 grid gap-3">
                  {column.links.map(([label, href]) => {
                    const linkHref = footerHref(href);
                    return (
                      <Link className="clean-mega-footer-link" href={linkHref} key={label.zh}>
                        {label[language]}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-base font-semibold text-white">{language === "en" ? "Contact" : "联系方式"}</h3>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-cyan-50/88">
              <p>{language === "en" ? "Chinese sellers can submit service needs first. Our support team will follow up by WeChat, phone or email." : "中国卖家可直接提交服务需求，客服会通过微信、电话或邮箱继续确认。"}</p>
              <p>{language === "en" ? "Scope: UK storage, order fulfillment, FBA prep, returns re-labelling and after-sales repair." : "服务范围：英国仓储、一件代发、FBA 中转、退货换标、售后维修。"}</p>
              <p>{language === "en" ? "Sheffield fulfillment network for inbound appointments, returns handling and local dispatch." : "仓库区域：谢菲尔德仓配网络，支持到仓预约、退货处理和本地派送。"}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="clean-mega-footer-primary" href={surfaceHref("customer", "/inquiry?service=trial")}>
                {language === "en" ? "Submit Service Needs" : "提交服务需求"} <ArrowRight size={16} />
              </Link>
              <Link className="clean-mega-footer-ghost" href={surfaceHref("customer", "/portal")}>
                {language === "en" ? "Customer Portal" : "客户工作台"}
              </Link>
            </div>
          </div>

          <div className="clean-mega-footer-contact-card">
            <div className="clean-mega-footer-qr">
              <Image alt={language === "en" ? "WeChat support QR code" : "微信客服二维码"} height={180} src="/assets/wechat-support-qr.png" width={180} />
            </div>
            <p className="mt-4 text-sm font-semibold text-white">{language === "en" ? "WeChat Support" : "微信客服跟进"}</p>
            <p className="mt-2 text-xs leading-5 text-cyan-50/78">{language === "en" ? "After submission, support will confirm quotation and inbound requirements based on your platform, volume, SKUs and service needs." : "提交需求后，客服会按平台、货量、SKU 和服务项目继续确认报价与入仓资料。"}</p>
          </div>
        </div>

        <div className="mt-12 border-t border-white/14 pt-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div>
                <p className="text-sm font-semibold text-white">{language === "en" ? "Tracking Links" : "友情链接"}</p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm text-cyan-50/78">
                  {cleanFooterTrackingLinks.map(([label, href], index) => (
                    <span className="inline-flex items-center gap-3" key={href}>
                      <a className="clean-mega-footer-link" href={href} rel="noreferrer" target="_blank">
                        {label}
                      </a>
                      {index < cleanFooterTrackingLinks.length - 1 ? <span className="text-cyan-50/36">|</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-cyan-50/70">{language === "en" ? "Copyright © 2026 UK Station · UK Storage · Fulfillment · FBA Prep · Returns" : "Copyright © 2026 英国驿站 · 英国仓储 · 履约 · FBA 中转 · 退货售后"}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function CleanLogisticsHome() {
  const language = useSiteLanguage();

  return (
    <div className="clean-logistics-home">
      <CleanHomeBanner language={language} />
      <div className="mx-auto max-w-7xl space-y-12 px-4 pt-12 pb-0 sm:px-6 lg:px-8">
      <CleanStatsBand language={language} />

      <section className="clean-process-visual clean-process-visual-lite relative overflow-hidden rounded-lg p-6 text-white sm:p-10">
        <Image alt="英国仓操作流程背景" className="clean-process-visual-image object-cover" fill loading="eager" sizes="(min-width: 1024px) 1280px, 100vw" src="/assets/uk-warehouse-home-hero-v2.png" />
        <div className="clean-process-visual-overlay absolute inset-0" />
        <div className="relative">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-200">{language === "en" ? "Workflow" : "操作流程"}</p>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight">{language === "en" ? "Five clear steps from inquiry to dispatch." : "从咨询到发货，五步走清楚。"}</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">{language === "en" ? "Confirm service scope and pricing first, then complete inbound documents. Receiving, shelving, dispatch, returns and billing all have clear checkpoints." : "先确认服务范围和费用，再补齐入仓资料。货到英国仓后，收货、上架、出库、退货和对账都有明确节点。"}</p>
            </div>
          </div>
          <div className="clean-stepper">
            {cleanProcessSteps.map((step) => (
              <div className="clean-step" key={step.title}>
                <div className="relative mb-4 h-28 overflow-hidden rounded-md bg-slate-800">
                  <Image alt={step.title} className="object-cover" fill loading="eager" sizes="(min-width: 1024px) 220px, 100vw" src={step.image} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.4))]" />
                </div>
                <p className="text-xs font-semibold text-[#0E7490]">{step.index}</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">{language === "en" ? step.titleEn : step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{language === "en" ? step.bodyEn : step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CleanNewsSection language={language} />
      <CleanPartnerSection language={language} />
      </div>
      <CleanMegaFooter language={language} />
    </div>
  );
}

function LuxuryMarketingHome() {
  void LegacyLuxuryMarketingHome;
  return <CleanLogisticsHome />;
}

function LegacyLuxuryMarketingHome() {
  return (
    <div className="space-y-10">
      <PremiumBrandHero />
      <PremiumProofRail />
      <PremiumServicePanorama />
      <PremiumWorkflowShowcase />
      <UkFulfillmentGlobeSection />
      <ConversionOfferBand />

      <section className="hidden premium-hero-shell overflow-hidden rounded-lg bg-slate-950 text-white shadow-2xl shadow-slate-950/18">
        <div className="relative min-h-[660px]">
          <Image
            alt="英国仓库现场和客户运营工作台"
            className="motion-media object-cover opacity-80"
            fill
            priority
            sizes="(min-width: 1024px) 1280px, 100vw"
            src="/assets/uk-warehouse-brand-control-desk.png"
          />
          <div className="motion-scanline" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(103,232,249,0.24),transparent_28%),linear-gradient(90deg,rgba(2,6,23,0.98),rgba(2,6,23,0.76),rgba(8,47,73,0.3)),linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.86))]" />
          <div className="relative grid min-h-[660px] gap-8 p-5 sm:p-8 lg:grid-cols-[0.98fr_0.82fr] lg:items-center lg:p-12">
            <div className="reveal-rise max-w-3xl">
              <div className="flex flex-wrap gap-2">
                {["英国本地仓配", "前置库存", "中文跟进"].map((item) => (
                  <span className="rounded-md border border-white/18 bg-white/10 px-3 py-2 text-sm font-semibold text-cyan-50 shadow-sm backdrop-blur" key={item}>
                    {item}
                  </span>
                ))}
              </div>
              <h1 className="premium-wordmark mt-8 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                <span className="block">英国仓配，</span>
                <span className="block text-cyan-100">像本地发货。</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
                面向 Amazon UK、TikTok Shop、eBay、Shopify 卖家，提供英国仓储、一件代发、退货处理和 FBA 补仓。先试仓，再放量，库存、异常和费用都能跟得上。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="premium-button-primary inline-flex min-h-12 items-center gap-2 rounded-md bg-cyan-200 px-5 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-950/20 hover:bg-cyan-100" href={surfaceHref("customer", "/inquiry")}>
                  获取英国仓方案 <ArrowRight size={16} />
                </Link>
                <Link className="premium-button-ghost inline-flex min-h-12 items-center gap-2 rounded-md border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15" href={surfaceHref("marketing", "/services")}>
                  查看服务项目
                </Link>
              </div>

              <div className="hero-platform-rail mt-8 max-w-xl">
                <p className="text-xs font-semibold text-cyan-100">适合这些销售渠道</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {platformBadges.slice(0, 5).map((platform) => (
                    <span className="rounded-md border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-slate-100 backdrop-blur" key={platform}>
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="stagger-in">
              <div className="hero-showcase-card glass-tile p-3 sm:p-4">
                <div className="hero-showcase-image relative min-h-[300px] overflow-hidden rounded-md sm:min-h-[380px]">
                  <Image
                    alt="英国仓配服务画面"
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 480px, 100vw"
                    src="/assets/uk-warehouse-premium-operations.png"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.72)),linear-gradient(90deg,rgba(2,6,23,0.56),transparent)]" />
                  <div className="absolute left-4 top-4 rounded-md border border-white/18 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-cyan-50 backdrop-blur">
                    英国仓实时履约
                  </div>
                  <div className="absolute inset-x-4 bottom-4 grid gap-2 sm:grid-cols-3">
                    {[
                      ["入仓", "到仓拍照"],
                      ["履约", "拣货打包"],
                      ["售后", "退货/FBA"],
                    ].map(([label, value]) => (
                      <div className="rounded-md border border-white/12 bg-white/12 p-3 backdrop-blur-xl" key={label}>
                        <p className="text-xs font-semibold text-cyan-100">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["01", "提交需求"],
                    ["02", "确认报价"],
                    ["03", "试仓入库"],
                  ].map(([step, text]) => (
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/8 p-3" key={step}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-200 text-xs font-bold text-slate-950">{step}</span>
                      <span className="text-sm font-semibold text-slate-100">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hidden luxury-surface signal-band px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">合作前先把关键问题说清楚</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">地址、服务、退货、FBA、库存和费用，能确认再入仓。</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-4xl">
            {premiumProofs.map((item) => (
              <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" key={item}>
                <CheckCircle2 size={16} className="text-[#0E7490]" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="hidden">
        <UkFulfillmentGlobeSection />
        <IndustryServiceOverview />
        <PlatformSolutionSection />
        <ConversionOfferBand />
        <CinematicVisualStory />
      </div>

      <section className="hidden grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="motion-frame image-depth relative min-h-[620px] overflow-hidden rounded-lg bg-slate-950 text-white">
          <Image
            alt="英国仓现场服务"
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 650px, 100vw"
            src="/assets/uk-warehouse-brand-hero.png"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.05),rgba(2,6,23,0.82)),linear-gradient(90deg,rgba(2,6,23,0.62),rgba(2,6,23,0.12))]" />
          <div className="glass-tile absolute inset-x-5 bottom-5 p-5">
            <p className="text-sm font-semibold text-cyan-200">英国仓服务现场</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">不是把货放进仓库就结束，而是让入仓、库存、出库、退货都有清晰状态。</h2>
          </div>
        </div>
        <div className="grid gap-4">
          {homeServiceScenes.map((item) => (
            <Link className="bento-card magnetic-card group grid min-h-[142px] grid-cols-[132px_1fr] overflow-hidden transition sm:grid-cols-[190px_1fr]" href={item.href} key={item.title}>
              <div className="relative bg-slate-100">
                <Image alt={item.title} className="object-cover transition duration-500 group-hover:scale-[1.04]" fill sizes="190px" src={item.image} />
                <div className="absolute inset-0 bg-slate-950/20" />
              </div>
              <div className="flex flex-col justify-center p-4">
                <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="hidden signal-band overflow-hidden rounded-lg bg-slate-950 text-white shadow-2xl shadow-slate-950/16">
        <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
          <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <p className="text-sm font-semibold text-cyan-200">专注型英国仓</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">比“大而全”更重要的，是英国这一段有人管清楚。</h2>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              对起量阶段、多 SKU、多平台、退货和 FBA 需求较多的卖家来说，响应速度、费用透明、库存可视化和细节跟进，比空泛规模更重要。
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-2 lg:p-8">
            {focusedWarehouseAdvantages.map((item) => {
              const Icon = item.icon;
              return (
                <article className="glass-tile magnetic-card p-5" key={item.title}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-200 text-slate-950">
                      <Icon size={20} />
                    </span>
                    <span className="rounded-md border border-white/10 bg-white/8 px-2 py-1 text-xs font-semibold text-cyan-100">{item.proof}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="hidden grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="section-eyebrow">跨境卖家真实痛点</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">把客户最担心的事，放在合作前说清楚。</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">少讲概念，多讲结果：资料、费用、退货、补仓、轨迹和异常，每一项都要能被确认。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {sellerPainPoints.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <Link className="bento-card magnetic-card p-5" href={item.href} key={item.pain}>
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                  <Icon size={19} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.pain}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
                  {item.cta} <ArrowRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="hidden signal-band overflow-hidden rounded-lg border border-cyan-200 bg-cyan-50 shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="bg-slate-950 p-6 text-white sm:p-8 lg:p-10">
            <p className="text-sm font-semibold text-cyan-200">新客户试仓</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">先试仓，再决定是否长期合作。</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">用小批量货件先验证入仓、出库、退货和账单流程。跑通后，再决定是否扩大备货量。</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cyan-200 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-100" href={surfaceHref("customer", "/inquiry?service=trial")}>
                申请试仓方案 <ArrowRight size={16} />
              </Link>
              <Link className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white/10" href={surfaceHref("marketing", "/pricing")}>
                先看费用说明
              </Link>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-2 lg:p-8">
            {trialOffers.slice(0, 4).map((offer) => {
              const Icon = offer.icon;
              return (
                <Link className="bento-card magnetic-card p-5" href={offer.href} key={offer.title}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                      <Icon size={20} />
                    </span>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{offer.badge}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{offer.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{offer.body}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            {headers.map((header) => (
              <th className="border-b border-slate-200 px-4 py-3 font-semibold" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80" key={row.join("-")}>
              {row.map((cell, index) => (
                <td className="px-4 py-3 text-slate-700" key={`${cell}-${index}`}>
                  {index === 4 ? (
                    <StatusBadge tone={cell.includes("异常") || cell.includes("缺") ? "danger" : cell.includes("待") ? "warn" : "good"}>
                      {cell}
                    </StatusBadge>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="mx-auto mt-9 max-w-5xl rounded-lg border border-white/15 bg-slate-950/65 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-md">
      <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-md border border-white/10 bg-white/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-cyan-100">客户运营看板</p>
              <p className="mt-1 text-lg font-semibold text-white">客户能每天打开的英国仓看板</p>
            </div>
            <StatusBadge tone="good">下一步清晰</StatusBadge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["即将到仓", "238 箱", "info"],
              ["可售库存", "328 SKU", "good"],
              ["今日出库", "126 单", "warn"],
              ["费用待确认", "£2,846", "neutral"],
            ].map(([label, value, tone]) => (
              <div className="rounded-md border border-white/10 bg-white/8 p-4" key={label}>
                <p className="text-xs text-slate-300">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                <span className={`mt-3 block h-1.5 rounded-full ${tone === "good" ? "bg-emerald-300" : tone === "warn" ? "bg-amber-300" : tone === "info" ? "bg-cyan-300" : "bg-slate-300"}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-white/8 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">待客户处理</p>
            <ScanLine size={18} className="text-cyan-100" />
          </div>
          <div className="mt-4 space-y-3">
            {["补交 EORI 授权", "确认入库差异照片", "查看本月账单明细", "导入 Shopify 出库订单"].map((item, index) => (
              <div className="grid grid-cols-[28px_1fr_92px] items-center gap-3" key={item}>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-300/15 text-xs font-semibold text-cyan-100">{index + 1}</div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${86 - index * 14}%` }} />
                </div>
                <span className="text-xs leading-4 text-slate-200">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {["入库", "上架", "库存", "出库", "退货", "FBA", "账单", "异常"].map((zone) => (
              <div className="min-h-14 rounded-md border border-white/10 bg-white/5 p-2 text-xs text-slate-200" key={zone}>
                {zone}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WarehouseProofPanel() {
  const visualSteps = [
    {
      title: "到仓验收",
      body: "核对箱数、SKU、装箱单和外箱标签",
      image: "/assets/uk-warehouse-storage-putaway.png",
    },
    {
      title: "库存上架",
      body: "拍照留痕，登记差异，库存同步",
      image: "/assets/uk-warehouse-service.png",
    },
    {
      title: "订单出库",
      body: "拣货复核、称重贴单、尾程交接",
      image: "/assets/uk-warehouse-pick-pack.png",
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-white/15 bg-white/10 p-3 shadow-2xl shadow-slate-950/25 backdrop-blur">
      <div className="grid gap-3 lg:grid-cols-[1.18fr_0.82fr]">
        <div className="motion-frame relative min-h-[430px] overflow-hidden rounded-md border border-white/10 bg-slate-950">
          <Image
            alt="英国海外仓内的货架、包裹和扫码作业"
            className="motion-media object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 580px, 100vw"
            src="/assets/uk-warehouse-home-hero-v2.png"
          />
          <div className="motion-scanline" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.22),rgba(15,23,42,0.12)),linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.82))]" />

          <div className="absolute left-4 top-4 rounded-md border border-white/15 bg-slate-950/68 px-3 py-2 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
            <p className="text-xs font-semibold text-cyan-100">英国仓现场</p>
            <p className="mt-1 text-sm font-semibold">现场作业 · 状态留痕</p>
          </div>

          <div className="motion-float absolute bottom-4 left-4 right-4 rounded-lg border border-white/15 bg-slate-950/76 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold text-cyan-100">客户最关心的结果</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">货到哪、库存多少、费用从哪来</h3>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950">
                <span className="motion-pulse status-dot bg-emerald-700" />
                在线可查
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                ["到仓", "已验收 12 箱"],
                ["库存", "待上架复核"],
                ["费用", "来源可核对"],
              ].map(([label, value]) => (
                <div className="motion-progress rounded-md border border-white/10 bg-white/8 p-3" key={label}>
                  <p className="text-xs text-slate-300">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {visualSteps.map((step, index) => (
            <div className="motion-frame relative min-h-[132px] overflow-hidden rounded-md border border-white/10 bg-slate-950" key={step.title}>
              <Image
                alt={`英国仓${step.title}`}
                className="motion-media object-cover"
                fill
                sizes="(min-width: 1024px) 390px, 100vw"
                src={step.image}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.86),rgba(15,23,42,0.26))]" />
              <div className="absolute inset-0 flex items-center gap-4 p-4 text-white">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/12 font-mono text-sm font-semibold backdrop-blur">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-1 max-w-xs text-sm leading-6 text-slate-200">{step.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["入仓", "资料先核对，到仓少异常"],
          ["履约", "订单出库后，追踪号可回传"],
          ["售后", "退货、换标、FBA 补仓可跟进"],
        ].map(([title, body]) => (
          <div className="rounded-md border border-white/10 bg-white/8 p-3" key={title}>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PremiumProofRail() {
  const items = [...premiumProofs, ...premiumProofs];

  return (
    <section className="luxury-surface px-4 py-4 sm:px-5">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-slate-950">先判断是否适合，再进入报价</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">把英国仓合作最关键的确认点放在前面。</p>
        </div>
        <div className="premium-marquee">
          <div className="premium-marquee-track">
            {items.map((item, index) => (
              <span className="shine-edge inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" key={`${item}-${index}`}>
                <CheckCircle2 size={16} className="text-[#0E7490]" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PremiumExperienceSection() {
  return (
    <section className="luxury-surface p-5 sm:p-6 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
        <SectionTitle
          eyebrow="成熟英国仓体验"
          title="打开首页，就能判断英国仓是否适合您"
          body="把仓库现场、服务范围、入仓流程、退货处理和费用来源放在一起，先看清楚，再决定是否合作。"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["真实", "现场、流程和客户结果放在一起"],
            ["清晰", "按报价、入仓、出库、售后分层"],
            ["可靠", "地址、中文客服、费用来源可核对"],
          ].map(([label, body]) => (
            <div className="rounded-md border border-slate-200 bg-white/82 p-4 shadow-sm backdrop-blur" key={label}>
              <p className="text-sm font-semibold text-slate-950">{label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {premiumExperienceCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <article className={`bento-card reveal-rise group ${index === 0 ? "lg:row-span-2" : ""}`} key={card.title}>
              <div className={`${index === 0 ? "min-h-[420px]" : "min-h-[236px]"} motion-frame relative bg-slate-950`}>
                <Image
                  alt={card.title}
                  className="motion-media object-cover opacity-95 transition duration-700 group-hover:scale-[1.05]"
                  fill
                  sizes={index === 0 ? "(min-width: 1024px) 390px, 100vw" : "(min-width: 1024px) 390px, 100vw"}
                  src={card.image}
                />
                <div className="motion-scanline" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.78))]" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-white/15 bg-slate-950/62 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur">
                  <Icon size={15} className="text-cyan-100" />
                  {card.meta}
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-semibold text-slate-950">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
              </div>
            </article>
          );
        })}

        <div className="reveal-rise shine-edge flex min-h-[236px] flex-col justify-between overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/16 lg:col-span-2">
          <div>
            <p className="text-sm font-semibold text-cyan-200">每一步都有记录</p>
            <h3 className="mt-2 max-w-xl text-2xl font-semibold">货到哪一步、费用从哪里来、异常谁来处理，都要讲得清楚。</h3>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["入仓", "资料齐不齐"],
              ["履约", "订单走到哪"],
              ["售后", "退货怎么处理"],
            ].map(([label, value]) => (
              <div className="rounded-md border border-white/10 bg-white/8 p-4" key={label}>
                <p className="text-xs text-slate-300">{label}</p>
                <p className="mt-1 text-base font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandImageStackSection() {
  const largeScene = brandImageScenes.find((scene) => scene.size === "large") ?? brandImageScenes[0];
  const sideScenes = brandImageScenes.filter((scene) => scene.size !== "large");
  const LargeIcon = largeScene.icon;

  return (
    <section className="luxury-surface p-4 sm:p-5 lg:p-6">
      <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="motion-frame image-depth group relative min-h-[520px] overflow-hidden rounded-lg bg-slate-950">
          <Image
            alt={largeScene.title}
            className="motion-media object-cover transition duration-700 group-hover:scale-[1.04]"
            fill
            priority
            sizes="(min-width: 1024px) 690px, 100vw"
            src={largeScene.image}
          />
          <div className="motion-scanline" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,9,24,0.78),rgba(4,9,24,0.18)),linear-gradient(180deg,transparent,rgba(4,9,24,0.58))]" />
          <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-md border border-white/15 bg-slate-950/62 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur">
            <LargeIcon size={15} className="text-cyan-100" />
            {largeScene.meta}
          </div>
          <div className="absolute inset-x-5 bottom-5 max-w-xl rounded-lg border border-white/15 bg-slate-950/76 p-5 text-white shadow-2xl backdrop-blur">
            <p className="text-sm font-semibold text-cyan-200">英国仓服务现场</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">{largeScene.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{largeScene.body}</p>
          </div>
        </article>

        <div className="grid gap-4">
          {sideScenes.map((scene) => {
            const Icon = scene.icon;
            return (
              <article
                className={`motion-frame image-depth group relative overflow-hidden rounded-lg bg-slate-950 ${scene.size === "wide" ? "min-h-[250px]" : "min-h-[235px]"}`}
                key={scene.title}
              >
                <Image
                  alt={scene.title}
                  className="object-cover transition duration-700 group-hover:scale-[1.04]"
                  fill
                  sizes="(min-width: 1024px) 570px, 100vw"
                  src={scene.image}
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,9,24,0.8),rgba(4,9,24,0.12)),linear-gradient(180deg,transparent,rgba(4,9,24,0.62))]" />
                <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/15 bg-slate-950/72 p-4 text-white shadow-2xl backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-100">
                      <Icon size={15} />
                      {scene.meta}
                    </span>
                    <span className="rounded-md bg-cyan-200 px-2 py-1 text-xs font-semibold text-slate-950">可跟进</span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold">{scene.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{scene.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FocusedWarehousePositioning() {
  return (
    <section className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-2xl shadow-slate-950/16">
      <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold text-cyan-200">专注型英国仓</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">不是所有卖家都需要“大而全”，您更需要有人把英国这一段跑顺</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            对起量阶段、多平台、多 SKU、退货和 FBA 需求较多的中国卖家来说，真正重要的是响应、透明、灵活和有人跟进。我们把英国本地履约这件事做清楚，让您先跑通，再放大。
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {[
              ["适合", "试仓、起量、多 SKU、退货/FBA"],
              ["优势", "沟通短、反馈快、费用拆清楚"],
            ].map(([label, value]) => (
              <div className="rounded-md border border-white/10 bg-white/8 p-4" key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 bg-white/6 p-5 sm:p-6 md:grid-cols-2 lg:p-8">
          {focusedWarehouseAdvantages.map((item) => {
            const Icon = item.icon;
            return (
              <article className="shine-edge rounded-lg border border-white/10 bg-white/8 p-5 backdrop-blur" key={item.title}>
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cyan-200 text-slate-950">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/8 px-2 py-1 text-xs font-semibold text-cyan-100">{item.proof}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const assuranceItems = [
  ["入仓前", "先确认 SKU、外箱标签、装箱单、ETA 和送仓方式，减少到仓异常。"],
  ["到仓后", "验收、拍照、差异登记、库位上架，库存状态可继续跟进。"],
  ["出库时", "按订单拣货复核、称重打包、交接尾程，追踪号用于回传。"],
  ["售后端", "英国退货接收、质检拍照、换标重上架、FBA 补仓按规则处理。"],
];

function AssuranceBand() {
  return (
    <section className="premium-panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold text-cyan-200">英国仓交付标准</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">不用研究仓库规则，也能知道下一步该做什么</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            海外仓服务可以拆成卖家能理解的四个阶段：发货前准备、到仓处理、订单出库、退货和 FBA。每一阶段都有资料、状态和费用来源。
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ["仓库", "英国本地节点"],
              ["客服", "中文跟进"],
              ["记录", "状态与费用可查"],
            ].map(([label, value]) => (
              <div className="rounded-md border border-white/10 bg-white/6 p-3" key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-2 lg:p-8">
          {assuranceItems.map(([title, body], index) => (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={title}>
              <p className="font-mono text-xs font-semibold text-[#0E7490]">0{index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OperationsMotionStory() {
  const steps = [
    ["01", "资料预审", "SKU、装箱单、外箱标签先确认"],
    ["02", "到仓验收", "扫码、拍照、差异记录"],
    ["03", "上架可售", "库存状态同步给客户"],
    ["04", "出库对账", "订单、追踪号和费用可核对"],
  ];

  return (
    <section className="premium-panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="section-eyebrow">实时作业状态</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">从到仓到出库，每一步都有记录</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            入仓前先核对资料，到仓后拍照验收，上架后同步库存，出库后追踪号和费用都能继续核对。
          </p>
          <div className="mt-7 grid gap-3">
            {steps.map(([index, title, body]) => (
              <div className="motion-progress rounded-lg border border-slate-200 bg-slate-50 p-4" key={title}>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 font-mono text-xs font-semibold text-white">{index}</span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">{title}</span>
                    <span className="mt-1 block text-sm leading-6 text-slate-600">{body}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="motion-frame relative min-h-[520px] bg-slate-950">
          <Image
            alt="英国仓现场作业动画感画面"
            className="motion-media object-cover"
            fill
            sizes="(min-width: 1024px) 620px, 100vw"
            src="/assets/uk-warehouse-premium-operations.png"
          />
          <div className="motion-scanline" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.78),rgba(15,23,42,0.2)),linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.72))]" />
          <div className="absolute left-5 top-5 rounded-lg border border-white/15 bg-white/12 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">live workflow</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">ASN-UK-240531</h3>
            <p className="mt-1 text-sm text-slate-300">到仓验收中 · Bay A-16</p>
          </div>
          <div className="motion-float absolute bottom-5 left-5 right-5 rounded-lg border border-white/15 bg-slate-950/82 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["外箱", "12 箱", "已识别"],
                ["差异", "0 项", "可上架"],
                ["费用", "待生成", "来源可查"],
              ].map(([label, value, note]) => (
                <div className="rounded-md border border-white/10 bg-white/8 p-3" key={label}>
                  <p className="text-xs text-slate-300">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                  <p className="mt-1 text-xs text-cyan-100">{note}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="motion-float motion-float-delay absolute right-5 top-1/2 hidden w-52 -translate-y-1/2 rounded-lg border border-emerald-200/30 bg-emerald-300/14 p-4 text-white shadow-2xl shadow-slate-950/20 backdrop-blur md:block">
            <div className="flex items-center gap-2">
              <span className="motion-pulse status-dot bg-emerald-300" />
              <p className="text-sm font-semibold">状态已同步</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-50">客户可在工作台查看到仓、异常和下一步。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobilePortalPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/12">
      <div className="motion-frame relative min-h-[520px] bg-slate-100">
        <Image
          alt="客户用手机查看英国仓库存、进度和费用状态"
          className="motion-media object-cover"
          fill
          sizes="(min-width: 1024px) 560px, 100vw"
          src="/assets/uk-warehouse-premium-mobile-ops.png"
        />
        <div className="motion-scanline" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.76))]" />
      </div>

      <div className="motion-float absolute inset-x-4 bottom-4 rounded-lg border border-white/18 bg-slate-950/82 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-cyan-200">手机客户操作</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">先看进度，再处理货件</h3>
          </div>
          <span className="rounded-md bg-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-slate-950">在线</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {mobileActions.map((item) => (
            <div className="rounded-md border border-white/10 bg-white/8 p-3" key={item.title}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <span className="rounded-md bg-cyan-200 px-2 py-1 text-xs font-semibold text-slate-950">{item.value}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-300">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrimaryActionCards({ onOpenCustomer, showWorkspacePreview }: { onOpenCustomer: () => void; showWorkspacePreview: boolean }) {
  const actions = showWorkspacePreview ? primaryActions : primaryActions.filter((action) => action.title !== "登录查看库存");

  return (
    <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
      <div>
        <SectionTitle
          eyebrow="下一步怎么做"
          title="我现在处在哪一步？"
          body="不管您还在比价、准备入仓、已经发货还是想查状态，都可以从这里直接进入下一步。"
        />
        {showWorkspacePreview ? (
          <button
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={onOpenCustomer}
          >
            预览客户工作台 <LayoutDashboard size={16} />
          </button>
        ) : null}
      </div>
      <div className={`grid gap-3 sm:grid-cols-2 ${showWorkspacePreview ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              className={`group flex min-h-[184px] flex-col justify-between rounded-lg border p-5 shadow-sm ${
                action.highlight
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950 hover:border-cyan-200 hover:bg-cyan-50/35"
              }`}
              href={action.href}
              key={action.title}
            >
              <span>
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-md ${
                    action.highlight ? "bg-cyan-200 text-slate-950" : "bg-slate-950 text-white"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <span className={`mt-4 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${action.highlight ? "bg-white/10 text-cyan-100" : "bg-cyan-50 text-[#0E7490]"}`}>
                  {action.stage}
                </span>
                <span className="mt-3 block text-base font-semibold">{action.title}</span>
                <span className={`mt-2 block text-sm leading-6 ${action.highlight ? "text-slate-200" : "text-slate-600"}`}>
                  {action.desc}
                </span>
              </span>
              <span className={`mt-5 inline-flex items-center gap-1 text-sm font-semibold ${action.highlight ? "text-cyan-100" : "text-[#0E7490]"}`}>
                {action.cta} <ArrowRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function PageArchitectureSection() {
  const surface = currentSurface();
  if (surface === "marketing") return null;
  const visibleGroups = pageArchitecture;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <SectionTitle
          eyebrow="页面分类"
          title="先分清三套入口：客户官网、客户登录页、海外仓后台"
          body="公开网页负责客户理解和转化；客户登录后查看自己的库存、货件、账单和待处理事项；内部人员使用后台处理询盘、入库和报价。"
        />
        <div className="grid gap-3 md:grid-cols-3">
          {visibleGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Link className="group flex min-h-[296px] flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-cyan-200 hover:bg-white" href={group.href} key={group.title}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-[#0E7490] shadow-sm">
                    <Icon size={20} />
                  </span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${toneClass(group.tone)}`}>{group.audience}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{group.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{group.purpose}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.routes.map((route) => (
                    <span className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-500" key={route}>
                      {route}
                    </span>
                  ))}
                </div>
                <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[#0E7490]">
                  {group.cta} <ChevronRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function InboundReadiness() {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg bg-slate-950 p-5 text-white sm:p-6">
        <p className="text-sm font-semibold text-cyan-200">入库前 5 步</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">不懂仓库术语也没关系，按 5 步把货顺利送进仓</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          把复杂的仓储规则翻译成中国卖家熟悉的话：先建 SKU，再做预报，贴好外箱标签，预约送仓，到仓后在线确认差异。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100" href={surfaceHref("customer", "/inbound")}>
            创建入库预报 <ArrowRight size={16} />
          </Link>
        </div>
      </div>
      <div className="metric-card p-5 sm:p-6">
        <div className="grid gap-3">
          {inboundRequirements.map(([title, body], index) => (
            <div className="grid grid-cols-[38px_1fr] gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4" key={title}>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-sm font-semibold text-[#0E7490] shadow-sm">
                {index + 1}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceScopeSection() {
  return (
    <section className="-mx-4 border-y border-slate-200 bg-white px-4 py-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <SectionTitle
            eyebrow="服务包含什么"
            title="从货到英国仓，到订单出库、退货和 FBA 补仓，都讲清楚"
            body="中国卖家第一次看网站时，最想判断三件事：能不能做、需要准备什么、下一步从哪里开始。这里直接给出服务、资料和入口。"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["咨询报价", "先确认服务范围和费用结构"],
              ["入仓准备", "把外箱标签、装箱单和 ETA 补齐"],
              ["日常运营", "库存、订单、异常和账单在线跟进"],
            ].map(([title, body]) => (
              <div className="border-l-2 border-cyan-500 bg-slate-50 px-4 py-3" key={title}>
                <p className="text-sm font-semibold text-slate-950">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article className="metric-card group flex min-h-[360px] flex-col p-5" key={service.title}>
                <div className={`h-1.5 w-16 rounded-full ${serviceAccentClass(service.accent, "bar")}`} />
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ring-1 ${serviceAccentClass(service.accent, "icon")}`}>
                    <Icon size={23} />
                  </div>
                  <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${serviceAccentClass(service.accent, "chip")}`}>
                    {service.metric}
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{service.subtitle}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{service.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{service.desc}</p>
                </div>

                <div className="mt-5 space-y-3 text-sm leading-6">
                  <div>
                    <p className="font-semibold text-slate-950">客户准备</p>
                    <p className="mt-1 text-slate-600">{service.client}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">仓库处理</p>
                    <p className="mt-1 text-slate-600">{service.warehouse}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {service.flow.map((item) => (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600" key={item}>
                      {item}
                    </span>
                  ))}
                </div>

                <Link className={`mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold ${serviceAccentClass(service.accent, "link")}`} href={service.href}>
                  {service.cta} <ChevronRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SellerScenarioSection() {
  return (
    <section>
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
        <SectionTitle
          eyebrow="按卖家场景选择"
          title="不同平台的卖家，先看自己最常遇到的问题"
          body="按您的销售渠道快速判断服务重点，先确认能不能做、怎么做，再准备报价资料。"
        />
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
          询价时建议准备：平台、品类、SKU 数、月单量、平均重量尺寸、退货比例、是否需要 FBA、是否需要拍照/换标/打托。
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sellerScenarios.map((item) => {
          const Icon = item.icon;
          return (
            <Link className="metric-card flex min-h-[292px] flex-col p-5 hover:border-cyan-300 hover:bg-cyan-50/35" href={item.href} key={item.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
                <Icon size={20} />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.pain}</p>
              <p className="mt-3 text-sm leading-6 text-slate-800">{item.service}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[#0E7490]">
                咨询对应方案 <ChevronRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function HomeServiceVisuals() {
  return (
    <section>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <SectionTitle
          eyebrow="服务场景"
          title="先看货在英国仓会经历哪些关键动作"
          body="把最常见的四类场景放在首页：入仓上架、订单出库、FBA 补仓、退货处理。您可以快速判断您的货是否适合进入英国仓。"
        />
        <Link className="inline-flex w-fit min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50" href={surfaceHref("marketing", "/services")}>
          查看全部服务 <ArrowRight size={16} />
        </Link>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {homeServiceScenes.map((item) => (
          <Link className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-xl hover:shadow-slate-950/8" href={item.href} key={item.title}>
            <div className="relative min-h-48 bg-slate-100">
              <Image
                alt={item.title}
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                fill
                loading="eager"
                sizes="(min-width: 1280px) 280px, (min-width: 768px) 50vw, 100vw"
                src={item.image}
              />
            </div>
            <div className="p-4">
              <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FirstVisitGuide() {
  const guide = [
    {
      title: "还没合作",
      body: "先提交平台、品类、货量和服务需求。",
      href: surfaceHref("customer", "/inquiry"),
      cta: "获取报价",
      icon: FileText,
    },
    {
      title: "想先算费用",
      body: "先看仓储、出库、退货和 FBA 费用说明。",
      href: surfaceHref("marketing", "/pricing"),
      cta: "查看费用",
      icon: ReceiptText,
    },
    {
      title: "已有货要入仓",
      body: "先建 SKU，再提交入库预报和到仓资料。",
      href: surfaceHref("customer", "/inbound"),
      cta: "创建预报",
      icon: PackageCheck,
    },
    {
      title: "已经提交过",
      body: "用询盘编号、ASN、手机号或追踪号查状态。",
      href: surfaceHref("customer", "/portal"),
      cta: "登录查看",
      icon: Search,
    },
  ];

  return (
    <section className="premium-panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold text-cyan-200">第一次来先看这里</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">不用猜入口，按您现在的阶段开始</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            我们把英国仓服务拆成四个最常见动作：问报价、看费用、准备入仓、查进度。客户不用先理解系统，只要选择当前阶段。
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-2 lg:p-8 xl:grid-cols-4">
          {guide.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="group flex min-h-52 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-200 hover:bg-cyan-50/35" href={item.href} key={item.title}>
                <span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
                    <Icon size={19} />
                  </span>
                  <span className="mt-5 block text-lg font-semibold tracking-tight text-slate-950">{item.title}</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{item.body}</span>
                </span>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
                  {item.cta} <ArrowRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SellerPainPointSection() {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="space-y-5">
        <SectionTitle
          eyebrow="卖家真实痛点"
          title="您需要的不只是一个仓库，而是问题有人跟进"
          body="跨境卖家最担心的是费用是否透明、退货怎么处理、FBA 能不能补、库存和异常能不能看见。我们把这些问题放到合作前就说清楚。"
        />
        <div className="motion-frame relative min-h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm">
          <Image
            alt="英国仓处理包裹、退货和库存记录"
            className="motion-media object-cover"
            fill
            sizes="(min-width: 1024px) 420px, 100vw"
            src="/assets/uk-warehouse-return-inspection.png"
          />
          <div className="motion-scanline" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.78))]" />
          <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/15 bg-slate-950/78 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
            <p className="text-xs font-semibold text-cyan-100">您最关心的事</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">费用、退货、补仓和异常，直接讲清楚</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">把每个环节对应到客户能查看、能确认、能继续处理的状态。</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sellerPainPoints.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <Link className="group flex min-h-[238px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-200 hover:bg-cyan-50/35" href={item.href} key={item.pain}>
              <span>
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                  <Icon size={19} />
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">{item.pain}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.worry}</p>
                <p className="mt-3 text-sm leading-6 text-slate-800">{item.answer}</p>
              </span>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
                {item.cta} <ArrowRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TrialOfferSection() {
  return (
    <section className="overflow-hidden rounded-lg border border-cyan-200 bg-cyan-50 shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold text-cyan-200">新客户试仓</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">先试仓，再决定是否长期合作</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            第一次合作可以先用小批量货件验证入仓、出库、退货和费用核对流程。跑通后，再决定是否扩大备货量。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100" href={surfaceHref("customer", "/inquiry?service=trial")}>
              申请试仓方案 <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10" href={surfaceHref("marketing", "/pricing")}>
              先看费用说明
            </Link>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-2 lg:p-8">
          {trialOffers.map((offer) => {
            const Icon = offer.icon;
            return (
              <Link className="group rounded-lg border border-cyan-200 bg-white p-5 shadow-sm hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-950/8" href={offer.href} key={offer.title}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{offer.badge}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{offer.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{offer.body}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{offer.note}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MarketingStartSection() {
  return (
    <section className="quiet-panel p-5 sm:p-6 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-[0.74fr_1.26fr] lg:items-end">
        <SectionTitle
          eyebrow="开始合作"
          title="先确认服务范围，再准备入仓"
          body="正在评估英国仓，可以先看费用说明或提交询盘；已经有货要发英国，可以直接准备入仓预报。"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["先看费用", "了解仓储、出库、退货和 FBA 费用说明。", surfaceHref("marketing", "/pricing"), ReceiptText],
            ["提交询盘", "告诉我们平台、品类、SKU、货量和服务需求。", surfaceHref("customer", "/inquiry"), FileText],
            ["准备入仓", "已有货件时，提交入库预报和到仓资料。", surfaceHref("customer", "/inbound"), PackageCheck],
          ].map(([title, body, href, Icon]) => {
            const TypedIcon = Icon as LucideIcon;
            return (
              <Link className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-cyan-200 hover:bg-cyan-50/35" href={href as string} key={title as string}>
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white transition group-hover:bg-[#0E7490]">
                  <TypedIcon size={18} />
                </span>
                <span className="mt-4 block text-sm font-semibold text-slate-950">{title as string}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{body as string}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
                  进入 <ArrowRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SiteView({ onOpenCustomer, showWorkspacePreview }: { onOpenCustomer: () => void; showWorkspacePreview: boolean }) {
  const surface = currentSurface();
  const showInternalPlanning = surface !== "marketing";
  const isMarketing = surface === "marketing";

  if (isMarketing) {
    return <LuxuryMarketingHome />;
  }

  return (
    <div className="space-y-16">
      <section className="hero-bg overflow-hidden rounded-lg shadow-2xl shadow-slate-950/10">
        <div className="grid gap-8 px-5 py-8 text-white sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end lg:px-12 lg:py-12">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold backdrop-blur">
                <ShieldCheck size={16} />
                英国本地仓储、一件代发、退货与 FBA 中转
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold backdrop-blur">
                <Globe2 size={16} />
                英国本地履约
              </span>
            </div>

            <div className="mt-10 max-w-4xl">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                英国海外仓，帮中国卖家把本地发货做稳。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg">
                面向 Amazon UK、eBay、TikTok Shop、Shopify 和外贸客户，提供英国仓储、一件代发、FBA 中转、退货换标和本地尾程派送。您只需要知道怎么入仓、费用怎么算、货到哪一步。
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-cyan-50" href={surfaceHref("customer", "/inquiry")}>
                获取英国仓报价 <ReceiptText size={16} />
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur hover:bg-white/15" href={surfaceHref("marketing", "/pricing")}>
                查看费用说明 <FileText size={16} />
              </Link>
              {!isMarketing ? <Link className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur hover:bg-white/15" href={surfaceHref("customer", "/inbound")}>
                我有货要入仓 <PackageCheck size={16} />
              </Link> : null}
              {!isMarketing ? <Link className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur hover:bg-white/15" href={surfaceHref("customer", "/tracking")}>
                查进度 <Search size={16} />
              </Link> : null}
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div className="rounded-md border border-white/15 bg-white/10 p-4 backdrop-blur" key={metric.label}>
                  <p className="text-xs text-slate-200">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-300">{metric.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            {isMarketing ? <WarehouseProofPanel /> : <HeroDashboard />}
            <div className="mt-4 hidden grid-cols-3 gap-3 text-xs text-slate-200 lg:grid">
              {["资料预审", "到仓上架", "费用对账"].map((item) => (
                <div className="rounded-md border border-white/10 bg-white/8 px-3 py-2 backdrop-blur" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isMarketing ? (
        <>
          <PremiumProofRail />
          <BrandImageStackSection />
          <HomeServiceVisuals />
          <FocusedWarehousePositioning />
          <SellerPainPointSection />
          <TrialOfferSection />
          <MarketingStartSection />
        </>
      ) : (
        <>
      {showInternalPlanning ? <PageArchitectureSection /> : null}

      {isMarketing ? <PremiumProofRail /> : null}

      {isMarketing ? <BrandImageStackSection /> : null}

      {isMarketing ? <PremiumExperienceSection /> : null}

      {isMarketing ? <FocusedWarehousePositioning /> : null}

      <FirstVisitGuide />

      <SellerPainPointSection />

      <TrialOfferSection />

      {showWorkspacePreview ? <PrimaryActionCards onOpenCustomer={onOpenCustomer} showWorkspacePreview={showWorkspacePreview} /> : null}

      <OperationsMotionStory />

      <AssuranceBand />

      <SellerScenarioSection />

      <HomeServiceVisuals />

      <ServiceScopeSection />

      <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <SectionTitle
            eyebrow="为什么选择我们"
            title="不只给一个仓储价格，而是把英国履约流程讲清楚"
            body="新客户先判断能不能做、怎么入仓、费用从哪里来；合作后可以继续跟进入库、库存、订单、退货、异常和账单。"
          />
          <div className="mt-6 flex flex-wrap gap-2">
            {platformBadges.map((platform) => (
              <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" key={platform}>
                {platform}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div className="metric-card p-5" key={item.label}>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                  <Icon size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{item.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <InboundReadiness />

      <section className={showInternalPlanning ? "grid gap-5 lg:grid-cols-[1.05fr_0.95fr]" : "grid gap-5"}>
        <div className="metric-card p-5 sm:p-6">
          <SectionTitle
            eyebrow="价格与计费"
            title="先把费用说清楚，再决定是否入仓"
            body="中国卖家最怕费用黑箱。官网先讲清仓储费、入库费、出库操作费、尾程费、退货和 FBA 增值费，客户登录后再核对来源单据。"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {pricingRules.map((rule) => {
              const Icon = rule.icon;
              return (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={rule.title}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#0E7490] shadow-sm">
                      <Icon size={18} />
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-500">{rule.trigger}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-950">{rule.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{rule.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {showInternalPlanning ? <div className="metric-card p-5 sm:p-6">
          <SectionTitle
            eyebrow="订单导入方式"
            title="先用 Excel/CSV 快速开始，后续按订单量接入平台 API"
            body="客户可以先用表格或人工录入开始处理订单、SKU 和入库资料；订单稳定后，再按渠道评估自动同步。"
          />
          <div className="mt-6 space-y-3">
            {integrationStages.map(([stage, title, body]) => (
              <div className="rounded-lg border border-slate-200 bg-white p-4" key={stage}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{stage}</p>
                  <StatusBadge tone={stage === "快速开始" ? "good" : stage === "订单量稳定后" ? "warn" : "info"}>{title}</StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-sm font-semibold text-cyan-900">阶段判断</p>
            <p className="mt-2 text-sm leading-6 text-cyan-800">
              第一阶段卖的是“真实可执行的英国仓流程 + 清楚的客户跟进方式”，不是空喊全平台自动化。客户先能入仓、发货、退货和对账，接口可以按业务量逐步接。
            </p>
          </div>
        </div> : null}
      </section>

      <section className="rounded-lg bg-slate-950 p-5 text-white sm:p-7 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold text-cyan-200">业务工作流</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">从发货前准备到英国本地交付，每一步都可确认</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              客户最需要知道的是现在处在哪一步、还差什么资料、仓库接下来做什么、费用为什么产生。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100" href={surfaceHref("customer", "/inquiry?service=trial")}>
                按步骤查看流程 <ArrowRight size={16} />
              </Link>
              <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10" href={surfaceHref("customer", "/inbound")}>
                提交入仓计划
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {workflow.map(([step, title, body]) => (
              <div className="rounded-md border border-white/10 bg-white/5 p-4" key={step}>
                <p className="text-xs font-semibold text-cyan-200">{step}</p>
                <h3 className="mt-2 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {showWorkspacePreview ? (
        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="metric-card min-w-0 p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0E7490]">客户登录后页面</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">卖家每天打开的英国库存中控台</h2>
              </div>
              <StatusBadge tone="good">库存可查</StatusBadge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {customerMetrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>
            <div className="mt-5 overflow-x-auto">
              <MiniTable headers={["入库单", "客户", "方式", "数量", "状态", "备注"]} rows={inboundRows} />
            </div>
          </div>
          <div className="metric-card p-5 sm:p-6">
            <p className="text-sm font-semibold text-[#0E7490]">下一步入口</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">让客户按当前阶段直接行动</h2>
            <div className="mt-5 space-y-3">
              {[
                ["提交合作询盘", "适合还在比价、确认品类和服务范围的新客户。", FileText],
                ["创建入库预报", "适合已经准备发货，需要仓库提前识别货件的客户。", PackageCheck],
                ["客户登录查看", "适合已注册客户查看库存、订单、账单和异常处理状态。", LayoutDashboard],
              ].map(([title, body, Icon]) => {
                const TypedIcon = Icon as LucideIcon;
                const href = title === "提交合作询盘" ? surfaceHref("customer", "/inquiry") : title === "创建入库预报" ? surfaceHref("customer", "/inbound") : surfaceHref("customer", "/login");
                return (
                  <Link
                    className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                    href={href}
                    key={title as string}
                    onClick={title === "客户登录查看" ? onOpenCustomer : undefined}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                      <TypedIcon size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">{title as string}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{body as string}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="quiet-panel p-5 sm:p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <SectionTitle
              eyebrow="开始合作"
              title="从了解费用、确认服务到准备入仓，都可以直接开始"
              body="还没合作可以先看费用和服务范围；已经准备发货，可以直接提交入库预报；已有单号或 ASN，可以随时查进度。"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["我要先了解费用", "适合还在比较英国仓成本的卖家。", surfaceHref("marketing", "/pricing"), ReceiptText],
                ["我要确认能不能做", "提交平台、品类、货量和退货/FBA 需求。", surfaceHref("customer", "/inquiry"), FileText],
                ["我已经准备入仓", "创建入库预报，补齐装箱单和外箱标签。", surfaceHref("customer", "/inbound"), PackageCheck],
              ].map(([title, body, href, Icon]) => {
                const TypedIcon = Icon as LucideIcon;
                return (
                  <Link className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-cyan-200 hover:bg-cyan-50/40" href={href as string} key={title as string}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                      <TypedIcon size={18} />
                    </span>
                    <span className="mt-4 block text-sm font-semibold text-slate-950">{title as string}</span>
                    <span className="mt-2 block text-sm leading-6 text-slate-600">{body as string}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <SectionTitle
            eyebrow="移动端客户操作"
            title="客户不一定坐在电脑前，但异常确认不能等"
            body="移动端优先服务高频轻操作：查状态、确认异常、补交资料、看账单、联系客户服务。复杂批量操作仍保留在桌面端。"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["手机查库存", "可售、锁定、在途、异常库存用摘要卡片展示。"],
              ["手机确认异常", "入库差异、退货质检、地址问题可以直接确认处理方案。"],
              ["手机补资料", "装箱单、外箱标签、SKU 图片、授权文件支持拍照/相册上传。"],
              ["手机看账单", "费用来源、账单状态、付款凭证上传都要能快速完成。"],
            ].map(([title, body]) => (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={title}>
                <CheckCircle2 size={18} className="text-[#0E7490]" />
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
        <MobilePortalPreview />
      </section>
        </>
      )}

      {showInternalPlanning ? <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="metric-card p-5 sm:p-6">
          <SectionTitle
            eyebrow="仓库执行"
            title="仓库后台不能只看数据，要能指导扫码作业"
            body="真正有价值的仓库系统不应该增加理解成本，而是让每个动作都减少错收、错拣、错发，并留下可追溯记录。"
          />
          <div className="mt-6 space-y-3">
            {scanFlow.map(([title, value, body], index) => (
              <div className="grid grid-cols-[36px_1fr] gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4" key={title}>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">{index + 1}</div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950">{title}</p>
                    <span className="font-mono text-xs text-slate-500">{value}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-slate-950 p-5 text-white sm:p-6">
          <p className="text-sm font-semibold text-cyan-200">质量门禁</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">每轮开发都必须过这四条</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            这不是文档摆设，而是之后产品、前端、后端、仓库流程一起验收的标准。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {qualityGates.map(([title, body]) => (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4" key={title}>
                <CheckCircle2 size={18} className="text-cyan-200" />
                <h3 className="mt-3 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section> : null}
    </div>
  );
}

function CustomerPortal() {
  return (
    <div className="grid gap-5 xl:grid-cols-[248px_1fr]" id="customer-workspace">
      <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 rounded-md bg-slate-950 p-4 text-white">
          <p className="text-xs text-slate-300">客户账号</p>
          <p className="mt-1 font-semibold">深圳蓝海科技</p>
          <p className="mt-2 text-xs text-slate-400">Amazon / TikTok / Shopify</p>
        </div>
        {["工作台", "入库管理", "库存管理", "订单履约", "退货换标", "FBA 中转", "费用账单", "异常中心", "店铺与渠道"].map((item, index) => (
          <button
            className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium ${
              index === 0 ? "bg-[#0E7490] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
            key={item}
          >
            {item}
            {index === 7 ? <span className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-600">6</span> : null}
          </button>
        ))}
      </aside>

      <main className="space-y-5">
        <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
          <div>
            <p className="text-sm text-slate-500">客户工作台 / 英国仓履约管理</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">英国仓业务工作台</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-md bg-[#0E7490] px-3 py-2 text-sm font-semibold text-white">
              <PackageCheck size={16} /> 新建入库
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
              <ShoppingCart size={16} /> 导入订单
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
              <RefreshCcw size={16} /> 创建退货
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {customerMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {customerFlows.map((flow) => (
            <button className="metric-card flex min-h-36 flex-col justify-between p-5 text-left hover:border-cyan-300 hover:bg-cyan-50/30" key={flow.title}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-950">{flow.title}</h3>
                  <StatusBadge tone={flow.tone}>{flow.action}</StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{flow.desc}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0E7490]">
                进入流程 <ChevronRight size={15} />
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="metric-card p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">入库预报</h3>
                  <p className="text-sm text-slate-500">客户能看到头程、清关、到仓和差异状态。</p>
                </div>
                <Search size={18} className="text-slate-400" />
              </div>
              <div className="overflow-x-auto">
                <MiniTable headers={["入库单", "客户", "方式", "数量", "状态", "备注"]} rows={inboundRows} />
              </div>
            </div>

            <div className="metric-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">订单履约</h3>
                  <p className="text-sm text-slate-500">先支持手工/CSV，后续接平台 API。</p>
                </div>
                <Truck size={18} className="text-slate-400" />
              </div>
              <div className="overflow-x-auto">
                <MiniTable headers={["订单号", "平台", "明细", "渠道", "状态", "费用"]} rows={orderRows} />
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="metric-card p-5">
              <h3 className="text-lg font-semibold text-slate-950">待处理事项</h3>
              <div className="mt-4 space-y-3">
                {[
                  ["待确认入库差异", "ASN-UK-240531 少 4 件", "danger"],
                  ["待上传 FBA 箱标", "FBA-UK-8832", "warn"],
                  ["退货质检待确认", "RMA-8842 需换标", "warn"],
                  ["账单待付款", "INV-202605 £2,846", "danger"],
                ].map(([title, desc, tone]) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={title}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <StatusBadge tone={tone as Tone}>{tone === "danger" ? "紧急" : "待处理"}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="metric-card p-5">
              <h3 className="text-lg font-semibold text-slate-950">费用拆分</h3>
              <div className="mt-4 space-y-3">
                {[
                  ["仓储费", 32, "£912"],
                  ["订单操作费", 24, "£684"],
                  ["尾程费", 31, "£884"],
                  ["退货/换标", 13, "£366"],
                ].map(([label, width, value]) => (
                  <div key={label as string}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-600">{label as string}</span>
                      <span className="font-medium text-slate-900">{value as string}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[#0E7490]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function WarehouseBackoffice() {
  return (
    <div className="grid gap-5 xl:grid-cols-[248px_1fr]">
      <aside className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-white shadow-sm">
        <div className="mb-4 rounded-md border border-white/10 bg-white/8 p-3">
          <p className="text-xs text-slate-300">当前仓库</p>
          <p className="mt-1 font-semibold">英国仓</p>
          <p className="mt-2 text-xs text-slate-400">Europe / London time</p>
        </div>
        {["运营工作台", "入库作业", "上架管理", "拣货波次", "打包复核", "出库交接", "退货质检", "异常处理", "费用计费"].map((item, index) => (
          <button
            className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
              index === 0 ? "bg-white text-slate-950" : "text-slate-200 hover:bg-white/10"
            }`}
            key={item}
          >
            {item}
          </button>
        ))}
      </aside>

      <main className="space-y-5">
        <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
          <div>
            <p className="text-sm text-slate-500">仓库后台 / Europe-London</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">今日仓内作业中心</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
              <ScanLine size={16} /> 扫码收货
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
              <PackageOpen size={16} /> 生成波次
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {warehouseMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="metric-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">作业队列</h3>
                <p className="text-sm text-slate-500">仓库人员按优先级处理收货、上架、拣货和退货。</p>
              </div>
              <Clock3 size={18} className="text-slate-400" />
            </div>
            <div className="overflow-x-auto">
              <MiniTable headers={["类型", "任务号", "说明", "预约/截止", "优先级"]} rows={warehouseTasks} />
            </div>
          </div>

          <div className="metric-card p-5">
            <h3 className="text-lg font-semibold text-slate-950">库区状态</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["收货区", "72%", "warn"],
                ["标准货架", "64%", "good"],
                ["大件区", "81%", "danger"],
                ["退货区", "58%", "warn"],
                ["FBA 准备区", "43%", "good"],
                ["异常区", "19 件", "danger"],
              ].map(([zone, value, tone]) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={zone}>
                  <p className="text-sm font-medium text-slate-800">{zone}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-semibold text-slate-950">{value}</span>
                    <StatusBadge tone={tone as Tone}>{tone === "danger" ? "关注" : "正常"}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="metric-card p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">扫码作业链路</h3>
                <p className="text-sm text-slate-500">把收货、差异、上架、复核出库拆成可扫描、可追踪的任务。</p>
              </div>
              <ScanLine size={20} className="text-[#0E7490]" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {scanFlow.map(([title, value, body], index) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4" key={title}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-xs font-semibold text-white">{index + 1}</span>
                    <span className="font-mono text-xs text-slate-500">{value}</span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-slate-950">{title}</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-4">
              <p className="text-xs text-cyan-100">PDA / Mobile Scan</p>
              <h3 className="mt-1 text-lg font-semibold">收货扫描</h3>
              <div className="mt-4 rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-4 text-center">
                <ScanLine size={42} className="mx-auto text-cyan-100" />
                <p className="mt-3 font-mono text-sm text-cyan-50">ASN-UK-240522</p>
                <p className="mt-1 text-xs text-slate-300">扫描外箱标签或库位码</p>
              </div>
              <div className="mt-4 space-y-2">
                {["箱数：18 托", "库区：收货区 A", "下一步：差异抽检"].map((item) => (
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200" key={item}>
                    {item}
                  </div>
                ))}
              </div>
              <button className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-cyan-200 px-3 text-sm font-semibold text-slate-950">
                确认收货
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {[
            ["入库异常", "外箱标签无法识别 3 箱，需客服联系客户补资料。", AlertTriangle],
            ["面单失败", "DPD Local 地址长度超限，等待客户确认地址。", Truck],
            ["库存调整", "SKU-CN-8891 盘点差异 +2，等待主管审核。", Boxes],
          ].map(([title, body, Icon]) => {
            const TypedIcon = Icon as LucideIcon;
            return (
              <div className="metric-card p-5" key={title as string}>
                <TypedIcon size={22} className="text-amber-600" />
                <h3 className="mt-4 font-semibold text-slate-950">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body as string}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function ModelView() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <SectionTitle
          eyebrow="后端与数据"
          title="系统核心是库存、合规和费用三条账"
          body="库存必须能从流水还原，账单必须能追溯到业务单据，VAT/EORI/FHDDS 资料必须有审核与留痕。"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="metric-card p-5">
          <h3 className="text-lg font-semibold text-slate-950">核心实体</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {modelEntities.map((entity) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700" key={entity}>
                {entity}
              </div>
            ))}
          </div>
        </div>
        <div className="metric-card p-5">
          <h3 className="text-lg font-semibold text-slate-950">状态机摘要</h3>
          <div className="mt-4 space-y-4">
            {[
              ["ASN", "draft -> submitted -> arrived -> receiving -> putaway_completed -> closed"],
              ["订单", "created -> allocated -> picking -> packed -> shipped -> delivered"],
              ["退货", "created -> received -> inspected -> disposition_pending -> completed"],
              ["FBA", "draft -> allocated -> prep_in_progress -> packed -> shipped -> closed"],
            ].map(([label, flow]) => (
              <div className="rounded-md border border-slate-200 bg-white p-3" key={label}>
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="mt-1 font-mono text-xs leading-5 text-slate-500">{flow}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {[
          ["库存流水", "InventoryLedger 是真实账，InventoryBalance 是可重建快照。", Boxes],
          ["计费事件", "ChargeEvent 由 ASN、订单、退货、FBA 和仓储日结触发。", ReceiptText],
          ["合规审计", "客户 KYC、VAT、EORI、FHDDS 资料变更写 ComplianceAuditLog。", ShieldCheck],
        ].map(([title, body, Icon]) => {
          const TypedIcon = Icon as LucideIcon;
          return (
            <div className="metric-card p-5" key={title as string}>
              <TypedIcon size={22} className="text-[#0E7490]" />
              <h3 className="mt-4 font-semibold text-slate-950">{title as string}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body as string}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoadmapView() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <SectionTitle
          eyebrow="实施计划"
          title="先把官网信任和客户操作路径打出来，再接真实业务数据"
          body="第一阶段围绕官网、询盘、入库预报和体验工作台，第二阶段开始进入客户、SKU、ASN、库存与订单的真实数据。"
        />
      </div>
      <div className="grid gap-4">
        {roadmap.map((item) => (
          <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[120px_1fr_120px]" key={item.stage}>
            <div className="text-sm font-semibold text-[#0E7490]">{item.stage}</div>
            <div>
              <h3 className="font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
            <div className="md:text-right">
              <StatusBadge tone={item.status === "进行中" ? "good" : item.status === "下一步" ? "warn" : "info"}>{item.status}</StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandLogoMark({ isMarketing }: { isMarketing: boolean }) {
  return (
    <div className={`brand-logo-mark ${isMarketing ? "brand-logo-mark-marketing" : ""}`} aria-hidden="true">
      <Image alt="" height={80} src="/assets/uk-station-logo.png" width={80} />
    </div>
  );
}

export default function HomePage() {
  const [activeView, setActiveView] = useState<ViewId>("site");
  const language = useSiteLanguage();
  const surface = currentSurface();
  const safeActiveView: ViewId = surface === "marketing" ? "site" : activeView;
  const visibleViews = surface === "marketing" ? views.filter((view) => view.id === "site") : views;
  const activeLabel = useMemo(() => visibleViews.find((view) => view.id === safeActiveView)?.label ?? "官网首页", [safeActiveView, visibleViews]);
  const primaryNavItems = homeNavGroups[0].items;
  const navLabel = (label: string) => {
    if (language === "zh") return label;
    return ({
      首页: "Home",
      海外仓服务: "Services",
      用户工作台: "Workspace",
      新闻资讯: "News",
      关于我们: "About",
      客户登录: "Login",
      提交需求: "Submit Needs",
      入库预报: "Inbound",
      查进度: "Tracking",
      运营后台: "Ops",
    } as Record<string, string>)[label] ?? label;
  };
  const openCustomerWorkspace = () => {
    if (surface !== "marketing") setActiveView("customer");
  };

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="marketing-site-header fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/16 text-white backdrop-blur-sm">
        <div className="site-header-inner">
            <Link className="site-header-brand" href={surfaceHref("marketing", "/")}>
              <BrandLogoMark isMarketing={surface === "marketing"} />
              <div className="site-header-brand-copy">
                <p className="font-semibold tracking-tight text-slate-950">{language === "en" ? "UK Station" : "英国驿站"}</p>
                <p className="text-xs text-slate-500 sm:text-sm">{language === "en" ? "UK fulfillment · Self-built system" : "英国仓配 · 自营系统"}</p>
              </div>
            </Link>

          {surface !== "marketing" ? <nav className="flex gap-2 overflow-x-auto pb-1">
            {visibleViews.map((view) => {
              const Icon = view.icon;
              const active = view.id === activeView;
              return (
                <button
                  className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                    active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                >
                  <Icon size={16} />
                  {view.label}
                </button>
              );
            })}
          </nav> : null}

          <nav className="site-header-nav">
                {primaryNavItems.map((item) => (
                  item.label === "海外仓服务" ? (
                    <div className="marketing-nav-menu" key={item.href}>
                      <Link
                        href={item.href}
                      >
                        {navLabel(item.label)}
                      </Link>
                      <div className="marketing-service-dropdown">
                        {cleanServiceSpotlights.map((service) => (
                          <Link href={surfaceHref("marketing", `/services/${service.id}`)} key={service.label}>
                            <span>{language === "en" ? service.english : service.label}</span>
                            <small>{language === "en" ? "View UK warehouse service details" : service.points.join(" / ")}</small>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      key={item.href}
                    >
                      {navLabel(item.label)}
                    </Link>
                  )
                ))}
          </nav>

          <div className="site-header-right">
            <LanguageSwitcher tone="dark" />
          </div>

          <nav className="site-header-mobile-nav">
            {primaryNavItems.slice(0, 4).map((item) => (
              <Link href={item.href} key={item.href}>
                {navLabel(item.label)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className={surface === "marketing" ? "marketing-page-shell" : "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"}>
        {surface !== "marketing" ? <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">当前视图：{activeLabel}</p>
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <CheckCircle2 size={16} />
            第一阶段：官网与体验工作台
          </span>
        </div> : null}
        {safeActiveView === "site" ? <SiteView onOpenCustomer={openCustomerWorkspace} showWorkspacePreview={surface !== "marketing"} /> : null}
        {surface !== "marketing" && safeActiveView === "customer" ? <CustomerPortal /> : null}
        {surface !== "marketing" && safeActiveView === "warehouse" ? <WarehouseBackoffice /> : null}
        {surface !== "marketing" && safeActiveView === "model" ? <ModelView /> : null}
        {surface !== "marketing" && safeActiveView === "roadmap" ? <RoadmapView /> : null}
      </div>
    </main>
  );
}
