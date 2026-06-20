"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Pause, Play, RadioTower, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import type { OpsExpansionData, PlatformConnection, PlatformSyncJob } from "@/lib/opsExpansionStore";
import type { IntegrationProbeRecord } from "@/lib/integrationProbeStore";
import type { CoreOutboundOrder } from "@/lib/warehouseCoreStore";
import { IntegrationProbeButton } from "./IntegrationProbeButton";

type Props = {
  data: Pick<OpsExpansionData, "platformConnections" | "platformSyncJobs">;
  outbounds: CoreOutboundOrder[];
  probeRecords?: IntegrationProbeRecord[];
};

function minutesSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - timestamp) / 60_000);
}

function dateText(value?: string) {
  if (!value) return "尚未同步";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function connectionKey(platform?: string, customerCode?: string, storeName?: string) {
  return [platform ?? "", customerCode ?? "", storeName ?? ""].map((item) => item.trim().toLowerCase()).join("::");
}

function fulfillmentStatusLabel(status: CoreOutboundOrder["platformFulfillmentStatus"]) {
  if (status === "synced") return "已回传";
  if (status === "failed") return "回传失败";
  if (status === "pending") return "待回传";
  if (status === "not_required") return "无需回传";
  return "待回传";
}

function platformStatusLabel(status: PlatformConnection["status"]) {
  if (status === "connected") return "已连接";
  if (status === "paused") return "已暂停";
  if (status === "error") return "异常";
  return "草稿";
}

function mappingText(connection: PlatformConnection) {
  return Object.entries(connection.fieldMapping ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function latestJobText(job?: PlatformSyncJob) {
  if (!job) return "暂无同步记录";
  return `${job.status === "completed" ? "同步完成" : "同步失败"} / 拉取 ${job.pulledRows} 行 / 可建单 ${job.readyOrders} 单 / 异常 ${job.issueCount} 条`;
}

function jobTone(job?: PlatformSyncJob) {
  if (!job) return "text-slate-500";
  return job.status === "completed" ? "text-emerald-700" : "text-rose-700";
}

function probeStatusText(probe?: IntegrationProbeRecord) {
  if (!probe) return "未探测";
  if (probe.status === "passed") return "探测通过";
  if (probe.status === "blocked") return "配置缺失";
  return "探测失败";
}

function probeTone(probe?: IntegrationProbeRecord) {
  if (!probe) return "text-slate-500";
  if (probe.status === "passed") return "text-emerald-700";
  if (probe.status === "blocked") return "text-amber-700";
  return "text-rose-700";
}

export function OpsPlatformSyncHealthPanel({ data, outbounds, probeRecords = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeConnectionId, setActiveConnectionId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const connectionSet = useMemo(
    () => new Set(data.platformConnections.map((item) => connectionKey(item.platform, item.customerCode, item.storeName))),
    [data.platformConnections],
  );
  const apiConnections = data.platformConnections.filter((item) => item.syncMode !== "manual_csv");
  const dueConnections = apiConnections.filter((item) => item.status === "connected" && minutesSince(item.lastSyncAt) >= 30);
  const errorConnections = data.platformConnections.filter((item) => item.status === "error");
  const pausedConnections = apiConnections.filter((item) => item.status === "paused");
  const failedJobs = data.platformSyncJobs.filter((job) => job.status === "failed");
  const cancellationJobs = data.platformSyncJobs.filter((job) => (job.cancelledRows ?? 0) > 0);
  const recentSyncJobs = [...data.platformSyncJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
  const latestJobByConnection = useMemo(() => {
    const map = new Map<string, PlatformSyncJob>();
    for (const job of [...data.platformSyncJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())) {
      if (!map.has(job.platformConnectionId)) map.set(job.platformConnectionId, job);
    }
    return map;
  }, [data.platformSyncJobs]);
  const latestProbeByConnection = useMemo(() => {
    const map = new Map<string, IntegrationProbeRecord>();
    for (const probe of probeRecords) {
      if (!probe.itemId.startsWith("platform:")) continue;
      const connectionId = probe.itemId.replace("platform:", "");
      if (!map.has(connectionId)) map.set(connectionId, probe);
    }
    return map;
  }, [probeRecords]);
  const fulfillmentRetryOrders = outbounds
    .filter((order) => {
      if (!order.platform || !order.platformOrderNo || !order.trackingNumber) return false;
      if (order.platformFulfillmentStatus === "synced" || order.platformFulfillmentStatus === "not_required") return false;
      return true;
    })
    .sort((a, b) => new Date(a.updatedAt ?? a.createdAt).getTime() - new Date(b.updatedAt ?? b.createdAt).getTime());
  const missingConnectionOrders = outbounds.filter((order) => {
    if (!order.platform || !order.platformOrderNo) return false;
    if (connectionSet.has(connectionKey(order.platform, order.customerCode, order.platformStoreName))) return false;
    const fallback = data.platformConnections.some((item) => item.platform === order.platform && item.customerCode === order.customerCode);
    return !fallback;
  });

  function runAction(kind: "sync" | "cancel" | "fulfillment") {
    setActiveConnectionId("");
    setMessage("");
    setError("");
    const endpoint =
      kind === "sync"
        ? "/api/ops/platform-orders/sync-due"
        : kind === "cancel"
          ? "/api/ops/platform-orders/cancellation-review"
          : "/api/ops/platform-fulfillment/retry-due";
    const body = kind === "sync" ? { limit: 20, minIntervalMinutes: 30 } : { limit: 50 };
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
        setError(payload.error || "平台同步任务执行失败，请检查连接、权限或稍后重试。");
        return;
      }
      if (kind === "sync") {
        setMessage(`到期平台拉单已执行：尝试 ${payload.summary?.attempted ?? 0} 个，成功 ${payload.summary?.completed ?? 0} 个，失败 ${payload.summary?.failed ?? 0} 个。`);
      } else if (kind === "cancel") {
        setMessage(`平台取消订单已复核：处理 ${payload.summary?.reviewed ?? 0} 条，截单 ${payload.summary?.intercepts ?? 0} 条，生成工单 ${payload.summary?.workOrders ?? 0} 条。`);
      } else {
        setMessage(`平台发货回传已重试：尝试 ${payload.summary?.attempted ?? 0} 单，成功 ${payload.summary?.synced ?? 0} 单，失败 ${payload.summary?.failed ?? 0} 单。`);
      }
      router.refresh();
    });
  }

  function syncConnection(connection: PlatformConnection) {
    setMessage("");
    setError("");
    setActiveConnectionId(connection.id);
    startTransition(async () => {
      const response = await fetch("/api/ops/platform-orders/sync-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id, minIntervalMinutes: 0, limit: 1 }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; summary?: Record<string, number>; results?: Array<{ message?: string }> };
      if (!response.ok) {
        setError(payload.error || "单店铺平台同步失败，请检查连接配置。");
        return;
      }
      setMessage(`${connection.platform} / ${connection.storeName} 同步完成：成功 ${payload.summary?.completed ?? 0}，失败 ${payload.summary?.failed ?? 0}。${payload.results?.[0]?.message ? ` ${payload.results[0].message}` : ""}`);
      router.refresh();
    });
  }

  function updateConnectionStatus(connection: PlatformConnection, status: "connected" | "paused") {
    setMessage("");
    setError("");
    setActiveConnectionId(connection.id);
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_platform",
          platform: connection.platform,
          storeName: connection.storeName,
          customerCode: connection.customerCode,
          syncMode: connection.syncMode,
          status,
          mappingText: mappingText(connection),
          note: connection.note ?? "",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "平台连接状态更新失败，请稍后重试。");
        return;
      }
      setMessage(`${connection.platform} / ${connection.storeName} 已${status === "paused" ? "暂停" : "恢复"}。`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <RadioTower size={18} className="text-[#0E7490]" />
            平台同步健康看板
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">集中查看 Amazon、TikTok Shop、Shopify、eBay 的拉单、取消订单复核和发货追踪号回传状态。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => runAction("sync")} type="button">
            <Play size={15} />
            同步到期平台
          </button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={isPending} onClick={() => runAction("cancel")} type="button">
            <RotateCcw size={15} />
            复核取消订单
          </button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending} onClick={() => runAction("fulfillment")} type="button">
            <Send size={15} />
            重试发货回传
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">API 连接</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{apiConnections.length}</p>
        </div>
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-800">到期未拉单</p>
          <p className="mt-1 text-xl font-semibold text-amber-950">{dueConnections.length}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">连接异常</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{errorConnections.length + failedJobs.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">已暂停</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{pausedConnections.length}</p>
        </div>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-cyan-800">取消待复核</p>
          <p className="mt-1 text-xl font-semibold text-cyan-950">{cancellationJobs.reduce((sum, job) => sum + (job.cancelledRows ?? 0), 0)}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">回传待处理</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{fulfillmentRetryOrders.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={15} className="text-amber-700" />
            平台连接与单店铺操作
          </h3>
          <div className="mt-3 grid gap-2">
            {[...errorConnections, ...dueConnections, ...pausedConnections, ...apiConnections].filter((connection, index, list) => list.findIndex((item) => item.id === connection.id) === index).slice(0, 6).map((connection) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={connection.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{connection.platform} / {connection.storeName}</p>
                  <span className={connection.status === "error" ? "font-semibold text-rose-700" : connection.status === "paused" ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>{platformStatusLabel(connection.status)}</span>
                </div>
                <p className="mt-1">{connection.customerCode} / {connection.syncMode} / 最后同步 {dateText(connection.lastSyncAt)}</p>
                <p className={`mt-1 font-semibold ${jobTone(latestJobByConnection.get(connection.id))}`}>{latestJobText(latestJobByConnection.get(connection.id))}</p>
                <p className={`mt-1 font-semibold ${probeTone(latestProbeByConnection.get(connection.id))}`}>
                  凭证探测：{probeStatusText(latestProbeByConnection.get(connection.id))}
                  {latestProbeByConnection.get(connection.id)?.finishedAt ? ` / ${dateText(latestProbeByConnection.get(connection.id)?.finishedAt)}` : ""}
                </p>
                {latestProbeByConnection.get(connection.id)?.message ? <p className="mt-1 text-slate-500">{latestProbeByConnection.get(connection.id)?.message}</p> : null}
                {connection.note ? <p className="mt-1 text-amber-800">{connection.note}</p> : null}
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending || connection.status === "paused"} onClick={() => syncConnection(connection)} type="button">
                    <Play size={12} />
                    {isPending && activeConnectionId === connection.id ? "处理中" : "同步"}
                  </button>
                  <button className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={isPending || connection.status === "paused"} onClick={() => updateConnectionStatus(connection, "paused")} type="button">
                    <Pause size={12} />
                    暂停
                  </button>
                  <button className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60" disabled={isPending || connection.status === "connected"} onClick={() => updateConnectionStatus(connection, "connected")} type="button">
                    <RotateCcw size={12} />
                    恢复
                  </button>
                  <IntegrationProbeButton itemId={`platform:${connection.id}`} disabled={isPending || connection.syncMode === "manual_csv"} />
                </div>
              </div>
            ))}
            {apiConnections.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无 API 平台连接。</p> : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <RotateCcw size={15} className="text-cyan-700" />
            平台取消复核
          </h3>
          <div className="mt-3 grid gap-2">
            {cancellationJobs.slice(0, 5).map((job) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={job.id}>
                <p className="font-semibold text-slate-950">{job.platform} / {job.storeName}</p>
                <p className="mt-1">{job.customerCode} / 取消 {job.cancelledRows ?? 0} 单 / {dateText(job.createdAt)}</p>
                <p className="mt-1 text-slate-500">{(job.cancelledOrders ?? []).slice(0, 3).map((order) => order.orderNo).join("、") || "等待复核明细"}</p>
              </div>
            ))}
            {cancellationJobs.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无平台取消订单待复核。</p> : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Send size={15} className="text-rose-700" />
            发货回传待处理
          </h3>
          <div className="mt-3 grid gap-2">
            {fulfillmentRetryOrders.slice(0, 5).map((order) => (
              <div className="rounded-md bg-white p-2 text-xs text-slate-600" key={order.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link className="font-semibold text-cyan-800 hover:text-cyan-950" href={`/ops?section=outbound`}>
                    {order.id}
                  </Link>
                  <span className={order.platformFulfillmentStatus === "failed" ? "text-rose-700" : "text-amber-700"}>{fulfillmentStatusLabel(order.platformFulfillmentStatus)}</span>
                </div>
                <p className="mt-1">{order.platform} / {order.platformStoreName || "默认店铺"} / {order.platformOrderNo}</p>
                <p className="mt-1 font-mono text-slate-500">{order.trackingNumber}</p>
                {order.platformFulfillmentError ? <p className="mt-1 text-rose-700">{order.platformFulfillmentError}</p> : null}
              </div>
            ))}
            {fulfillmentRetryOrders.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                暂无待重试的发货回传。
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {missingConnectionOrders.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <p className="font-semibold">有 {missingConnectionOrders.length} 个平台出库单缺少匹配店铺连接</p>
          <p className="mt-1">请在平台对接中补充客户店铺连接，否则发货追踪号无法稳定回传平台。</p>
        </div>
      ) : null}
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-950">最近同步记录</h3>
          <Link className="text-xs font-semibold text-cyan-800 hover:text-cyan-950" href="/api/ops/reports/platform-sync">
            导出平台同步任务
          </Link>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {recentSyncJobs.map((job) => (
            <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600" key={job.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-950">{job.platform} / {job.storeName}</p>
                <span className={job.status === "completed" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                  {job.status === "completed" ? "完成" : "失败"}
                </span>
              </div>
              <p className="mt-1">{job.customerCode} / {job.syncMode} / {dateText(job.createdAt)}</p>
              <p className="mt-1">拉取 {job.pulledRows} 行，可建单 {job.readyOrders} 单，跳过 {job.skippedRows} 行，异常 {job.issueCount} 条，取消 {job.cancelledRows ?? 0} 单。</p>
              {job.error ? <p className="mt-1 font-semibold text-rose-700">{job.error}</p> : null}
              {job.orderImportBatchId ? (
                <Link className="mt-2 inline-flex min-h-8 items-center rounded-md border border-cyan-200 bg-cyan-50 px-2.5 font-semibold text-cyan-800 hover:bg-cyan-100" href={`/ops/imports/${encodeURIComponent(job.orderImportBatchId)}`}>
                  查看导入预检草稿
                </Link>
              ) : null}
            </div>
          ))}
          {recentSyncJobs.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无平台同步记录。配置 API 沙箱或正式连接后，可在这里查看每次拉单结果。</p> : null}
        </div>
      </div>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}
