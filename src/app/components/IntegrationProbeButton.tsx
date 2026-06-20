"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Radar } from "lucide-react";

export function IntegrationProbeButton({ itemId, disabled }: { itemId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function runProbe() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/integrations/probes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "集成探测失败，请稍后重试。");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <button
        className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isPending}
        onClick={runProbe}
        type="button"
      >
        {isPending ? <Loader2 className="animate-spin" size={13} /> : <Radar size={13} />}
        执行探测
      </button>
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
