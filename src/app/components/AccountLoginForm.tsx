"use client";

import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { useState } from "react";

export function AccountLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/login", {
      body: JSON.stringify({ username: username.trim(), password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setSubmitting(false);
      setError("登录失败，请稍后重试。");
      return;
    }

    window.location.assign("/portal");
  }

  return (
    <div className="portal-work-panel p-0 lg:self-start">
      <div className="border-b border-slate-200 bg-slate-950 p-5 text-white sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-200">账号登录</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">输入账号和密码</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">登录后进入客户工作台，查看您的报价、入库、库存、异常和账单。</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-slate-950">
            <LockKeyhole size={21} />
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <form action="/api/login" className="space-y-5" method="post" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">账号</span>
            <span className="mt-2 flex min-h-14 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 focus-within:border-[#0E7490] focus-within:ring-2 focus-within:ring-cyan-100">
              <UserRound size={18} className="text-slate-400" />
              <input
                autoComplete="username"
                className="min-h-11 flex-1 bg-transparent text-base text-slate-950 outline-none"
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入账号"
                value={username}
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-800">密码</span>
            <span className="mt-2 flex min-h-14 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 focus-within:border-[#0E7490] focus-within:ring-2 focus-within:ring-cyan-100">
              <LockKeyhole size={18} className="text-slate-400" />
              <input
                autoComplete="current-password"
                className="min-h-11 flex-1 bg-transparent text-base text-slate-950 outline-none"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}

          <button
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "正在进入..." : "登录客户工作台"} <LogIn size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
