"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText, Loader2, RadioTower, Truck } from "lucide-react";
import type { CarrierServiceCode, CoreOutboundOrder, OutboundTrackingEvent } from "@/lib/warehouseCoreStore";

type Props = {
  order: Pick<
    CoreOutboundOrder,
    | "id"
    | "carrierServiceCode"
    | "carrierName"
    | "carrierServiceName"
    | "packageWeightKg"
    | "packageCount"
    | "shippingFee"
    | "actualShippingFee"
    | "shippingFeeCheckedAt"
    | "shippingFeeNote"
    | "labelStatus"
    | "trackingNumber"
    | "trackingEvents"
  >;
};

const carrierOptions: Array<{ value: CarrierServiceCode; label: string }> = [
  { value: "royal_mail_48", label: "Royal Mail Tracked 48" },
  { value: "royal_mail_24", label: "Royal Mail Tracked 24" },
  { value: "dpd_next_day", label: "DPD Next Day" },
  { value: "evri_standard", label: "Evri Standard" },
  { value: "manual", label: "客户/人工渠道" },
];

const trackingOptions: Array<{ value: OutboundTrackingEvent["status"]; label: string }> = [
  { value: "warehouse_processing", label: "仓库处理中" },
  { value: "carrier_handover", label: "已交接承运商" },
  { value: "in_transit", label: "运输途中" },
  { value: "out_for_delivery", label: "派送中" },
  { value: "delivered", label: "已签收" },
  { value: "exception", label: "物流异常" },
];

export function OpsShipmentPanel({ order }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serviceCode, setServiceCode] = useState<CarrierServiceCode>(order.carrierServiceCode ?? "royal_mail_48");
  const [packageWeightKg, setPackageWeightKg] = useState(String(order.packageWeightKg ?? ""));
  const [packageCount, setPackageCount] = useState(String(order.packageCount ?? 1));
  const [trackingStatus, setTrackingStatus] = useState<OutboundTrackingEvent["status"]>("carrier_handover");
  const [trackingDetail, setTrackingDetail] = useState("");
  const [actualShippingFee, setActualShippingFee] = useState(String(order.actualShippingFee ?? ""));
  const [shippingFeeNote, setShippingFeeNote] = useState(order.shippingFeeNote ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function postShipping(action: "rate" | "generate_label") {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/outbounds/${encodeURIComponent(order.id)}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, serviceCode, packageWeightKg, packageCount }),
      });
      const payload = (await response.json().catch(() => ({}))) as { rate?: { amount?: number; carrierName?: string; serviceName?: string; warning?: string }; error?: string };
      if (!response.ok) {
        setError(payload.error || "物流处理失败，请稍后重试。");
        return;
      }
      const rateText = payload.rate ? `£${Number(payload.rate.amount ?? 0).toFixed(2)} / ${payload.rate.carrierName} ${payload.rate.serviceName}` : "已更新";
      setMessage(action === "generate_label" ? `面单已生成：${rateText}` : `运费已试算：${rateText}${payload.rate?.warning ? `，${payload.rate.warning}` : ""}`);
      router.refresh();
    });
  }

  function postTracking() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/outbounds/${encodeURIComponent(order.id)}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: trackingStatus, detail: trackingDetail, location: "Sheffield Warehouse" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "追踪回传失败，请稍后重试。");
        return;
      }
      setMessage("追踪节点已回传，客户侧物流进度会同步更新。");
      router.refresh();
    });
  }

  function reconcileFee() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/outbounds/${encodeURIComponent(order.id)}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile_fee", actualShippingFee, note: shippingFeeNote }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "运费核对失败，请稍后重试。");
        return;
      }
      setMessage("实际运费已记录，物流费用差异会进入核对面板。");
      router.refresh();
    });
  }

  const feeDiff = typeof order.shippingFee === "number" && typeof order.actualShippingFee === "number" ? Math.round((order.actualShippingFee - order.shippingFee) * 100) / 100 : null;

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_72px_64px]">
        <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setServiceCode(event.target.value as CarrierServiceCode)} value={serviceCode}>
          {carrierOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setPackageWeightKg(event.target.value)} placeholder="kg" value={packageWeightKg} />
        <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setPackageCount(event.target.value)} placeholder="件" value={packageCount} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isPending} onClick={() => postShipping("rate")} type="button">
          {isPending ? <Loader2 className="animate-spin" size={13} /> : <Truck size={13} />}
          试算
        </button>
        <button className="inline-flex min-h-8 items-center gap-1 rounded-md bg-slate-950 px-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => postShipping("generate_label")} type="button">
          <FileText size={13} />
          生成面单
        </button>
        <a className={`inline-flex min-h-8 items-center rounded-md border px-2 text-xs font-semibold ${order.labelStatus === "generated" ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "pointer-events-none border-slate-100 bg-white text-slate-300"}`} href={`/warehouse/print/label/${encodeURIComponent(order.id)}`}>
          打印
        </a>
      </div>
      <div className="grid gap-2 sm:grid-cols-[130px_1fr_auto]">
        <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setTrackingStatus(event.target.value as OutboundTrackingEvent["status"])} value={trackingStatus}>
          {trackingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setTrackingDetail(event.target.value)} placeholder="追踪备注" value={trackingDetail} />
        <button className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isPending} onClick={postTracking} type="button">
          <RadioTower size={13} />
          回传
        </button>
      </div>
      <div className="text-xs leading-5 text-slate-500">
        <p>面单：{order.labelStatus ?? "not_requested"} / {order.trackingNumber ?? "未生成追踪号"}</p>
        {typeof order.shippingFee === "number" ? <p>运费：£{order.shippingFee.toFixed(2)} / {order.carrierName} {order.carrierServiceName}</p> : null}
        {typeof order.actualShippingFee === "number" ? <p>实收/实付：£{order.actualShippingFee.toFixed(2)}{feeDiff !== null ? ` / 差异 £${feeDiff.toFixed(2)}` : ""}</p> : null}
        {order.trackingEvents?.[0] ? <p>最新：{order.trackingEvents[0].label}</p> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-[90px_1fr_auto]">
        <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setActualShippingFee(event.target.value)} placeholder="实际 £" value={actualShippingFee} />
        <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500" onChange={(event) => setShippingFeeNote(event.target.value)} placeholder="运费核对备注" value={shippingFeeNote} />
        <button className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isPending} onClick={reconcileFee} type="button">
          核对运费
        </button>
      </div>
      {message ? <p className="rounded-md bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md bg-rose-50 p-2 text-xs font-semibold text-rose-800">{error}</p> : null}
    </div>
  );
}
