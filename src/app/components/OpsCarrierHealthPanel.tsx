"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileCheck2, Play, RefreshCw, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LogisticsChannelConfig } from "@/lib/opsExpansionStore";
import type { CoreOutboundOrder, OutboundExceptionRecord, OutboundTrackingEvent } from "@/lib/warehouseCoreStore";

type Props = {
  channels: LogisticsChannelConfig[];
  outbounds: CoreOutboundOrder[];
};

function latestTrackingEvent(order: CoreOutboundOrder): OutboundTrackingEvent | undefined {
  return [...(order.trackingEvents ?? [])].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
}

function hasProof(order: CoreOutboundOrder) {
  return (order.exceptions ?? []).some((item) => item.deliveryExceptionType === "proof_uploaded" || Boolean(item.proofUrl));
}

function openDeliveryExceptions(order: CoreOutboundOrder) {
  return (order.exceptions ?? []).filter((item) => item.deliveryExceptionType && item.deliveryExceptionType !== "proof_uploaded" && (item.status === "open" || item.status === "investigating"));
}

function claimExceptions(order: CoreOutboundOrder) {
  return (order.exceptions ?? []).filter((item) => item.claimStatus && item.claimStatus !== "not_required");
}

function channelIssues(channel: LogisticsChannelConfig) {
  const features = channel.enabledFeatures.join(" ");
  return [
    channel.apiMode !== "manual" && !channel.credentialRef ? "缺少凭证引用" : "",
    channel.apiMode !== "manual" && !features.includes("面单购买") ? "缺少面单购买能力" : "",
    channel.apiMode !== "manual" && !features.includes("轨迹自动回传") ? "缺少轨迹自动回传" : "",
    !features.includes("签收证明") ? "缺少签收证明" : "",
    !features.includes("派送失败处理") ? "缺少派送失败处理" : "",
    !features.includes("物流赔付") ? "缺少物流赔付" : "",
    channel.status !== "active" && channel.status !== "sandbox" ? `渠道状态：${channel.status}` : "",
  ].filter(Boolean);
}

function exceptionText(exception: OutboundExceptionRecord) {
  if (exception.claimStatus && exception.claimStatus !== "not_required") return `${exception.message} / 赔付 ${exception.claimStatus}`;
  return exception.message;
}

function dateText(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function OpsCarrierHealthPanel({ channels, outbounds }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const apiChannels = channels.filter((channel) => channel.apiMode !== "manual");
  const channelRiskRows = useMemo(
    () =>
      channels
        .map((channel) => ({ channel, issues: channelIssues(channel) }))
        .filter((item) => item.issues.length > 0)
        .sort((a, b) => b.issues.length - a.issues.length),
    [channels],
  );
  const labelFailedOrders = outbounds
    .filter((order) => order.labelStatus === "failed" && !order.labelFallbackNote && order.status !== "shipped")
    .sort((a, b) => new Date(a.labelNextRetryAt || a.updatedAt || a.createdAt).getTime() - new Date(b.labelNextRetryAt || b.updatedAt || b.createdAt).getTime());
  const trackingDueOrders = outbounds
    .filter((order) => {
      if (!order.trackingNumber && !order.carrierShipmentId) return false;
      const latest = latestTrackingEvent(order);
      if (latest?.status === "delivered" && hasProof(order)) return false;
      if (order.carrierGatewayMode === "internal") return false;
      return true;
    })
    .sort((a, b) => new Date(latestTrackingEvent(a)?.occurredAt || a.updatedAt || a.createdAt).getTime() - new Date(latestTrackingEvent(b)?.occurredAt || b.updatedAt || b.createdAt).getTime());
  const exceptionOrders = outbounds
    .map((order) => ({ order, exceptions: openDeliveryExceptions(order) }))
    .filter((item) => item.exceptions.length > 0)
    .sort((a, b) => new Date(a.exceptions[0]?.createdAt ?? a.order.createdAt).getTime() - new Date(b.exceptions[0]?.createdAt ?? b.order.createdAt).getTime());
  const claimRows = outbounds
    .map((order) => ({ order, exceptions: claimExceptions(order) }))
    .filter((item) => item.exceptions.length > 0);

  function runAction(kind: "label" | "tracking") {
    setMessage("");
    setError("");
    const endpoint = kind === "label" ? "/api/ops/carrier-labels/retry-due" : "/api/ops/carrier-tracking/sync-due";
    const body = kind === "label" ? { limit: 50 } : { limit: 50, minIntervalMinutes: 120, includeInternal: false };
    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: Record<string, number>;
      };
      if (!response.ok) {
        setError(payload.error || "承运商任务执行失败，请检查渠道配置、凭证或稍后重试。");
        return;
      }
      if (kind === "label") {
        setMessage(`到期面单已重试：尝试 ${payload.summary?.attempted ?? 0} 单，生成 ${payload.summary?.generated ?? 0} 单，失败 ${payload.summary?.failed ?? 0} 单。`);
      } else {
        setMessage(`承运商轨迹/POD 已同步：尝试 ${payload.summary?.attempted ?? 0} 单，成功 ${payload.summary?.synced ?? 0} 单，签收证明 ${payload.summary?.proofs ?? 0} 条，异常 ${payload.summary?.exceptions ?? 0} 条。`);
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Truck size={18} className="text-[#0E7490]" />
            承运商 API 闭环看板
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">集中查看真实承运商面单、轨迹回传、签收证明、派送异常和赔付处理风险。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => runAction("label")} type="button">
            <RefreshCw size={15} />
            重试到期面单
          </button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending} onClick={() => runAction("tracking")} type="button">
            <Play size={15} />
            同步轨迹/POD
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">API 渠道</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{apiChannels.length}</p>
        </div>
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-800">配置缺口</p>
          <p className="mt-1 text-xl font-semibold text-amber-950">{channelRiskRows.length}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">面单失败</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{labelFailedOrders.length}</p>
        </div>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-cyan-800">轨迹待同步</p>
          <p className="mt-1 text-xl font-semibold text-cyan-950">{trackingDueOrders.length}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">派送/赔付异常</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{exceptionOrders.length + claimRows.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={15} className="text-amber-700" />
            渠道配置与面单失败
          </h3>
          <div className="mt-3 grid gap-2">
            {channelRiskRows.slice(0, 3).map(({ channel, issues }) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={channel.id}>
                <p className="font-semibold text-slate-950">{channel.carrierName} / {channel.serviceName}</p>
                <p className="mt-1">{channel.apiMode} / {channel.status} / {issues.join("、")}</p>
              </div>
            ))}
            {labelFailedOrders.slice(0, 3).map((order) => (
              <div className="rounded-md border border-rose-100 bg-white p-2 text-xs text-slate-600" key={order.id}>
                <Link className="font-semibold text-cyan-800 hover:text-cyan-950" href="/ops?section=outbound">{order.id}</Link>
                <p className="mt-1">{order.carrierName || order.channel} / 重试 {order.labelRetryCount ?? 0} 次 / 下次 {dateText(order.labelNextRetryAt)}</p>
                {order.labelFailureReason ? <p className="mt-1 text-rose-700">{order.labelFailureReason}</p> : null}
              </div>
            ))}
            {channelRiskRows.length === 0 && labelFailedOrders.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                渠道配置和面单重试暂无高风险。
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileCheck2 size={15} className="text-cyan-700" />
            轨迹与签收证明
          </h3>
          <div className="mt-3 grid gap-2">
            {trackingDueOrders.slice(0, 5).map((order) => {
              const latest = latestTrackingEvent(order);
              return (
                <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={order.id}>
                  <Link className="font-semibold text-cyan-800 hover:text-cyan-950" href="/ops?section=logistics">{order.id}</Link>
                  <p className="mt-1">{order.carrierName || order.channel} / {order.trackingNumber || order.carrierShipmentId}</p>
                  <p className="mt-1 text-slate-500">最近轨迹：{latest?.label || latest?.status || "未同步"} / {dateText(latest?.occurredAt)}</p>
                </div>
              );
            })}
            {trackingDueOrders.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无需要主动同步的外部承运商轨迹。</p> : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={15} className="text-rose-700" />
            派送异常与赔付
          </h3>
          <div className="mt-3 grid gap-2">
            {exceptionOrders.slice(0, 3).map(({ order, exceptions }) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={order.id}>
                <Link className="font-semibold text-cyan-800 hover:text-cyan-950" href="/ops?section=logistics">{order.id}</Link>
                <p className="mt-1">{order.customerCode} / {order.trackingNumber || "-"}</p>
                <p className="mt-1 text-rose-700">{exceptionText(exceptions[0])}</p>
              </div>
            ))}
            {claimRows.slice(0, 3).map(({ order, exceptions }) => (
              <div className="rounded-md border border-amber-100 bg-white p-2 text-xs text-slate-600" key={`claim-${order.id}`}>
                <Link className="font-semibold text-cyan-800 hover:text-cyan-950" href="/ops?section=logistics">{order.id}</Link>
                <p className="mt-1">{order.customerCode} / 赔付记录 {exceptions.length} 条</p>
                <p className="mt-1 text-amber-800">{exceptionText(exceptions[0])}</p>
              </div>
            ))}
            {exceptionOrders.length === 0 && claimRows.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无开放的派送异常或赔付事项。</p> : null}
          </div>
        </div>
      </div>

      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}
