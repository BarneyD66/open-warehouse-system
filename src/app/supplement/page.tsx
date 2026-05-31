import { CheckCircle2, PackageCheck, Search, ShieldCheck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { CustomerSupplementForm } from "../components/CustomerMvpForms";
import { InfoCard, PageHero, PageShell, PrimaryLink, SecondaryLink, SectionTitle } from "../components/MarketingShell";

type SupplementPageProps = {
  searchParams?: Promise<{ asn?: string }>;
};

const tips = [
  {
    title: "补外箱标签和装箱单",
    body: "仓库需要用外箱标签和装箱单匹配入库预报编号、箱数、SKU 和到仓批次。",
    icon: PackageCheck,
    meta: "入库资料",
  },
  {
    title: "补追踪号",
    body: "承运商、追踪号、车牌或提单号能帮助仓库提前识别货件。",
    icon: Search,
    meta: "运输信息",
  },
  {
    title: "补授权资料",
    body: "VAT/EORI、品牌授权、清关资料等会影响收货审核和后续留痕。",
    icon: ShieldCheck,
    meta: "合规",
  },
];

const supplementPriority = [
  ["优先补", "外箱标签、装箱单、追踪号"],
  ["其次补", "SKU 清单、产品图片、标签文件"],
  ["按需补", "VAT/EORI、品牌授权、清关或合规资料"],
];

export default async function SupplementPage({ searchParams }: SupplementPageProps) {
  await requireCustomerSession();

  const params = await searchParams;
  const initialAsn = params?.asn ?? "";

  return (
    <PageShell surface="customer">
      <PageHero
        surface="customer"
        eyebrow="补交资料"
        title="缺外箱标签、装箱单或追踪号时，可以在这里补交。"
        body="把缺失资料集中补齐，仓库审核时可以直接匹配入库预报编号、箱数、SKU、追踪号和附件说明。"
        actions={
          <>
            <PrimaryLink href="/portal">返回客户工作台</PrimaryLink>
            <SecondaryLink href="/tracking">查进度</SecondaryLink>
          </>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
        <aside className="order-2 space-y-5 lg:order-1">
          <SectionTitle eyebrow="自助补资料" title="缺什么、怎么补，一次看清楚" body="资料会围绕入库单和货件提交，补交后客服和仓库可以继续审核。" />
          <div className="grid gap-3">
            {tips.map((item) => (
              <InfoCard body={item.body} icon={item.icon} key={item.title} meta={item.meta} title={item.title} />
            ))}
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 text-amber-700" size={20} />
              <div>
                <p className="text-sm font-semibold text-amber-900">资料建议</p>
                <p className="mt-2 text-sm leading-6 text-amber-800">请优先补交能帮助仓库识别货件的文件，例如外箱标签、装箱单、SKU 清单、物流面单和授权资料。</p>
              </div>
            </div>
          </div>
          <div className="luxury-surface p-5">
            <p className="text-sm font-semibold text-slate-950">补资料优先级</p>
            <div className="mt-4 grid gap-3">
              {supplementPriority.map(([title, body]) => (
                <div className="rounded-md border border-slate-200 bg-white p-3" key={title}>
                  <p className="text-sm font-semibold text-slate-950">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <div className="order-1 lg:order-2">
          <CustomerSupplementForm initialAsn={initialAsn} />
        </div>
      </div>
    </PageShell>
  );
}
