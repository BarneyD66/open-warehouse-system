"use client";

import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Phone, UserRound } from "lucide-react";
import { useState } from "react";

type Mode = "login" | "register" | "reset";

export function WorkspaceAccountPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [resetError, setResetError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");

    const response = await fetch("/api/login", {
      body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setSubmitting(false);
      setLoginError("账号或密码不正确，请核对后重试。");
      return;
    }

    window.location.assign("/portal");
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setRegisterError("");
    setNotice("");

    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setSubmitting(false);
      setRegisterError("两次输入的密码不一致。");
      return;
    }

    const checkResponse = await fetch("/api/register/check", {
      body: JSON.stringify({ phone, email }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const check = (await checkResponse.json().catch(() => ({}))) as { phoneTaken?: boolean; emailTaken?: boolean };
    if (check.phoneTaken || check.emailTaken) {
      setSubmitting(false);
      setRegisterError(check.phoneTaken ? "该手机已注册，请直接登录或找回密码。" : "该邮箱已注册，请直接登录或找回密码。");
      return;
    }

    const response = await fetch("/api/register", {
      body: JSON.stringify({
        companyName: String(form.get("companyName") ?? ""),
        contactName: String(form.get("contactName") ?? ""),
        phone,
        email,
        password,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as { customerCode?: string; message?: string };

    if (!response.ok) {
      setSubmitting(false);
      setRegisterError(result.message || "注册失败，请稍后再试。");
      return;
    }

    setNotice(`注册成功，客户编号 ${result.customerCode} 已自动生成。`);
    window.setTimeout(() => window.location.assign("/portal"), 300);
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResetError("");
    setResetNotice("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setSubmitting(false);
      setResetError("两次输入的新密码不一致。");
      return;
    }

    const response = await fetch("/api/account/reset-password", {
      body: JSON.stringify({
        login: String(form.get("login") ?? ""),
        newPassword,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    setSubmitting(false);
    if (!response.ok) {
      setResetError(result.error || "重置失败，请稍后再试。");
      return;
    }
    event.currentTarget.reset();
    setResetNotice(result.message || "密码已重置，请返回登录。");
  }

  return (
    <div className="workspace-account-card">
      <div className="workspace-account-tabs" role="tablist" aria-label="客户工作台入口">
        <button className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")} type="button">
          客户登录
        </button>
        <button className={mode === "register" ? "is-active" : ""} onClick={() => setMode("register")} type="button">
          免费注册
        </button>
      </div>

      {mode === "login" ? (
        <form className="workspace-account-form" onSubmit={handleLogin}>
          <div>
            <h2>登录专属工作台</h2>
            <p>查看需求、入库、库存、出库、账单、资料和待办，所有记录都归属到您的客户账号。</p>
          </div>
          <label>
            <span>手机 / 邮箱</span>
            <div className="workspace-input">
              <UserRound size={18} />
              <input autoComplete="username" name="username" onChange={(event) => setLoginUsername(event.target.value)} placeholder="请输入手机号或邮箱" value={loginUsername} />
            </div>
          </label>
          <label>
            <span>密码</span>
            <div className="workspace-input">
              <LockKeyhole size={18} />
              <input autoComplete="current-password" name="password" onChange={(event) => setLoginPassword(event.target.value)} placeholder="请输入密码" type={showLoginPassword ? "text" : "password"} value={loginPassword} />
              <button aria-label={showLoginPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowLoginPassword((value) => !value)} type="button">
                {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {loginError ? <p className="workspace-form-error">{loginError}</p> : null}
          <button className="workspace-primary-button" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}
            {submitting ? "正在进入..." : "登录工作台"}
          </button>
          <button className="workspace-link-button" onClick={() => setMode("reset")} type="button">
            忘记密码？重置密码
          </button>
        </form>
      ) : mode === "register" ? (
        <form className="workspace-account-form" onSubmit={handleRegister}>
          <div>
            <h2>注册专属仓储账号</h2>
            <p>注册后系统自动生成客户编号，可继续完善公司、VAT、EORI、平台店铺和作业偏好。</p>
          </div>
          <div className="workspace-form-grid">
            <label>
              <span>公司 / 店铺名称</span>
              <div className="workspace-input">
                <Building2 size={18} />
                <input autoComplete="organization" name="companyName" placeholder="例如：深圳蓝海科技" required />
              </div>
            </label>
            <label>
              <span>联系人</span>
              <div className="workspace-input">
                <UserRound size={18} />
                <input autoComplete="name" name="contactName" placeholder="姓名" required />
              </div>
            </label>
            <label>
              <span>手机 / 微信</span>
              <div className="workspace-input">
                <Phone size={18} />
                <input autoComplete="tel" name="phone" placeholder="用于登录和联系" required />
              </div>
            </label>
            <label>
              <span>邮箱</span>
              <div className="workspace-input">
                <UserRound size={18} />
                <input autoComplete="email" name="email" placeholder="name@example.com" type="email" />
              </div>
            </label>
          </div>
          <label>
            <span>设置密码</span>
            <div className="workspace-input">
              <LockKeyhole size={18} />
              <input autoComplete="new-password" name="password" placeholder="至少 6 位" required type={showRegisterPassword ? "text" : "password"} />
              <button aria-label={showRegisterPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowRegisterPassword((value) => !value)} type="button">
                {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label>
            <span>确认密码</span>
            <div className="workspace-input">
              <LockKeyhole size={18} />
              <input autoComplete="new-password" name="confirmPassword" placeholder="再次输入密码" required type={showRegisterPassword ? "text" : "password"} />
            </div>
          </label>
          {notice ? (
            <p className="workspace-form-success">
              <CheckCircle2 size={16} />
              {notice}
            </p>
          ) : null}
          {registerError ? <p className="workspace-form-error">{registerError}</p> : null}
          <button className="workspace-primary-button" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}
            {submitting ? "正在注册..." : "注册并进入工作台"}
          </button>
          <button className="workspace-link-button" onClick={() => setMode("login")} type="button">
            已有账号？返回登录
          </button>
        </form>
      ) : (
        <form className="workspace-account-form" onSubmit={handleResetPassword}>
          <div>
            <p className="workspace-account-kicker">找回密码</p>
            <h2>重置客户账号密码</h2>
            <p>输入注册时的手机或邮箱，设置新密码。正式上线后这里会接入短信或邮箱验证码。</p>
          </div>
          <label>
            <span>手机 / 邮箱</span>
            <div className="workspace-input">
              <UserRound size={18} />
              <input autoComplete="username" name="login" placeholder="请输入手机号或邮箱" required />
            </div>
          </label>
          <label>
            <span>新密码</span>
            <div className="workspace-input">
              <LockKeyhole size={18} />
              <input autoComplete="new-password" name="newPassword" placeholder="至少 6 位" required type={showRegisterPassword ? "text" : "password"} />
              <button aria-label={showRegisterPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowRegisterPassword((value) => !value)} type="button">
                {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label>
            <span>确认新密码</span>
            <div className="workspace-input">
              <LockKeyhole size={18} />
              <input autoComplete="new-password" name="confirmPassword" placeholder="再次输入新密码" required type={showRegisterPassword ? "text" : "password"} />
            </div>
          </label>
          {resetNotice ? (
            <p className="workspace-form-success">
              <CheckCircle2 size={16} />
              {resetNotice}
            </p>
          ) : null}
          {resetError ? <p className="workspace-form-error">{resetError}</p> : null}
          <button className="workspace-primary-button" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}
            {submitting ? "正在重置..." : "重置密码"}
          </button>
          <button className="workspace-link-button" onClick={() => setMode("login")} type="button">
            返回登录
          </button>
        </form>
      )}
    </div>
  );
}
