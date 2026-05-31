import { AlertTriangle, Calculator, PackageCheck, ReceiptText, RefreshCcw, Truck, Warehouse } from "lucide-react";
import { PricingEstimator } from "../components/PricingEstimator";
import { InfoCard, PageHero, PageShell, PrimaryLink, SecondaryLink, SectionTitle } from "../components/MarketingShell";
import { surfaceHref } from "@/lib/surfaceLinks";

const pricingItems = [
  { title: "仓储费", body: "按库存占用、SKU、体积或托盘情况确认，适合前置库存和英国本地备货。", icon: Warehouse, meta: "库存占用" },
  { title: "入库处理费", body: "货到仓后完成收货、核对、贴标、拍照、差异登记和上架。", icon: PackageCheck, meta: "收货上架" },
  { title: "出库操作费", body: "订单拣货、复核、打包、称重、贴单和尾程交接按实际服务确认。", icon: Truck, meta: "订单履约" },
  { title: "退货 / FBA", body: "退货质检、换标、重上架、转寄、销毁和 FBA 贴标、分箱、换箱或打托按处理需求确认。", icon: RefreshCcw, meta: "增值服务" },
];

const pricingQuickRows = [
  ["仓储暂存", "体积、托盘、库存占用", "长期库存和超大件需单独确认"],
  ["入库处理", "箱数、SKU、贴标、拍照、差异处理", "资料不完整会影响入仓速度"],
  ["订单出库", "订单数、件数、包材、称重、面单", "特殊包装和偏远地址另行确认"],
  ["退货 / FBA", "质检、换标、打托、补仓准备", "按客户确认的处理规则执行"],
];

const quoteActions = [
  ["首次试仓", "适合先用小批量库存验证入仓、发货、退货和对账流程。"],
  ["月度测算", "按月单量、库存体积、退货比例和 FBA 需求估算整体成本。"],
  ["客服报价", "客服确认您的服务需求后，给出更准确的报价。"],
];

const pricingFormulas = [
  {
    title: "一件代发费用",
    formula: "卸货/入库处理 + 上架 + 仓储 + 出库操作 + 包材耗材 + 尾程物流 + 增值服务",
    body: "适合 TikTok Shop、eBay、Shopify 等英国本地发货场景。不同 SKU、重量段、包材和尾程渠道都会影响最终报价。",
  },
  {
    title: "FBA 中转费用",
    formula: "卸货/入库 + 标签/分箱/换箱/打托 + 仓储 + 出库 + 预约/送仓/自提相关费用",
    body: "适合 Amazon UK 补仓、贴标和打托送仓。亚马逊预约、卡派、自提失败或无法接收产生的费用需要按实际情况确认。",
  },
  {
    title: "退货换标费用",
    formula: "退件入库 + 清点/质检 + 拍照/换标 + 仓储 + 打包耗材 + 重上架/转寄/销毁",
    body: "适合英国本地 RMA、退货质检和二次销售处理。处理规则越清楚，费用和时效越容易确认。",
  },
];

const pricingFactors = ["SKU 数量", "箱数/托数", "尺寸重量", "仓储周期", "月单量", "退货比例", "FBA 标签/打托", "尾程渠道", "包材耗材", "异常处理"];

const excludedCosts = [
  "VAT、关税、清关费用",
  "偏远地区附加费",
  "超重、超尺寸或地址错误罚款",
  "拒收、退运、取件失败费用",
  "预约不准时、送仓延误或承运商临时附加费",
  "第三方物流商、平台或客户指定服务产生的实际账单费用",
];

export default function PricingPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="费用说明"
        title="不公开完整报价表，但把费用结构先讲清楚。"
        body="海外仓费用会受 SKU、箱数、尺寸重量、仓储周期、尾程渠道、退货比例和 FBA 处理方式影响。官网先说明费用怎么组成，正式报价由中文客服结合真实业务确认。"
        actions={
          <>
            <PrimaryLink href={surfaceHref("customer", "/inquiry")}>获取英国仓报价</PrimaryLink>
            <SecondaryLink href="#pricing-formulas">费用怎么计算</SecondaryLink>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["先说明收费项目", "仓储、入库、出库、退货、FBA 和增值处理分开说明，不用只看一个总价。"],
            ["先确认再操作", "特殊包装、拍照、换标、偏远派送等额外处理，会先确认需求再执行。"],
            ["账单可以核对", "费用会对应到货件、订单或处理记录，方便后续对账。"],
          ].map(([title, body]) => (
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/55 p-5" key={title}>
              <p className="text-base font-semibold text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </section>

        <section id="pricing-estimator" className="scroll-mt-6">
          <PricingEstimator />
        </section>

        <section id="pricing-formulas" className="scroll-mt-6">
          <SectionTitle
            eyebrow="费用怎么计算"
            title="按业务动作拆开看，比只看一个总价更准确。"
            body="以下是公开说明口径，用于帮助您理解费用来源；实际报价会结合 SKU、箱数、尺寸重量、服务项目、尾程渠道和承运商账单确认。"
          />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {pricingFormulas.map((item) => (
              <div className="metric-card p-5" key={item.title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                  <Calculator size={19} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-800">{item.formula}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {quoteActions.map(([title, body]) => (
            <div className="premium-panel magnetic-card p-5" key={title}>
              <ReceiptText size={22} className="text-[#0E7490]" />
              <h2 className="mt-4 text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </section>

        <section>
          <SectionTitle
            eyebrow="费用结构"
            title="把每一类费用拆清楚，账单才好核对。"
            body="我们会按您的平台、品类、货量、退货比例和 FBA 需求确认报价，避免只看一个不完整的总价。"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pricingItems.map((item) => (
              <InfoCard body={item.body} icon={item.icon} key={item.title} meta={item.meta} title={item.title} />
            ))}
          </div>
        </section>

        <section className="luxury-surface p-5 sm:p-6 lg:p-8">
          <SectionTitle
            eyebrow="常见费用说明"
            title="客户最常问的费用，先看这一张表。"
            body="具体价格需要结合货量、尺寸重量、包材、尾程渠道和退货处理方式确认。"
          />
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[0.8fr_1fr_1.1fr] bg-slate-950 px-4 py-3 text-xs font-semibold text-white">
              <span>费用项</span>
              <span>计费依据</span>
              <span>需要注意</span>
            </div>
            {pricingQuickRows.map(([name, basis, note]) => (
              <div className="grid grid-cols-1 gap-2 border-t border-slate-200 px-4 py-4 text-sm text-slate-700 md:grid-cols-[0.8fr_1fr_1.1fr]" key={name}>
                <strong className="text-slate-950">{name}</strong>
                <span>{basis}</span>
                <span className="text-slate-500">{note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="metric-card p-6">
            <SectionTitle
              eyebrow="影响报价的因素"
              title="同样是英国仓，价格会因为业务细节不同而变化。"
              body="客服报价前会先确认这些信息，避免后续因为重量、包材、尾程或异常处理产生误解。"
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {pricingFactors.map((factor) => (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700" key={factor}>
                  {factor}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-amber-700">
                <AlertTriangle size={19} />
              </span>
              <div>
                <p className="text-lg font-semibold text-amber-950">费用通常不包含</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  以下费用以实际账单及双方确认为准，正式报价会按业务场景单独说明。
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {excludedCosts.map((item) => (
                <div className="rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-sm leading-6 text-amber-950" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="metric-card p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-center">
            <SectionTitle
              eyebrow="下一步"
              title="想拿准确报价，直接提交您的业务情况。"
              body="告诉我们平台、SKU、月单量、库存体积、退货比例和是否需要 FBA，我们会按实际服务范围给您报价建议。"
            />
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <PrimaryLink href={surfaceHref("customer", "/inquiry")}>提交报价信息</PrimaryLink>
              <SecondaryLink href={surfaceHref("marketing", "/services")}>查看服务项目</SecondaryLink>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
