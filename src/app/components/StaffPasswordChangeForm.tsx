"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";

const inputClass = "min-h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";

export function StaffPasswordChangeForm() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setNotice("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/staff-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(formData.get("currentPassword") ?? ""),
          newPassword: String(formData.get("newPassword") ?? ""),
          confirmPassword: String(formData.get("confirmPassword") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "密码修改失败，请稍后重试");
        return;
      }
      setNotice("密码已更新，下次登录请使用新密码");
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <KeyRound size={16} />
        修改密码
      </button>
      {open ? (
        <form action={submit} className="absolute left-0 top-12 z-40 grid w-[min(22rem,calc(100vw-2rem))] gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-xl">
          <div>
            <p className="font-semibold text-slate-950">员工密码</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">仅正式员工账号可自助修改，白名单账号需要在环境变量里维护。</p>
          </div>
          <input autoComplete="current-password" className={inputClass} name="currentPassword" placeholder="当前密码" required type="password" />
          <input autoComplete="new-password" className={inputClass} minLength={8} name="newPassword" placeholder="新密码，至少 8 位" required type="password" />
          <input autoComplete="new-password" className={inputClass} minLength={8} name="confirmPassword" placeholder="确认新密码" required type="password" />
          <div className="flex gap-2">
            <button
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {isPending ? <Loader2 className="animate-spin" size={14} /> : null}
              保存
            </button>
            <button className="min-h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setOpen(false)} type="button">
              取消
            </button>
          </div>
          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
        </form>
      ) : null}
      {notice ? <p className="mt-2 text-xs font-semibold text-emerald-700">{notice}</p> : null}
    </div>
  );
}
