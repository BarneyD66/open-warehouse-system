import Link from "next/link";
import { ArrowRight, PackageSearch, Tags, Warehouse } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";
import { CustomerSkuBulkTools, CustomerSkuForm } from "../components/CustomerOperationForms";
import { CustomerSkuEditButton } from "../components/CustomerSkuEditButton";
import { CustomerWorkbenchShell } from "../components/CustomerWorkbenchShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function skuImageStyle(imageUrl?: string) {
  const safeUrl = imageUrl?.trim().replace(/["\\\n\r]/g, "");
  return safeUrl ? { backgroundImage: `url("${safeUrl}")` } : undefined;
}

export default async function SkusPage() {
  const session = await requireCustomerSession();
  const coreData = await getWarehouseCoreDataForCustomer(session.customerCode);
  const inventoryBySku = new Map(coreData.inventoryBalances.map((item) => [item.skuCode, item]));

  return (
    <CustomerWorkbenchShell active="skus" customerCode={session.customerCode} customerCompany={coreData.customer?.companyName} title="SKU 库存">
      <div className="text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <aside className="min-w-0 space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">商品编码</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">商品与库存基础资料</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">请维护平台订单里的 Seller SKU 和商品名称，后续上传订单时会用它来匹配仓库里的商品。</p>
            </section>
            <section className="grid gap-3">
              {[
                { icon: Tags, title: "商品编码", body: "填写 Seller SKU、商品名称、条码和分类。" },
                { icon: Warehouse, title: "库存匹配", body: "仓库会按商品编码确认货物是否可发。" },
                { icon: PackageSearch, title: "订单校验", body: "上传订单时会检查商品编码是否已经维护。" },
              ].map(({ icon: Icon, title, body }) => (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={title}>
                  <Icon className="text-[#0E7490]" size={20} />
                  <h2 className="mt-3 text-sm font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </section>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/workspace">
              返回订单处理工作台 <ArrowRight size={16} />
            </Link>
          </aside>

          <div className="min-w-0 space-y-5">
            <CustomerSkuBulkTools />
            <CustomerSkuForm />
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-950">我的商品编码</h2>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[820px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">图片</th>
                      <th className="px-4 py-3">商品编码</th>
                      <th className="px-4 py-3">商品</th>
                      <th className="px-4 py-3">分类</th>
                      <th className="px-4 py-3">库存</th>
                      <th className="px-4 py-3">状态</th>
                      <th className="px-4 py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {coreData.skus.map((sku) => {
                      const balance = inventoryBySku.get(sku.skuCode);
                      return (
                        <tr key={sku.skuCode}>
                          <td className="px-4 py-3">
                            <div
                              aria-label={sku.imageUrl ? `${sku.productName} 商品图片` : "暂无商品图片"}
                              className="h-12 w-12 rounded-md border border-slate-200 bg-slate-50 bg-cover bg-center"
                              role="img"
                              style={skuImageStyle(sku.imageUrl)}
                            >
                              {sku.imageUrl ? null : <PackageSearch className="m-3 text-slate-300" size={22} />}
                            </div>
                          </td>
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
                          <td className="px-4 py-3">
                            <CustomerSkuEditButton sku={{ ...sku, alertQty: balance?.alertQty ?? 0 }} />
                          </td>
                        </tr>
                      );
                    })}
                    {coreData.skus.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                          暂无商品编码
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 p-4 md:hidden">
                {coreData.skus.map((sku) => {
                  const balance = inventoryBySku.get(sku.skuCode);
                  return (
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={sku.skuCode}>
                      <div className="flex items-start gap-3">
                        <div
                          aria-label={sku.imageUrl ? `${sku.productName} 商品图片` : "暂无商品图片"}
                          className="h-16 w-16 shrink-0 rounded-md border border-slate-200 bg-white bg-cover bg-center"
                          role="img"
                          style={skuImageStyle(sku.imageUrl)}
                        >
                          {sku.imageUrl ? null : <PackageSearch className="m-5 text-slate-300" size={22} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="break-all font-mono text-xs font-semibold text-slate-950">{sku.skuCode}</p>
                            <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{sku.status}</span>
                          </div>
                          <p className="mt-2 break-words text-sm font-semibold text-slate-900">{sku.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">{sku.category || "未分类"}{sku.barcode ? ` · ${sku.barcode}` : ""}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <span className="rounded-md bg-white px-2 py-2">可用 {balance?.availableQty ?? 0}</span>
                        <span className="rounded-md bg-white px-2 py-2">占用 {balance?.reservedQty ?? 0}</span>
                        <span className="rounded-md bg-white px-2 py-2">冻结 {balance?.frozenQty ?? 0}</span>
                        <span className="rounded-md bg-white px-2 py-2">预警 {balance?.alertQty ?? 0}</span>
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <CustomerSkuEditButton sku={{ ...sku, alertQty: balance?.alertQty ?? 0 }} />
                      </div>
                    </article>
                  );
                })}
                {coreData.skus.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">暂无商品编码，创建后会显示在这里。</div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </CustomerWorkbenchShell>
  );
}
