import { notFound } from "next/navigation";
import { Code128Barcode } from "@/app/components/Code128Barcode";
import { warehouseAddress } from "@/app/components/MarketingShell";
import { PrintButton } from "@/app/components/PrintButton";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, returnOrderStatusLabel, returnResolutionLabel } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value));
}

export default async function ReturnRmaLabelPage({ params }: PageProps) {
  await requireStaffSession();
  const { id } = await params;
  const data = await getWarehouseCoreData();
  const order = data.returnOrders.find((item) => item.id === decodeURIComponent(id));
  if (!order) notFound();

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950 print:bg-white print:p-4">
      <style>{`@media print { .no-print { display: none; } body { background: white; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-2xl justify-end">
        <PrintButton />
      </div>
      <section className="mx-auto max-w-2xl rounded-lg border-2 border-slate-950 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-950 pb-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-600">退货 RMA 标签</p>
            <h1 className="mt-2 font-mono text-3xl font-bold">{order.id}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">扫码后进入退货到仓 / 质检流程</p>
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
          <p>处理库位：<span className="font-mono font-semibold">{order.locationCode || "待定"}</span></p>
          <p>处理方式：<span className="font-semibold">{order.resolution ? returnResolutionLabel(order.resolution) : "待质检确认"}</span></p>
        </div>

        <div className="mt-6 rounded-md border border-slate-950 p-4 text-sm leading-6">
          <p className="font-semibold">退货收货地址</p>
          <p className="mt-1 font-mono text-base font-bold">{warehouseAddress.full}</p>
          <p className="mt-2 text-slate-600">客户寄回时需保留 RMA 单号，仓库到仓后扫描条码入库。</p>
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
          {order.customerNote ? <p className="mt-2">客户备注：{order.customerNote}</p> : null}
        </div>

        <section className="mt-8 grid grid-cols-3 gap-4 text-sm">
          <div className="border-t border-slate-400 pt-2">到仓签收</div>
          <div className="border-t border-slate-400 pt-2">质检人</div>
          <div className="border-t border-slate-400 pt-2">处理确认</div>
        </section>
      </section>
      <p className="no-print mt-4 text-center text-sm text-slate-500">建议使用 A4 或 A6 标签纸打印，扫码枪扫描 RMA 条码即可定位退货单。</p>
    </main>
  );
}
