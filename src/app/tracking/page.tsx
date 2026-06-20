import Link from "next/link";
import { ArrowRight, Clock3, Download, FileCheck2, FileText, PackageCheck, Truck, Warehouse } from "lucide-react";
import { requireCustomerSession } from "@/lib/customerAuth";
import { buildInboundDocumentChecklist, getSubmissionsForCustomer, type InboundSubmission, type InquirySubmission, type Submission } from "@/lib/localStore";
import { getOpsWorkbenchData, labelForOpsStatus } from "@/lib/opsStore";
import { getWarehouseCoreDataForCustomer, outboundClaimStatusLabel, outboundDeliveryExceptionTypeLabel, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";
import { PageShell } from "../components/MarketingShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneClass: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
};

function isInbound(item: Submission): item is InboundSubmission {
  return item.type === "inbound";
}

function isInquiry(item: Submission): item is InquirySubmission {
  return item.type === "inquiry";
}

function pill(label: string, tone: Tone = "slate") {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>{label}</span>;
}

function displayText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  if (!text || text.includes("?") || text.includes("閿?")) return fallback;
  return text;
}

function dateLabel(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function inquiryStatus(item: InquirySubmission) {
  const labels: Record<InquirySubmission["status"], { label: string; tone: Tone }> = {
    new: { label: "待方案评估", tone: "cyan" },
    contacted: { label: "客服已联系", tone: "cyan" },
    quoted: { label: "报价待确认", tone: "amber" },
    waiting_customer: { label: "待您确认", tone: "amber" },
    quote_accepted: { label: "已确认报价", tone: "emerald" },
    quote_question: { label: "报价疑问处理中", tone: "amber" },
    converted_to_inbound: { label: "已转入库", tone: "violet" },
    closed: { label: "已关闭", tone: "slate" },
  };
  return labels[item.status] ?? labels.new;
}

function inboundStatus(item: InboundSubmission) {
  const checklist = buildInboundDocumentChecklist(item);
  if (item.status === "exception") return { label: "异常处理中", tone: "rose" as Tone };
  if (item.status === "on_hold") return { label: "暂缓处理", tone: "amber" as Tone };
  if (checklist.missingRequired.length > 0) return { label: "待补资料", tone: "amber" as Tone };
  if (!item.tracking) return { label: "待补追踪号", tone: "rose" as Tone };
  if (item.status === "putaway_completed") return { label: "已上架", tone: "emerald" as Tone };
  if (["arrived", "receiving", "received"].includes(item.status)) return { label: "仓库处理中", tone: "violet" as Tone };
  return { label: "处理中", tone: "cyan" as Tone };
}

function opsTone(status: string): Tone {
  if (status === "resolved" || status === "shipped" || status === "normal") return "emerald";
  if (status === "open" || status === "blocked" || status === "label_pending" || status === "low_stock" || status === "sync_issue") return "rose";
  if (status === "waiting_customer" || status === "aging") return "amber";
  if (status === "packing_check" || status === "handover") return "violet";
  return "cyan";
}

function coreOutboundProofReady(order: CoreOutboundOrder) {
  return Boolean(order.exceptions?.some((exception) => exception.proofUrl) || order.trackingEvents?.some((event) => event.status === "delivered"));
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{text}</div>;
}

function CoreOutboundDownloadActions({ order }: { order: CoreOutboundOrder }) {
  const encodedId = encodeURIComponent(order.id);
  const button = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition";
  const enabled = `${button} border-cyan-100 bg-cyan-50 text-cyan-800 hover:border-cyan-200 hover:bg-cyan-100`;
  const disabled = `${button} border-slate-200 bg-slate-50 text-slate-400`;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a className={enabled} href={`/api/downloads?kind=outbound&orderId=${encodedId}`}>
        <Download size={14} />
        出库明细
      </a>
      {order.labelStatus === "generated" ? (
        <a className={enabled} href={`/api/outbounds/${encodedId}/label`} rel="noreferrer" target="_blank">
          <FileCheck2 size={14} />
          面单
        </a>
      ) : (
        <span className={disabled}>面单待生成</span>
      )}
      {coreOutboundProofReady(order) ? (
        <a className={enabled} href={`/api/outbounds/${encodedId}/proof`} rel="noreferrer" target="_blank">
          <FileCheck2 size={14} />
          签收证明
        </a>
      ) : (
        <span className={disabled}>签收证明待回传</span>
      )}
    </div>
  );
}

export default async function TrackingPage() {
  const session = await requireCustomerSession();
  const [submissions, opsData, coreData] = await Promise.all([getSubmissionsForCustomer(session.customerCode), getOpsWorkbenchData(), getWarehouseCoreDataForCustomer(session.customerCode)]);
  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);
  const logistics = opsData.logistics.filter((item) => item.customerCode === session.customerCode);
  const outbound = opsData.outbound.filter((item) => item.customerCode === session.customerCode);
  const inventory = opsData.inventory.filter((item) => item.customerCode === session.customerCode);
  const coreOutbound = [...coreData.outboundOrders].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());

  return (
    <PageShell surface="customer">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  {pill(`客户编号 ${session.customerCode}`, "cyan")}
                  {pill("进度总览", "slate")}
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">业务进度</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">查看报价、入库、出库、物流和库存状态。运营和仓库的面单、交运、追踪节点会同步到这里。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/portal">
                  返回工作台
                </Link>
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800" href="/supplement">
                  补交资料 <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                  <PackageCheck size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">入库进度</h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {inbounds.length > 0 ? (
                    inbounds.map((item) => {
                      const status = inboundStatus(item);
                      const checklist = buildInboundDocumentChecklist(item);
                      const latest = item.events?.slice().sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
                      return (
                        <div className="px-4 py-4" key={item.id}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                              <h3 className="mt-1 text-sm font-semibold text-slate-950">{displayText(item.productName, "货品待确认")}</h3>
                            </div>
                            {pill(status.label, status.tone)}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            预计 {item.eta || "-"} 到仓 / {item.cartons} 箱 / {item.skuCount} SKU / 资料 {checklist.requiredReady}/{checklist.requiredTotal}
                          </p>
                          {latest ? (
                            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                              <p className="flex items-center gap-2 font-semibold text-slate-950">
                                <Clock3 size={14} />
                                最新记录 {dateLabel(latest.occurredAt)}
                              </p>
                              <p className="mt-1">{latest.messageCustomer}</p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <Empty text="暂无入库进度" />
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                  <Truck size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">出库与物流</h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {coreOutbound.map((item) => {
                    const latest = item.trackingEvents?.[0];
                    const exception = (item.exceptions ?? []).find((entry) => entry.status === "open" || entry.status === "investigating") ?? item.exceptions?.[0];
                    return (
                      <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={item.id}>
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-500">{item.trackingNumber || item.id}</p>
                          <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.carrierName ? `${item.carrierName} ${item.carrierServiceName ?? ""}` : item.channel}</h3>
                          <p className="mt-2 text-sm text-slate-600">
                            {item.orderCount} 单 / {typeof item.shippingFee === "number" ? `£${item.shippingFee.toFixed(2)} / ` : ""}
                            {latest ? `${latest.label} ${latest.detail ?? ""}` : "等待面单和追踪回传"}
                          </p>
                          {exception ? (
                            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
                              <p className="font-semibold">{exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : "物流异常"}：{exception.message}</p>
                              {exception.workOrderId ? <p>客户工单：{exception.workOrderId}，可在工作台待办中继续沟通处理。</p> : null}
                              {exception.redeliveryRequired ? <p>改派要求：{exception.redeliveryNote || "待运营确认"}</p> : null}
                              {exception.proofUrl ? <p>签收证明：已关联，可下载或核对。</p> : null}
                              {exception.claimAmount ? <p>赔付进度：£{exception.claimAmount.toFixed(2)} / {outboundClaimStatusLabel[exception.claimStatus ?? "draft"]}</p> : null}
                            </div>
                          ) : null}
                          <CoreOutboundDownloadActions order={item} />
                        </div>
                        {pill(labelForOpsStatus("outbound", item.status), opsTone(item.status))}
                      </div>
                    );
                  })}
                  {outbound.map((item) => (
                    <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={item.id}>
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.channel}</h3>
                        <p className="mt-2 text-sm text-slate-600">{item.orderCount} 单 / 截止 {item.deadline}</p>
                      </div>
                      {pill(labelForOpsStatus("outbound", item.status), opsTone(item.status))}
                    </div>
                  ))}
                  {logistics.map((item) => (
                    <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={item.id}>
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-500">{item.trackingNo}</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.issue}</h3>
                        <p className="mt-2 text-sm text-slate-600">{item.channel} / 截止 {item.deadline}</p>
                      </div>
                      {pill(labelForOpsStatus("logistics", item.status), opsTone(item.status))}
                    </div>
                  ))}
                  {coreOutbound.length + outbound.length + logistics.length === 0 ? <Empty text="暂无出库或物流进度" /> : null}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                  <FileText size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">报价进度</h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {inquiries.length > 0 ? (
                    inquiries.map((item) => {
                      const status = inquiryStatus(item);
                      const latest = item.events?.slice().sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
                      return (
                        <div className="px-4 py-4" key={item.id}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                              <h3 className="mt-1 text-sm font-semibold text-slate-950">{displayText(item.service, "服务需求待确认")}</h3>
                            </div>
                            {pill(status.label, status.tone)}
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{displayText(item.company, "公司信息待补")} / {item.platform || "平台待补"}</p>
                          {latest ? <p className="mt-2 text-xs text-slate-500">最新记录：{latest.messageCustomer}</p> : null}
                        </div>
                      );
                    })
                  ) : (
                    <Empty text="暂无报价需求" />
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                  <Warehouse size={17} className="text-[#0E7490]" />
                  <h2 className="text-base font-semibold text-slate-950">库存观察</h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {inventory.length > 0 ? (
                    inventory.map((item) => (
                      <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto]" key={item.id}>
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-500">{item.sku}</p>
                          <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.product}</h3>
                          <p className="mt-2 text-sm text-slate-600">可用 {item.available} / 占用 {item.reserved} / 预警 {item.alert} / 库龄 {item.agingDays} 天</p>
                        </div>
                        {pill(labelForOpsStatus("inventory", item.status), opsTone(item.status))}
                      </div>
                    ))
                  ) : (
                    <Empty text="暂无库存记录" />
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
