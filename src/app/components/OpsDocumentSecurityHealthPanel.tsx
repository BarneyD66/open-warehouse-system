"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database, Download, FileWarning, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DocumentSecurityActions } from "./DocumentSecurityActions";
import type { AuditLogRecord } from "@/lib/auditLogStore";
import type { DocumentRecord } from "@/lib/documentStore";

type Props = {
  documents: DocumentRecord[];
  auditLogs?: AuditLogRecord[];
};

type ScanStatus = NonNullable<DocumentRecord["scanStatus"]>;

function scanStatusLabel(status?: DocumentRecord["scanStatus"]) {
  if (status === "clean") return "已通过";
  if (status === "blocked") return "已拦截";
  return "待扫描";
}

function storageProviderLabel(provider?: DocumentRecord["storageProvider"]) {
  if (provider === "object") return "对象存储";
  if (provider === "postgres") return "数据库存储";
  return "本地临时存储";
}

function categoryLabel(category: DocumentRecord["category"]) {
  const labels: Record<DocumentRecord["category"], string> = {
    exception_photo: "异常照片",
    invoice: "发票资料",
    label: "面单文件",
    other: "其他资料",
    packing_list: "装箱单",
    payment_proof: "付款凭证",
  };
  return labels[category] ?? category;
}

function refTypeLabel(refType: DocumentRecord["refType"]) {
  const labels: Record<DocumentRecord["refType"], string> = {
    approval: "审批",
    billing: "账单",
    general: "通用",
    inbound: "入库",
    inquiry: "询盘",
    logistics: "物流",
    outbound: "出库",
    return: "退货",
    sku: "SKU",
  };
  return labels[refType] ?? refType;
}

function fileSizeText(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function dedupeDocuments(rows: DocumentRecord[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function riskReason(row: DocumentRecord) {
  const reasons = [
    !row.scanStatus || row.scanStatus === "pending" ? "等待安全扫描" : "",
    row.scanStatus === "blocked" ? "已被安全拦截" : "",
    row.storageProvider !== "object" ? "尚未进入对象存储" : "",
    row.size >= 10 * 1024 * 1024 ? "大文件需要重点巡检" : "",
    row.scanStatus === "clean" && !row.previewAllowed ? "仅可下载不可预览" : "",
  ].filter(Boolean);
  return reasons;
}

function topCustomerRisks(rows: DocumentRecord[]) {
  const map = new Map<string, { customerCode: string; total: number; blocked: number; pending: number; local: number }>();
  rows.forEach((row) => {
    const current = map.get(row.customerCode) ?? { customerCode: row.customerCode, total: 0, blocked: 0, pending: 0, local: 0 };
    current.total += 1;
    if (row.scanStatus === "blocked") current.blocked += 1;
    if (!row.scanStatus || row.scanStatus === "pending") current.pending += 1;
    if (row.storageProvider !== "object") current.local += 1;
    map.set(row.customerCode, current);
  });
  return [...map.values()].sort((a, b) => b.blocked - a.blocked || b.pending - a.pending || b.local - a.local || b.total - a.total);
}

function auditPayload(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function OpsDocumentSecurityHealthPanel({ documents, auditLogs = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pendingDocs = documents.filter((row) => !row.scanStatus || row.scanStatus === "pending");
  const blockedDocs = documents.filter((row) => row.scanStatus === "blocked");
  const cleanDocs = documents.filter((row) => row.scanStatus === "clean");
  const objectDocs = documents.filter((row) => row.storageProvider === "object");
  const localDocs = documents.filter((row) => row.storageProvider !== "object");
  const largeDocs = documents.filter((row) => row.size >= 10 * 1024 * 1024);
  const notPreviewableCleanDocs = cleanDocs.filter((row) => !row.previewAllowed);
  const riskRows = dedupeDocuments([...blockedDocs, ...pendingDocs, ...localDocs, ...largeDocs, ...notPreviewableCleanDocs]).sort((a, b) => {
    const score = (row: DocumentRecord) =>
      (row.scanStatus === "blocked" ? 50 : 0) +
      (!row.scanStatus || row.scanStatus === "pending" ? 30 : 0) +
      (row.storageProvider !== "object" ? 12 : 0) +
      (row.size >= 10 * 1024 * 1024 ? 8 : 0) +
      (row.scanStatus === "clean" && !row.previewAllowed ? 4 : 0);
    return score(b) - score(a) || new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  });
  const customerRisks = topCustomerRisks(riskRows).slice(0, 4);
  const cleanRate = documents.length > 0 ? Math.round((cleanDocs.length / documents.length) * 100) : 100;
  const objectRate = documents.length > 0 ? Math.round((objectDocs.length / documents.length) * 100) : 100;
  const rejectedUploads = auditLogs.filter((log) => log.action === "document_upload_rejected").slice(0, 5);

  function runPendingRescan() {
    setMessage("");
    setError("");
    const targets = pendingDocs.slice(0, 20);
    if (targets.length === 0) {
      setMessage("当前没有待扫描文件。");
      return;
    }
    startTransition(async () => {
      let success = 0;
      let failed = 0;
      for (const row of targets) {
        const response = await fetch(`/api/ops/documents/${encodeURIComponent(row.id)}/security`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rescan" }),
        });
        if (response.ok) success += 1;
        else failed += 1;
      }
      if (failed > 0) setError(`批量复扫已完成 ${success} 个，失败 ${failed} 个，请查看文件安全台账继续处理。`);
      else setMessage(`批量复扫已完成 ${success} 个待扫描文件。`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ShieldCheck size={18} className="text-[#0E7490]" />
            文件安全与对象存储巡检
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">集中检查客户资料、账单附件、面单、异常照片的扫描状态、对象存储覆盖率、预览权限和大文件风险。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending || pendingDocs.length === 0} onClick={runPendingRescan} type="button">
            <RefreshCw size={15} />
            批量复扫待扫描
          </button>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/reports/documents-security">
            <Download size={15} />
            导出安全台账
          </Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100" href="/api/ops/reports/documents-security?scanStatus=pending">
            <FileWarning size={15} />
            导出待处理
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">文件总数</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{documents.length}</p>
        </div>
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-emerald-800">扫描通过率</p>
          <p className="mt-1 text-xl font-semibold text-emerald-950">{cleanRate}%</p>
        </div>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-cyan-800">对象存储覆盖</p>
          <p className="mt-1 text-xl font-semibold text-cyan-950">{objectRate}%</p>
        </div>
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-800">待扫描</p>
          <p className="mt-1 text-xl font-semibold text-amber-950">{pendingDocs.length}</p>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-700">已拦截</p>
          <p className="mt-1 text-xl font-semibold text-rose-950">{blockedDocs.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-600">本地/数据库存储</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{localDocs.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={15} className="text-amber-700" />
            待处理文件队列
          </h3>
          <div className="mt-3 grid gap-2">
            {riskRows.slice(0, 8).map((row) => {
              const reasons = riskReason(row);
              const scanTone = row.scanStatus === "blocked" ? "text-rose-700" : !row.scanStatus || row.scanStatus === "pending" ? "text-amber-800" : "text-slate-600";
              return (
                <div className="grid gap-3 rounded-md bg-white p-3 lg:grid-cols-[minmax(0,1fr)_auto]" key={row.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="max-w-sm truncate text-sm font-semibold text-slate-950">{row.originalName}</p>
                      <span className={`rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold ${scanTone}`}>{scanStatusLabel(row.scanStatus)}</span>
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">{storageProviderLabel(row.storageProvider)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{row.customerCode} / {refTypeLabel(row.refType)} {row.refId} / {categoryLabel(row.category)} / {fileSizeText(row.size)}</p>
                    <p className="mt-1 text-xs text-slate-500">上传：{row.uploadedByRole === "customer" ? "客户" : "员工"} {row.uploadedBy} / {formatDateTime(row.uploadedAt)}</p>
                    {row.scanNote ? <p className="mt-2 text-xs font-semibold leading-5 text-rose-700">{row.scanNote}</p> : null}
                    {reasons.length > 0 ? <p className="mt-2 text-xs leading-5 text-slate-600">{reasons.join("、")}</p> : null}
                  </div>
                  <DocumentSecurityActions documentId={row.id} scanStatus={row.scanStatus as ScanStatus | undefined} />
                </div>
              );
            })}
            {riskRows.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                当前文件扫描、下载和存储巡检暂无明显风险。
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Database size={15} className="text-cyan-700" />
            客户资料风险分布
          </h3>
          <div className="mt-3 grid gap-2">
            {customerRisks.map((row) => (
              <div className="rounded-md bg-white p-3 text-xs text-slate-600" key={row.customerCode}>
                <p className="font-mono font-semibold text-slate-950">{row.customerCode}</p>
                <p className="mt-1">风险文件 {row.total} 个 / 待扫描 {row.pending} / 已拦截 {row.blocked} / 非对象存储 {row.local}</p>
              </div>
            ))}
            {customerRisks.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无客户资料风险。</p> : null}
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
            <p className="font-semibold text-slate-950">巡检口径</p>
            <p className="mt-1">待扫描、拦截文件、非对象存储、大文件、不可预览文件都会进入队列；正式生产建议继续接入对象存储、病毒扫描和安全下载链接。</p>
          </div>
          <div className="mt-3 rounded-md border border-rose-100 bg-white p-3">
            <p className="text-sm font-semibold text-slate-950">最近拒绝上传</p>
            <div className="mt-2 grid gap-2">
              {rejectedUploads.map((log) => {
                const payload = auditPayload(log.after);
                return (
                  <div className="rounded-md bg-rose-50 p-2 text-xs leading-5 text-rose-900" key={log.id}>
                    <p className="font-semibold">{String(payload.originalName || log.targetId)}</p>
                    <p>{log.customerCode || "未绑定客户"} / {String(payload.refType || "-")} {String(payload.refId || "-")} / {formatDateTime(log.createdAt)}</p>
                    <p className="text-rose-700">{log.note || log.summary}</p>
                  </div>
                );
              })}
              {rejectedUploads.length === 0 ? <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-500">暂无被拒绝的文件上传记录。</p> : null}
            </div>
          </div>
        </div>
      </div>

      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </section>
  );
}
