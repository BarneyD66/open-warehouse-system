import { notFound } from "next/navigation";
import { Code128Barcode } from "@/app/components/Code128Barcode";
import { warehouseAddress } from "@/app/components/MarketingShell";
import { PrintButton } from "@/app/components/PrintButton";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getWarehouseCoreDataForCustomer, returnOrderStatusLabel } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value));
}

export default async function CustomerReturnRmaLabelPage({ params }: PageProps) {
  const session = await requireCustomerSession();
  const { id } = await params;
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  const order = data.returnOrders.find((item) => item.id === decodeURIComponent(id));
  if (!order) notFound();

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950 print:bg-white print:p-4">
      <style>{`@media print { .no-print { display: none; } body { background: white; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-2xl items-center justify-between">
        <a className="text-sm font-semibold text-slate-600 hover:text-slate-950" href="/returns">返回退货页面</a>
        <PrintButton />
      </div>
      <section className="mx-auto max-w-2xl rounded-lg border-2 border-slate-950 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-950 pb-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-600">客户退货 RMA 标签</p>
            <h1 className="mt-2 font-mono text-3xl font-bold">{order.id}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">请将此标签随退货包裹一同寄回</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">客户编号</p>
            <p className="font-mono text-sm font-bold">{order.customerCode}</p>
            <p className="mt-2 text-xs text-slate-500">状态</p>
            <p className="text-sm font-semibold">{returnOrderStatusLabel(order.status)}</p>
          </div>
        </div>

        <div className="my-6 border border-slate-950 p-4">
          <Code128Barcode value={order.id} />
          <p className="mt-3 text-center font-mono text-2xl font-bold tracking-widest">{order.id}</p>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p>平台：<span className="font-semibold">{order.platform}</span></p>
          <p>原订单号：<span className="font-mono font-semibold">{order.originalOrderNo || "-"}</span></p>
          <p>买家退货追踪号：<span className="font-mono font-semibold">{order.buyerReturnTracking || "请尽快补充"}</span></p>
          <p>预计到仓：<span className="font-semibold">{dateText(order.expectedArrivalDate)}</span></p>
        </div>

        <div className="mt-6 rounded-md border border-slate-950 p-4 text-sm leading-6">
          <p className="font-semibold">寄回仓库地址</p>
          <p className="mt-1 font-mono text-base font-bold">{warehouseAddress.full}</p>
          <p className="mt-2 text-slate-600">寄回时请在包裹外箱或随箱文件中保留 RMA 单号：{order.id}</p>
        </div>

        <table className="mt-6 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-950">
              <th className="py-2">SKU</th>
              <th className="py-2 text-right">数量</th>
            </tr>
          </thead>
          <tbody>
            {order.skuLines.map((line) => (
              <tr className="border-b border-slate-200" key={line.skuCode}>
                <td className="py-3 font-mono font-semibold">{line.skuCode}</td>
                <td className="py-3 text-right text-lg font-semibold">{line.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6">
          <p className="font-semibold">使用说明</p>
          <p className="mt-1">请打印后放入包裹或贴在外箱明显位置。仓库收到后会扫描 RMA 条码并同步到仓、质检和处理进度。</p>
        </div>
      </section>
    </main>
  );
}
