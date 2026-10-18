import { notFound } from "next/navigation";
import { Code128Barcode } from "@/app/components/Code128Barcode";
import { warehouseAddress } from "@/app/components/MarketingShell";
import { PrintButton } from "@/app/components/PrintButton";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, returnOrderStatusLabel } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ids?: string }>;
};

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value));
}

export default async function BatchReturnRmaLabelPage({ searchParams }: PageProps) {
  await requireStaffSession();
  const { ids } = await searchParams;
  const requestedIds = (ids ?? "")
    .split(",")
    .map((id) => decodeURIComponent(id).trim())
    .filter(Boolean);
  if (requestedIds.length === 0) notFound();

  const data = await getWarehouseCoreData();
  const orders = data.returnOrders.filter((order) => requestedIds.includes(order.id));
  if (orders.length === 0) notFound();

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @media print {
          .no-print { display: none; }
          .rma-label { break-after: page; page-break-after: always; box-shadow: none; border-radius: 0; }
          .rma-label:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">本次共 {orders.length} 张 RMA 标签</p>
        <PrintButton />
      </div>
      <div className="mx-auto grid max-w-3xl gap-4 print:max-w-none print:gap-0">
        {orders.map((order) => (
          <section className="rma-label rounded-lg border-2 border-slate-950 bg-white p-6 shadow-sm print:min-h-screen print:p-8" key={order.id}>
            <div className="flex items-start justify-between gap-4 border-b-2 border-slate-950 pb-4">
              <div>
                <p className="text-sm font-semibold tracking-wide text-slate-600">退货 RMA 标签</p>
                <h1 className="mt-2 font-mono text-3xl font-bold">{order.id}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-600">批量打印 / 扫码到仓</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">客户</p>
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
              <p>买家退货追踪号：<span className="font-mono font-semibold">{order.buyerReturnTracking || "-"}</span></p>
              <p>预计到仓：<span className="font-semibold">{dateText(order.expectedArrivalDate)}</span></p>
            </div>
            <div className="mt-5 rounded-md border border-slate-950 p-3 text-sm leading-6">
              <p className="font-semibold">退货收货地址</p>
              <p className="mt-1 font-mono font-bold">{warehouseAddress.full}</p>
            </div>
            <table className="mt-6 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-950">
                  <th className="py-2">SKU</th>
                  <th className="py-2 text-right">数量</th>
                  <th className="py-2 text-right">质检</th>
                </tr>
              </thead>
              <tbody>
                {order.skuLines.map((line) => (
                  <tr className="border-b border-slate-200" key={line.skuCode}>
                    <td className="py-3 font-mono font-semibold">{line.skuCode}</td>
                    <td className="py-3 text-right text-lg font-semibold">{line.quantity}</td>
                    <td className="py-3 text-right">□ 正常　□ 破损　□ 缺件</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6">
              <p className="font-semibold">退货原因</p>
              <p className="mt-1">{order.returnReason}</p>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
