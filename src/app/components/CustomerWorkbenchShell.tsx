import Image from "next/image";
import Link from "next/link";
import { Activity, BookOpen, Boxes, LayoutDashboard, ReceiptText, RotateCcw, Send, Store, Tags } from "lucide-react";
import { customerFeatures } from "@/lib/customerFeatures";
import { CustomerNotificationBell } from "./CustomerNotificationBell";
import { LogoutButton } from "./LogoutButton";

type CustomerWorkbenchSection = "overview" | "account" | "skus" | "inbound" | "outbound" | "tracking" | "returns" | "billing" | "shipping";

const businessNavItems = [
  { key: "overview", label: "总览", href: "/workspace", icon: LayoutDashboard },
  { key: "account", label: "店铺资料", href: "/account", icon: Store },
  { key: "skus", label: "SKU 库存", href: "/skus", icon: Tags },
  { key: "inbound", label: "入库预报", href: "/inbound", icon: Boxes },
  { key: "outbound", label: "出库发货", href: "/outbound", icon: Send },
  { key: "tracking", label: "业务进度", href: "/tracking", icon: Activity },
  { key: "returns", label: "退货售后", href: "/returns", icon: RotateCcw },
  { key: "shipping", label: "运费查询", href: "/workspace/shipping", icon: ReceiptText },
  { key: "billing", label: "费用账单", href: "/billing", icon: ReceiptText, hidden: !customerFeatures.billing },
].filter((item) => !("hidden" in item && item.hidden));

const supportNavItems = [
  { key: "guide", label: "使用教程", href: "/help/workbench-guide", icon: BookOpen },
];

const mobileNavItems = [...businessNavItems, ...supportNavItems];

function customerName(accountCompany?: string) {
  if (!accountCompany) return "平台店铺";
  if (["待完善店铺资料", "未完善公司资料"].includes(accountCompany)) return "平台店铺";
  return accountCompany;
}

function maskedCustomerCode(customerCode: string) {
  const normalized = customerCode.trim();
  if (!normalized) return "客户编号已保护";
  return `客户编号 •••• ${normalized.slice(-4)}`;
}

export async function CustomerWorkbenchShell({
  active,
  children,
  customerCode,
  customerCompany,
  eyebrow = "多平台订单与英国仓服务",
  title,
  actions,
}: {
  active: CustomerWorkbenchSection;
  children: React.ReactNode;
  customerCode: string;
  customerCompany?: string;
  eyebrow?: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <main className="surface-customer min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-800 bg-[#111612] text-white print:hidden lg:flex lg:flex-col">
          <Link className="flex h-24 items-center gap-3 border-b border-white/10 px-5" href="/workspace">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white shadow-[0_10px_24px_rgba(2,6,23,0.2)]">
              <Image alt="" className="h-9 w-9" height={42} src="/assets/xintu-crossborder-mark.svg" width={42} />
            </span>
            <span>
              <span className="block text-sm text-slate-300">新途跨境</span>
              <span className="block text-lg font-semibold">客户工作台</span>
            </span>
          </Link>
          <nav className="flex-1 space-y-1 px-4 py-5">
            {businessNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <Link
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                    isActive ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  href={item.href}
                  key={item.key}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
            <p className="px-3 pb-1 pt-5 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-500">帮助与支持</p>
            {supportNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <Link
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                    isActive ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  href={item.href}
                  key={item.key}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="rounded-lg bg-white/8 p-3">
              <p className="truncate text-sm font-semibold">{customerName(customerCompany)}</p>
              <p className="mt-1 font-mono text-xs text-slate-400">{maskedCustomerCode(customerCode)}</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="z-30 border-b border-slate-200 bg-white/92 backdrop-blur print:hidden lg:sticky lg:top-0">
            <div className="flex min-h-20 flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm text-slate-500">{eyebrow}</p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {actions}
                <CustomerNotificationBell />
                <LogoutButton nextPath="/login" />
              </div>
            </div>
            <details className="border-t border-slate-100 lg:hidden">
              <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-slate-800">工作台菜单</summary>
            <nav aria-label="客户工作台导航" className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3 sm:grid-cols-4">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <Link
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold ${
                      isActive ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  href={item.href}
                    key={item.key}
                  >
                    <Icon size={14} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            </details>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
