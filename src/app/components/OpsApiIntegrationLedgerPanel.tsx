"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, RadioTower, RotateCcw } from "lucide-react";
import type { AuditLogRecord } from "@/lib/auditLogStore";
import type { WebhookEventRecord, WebhookEventStatus } from "@/lib/webhookEventStore";

type Props = {
  webhookEvents: WebhookEventRecord[];
  auditLogs: AuditLogRecord[];
};

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneClass: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
};

const webhookStatusLabel: Record<WebhookEventStatus, string> = {
  processing: "处理中",
  processed: "已处理",
  ignored: "已忽略",
  failed: "失败",
};

const integrationAuditActions = new Set<AuditLogRecord["action"]>([
  "integration_probe",
  "outbound_shipping_label_update",
  "carrier_label_retry_due",
  "carrier_tracking_sync_due",
  "platform_orders_sync_due",
  "platform_cancellation_review_due",
  "platform_fulfillment_retry_due",
  "automation_run_due",
  "automation_task_update",
]);

const actionLabel: Partial<Record<AuditLogRecord["action"], string>> = {
  integration_probe: "接口探测",
  outbound_shipping_label_update: "面单下单/取消",
  carrier_label_retry_due: "承运商面单重试",
  carrier_tracking_sync_due: "承运商轨迹/POD 同步",
  platform_orders_sync_due: "平台订单拉取",
  platform_cancellation_review_due: "平台取消复核",
  platform_fulfillment_retry_due: "平台发货回传",
  automation_run_due: "自动任务运行",
  automation_task_update: "自动任务配置",
};

function pill(label: string, tone: Tone) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClass[tone]}`}>{label}</span>;
}

function dateText(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function isRiskAudit(log: AuditLogRecord) {
  const text = [log.summary, log.note, JSON.stringify(log.after ?? ""), JSON.stringify(log.before ?? "")].join(" ").toLowerCase();
  return /失败|异常|错误|failed|error|blocked|missing/.test(text);
}

function nextActionForWebhook(event: WebhookEventRecord) {
  if (event.status === "failed") return event.targetId ? "检查关联单据处理结果，必要时重新投递或人工补录。" : "补齐单号匹配规则后让对方重推 webhook。";
  if (event.status === "processing") return "确认是否卡住，超过 10 分钟建议重新投递或查看系统日志。";
  if (event.status === "ignored") return "无需处理，保留幂等记录用于排查重复回调。";
  return "已完成，可作为轨迹、POD、取消订单闭环证据。";
}

function nextActionForAudit(log: AuditLogRecord) {
  if (isRiskAudit(log)) return "进入对应业务模块处理失败原因，处理后再次触发同步或重试。";
  if (log.action === "integration_probe") return "如探测未覆盖正式密钥，请补齐生产环境变量后再次探测。";
  if (log.action === "automation_task_update") return "确认任务频率、密钥和告警订阅是否符合生产节奏。";
  return "保留为接口闭环审计记录。";
}

export function OpsApiIntegrationLedgerPanel({ webhookEvents, auditLogs }: Props) {
  const integrationLogs = auditLogs.filter((log) => integrationAuditActions.has(log.action));
  const failedWebhooks = webhookEvents.filter((event) => event.status === "failed");
  const processingWebhooks = webhookEvents.filter((event) => event.status === "processing");
  const carrierWebhooks = webhookEvents.filter((event) => event.kind === "carrier");
  const platformWebhooks = webhookEvents.filter((event) => event.kind === "platform");
  const riskyLogs = integrationLogs.filter(isRiskAudit);
  const closedEvents = webhookEvents.filter((event) => event.status === "processed").length + integrationLogs.filter((log) => !isRiskAudit(log)).length;

  const priorityRows = [
    ...failedWebhooks.map((event) => ({
      id: event.id,
      tone: "rose" as Tone,
      label: `Webhook ${webhookStatusLabel[event.status]}`,
      title: `${event.kind === "carrier" ? "承运商" : "平台"} / ${event.provider}`,
      meta: `${event.targetId || "未匹配单据"} / ${dateText(event.updatedAt)}`,
      detail: event.error || event.summary || event.eventId,
      nextAction: nextActionForWebhook(event),
    })),
    ...processingWebhooks.map((event) => ({
      id: event.id,
      tone: "amber" as Tone,
      label: `Webhook ${webhookStatusLabel[event.status]}`,
      title: `${event.kind === "carrier" ? "承运商" : "平台"} / ${event.provider}`,
      meta: `${event.targetId || "未匹配单据"} / ${dateText(event.updatedAt)}`,
      detail: event.summary || event.eventId,
      nextAction: nextActionForWebhook(event),
    })),
    ...riskyLogs.map((log) => ({
      id: log.id,
      tone: "rose" as Tone,
      label: actionLabel[log.action] || log.action,
      title: log.summary,
      meta: `${log.actorName} / ${log.targetId} / ${dateText(log.createdAt)}`,
      detail: log.note || "",
      nextAction: nextActionForAudit(log),
    })),
  ].slice(0, 8);

  const capabilityRows = [
    {
      title: "承运商下单/取消",
      done: integrationLogs.some((log) => log.action === "outbound_shipping_label_update" || log.action === "carrier_label_retry_due"),
      detail: "覆盖买面单、取消面单、失败重试和审计留痕。",
    },
    {
      title: "承运商轨迹/POD",
      done: carrierWebhooks.length > 0 || integrationLogs.some((log) => log.action === "carrier_tracking_sync_due"),
      detail: "覆盖轨迹同步、签收证明、派送异常和赔付线索。",
    },
    {
      title: "平台拉单/取消",
      done: platformWebhooks.length > 0 || integrationLogs.some((log) => log.action === "platform_orders_sync_due" || log.action === "platform_cancellation_review_due"),
      detail: "覆盖订单 API 拉取、取消订单复核和异常校验。",
    },
    {
      title: "平台发货回传",
      done: integrationLogs.some((log) => log.action === "platform_fulfillment_retry_due"),
      detail: "覆盖发货后追踪号回传、失败重试和平台侧同步状态。",
    },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <RadioTower size={18} className="text-[#0E7490]" />
            API 联调事件台账
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            汇总承运商、平台、Webhook、自动任务和审计日志，让真实接口从“能调用”变成“可追踪、可复盘、可交接”。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800" href="/api/ops/reports/api-integration-events">
            <Download size={15} />
            导出台账
          </Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/reports/api-integration-events?format=json">
            <RotateCcw size={15} />
            查看 JSON
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">接口事件</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{webhookEvents.length + integrationLogs.length}</p>
        </div>
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-emerald-800">闭环完成</p>
          <p className="mt-1 text-xl font-semibold text-emerald-950">{closedEvents}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">失败/异常</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{failedWebhooks.length + riskyLogs.length}</p>
        </div>
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-800">处理中</p>
          <p className="mt-1 text-xl font-semibold text-amber-950">{processingWebhooks.length}</p>
        </div>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-cyan-800">承运商回调</p>
          <p className="mt-1 text-xl font-semibold text-cyan-950">{carrierWebhooks.length}</p>
        </div>
        <div className="rounded-md border border-violet-100 bg-violet-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-violet-800">平台回调</p>
          <p className="mt-1 text-xl font-semibold text-violet-950">{platformWebhooks.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={15} className={priorityRows.length > 0 ? "text-rose-700" : "text-emerald-700"} />
            优先处理
          </h3>
          <div className="mt-3 grid gap-2">
            {priorityRows.length > 0 ? (
              priorityRows.map((row) => (
                <div className="rounded-md bg-white p-3 text-xs text-slate-600" key={row.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">{row.title}</p>
                    {pill(row.label, row.tone)}
                  </div>
                  <p className="mt-1 text-slate-500">{row.meta}</p>
                  {row.detail ? <p className="mt-2 break-words text-slate-700">{row.detail}</p> : null}
                  <p className="mt-2 font-semibold text-cyan-800">下一步：{row.nextAction}</p>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                暂无接口失败、卡住或异常审计，当前闭环状态健康。
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-950">闭环能力</h3>
          <div className="mt-3 grid gap-2">
            {capabilityRows.map((row) => (
              <div className="rounded-md bg-white p-3 text-xs text-slate-600" key={row.title}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{row.title}</p>
                  {pill(row.done ? "已有记录" : "待真实事件", row.done ? "emerald" : "amber")}
                </div>
                <p className="mt-1 leading-5">{row.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-md border border-cyan-100 bg-white p-3 text-xs leading-5 text-cyan-900">
            生产接入新承运商或平台时，先在配置区补齐 API 地址、密钥和 webhook，再用这里确认是否形成“下单/同步-回调-审计-导出”的闭环证据。
          </p>
        </div>
      </div>
    </section>
  );
}
