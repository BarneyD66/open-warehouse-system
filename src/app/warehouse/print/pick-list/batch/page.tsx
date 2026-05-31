import { notFound } from "next/navigation";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, outboundWorkModeLabel } from "@/lib/warehouseCoreStore";
import { PrintButton } from "../../../../components/PrintButton";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ids?: string }>;
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}

export default async function BatchPickListPage({ searchParams }: PageProps) {
  await requireStaffSession();
  const { ids } = await searchParams;
  const requestedIds = (ids ?? "")
    .split(",")
    .map((id) => decodeURIComponent(id).trim())
    .filter(Boolean);
  if (requestedIds.length === 0) notFound();

  const data = await getWarehouseCoreData();
  const orders = data.outboundOrders.filter((order) => requestedIds.includes(order.id));
  if (orders.length === 0) notFound();

  const lines = orders.flatMap((order) =>
    (order.skuLines ?? []).map((line) => {
      const balance = data.inventoryBalances.find((item) => item.customerCode === order.customerCode && item.skuCode === line.skuCode);
      return {
        orderId: order.id,
        customerCode: order.customerCode,
        channel: order.channel,
        workMode: outboundWorkModeLabel(order.workMode),
        pickWaveNo: order.pickWaveNo || "-",
        basketNo: order.basketNo || "-",
        skuCode: line.skuCode,
        quantity: line.quantity,
        locationCode: balance?.locationCode || "未指定",
      };
    }),
  );

  return (
    <main className="min-h-screen bg-white p-8 text-slate-950 print:p-4">
      <style>{`@media print { .no-print { display: none; } body { background: white; } }`}</style>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <section className="border-b-2 border-slate-950 pb-4">
        <p className="text-sm font-semibold tracking-wide text-slate-500">仓库批量出库作业单</p>
        <h1 className="mt-2 text-3xl font-bold">批量拣货单</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <p>出库申请：{orders.length} 张</p>
          <p>SKU 行数：{lines.length}</p>
          <p>打印时间：{formatDate(new Date().toISOString())}</p>
          <p>订单数合计：{orders.reduce((total, order) => total + order.orderCount, 0)}</p>
        </div>
      </section>
      <table className="mt-6 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-950">
            <th className="py-2">出库单</th>
            <th className="py-2">客户</th>
            <th className="py-2">模式/波次</th>
            <th className="py-2">渠道</th>
            <th className="py-2">SKU</th>
            <th className="py-2">库位</th>
            <th className="py-2">篮号</th>
            <th className="py-2">数量</th>
            <th className="py-2">复核</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr className="border-b border-slate-200" key={`${line.orderId}-${line.skuCode}`}>
              <td className="py-3 font-mono text-xs font-semibold">{line.orderId}</td>
              <td className="py-3">{line.customerCode}</td>
              <td className="py-3">{line.workMode}<br /><span className="font-mono text-xs">{line.pickWaveNo}</span></td>
              <td className="py-3">{line.channel}</td>
              <td className="py-3 font-mono font-semibold">{line.skuCode}</td>
              <td className="py-3">{line.locationCode}</td>
              <td className="py-3">{line.basketNo}</td>
              <td className="py-3 text-lg font-semibold">{line.quantity}</td>
              <td className="py-3">□ 已拣货　□ 已复核</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="mt-8 grid grid-cols-3 gap-4 text-sm">
        <div className="border-t border-slate-400 pt-2">拣货人</div>
        <div className="border-t border-slate-400 pt-2">复核人</div>
        <div className="border-t border-slate-400 pt-2">交运人</div>
      </section>
    </main>
  );
}
