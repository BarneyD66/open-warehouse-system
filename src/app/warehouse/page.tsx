import Link from "next/link";
import { Boxes, ClipboardCheck, PackageCheck, Truck, Warehouse, type LucideIcon } from "lucide-react";
import { buildInboundDocumentChecklist, getSubmissions, inboundStatusLabel, type InboundSubmission } from "@/lib/localStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { buildStocktakeCandidates, getWarehouseCoreData, outboundWorkModeLabel, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";
import { InboundExceptionActions } from "../components/InboundExceptionActions";
import { LogoutButton } from "../components/LogoutButton";
import { OpsStocktakePanel, type StocktakeCandidate } from "../components/OpsStocktakePanel";
import { PageShell } from "../components/MarketingShell";
import { WarehouseInventoryMovePanel } from "../components/WarehouseInventoryMovePanel";
import { OutboundExceptionActions } from "../components/OutboundExceptionActions";
import { WarehouseLocationManager } from "../components/WarehouseLocationManager";
import { WarehouseOutboundWorkflowActions } from "../components/WarehouseOutboundWorkflowActions";
import { WarehouseScanPanel } from "../components/WarehouseScanPanel";
import { WarehouseTaskAction } from "../components/WarehouseTaskAction";

export const dynamic = "force-dynamic";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneClasses: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
};

const inboundOptions = [
  { value: "arrived", label: "已到仓" },
  { value: "receiving", label: "收货验收中" },
  { value: "received", label: "已收货" },
  { value: "putaway_completed", label: "已上架" },
  { value: "on_hold", label: "暂缓处理" },
  { value: "exception", label: "异常处理中" },
];

const outboundOptions = [
  { value: "picking", label: "拣货中" },
  { value: "packing_check", label: "打包复核" },
  { value: "handover", label: "待交运" },
  { value: "shipped", label: "已发货" },
  { value: "blocked", label: "异常阻塞" },
];

function pill(label: string, tone: Tone = "slate") {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

function inboundTone(status: InboundSubmission["status"]): Tone {
  if (status === "putaway_completed" || status === "closed") return "emerald";
  if (status === "exception") return "rose";
  if (status === "on_hold") return "amber";
  if (status === "receiving" || status === "received") return "violet";
  return "cyan";
}

function outboundLabel(status: CoreOutboundOrder["status"]) {
  const labels: Record<CoreOutboundOrder["status"], string> = {
    pending_review: "待审核",
    picking: "拣货中",
    label_pending: "待面单",
    packing_check: "打包复核",
    handover: "待交运",
    shipped: "已发货",
    blocked: "异常阻塞",
  };
  return labels[status] ?? status;
}

function outboundTone(status: CoreOutboundOrder["status"]): Tone {
  if (status === "shipped") return "emerald";
  if (status === "blocked" || status === "label_pending") return "rose";
  if (status === "packing_check" || status === "handover") return "violet";
  return "cyan";
}

function requiredQty(order: CoreOutboundOrder) {
  return order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}

function scannedQty(progress?: Record<string, number>) {
  return Object.values(progress ?? {}).reduce((sum, value) => sum + value, 0);
}

function scanProgressLabel(order: CoreOutboundOrder) {
  const total = requiredQty(order);
  return {
    total,
    picked: scannedQty(order.scanProgress?.pickedQtyBySku),
    sorted: scannedQty(order.scanProgress?.sortedQtyBySku),
    packed: scannedQty(order.scanProgress?.packedQtyBySku),
  };
}

function exceptionTone(severity: "warning" | "critical"): Tone {
  return severity === "critical" ? "rose" : "amber";
}

function openInboundExceptions(item: InboundSubmission) {
  return (item.receivingExceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
}

function WarehouseMetric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: Tone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${toneClasses[tone]}`}>
          <Icon size={18} />
        </span>
        <span className="text-xs font-semibold text-slate-400">WAREHOUSE</span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function WorkTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="max-w-full overflow-x-auto [contain:paint]">{children}</div>
    </section>
  );
}

export default async function WarehousePage() {
  const [staff, submissions, coreData] = await Promise.all([requireStaffSession(), getSubmissions(), getWarehouseCoreData()]);
  const inboundTasks = submissions
    .filter((item): item is InboundSubmission => item.type === "inbound")
    .filter((item) => !["closed", "cancelled", "putaway_completed"].includes(item.status))
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
  const outboundTasks = coreData.outboundOrders
    .filter((item) => item.status !== "shipped")
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
  const inboundExceptions = inboundTasks.filter((item) => item.status === "exception" || item.status === "on_hold").length;
  const openInboundExceptionCount = inboundTasks.reduce((sum, item) => sum + openInboundExceptions(item).length, 0);
  const outboundBlocked = outboundTasks.filter((item) => item.status === "blocked" || item.status === "label_pending").length;
  const stocktakeCandidates = buildStocktakeCandidates(coreData) as StocktakeCandidate[];
  const scanRecords = [
    ...inboundTasks.map((item) => ({
      id: item.id,
      type: "inbound" as const,
      title: item.productName,
      detail: `${item.customerCode || "未绑定客户"} / ${item.tracking || "无追踪号"} / ${inboundStatusLabel(item.status)}`,
      tokens: [item.id, item.customerCode, item.tracking, item.productName, item.contact, ...(item.skuLines?.map((line) => line.skuCode) ?? [])].filter(Boolean) as string[],
    })),
    ...outboundTasks.map((item) => ({
      id: item.id,
      type: "outbound" as const,
      title: `${item.channel} / ${item.orderCount} 单`,
      detail: `${item.customerCode} / ${outboundLabel(item.status)} / ${item.recipientName || "收件人待补"}`,
      tokens: [item.id, item.pickWaveNo, item.pickListNo, item.basketNo, item.trackingNumber, item.customerCode, item.channel, item.recipientName, ...(item.skuLines?.map((line) => line.skuCode) ?? [])].filter(Boolean) as string[],
    })),
    ...coreData.inventoryBalances.map((item) => ({
      id: item.skuCode,
      type: "inventory" as const,
      title: `${item.skuCode} / 可用 ${item.availableQty}`,
      detail: `${item.customerCode} / ${item.warehouseCode} / ${item.locationCode || "未上架"}`,
      tokens: [item.skuCode, item.customerCode, item.warehouseCode, item.locationCode].filter(Boolean) as string[],
    })),
    ...coreData.locations.map((item) => ({
      id: item.locationCode,
      type: "location" as const,
      title: `${item.locationCode} / ${item.zone}`,
      detail: `${item.warehouseCode} / ${item.status}`,
      tokens: [item.locationCode, item.warehouseCode, item.zone, item.status].filter(Boolean),
    })),
  ];

  return (
    <PageShell surface="admin">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {pill("仓库作业台", "cyan")}
                  {pill(`${staff.displayName} / ${staff.role}`, "emerald")}
                  {pill("收货 · 上架 · 拣货 · 打包 · 交运", "slate")}
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">仓库任务工作台</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  面向仓库员工的实操入口，入库任务推进到已上架时会写入库存流水，出库任务推进到已发货时会释放预占并形成出库流水。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/ops">
                  <ClipboardCheck size={16} />
                  运营后台
                </Link>
                <LogoutButton className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800" nextPath="/ops-login" />
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <WarehouseMetric icon={PackageCheck} label="入库作业" tone="cyan" value={inboundTasks.length} />
            <WarehouseMetric icon={Boxes} label="出库作业" tone="violet" value={outboundTasks.length} />
            <WarehouseMetric icon={Warehouse} label="入库异常/暂缓" tone={inboundExceptions > 0 || openInboundExceptionCount > 0 ? "rose" : "emerald"} value={inboundExceptions + openInboundExceptionCount} />
            <WarehouseMetric icon={Truck} label="出库阻塞/面单" tone={outboundBlocked > 0 ? "amber" : "emerald"} value={outboundBlocked} />
          </section>

          <WarehouseScanPanel
            records={scanRecords}
            outboundTasks={outboundTasks.map((item) => ({
              id: item.id,
              label: `${item.channel} / ${item.orderCount} 单`,
              status: outboundLabel(item.status),
              workMode: outboundWorkModeLabel(item.workMode),
              pickWaveNo: item.pickWaveNo,
              pickListNo: item.pickListNo,
              basketNo: item.basketNo,
              requiredQty: requiredQty(item),
              pickedQty: scannedQty(item.scanProgress?.pickedQtyBySku),
              sortedQty: scannedQty(item.scanProgress?.sortedQtyBySku),
              packedQty: scannedQty(item.scanProgress?.packedQtyBySku),
              lastScans: item.scanProgress?.lastScans,
            }))}
          />

          <WorkTable title="入库收货与上架">
            <table className="w-full min-w-full table-fixed text-left text-sm lg:min-w-[980px]">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">ASN</th>
                  <th className="px-4 py-3">客户 / 到仓</th>
                  <th className="px-4 py-3">货品与资料</th>
                  <th className="px-4 py-3">SKU 明细</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">作业动作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inboundTasks.slice(0, 20).map((item) => {
                  const checklist = buildInboundDocumentChecklist(item);
                  const openExceptions = openInboundExceptions(item);
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-slate-950">{item.id}</p>
                        <p className="mt-1 text-xs text-slate-500">提交 {formatDate(item.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{item.customerCode || "未绑定客户"}</p>
                        <p className="mt-1 text-xs">ETA：{item.eta}</p>
                        <p className="mt-1 text-xs">追踪：{item.tracking || "待补充"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p className="font-semibold text-slate-800">{item.productName}</p>
                        <p className="mt-1 text-xs">{item.transport} / {item.cartons} 箱 / {item.skuCount} SKU</p>
                        <p className="mt-1 text-xs">资料 {checklist.requiredReady}/{checklist.requiredTotal}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.skuLines?.length ? (
                          item.skuLines.slice(0, 4).map((line) => (
                            <p className="font-mono text-xs" key={`${item.id}-${line.skuCode}`}>
                              {line.skuCode} x {line.expectedQty ?? "-"}
                            </p>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400">待补 SKU 明细</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid gap-2">
                          {pill(inboundStatusLabel(item.status), inboundTone(item.status))}
                          {openExceptions.length ? pill(`收货异常 ${openExceptions.length}`, openExceptions.some((exception) => exception.severity === "critical") ? "rose" : "amber") : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <WarehouseTaskAction id={item.id} locationEnabled note={item.opsNote} options={inboundOptions} status={item.status === "submitted" ? "arrived" : item.status} type="inbound" />
                        <InboundExceptionActions inboundId={item.id} mode="create" />
                      </td>
                    </tr>
                  );
                })}
                {inboundTasks.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                      暂无入库作业任务
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </WorkTable>

          <WorkTable title="入库收货差异处理">
            <div className="grid gap-3 p-4">
              {inboundTasks.flatMap((task) =>
                openInboundExceptions(task).map((exception) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={exception.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-500">{task.id} / {exception.id}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{exception.message}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {exception.operator} / {formatDate(exception.createdAt)} / SKU {exception.skuCode || "-"} / 预报 {exception.expectedQty ?? "-"} / 实收 {exception.actualQty ?? "-"}
                        </p>
                      </div>
                      {pill(exception.severity === "critical" ? "严重异常" : "提醒", exceptionTone(exception.severity))}
                    </div>
                    <InboundExceptionActions exception={exception} inboundId={task.id} mode="resolve" />
                  </div>
                )),
              )}
              {inboundTasks.every((task) => openInboundExceptions(task).length === 0) ? (
                <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">暂无待处理入库收货差异</div>
              ) : null}
            </div>
          </WorkTable>

          <WorkTable title="出库下架、拣货、打包与签出">
            <table className="w-full min-w-full table-fixed text-left text-sm lg:min-w-[1280px]">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">出库单</th>
                  <th className="px-4 py-3">模式 / 波次</th>
                  <th className="px-4 py-3">渠道 / 收件</th>
                  <th className="px-4 py-3">SKU 明细</th>
                  <th className="px-4 py-3">扫码进度</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">作业动作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {outboundTasks.slice(0, 20).map((item) => {
                  const progress = scanProgressLabel(item);
                  return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-slate-950">{item.id}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.customerCode} / {formatDate(item.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-semibold text-slate-900">{outboundWorkModeLabel(item.workMode)}</p>
                      <p className="mt-1 font-mono text-xs">波次：{item.pickWaveNo || "待生成"}</p>
                      <p className="mt-1 text-xs">拣货单：{item.pickListNo || "-"}</p>
                      <p className="mt-1 text-xs">篮号：{item.basketNo || "-"}</p>
                      {item.operationLogs?.[0] ? <p className="mt-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">{item.operationLogs[0].label}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{item.channel} / {item.orderCount} 单</p>
                      <p className="mt-1 max-w-xs truncate text-xs">{item.recipientName || "收件人待补"} / {item.deliveryAddress || "地址待补"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.skuLines?.length ? (
                        item.skuLines.map((line) => (
                          <p className="font-mono text-xs" key={`${item.id}-${line.skuCode}`}>
                            {line.skuCode} x {line.quantity}
                          </p>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">待补 SKU 明细</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-mono text-xs">拣货 {progress.picked}/{progress.total}</p>
                      <p className="mt-1 font-mono text-xs">配货 {progress.sorted}/{progress.total}</p>
                      <p className="mt-1 font-mono text-xs">复核 {progress.packed}/{progress.total}</p>
                      {item.scanProgress?.lastScans?.[0] ? <p className="mt-2 text-xs text-slate-500">{item.scanProgress.lastScans[0].operator} / {formatDate(item.scanProgress.lastScans[0].scannedAt)}</p> : null}
                    </td>
                    <td className="px-4 py-3">{pill(outboundLabel(item.status), outboundTone(item.status))}</td>
                    <td className="px-4 py-3">
                      <div className="grid gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Link className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/warehouse/print/pick-list/${encodeURIComponent(item.id)}`}>
                            拣货单
                          </Link>
                          <Link className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/warehouse/print/label/${encodeURIComponent(item.id)}`}>
                            面单
                          </Link>
                        </div>
                        <WarehouseTaskAction id={item.id} note={item.note} options={outboundOptions} status={item.status === "pending_review" ? "picking" : item.status} type="outbound" />
                        <WarehouseOutboundWorkflowActions order={item} />
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {outboundTasks.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                      暂无出库作业任务
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </WorkTable>

          <WorkTable title="出库扫码异常处理">
            <div className="grid gap-3 p-4">
              {outboundTasks.flatMap((order) =>
                (order.exceptions ?? [])
                  .filter((exception) => exception.status === "open" || exception.status === "investigating")
                  .map((exception) => (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={exception.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-500">{order.id} / {exception.id}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{exception.message}</p>
                          <p className="mt-1 text-xs text-slate-500">{exception.operator} / {formatDate(exception.createdAt)} / 条码 {exception.code || "-"}</p>
                        </div>
                        {pill(exception.severity === "critical" ? "严重异常" : "提醒", exceptionTone(exception.severity))}
                      </div>
                      <OutboundExceptionActions exception={exception} orderId={order.id} />
                    </div>
                  )),
              )}
              {outboundTasks.every((order) => !(order.exceptions ?? []).some((exception) => exception.status === "open" || exception.status === "investigating")) ? (
                <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">暂无待处理扫码异常</div>
              ) : null}
            </div>
          </WorkTable>

          <OpsStocktakePanel batches={coreData.stocktakeBatches} candidates={stocktakeCandidates} />

          <WarehouseInventoryMovePanel adjustments={coreData.inventoryAdjustments} balances={coreData.inventoryBalances} locations={coreData.locations} />

          <WarehouseLocationManager balances={coreData.inventoryBalances} locations={coreData.locations} />

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">批量导出</h2>
                <p className="mt-1 text-sm text-slate-500">先支持仓库常用 CSV 导出，后续可扩展为 Excel 模板、面单批量下载和导入任务中心。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/warehouse/exports/inventory">
                  导出库存 CSV
                </Link>
                <Link className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/warehouse/exports/locations">
                  导出库位 CSV
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PageShell>
  );
}
