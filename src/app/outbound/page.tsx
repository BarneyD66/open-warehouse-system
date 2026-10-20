import { CustomerOutboundEditor } from "../components/CustomerOutboundEditor";
import { splitOutboundLines } from "@/lib/customerOutboundInput";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, ClipboardCheck, Download, FileCheck2, PackageCheck, Truck } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import {
  getWarehouseCoreDataForCustomer,
  outboundDeliveryExceptionTypeLabel,
  type CoreOutboundOrder,
  type OutboundExceptionRecord,
} from "@/lib/warehouseCoreStore";
import { CustomerOutboundBulkTools, CustomerOutboundForm } from "../components/CustomerOperationForms";
import { CustomerWorkbenchShell } from "../components/CustomerWorkbenchShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const statusTone: Record<CoreOutboundOrder["status"], string> = {
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
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
    cancelled: "已撤回",
    pending_review: "待校验",
    picking: "拣货中",
    label_pending: "待生成面单",
    packing_check: "包装复核",
    handover: "待交运",
    shipped: "已交运",
    blocked: "异常阻塞",
  };
  return labels[status];
}

function OrderProgress({ order }: { order: CoreOutboundOrder }) {
  if (order.status === "cancelled") return <p className="mt-3 text-sm text-slate-600">申请已撤回，已释放该单预占库存。</p>;
  const delivered = order.trackingEvents?.some((event) => event.status === "delivered") ?? false;
  const current = delivered ? 4 : order.status === "shipped" ? 3 : order.status === "handover" ? 3 : order.status === "packing_check" || order.status === "label_pending" ? 2 : order.status === "picking" ? 1 : 0;
  const steps = ["待校验", "待拣货", "待打包", "已交运", "已签收"];
  return (
    <div className="mt-3 grid grid-cols-5 gap-1" aria-label="出库进度">
      {steps.map((step, index) => (
        <div className="min-w-0" key={step}>
          <div className={`h-1.5 rounded-full ${index <= current ? "bg-cyan-700" : "bg-slate-200"}`} />
          <p className={`mt-1 truncate text-[13px] font-semibold sm:text-xs ${index <= current ? "text-cyan-800" : "text-slate-400"}`}>{step}</p>
        </div>
      ))}
    </div>
  );
}

function latestException(order: CoreOutboundOrder) {
  return (order.exceptions ?? []).find((item) => item.status === "open" || item.status === "investigating") ?? order.exceptions?.[0];
}

function ExceptionCard({ exception, orderId }: { exception: OutboundExceptionRecord; orderId: string }) {
  const typeLabel = exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : outboundDeliveryExceptionTypeLabel.manual;
  const workOrderHref = "/workspace";
  return (
    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle size={15} />
        <span className="font-semibold">{typeLabel}</span>
        <span className="rounded-md border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-700">{exceptionStatusLabel[exception.status]}</span>
      </div>
      <p className="mt-2">{exception.message}</p>
      {exception.redeliveryRequired ? <p className="mt-1 font-semibold">改派要求：{exception.redeliveryNote || "运营正在确认改派信息"}</p> : null}
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

export default async function OutboundPage() {
  const session = await requireCustomerSession();
  const coreData = await getWarehouseCoreDataForCustomer(session.customerCode);
  const orders = [...coreData.outboundOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <CustomerWorkbenchShell active="outbound" customerCode={session.customerCode} customerCompany={coreData.customer?.companyName} eyebrow="创建出库并跟进发货" title="出库发货">
      <div className="bg-slate-100 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <aside className="order-last space-y-5 lg:order-first">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">出库申请</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">创建出库与尾程发货需求</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">选择已维护的 SKU，填写数量、渠道和发货要求。提交后系统会预占库存，运营进行库存、包装、面单和物流复核。</p>
            </section>
            <section className="grid gap-3">
              {[
                { icon: ClipboardCheck, title: "先审后发", body: "运营会先审核库存、地址、渠道和包装要求，减少错发和漏发。" },
                { icon: PackageCheck, title: "库存预占", body: "提交后对相关 SKU 做预占，避免同一库存被重复出库。" },
                { icon: Truck, title: "尾程透明", body: "面单、交运、派送失败、改派和异常处理结果都会同步展示。" },
              ].map(({ icon: Icon, title, body }) => (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={title}>
                  <Icon className="text-[#0E7490]" size={20} />
                  <h2 className="mt-3 text-sm font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </section>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/workspace">
              返回客户工作台 <ArrowRight size={16} />
            </Link>
          </aside>

          <div className="space-y-5">
            <CustomerOutboundForm />
            <CustomerOutboundBulkTools />
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Boxes size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">我的出库申请</h2>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {orders.length > 0 ? (
                  orders.map((order) => {
                    const exception = latestException(order);
                    const { products, packaging } = splitOutboundLines(order.skuLines);
                    return (
                      <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={order.id}>
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-500">{order.id}</p>
                          <h3 className="mt-1 text-sm font-semibold text-slate-950">{order.channel}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {order.orderCount} 单 / 商品：{products.map((line) => `${line.skuCode} x ${line.quantity}`).join("；") || "缺少商品明细，请核对后编辑"}
                            <br />包材：{packaging.map((line) => `${line.skuCode} x ${line.quantity}`).join("；") || "无"}
                          </p>
                          <OrderProgress order={order} />
                          <CustomerOutboundEditor key={order.updatedAt ?? order.createdAt} order={order} />
                          <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-500">
                            <p>承运服务：{order.carrierName ? `${order.carrierName} ${order.carrierServiceName ?? ""}` : "待运营确认"}</p>
                            <p>追踪号：{order.trackingNumber || "待生成"}</p>
                            {order.trackingEvents?.[0] ? <p>最新物流：{order.trackingEvents[0].label} / {order.trackingEvents[0].detail ?? ""}</p> : null}
                          </div>
                          <OrderDownloadActions order={order} />
                          {exception ? <ExceptionCard exception={exception} orderId={order.id} /> : null}
                          {order.deliveryAddress ? <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{order.deliveryAddress}</p> : null}
                        </div>
                        <span className={`inline-flex h-fit rounded-md border px-2 py-1 text-xs font-semibold ${statusTone[order.status]}`}>{order.trackingEvents?.some((event) => event.status === "delivered") ? "已签收" : statusLabel(order.status)}</span>
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
    </CustomerWorkbenchShell>
  );
}
