"use client";

import { Children, cloneElement, isValidElement, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type FormHTMLAttributes, type InputHTMLAttributes, type ReactNode, type ReactElement } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

type Outcome = boolean | void;

export function readableSubmissionError(error: unknown) {
  if (error instanceof Error && /[\u3400-\u9fff]/.test(error.message)) return error;
  return new Error("网络连接异常，提交结果尚未确认。请先查看记录，再决定是否重试。");
}

function logFailure(code: string, status?: number) {
  // Never log payloads, credentials, account identifiers or server error bodies.
  console.error("[submission]", { code, ...(status ? { status } : {}) });
}

export async function submissionFetch(input: RequestInfo | URL, init?: RequestInit, preserveValidationResponse = false): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30_000);
  const signal = init?.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal;
  try {
    const response = await globalThis.fetch(input, { ...init, signal });
    // Include response-body transfer in the timeout; the original body remains available.
    await response.clone().arrayBuffer();
    if (!response.ok) {
      logFailure("HTTP_ERROR", response.status);
      // Scanning validation responses include the selected order and progress context.
      if (preserveValidationResponse && [400, 404, 409, 422].includes(response.status)) return response;
      if (response.status === 408 || response.status === 504) throw new Error("请求超时，提交结果尚未确认。请先查看记录，再决定是否重试。");
      if (response.status >= 500) throw new Error("服务器暂时无法处理，提交结果尚未确认。请先查看记录，再决定是否重试。");
      if (response.status === 429) throw new Error("操作过于频繁，请稍后重试。");
      let payload: { error?: unknown; message?: unknown } = {};
      try { payload = await response.clone().json(); } catch { /* readable fallback below */ }
      const detail = payload.error ?? payload.message;
      throw new Error(typeof detail === "string" && /[\u3400-\u9fff]/.test(detail) && detail.length <= 240 ? detail : "提交校验未通过，请检查填写内容或登录状态后重试。");
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      try { await response.clone().json(); } catch { throw new Error("服务器返回格式异常，提交结果尚未确认。请先查看记录，再决定是否重试。"); }
    }
    return response;
  } catch (error) {
    logFailure(controller.signal.aborted ? "TIMEOUT" : "REQUEST_FAILED");
    if (controller.signal.aborted) throw new Error("请求超时，提交结果尚未确认。请先查看记录，再决定是否重试。");
    throw readableSubmissionError(error);
  } finally {
    window.clearTimeout(timer);
  }
}

// React's transition API returns void. Expose the real async outcome to the feedback controls.
export function submissionTransition(start: (action: () => Promise<void>) => void, action: () => Promise<Outcome>): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    start(async () => {
      try { resolve(await action()); } catch (error) { reject(error); }
    });
  });
}

function useFeedback() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<Outcome> | Outcome) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setMessage("");
    setFailed(false);
    try {
      const outcome = await action();
      if (outcome === false) {
        logFailure("VALIDATION_OR_CANCELLED");
        setFailed(true);
        setMessage("操作尚未提交，请检查填写内容和页面提示后重试。");
      } else {
        setMessage("保存成功。");
      }
    } catch (error) {
      logFailure("CLIENT_EXCEPTION");
      setFailed(true);
      setMessage(readableSubmissionError(error).message);
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return { pending, message, failed, run };
}

function Feedback({ message, failed, retry }: { message: string; failed: boolean; retry: () => void }) {
  if (!message) return null;
  return <span className={`mt-2 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${failed ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role={failed ? "alert" : "status"}>
    {!failed ? <CheckCircle2 size={16} aria-hidden="true" /> : null}{message}
    {failed ? <button type="button" className="min-h-9 rounded border border-current px-3 underline" onClick={retry}>重试</button> : null}
  </span>;
}

function pendingButtons(children: ReactNode, pending: boolean): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ children?: ReactNode; type?: string; disabled?: boolean; "aria-busy"?: boolean }>;
    // Controls cannot contain submit buttons. Keep their special HTML text handling intact.
    if (["select", "option", "textarea", "input", "svg"].includes(String(element.type))) return child;
    if (element.type === "button" && (!element.props.type || element.props.type === "submit")) {
      return cloneElement(element, { disabled: pending || element.props.disabled, "aria-busy": pending }, pending ? <><Loader2 className="animate-spin" size={16} aria-hidden="true" /> 保存中…</> : element.props.children);
    }
    if (element.props.children) return cloneElement(element, {}, pendingButtons(element.props.children, pending));
    return child;
  });
}

export function SubmissionForm({ children, onSubmit, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & { onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<Outcome> | Outcome }) {
  const formRef = useRef<HTMLFormElement>(null);
  const feedback = useFeedback();
  return <form {...props} ref={formRef} aria-busy={feedback.pending} onSubmit={(event) => {
    event.preventDefault();
    void feedback.run(() => onSubmit(event));
  }}>
    {pendingButtons(children, feedback.pending)}
    <Feedback message={feedback.message} failed={feedback.failed} retry={() => formRef.current?.requestSubmit()} />
  </form>;
}

export function SubmissionButton({ children, onClick, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & { onClick: () => Promise<Outcome> | Outcome }) {
  const feedback = useFeedback();
  return <>
    <button {...props} type={props.type ?? "button"} disabled={props.disabled || feedback.pending} aria-busy={feedback.pending} onClick={() => { void feedback.run(onClick); }}>
      {feedback.pending ? <><Loader2 className="animate-spin" size={16} aria-hidden="true" /> 保存中…</> : children}
    </button>
    <Feedback message={feedback.message} failed={feedback.failed} retry={() => { if (!props.disabled) void feedback.run(onClick); }} />
  </>;
}

export function SubmissionFileInput({ onUpload, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & { onUpload: (file: File) => Promise<Outcome> | Outcome }) {
  const selectedFile = useRef<File | null>(null);
  const feedback = useFeedback();
  return <span className="inline-flex flex-wrap items-center gap-2">
    <input {...props} type="file" disabled={props.disabled || feedback.pending} aria-busy={feedback.pending} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      selectedFile.current = file;
      void feedback.run(() => onUpload(file));
    }} />
    {feedback.pending ? <span role="status" className="inline-flex items-center gap-1"><Loader2 className="animate-spin" size={16} aria-hidden="true" />保存中…</span> : null}
    <Feedback message={feedback.message} failed={feedback.failed} retry={() => {
      const file = selectedFile.current;
      if (file && !props.disabled) void feedback.run(() => onUpload(file));
    }} />
  </span>;
}
