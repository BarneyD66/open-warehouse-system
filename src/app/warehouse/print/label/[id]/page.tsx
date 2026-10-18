import { notFound } from "next/navigation";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, outboundWorkModeLabel } from "@/lib/warehouseCoreStore";
import { PrintButton } from "../../../../components/PrintButton";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function labelFormatText(format?: "pdf" | "zpl" | "internal") {
  if (format === "pdf") return "承运商 PDF 面单";
  if (format === "zpl") return "承运商 ZPL 面单";
  return "系统内部面单";
}

export default async function ShippingLabelPage({ params }: PageProps) {
  await requireStaffSession();
  const { id } = await params;
  const data = await getWarehouseCoreData();
  const order = data.outboundOrders.find((item) => item.id === decodeURIComponent(id));
  if (!order) notFound();

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950 print:bg-white print:p-4">
      <style>{`@media print { .no-print { display: none; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-xl justify-end">
        <PrintButton />
      </div>
      <section className="mx-auto max-w-xl rounded-lg border-2 border-slate-950 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-950 pb-4">
          <div>
            <p className="text-sm font-semibold tracking-wide">出货标签 / 面单预览</p>
            <h1 className="mt-2 text-2xl font-bold">{order.carrierName || "待分配承运商"}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">{order.carrierServiceName || order.channel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">出库单</p>
            <p className="font-mono text-sm font-bold">{order.id}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">收件信息</p>
            <p className="mt-1 text-xl font-bold">{order.recipientName || "收件人待补"}</p>
            <p className="mt-2 whitespace-pre-line text-base leading-7">{order.deliveryAddress || "地址待补"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm">
            <p>客户：{order.customerCode}</p>
            <p>模式：{outboundWorkModeLabel(order.workMode)}</p>
            <p>波次：{order.pickWaveNo || "-"}</p>
            <p>篮号：{order.basketNo || "-"}</p>
            <p>订单数：{order.orderCount}</p>
            <p>期望发货：{order.requestedShipDate || "-"}</p>
            <p>重量/件数：{order.packageWeightKg ?? "-"}kg / {order.packageCount ?? 1}</p>
            <p>费用：{typeof order.shippingFee === "number" ? `£${order.shippingFee.toFixed(2)}` : "-"}</p>
            <p>状态：{order.status}</p>
            <p>格式：{labelFormatText(order.labelFormat)}</p>
          </div>
          <div className="mt-2 border border-slate-950 p-4 text-center">
            <p className="text-xs font-semibold text-slate-500">追踪号</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{order.trackingNumber || order.id}</p>
            <p className="mt-2 text-xs text-slate-500">这是仓库内部预览页；真实 PDF/ZPL 面单请通过出库单里的“打印”按钮打开系统鉴权下载链接。</p>
          </div>
        </div>
      </section>
      <p className="no-print mt-4 text-center text-sm text-slate-500">使用浏览器打印可输出 A4/A6 面单。</p>
    </main>
  );
}
