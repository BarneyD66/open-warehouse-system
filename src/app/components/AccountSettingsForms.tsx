"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Save } from "lucide-react";

type AccountView = {
  customerCode: string;
  username: string;
  companyName: string;
  contactName: string;
  phone: string;
  email?: string;
  vatNumber?: string;
  eoriNumber?: string;
  platforms?: string[];
  storeUrl?: string;
  businessAddress?: string;
  status: "unverified" | "verified" | "paused";
};

const inputClass = "min-h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-cyan-700";
const labelClass = "grid gap-2 text-sm font-semibold text-slate-700";

function statusLabel(status: AccountView["status"]) {
  if (status === "verified") return "已认证";
  if (status === "paused") return "已暂停";
  return "未认证";
}

export function AccountSettingsForms({ account, editable }: { account: AccountView; editable: boolean }) {
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    setSavingProfile(true);
    setProfileNotice("");
    setProfileError("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: String(form.get("companyName") ?? ""),
        contactName: String(form.get("contactName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        vatNumber: String(form.get("vatNumber") ?? ""),
        eoriNumber: String(form.get("eoriNumber") ?? ""),
        platforms: String(form.get("platforms") ?? ""),
        storeUrl: String(form.get("storeUrl") ?? ""),
        businessAddress: String(form.get("businessAddress") ?? ""),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setSavingProfile(false);
    if (!response.ok) {
      setProfileError(result.error || "保存失败，请稍后再试。");
      return;
    }
    setProfileNotice("客户资料已保存，运营后台后续可用于认证审核。");
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    setSavingPassword(true);
    setPasswordNotice("");
    setPasswordError("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) {
      setSavingPassword(false);
      setPasswordError("两次输入的新密码不一致。");
      return;
    }
    const response = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setSavingPassword(false);
    if (!response.ok) {
      setPasswordError(result.error || "修改失败，请稍后再试。");
      return;
    }
    event.currentTarget.reset();
    setPasswordNotice("密码已修改，下次请使用新密码登录。");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={saveProfile}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="font-mono text-xs font-semibold text-slate-500">{account.customerCode}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">客户资料</h2>
            <p className="mt-1 text-sm text-slate-600">公司、税号、EORI 和平台店铺信息会作为后续认证和运营服务资料。</p>
          </div>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{statusLabel(account.status)}</span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            公司 / 店铺名称
            <input className={inputClass} defaultValue={account.companyName} disabled={!editable} name="companyName" required />
          </label>
          <label className={labelClass}>
            联系人
            <input className={inputClass} defaultValue={account.contactName} disabled={!editable} name="contactName" required />
          </label>
          <label className={labelClass}>
            手机 / 微信
            <input className={inputClass} defaultValue={account.phone} disabled={!editable} name="phone" required />
          </label>
          <label className={labelClass}>
            邮箱
            <input className={inputClass} defaultValue={account.email ?? ""} disabled={!editable} name="email" type="email" />
          </label>
          <label className={labelClass}>
            VAT 号
            <input className={inputClass} defaultValue={account.vatNumber ?? ""} disabled={!editable} name="vatNumber" placeholder="GB VAT，可选" />
          </label>
          <label className={labelClass}>
            EORI 号
            <input className={inputClass} defaultValue={account.eoriNumber ?? ""} disabled={!editable} name="eoriNumber" placeholder="英国清关 EORI，可选" />
          </label>
        </div>

        <label className={`${labelClass} mt-4`}>
          平台 / 店铺
          <textarea className={`${inputClass} min-h-24 py-3`} defaultValue={(account.platforms ?? []).join("\n")} disabled={!editable} name="platforms" placeholder="Amazon UK&#10;TikTok Shop&#10;Shopify" />
        </label>
        <label className={`${labelClass} mt-4`}>
          店铺链接
          <input className={inputClass} defaultValue={account.storeUrl ?? ""} disabled={!editable} name="storeUrl" placeholder="https://..." />
        </label>
        <label className={`${labelClass} mt-4`}>
          公司地址
          <textarea className={`${inputClass} min-h-24 py-3`} defaultValue={account.businessAddress ?? ""} disabled={!editable} name="businessAddress" placeholder="公司注册地址或运营地址" />
        </label>

        {profileNotice ? (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            {profileNotice}
          </p>
        ) : null}
        {profileError ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{profileError}</p> : null}

        <button className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50" disabled={!editable || savingProfile} type="submit">
          {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          保存客户资料
        </button>
      </form>

      <div className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">账号状态</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">登录账号</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{account.username}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              未认证账号可以提交需求和维护资料；正式入库、账期、合同价和发票资料会在运营认证后放开。
            </div>
          </div>
        </section>

        <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={savePassword}>
          <h2 className="text-lg font-semibold text-slate-950">修改密码</h2>
          <div className="mt-4 grid gap-4">
            <label className={labelClass}>
              当前密码
              <input className={inputClass} disabled={!editable} name="currentPassword" required type="password" />
            </label>
            <label className={labelClass}>
              新密码
              <input className={inputClass} disabled={!editable} name="newPassword" required type="password" />
            </label>
            <label className={labelClass}>
              确认新密码
              <input className={inputClass} disabled={!editable} name="confirmPassword" required type="password" />
            </label>
          </div>
          {passwordNotice ? (
            <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={16} />
              {passwordNotice}
            </p>
          ) : null}
          {passwordError ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{passwordError}</p> : null}
          <button className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={!editable || savingPassword} type="submit">
            {savingPassword ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
            修改密码
          </button>
        </form>
      </div>
    </div>
  );
}
