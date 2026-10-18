import { AlertTriangle, PackageCheck, ReceiptText, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
import { InfoCard, PageHero, PageShell, PrimaryLink, SecondaryLink, SectionTitle } from "../components/MarketingShell";
import { surfaceHref } from "@/lib/surfaceLinks";

const helpItems = [
  { title: "如何创建入库预报？", body: "准备公司/店铺、SKU、箱数、预计到仓、装箱单、外箱标签和服务要求。", icon: PackageCheck },
  { title: "入库需要哪些资料？", body: "建议准备 VAT/EORI、商品信息、装箱单、外箱标签、清关相关文件和授权资料。", icon: ShieldCheck },
  { title: "支持哪些发货场景？", body: "英国一件代发、FBA 补仓中转、退货换标、B2B 本地转运和小批量入仓。", icon: Truck },
  { title: "退货如何处理？", body: "退货到仓后可质检拍照，再由客户确认重上架、换标、销毁或转寄。", icon: RefreshCcw },
  { title: "费用如何对账？", body: "仓储、入库、出库、退货、FBA 贴标/分箱/打托和尾程费用都能对应到货件、订单或处理项目。", icon: ReceiptText },
  { title: "异常如何处理？", body: "外箱标签缺失、数量差异、地址错误、破损、面单失败都会记录到异常处理记录里。", icon: AlertTriangle },
];

const inboundChecklist = [
  ["商品信息", "SKU、品名、条码、图片、尺寸重量和是否带电/易碎。"],
  ["装箱资料", "每箱 SKU 明细、数量、箱规、箱重、装箱单和外箱标签。"],
  ["到仓信息", "预计到仓时间、运输方式、承运商、追踪号、送仓预约。"],
  ["服务要求", "仓储、一件代发、FBA 中转、退货换标、拍照质检或打托。"],
];

export default function HelpPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="帮助中心"
        title="发货前准备"
        body="先确认报价、入库资料和预计到仓时间。"
        actions={
          <>
            <PrimaryLink href={surfaceHref("customer", "/inbound")}>创建入库预报</PrimaryLink>
            <SecondaryLink href={surfaceHref("customer", "/inquiry")}>获取报价</SecondaryLink>
          </>
        }
        showPanel={false}
      />

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <section>
          <SectionTitle eyebrow="常见问题" title="发货前最常遇到的问题" body="先确认资料、费用、退货和异常怎么处理，入仓会顺很多。" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {helpItems.map((item) => (
              <InfoCard body={item.body} icon={item.icon} key={item.title} title={item.title} />
            ))}
          </div>
        </section>

        <section className="luxury-surface p-5 sm:p-6 lg:p-8">
          <SectionTitle
            eyebrow="入仓资料清单"
            title="准备发货前，把这四类资料先整理好。"
            body="资料越完整，到仓后越容易快速验收、上架和开始履约。"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {inboundChecklist.map(([title, body], index) => (
              <div className="bento-card magnetic-card p-5" key={title}>
                <p className="font-mono text-xs font-semibold text-[#0E7490]">0{index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="metric-card p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <SectionTitle eyebrow="下一步" title="准备好资料后，可以直接提交报价需求或入库预报。" body="已经有 SKU 清单、装箱单、外箱标签和预计到仓时间时，可以先提交资料，客服会继续确认到仓和收货安排。" />
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <PrimaryLink href={surfaceHref("customer", "/inquiry")}>咨询入仓要求</PrimaryLink>
              <SecondaryLink href={surfaceHref("marketing", "/pricing")}>查看费用说明</SecondaryLink>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
