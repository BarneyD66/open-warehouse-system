"use client";

import { SubmissionForm, submissionFetch } from "./SubmissionFeedback";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Save } from "lucide-react";

type AccountView = {
  customerCode: string;
  username: string;
  companyName: string;
  contactName: string;
  phone: string;
  wechat?: string;
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

export function AccountSettingsForms({ account, editable }: { account: AccountView; editable: boolean }) {
  const router = useRouter();
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    const submissionFormElement=event.currentTarget;

    try {

      event.preventDefault();
      if (!editable) return false;
      setSavingProfile(true);
      setProfileNotice("");
      setProfileError("");

      const form=new FormData(submissionFormElement);
      const response=await submissionFetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: String(form.get("companyName")??""),
          contactName: String(form.get("contactName")??""),
          wechat: String(form.get("wechat")??""),
          email: String(form.get("email")??""),
          vatNumber: String(form.get("vatNumber")??""),
          eoriNumber: String(form.get("eoriNumber")??""),
          platforms: String(form.get("platforms")??""),
          storeUrl: String(form.get("storeUrl")??""),
          businessAddress: String(form.get("businessAddress")??""),
        }),
      });
      const result=(await response.json().catch(() => ({}))) as { error?: string };
      setSavingProfile(false);
      if (!response.ok) {
        setProfileError(result.error||"保存失败，请稍后再试。");
        return false;
      }
      router.refresh();
      setProfileNotice("客户资料已保存。我们会按这些信息配置商品、订单和发货要求。");

      return true;
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    const submissionFormElement=event.currentTarget;

    try {

      event.preventDefault();
      if (!editable) return false;
      setSavingPassword(true);
      setPasswordNotice("");
      setPasswordError("");
      const form=new FormData(submissionFormElement);
      const newPassword=String(form.get("newPassword")??"");
      const confirmPassword=String(form.get("confirmPassword")??"");
      if (newPassword!==confirmPassword) {
        setSavingPassword(false);
        setPasswordError("两次输入的新密码不一致。");
        return false;
      }
      const response=await submissionFetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword")??""),
          newPassword,
        }),
      });
      const result=(await response.json().catch(() => ({}))) as { error?: string };
      setSavingPassword(false);
      if (!response.ok) {
        setPasswordError(result.error||"修改失败，请稍后再试。");
        return false;
      }
      submissionFormElement.reset();
      setPasswordNotice("密码已修改，下次请使用新密码登录。");

      return true;
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <SubmissionForm id="profile" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm scroll-mt-24" onSubmit={saveProfile}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">店铺联系资料</h2>
            <p className="mt-1 text-sm text-slate-600">这些信息用于确认订单来源、联系发货问题和反馈物流进度。</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            公司 / 店铺名称
            <input className={inputClass} defaultValue={account.companyName} disabled={!editable} name="companyName" />
          </label>
          <label className={labelClass}>
            联系人
            <input className={inputClass} defaultValue={account.contactName} disabled={!editable} name="contactName" />
          </label>
          {account.phone ? <label className={labelClass}>
            联系电话（只读，可选资料）
            <input autoComplete="tel" className={`${inputClass} bg-slate-50`} value={account.phone} readOnly type="tel" />
            <span className="text-xs font-normal text-slate-500">保留原手机号登录方式，无需重新填写。</span>
          </label> : null}
          <label className={labelClass}>
            微信号（可选）
            <input autoComplete="off" className={inputClass} defaultValue={account.wechat ?? ""} disabled={!editable} name="wechat" placeholder="请输入微信号" />
          </label>
          <label className={labelClass}>
            联系邮箱（默认登录邮箱）
            <input className={inputClass} defaultValue={account.email ?? (account.username.includes("@") ? account.username : "")} disabled={!editable} name="email" type="email" />
          </label>
        </div>

        <label className={`${labelClass} mt-4`}>
          平台 / 店铺
          <textarea className={`${inputClass} min-h-24 py-3`} defaultValue={(account.platforms ?? []).join("\n")} disabled={!editable} name="platforms" placeholder="TikTok Shop&#10;店铺名称&#10;UK 站点" />
        </label>
        <label className={`${labelClass} mt-4`}>
          店铺链接
          <input className={inputClass} defaultValue={account.storeUrl ?? ""} disabled={!editable} name="storeUrl" placeholder="https://..." />
        </label>
        <label className={`${labelClass} mt-4`}>
          常用发货备注
          <textarea className={`${inputClass} min-h-24 py-3`} defaultValue={account.businessAddress ?? ""} disabled={!editable} name="businessAddress" placeholder="例如：常用物流偏好、包材要求、客服备注" />
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
          保存资料
        </button>
      </SubmissionForm>

      <div className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">账号说明</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">登录账号</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{account.username}</p>
            </div>
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
              当前账号支持登录、商品编码维护、入仓信息提交、订单文件校验和提交给仓库处理。后续资料可在工作台继续完善。
            </div>
          </div>
        </section>

        <SubmissionForm className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={savePassword}>
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
        </SubmissionForm>
      </div>
    </div>
  );
}
