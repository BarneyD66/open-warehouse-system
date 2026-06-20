"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Eye, FileUp, Paperclip } from "lucide-react";
import type { DocumentCategory, DocumentRecord, DocumentRefType } from "@/lib/documentStore";
import { documentScanStatusLabel, documentStorageProviderLabel } from "@/lib/documentLabels";

type Props = {
  refType: DocumentRefType;
  refId: string;
  category: DocumentCategory;
  title: string;
  documents: DocumentRecord[];
  uploadEndpoint?: string;
  customerCode?: string;
};

function fileSizeLabel(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${size} B`;
}

function scanBadgeClass(status: DocumentRecord["scanStatus"]) {
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "clean") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function DocumentUploadPanel({ refType, refId, category, title, documents, uploadEndpoint = "/api/documents", customerCode }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function upload() {
    const file = fileRef.current?.files?.[0];
    setError("");
    if (!file) {
      setError("请选择要上传的文件。");
      return;
    }

    startTransition(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("refType", refType);
      form.set("refId", refId);
      form.set("category", category);
      form.set("note", note);
      if (customerCode) form.set("customerCode", customerCode);

      const response = await fetch(uploadEndpoint, { method: "POST", body: form });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "上传失败，请稍后重试。");
        return;
      }

      if (fileRef.current) fileRef.current.value = "";
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Paperclip size={15} className="text-[#0E7490]" />
        {title}
      </div>
      <div className="mt-3 grid gap-2">
        <input
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
          ref={fileRef}
          type="file"
        />
        <input
          className="min-h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500"
          onChange={(event) => setNote(event.target.value)}
          placeholder="文件说明，可选"
          value={note}
        />
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60 sm:w-fit"
          disabled={isPending}
          onClick={upload}
          type="button"
        >
          <FileUp size={16} />
          上传文件
        </button>
        {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>
      <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-100 bg-slate-50">
        {documents.length > 0 ? (
          documents.map((item) => (
            <div className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between" key={item.id}>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">{item.originalName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {fileSizeLabel(item.size)} / {new Date(item.uploadedAt).toLocaleDateString("zh-CN")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${scanBadgeClass(item.scanStatus)}`}>
                    {documentScanStatusLabel(item.scanStatus)}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {documentStorageProviderLabel(item.storageProvider)}
                  </span>
                </div>
                {item.scanStatus === "blocked" && item.scanNote ? <p className="mt-1 text-xs font-semibold text-rose-700">{item.scanNote}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.previewAllowed && item.scanStatus === "clean" ? (
                  <Link className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/api/documents/${item.id}/preview`} target="_blank">
                    <Eye size={13} />
                    预览
                  </Link>
                ) : null}
                {item.scanStatus === "clean" ? (
                  <Link className="inline-flex min-h-8 items-center rounded-md border border-cyan-200 bg-cyan-50 px-2.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href={`/api/documents/${item.id}/download`}>
                    下载
                  </Link>
                ) : (
                  <span className="inline-flex min-h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800">待安全放行</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-3 py-4 text-center text-sm text-slate-500">暂无文件</div>
        )}
      </div>
    </div>
  );
}
