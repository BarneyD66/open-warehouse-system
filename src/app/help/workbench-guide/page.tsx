import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, ArrowRight, Bell, BookOpen, Boxes, CheckCircle2,
  CircleHelp, ClipboardCheck, Clock3, FileSpreadsheet, Headphones, KeyRound,
  LayoutDashboard, Lightbulb, LockKeyhole, LogIn, MessageSquareWarning,
  RotateCcw, Send, Store, Tags, Truck, Upload, UserRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "客户工作台使用指南",
  description: "新途跨境客户工作台中文使用白皮书，讲解账号、店铺资料、SKU、入库、出库、业务状态、消息、异常和退货售后。",
};

const chapters = [
  ["overview", "01 工作台总览", LayoutDashboard],
  ["login", "02 登录与账号", LockKeyhole],
  ["account", "03 店铺资料", Store],
  ["sku", "04 SKU 库存", Tags],
  ["inbound", "05 入库预报", Boxes],
  ["inbound-history", "06 入库记录与异常", MessageSquareWarning],
  ["outbound", "07 出库与 CSV", FileSpreadsheet],
  ["tracking", "08 状态与业务进度", Activity],
  ["notifications", "09 消息中心", Bell],
  ["returns", "10 退货售后", RotateCcw],
  ["support", "11 获取帮助", Headphones],
  ["faq", "12 常见问题", CircleHelp],
] as const satisfies ReadonlyArray<readonly [string, string, LucideIcon]>;

type ChapterProps = { children: ReactNode; id: string; number: string; title: string; summary: string };
type ScreenshotPin = { label: string; number: number; x: number; y: number };

function Chapter({ children, id, number, summary, title }: ChapterProps) {
  return (
    <section className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" id={id}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">{number}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 sm:text-base">{summary}</p>
      {children}
    </section>
  );
}

function NumberBadge({ number }: { number: number }) {
  return <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-700 text-[11px] font-bold text-white">{number}</span>;
}

function ScreenshotGuide({ alt, caption, height, pins, src, width }: { alt: string; caption: string; height: number; pins: ScreenshotPin[]; src: string; width: number }) {
  return (
    <figure className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div aria-label={`${caption}，可横向滚动`} className="overflow-x-auto border-b border-slate-200 bg-white" role="region" tabIndex={0}>
        <div className="relative min-w-[760px] sm:min-w-0">
          <Image alt={alt} className="h-auto w-full" height={height} sizes="(max-width: 1024px) 100vw, 1050px" src={src} width={width} />
          {pins.map((pin) => <span aria-hidden="true" className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-cyan-700 text-xs font-bold text-white shadow-[0_2px_12px_rgba(8,145,178,0.45)] sm:h-9 sm:w-9 sm:text-sm" key={pin.number} style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>{pin.number}</span>)}
        </div>
      </div>
      <figcaption className="p-4 sm:p-5"><p className="text-xs leading-6 text-slate-500">{caption}。手机端可左右滑动查看截图。</p><ol className="mt-3 grid gap-2 sm:grid-cols-2">{pins.map((pin) => <li className="flex items-start gap-2 text-sm leading-6 text-slate-700" key={pin.number}><NumberBadge number={pin.number} />{pin.label}</li>)}</ol></figcaption>
    </figure>
  );
}

function VisualGuide({ children, notes, title }: { children: ReactNode; notes: string[]; title: string }) {
  return (
    <figure className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><p className="ml-2 text-xs font-semibold text-slate-300">{title}</p></div>
      <div className="overflow-x-auto bg-white" role="region" aria-label={`${title}界面说明`} tabIndex={0}><div className="min-w-[720px] p-5">{children}</div></div>
      <figcaption className="border-t border-slate-200 p-4 sm:p-5"><ol className="grid gap-2 sm:grid-cols-2">{notes.map((note, index) => <li className="flex items-start gap-2 text-sm leading-6 text-slate-700" key={note}><NumberBadge number={index + 1} />{note}</li>)}</ol></figcaption>
    </figure>
  );
}

function PurposeCard({ body, icon: Icon, title }: { body: string; icon: LucideIcon; title: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Icon className="text-cyan-700" size={20} /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>;
}

function Steps({ items }: { items: Array<{ title: string; body: string }> }) {
  return <ol className="mt-6 grid gap-3">{items.map((item, index) => <li className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-xl border border-slate-200 p-4" key={item.title}><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">{index + 1}</span><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p></div></li>)}</ol>;
}

function Callout({ children, tone = "cyan", title }: { children: ReactNode; tone?: "amber" | "cyan" | "emerald"; title: string }) {
  const styles = { amber: "border-amber-200 bg-amber-50 text-amber-950", cyan: "border-cyan-200 bg-cyan-50 text-cyan-950", emerald: "border-emerald-200 bg-emerald-50 text-emerald-950" };
  const Icon = tone === "amber" ? AlertTriangle : tone === "emerald" ? CheckCircle2 : Lightbulb;
  return <div className={`mt-6 rounded-xl border p-4 ${styles[tone]}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 shrink-0" size={18} /><div className="text-sm leading-6"><strong className="block">{title}</strong>{children}</div></div></div>;
}

const skuFields = [
  ["SKU 编码", "必须与销售平台订单里的 Seller SKU 完全一致，包括大小写和符号。"],
  ["商品名称", "写清款式、规格或颜色，方便仓库通过实物辅助核对。"],
  ["条码", "有 EAN、UPC 等条码时填写；没有可以留空。"],
  ["分类", "使用易理解的分类，例如服饰、家居、包装物料。"],
  ["库存预警值", "可用库存低于该数量时提醒补货；填写 0 表示暂不设置提醒。"],
];

const inboundStatuses = [
  ["待审核 / 已提交", "资料已进入系统", "确认记录已出现，留意消息中心"],
  ["资料审核中", "仓库正在核对明细与随货资料", "按消息提示补充，不要重复新建"],
  ["已预约入仓", "到仓安排已确认", "按预约与运输计划发货"],
  ["已到仓 / 收货验收中", "货物正在卸货、清点或核对", "等待实收结果"],
  ["部分收货 / 部分上架", "部分商品完成，仍有明细待处理", "打开详情核对未完成 SKU"],
  ["已上架", "库存已完成上架", "核对可用库存后可创建出库"],
  ["异常处理中 / 暂缓处理", "存在数量、标签、破损或资料问题", "在原记录中确认处理方案"],
];

const faqs = [
  ["创建 SKU 后为什么还是没有库存？", "SKU 只是商品基础资料。货物到仓并完成清点、质检和上架后，系统才会形成可用库存。"],
  ["包装物料需要创建 SKU 吗？", "需要单独清点、保存或后续领用时，应创建独立包装物料编码并在入库明细中单独列出；普通一次性外箱无需作为库存维护。"],
  ["货已经发出了，还能补入库预报吗？", "可以，但应尽快补交预计到仓、承运商、追踪号和 SKU 明细。越接近到仓才提交，越容易延迟识别。"],
  ["CSV 预检通过是不是已经发货？", "不是。预检只检查订单数据；点击确认创建后才生成出库申请，仓库完成作业并交运后才会产生 Tracking。"],
  ["部分订单可创建、部分有异常怎么办？", "建议下载异常报告并全部修正后重新上传，避免只创建部分订单造成遗漏。"],
  ["要求发货日期为什么没有当天送达？", "要求发货日期是希望仓库安排出库的日期，不是承运商承诺送达日期。交运后请以 Tracking 为准。"],
  ["消息标记已读后为什么异常还在？", "已读只表示您看过消息；仍需进入原业务记录补资料或确认处理方案。"],
  ["同一问题要不要重新提交一条记录？", "不要。打开原记录查看异常并补充，能保留完整处理链路，也避免仓库重复作业。"],
];

export default function WorkbenchGuidePage() {
  return (
    <main className="surface-customer min-h-screen bg-[#f5f7f8] text-slate-950">
      <header className="border-b border-slate-800 bg-[#0d1626] text-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><Link className="flex items-center gap-3" href="/"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white"><Image alt="" height={34} priority src="/assets/xintu-crossborder-mark.svg" width={34} /></span><span><span className="block text-sm font-semibold">新途跨境</span><span className="block text-xs text-slate-300">客户帮助中心</span></span></Link><Link className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50" href="/login"><LogIn size={16} />登录客户工作台</Link></div></header>

      <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800"><BookOpen size={14} />中文使用白皮书</span><h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">客户工作台使用指南</h1><p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">从登录开始，依次讲清店铺资料、SKU、入库、出库、业务状态、消息与异常处理。每一章都说明什么时候用、怎么操作、结果到哪里查看。</p><div className="mt-6 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">约 25 分钟读完</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">按客户工作台实际流程编写</span></div></div></section>

      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-6 lg:h-fit"><div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">章节目录</p><nav aria-label="指南章节" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">{chapters.map(([id, label, Icon]) => <Link className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" href={`#${id}`} key={id}><Icon size={16} />{label}</Link>)}</nav><div className="mt-3 border-t border-slate-100 p-3 text-xs leading-5 text-slate-500">第一次使用建议按顺序阅读到“入库预报”；遇到问题可直接查看“消息中心”和“获取帮助”。</div></div></aside>

        <article className="min-w-0 space-y-8">
          <Chapter id="overview" number="01 · 工作台总览" summary="客户工作台把资料准备、货物入仓、订单出库、物流反馈和退货处理连成一条业务流程。先判断自己处于哪一步，再进入对应模块。" title="先认识整套业务流程">
            <div className="mt-7 grid gap-3 md:grid-cols-4">{[["1", "建立资料", "完善店铺并创建 SKU"], ["2", "货物入仓", "提交预报并等待上架"], ["3", "订单发货", "创建出库并跟进状态"], ["4", "售后处理", "查看物流结果与退货进度"]].map(([n, title, body], index) => <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-4" key={n}><span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-800 text-xs font-bold text-white">{n}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>{index < 3 ? <ArrowRight aria-hidden="true" className="absolute -right-5 top-1/2 z-10 hidden text-cyan-600 md:block" size={20} /> : null}</div>)}</div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><PurposeCard body="先建商品编码，再安排入库。" icon={Tags} title="新增商品 → SKU 库存" /><PurposeCard body="登记预计到仓、运输和商品明细。" icon={Boxes} title="货物发仓 → 入库预报" /><PurposeCard body="填写 SKU、数量、收件地址和渠道。" icon={Send} title="订单发货 → 出库发货" /><PurposeCard body="查看入库、出库、物流及异常节点。" icon={Activity} title="查询处理进度 → 业务进度" /><PurposeCard body="查看待处理事项并跳到原业务。" icon={Bell} title="收到提醒 → 消息中心" /><PurposeCard body="登记追踪号、SKU 和处理偏好。" icon={RotateCcw} title="买家退货 → 退货售后" /></div>
            <Callout title="推荐使用顺序" tone="emerald"><p>可直接维护 SKU 并提交入库预报，店铺资料按需补充。库存完成上架后再创建出库，可减少编码不匹配和库存不足。</p></Callout>
          </Chapter>

          <Chapter id="login" number="02 · 登录与账号" summary="使用注册时的手机或邮箱和密码进入客户工作台。客户编号用于区分业务归属，登录密码只用于本人验证。" title="安全登录并维护自己的账号">
            <Steps items={[{ title: "打开客户登录页", body: "选择“客户登录”，输入注册时的手机或邮箱。" }, { title: "输入密码并进入工作台", body: "连续登录失败时，先检查输入法、空格和大小写，再使用“忘记密码”入口。" }, { title: "保存客户编号", body: "咨询入库、出库或售后问题时，客户编号能帮助快速确认业务归属。" }, { title: "需要时修改密码", body: "登录后进入“店铺资料”，在修改密码区域输入当前密码和新密码。" }]} />
            <VisualGuide title="客户登录" notes={["使用注册手机号或邮箱登录。", "密码可显示或隐藏，提交前确认输入无误。", "忘记密码时从登录页进入重置流程。", "注册新账号后会生成专属客户编号。"]}><div className="mx-auto grid max-w-3xl grid-cols-[1fr_1.05fr] overflow-hidden rounded-xl border border-slate-200 shadow-sm"><div className="bg-slate-950 p-7 text-white"><p className="text-xs font-semibold text-cyan-300">新途跨境</p><h3 className="mt-3 text-2xl font-semibold">专属仓储工作台</h3><p className="mt-3 text-sm leading-6 text-slate-300">商品、入库、订单、物流和售后记录集中查看。</p></div><div className="space-y-4 bg-white p-6"><div className="flex gap-2"><span className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">客户登录</span><span className="rounded-md px-3 py-1.5 text-xs text-slate-500">免费注册</span></div><p className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-500"><NumberBadge number={1} /><UserRound size={16} />手机 / 邮箱</p><p className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-500"><NumberBadge number={2} /><KeyRound size={16} />密码</p><div className="flex items-center justify-between"><span className="rounded-md bg-slate-950 px-5 py-2 text-sm font-semibold text-white">登录工作台</span><span className="flex items-center gap-1 text-xs font-semibold text-cyan-800"><NumberBadge number={3} />忘记密码</span></div><p className="flex items-center gap-2 text-xs text-slate-500"><NumberBadge number={4} />首次使用可先注册账号</p></div></div></VisualGuide>
            <Callout title="账号安全" tone="amber"><p>不要把密码、验证码或完整登录信息发给任何人。需要协助时只提供客户编号和业务单号；发现账号异常应先修改密码并联系您的对接人员。</p></Callout>
          </Chapter>

          <Chapter id="account" number="03 · 店铺资料" summary="这里可选保存日常联系和订单来源信息。仓库遇到地址、库存、包装或物流问题时，会依据这些资料与您确认。" title="按需补充店铺资料">
            <Steps items={[{ title: "按需填写公司或店铺名称", body: "店铺名称选填；多个平台店铺可在“平台 / 店铺”中逐行补充。" }, { title: "按需补充联系人和微信号", body: "联系方式默认使用登录邮箱，联系人和微信号均可选填。" }, { title: "补充固定偏好", body: "常用物流、包装或客服要求可写在常用发货备注中；单个订单的特殊要求仍需再次填写。" }, { title: "保存资料", body: "保存后仍可修改。修改密码是独立操作，不会与店铺资料一起保存。" }]} />
            <Callout title="不要把单次订单要求只写在这里" tone="amber"><p>店铺资料中的备注是长期偏好。某一票需要拍照、合单、换包装或加固时，请在该票出库申请的“补充说明”中再写一次。</p></Callout>
          </Chapter>

          <Chapter id="sku" number="04 · SKU 库存" summary="SKU 是商品、入库和订单之间的共同语言。创建 SKU 不等于已经有库存；仓库收到货物并完成清点上架后，才会形成可用库存。" title="先统一商品编码，再安排入库">
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200"><div className="grid grid-cols-[120px_minmax(0,1fr)] bg-slate-950 px-4 py-3 text-sm font-semibold text-white sm:grid-cols-[170px_minmax(0,1fr)]"><span>字段</span><span>怎么填写</span></div>{skuFields.map(([field, explanation]) => <div className="grid grid-cols-[120px_minmax(0,1fr)] border-t border-slate-200 px-4 py-3 text-sm leading-6 sm:grid-cols-[170px_minmax(0,1fr)]" key={field}><strong>{field}</strong><span className="text-slate-600">{explanation}</span></div>)}</div>
            <ScreenshotGuide alt="客户工作台新增 SKU 表单" caption="新增 SKU 页面" height={518} pins={[{ number: 1, x: 24, y: 20, label: "SKU 编码：必须与平台订单编码一致。" }, { number: 2, x: 75, y: 20, label: "商品名称：建议包含规格或款式。" }, { number: 3, x: 75, y: 36, label: "条码和分类：用于辅助识别商品。" }, { number: 4, x: 24, y: 82, label: "库存预警值：低库存提醒阈值。" }]} src="/assets/guides/workbench/sku-create-focus.png" width={635} />
            <h3 className="mt-8 text-lg font-semibold">SKU 较多时：批量导入</h3>
            <Steps items={[{ title: "下载 SKU 模板", body: "从“SKU 批量导入导出”区域下载最新模板，不要自行改动表头。" }, { title: "逐行填写并保存为 CSV", body: "每行一个 SKU；编码列设为文本，避免前导 0 丢失或长编码变成科学计数法。" }, { title: "导入后检查结果", body: "确认新增和更新数量，并重点检查重复编码、空格、数量格式和商品名称。" }, { title: "下载 SKU 清单复核", body: "导入完成后导出当前清单，确认系统内编码与平台 Seller SKU 一致。" }]} />
            <Callout title="包装物料也按 SKU 管理"><p>需要单独清点、保存和后续领用的包材，应建立独立编码，例如 PKG-MAILER-M。分类可填写“包装物料”，不要与可售商品共用同一个 SKU。</p></Callout>
          </Chapter>

          <Chapter id="inbound" number="05 · 入库预报" summary="货物发往英国仓前提交入库预报，让仓库提前知道谁的货、什么时候到、通过什么方式到，以及每个 SKU 有多少件、多少箱。" title="货物发出前，先提交到仓信息">
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><PurposeCard body="店铺、联系人、预计到仓日期和运输方式。" icon={Truck} title="货件信息" /><PurposeCard body="每行一个 SKU，填写编码、名称、数量、箱数或托数。" icon={Boxes} title="商品明细" /><PurposeCard body="勾选已经准备好的装箱单、编码清单和外箱标签。" icon={ClipboardCheck} title="随货资料" /></div>
            <Steps items={[{ title: "填写货件基础信息", body: "预计到仓日期尽量准确；已有承运商或追踪号时一并填写，没有时可后续补充。" }, { title: "逐行填写 SKU 明细", body: "格式为：SKU 编码, 商品名称, 商品数量, 箱数/托数。每个 SKU 独占一行。" }, { title: "核对系统自动汇总", body: "检查 SKU 种类、商品总数量和箱数是否与装箱单一致；不一致时先修改。" }, { title: "勾选已有资料并提交", body: "只勾选实际准备好的资料。提交后在“我的入库预报”中查看处理进度。" }]} />
            <ScreenshotGuide alt="客户工作台入库预报基础信息和 SKU 明细" caption="入库预报基础信息和 SKU 明细" height={938} pins={[{ number: 1, x: 50, y: 25, label: "预计到仓日期和运输方式。" }, { number: 2, x: 24, y: 35, label: "承运商或追踪号：帮助识别到仓批次。" }, { number: 3, x: 75, y: 35, label: "主要品名：概括整票货物。" }, { number: 4, x: 50, y: 55, label: "SKU 明细：产品和包装物料分别填写。" }]} src="/assets/guides/workbench/inbound-basics-focus.png" width={646} />
            <Callout title="包装物料随产品一起到仓时"><p>如需仓库单独清点、保存并在后续订单中使用，请为包装物料建立独立编码，并在入库明细中单独一行填写实际数量和箱数。外箱也应标明“包装物料”，避免与可售商品混放。</p></Callout>
            <Callout title="提交前最后检查" tone="amber"><p>系统汇总的件数来自每行“商品数量”相加，箱数来自每行“箱数/托数”相加。请避免把“每箱数量”误填成“商品总数量”。</p></Callout>
          </Chapter>

          <Chapter id="inbound-history" number="06 · 入库记录与异常" summary="入库提交后不需要另建表格追踪。打开“我的入库预报”，即可查看完整资料、实收与上架数量、库位、资料状态、仓库进度和异常。" title="在原入库记录里继续处理">
            <VisualGuide title="我的入库预报" notes={["先核对入库号和当前状态。", "展开记录查看预报、实收、上架和库位。", "异常卡片会说明差异、照片或仓库建议。", "允许编辑时，在原记录中补充资料并保存。"]}><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div><p className="font-mono text-xs font-semibold text-slate-500">INB-UK-202608-0148</p><h3 className="mt-1 font-semibold">家居用品与包装物料</h3></div><span className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"><NumberBadge number={1} />部分上架</span></div><div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="grid grid-cols-5 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600"><span>SKU</span><span>预报</span><span>实收</span><span>已上架</span><span>库位</span></div><div className="grid grid-cols-5 px-3 py-3 text-xs"><span className="flex items-center gap-1 font-mono"><NumberBadge number={2} />HOME-01</span><span>120</span><span>118</span><span>118</span><span>A-02-04</span></div></div><div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3"><div className="flex items-center justify-between"><strong className="flex items-center gap-2 text-sm text-rose-950"><NumberBadge number={3} />少货：相差 2 件</strong><span className="text-xs font-semibold text-rose-800">待确认</span></div><p className="mt-2 text-xs leading-5 text-rose-900">请核对装箱单；如确认按实收数量入库，可在此记录中选择处理方案。</p></div><p className="mt-3 inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-800"><NumberBadge number={4} />修改 / 补充入库资料</p></div></VisualGuide>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[["少货 / 多货", "核对装箱单和预报数量，再确认按实收处理或继续调查。"], ["破损", "查看照片和受影响数量，选择重新上架、等待确认或其他处理。"], ["错 SKU", "核对外箱、商品标签和平台编码，避免把错误编码并入库存。"], ["标签异常", "按提示补标签资料或确认是否需要仓库换标。"], ["资料缺失", "在原记录中补充追踪号、装箱单或说明。"], ["暂缓处理", "查看原因，完成客户确认后继续收货或上架。"]].map(([title, body]) => <div className="rounded-xl border border-slate-200 p-4" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div>
            <Callout title="什么时候还能编辑"><p>待审核、已提交或资料审核阶段通常可以补充信息；进入正式收货后，关键数量以仓库实收为准。页面没有编辑入口时，请查看进度并联系对接人员，不要重复创建一票。</p></Callout>
          </Chapter>

          <Chapter id="outbound" number="07 · 出库发货与 CSV" summary="单量少可手工创建；订单较多时先下载模板、整理 CSV 并上传预检。预检会集中检查订单号、SKU、数量、收件信息、英国邮编和库存。" title="先预检，再确认创建出库">
            <Steps items={[{ title: "下载最新订单模板", body: "保留表头：销售平台、平台订单号、SKU 编码、数量、物流渠道、收件人、收件地址、要求发货日期、备注。" }, { title: "一行填写一个订单商品", body: "同一订单有多个 SKU 时使用多行，并保持订单号、收件人、地址和渠道一致。" }, { title: "上传文件并查看预检", body: "先看可创建订单数和异常行；下载异常报告可按行号集中修正。" }, { title: "修正后重新上传", body: "重点处理 SKU 不存在、数量无效、收件人为空、地址不完整和英国邮编无法识别。" }, { title: "确认创建", body: "无误后点击确认创建。仍有异常行时建议先修正，避免部分订单遗漏。" }]} />
            <VisualGuide title="平台订单 CSV 预检" notes={["先下载系统当前模板。", "选择 CSV 后系统先预检，不会直接发货。", "汇总区显示可创建订单和异常行。", "按异常提示修正并重新上传。", "确认无误后再点击“确认创建”。"]}><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-6"><div><h3 className="font-semibold">平台订单 CSV 预检</h3><p className="mt-1 text-xs leading-5 text-slate-500">检查 SKU、数量、收件人、地址、英国邮编和库存。</p></div><div className="flex gap-2"><span className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold"><NumberBadge number={1} />下载订单模板</span><span className="flex items-center gap-1 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white"><NumberBadge number={2} /><Upload size={14} />选择订单文件</span></div></div><div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3"><div className="flex gap-2 text-xs font-semibold"><span className="flex items-center gap-1 rounded-md bg-white px-2 py-1"><NumberBadge number={3} />可创建 18 单</span><span className="rounded-md bg-white px-2 py-1 text-amber-900">异常行 2 行</span></div><div className="mt-3 overflow-hidden rounded-md border border-cyan-100 bg-white"><div className="grid grid-cols-[60px_1fr_1fr_90px] bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500"><span>行号</span><span>订单号</span><span>SKU</span><span>状态</span></div><div className="grid grid-cols-[60px_1fr_1fr_90px] px-3 py-2 text-xs"><span>6</span><span>ORD-0824-16</span><span>HOME-02</span><span className="text-emerald-700">可导入</span></div><div className="grid grid-cols-[60px_1fr_1fr_90px] border-t border-slate-100 px-3 py-2 text-xs"><span>9</span><span>ORD-0824-19</span><span>HOME-09</span><span className="text-rose-700">需处理</span></div></div><p className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><NumberBadge number={4} />第 9 行 SKU 不存在或为空，请核对商品编码。</p><div className="mt-3 flex justify-end"><span className="flex items-center gap-2 rounded-md bg-cyan-900 px-4 py-2 text-xs font-semibold text-white"><NumberBadge number={5} />确认创建</span></div></div></div></VisualGuide>
            <ScreenshotGuide alt="客户工作台创建出库申请" caption="手工创建出库申请页面" height={626} pins={[{ number: 1, x: 24, y: 14, label: "尾程渠道和订单数。" }, { number: 2, x: 24, y: 28, label: "收件人和期望发货日。" }, { number: 3, x: 50, y: 44, label: "出库 SKU 明细：一行一个 SKU 和数量。" }, { number: 4, x: 50, y: 66, label: "完整地址：尤其核对门牌号和英国邮编。" }]} src="/assets/guides/workbench/outbound-create-focus.png" width={635} />
            <Callout title="要求发货日期不是承诺送达日期" tone="amber"><p>该日期用于表达希望仓库安排出库的时间。实际交运还受库存、地址、包装、面单、截单时间和承运商服务影响；请以业务状态和 Tracking 为准。</p></Callout>
          </Chapter>

          <Chapter id="tracking" number="08 · 状态与业务进度" summary="状态告诉您当前在哪个环节；更新时间和最新记录告诉您最近发生了什么。预计到仓、要求发货和承运商预计送达分别属于不同时间口径。" title="用状态判断下一步，而不是重复提交">
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">入库状态</th><th className="px-4 py-3">代表什么</th><th className="px-4 py-3">您要做什么</th></tr></thead><tbody className="divide-y divide-slate-200">{inboundStatuses.map(([status, meaning, action]) => <tr key={status}><td className="px-4 py-3 font-semibold">{status}</td><td className="px-4 py-3 text-slate-600">{meaning}</td><td className="px-4 py-3 text-slate-600">{action}</td></tr>)}</tbody></table></div>
            <h3 className="mt-8 text-lg font-semibold">四种时间不要混淆</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["预计到仓日期", "由您在入库预报中填写，是运输计划，不代表仓库已经签收。"], ["要求发货日期", "由您在出库申请中填写，是希望安排出库的日期，不等于买家收货日期。"], ["状态更新时间", "表示系统最近一次记录业务变化的时间。"], ["承运商预计送达", "包裹交运后由承运商更新，以 Tracking 页面为准。"]].map(([title, body]) => <div className="rounded-xl border border-slate-200 p-4" key={title}><Clock3 className="text-cyan-700" size={18} /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div>
            <Steps items={[{ title: "确认业务类型和编号", body: "分清入库号、出库号、平台订单号、Tracking 和退货号。" }, { title: "查看状态与更新时间", body: "判断是在等待资料、仓库作业，还是已经交给承运商。" }, { title: "打开最新记录或异常详情", body: "查看缺少的资料、数量差异、地址问题或处理建议。" }, { title: "按原记录继续处理", body: "补充资料、确认方案或查看 Tracking，不要为同一事项重复新建。" }]} />
          </Chapter>

          <Chapter id="notifications" number="09 · 消息中心" summary="工作台右上角的铃铛用于集中显示业务异常、待处理事项和最新进度。红色数字表示仍有未读消息。" title="先看消息，再跳到原业务处理">
            <VisualGuide title="消息中心" notes={["铃铛上的数字表示未读消息数量。", "消息标题会说明业务类型和待办重点。", "点击“立即查看”跳转到对应记录。", "处理完成后可标记已读；已读不等于业务已完成。"]}><div className="grid grid-cols-[1fr_330px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"><div className="p-5"><div className="flex items-center justify-between rounded-lg bg-white p-4"><div><p className="text-xs text-slate-500">客户工作台</p><h3 className="mt-1 font-semibold">订单处理工作台</h3></div><span className="relative grid h-10 w-10 place-items-center rounded-md border border-slate-200"><Bell size={18} /><span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] font-bold text-white">3</span></span></div><p className="mt-5 flex items-center gap-2 text-sm text-slate-600"><NumberBadge number={1} />有新消息时，先打开右上角铃铛。</p></div><aside className="border-l border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Bell size={17} />消息中心</h3><span className="text-xs text-slate-500">3 条未读</span></div><div className="mt-4 space-y-3"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-sm font-semibold"><NumberBadge number={2} />入库资料待补充</p><p className="mt-2 text-xs leading-5 text-slate-600">入库号 INB-UK-202608-0148 缺少追踪号。</p><p className="mt-2 flex items-center justify-end gap-1 text-xs font-semibold text-cyan-800"><NumberBadge number={3} />立即查看</p></div><div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3"><p className="text-sm font-semibold">订单状态已更新</p><p className="mt-2 text-xs leading-5 text-slate-600">出库单已生成 Tracking。</p></div><p className="flex items-center gap-2 text-xs text-slate-500"><NumberBadge number={4} />全部标记已读</p></div></aside></div></VisualGuide>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["红色 / 警告", "需要尽快确认，可能影响入库、出库或派送。"], ["黄色 / 提醒", "需要补资料或留意处理期限。"], ["蓝色 / 信息", "业务有新进度，可打开查看。"], ["绿色 / 完成", "某个节点已完成，继续核对结果即可。"]].map(([title, body]) => <div className="rounded-xl border border-slate-200 p-4" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div>
            <Callout title="“已读”与“已处理”不同" tone="amber"><p>标记已读只是清除未读提示。若消息要求补资料、改地址或确认异常方案，仍需点击“立即查看”，在对应业务记录中完成操作。</p></Callout>
          </Chapter>

          <Chapter id="returns" number="10 · 退货售后" summary="平台订单发生退货时，尽量在包裹到仓前提交退货预报。仓库可根据原订单号、退货追踪号和 SKU 识别包裹，并按您的偏好进行质检和后续处理。" title="买家退货后，先登记再等待质检">
            <Steps items={[{ title: "填写平台和原订单号", body: "有订单号时请尽量填写，便于关联原出库记录。" }, { title: "填写退货追踪号和预计到仓", body: "追踪号可后补；包裹即将到仓时补齐，有助于仓库识别。" }, { title: "填写退货 SKU、原因和处理偏好", body: "每行一个 SKU 和数量，并写清可售重上架、破损拍照确认等偏好。" }, { title: "查看质检和待确认事项", body: "到仓后系统会更新进度；需要选择处理方式时，在原退货记录中确认。" }]} />
            <ScreenshotGuide alt="客户工作台创建退货预报" caption="创建退货预报页面" height={626} pins={[{ number: 1, x: 24, y: 14, label: "销售平台和原订单号。" }, { number: 2, x: 24, y: 29, label: "买家退货追踪号和预计到仓日期。" }, { number: 3, x: 50, y: 45, label: "退货 SKU 明细：一行一个 SKU 和数量。" }, { number: 4, x: 50, y: 74, label: "退货原因和处理偏好写具体。" }]} src="/assets/guides/workbench/returns-create-focus.png" width={1112} />
            <Callout title="不要只写“按情况处理”"><p>请提前写清优先级，例如“外观完好重新上架；包装破损先拍照；商品损坏等待确认”。越明确，仓库越能减少来回沟通。</p></Callout>
          </Chapter>

          <Chapter id="support" number="11 · 获取帮助" summary="大多数问题先从原业务记录和消息中心处理。确实需要人工协助时，把定位信息一次写完整，可以减少反复询问。" title="带着完整信息联系客服">
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PurposeCard body="客户编号用于确认账号和业务归属。" icon={UserRound} title="1. 客户编号" /><PurposeCard body="提供入库号、出库号、订单号、Tracking 或退货号。" icon={ClipboardCheck} title="2. 业务编号" /><PurposeCard body="说明当前状态、遇到的问题和发生时间。" icon={AlertTriangle} title="3. 问题描述" /><PurposeCard body="写清希望补资料、继续处理、改派或确认结果。" icon={CheckCircle2} title="4. 期望处理" /></div>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><h3 className="font-semibold">可以直接复制的沟通格式</h3><div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 font-mono text-sm leading-7 text-slate-700"><p>客户编号：________</p><p>业务类型：入库 / 出库 / 物流 / 退货</p><p>业务编号：________</p><p>相关 SKU：________</p><p>当前状态：________</p><p>问题说明：________</p><p>希望如何处理：________</p></div></div>
            <Steps items={[{ title: "先打开原记录", body: "确认是否已有处理说明、异常照片、Tracking 或可点击的确认按钮。" }, { title: "再查看消息中心", body: "确认是否有待补资料或待确认消息，并从“立即查看”进入对应业务。" }, { title: "仍无法解决再联系对接人员", body: "使用日常客户对接渠道，并一次提供客户编号、业务编号、问题与期望处理。" }]} />
            <Callout title="不要发送这些信息" tone="amber"><p>不要发送登录密码、验证码或与问题无关的个人资料。地址问题只提供对应订单的必要收件信息，并尽量在原业务记录中修改。</p></Callout>
          </Chapter>

          <Chapter id="faq" number="12 · 常见问题" summary="下面汇总第一次使用时最容易混淆的概念。页面字段或状态与本指南不一致时，以客户工作台当时显示为准。" title="常见问题与名词解释">
            <div className="mt-6 grid gap-3">{faqs.map(([question, answer]) => <details className="group rounded-xl border border-slate-200 bg-slate-50 p-4 open:bg-white" key={question}><summary className="cursor-pointer list-none pr-8 font-semibold marker:hidden">{question}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{answer}</p></details>)}</div>
            <h3 className="mt-8 text-lg font-semibold">常用名词</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["SKU", "商品编码，用于把平台商品、仓库库存和订单匹配在一起。"], ["Seller SKU", "销售平台卖家端使用的商品编码，应与工作台 SKU 保持一致。"], ["Tracking", "物流追踪号，用于在承运商网站查看包裹运输状态。"], ["可用 / 占用", "可用库存可创建新出库；占用库存已被某条出库申请预留。"], ["RMA", "退货业务识别号，用于关联退货预报、到仓、质检和处理结果。"], ["CSV", "适合批量导入订单或商品资料的表格文件格式。"]].map(([term, definition]) => <div className="rounded-xl border border-slate-200 p-4" key={term}><strong>{term}</strong><p className="mt-2 text-sm leading-6 text-slate-600">{definition}</p></div>)}</div>
          </Chapter>

          <section className="rounded-2xl bg-[#0d1626] p-6 text-white sm:p-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-cyan-300">准备开始使用</p><h2 className="mt-2 text-2xl font-semibold">登录客户工作台，按业务步骤操作</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">第一次使用建议先完成店铺资料和 SKU；货物发仓前再提交入库预报。</p></div><Link className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50" href="/login">进入客户工作台<ArrowRight size={16} /></Link></div></section>
          <div className="flex justify-end px-1 pb-4 text-xs text-slate-500"><Link className="font-semibold text-cyan-800 hover:underline" href="#overview">返回顶部</Link></div>
        </article>
      </div>
    </main>
  );
}
