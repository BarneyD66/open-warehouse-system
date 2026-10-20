import Link from "next/link";
import { ArrowRight, Boxes, CheckCircle2, ClipboardList, LayoutDashboard, PackageCheck, RotateCcw, Store, Tags, Truck } from "lucide-react";
import { CustomerWorkbenchShell } from "@/app/components/CustomerWorkbenchShell";
import { getCustomerAccountByCode } from "@/lib/customerAccountStore";
import { requireCustomerSession } from "@/lib/customerAuth";
import { getSubmissionsForCustomer, inboundStatusLabel, type InboundSubmission } from "@/lib/localStore";
import { getWarehouseCoreDataForCustomer, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "green" | "amber" | "blue" | "slate" | "rose";

const toneClass: Record<Tone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-cyan-200 bg-cyan-50 text-cyan-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-semibold ${toneClass[tone]}`}>{children}</span>;
}

function CheckItem({
  title,
  body,
  value,
  href,
  icon: Icon,
  tone,
  cta,
}: {
  title: string;
  body: string;
  value: string;
  href: string;
  icon: typeof LayoutDashboard;
  tone: Tone;
  cta: string;
}) {
  return (
    <Link className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-cyan-300 hover:shadow-md" href={href}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
          <Icon size={19} />
        </span>
        <Pill tone={tone}>{value}</Pill>
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">
        {cta}
        <ArrowRight size={15} />
      </p>
    </Link>
  );
}

function orderStatusLabel(status: CoreOutboundOrder["status"]) {
  const labels: Record<CoreOutboundOrder["status"], string> = {
    cancelled: "已撤回",
    blocked: "需要处理",
    handover: "等待交运",
    label_pending: "生成面单",
    packing_check: "打包复核",
    pending_review: "正在校验",
    picking: "仓库拣货",
    shipped: "已发货",
  };
  return labels[status] ?? status;
}

function statusTone(status: CoreOutboundOrder["status"]): Tone {
  if (status === "shipped") return "green";
  if (status === "blocked") return "rose";
  return "amber";
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

export async function WorkspaceDashboard() {
  const session = await requireCustomerSession();
  const [account, coreData, submissions] = await Promise.all([
    getCustomerAccountByCode(session.customerCode),
    getWarehouseCoreDataForCustomer(session.customerCode),
    getSubmissionsForCustomer(session.customerCode),
  ]);
  const inbounds = submissions.filter((item): item is InboundSubmission => item.type === "inbound");
  const storeConfigured = Boolean(account?.storeUrl || account?.platforms?.length || coreData.customer?.storeUrl || coreData.customer?.platforms?.length);
  const skuCount = coreData.skus.length;
  const processingOrders = coreData.outboundOrders.filter((item) => item.status !== "shipped" && item.status !== "blocked").length;
  const shippedOrders = coreData.outboundOrders.filter((item) => item.status === "shipped").length;
  const blockedOrders = coreData.outboundOrders.filter((item) => item.status === "blocked").length;
  const activeReturns = coreData.returnOrders.filter((item) => !["restocked", "disposed", "closed"].includes(item.status)).length;
  const profileRecorded = Boolean(account?.companyName?.trim() && account?.contactName?.trim());
  const primaryStep = !profileRecorded && skuCount === 0
    ? {
        body: "可以先保存店铺与联系人资料，方便仓库联系；也可稍后填写，直接创建 SKU。",
        cta: "填写资料（可选）",
        href: "/account",
        title: "开始使用：资料 → SKU → 入库 → 出库",
      }
    : skuCount === 0
      ? {
          body: "创建平台使用的 SKU 编码和商品名称，仓库会用它匹配入库与订单。",
          cta: "创建第一个 SKU",
          href: "/skus",
          title: "下一步：创建商品 SKU",
        }
      : !inbounds.some((item) => item.status === "putaway_completed")
        ? {
            body: "填写到仓货件、SKU 和运输信息。仓库收货上架后，即可使用可用库存创建出库订单。",
            cta: "创建入库预报",
            href: "/inbound",
            title: "下一步：预报入库并等待上架",
          }
        : {
            body: "商品已上架，可上传订单或手工创建出库申请，并在业务进度中跟进发货。",
            cta: "进入出库发货",
            href: "/outbound",
            title: "下一步：创建出库订单",
          };

  return (
    <CustomerWorkbenchShell active="overview" customerCode={session.customerCode} customerCompany={account?.companyName ?? coreData.customer?.companyName} eyebrow="多平台订单与英国仓服务" title="订单处理工作台">
      <div className="space-y-5 px-4 py-5 sm:px-6" id="overview">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={skuCount ? "green" : "amber"}>{skuCount ? `${skuCount} 个 SKU 已建档` : "尚未创建 SKU"}</Pill>
                    {storeConfigured ? <Pill tone="blue">平台信息已填写</Pill> : null}
                  </div>
                  <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">{primaryStep.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    {primaryStep.body}
                  </p>
                  <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" href={primaryStep.href}>
                    {primaryStep.cta}
                    <ArrowRight size={16} />
                  </Link>
                  {!profileRecorded && skuCount === 0 ? <Link className="mt-3 block text-sm font-semibold text-cyan-800 underline" href="/skus">稍后填写，先创建 SKU</Link> : null}
                  <nav aria-label="开始使用步骤" className="mt-5 flex flex-wrap gap-3 text-xs text-slate-600">
                    {[{ href: "/account", label: "1 资料（可选）" }, { href: "/skus", label: "2 SKU" }, { href: "/inbound", label: "3 入库" }, { href: "/outbound", label: "4 出库" }].map((step) => <Link className="min-h-10 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50" href={step.href} key={step.href}>{step.label}</Link>)}
                  </nav>
                </div>

                <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">当前进度</h3>
                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                      <span className="text-slate-600">处理中</span>
                      <Pill tone={processingOrders ? "amber" : "slate"}>{processingOrders} 单</Pill>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                      <span className="text-slate-600">需修改</span>
                      <Pill tone={blockedOrders ? "rose" : "green"}>{blockedOrders} 单</Pill>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                      <span className="text-slate-600">已发货</span>
                      <Pill tone="green">{shippedOrders} 单</Pill>
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-4">
              <CheckItem body="可选填写店铺和联系人信息，联系邮箱默认使用登录邮箱。" cta="查看或修改" href="/account" icon={Store} title="店铺资料" tone="slate" value="选填" />
              <CheckItem body="用于和店铺 Seller SKU 对应，方便校验订单。" cta="维护 SKU" href="/skus" icon={Tags} title="SKU" tone={skuCount ? "green" : "amber"} value={`${skuCount} 个`} />
              <CheckItem body="查看已提交的到仓时间、箱数、追踪号、商品明细和仓库进度。" cta={inbounds.length ? "查看记录" : "提交预报"} href={inbounds.length ? "/inbound#history" : "/inbound"} icon={Boxes} title="入库预报" tone={inbounds.length ? "green" : "slate"} value={inbounds.length ? `${inbounds.length} 条` : "待提交"} />
              <CheckItem body="平台订单发生退货时，提交退货追踪号、SKU 和处理偏好。" cta="处理退货" href="/returns" icon={RotateCcw} title="退货售后" tone={activeReturns ? "amber" : "slate"} value={activeReturns ? `${activeReturns} 单` : "按需使用"} />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">最近入库预报</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">提交后可在工作台直接确认记录，并进入详情查看完整资料。</p>
                </div>
                <Link className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-cyan-800" href="/inbound#history">查看全部 <ArrowRight size={15} /></Link>
              </div>
              {inbounds.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {inbounds.slice(0, 3).map((item) => (
                    <Link className="rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-cyan-300" href="/inbound#history" key={item.id}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                        <Pill tone={item.status === "exception" ? "rose" : item.status === "putaway_completed" ? "green" : "blue"}>{inboundStatusLabel(item.status)}</Pill>
                      </div>
                      <p className="mt-3 truncate text-sm font-semibold text-slate-950">{item.productName || "货品待确认"}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">预计 {item.eta || "-"} 到仓 · {item.cartons} 箱 · {item.skuCount} 种 SKU · {item.totalProductQty ?? 0} 件商品</p>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title="暂无入库预报" body="提交第一条入库预报后，历史资料和仓库进度会显示在这里。" />}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="text-cyan-700" size={18} />
                    <h2 className="text-lg font-semibold text-slate-950">订单与出库</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">上传平台订单文件、校验 CSV 或手工创建出库申请，请前往“出库发货”。提交后可在下方查看处理进度和 Tracking。</p>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <p className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={16} />上传并校验订单</p>
                    <p className="flex gap-2"><PackageCheck className="mt-0.5 shrink-0 text-cyan-700" size={16} />仓库审核并处理</p>
                    <p className="flex gap-2"><Truck className="mt-0.5 shrink-0 text-cyan-700" size={16} />反馈 Tracking</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" href="/outbound">
                    进入出库发货 <ArrowRight size={16} />
                  </Link>
                  <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100" href="/workspace/order-export-guide">
                    查看平台导出攻略
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">订单进度</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">上传并提交后，您可以在这里查看校验、出库和发货反馈。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={processingOrders ? "amber" : "slate"}>处理中 {processingOrders}</Pill>
                  <Pill tone="green">已发货 {shippedOrders}</Pill>
                  <Pill tone={blockedOrders ? "rose" : "slate"}>需修改 {blockedOrders}</Pill>
                </div>
              </div>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-3">订单</th>
                      <th className="px-3 py-3">平台订单号</th>
                      <th className="px-3 py-3">状态</th>
                      <th className="px-3 py-3">Tracking</th>
                      <th className="px-3 py-3">更新时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {coreData.outboundOrders.slice(0, 8).map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">{order.id}</td>
                        <td className="px-3 py-3">{order.platformOrderNo || "-"}</td>
                        <td className="px-3 py-3">
                          <Pill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</Pill>
                        </td>
                        <td className="px-3 py-3">{order.trackingNumber || "等待反馈"}</td>
                        <td className="px-3 py-3">{new Date(order.updatedAt || order.createdAt).toLocaleDateString("zh-CN")}</td>
                      </tr>
                    ))}
                    {coreData.outboundOrders.length === 0 ? (
                      <tr>
                        <td className="px-3 py-8" colSpan={5}>
                          <EmptyState title="暂无订单" body="上传待发货订单并通过校验后，这里会显示订单处理进度。" />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 md:hidden">
                {coreData.outboundOrders.slice(0, 8).map((order) => (
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={order.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-slate-950">{order.id}</p>
                        <p className="mt-1 text-xs text-slate-500">{order.platformOrderNo || "暂无平台订单号"}</p>
                      </div>
                      <Pill tone={statusTone(order.status)}>{orderStatusLabel(order.status)}</Pill>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">Tracking：<span className="font-semibold text-slate-950">{order.trackingNumber || "等待反馈"}</span></p>
                  </article>
                ))}
                {coreData.outboundOrders.length === 0 ? <EmptyState title="暂无订单" body="上传待发货订单并通过校验后，这里会显示订单处理进度。" /> : null}
              </div>
            </section>
      </div>
    </CustomerWorkbenchShell>
  );
}
