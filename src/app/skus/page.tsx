import Link from "next/link";
import { ArrowRight, PackageSearch, Tags, Warehouse } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";
import { CustomerSkuBulkTools, CustomerSkuForm } from "../components/CustomerOperationForms";
import { PageShell } from "../components/MarketingShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SkusPage() {
  const session = await requireCustomerSession();
  const coreData = await getWarehouseCoreDataForCustomer(session.customerCode);
  const inventoryBySku = new Map(coreData.inventoryBalances.map((item) => [item.skuCode, item]));

  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <aside className="min-w-0 space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">SKU 档案</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">商品与库存基础资料</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">先维护 SKU，后续入库、库存预警、出库申请和费用核算都会围绕 SKU 进行。</p>
            </section>
            <section className="grid gap-3">
              {[
                { icon: Tags, title: "SKU 建档", body: "创建商品编码、名称、条码和分类。" },
                { icon: Warehouse, title: "库存底表", body: "建档后自动初始化库存余额，运营后续可盘点和调整。" },
                { icon: PackageSearch, title: "出库前置", body: "出库申请会校验 SKU 是否已经存在。" },
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

          <div className="min-w-0 space-y-5">
            <CustomerSkuBulkTools />
            <CustomerSkuForm />
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-950">我的 SKU</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">商品</th>
                      <th className="px-4 py-3">分类</th>
                      <th className="px-4 py-3">库存</th>
                      <th className="px-4 py-3">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {coreData.skus.map((sku) => {
                      const balance = inventoryBySku.get(sku.skuCode);
                      return (
                        <tr key={sku.skuCode}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-950">{sku.skuCode}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <p>{sku.productName}</p>
                            {sku.barcode ? <p className="mt-1 text-xs text-slate-500">{sku.barcode}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{sku.category || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            可用 {balance?.availableQty ?? 0} / 占用 {balance?.reservedQty ?? 0} / 冻结 {balance?.frozenQty ?? 0} / 残次 {balance?.defectiveQty ?? 0} / 预警 {balance?.alertQty ?? 0}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{sku.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {coreData.skus.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>
                          暂无 SKU
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
