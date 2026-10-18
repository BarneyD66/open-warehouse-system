import Link from "next/link";
import { ArrowLeft, ExternalLink, FileSpreadsheet, Store } from "lucide-react";
import { CustomerWorkbenchShell } from "@/app/components/CustomerWorkbenchShell";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { requireCustomerSession } from "@/lib/customerAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const platformGuides = [
  {
    name: "TikTok Shop",
    note: "适合 Seller Shipping / 自发货订单",
    steps: ["打开 Seller Center，进入 Orders / Manage Orders。", "筛选 To Ship / Awaiting shipment。", "点击 Export，导出订单与收件信息。", "下载完成后回到工作台上传校验。"],
    href: "https://seller-us.tiktok.com/university/essay?default_language=en&knowledge_id=8693445092050690",
  },
  {
    name: "Amazon UK",
    note: "适合 FBM / Merchant Fulfilled 订单",
    steps: ["进入 Seller Central，打开 Orders / Order Reports。", "选择 New Orders，并设置需要导出的日期范围。", "点击 Request Report，等待报告生成。", "在报告列表下载文件后回到工作台上传。"],
    href: "https://sellercentral.amazon.co.uk/order-reports-and-feeds/reports",
  },
  {
    name: "eBay UK",
    note: "支持全部订单或勾选订单导出",
    steps: ["进入 Seller Hub 的 Orders / Manage orders。", "筛选 Awaiting dispatch 或需要处理的订单。", "点击 Download report；也可以勾选订单后选择 More / Download selected。", "下载 CSV 后回到工作台上传校验。"],
    href: "https://www.ebay.co.uk/help/selling/selling-tools/seller-hub?id=4095",
  },
  {
    name: "Shopify",
    note: "支持当前页、选中订单或日期范围",
    steps: ["进入 Shopify Admin，打开 Orders。", "筛选未发货订单，或勾选需要处理的订单。", "点击 Export，选择导出范围和 CSV 格式。", "文件下载或邮件送达后，回到工作台上传校验。"],
    href: "https://help.shopify.com/en/manual/fulfillment/managing-orders/exporting-orders",
  },
] as const;

export default async function OrderExportGuidePage() {
  const session = await requireCustomerSession();
  const account = await getCustomerAccountByCode(session.customerCode);

  return (
    <CustomerWorkbenchShell
      active="overview"
      actions={
        <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/workspace">
          <ArrowLeft size={16} />
          返回工作台
        </Link>
      }
      customerCode={session.customerCode}
      customerCompany={account?.companyName}
      eyebrow="多平台订单导入"
      title="平台订单导出攻略"
    >
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
              <FileSpreadsheet size={19} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">先导出待发货订单，再上传到工作台</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">不同平台菜单名称略有差异，但都建议导出订单号、SKU、数量、收件人、地址和邮编。上传后系统会先校验，不会直接发货。</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {platformGuides.map((guide) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={guide.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Store size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">{guide.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">{guide.note}</p>
                  </div>
                </div>
                <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={guide.href} rel="noreferrer" target="_blank">
                  官方说明
                  <ExternalLink size={13} />
                </a>
              </div>
              <ol className="mt-5 space-y-3">
                {guide.steps.map((step, index) => (
                  <li className="flex gap-3 text-sm leading-6 text-slate-600" key={step}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-semibold text-cyan-800">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          如果平台导出的字段与模板不同，先上传查看校验结果；系统会标出缺少的订单号、SKU、数量或地址字段，再按提示调整文件。
        </section>
      </div>
    </CustomerWorkbenchShell>
  );
}
