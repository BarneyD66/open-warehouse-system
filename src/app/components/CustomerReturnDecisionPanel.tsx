"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

type ReturnResolution = "restock" | "repair" | "dispose" | "reship";

const options: Array<{ value: ReturnResolution; label: string; hint: string }> = [
  { value: "restock", label: "同意重新上架", hint: "商品可继续销售，入回可售库存。" },
  { value: "repair", label: "同意维修翻新", hint: "需要仓库继续处理后再确认。" },
  { value: "dispose", label: "同意报废销毁", hint: "不可售商品按仓库规则处理。" },
  { value: "reship", label: "要求转寄", hint: "请在备注里写清楚转寄地址或要求。" },
];

export function CustomerReturnDecisionPanel({
  orderId,
  currentDecision,
  disabled,
}: {
  orderId: string;
  currentDecision?: ReturnResolution;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [resolution, setResolution] = useState<ReturnResolution>(currentDecision ?? "restock");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/returns/${orderId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, note }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "确认失败，请稍后再试");
        return;
      }
      setMessage("已提交处理方式，运营会按您的确认继续处理。");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form className="mt-3 rounded-md border border-cyan-100 bg-cyan-50 p-3" onSubmit={submit}>
      <div className="flex items-center gap-2 text-xs font-semibold text-cyan-900">
        <CheckCircle2 size={14} />
        确认退货处理方式
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((item) => (
          <label className={`cursor-pointer rounded-md border bg-white p-2 text-xs ${resolution === item.value ? "border-cyan-400 text-cyan-950" : "border-slate-200 text-slate-600"}`} key={item.value}>
            <span className="flex items-center gap-2 font-semibold">
              <input checked={resolution === item.value} disabled={disabled || isPending} onChange={() => setResolution(item.value)} type="radio" />
              {item.label}
            </span>
            <span className="mt-1 block leading-5">{item.hint}</span>
          </label>
        ))}
      </div>
      <textarea
        className="mt-2 min-h-16 w-full rounded-md border border-cyan-100 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
        disabled={disabled || isPending}
        onChange={(event) => setNote(event.target.value)}
        placeholder="补充说明，例如转寄地址、可接受维修方式或报废确认备注。"
        value={note}
      />
      <button className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md bg-cyan-900 px-3 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled || isPending} type="submit">
        {isPending ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
        提交确认
      </button>
      {message ? <p className="mt-2 text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </form>
  );
}
