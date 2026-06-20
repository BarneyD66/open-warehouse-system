"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";

export function CustomerReturnTrackingPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [buyerReturnTracking, setBuyerReturnTracking] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/returns/${orderId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerReturnTracking, expectedArrivalDate, customerNote }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "追踪号补充失败，请稍后再试");
        return;
      }
      setMessage("退货追踪号已补充，仓库到仓后会按此信息识别。");
      setBuyerReturnTracking("");
      setExpectedArrivalDate("");
      setCustomerNote("");
      router.refresh();
    });
  }

  return (
    <form className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3" onSubmit={submit}>
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
        <Truck size={14} />
        补充退货追踪号
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          className="h-9 rounded-md border border-amber-200 bg-white px-2 text-sm outline-none focus:border-amber-500"
          onChange={(event) => setBuyerReturnTracking(event.target.value)}
          placeholder="买家退货追踪号"
          required
          value={buyerReturnTracking}
        />
        <input
          className="h-9 rounded-md border border-amber-200 bg-white px-2 text-sm outline-none focus:border-amber-500"
          onChange={(event) => setExpectedArrivalDate(event.target.value)}
          type="date"
          value={expectedArrivalDate}
        />
      </div>
      <input
        className="mt-2 h-9 w-full rounded-md border border-amber-200 bg-white px-2 text-sm outline-none focus:border-amber-500"
        onChange={(event) => setCustomerNote(event.target.value)}
        placeholder="备注，可填写平台退货原因、包裹数量或寄件说明"
        value={customerNote}
      />
      <button className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? <Loader2 className="animate-spin" size={14} /> : <Truck size={14} />}
        保存追踪号
      </button>
      {message ? <p className="mt-2 text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </form>
  );
}
