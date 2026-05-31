"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, HelpCircle, Loader2, MessageSquareText } from "lucide-react";
import type { InquiryQuoteResponse } from "@/lib/localStore";

type QuoteResponsePanelProps = {
  inquiryId: string;
  quoteResponse?: InquiryQuoteResponse;
};

export function QuoteResponsePanel({ inquiryId, quoteResponse }: QuoteResponsePanelProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [message, setMessage] = useState(quoteResponse?.message ?? "");
  const [submitting, setSubmitting] = useState<"accepted" | "question" | "">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (!mounted) return null;

  async function submit(decision: "accepted" | "question") {
    setSubmitting(decision);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`/api/inquiries/${encodeURIComponent(inquiryId)}/quote-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, message }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "提交失败，请稍后再试。");
      setNotice(decision === "accepted" ? "报价已确认，下一步可以创建入库预报。" : "问题已提交，客服会继续核对并回复。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后再试。");
    } finally {
      setSubmitting("");
    }
  }

  const accepted = quoteResponse?.decision === "accepted";
  const questioned = quoteResponse?.decision === "question";

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid gap-0 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <MessageSquareText size={16} className="text-[#0E7490]" />
            报价反馈
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">确认后系统会记录到时间线；如有疑问，客服会按服务项目、SKU、尺寸重量和尾程渠道继续核对。</p>
          {quoteResponse ? (
            <div className={`mt-4 rounded-md border p-3 text-sm leading-6 ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-semibold">{accepted ? "已确认报价" : "已提交报价问题"}</p>
              {quoteResponse.message ? <p className="mt-1">{quoteResponse.message}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 p-4">
          <textarea
            className="min-h-20 w-full rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-[#0E7490]"
            disabled={Boolean(submitting)}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="如有疑问，可写明费用项、SKU、箱规、尾程渠道、有效期或账单口径。"
            value={message}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(submitting)}
              onClick={() => submit("accepted")}
              type="button"
            >
              {submitting === "accepted" ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              确认报价
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(submitting)}
              onClick={() => submit("question")}
              type="button"
            >
              {submitting === "question" ? <Loader2 className="animate-spin" size={16} /> : <HelpCircle size={16} />}
              提出疑问
            </button>
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-[#0E7490]" href="/inbound">
              创建入库预报 <ArrowRight size={16} />
            </Link>
          </div>
          {notice ? <p className="text-sm font-semibold text-emerald-700">{notice}</p> : null}
          {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
          {questioned ? <p className="text-xs leading-5 text-slate-500">已提交的问题会进入客服跟进队列，后续回复会继续显示在进度时间线。</p> : null}
        </div>
      </div>
    </div>
  );
}
