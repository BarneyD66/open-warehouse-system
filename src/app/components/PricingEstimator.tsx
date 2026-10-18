"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, FileText, PackageCheck, ReceiptText, RotateCcw, Truck, Warehouse } from "lucide-react";
import { surfaceHref } from "@/lib/surfaceLinks";

type EstimateLine = {
  label: string;
  note: string;
  amount: number;
  type: "inbound" | "storage" | "outbound" | "packaging" | "returns" | "fba" | "valueAdded";
};

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  currency: "GBP",
  maximumFractionDigits: 0,
  style: "currency",
});

const cnyFormatter = new Intl.NumberFormat("zh-CN", {
  currency: "CNY",
  maximumFractionDigits: 0,
  style: "currency",
});

const estimateRates = {
  inboundPerCarton: 0.58,
  storagePerCbmDay: 0.62,
  outboundBase: 1.12,
  extraItem: 0.18,
  packagingPerOrder: 0.32,
  returnPerParcel: 1.75,
  fbaPrepPerCarton: 0.85,
  valueAddedPerCarton: 0.45,
  gbpToCny: 9.18,
};

const services = ["仓储 + 一件代发", "FBA 中转补货", "退货换标处理", "贴标/质检/拍照", "B2B 小批量履约"];

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function NumberField({
  label,
  max,
  min,
  suffix,
  value,
  onChange,
}: {
  label: string;
  max: number;
  min: number;
  suffix: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-3 focus-within:border-[#0E7490]">
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none"
          inputMode="numeric"
          max={max}
          min={min}
          onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
          type="number"
          value={value}
        />
        <span className="shrink-0 text-xs font-semibold text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

function lineIcon(type: EstimateLine["type"]) {
  if (type === "storage") return Warehouse;
  if (type === "outbound") return Truck;
  if (type === "returns") return RotateCcw;
  if (type === "inbound" || type === "fba") return PackageCheck;
  return ReceiptText;
}

export function PricingEstimator() {
  const [platform, setPlatform] = useState("Amazon UK");
  const [service, setService] = useState("仓储 + 一件代发");
  const [monthlyOrders, setMonthlyOrders] = useState(500);
  const [itemsPerOrder, setItemsPerOrder] = useState(1);
  const [inboundCartons, setInboundCartons] = useState(80);
  const [storageCbm, setStorageCbm] = useState(12);
  const [storageDays, setStorageDays] = useState(30);
  const [returnParcels, setReturnParcels] = useState(35);
  const [fbaCartons, setFbaCartons] = useState(20);
  const [needValueAdded, setNeedValueAdded] = useState(true);
  const [tab, setTab] = useState<"inputs" | "breakdown" | "next">("inputs");

  const estimate = useMemo(() => {
    const inbound = inboundCartons * estimateRates.inboundPerCarton;
    const storage = storageCbm * storageDays * estimateRates.storagePerCbmDay;
    const outbound = monthlyOrders * (estimateRates.outboundBase + Math.max(itemsPerOrder - 1, 0) * estimateRates.extraItem);
    const packaging = monthlyOrders * estimateRates.packagingPerOrder;
    const returns = returnParcels * estimateRates.returnPerParcel;
    const fbaPrep = fbaCartons * estimateRates.fbaPrepPerCarton;
    const valueAdded = needValueAdded ? inboundCartons * estimateRates.valueAddedPerCarton : 0;

    const lines: EstimateLine[] = [
      { label: "入库处理", note: `${inboundCartons} 箱/托，含基础收货登记`, amount: inbound, type: "inbound" },
      { label: "仓储占用", note: `${storageCbm} CBM x ${storageDays} 天`, amount: storage, type: "storage" },
      { label: "订单出库", note: `${monthlyOrders} 单，平均 ${itemsPerOrder} 件/单`, amount: outbound, type: "outbound" },
      { label: "包材与打包", note: "按订单维度预估，实际按包材复核", amount: packaging, type: "packaging" },
      { label: "退货处理", note: `${returnParcels} 个退货包裹`, amount: returns, type: "returns" },
      { label: "FBA 贴标/分箱", note: `${fbaCartons} 箱，基础贴标/换箱场景`, amount: fbaPrep, type: "fba" },
      { label: "增值服务", note: needValueAdded ? "拍照、换标、质检等基础预留" : "本次未计入", amount: valueAdded, type: "valueAdded" },
    ];

    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const perOrder = monthlyOrders > 0 ? total / monthlyOrders : 0;
    const tier = total < 850 ? "小批量起步档位" : total < 2600 ? "稳定出单档位" : "规模履约档位";

    return {
      lines,
      perOrder,
      tier,
      total,
      totalCny: total * estimateRates.gbpToCny,
    };
  }, [fbaCartons, inboundCartons, itemsPerOrder, monthlyOrders, needValueAdded, returnParcels, storageCbm, storageDays]);

  const quoteHref = useMemo(() => {
    const params = new URLSearchParams({
      source: "pricing-estimator",
      platform,
      service,
      monthlyOrders: String(monthlyOrders),
      itemsPerOrder: String(itemsPerOrder),
      inboundCartons: String(inboundCartons),
      storageCbm: String(storageCbm),
      storageDays: String(storageDays),
      returnParcels: String(returnParcels),
      fbaCartons: String(fbaCartons),
      valueAdded: needValueAdded ? "true" : "false",
      totalGbp: String(Math.round(estimate.total)),
      totalCny: String(Math.round(estimate.totalCny)),
      perOrderGbp: estimate.perOrder.toFixed(2),
      tier: estimate.tier,
    });

    return surfaceHref("customer", `/inquiry?${params.toString()}`);
  }, [estimate.perOrder, estimate.tier, estimate.total, estimate.totalCny, fbaCartons, inboundCartons, itemsPerOrder, monthlyOrders, needValueAdded, platform, returnParcels, service, storageCbm, storageDays]);

  return (
    <section className="luxury-surface grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_0.9fr] lg:p-8">
      <div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="section-eyebrow">费用预估器</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">先估一个月成本，再提交资料确认报价</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              这里用常见计费方式帮助您理解费用构成。报价会结合品类、尺寸重量、库龄、配送方式和仓库确认结果确认。
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-[#0E7490]">
            <Calculator size={16} /> 试算工具
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ["inputs", "业务数据"],
            ["breakdown", "费用拆解"],
            ["next", "报价准备"],
          ].map(([id, label]) => (
            <button
              className={`inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-semibold ${
                tab === id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"
              }`}
              key={id}
              onClick={() => setTab(id as "inputs" | "breakdown" | "next")}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "inputs" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">销售平台</span>
              <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" onChange={(event) => setPlatform(event.target.value)} value={platform}>
                <option>Amazon UK</option>
                <option>eBay UK</option>
                <option>TikTok Shop UK</option>
                <option>Shopify</option>
                <option>Temu</option>
                <option>B2B 外贸</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">主要服务</span>
              <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0E7490]" onChange={(event) => setService(event.target.value)} value={service}>
                {services.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <NumberField label="月订单量" max={20000} min={0} onChange={setMonthlyOrders} suffix="单/月" value={monthlyOrders} />
            <NumberField label="平均件数" max={12} min={1} onChange={setItemsPerOrder} suffix="件/单" value={itemsPerOrder} />
            <NumberField label="月入库量" max={5000} min={0} onChange={setInboundCartons} suffix="箱/托" value={inboundCartons} />
            <NumberField label="平均库存体积" max={1000} min={0} onChange={setStorageCbm} suffix="CBM" value={storageCbm} />
            <NumberField label="计费仓储天数" max={365} min={0} onChange={setStorageDays} suffix="天" value={storageDays} />
            <NumberField label="月退货包裹" max={5000} min={0} onChange={setReturnParcels} suffix="件/月" value={returnParcels} />
            <NumberField label="FBA 处理量" max={5000} min={0} onChange={setFbaCartons} suffix="箱/月" value={fbaCartons} />
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3">
              <span>
                <span className="block text-sm font-semibold text-slate-800">增值服务预留</span>
                <span className="block text-xs text-slate-500">换标、拍照、基础质检</span>
              </span>
              <input className="h-5 w-5 accent-[#0E7490]" checked={needValueAdded} onChange={(event) => setNeedValueAdded(event.target.checked)} type="checkbox" />
            </label>
          </div>
        ) : null}

        {tab === "breakdown" ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {estimate.lines.map((line) => {
              const Icon = lineIcon(line.type);
              return (
                <div className="bento-card p-4" key={line.label}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-[#0E7490]">
                        <Icon size={17} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{line.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{line.note}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-950">{gbpFormatter.format(line.amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === "next" ? (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["1", "准备 SKU 和品类", "SKU 数、品名、是否带电/液体/易碎。"],
              ["2", "准备尺寸重量", "单品、外箱、托盘或库存体积。"],
              ["3", "说明服务需求", "FBA、退货、换标、拍照、尾程偏好。"],
            ].map(([index, title, body]) => (
              <div className="bento-card p-5" key={title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 font-mono text-xs font-semibold text-white">{index}</span>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg bg-slate-950 p-5 pb-6 text-white shadow-2xl shadow-slate-950/10 sm:p-6 lg:self-start">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold text-cyan-200">预估结果</p>
            <h2 className="mt-2 text-3xl font-semibold">{gbpFormatter.format(estimate.total)}</h2>
            <p className="mt-1 text-sm text-slate-300">约 {cnyFormatter.format(estimate.totalCny)} / 月，{gbpFormatter.format(estimate.perOrder)} / 单</p>
          </div>
          <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{estimate.tier}</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">平台</p>
            <p className="mt-1 text-sm font-semibold text-white">{platform}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">服务</p>
            <p className="mt-1 text-sm font-semibold text-white">{service}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 pb-1 sm:flex-row">
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100" href={quoteHref}>
            <FileText size={16} /> 提交资料确认报价
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10" href={quoteHref}>
            联系客服确认
          </Link>
        </div>

        <div className="mt-5 space-y-2.5">
          {estimate.lines.slice(0, 5).map((line) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm" key={line.label}>
              <span className="text-slate-300">{line.label}</span>
              <span className="font-semibold text-cyan-100">{gbpFormatter.format(line.amount)}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-xs leading-5 text-amber-50">
          预估仅用于理解费用结构，不代表最终价格。实际费用以仓库复核尺寸重量、服务项、包材、尾程承运商账单和双方确认结果为准。
        </div>

      </div>
    </section>
  );
}
