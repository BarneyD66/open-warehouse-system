import { notFound } from "next/navigation";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, outboundWorkModeLabel, suggestOutboundLotAllocations } from "@/lib/warehouseCoreStore";
import { PrintButton } from "../../../../components/PrintButton";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}

export default async function PickListPage({ params }: PageProps) {
  await requireStaffSession();
  const { id } = await params;
  const data = await getWarehouseCoreData();
  const order = data.outboundOrders.find((item) => item.id === decodeURIComponent(id));
  if (!order) notFound();

  const allocationBySku = new Map(suggestOutboundLotAllocations(order, data.inventoryLots).map((allocation) => [allocation.skuCode, allocation]));

  return (
    <main className="min-h-screen bg-white p-8 text-slate-950 print:p-4">
      <style>{`@media print { .no-print { display: none; } body { background: white; } }`}</style>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <section className="border-b-2 border-slate-950 pb-4">
        <p className="text-sm font-semibold tracking-wide text-slate-500">仓库出库作业单</p>
        <h1 className="mt-2 text-3xl font-bold">拣货单</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <p>出库单：<span className="font-mono font-semibold">{order.id}</span></p>
          <p>作业模式：{outboundWorkModeLabel(order.workMode)}</p>
          <p>波次号：<span className="font-mono font-semibold">{order.pickWaveNo || "-"}</span></p>
          <p>拣货单号：<span className="font-mono font-semibold">{order.pickListNo || "-"}</span></p>
          <p>拣货员：{order.assignedPicker || "-"}</p>
          <p>篮号/格口：{order.basketNo || "-"}</p>
          <p>客户：{order.customerCode}</p>
          <p>渠道：{order.channel}</p>
          <p>订单数：{order.orderCount}</p>
          <p>状态：{order.status}</p>
          <p>创建：{formatDate(order.createdAt)}</p>
        </div>
      </section>
      <table className="mt-6 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-950">
            <th className="py-2">SKU</th>
            <th className="py-2">建议批次 / 库位</th>
            <th className="py-2">数量</th>
            <th className="py-2">复核</th>
          </tr>
        </thead>
        <tbody>
          {order.skuLines?.map((line) => {
            const allocation = allocationBySku.get(line.skuCode);
            return (
              <tr className="border-b border-slate-200" key={line.skuCode}>
                <td className="py-3 font-mono font-semibold">{line.skuCode}</td>
                <td className="py-3">
                  {allocation?.lots.length ? (
                    allocation.lots.map((lot) => (
                      <p className="text-xs leading-5" key={lot.lotId}>
                        {lot.lotNo} x {lot.quantity} / {lot.locationCode || "未设库位"} / {lot.expiryDate || "无效期"}
                      </p>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-amber-700">暂无可用批次</span>
                  )}
                  {allocation?.shortageQty ? <p className="text-xs font-semibold text-rose-700">缺口 {allocation.shortageQty}</p> : null}
                </td>
                <td className="py-3 text-lg font-semibold">{line.quantity}</td>
                <td className="py-3">□ 已拣货　□ 已复核</td>
              </tr>
            );
          })}
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
