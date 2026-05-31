import Link from "next/link";
import { ArrowRight, FileText, PackageCheck, ReceiptText } from "lucide-react";
import { CustomerInquiryForm } from "../components/CustomerMvpForms";
import { PageShell } from "../components/MarketingShell";

export const dynamic = "force-dynamic";

export default function InquiryPage() {
  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <aside className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">合作需求</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">提交报价需求</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">告诉我们平台、货量、SKU 和服务需求，客服会在运营后台评估并生成报价方案。</p>
            </section>
            <section className="grid gap-3">
              {[
                { icon: FileText, title: "先评估需求", body: "确认平台、月单量、品类和服务组合。" },
                { icon: ReceiptText, title: "再输出报价", body: "按入库、仓储、出库、尾程和增值服务拆分费用。" },
                { icon: PackageCheck, title: "确认后入库", body: "报价确认后继续创建 ASN 入库预报。" },
              ].map(({ icon: Icon, title, body }) => (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={title}>
                  <Icon className="text-[#0E7490]" size={20} />
                  <h2 className="mt-3 text-sm font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </section>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/portal">
              返回客户工作台 <ArrowRight size={16} />
            </Link>
          </aside>
          <div>
            <CustomerInquiryForm />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
