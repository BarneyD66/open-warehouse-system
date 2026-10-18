import { AlertTriangle, CalendarDays, ChevronDown, ClipboardList, FileText, PackageCheck, Truck } from "lucide-react";
import { buildInboundDocumentChecklist, canCustomerEditInbound, inboundStatusLabel, type InboundStatus, type InboundSubmission } from "@/lib/localStore";
import { CustomerInboundEditor } from "./CustomerInboundEditor";
import { CustomerInboundExceptionDecision } from "./CustomerInboundExceptionDecision";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneClass: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
};

function statusTone(status: InboundStatus): Tone {
  if (["putaway_completed", "received", "closed"].includes(status)) return "emerald";
  if (["exception", "cancelled"].includes(status)) return "rose";
  if (["on_hold", "pending_review", "submitted"].includes(status)) return "amber";
  if (["arrived", "receiving"].includes(status)) return "violet";
  return "cyan";
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>{children}</span>;
}

function show(value?: string) {
  return value?.trim() || "未填写";
}

function formatDate(value?: string, includeTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-medium leading-6 text-slate-900">{value}</div>
    </div>
  );
}

const exceptionTypeLabels = {
  short_received: "少货",
  over_received: "多货",
  damaged: "破损",
  sku_mismatch: "错 SKU",
  label_issue: "标签异常",
  missing_document: "资料缺失",
  manual: "其他异常",
} as const;

export function CustomerInboundHistory({ items }: { items: InboundSubmission[] }) {
  return (
    <section className="scroll-mt-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5" id="history">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="text-cyan-700" size={19} />
            <h2 className="text-lg font-semibold text-slate-950">我的入库预报</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">查看此前提交的到仓信息、商品明细、资料状态和仓库处理进度。</p>
        </div>
        <Pill tone={items.length ? "cyan" : "slate"}>共 {items.length} 条</Pill>
      </div>

      {items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((item, index) => {
            const checklist = buildInboundDocumentChecklist(item);
            const events = [...(item.events ?? [])].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
            return (
              <details className="group overflow-hidden rounded-lg border border-slate-200 bg-white" key={item.id} open={index === 0}>
                <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                      <Pill tone={statusTone(item.status)}>{inboundStatusLabel(item.status)}</Pill>
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold text-slate-950">{show(item.productName)}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">提交于 {formatDate(item.createdAt, true)} · 预计 {formatDate(item.eta)} 到仓 · {item.cartons} 箱 · {item.skuCount} 种 SKU · {item.totalProductQty ?? 0} 件商品</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-800">
                    查看完整资料
                    <ChevronDown className="transition group-open:rotate-180" size={15} />
                  </span>
                </summary>

                <div className="border-t border-slate-200 bg-slate-50/60 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Detail label="客户 / 店铺名称" value={show(item.customer)} />
                    <Detail label="联系人" value={show(item.contact)} />
                    <Detail label="手机 / 微信" value={show(item.phone)} />
                    <Detail label="平台" value={show(item.platform)} />
                    <Detail label="预计到仓日期" value={formatDate(item.eta)} />
                    <Detail label="运输方式" value={show(item.transport)} />
                    <Detail label="承运商 / 追踪号" value={show(item.tracking)} />
                    <Detail label="SKU 种类" value={`${item.skuCount} 种`} />
                    <Detail label="商品总数量" value={`${item.totalProductQty ?? 0} 件`} />
                    <Detail label="箱数 / 托数" value={`${item.cartons}`} />
                    <Detail label="主要品名" value={show(item.productName)} />
                    <Detail label="服务需求" value={show(item.service)} />
                    <Detail label="货物属性" value={show(item.attribute)} />
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-950"><PackageCheck className="text-cyan-700" size={16} />SKU 明细</p>
                      <Pill>{item.skuLines?.length ?? 0} 行</Pill>
                    </div>
                    {item.skuLines?.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] text-left text-sm">
                          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">SKU 编码</th><th className="px-3 py-2">商品名称</th><th className="px-3 py-2">预报</th><th className="px-3 py-2">实收</th><th className="px-3 py-2">已上架</th><th className="px-3 py-2">库位</th><th className="px-3 py-2">箱数 / 托数</th></tr></thead>
                          <tbody className="divide-y divide-slate-200">
                            {item.skuLines.map((line, lineIndex) => <tr key={`${line.skuCode}-${lineIndex}`}><td className="px-3 py-2 font-mono text-xs font-semibold">{line.skuCode}</td><td className="px-3 py-2">{show(line.productName)}</td><td className="px-3 py-2">{line.expectedQty ?? "-"}</td><td className="px-3 py-2">{line.receivedQty ?? "待验收"}</td><td className="px-3 py-2">{line.putawayQty ?? 0}</td><td className="px-3 py-2 font-mono text-xs">{line.locationCode || "待上架"}</td><td className="px-3 py-2">{line.cartonCount ?? "-"}</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="px-3 py-5 text-sm text-slate-500">本次提交未填写逐行 SKU 明细。</p>}
                  </div>

                  {item.receivingExceptions?.length ? (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-white">
                      <div className="flex items-center justify-between gap-3 border-b border-rose-100 px-3 py-2.5">
                        <p className="flex items-center gap-2 text-sm font-semibold text-rose-900"><AlertTriangle size={16} />入库异常与处理</p>
                        <Pill tone="rose">{item.receivingExceptions.length} 条</Pill>
                      </div>
                      <div className="grid gap-3 p-3 lg:grid-cols-2">
                        {item.receivingExceptions.map((exception) => {
                          const difference = typeof exception.expectedQty === "number" && typeof exception.actualQty === "number" ? exception.actualQty - exception.expectedQty : undefined;
                          return (
                            <article className="rounded-md border border-rose-100 bg-rose-50/60 p-3" key={exception.id}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-rose-950">{exceptionTypeLabels[exception.type]}</p>
                                <Pill tone={exception.status === "resolved" || exception.status === "ignored" ? "emerald" : "rose"}>{exception.status === "open" ? "待处理" : exception.status === "investigating" ? "处理中" : exception.status === "resolved" ? "已处理" : "已关闭"}</Pill>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{exception.message}</p>
                              <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-600 sm:grid-cols-2">
                                <p>SKU：{exception.skuCode || "整票货件"}</p>
                                <p>箱号：{exception.cartonNo || "未填写"}</p>
                                <p>预报：{exception.expectedQty ?? "-"}</p>
                                <p>实收：{exception.actualQty ?? "-"}{typeof difference === "number" ? `（差异 ${difference > 0 ? "+" : ""}${difference}）` : ""}</p>
                              </div>
                              {exception.proposedAction ? <p className="mt-2 rounded-md bg-white p-2 text-xs leading-5 text-slate-700"><span className="font-semibold">仓库建议：</span>{exception.proposedAction}</p> : null}
                              {exception.photoUrls?.length ? <div className="mt-2 flex flex-wrap gap-2">{exception.photoUrls.map((url, index) => <a className="text-xs font-semibold text-cyan-800 underline underline-offset-2" href={url} key={`${exception.id}-photo-${index}`} rel="noreferrer" target="_blank">查看异常照片 {index + 1}</a>)}</div> : null}
                              <CustomerInboundExceptionDecision exception={exception} inboundId={item.id} />
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-950"><FileText className="text-cyan-700" size={16} />提交资料</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.attachmentNames.length ? item.attachmentNames.map((name) => <Pill key={name} tone="cyan">{name}</Pill>) : <span className="text-sm text-slate-500">本次未勾选已有资料</span>}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">必需资料已具备 {checklist.requiredReady}/{checklist.requiredTotal}{checklist.missingRequired.length ? `，待补：${checklist.missingRequired.join("、")}` : "，资料已齐"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Truck className="text-cyan-700" size={16} />仓库进度</p>
                      {events.length ? <div className="mt-3 space-y-3">{events.map((event) => <div className="border-l-2 border-cyan-200 pl-3" key={event.id}><p className="text-xs font-semibold text-slate-500">{formatDate(event.occurredAt, true)}</p><p className="mt-1 text-sm leading-6 text-slate-700">{event.messageCustomer}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-500">等待仓库更新。</p>}
                    </div>
                  </div>

                  {item.supplementNote ? <div className="mt-4 rounded-md border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-500">补交说明</p><p className="mt-1 text-sm leading-6 text-slate-700">{item.supplementNote}</p></div> : null}
                  <div className="mt-4">
                    <CustomerInboundEditor editable={canCustomerEditInbound(item.status)} item={item} />
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <CalendarDays className="mx-auto text-slate-400" size={24} />
          <p className="mt-3 text-sm font-semibold text-slate-950">暂无入库预报记录</p>
          <p className="mt-1 text-sm text-slate-500">完成上方表单提交后，记录会立即显示在这里。</p>
        </div>
      )}
    </section>
  );
}
