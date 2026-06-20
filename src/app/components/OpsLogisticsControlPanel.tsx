"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Download, FileCheck2, GitBranch, PoundSterling, RadioTower, ShieldAlert, Upload, Wand2, type LucideIcon } from "lucide-react";
import { DocumentUploadPanel } from "./DocumentUploadPanel";
import type { DocumentRecord } from "@/lib/documentStore";
import type { CarrierServiceCode, CoreOutboundOrder, OutboundClaimStatus, OutboundDeliveryExceptionType, OutboundExceptionStatus } from "@/lib/warehouseCoreStore";

export type LogisticsControlRow = Pick<
  CoreOutboundOrder,
  | "id"
  | "customerCode"
  | "channel"
  | "status"
  | "labelStatus"
  | "trackingNumber"
  | "shippingFee"
  | "actualShippingFee"
  | "carrierName"
  | "carrierServiceName"
  | "trackingEvents"
  | "exceptions"
  | "updatedAt"
  | "createdAt"
> & {
  suggestedServiceCode: CarrierServiceCode;
  suggestedServiceName: string;
  riskLabels: string[];
};

type Props = {
  rows: LogisticsControlRow[];
  documents: DocumentRecord[];
};

const exceptionTypeOptions: Array<{ value: OutboundDeliveryExceptionType; label: string }> = [
  { value: "delivery_failed", label: "派送失败" },
  { value: "address_issue", label: "地址异常" },
  { value: "customer_absent", label: "收件人不在" },
  { value: "damaged", label: "运输破损" },
  { value: "lost", label: "疑似丢件" },
  { value: "return_to_sender", label: "退回仓库" },
  { value: "claim", label: "物流赔付" },
  { value: "proof_uploaded", label: "签收证明" },
  { value: "manual", label: "其他异常" },
];

const claimStatusOptions: Array<{ value: OutboundClaimStatus; label: string }> = [
  { value: "not_required", label: "无需赔付" },
  { value: "draft", label: "待整理材料" },
  { value: "submitted", label: "已提交承运商" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒赔" },
  { value: "paid", label: "已赔付到账" },
];

const exceptionStatusOptions: Array<{ value: OutboundExceptionStatus; label: string }> = [
  { value: "open", label: "待处理" },
  { value: "investigating", label: "处理中" },
  { value: "resolved", label: "已处理" },
  { value: "ignored", label: "已忽略" },
];

function money(value?: number) {
  return typeof value === "number" ? `£${value.toFixed(2)}` : "-";
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    pending_review: "待审核",
    picking: "拣货中",
    label_pending: "待面单",
    packing_check: "复核中",
    handover: "待交运",
    shipped: "已发货",
    blocked: "已阻塞",
    not_requested: "未申请",
    rated: "已计费",
    generated: "已生成",
    failed: "生成失败",
    open: "待处理",
    investigating: "处理中",
    resolved: "已处理",
    ignored: "已忽略",
  };
  return status ? labels[status] ?? status : "-";
}

export function OpsLogisticsControlPanel({ rows, documents }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const unmatched = rows.filter((row) => !row.trackingNumber && (!row.labelStatus || row.labelStatus === "not_requested" || row.labelStatus === "rated"));
  const exceptionRows = rows.filter((row) => row.riskLabels.length > 0 || (row.exceptions ?? []).some((item) => item.status === "open" || item.status === "investigating"));
  const feeDiffRows = rows.filter((row) => typeof row.shippingFee === "number" && typeof row.actualShippingFee === "number" && Math.abs(row.actualShippingFee - row.shippingFee) >= 1);
  const selectedOrder = rows.find((row) => row.id === selectedOrderId);
  const recentExceptions = useMemo(
    () =>
      rows
        .flatMap((row) =>
          (row.exceptions ?? []).map((exception) => ({
            ...exception,
            orderId: row.id,
            customerCode: row.customerCode,
            trackingNumber: row.trackingNumber,
          })),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [rows],
  );

  const metrics: Array<{ label: string; value: number; classes: string; icon: LucideIcon }> = [
    { label: "待匹配渠道", value: unmatched.length, classes: "border-amber-200 bg-amber-50 text-amber-800", icon: GitBranch },
    { label: "物流风险", value: exceptionRows.length, classes: "border-rose-200 bg-rose-50 text-rose-800", icon: AlertTriangle },
    { label: "费用差异", value: feeDiffRows.length, classes: "border-cyan-200 bg-cyan-50 text-cyan-800", icon: PoundSterling },
    { label: "已有追踪号", value: rows.filter((row) => row.trackingNumber).length, classes: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: RadioTower },
  ];

  function matchAll() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/logistics/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unmatched.map((row) => row.id) }),
      });
      const payload = (await response.json().catch(() => ({}))) as { updated?: unknown[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "物流匹配失败，请稍后重试。");
        return;
      }
      setMessage(`已匹配 ${payload.updated?.length ?? 0} 张出库单，运费与推荐渠道已写入。`);
      router.refresh();
    });
  }

  function uploadTrackingCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage("");
    setError("");
    startTransition(async () => {
      const csv = await file.text();
      const response = await fetch("/api/ops/logistics/tracking-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { updated?: number; skipped?: number; exceptionsCreated?: number; errors?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "追踪号上传失败，请检查模板格式。");
        return;
      }
      const errors = payload.errors ?? [];
      setMessage(`已回传 ${payload.updated ?? 0} 条轨迹，自动生成 ${payload.exceptionsCreated ?? 0} 条异常/签收证明工单，${payload.skipped ?? 0} 行需要复核。`);
      setError(errors.length > 0 ? errors.slice(0, 4).join("；") : "");
      router.refresh();
    });
  }

  function submitDeliveryException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const orderId = String(data.get("orderId") || "");
    if (!orderId) {
      setError("请选择需要处理的出库单。");
      return;
    }

    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/outbounds/${encodeURIComponent(orderId)}/delivery-exception`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exceptionType: data.get("exceptionType"),
          message: data.get("message"),
          severity: data.get("severity"),
          redeliveryRequired: data.get("redeliveryRequired") === "on",
          redeliveryNote: data.get("redeliveryNote"),
          proofUrl: data.get("proofUrl"),
          claimAmount: data.get("claimAmount"),
          claimStatus: data.get("claimStatus"),
          claimNote: data.get("claimNote"),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "物流异常提交失败，请稍后重试。");
        return;
      }
      form.reset();
      setSelectedOrderId("");
      setMessage("物流异常已写入出库单，客户侧轨迹和运营风险会同步更新。");
      router.refresh();
    });
  }

  function updateDeliveryException(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const exceptionId = String(data.get("exceptionId") || "");
    if (!exceptionId) {
      setError("请选择需要更新的异常记录。");
      return;
    }

    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/ops/outbounds/${encodeURIComponent(orderId)}/delivery-exception`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exceptionId,
          status: data.get("status"),
          claimStatus: data.get("claimStatus"),
          claimAmount: data.get("claimAmount"),
          claimNote: data.get("claimNote"),
          note: data.get("note"),
          proofUrl: data.get("proofUrl"),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "物流异常更新失败，请检查审批原因和附件。");
        return;
      }
      setMessage("物流异常和赔付状态已更新，客户侧轨迹与运营报表会同步刷新。");
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <GitBranch size={18} className="text-[#0E7490]" />
            物流规则、面单与轨迹回传
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">集中处理渠道匹配、运费核对、追踪号导入、派送失败、改派、签收证明和赔付记录。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => window.location.assign("/api/ops/logistics/tracking-upload")} type="button">
            <Download size={16} />
            下载追踪号模板
          </button>
          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100">
            <Upload size={16} />
            上传追踪号 CSV
            <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={uploadTrackingCsv} type="file" />
          </label>
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || unmatched.length === 0} onClick={matchAll} type="button">
            <Wand2 size={16} />
            一键匹配待处理
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-4">
        {metrics.map(({ label, value, classes, icon: Icon }) => (
          <div className={`rounded-md border p-3 ${classes}`} key={label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold">{label}</p>
              <Icon size={16} />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 border-t border-slate-200 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <form className="rounded-md border border-slate-200 bg-slate-50 p-4" onSubmit={submitDeliveryException}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-700" />
            <h3 className="text-sm font-semibold text-slate-950">派送异常处理</h3>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              出库单
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500"
                name="orderId"
                onChange={(event) => setSelectedOrderId(event.target.value)}
                required
                value={selectedOrderId}
              >
                <option value="">请选择</option>
                {rows.slice(0, 80).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.id} / {row.customerCode} / {statusLabel(row.status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              异常类型
              <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" name="exceptionType">
                {exceptionTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              严重程度
              <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" name="severity">
                <option value="critical">阻塞发货/需处理</option>
                <option value="warning">记录提醒</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              赔付状态
              <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" name="claimStatus">
                {claimStatusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="md:col-span-2 text-xs font-semibold text-slate-600">
              异常说明
              <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500" name="message" placeholder="例如：承运商反馈收件地址不完整，已联系客户补充门牌号。" required />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <input className="h-4 w-4 rounded border-slate-300 text-cyan-700" name="redeliveryRequired" type="checkbox" />
              需要改派/重新派送
            </label>
            <label className="text-xs font-semibold text-slate-600">
              预计赔付金额
              <input className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" min="0" name="claimAmount" placeholder="例如：12.50" step="0.01" type="number" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              改派说明
              <input className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" name="redeliveryNote" placeholder="新地址、预约时间或联系人" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              签收证明链接
              <input className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" name="proofUrl" placeholder="POD 图片或文件链接" />
            </label>
            <label className="md:col-span-2 text-xs font-semibold text-slate-600">
              赔付/处理备注
              <input className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500" name="claimNote" placeholder="材料、承运商工单号、客户沟通结论" />
            </label>
          </div>
          {selectedOrder ? (
            <DocumentUploadPanel
              category="other"
              customerCode={selectedOrder.customerCode}
              documents={documents.filter((item) => item.refType === "approval" && item.refId === `claim:${selectedOrder.id}`)}
              refId={`claim:${selectedOrder.id}`}
              refType="approval"
              title="赔付审批附件"
              uploadEndpoint="/api/ops/documents"
            />
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">选择出库单后，可先上传赔付截图、承运商邮件、POD 或客户确认记录。若审批规则要求附件，需上传后再提交赔付。</p>
          )}
          <button className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} type="submit">
            <FileCheck2 size={16} />
            写入物流异常
          </button>
        </form>

        <div className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={18} className="text-amber-700" />
            最近异常记录
          </h3>
          <div className="mt-3 space-y-2">
            {recentExceptions.length > 0 ? (
              recentExceptions.map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-slate-900">{item.orderId}</p>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{statusLabel(item.status)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.customerCode} / {item.trackingNumber || "暂无追踪号"} / {new Date(item.createdAt).toLocaleString("zh-CN")}
                  </p>
                  {item.workOrderId ? <p className="mt-1 font-mono text-xs font-semibold text-cyan-700">客户工单：{item.workOrderId}</p> : null}
                  {item.claimAmount ? <p className="mt-1 text-xs font-semibold text-rose-700">赔付：£{item.claimAmount.toFixed(2)} / {statusLabel(item.claimStatus)}</p> : null}
                  {item.redeliveryRequired ? <p className="mt-1 text-xs font-semibold text-cyan-700">改派：{item.redeliveryNote || "待补充"}</p> : null}
                  {item.proofUrl ? <p className="mt-1 text-xs font-semibold text-emerald-700">已关联签收证明</p> : null}
                  <form className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-white p-3" onSubmit={(event) => updateDeliveryException(event, item.orderId)}>
                    <input name="exceptionId" type="hidden" value={item.id} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        异常状态
                        <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500" defaultValue={item.status} name="status">
                          {exceptionStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        赔付状态
                        <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500" defaultValue={item.claimStatus ?? "not_required"} name="claimStatus">
                          {claimStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        赔付金额
                        <input className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" defaultValue={item.claimAmount ?? ""} min="0" name="claimAmount" step="0.01" type="number" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        签收证明链接
                        <input className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" defaultValue={item.proofUrl ?? ""} name="proofUrl" placeholder="POD 或承运商链接" />
                      </label>
                    </div>
                    <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" defaultValue={item.claimNote ?? ""} name="claimNote" placeholder="赔付审批原因/承运商工单号" />
                    <input className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500" name="note" placeholder="本次处理说明，例如：承运商已确认赔付" />
                    <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-fit" disabled={isPending} type="submit">
                      <FileCheck2 size={14} />
                      更新异常/赔付
                    </button>
                  </form>
                  {item.claimAmount || ["submitted", "approved", "paid"].includes(item.claimStatus ?? "") ? (
                    <DocumentUploadPanel
                      category="other"
                      customerCode={item.customerCode}
                      documents={documents.filter((document) => document.refType === "approval" && document.refId === `claim:${item.id}`)}
                      refId={`claim:${item.id}`}
                      refType="approval"
                      title="异常赔付补充附件"
                      uploadEndpoint="/api/ops/documents"
                    />
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">暂无物流异常记录。</p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-slate-200">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">出库单</th>
              <th className="px-4 py-3">当前渠道</th>
              <th className="px-4 py-3">规则推荐</th>
              <th className="px-4 py-3">追踪</th>
              <th className="px-4 py-3">费用</th>
              <th className="px-4 py-3">风险</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.slice(0, 10).map((row) => {
              const diff = typeof row.shippingFee === "number" && typeof row.actualShippingFee === "number" ? row.actualShippingFee - row.shippingFee : null;
              const latestTracking = row.trackingEvents?.[0];
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-950">{row.id}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.customerCode} / {statusLabel(row.status)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{row.carrierName || row.channel || "-"}</p>
                    <p className="mt-1 text-xs text-slate-400">{row.carrierServiceName || statusLabel(row.labelStatus)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{row.suggestedServiceName}</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">{row.suggestedServiceCode}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{row.trackingNumber || "未生成"}</p>
                    <p className="mt-1 text-xs text-slate-400">{latestTracking ? `${latestTracking.label} / ${latestTracking.detail || ""}` : statusLabel(row.labelStatus)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>
                      预计 {money(row.shippingFee)} / 实际 {money(row.actualShippingFee)}
                    </p>
                    {diff !== null ? <p className={`mt-1 text-xs font-semibold ${Math.abs(diff) >= 1 ? "text-rose-700" : "text-emerald-700"}`}>差异 £{diff.toFixed(2)}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.riskLabels.length > 0 ? (
                        row.riskLabels.map((risk) => (
                          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800" key={`${row.id}-${risk}`}>
                            {risk}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">正常</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {message ? <p className="mx-4 mb-4 mt-4 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mx-4 mb-4 mt-4 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}
