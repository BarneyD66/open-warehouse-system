"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, MessageSquarePlus, Send, TicketCheck } from "lucide-react";
import type { CustomerWorkOrder } from "@/lib/opsExpansionStore";

type Props = {
  categories: string[];
  workOrders: CustomerWorkOrder[];
};

const inputClass = "min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const textareaClass = "min-h-24 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";

const statusLabel: Record<CustomerWorkOrder["status"], string> = {
  open: "待运营处理",
  processing: "处理中",
  waiting_customer: "待客户补充",
  resolved: "已解决",
  cancelled: "已取消",
};

const statusTone: Record<CustomerWorkOrder["status"], string> = {
  open: "border-amber-200 bg-amber-50 text-amber-800",
  processing: "border-cyan-200 bg-cyan-50 text-cyan-800",
  waiting_customer: "border-violet-200 bg-violet-50 text-violet-800",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
};

function cleanParam(value: string | null) {
  return value?.trim() || "";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: CustomerWorkOrder["status"] }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusTone[status]}`}>{statusLabel[status]}</span>;
}

export function CustomerWorkOrderPanel({ categories, workOrders }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const initialCategory = useMemo(() => cleanParam(searchParams.get("workOrderCategory")) || categories[0] || "资料补充", [categories, searchParams]);
  const [category, setCategory] = useState(initialCategory);
  const initialTitle = cleanParam(searchParams.get("workOrderTitle"));
  const initialReference = cleanParam(searchParams.get("workOrderRef"));
  const initialDescription = cleanParam(searchParams.get("workOrderDescription"));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = Object.fromEntries(form.entries());
    startTransition(async () => {
      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "工单提交失败，请稍后重试。");
        return;
      }
      formElement.reset();
      setCategory(categories[0] || "资料补充");
      setMessage("工单已提交，运营会在后台继续处理。");
      router.refresh();
    });
  }

  function reply(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setMessage("");
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get("body") ?? "").trim();
    if (!body) {
      setError("请填写回复内容。");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_message", id, body }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "回复失败，请稍后重试。");
        return;
      }
      formElement.reset();
      setMessage("回复已提交，运营会继续处理。");
      router.refresh();
    });
  }

  const visibleOrders = workOrders.slice(0, 5);

  return (
    <section className="rounded-lg border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]" id="work-orders">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-5">
        <div>
          <p className="text-[11px] font-semibold text-cyan-700">工单</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">自助工单与售后沟通</h2>
        </div>
        <TicketCheck size={18} className="text-slate-400" />
      </div>
      <div className="grid gap-5 p-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={submit}>
          <div className="flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-cyan-700" />
            <h3 className="text-sm font-semibold text-slate-950">提交新工单</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="工单类型">
              <select className={inputClass} name="category" onChange={(event) => setCategory(event.target.value)} value={category}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="优先级">
              <select className={inputClass} name="priority" defaultValue="normal">
                <option value="normal">正常</option>
                <option value="urgent">紧急</option>
              </select>
            </Field>
          </div>
          <Field label="标题">
            <input className={inputClass} defaultValue={initialTitle} name="title" placeholder="例如：某票派送失败需要改派" required />
          </Field>
          <Field label="关联单号">
            <input className={inputClass} defaultValue={initialReference} name="referenceNo" placeholder="可填入库单、出库单、追踪号或账单号" />
          </Field>
          <Field label="问题说明">
            <textarea className={textareaClass} defaultValue={initialDescription} name="description" placeholder="请写清楚问题、期望处理方式、相关平台订单号或 SKU。" required />
          </Field>
          <Field label="联系方式">
            <input className={inputClass} name="customerContact" placeholder="微信、手机号或邮箱，方便运营联系" />
          </Field>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} type="submit">
            <Send size={16} />
            提交工单
          </button>
          {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
          {error ? <p className="rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        </form>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">最近工单进度</h3>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{workOrders.length} 条</span>
          </div>
          <div className="mt-3 grid gap-2">
            {visibleOrders.length > 0 ? (
              visibleOrders.map((item) => (
                <article className="rounded-lg border border-slate-200 bg-white p-3" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                      <h4 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h4>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.category}{item.referenceNo ? ` / ${item.referenceNo}` : ""}</p>
                  {item.internalNote ? <p className="mt-2 rounded-md bg-cyan-50 p-2 text-xs leading-5 text-cyan-900">运营备注：{item.internalNote}</p> : null}
                  {(item.messages ?? []).filter((note) => note.visibleToCustomer).length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {(item.messages ?? [])
                        .filter((note) => note.visibleToCustomer)
                        .slice(-3)
                        .map((note) => (
                          <div className={`rounded-md border p-2 text-xs leading-5 ${note.authorRole === "customer" ? "border-slate-200 bg-slate-50 text-slate-600" : "border-cyan-100 bg-cyan-50 text-cyan-900"}`} key={note.id}>
                            <p className="font-semibold">{note.authorRole === "customer" ? "我" : note.authorName} · {new Date(note.createdAt).toLocaleString("zh-CN")}</p>
                            <p className="mt-1">{note.body}</p>
                          </div>
                        ))}
                    </div>
                  ) : null}
                  {item.status !== "resolved" && item.status !== "cancelled" ? (
                    <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => reply(event, item.id)}>
                      <input className={inputClass} name="body" placeholder="继续补充说明或回复运营" />
                      <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60" disabled={isPending} type="submit">
                        <Send size={15} />
                        回复
                      </button>
                    </form>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <AlertTriangle className="mx-auto text-slate-400" size={18} />
                <p className="mt-2 text-sm text-slate-500">暂无工单，有物流异常、库存调整、账单争议时可在这里提交。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
