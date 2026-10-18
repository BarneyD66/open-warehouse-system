import { CustomerWorkbenchShell } from "@/app/components/CustomerWorkbenchShell";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const session = await requireCustomerSession();
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  return (
    <CustomerWorkbenchShell active="shipping" customerCode={session.customerCode} customerCompany={data.customer?.companyName} title="运费查询">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <p className="text-sm leading-6 text-slate-600">查看自己出库订单已记录的运费。未记录的费用显示“待确认”，最终金额以仓库确认及账单为准。</p>
        <div className="grid gap-3">
          {data.outboundOrders.map((order) => (
            <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4" key={order.id}>
              <div className="min-w-0 break-all"><h2 className="font-semibold">{order.id}</h2><p className="mt-1 text-sm text-slate-600">{order.channel}</p></div>
              <p className="font-semibold">{order.shippingFee == null ? "待确认" : `£${order.shippingFee.toFixed(2)}`}</p>
            </article>
          ))}
          {!data.outboundOrders.length ? <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">暂无出库订单运费记录。</p> : null}
        </div>
      </div>
    </CustomerWorkbenchShell>
  );
}
