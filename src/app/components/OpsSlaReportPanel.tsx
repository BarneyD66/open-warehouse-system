import { Activity, AlertTriangle, Clock, PoundSterling, Truck } from "lucide-react";
import Link from "next/link";
import type { InboundSubmission } from "@/lib/localStore";
import type { CustomerWorkOrder } from "@/lib/opsExpansionStore";
import type { BillingRecord, CoreOutboundOrder } from "@/lib/warehouseCoreStore";

type Props = {
  inbounds: InboundSubmission[];
  outbounds: CoreOutboundOrder[];
  billingRecords: BillingRecord[];
  workOrders: CustomerWorkOrder[];
  nowMs: number;
};

function hoursSince(value: string | undefined, nowMs: number) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (nowMs - time) / 36e5);
}

function rate(ok: number, total: number) {
  if (total <= 0) return "100%";
  return `${Math.round((ok / total) * 100)}%`;
}

function latestVisibleMessage(item: CustomerWorkOrder) {
  return (item.messages ?? []).filter((message) => message.visibleToCustomer).at(-1);
}

function requiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function scannedQty(values?: Record<string, number>) {
  return Object.values(values ?? {}).reduce((sum, value) => sum + value, 0);
}

function metric(label: string, value: string | number, tone: "slate" | "emerald" | "amber" | "rose") {
  const colors = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div className={`rounded-md border p-3 ${colors[tone]}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function OpsSlaReportPanel({ inbounds, outbounds, billingRecords, workOrders, nowMs }: Props) {
  const openInbounds = inbounds.filter((item) => !["closed", "cancelled"].includes(item.status));
  const inboundOnTime = openInbounds.filter((item) => hoursSince(item.createdAt, nowMs) <= 48 || ["putaway_completed", "closed"].includes(item.status)).length;
  const inboundOverdue = openInbounds.filter((item) => hoursSince(item.createdAt, nowMs) > 48 && !["putaway_completed", "closed"].includes(item.status));

  const openOutbounds = outbounds.filter((item) => item.status !== "shipped");
  const outboundOnTime = openOutbounds.filter((item) => hoursSince(item.createdAt, nowMs) <= 24 || item.status === "shipped").length;
  const outboundOverdue = openOutbounds.filter((item) => hoursSince(item.createdAt, nowMs) > 24 && item.status !== "shipped");
  const outboundReviewRisks = outbounds.filter((item) => {
    if (item.interceptStatus === "requested" || item.interceptStatus === "restock_pending") return true;
    if (item.status === "handover" && !item.packageWeightKg) return true;
    const required = requiredQty(item);
    if (required <= 0 || !["picking", "packing_check", "handover"].includes(item.status)) return false;
    return scannedQty(item.scanProgress?.pickedQtyBySku) < required || scannedQty(item.scanProgress?.sortedQtyBySku) < required || scannedQty(item.scanProgress?.packedQtyBySku) < required;
  });

  const logisticsWithRisk = outbounds.filter((item) => (item.exceptions ?? []).some((exception) => exception.status === "open" || exception.status === "investigating") || (item.trackingEvents ?? [])[0]?.status === "exception");
  const feeDiffRows = outbounds.filter((item) => typeof item.shippingFee === "number" && typeof item.actualShippingFee === "number" && Math.abs(item.actualShippingFee - item.shippingFee) >= 1);
  const billingOverdue = billingRecords.filter((item) => item.dueDate && new Date(item.dueDate).getTime() < nowMs && !["paid"].includes(item.status));
  const openWorkOrders = workOrders.filter((item) => !["resolved", "cancelled"].includes(item.status));
  const waitingCustomerOrders = openWorkOrders.filter((item) => item.status === "waiting_customer");
  const customerRepliedOrders = openWorkOrders.filter((item) => latestVisibleMessage(item)?.authorRole === "customer");
  const workOrderOverdue = openWorkOrders.filter((item) => (item.status === "open" && hoursSince(item.updatedAt, nowMs) > 24) || (item.status === "processing" && hoursSince(item.updatedAt, nowMs) > 48));
  const financeReviewOrders = openWorkOrders.filter((item) => item.financeReviewRequired);
  const financeReviewRiskOrders = financeReviewOrders.filter((item) => latestVisibleMessage(item)?.authorRole === "customer" || (item.status === "open" && hoursSince(item.updatedAt, nowMs) > 24) || (item.status === "processing" && hoursSince(item.updatedAt, nowMs) > 48));
  const workOrderRiskIds = new Set([...customerRepliedOrders, ...workOrderOverdue].map((item) => item.id));
  const totalExceptionCount = inboundOverdue.length + outboundOverdue.length + outboundReviewRisks.length + logisticsWithRisk.length + feeDiffRows.length + billingOverdue.length + workOrderRiskIds.size;

  const queue = [
    ...customerRepliedOrders.slice(0, 3).map((item) => ({ key: item.id, type: "客户已回复", title: item.id, detail: `${item.customerCode} / ${item.category} / ${item.title}` })),
    ...financeReviewRiskOrders.slice(0, 3).map((item) => ({ key: item.id, type: "财务复核", title: item.id, detail: `${item.customerCode} / ${item.category} / ${Math.round(hoursSince(item.updatedAt, nowMs))} 小时未完成费用复核` })),
    ...workOrderOverdue.slice(0, 3).map((item) => ({ key: item.id, type: "工单超时", title: item.id, detail: `${item.customerCode} / ${item.category} / ${Math.round(hoursSince(item.updatedAt, nowMs))} 小时未推进` })),
    ...inboundOverdue.slice(0, 3).map((item) => ({ key: item.id, type: "入库超时", title: item.id, detail: `${item.customer || item.customerCode || "客户"} / ${Math.round(hoursSince(item.createdAt, nowMs))} 小时未完成上架` })),
    ...outboundOverdue.slice(0, 3).map((item) => ({ key: item.id, type: "出库超时", title: item.id, detail: `${item.customerCode} / ${Math.round(hoursSince(item.createdAt, nowMs))} 小时未发货` })),
    ...outboundReviewRisks.slice(0, 3).map((item) => ({ key: item.id, type: item.interceptStatus === "requested" || item.interceptStatus === "restock_pending" ? "截单待审" : item.status === "handover" && !item.packageWeightKg ? "待称重" : "复核缺口", title: item.id, detail: `${item.customerCode} / ${item.channel} / ${item.interceptReason || "请查看出库复核差异报表"}` })),
    ...logisticsWithRisk.slice(0, 3).map((item) => ({ key: item.id, type: "物流异常", title: item.id, detail: `${item.customerCode} / ${item.trackingNumber || "未生成追踪号"}` })),
    ...feeDiffRows.slice(0, 3).map((item) => ({ key: item.id, type: "费用差异", title: item.id, detail: `${item.customerCode} / 预估 £${item.shippingFee?.toFixed(2)} / 实际 £${item.actualShippingFee?.toFixed(2)}` })),
  ].slice(0, 8);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Activity size={18} className="text-cyan-700" />
            SLA 与异常报表
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">按马帮工作台口径集中看入库、出库、物流、费用和账单风险，先处理超时和异常。</p>
        </div>
        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${totalExceptionCount > 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {totalExceptionCount > 0 ? `${totalExceptionCount} 个风险` : "当前无风险"}
        </span>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/exceptions">
            导出异常中心
          </Link>
          <Link className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/sla">
            导出 SLA 报表
          </Link>
          <Link className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/reports/outbound-review">
            导出出库复核
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-10">
        {metric("入库 SLA", rate(inboundOnTime, openInbounds.length), inboundOverdue.length > 0 ? "amber" : "emerald")}
        {metric("出库 SLA", rate(outboundOnTime, openOutbounds.length), outboundOverdue.length > 0 ? "amber" : "emerald")}
        {metric("出库复核", outboundReviewRisks.length, outboundReviewRisks.length > 0 ? "amber" : "emerald")}
        {metric("物流异常", logisticsWithRisk.length, logisticsWithRisk.length > 0 ? "rose" : "emerald")}
        {metric("费用差异", feeDiffRows.length, feeDiffRows.length > 0 ? "amber" : "emerald")}
        {metric("逾期账单", billingOverdue.length, billingOverdue.length > 0 ? "rose" : "emerald")}
        {metric("财务复核", financeReviewRiskOrders.length, financeReviewRiskOrders.length > 0 ? "amber" : "emerald")}
        {metric("客户待回复", waitingCustomerOrders.length, waitingCustomerOrders.length > 0 ? "amber" : "emerald")}
        {metric("工单超时", workOrderOverdue.length, workOrderOverdue.length > 0 ? "rose" : "emerald")}
        {metric("异常总数", totalExceptionCount, totalExceptionCount > 0 ? "rose" : "emerald")}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Clock size={16} className="text-cyan-700" />
            SLA 口径
          </h3>
          <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-600">
            <p>入库：提交后 48 小时内应完成上架或关闭。</p>
            <p>出库：创建后 24 小时内应完成发货。</p>
            <p>物流：追踪异常、派送失败、改派或赔付进入异常率。</p>
            <p>费用：实际运费与预估运费差异达到 £1 进入差异队列。</p>
            <p>财务复核：账单争议、运费差异复核待处理 24 小时或处理中 48 小时未推进视为风险。</p>
            <p>工单：客户回复立即进入优先队列；运营待处理 24 小时、处理中 48 小时未推进视为超时。</p>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={16} className="text-amber-700" />
            优先处理队列
          </h3>
          <div className="mt-2 grid gap-2">
            {queue.length > 0 ? (
              queue.map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs" key={`${item.type}-${item.key}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">{item.type}</span>
                    <span className="font-mono font-semibold text-slate-900">{item.title}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{item.detail}</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">暂无超时或异常队列。</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Truck size={13} /> 出库、物流、费用差异来自正式出库单。</span>
        <span className="inline-flex items-center gap-1"><PoundSterling size={13} /> 账单逾期按到期日和付款状态计算。</span>
      </div>
    </section>
  );
}
