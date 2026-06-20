"use client";

import { useState } from "react";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";

export function StaffLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; nextPath?: string };
      if (!response.ok) throw new Error(payload.message || "账号不在员工白名单内，或密码错误。");
      window.location.assign(payload.nextPath || "/ops");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后再试。");
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-950 p-5 text-white sm:p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
          <ShieldCheck size={16} />
          员工安全登录
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">员工白名单登录</h2>
      </div>
      <form className="grid gap-5 p-5 sm:p-6" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          账号
          <span className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 focus-within:border-[#0E7490]">
            <UserRound size={18} className="text-slate-400" />
            <input
              autoComplete="username"
              className="min-h-10 flex-1 bg-transparent text-base text-slate-950 outline-none"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入员工账号"
              value={username}
            />
          </span>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          密码
          <span className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 focus-within:border-[#0E7490]">
            <LockKeyhole size={18} className="text-slate-400" />
            <input
              autoComplete="current-password"
              className="min-h-10 flex-1 bg-transparent text-base text-slate-950 outline-none"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              type="password"
              value={password}
            />
          </span>
        </label>
        {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? "登录中..." : "登录运营后台"}
        </button>
      </form>
    </section>
  );
}
