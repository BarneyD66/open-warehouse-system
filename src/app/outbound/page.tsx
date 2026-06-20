import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, ClipboardCheck, Download, FileCheck2, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import {
  evaluateCustomerCreditRisk,
  getWarehouseCoreDataForCustomer,
  outboundClaimStatusLabel,
  outboundDeliveryExceptionTypeLabel,
  type CustomerCreditRisk,
  type CoreOutboundOrder,
  type OutboundExceptionRecord,
} from "@/lib/warehouseCoreStore";
import { CustomerOutboundBulkTools, CustomerOutboundForm } from "../components/CustomerOperationForms";
import { PageShell } from "../components/MarketingShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const statusTone: Record<CoreOutboundOrder["status"], string> = {
  pending_review: "border-cyan-200 bg-cyan-50 text-cyan-800",
  picking: "border-amber-200 bg-amber-50 text-amber-800",
  label_pending: "border-rose-200 bg-rose-50 text-rose-800",
  packing_check: "border-violet-200 bg-violet-50 text-violet-800",
  handover: "border-violet-200 bg-violet-50 text-violet-800",
  shipped: "border-emerald-200 bg-emerald-50 text-emerald-800",
  blocked: "border-rose-200 bg-rose-50 text-rose-800",
};

const exceptionStatusLabel: Record<OutboundExceptionRecord["status"], string> = {
  open: "待处理",
  investigating: "处理中",
  resolved: "已处理",
  ignored: "已忽略",
};

function statusLabel(status: CoreOutboundOrder["status"]) {
  const labels: Record<CoreOutboundOrder["status"], string> = {
    pending_review: "待运营审核",
    picking: "拣货中",
    label_pending: "待生成面单",
    packing_check: "包装复核",
    handover: "待交运",
    shipped: "已发货",
    blocked: "异常阻塞",
  };
  return labels[status];
}

function latestException(order: CoreOutboundOrder) {
  return (order.exceptions ?? []).find((item) => item.status === "open" || item.status === "investigating") ?? order.exceptions?.[0];
}

function ExceptionCard({ exception, orderId }: { exception: OutboundExceptionRecord; orderId: string }) {
  const typeLabel = exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : outboundDeliveryExceptionTypeLabel.manual;
  const workOrderHref = `/portal?workOrderCategory=${encodeURIComponent("物流异常")}&workOrderRef=${encodeURIComponent(orderId)}&workOrderTitle=${encodeURIComponent(`${typeLabel}需要处理`)}&workOrderDescription=${encodeURIComponent(`${exception.message}${exception.redeliveryRequired ? `；改派要求：${exception.redeliveryNote || "请补充改派信息"}` : ""}`)}#work-orders`;
  return (
    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle size={15} />
        <span className="font-semibold">{typeLabel}</span>
        <span className="rounded-md border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-700">{exceptionStatusLabel[exception.status]}</span>
      </div>
      <p className="mt-2">{exception.message}</p>
      {exception.redeliveryRequired ? <p className="mt-1 font-semibold">改派要求：{exception.redeliveryNote || "运营正在确认改派信息"}</p> : null}
      {exception.claimAmount ? (
        <p className="mt-1 font-semibold">
          赔付进度：£{exception.claimAmount.toFixed(2)} / {outboundClaimStatusLabel[exception.claimStatus ?? "draft"]}
        </p>
      ) : null}
      {exception.proofUrl ? (
        <a className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-700 underline-offset-4 hover:underline" href={`/api/outbounds/${encodeURIComponent(orderId)}/proof`} rel="noreferrer" target="_blank">
          <FileCheck2 size={14} />
          查看签收证明
        </a>
      ) : null}
      {exception.status !== "resolved" && exception.status !== "ignored" ? (
        <Link className="mt-2 inline-flex min-h-8 items-center rounded-md bg-rose-900 px-3 text-xs font-semibold text-white hover:bg-rose-800" href={workOrderHref}>
          补充处理信息
        </Link>
      ) : null}
    </div>
  );
}

function hasDownloadableProof(order: CoreOutboundOrder) {
  return Boolean(order.exceptions?.some((exception) => exception.proofUrl) || order.trackingEvents?.some((event) => event.status === "delivered"));
}

function OrderDownloadActions({ order }: { order: CoreOutboundOrder }) {
  const encodedId = encodeURIComponent(order.id);
  const labelReady = order.labelStatus === "generated";
  const proofReady = hasDownloadableProof(order);
  const baseButton = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition";
  const enabledButton = `${baseButton} border-cyan-100 bg-cyan-50 text-cyan-800 hover:border-cyan-200 hover:bg-cyan-100`;
  const mutedButton = `${baseButton} border-slate-200 bg-slate-50 text-slate-400`;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a className={enabledButton} href={`/api/downloads?kind=outbound&orderId=${encodedId}`}>
        <Download size={14} />
        出库明细
      </a>
      <a className={enabledButton} href={`/api/downloads?kind=outbound-review&orderId=${encodedId}`}>
        <ClipboardCheck size={14} />
        复核状态
      </a>
      {labelReady ? (
        <a className={enabledButton} href={`/api/outbounds/${encodedId}/label`} rel="noreferrer" target="_blank">
          <FileCheck2 size={14} />
          面单
        </a>
      ) : (
        <span className={mutedButton}>面单待生成</span>
      )}
      {proofReady ? (
        <a className={enabledButton} href={`/api/outbounds/${encodedId}/proof`} rel="noreferrer" target="_blank">
          <FileCheck2 size={14} />
          签收证明
        </a>
      ) : (
        <span className={mutedButton}>签收证明待回传</span>
      )}
    </div>
  );
}

function CreditRiskNotice({ risk }: { risk: CustomerCreditRisk }) {
  const blocked = risk.status === "blocked";
  const warning = risk.status === "warning";
  const tone = blocked
    ? "border-rose-200 bg-rose-50 text-rose-950"
    : warning
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-emerald-200 bg-emerald-50 text-emerald-950";
  const badgeTone = blocked
    ? "border-rose-200 bg-white text-rose-700"
    : warning
      ? "border-amber-200 bg-white text-amber-700"
      : "border-emerald-200 bg-white text-emerald-700";
  const title = blocked ? "账期/信用风险已拦截出库创建" : warning ? "账期状态需要关注" : "账期状态正常";
  const description = blocked
    ? "当前账号暂不能提交新的出库申请，请先处理逾期账单、额度超限或账号暂停问题。"
    : warning
      ? "仍可提交出库申请，但建议尽快确认未结费用和信用额度。"
      : "当前未发现逾期、额度超限或账号暂停问题，可以正常创建出库申请。";

  return (
    <section className={`rounded-lg border p-4 shadow-sm ${tone}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {blocked ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <p className="mt-2 text-sm leading-6">{description}</p>
          {risk.reasons.length > 0 ? (
            <div className="mt-3 space-y-1 text-sm font-semibold">
              {risk.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid min-w-56 gap-2 text-xs">
          <span className={`inline-flex items-center justify-between gap-3 rounded-md border px-2 py-1 font-semibold ${badgeTone}`}>
            <span>未结费用</span>
            <span>£{risk.outstandingAmount.toFixed(2)}</span>
          </span>
          <span className={`inline-flex items-center justify-between gap-3 rounded-md border px-2 py-1 font-semibold ${badgeTone}`}>
            <span>逾期金额</span>
            <span>£{risk.overdueAmount.toFixed(2)}</span>
          </span>
          {typeof risk.creditLimit === "number" ? (
            <span className={`inline-flex items-center justify-between gap-3 rounded-md border px-2 py-1 font-semibold ${badgeTone}`}>
              <span>额度剩余</span>
              <span>£{(risk.creditRemaining ?? risk.creditLimit).toFixed(2)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default async function OutboundPage() {
  const session = await requireCustomerSession();
  const coreData = await getWarehouseCoreDataForCustomer(session.customerCode);
  const orders = [...coreData.outboundOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const creditRisk = evaluateCustomerCreditRisk(coreData, session.customerCode);
  const creditDisabledReason = creditRisk.status === "blocked" ? `当前账期/信用状态暂不能创建新的出库申请：${creditRisk.reasons.join("；")}` : undefined;

  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <aside className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">出库申请</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">创建出库与尾程履约需求</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">选择已维护的 SKU，填写数量、渠道和发货要求。提交后系统会预占库存，运营进行库存、包装、面单和物流复核。</p>
            </section>
            <section className="grid gap-3">
              {[
                { icon: ClipboardCheck, title: "先审后发", body: "运营会先审核库存、地址、渠道和费用，减少错发和漏发。" },
                { icon: PackageCheck, title: "库存预占", body: "提交后对相关 SKU 做预占，避免同一库存被重复出库。" },
                { icon: Truck, title: "尾程透明", body: "面单、交运、派送失败、改派和赔付进度都会同步展示。" },
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

          <div className="space-y-5">
            <CreditRiskNotice risk={creditRisk} />
            <CustomerOutboundBulkTools disabledReason={creditDisabledReason} />
            <CustomerOutboundForm disabledReason={creditDisabledReason} />
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Boxes size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">我的出库申请</h2>
                </div>
                <Link className="text-xs font-semibold text-cyan-700 hover:text-cyan-900" href="/api/downloads?kind=delivery-exceptions">
                  下载物流异常与赔付
                </Link>
              </div>
              <div className="divide-y divide-slate-200">
                {orders.length > 0 ? (
                  orders.map((order) => {
                    const exception = latestException(order);
                    return (
                      <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={order.id}>
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-500">{order.id}</p>
                          <h3 className="mt-1 text-sm font-semibold text-slate-950">{order.channel}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {order.orderCount} 单 / {order.skuLines?.map((line) => `${line.skuCode} x ${line.quantity}`).join("；") || "SKU 待确认"}
                          </p>
                          <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-500">
                            <p>承运服务：{order.carrierName ? `${order.carrierName} ${order.carrierServiceName ?? ""}` : "待运营确认"}</p>
                            <p>追踪号：{order.trackingNumber || "待生成"}</p>
                            {typeof order.shippingFee === "number" ? <p>预计运费：£{order.shippingFee.toFixed(2)}</p> : null}
                            {order.trackingEvents?.[0] ? <p>最新物流：{order.trackingEvents[0].label} / {order.trackingEvents[0].detail ?? ""}</p> : null}
                          </div>
                          <OrderDownloadActions order={order} />
                          {exception ? <ExceptionCard exception={exception} orderId={order.id} /> : null}
                          {order.deliveryAddress ? <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{order.deliveryAddress}</p> : null}
                        </div>
                        <span className={`inline-flex h-fit rounded-md border px-2 py-1 text-xs font-semibold ${statusTone[order.status]}`}>{statusLabel(order.status)}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">暂无出库申请</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
