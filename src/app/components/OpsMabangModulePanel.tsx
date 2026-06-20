"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  BarChart3,
  Cable,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  PackageSearch,
  Play,
  PoundSterling,
  RadioTower,
  Save,
  Send,
  ShieldCheck,
  Upload,
  Warehouse,
  XCircle,
} from "lucide-react";
import type { BatchOperationStatus, CustomerWorkOrderStatus, LogisticsChannelConfig, OpsExpansionData, OrderImportPreview } from "@/lib/opsExpansionStore";
import type { AutomationRunRecord } from "@/lib/automationRunStore";
import type { NotificationDelivery, NotificationProviderHealth } from "@/lib/notificationStore";
import type { ManagedStaffAccountView } from "@/lib/staffAccountStore";
import type { SlaNotificationRule } from "@/lib/slaRuleStore";
import type { StaffWhitelistView } from "@/lib/staffAuth";
import type { PurchaseReceiptOrder } from "@/lib/warehouseCoreStore";

type Props = {
  data: OpsExpansionData;
  module: "overview" | "inquiry" | "inbound" | "inventory" | "outbound" | "logistics" | "billing" | "permissions";
  purchaseReceipts?: PurchaseReceiptOrder[];
  staffWhitelist?: StaffWhitelistView[];
  managedStaffAccounts?: ManagedStaffAccountView[];
  notificationDeliveries?: NotificationDelivery[];
  notificationProviderHealth?: NotificationProviderHealth[];
  automationRuns?: AutomationRunRecord[];
  slaRules?: SlaNotificationRule[];
};

type ExportKind = "order-imports" | "platforms" | "platform-sync-jobs" | "batch-plans" | "wms-policies" | "logistics-channels" | "carrier-bills" | "payment-imports" | "billing-rules" | "work-orders" | "report-views" | "permissions" | "approval-rules";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

const inputClass = "h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const textareaClass = "min-h-24 rounded-md border border-slate-200 bg-white p-3 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const approvalTriggerLabel: Record<string, string> = {
  inventory_adjustment: "库存调整",
  stocktake_difference: "盘点差异",
  transfer_order: "分仓调拨",
  billing_lock: "账单锁定",
  carrier_fee_diff: "运费差异",
  customer_status: "客户状态",
  manual_inbound_outbound: "手工出入库",
  manual_fee_adjustment: "手工费用调整",
  outbound_intercept: "出库截单回库",
  claim_approval: "异常赔付审批",
};

const staffRoleLabel: Record<ManagedStaffAccountView["role"], string> = {
  admin: "系统管理员",
  ops: "运营",
  warehouse: "仓库",
  finance: "财务",
};

function ExportLink({ kind, children }: { kind: ExportKind; children: React.ReactNode }) {
  return (
    <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/api/ops/mabang-modules?export=${kind}`}>
      <Download size={15} />
      {children}
    </Link>
  );
}

function ReportDownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={href}>
      <Download size={15} />
      {children}
    </Link>
  );
}

function Panel({ title, icon, children, aside }: { title: string; icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          {icon}
          {title}
        </h2>
        {aside ? <div className="flex flex-wrap gap-2">{aside}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function paymentReviewAction(issue?: string) {
  const text = issue ?? "";
  if (text.includes("金额") || text.includes("金額")) return "核对到账金额、账单金额和是否为部分付款；确认无误后手工核销。";
  if (text.includes("争议")) return "先处理账单争议，确认费用口径后再核销。";
  if (text.includes("多")) return "筛选候选账单，人工确认唯一账单或月结单后再核销。";
  if (text.includes("币种") || text.includes("GBP")) return "确认收款币种和汇率口径，必要时转为人工费用调整。";
  if (text.includes("未找到") || text.includes("匹配")) return "按客户、付款参考号、银行流水号继续检索账单。";
  return "由财务人工复核流水、客户和账单后处理。";
}

function PaymentReconciliationReviewBoard({ batches }: { batches: OpsExpansionData["paymentReconciliationImportBatches"] }) {
  const reviewRows = batches
    .flatMap((batch) =>
      batch.rows
        .filter((row) => row.status === "skipped")
        .map((row) => ({
          batch,
          row,
        })),
    )
    .slice(0, 8);
  const skippedRows = batches.reduce((sum, batch) => sum + batch.skippedRows, 0);
  const matchedRows = batches.reduce((sum, batch) => sum + batch.matchedRows, 0);
  const matchedAmount = batches.reduce((sum, batch) => sum + batch.matchedAmount, 0);

  return (
    <section className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <AlertTriangle size={16} />
            银行流水人工复核队列
          </h3>
          <p className="mt-1 text-xs leading-5 text-amber-900">自动核销只处理金额一致、唯一命中的记录；剩余流水需要财务确认后再手工处理，避免错核销。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md border border-emerald-200 bg-white p-2 text-emerald-800">
            <p className="text-lg font-semibold">{matchedRows}</p>
            <p>自动核销</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-white p-2 text-amber-900">
            <p className="text-lg font-semibold">{skippedRows}</p>
            <p>待复核</p>
          </div>
          <div className="rounded-md border border-cyan-200 bg-white p-2 text-cyan-800">
            <p className="text-lg font-semibold">£{matchedAmount.toFixed(2)}</p>
            <p>已核销</p>
          </div>
        </div>
      </div>

      {reviewRows.length ? (
        <div className="mt-4 grid gap-2">
          {reviewRows.map(({ batch, row }) => (
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={`${batch.id}-${row.row}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-500">{batch.id} / 第 {row.row} 行</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    £{row.amount.toFixed(2)} {row.currency} / {row.customerCode || "客户待确认"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    流水号：{row.bankReference || "-"} / 付款参考：{row.paymentReference || "-"} / 付款方：{row.payerName || "-"}
                  </p>
                </div>
                <Link className="inline-flex min-h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-900 hover:bg-amber-100" href={`/api/ops/mabang-modules?batchId=${encodeURIComponent(batch.id)}&report=payment-reconciliation-json`} target="_blank">
                  查看 JSON
                </Link>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-700">
                  <p className="font-semibold text-slate-900">跳过原因</p>
                  <p>{row.issue || "未返回具体原因，请人工核对流水。"}</p>
                </div>
                <div className="rounded-md bg-cyan-50 p-2 text-xs leading-5 text-cyan-900">
                  <p className="font-semibold">建议动作</p>
                  <p>{paymentReviewAction(row.issue)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-white p-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={16} />
          暂无待人工复核的银行流水。
        </div>
      )}
    </section>
  );
}

function statusPill(status: string) {
  const tone = status === "active" || status === "connected" || status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "exception" || status === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : status === "processing" || status === "sandbox" ? "border-cyan-200 bg-cyan-50 text-cyan-800" : status === "cancelled" ? "border-slate-300 bg-slate-100 text-slate-500" : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function accessRiskPill(risks: string[]) {
  const tone = risks.length > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{risks.length > 0 ? "需复核" : "可使用"}</span>;
}

function logisticsChannelHealth(channel: LogisticsChannelConfig) {
  const features = channel.enabledFeatures.join(" ");
  const issues = [
    channel.status === "paused" ? "渠道暂停" : "",
    channel.status === "draft" ? "未启用" : "",
    channel.apiMode !== "manual" && !channel.credentialRef ? "缺少承运商凭证引用" : "",
    channel.apiMode === "live" && !channel.trackingWebhook ? "正式接口缺少轨迹回传地址" : "",
    channel.apiMode !== "manual" && !features.includes("面单购买") ? "缺面单购买能力" : "",
    channel.apiMode !== "manual" && !features.includes("轨迹自动回传") ? "缺轨迹自动回传" : "",
    !features.includes("派送失败处理") ? "缺派送失败处理" : "",
    !features.includes("签收证明") ? "缺签收证明" : "",
    !features.includes("物流赔付") ? "缺物流赔付" : "",
    channel.surchargeRules.length === 0 ? "未配置附加费规则" : "",
  ].filter(Boolean);
  const ready = channel.status === "active" && issues.length === 0;
  return {
    label: ready ? "可上线" : channel.status === "sandbox" ? "沙箱验证中" : channel.status === "paused" ? "已暂停" : "待补齐",
    tone: ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : issues.length >= 3 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800",
    issues: issues.length ? issues : ["配置完整"],
  };
}

function purchaseReceiptStatusLabel(status: PurchaseReceiptOrder["status"]) {
  const labels: Record<PurchaseReceiptOrder["status"], string> = {
    draft: "草稿",
    in_transit: "在途",
    arrived: "已到仓",
    partially_received: "部分签收",
    received: "已签收",
    putaway_completed: "已上架",
    exception: "异常",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function orderPreviewReportRows(preview: OrderImportPreview) {
  const issueByRow = new Map(preview.issues.map((issue) => [issue.row, `${issue.level === "error" ? "错误" : "提醒"}：${issue.message}`]));
  return [
    ["行号", "订单号", "客户编号", "SKU 编码", "数量", "物流渠道", "状态", "异常/提醒"],
    ...preview.rows.map((row) => [row.row, row.orderNo, row.customerCode, row.skuCode, row.quantity, row.channel, row.status === "ready" ? "可导入" : "需处理", row.issue ?? issueByRow.get(row.row) ?? ""]),
    ...preview.issues
      .filter((issue) => !preview.rows.some((row) => row.row === issue.row))
      .map((issue) => [issue.row, "", "", "", "", "", issue.level === "error" ? "错误" : "提醒", issue.message]),
  ];
}

function reportViewHref(view: OpsExpansionData["savedViews"][number]) {
  return `/api/ops/reports/views/${encodeURIComponent(view.id)}`;
}

function reportModuleLabel(module: OpsExpansionData["savedViews"][number]["module"]) {
  const labels: Partial<Record<OpsExpansionData["savedViews"][number]["module"], string>> = {
    orders: "订单",
    warehouse: "仓库效率",
    logistics: "物流",
    billing: "账单",
    charge_events: "费用事件台账",
    automation_runs: "自动化运行记录",
    payment_review: "付款复核",
    payment_reconciliation: "收款核销台账",
    finance_adjustments: "财务调账/赔付审批",
    profit: "利润/成本",
    sla: "SLA",
    returns: "退货/RMA",
    exceptions: "异常中心",
    scans: "扫码留痕",
    locations: "库位利用率",
    outbound_lot_allocation: "出库批次分配",
    data_quality: "数据质量巡检",
    staff_performance: "员工绩效",
    outbound_review: "出库复核差异",
    customer_credit: "客户信用风险",
    carrier_labels: "承运商面单生命周期",
    carrier_claims: "承运商赔付台账",
    platform_sync: "平台同步任务",
    customer_self_service: "客户自助待办",
    documents_security: "文件安全台账",
  };
  return labels[module] ?? module;
}

function formObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

export function OpsMabangModulePanel({ data, module, purchaseReceipts = [], staffWhitelist = [], managedStaffAccounts = [], notificationDeliveries = [], notificationProviderHealth = [], automationRuns = [], slaRules = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importPreview, setImportPreview] = useState<OrderImportPreview | null>(null);
  const [platformCsv, setPlatformCsv] = useState("销售平台,平台订单号,客户编号,SKU 编码,数量,物流渠道,收件人,收件地址,要求发货日期,备注\nAmazon,平台订单-001,CUST-202605-0001,SKU-001,1,Royal Mail 48,张三,英国伦敦示例街10号,2026-05-26,请按默认包材发货");
  const [weightCsv, setWeightCsv] = useState("出库单号,包裹重量KG,包裹数,备注\nOUT-202606-0001,1.25,1,打包台称重");
  const [purchaseCsv, setPurchaseCsv] = useState("客户编号,供应商,仓库,SKU编码,商品名称,预计数量,预计到仓日期,追踪号,库位,批次号,效期,备注\nCUST-202605-3054,义乌供应商A,SHEFFIELD-MAIN,SKU-001,收纳盒,100,2026-06-20,追踪号-001,RCV-A-01,批次-202606,2027-06-30,首批补货");
  const [staffRoleReviewConfirmation, setStaffRoleReviewConfirmation] = useState<Record<string, string>>({});

  function submit(body: Record<string, unknown>, success: string) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "保存失败，请检查填写内容。");
        return;
      }
      setMessage(success);
      router.refresh();
    });
  }

  function runOrderPreview() {
    setMessage("");
    setError("");
    setImportPreview(null);
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview_orders_csv", source: "csv", csv: platformCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { preview?: OrderImportPreview; error?: string };
      if (!response.ok || !payload.preview) {
        setError(payload.error || "订单预检失败，请检查 CSV 内容。");
        return;
      }
      setImportPreview(payload.preview);
      setMessage(`预检完成：可创建 ${payload.preview.readyOrders} 个出库单，${payload.preview.skippedRows} 行需要处理。`);
    });
  }

  function confirmOrderImport() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_orders_csv", source: "csv", fileName: "平台订单导入.csv", csv: platformCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { batch?: { createdOrders?: number; skippedRows?: number }; error?: string };
      if (!response.ok) {
        setError(payload.error || "订单导入失败，请根据预检异常修正后再试。");
        return;
      }
      setImportPreview(null);
      setMessage(`已创建 ${payload.batch?.createdOrders ?? 0} 个出库单，${payload.batch?.skippedRows ?? 0} 行未导入。`);
      router.refresh();
    });
  }

  function saveOrderDraft() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_order_import_draft", source: "csv", fileName: "平台订单预检草稿.csv", csv: platformCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as { batch?: { id?: string }; error?: string };
      if (!response.ok) {
        setError(payload.error || "保存预检草稿失败，请稍后再试。");
        return;
      }
      setMessage(`预检草稿已保存${payload.batch?.id ? `：${payload.batch.id}` : "。"}，可在最近导入批次中继续追踪。`);
      router.refresh();
    });
  }

  function importOutboundWeights() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_outbound_weights_csv", csv: weightCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        result?: { updatedRows?: number; skippedRows?: number; issues?: Array<{ row: number; message: string }> };
        error?: string;
      };
      if (!response.ok || !payload.result) {
        setError(payload.error || "批量称重导入失败，请检查 CSV 格式。");
        return;
      }
      const issueText = payload.result.issues?.length ? `，异常/提醒 ${payload.result.issues.length} 条` : "";
      setMessage(`批量称重完成：更新 ${payload.result.updatedRows ?? 0} 单，跳过 ${payload.result.skippedRows ?? 0} 行${issueText}。`);
      router.refresh();
    });
  }

  function uploadCarrierBill(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const csv = await file.text();
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_carrier_bill_csv", fileName: file.name, csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        batch?: { matchedRows?: number; skippedRows?: number; diffRows?: number; totalDiffAmount?: number };
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error || "承运商账单导入失败，请检查模板格式。");
        return;
      }
      setMessage(`账单已核对：匹配 ${payload.batch?.matchedRows ?? 0} 行，跳过 ${payload.batch?.skippedRows ?? 0} 行，差异 ${payload.batch?.diffRows ?? 0} 行，差异合计 £${(payload.batch?.totalDiffAmount ?? 0).toFixed(2)}。`);
      router.refresh();
    });
  }

  function uploadPaymentReconciliation(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const csv = await file.text();
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_payment_reconciliation_csv", fileName: file.name, csv }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        batch?: { matchedRows?: number; skippedRows?: number; statementRows?: number; matchedAmount?: number };
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error || "银行流水导入失败，请检查模板格式。");
        return;
      }
      setMessage(`银行流水已导入：自动核销 ${payload.batch?.matchedRows ?? 0} 行，其中月结 ${payload.batch?.statementRows ?? 0} 行，待人工复核 ${payload.batch?.skippedRows ?? 0} 行，已核销 £${(payload.batch?.matchedAmount ?? 0).toFixed(2)}。`);
      router.refresh();
    });
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>, success: string, extra?: Record<string, unknown>) {
    event.preventDefault();
    submit({ ...formObject(event.currentTarget), ...extra }, success);
  }

  function updateBatch(id: string, status: BatchOperationStatus) {
    submit({ action: "update_batch_status", id, status }, `批量任务已更新为 ${status}。`);
  }

  function retryBatch(id: string) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "任务重试失败，请稍后再试。");
        return;
      }
      setMessage("任务已重新进入队列。");
      router.refresh();
    });
  }

  function retryDueBatches() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/jobs/retry-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; summary?: { attempted?: number; retried?: number; failed?: number } };
      if (!response.ok) {
        setError(payload.error || "到期异常任务重试失败，请稍后再试。");
        return;
      }
      setMessage(`到期异常任务已处理：扫描处理 ${payload.summary?.attempted ?? 0} 个，重新排队 ${payload.summary?.retried ?? 0} 个，失败 ${payload.summary?.failed ?? 0} 个。`);
      router.refresh();
    });
  }

  function runDueBatches() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/jobs/run-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; summary?: { scannedRunnable?: number; completed?: number; failed?: number } };
      if (!response.ok) {
        setError(payload.error || "到期批量任务执行失败，请稍后再试。");
        return;
      }
      setMessage(`到期批量任务已执行：处理 ${payload.summary?.scannedRunnable ?? 0} 个，完成 ${payload.summary?.completed ?? 0} 个，失败 ${payload.summary?.failed ?? 0} 个。`);
      router.refresh();
    });
  }

  function syncPlatform(id: string) {
    submit({ action: "sync_platform_connection", id }, "平台同步任务已执行，可在同步记录中查看预检批次或失败原因。");
  }

  function syncDuePlatforms() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/platform-orders/sync-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20, minIntervalMinutes: 30 }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; summary?: { attempted?: number; completed?: number; failed?: number } };
      if (!response.ok) {
        setError(payload.error || "到期平台订单同步失败，请检查平台连接和权限。");
        return;
      }
      setMessage(`到期平台订单同步完成：尝试 ${payload.summary?.attempted ?? 0} 个连接，成功 ${payload.summary?.completed ?? 0} 个，失败 ${payload.summary?.failed ?? 0} 个。`);
      router.refresh();
    });
  }

  function reviewPlatformCancellations() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/platform-orders/cancellation-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { reviewed?: number; intercepts?: number; deliveryExceptions?: number; workOrders?: number; failed?: number };
      };
      if (!response.ok) {
        setError(payload.error || "平台取消订单复核失败，请检查权限或稍后再试。");
        return;
      }
      setMessage(`平台取消订单复核完成：复核 ${payload.summary?.reviewed ?? 0} 条，截单 ${payload.summary?.intercepts ?? 0} 条，异常 ${payload.summary?.deliveryExceptions ?? 0} 条，工单 ${payload.summary?.workOrders ?? 0} 条，失败 ${payload.summary?.failed ?? 0} 条。`);
      router.refresh();
    });
  }

  function cancelOrderImportBatch(id: string) {
    submit({ action: "cancel_order_import_draft", id, reason: "运营在导入列表取消同步预检草稿" }, "导入/同步草稿已取消，不会再生成出库单。");
  }

  function submitStaffAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const action = submitter instanceof HTMLButtonElement ? submitter.value || "upsert" : "upsert";
    const body = { ...formObject(event.currentTarget), action };
    startTransition(async () => {
      const response = await fetch("/api/ops/staff-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "员工账号维护失败，请检查权限和填写内容。");
        return;
      }
      setMessage(body.action === "disable" ? "员工账号已禁用。" : body.action === "unlock" ? "员工账号登录锁定已解除。" : "员工账号已保存。");
      router.refresh();
    });
  }

  function reviewStaffRoleChange(username: string, decision: "approve" | "reject") {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/staff-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review_role_change", username, decision, note: decision === "approve" ? "权限负责人审批通过" : "权限负责人驳回", confirmation: staffRoleReviewConfirmation[username] ?? "" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "角色变更审批失败，请稍后再试。");
        return;
      }
      setMessage(decision === "approve" ? "员工角色变更已审批通过。" : "员工角色变更已驳回。");
      setStaffRoleReviewConfirmation((current) => ({ ...current, [username]: "" }));
      router.refresh();
    });
  }

  function submitReportSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = formObject(event.currentTarget) as Record<string, string>;
    startTransition(async () => {
      const response = await fetch("/api/ops/reports/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewId: form.viewId,
          name: form.name,
          cadence: form.cadence,
          recipients: String(form.recipients || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
          status: form.status || "active",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "定时报表保存失败，请检查填写内容。");
        return;
      }
      setMessage("定时报表配置已保存。");
      router.refresh();
    });
  }

  function runReportSchedules() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/reports/schedules/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; total?: number; sent?: number; skipped?: number; failed?: number };
      if (!response.ok) {
        setError(payload.error || "定时报表执行失败，请检查权限或投递配置。");
        return;
      }
      setMessage(`定时报表已执行：共 ${payload.total ?? 0} 个，已发送 ${payload.sent ?? 0} 个，待配置 ${payload.skipped ?? 0} 个，失败 ${payload.failed ?? 0} 个。`);
      router.refresh();
    });
  }

  function runProductionAutomation() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/automation/run-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50, forceReports: false, minPlatformIntervalMinutes: 30 }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { total?: number; completed?: number; failed?: number; unauthorized?: number };
      };
      if (!response.ok) {
        setError(payload.error || "生产自动化调度执行失败，请检查权限、密钥或子任务配置。");
        return;
      }
      setMessage(`生产自动化调度完成：共 ${payload.summary?.total ?? 0} 项，完成 ${payload.summary?.completed ?? 0} 项，失败 ${payload.summary?.failed ?? 0} 项，权限不足 ${payload.summary?.unauthorized ?? 0} 项。`);
      router.refresh();
    });
  }

  function submitAutomationTaskAction(event: React.FormEvent<HTMLFormElement>, runId: string, taskKey: string) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const action = submitter instanceof HTMLButtonElement ? submitter.value : "";
    const formData = new FormData(form);
    startTransition(async () => {
      const response = await fetch("/api/ops/automation/task-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          taskKey,
          action,
          assignedTo: String(formData.get("assignedTo") ?? ""),
          note: String(formData.get("note") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; task?: { name?: string; handlingStatus?: string; lastRetryStatus?: string } };
      if (!response.ok) {
        setError(payload.error || "自动化失败任务处理失败，请稍后再试。");
        return;
      }
      const actionLabel = action === "retry" ? "已重试" : action === "assign" ? "已指派" : action === "ignore" ? "已忽略" : "已关闭";
      setMessage(`${payload.task?.name || "自动化子任务"}${actionLabel}。`);
      router.refresh();
    });
  }

  function submitNotificationSubscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = formObject(event.currentTarget) as Record<string, string>;
    startTransition(async () => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_subscription",
          sources: String(form.sources || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
          severities: String(form.severities || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
          channels: String(form.channels || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
          enabled: form.enabled !== "paused",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "消息订阅保存失败，请检查填写内容。");
        return;
      }
      setMessage("消息订阅配置已保存。");
      router.refresh();
    });
  }

  function saveSlaRules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const formData = new FormData(event.currentTarget);
    const rules = slaRules.map((rule) => ({
      key: rule.key,
      enabled: formData.get(`${rule.key}:enabled`) === "on",
      overdueHours: Number(formData.get(`${rule.key}:overdueHours`) || rule.overdueHours),
      nearDueHours: Number(formData.get(`${rule.key}:nearDueHours`) || rule.nearDueHours),
      channels: String(formData.get(`${rule.key}:channels`) || "")
        .split(/[\n,，、]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      escalationRole: String(formData.get(`${rule.key}:escalationRole`) || "").trim() || rule.escalationRole,
    }));
    startTransition(async () => {
      const response = await fetch("/api/ops/notifications/sla-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "SLA 提醒规则保存失败，请检查权限和填写内容。");
        return;
      }
      setMessage("SLA 提醒规则已保存，新的站内信和外部通知会按最新规则生成。");
      router.refresh();
    });
  }

  function retryNotificationDelivery(id: string) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/notifications/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "通知投递重试失败，请检查供应商配置。");
        return;
      }
      setMessage("通知投递已重试。");
      router.refresh();
    });
  }

  function testNotificationProvider(channel: NotificationProviderHealth["channel"]) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/notifications/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", channel }),
      });
      const payload = (await response.json().catch(() => ({}))) as { delivery?: NotificationDelivery; error?: string };
      if (!response.ok || !payload.delivery) {
        setError(payload.error || "通知供应商测试失败，请检查 webhook 和令牌配置。");
        return;
      }
      setMessage(`${payload.delivery.channel} 测试投递已完成，当前状态：${payload.delivery.status}。`);
      router.refresh();
    });
  }

  function generateDueNotifications() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/notifications/generate-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200, includeCustomers: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { staffItems?: number; customerItems?: number; generated?: number; queued?: number; blocked?: number };
      };
      if (!response.ok) {
        setError(payload.error || "通知与 SLA 提醒生成失败，请稍后再试。");
        return;
      }
      setMessage(`提醒已生成：员工待办 ${payload.summary?.staffItems ?? 0} 条，客户待办 ${payload.summary?.customerItems ?? 0} 条，新投递 ${payload.summary?.generated ?? 0} 条，待发送 ${payload.summary?.queued ?? 0} 条，阻断 ${payload.summary?.blocked ?? 0} 条。`);
      router.refresh();
    });
  }

  function receivePurchaseReceipt(id: string) {
    submit({ action: "receive_purchase_receipt", id, note: "运营后台整单签收" }, "采购到货已签收，数量已进入待上架库存。");
  }

  function putawayPurchaseReceipt(id: string) {
    submit({ action: "putaway_purchase_receipt", id, note: "运营后台确认上架" }, "采购到货已上架，库存已转为可售。");
  }

  function resolvePurchaseDiscrepancy(purchaseId: string, discrepancyId: string, status: "resolved" | "ignored") {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/warehouse/purchase-receipts/${encodeURIComponent(purchaseId)}/discrepancies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discrepancyId,
          status,
          note: status === "resolved" ? "运营已确认客户处理意见，差异处理完成。" : "运营确认该差异无需继续处理。",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "采购到货差异处理失败。");
        return;
      }
      setMessage(status === "resolved" ? "采购到货差异已处理，并已同步关闭客户工单。" : "采购到货差异已忽略，并已同步关闭客户工单。");
      router.refresh();
    });
  }

  function importPurchaseReceipts() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/ops/mabang-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_purchase_receipts_csv", csv: purchaseCsv }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        result?: { createdRows?: number; skippedRows?: number; issues?: Array<{ row: number; message: string }> };
        error?: string;
      };
      if (!response.ok || !payload.result) {
        setError(payload.error || "采购到货导入失败，请检查 CSV 格式。");
        return;
      }
      const issueText = payload.result.issues?.length ? `，异常 ${payload.result.issues.length} 行` : "";
      setMessage(`采购到货导入完成：创建 ${payload.result.createdRows ?? 0} 单，跳过 ${payload.result.skippedRows ?? 0} 行${issueText}。`);
      router.refresh();
    });
  }

  function updateWorkOrder(id: string, status: CustomerWorkOrderStatus) {
    submit({ action: "update_work_order", id, status }, `工单已更新为 ${status}。`);
  }

  function sendWorkOrderMessage(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) {
      setError("请填写回复内容。");
      return;
    }
    form.reset();
    submit({ action: "add_work_order_message", id, body, nextStatus: "waiting_customer" }, "已回复客户，并标记为待客户补充。");
  }

  const feedback = (
    <>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
    </>
  );

  if (module === "outbound") {
    return (
      <div className="grid gap-4">
        <Panel
          icon={<FileSpreadsheet size={18} className="text-cyan-700" />}
          title="平台订单导入和字段映射"
          aside={
            <>
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=orders">
                <Upload size={15} />
                下载导入模板
              </Link>
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=order-mapping">
                <FileSpreadsheet size={15} />
                字段映射说明
              </Link>
              <ExportLink kind="order-imports">导出导入记录</ExportLink>
              <ExportLink kind="platforms">导出平台配置</ExportLink>
              <ExportLink kind="platform-sync-jobs">导出同步记录</ExportLink>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={syncDuePlatforms} type="button">
                <Play size={15} />
                同步到期平台订单
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={isPending} onClick={reviewPlatformCancellations} type="button">
                <ClipboardList size={15} />
                复核平台取消订单
              </button>
            </>
          }
        >
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="grid gap-4">
              <form className="grid gap-3" onSubmit={(event) => submitForm(event, "平台字段映射已保存。")}>
                <input name="action" type="hidden" value="upsert_platform" />
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="平台">
                    <select className={inputClass} name="platform" defaultValue="amazon">
                      <option value="amazon">Amazon</option>
                      <option value="tiktok_shop">TikTok Shop</option>
                      <option value="shopify">Shopify</option>
                      <option value="ebay">eBay</option>
                      <option value="csv">CSV</option>
                    </select>
                  </Field>
                  <Field label="店铺名称">
                    <input className={inputClass} name="storeName" placeholder="客户店铺名称" required />
                  </Field>
                  <Field label="客户编号">
                    <input className={inputClass} name="customerCode" placeholder="客户编号" required />
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="同步方式">
                    <select className={inputClass} name="syncMode" defaultValue="manual_csv">
                      <option value="manual_csv">CSV 手工导入</option>
                      <option value="api_sandbox">API 沙箱</option>
                      <option value="api_live">API 正式</option>
                    </select>
                  </Field>
                  <Field label="状态">
                    <select className={inputClass} name="status" defaultValue="connected">
                      <option value="draft">草稿</option>
                      <option value="connected">已连接</option>
                      <option value="paused">暂停</option>
                      <option value="error">异常</option>
                    </select>
                  </Field>
                </div>
                <Field label="字段映射">
                  <textarea className={textareaClass} name="mappingText" defaultValue={"orderNo:订单号\nskuCode:SKU\nquantity:数量\nrecipientName:收件人\ndeliveryAddress:地址"} />
                </Field>
                <Field label="API 配置备注">
                  <textarea
                    className={textareaClass}
                    name="note"
                    defaultValue={"Amazon 正式 API：配置 AMAZON_ACCESS_TOKEN、AMAZON_API_BASE_URL，可选 AMAZON_MARKETPLACE_ID=A1F83G8C2ARO7P；推荐通过 SP-API 签名网关暴露拉单和回传地址。\nTikTok Shop 正式 API：配置 TIKTOK_SHOP_ACCESS_TOKEN、TIKTOK_SHOP_API_BASE_URL，可选 TIKTOK_SHOP_APP_KEY、TIKTOK_SHOP_SHOP_ID；推荐通过开放平台签名网关暴露订单搜索和发货回传。\nShopify 正式 API：配置 SHOPIFY_API_BASE_URL=https://your-store.myshopify.com 和 SHOPIFY_ACCESS_TOKEN。\neBay 正式 API：配置 EBAY_ACCESS_TOKEN，可选 EBAY_API_BASE_URL=https://api.ebay.com。\n多店铺可写 credentialRef=EBAY_STORE_A，并在环境变量配置 EBAY_STORE_A_ACCESS_TOKEN、EBAY_STORE_A_API_BASE_URL。"}
                  />
                </Field>
                <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
                  <Cable size={15} />
                  保存平台映射
                </button>
              </form>

              <div>
                <Field label="订单 CSV">
                  <textarea
                    className={`${textareaClass} font-mono text-xs`}
                    onChange={(event) => {
                      setPlatformCsv(event.target.value);
                      setImportPreview(null);
                    }}
                    value={platformCsv}
                  />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={isPending} onClick={runOrderPreview} type="button">
                    <FileSpreadsheet size={15} />
                    先预检异常
                  </button>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-200 bg-white px-4 text-sm font-semibold text-cyan-800 disabled:opacity-60" disabled={isPending || !importPreview} onClick={() => importPreview && downloadCsv("平台订单异常报告.csv", orderPreviewReportRows(importPreview))} type="button">
                    <Download size={15} />
                    下载异常报告
                  </button>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={isPending || !importPreview} onClick={saveOrderDraft} type="button">
                    <Save size={15} />
                    保存预检草稿
                  </button>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending || !importPreview || importPreview.readyOrders === 0} onClick={confirmOrderImport} type="button">
                    <Upload size={15} />
                    确认创建出库单
                  </button>
                </div>
              </div>
              {importPreview ? (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">总行数 {importPreview.totalRows}</span>
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">可创建 {importPreview.readyOrders} 单</span>
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">可导入行 {importPreview.readyRows}</span>
                    <span className="rounded-md bg-white px-2 py-1 font-semibold">异常行 {importPreview.skippedRows}</span>
                  </div>
                  {importPreview.rows.length > 0 ? (
                    <div className="mt-3 max-h-40 overflow-auto rounded-md border border-cyan-100 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-2 py-2">行号</th>
                            <th className="px-2 py-2">订单号</th>
                            <th className="px-2 py-2">客户</th>
                            <th className="px-2 py-2">SKU</th>
                            <th className="px-2 py-2">数量</th>
                            <th className="px-2 py-2">状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.rows.slice(0, 10).map((row, index) => (
                            <tr className="border-t border-slate-100" key={`${row.row}-${row.orderNo}-${row.skuCode}-${index}`}>
                              <td className="px-2 py-2">{row.row}</td>
                              <td className="px-2 py-2">{row.orderNo || "-"}</td>
                              <td className="px-2 py-2">{row.customerCode || "-"}</td>
                              <td className="px-2 py-2">{row.skuCode || "-"}</td>
                              <td className="px-2 py-2">{row.quantity || "-"}</td>
                              <td className="px-2 py-2">{row.status === "ready" ? "可导入" : "需处理"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {importPreview.issues.length > 0 ? (
                    <div className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      {importPreview.issues.slice(0, 5).map((issue) => (
                        <p key={`${issue.row}-${issue.message}`}>
                          第 {issue.row} 行 / {issue.level === "error" ? "错误" : "提醒"}：{issue.message}
                        </p>
                      ))}
                      {importPreview.issues.length > 5 ? <p>还有 {importPreview.issues.length - 5} 条异常或提醒，请导出导入记录后继续复核。</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">批量称重与运费重算</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">导入出库单号、包裹重量和包裹数，系统会按当前物流渠道规则重算预估运费，并记录批量称重审计。</p>
                  </div>
                  <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=outbound-weight">
                    <Download size={14} />
                    下载称重模板
                  </Link>
                </div>
                <textarea className={`${textareaClass} mt-3 font-mono text-xs`} onChange={(event) => setWeightCsv(event.target.value)} value={weightCsv} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} onClick={importOutboundWeights} type="button">
                    <Upload size={15} />
                    导入称重并重算运费
                  </button>
                </div>
              </div>
              {feedback}
            </div>
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-slate-950">平台连接</h3>
              {data.platformConnections.length === 0 ? (
                <Empty text="暂无平台连接。先保存平台、店铺、客户编号和字段映射。" />
              ) : (
                data.platformConnections.slice(0, 4).map((item) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{item.storeName}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.platform} / {item.customerCode} / {item.syncMode}</p>
                      </div>
                      {statusPill(item.status)}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">最后同步：{item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString("zh-CN") : "尚未同步"}</p>
                    {item.note ? <p className="mt-2 rounded-md bg-white p-2 text-xs leading-5 text-slate-600">{item.note}</p> : null}
                    <button className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60" disabled={isPending} onClick={() => syncPlatform(item.id)} type="button">
                      <RadioTower size={13} />
                      立即同步
                    </button>
                  </div>
                ))
              )}

              <h3 className="pt-2 text-sm font-semibold text-slate-950">最近同步记录</h3>
              {data.platformSyncJobs.length === 0 ? (
                <Empty text="暂无平台同步记录。API 沙箱模式可生成订单预检草稿，正式模式会记录凭证或接口异常。" />
              ) : (
                data.platformSyncJobs.slice(0, 5).map((item) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                      {statusPill(item.status === "completed" ? "completed" : "exception")}
                    </div>
                    <p className="mt-2 text-slate-600">{item.storeName} / 拉取 {item.pulledRows} 行 / 可创建 {item.readyOrders} 单 / 异常 {item.issueCount}</p>
                    {(item.cancelledRows ?? 0) > 0 ? (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                        <p className="font-semibold">平台取消/作废订单待复核</p>
                        <p>
                          {(item.cancelledOrders ?? [])
                            .slice(0, 3)
                            .map((order) => `${order.orderNo}${order.matchedOutboundId ? ` / ${order.matchedOutboundId}` : ""}`)
                            .join("；")}
                        </p>
                      </div>
                    ) : null}
                    {item.orderImportBatchId ? (
                      <Link className="mt-2 inline-flex text-xs font-semibold text-cyan-800 hover:text-cyan-950" href={`/ops/imports/${item.orderImportBatchId}`}>
                        查看预检批次 {item.orderImportBatchId}
                      </Link>
                    ) : null}
                    {item.error ? <p className="mt-2 rounded-md border border-rose-100 bg-rose-50 p-2 text-xs leading-5 text-rose-800">{item.error}</p> : null}
                  </div>
                ))
              )}

              <h3 className="text-sm font-semibold text-slate-950">最近导入批次</h3>
              {data.orderImportBatches.length === 0 ? <Empty text="暂无导入批次。先下载模板，填入真实客户编号和 SKU 后导入。" /> : data.orderImportBatches.slice(0, 5).map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <Link className="font-semibold text-cyan-800 hover:text-cyan-950" href={`/ops/imports/${item.id}`}>
                      {item.id}
                    </Link>
                    {statusPill(item.status === "cancelled" ? "cancelled" : item.status === "draft" ? "draft" : item.skippedRows > 0 ? "exception" : "completed")}
                  </div>
                  <p className="mt-2 text-slate-600">
                    {item.status === "cancelled" ? "已取消" : item.status === "draft" ? "预检草稿" : "已创建"} / 总行数 {item.totalRows} / 可创建 {item.readyOrders ?? item.createdOrders} / 异常 {item.skippedRows}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.source} / {item.createdBy}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={`/ops/imports/${item.id}`}>
                      查看详情
                    </Link>
                    <Link className="inline-flex min-h-8 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50" href={`/api/ops/mabang-modules?batchId=${encodeURIComponent(item.id)}&report=issues`}>
                      下载报告
                    </Link>
                    {item.status === "draft" ? (
                      <button className="inline-flex min-h-8 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" disabled={isPending} onClick={() => cancelOrderImportBatch(item.id)} type="button">
                        <XCircle size={13} />
                        取消草稿
                      </button>
                    ) : null}
                  </div>
                  {item.status === "cancelled" ? <p className="mt-2 rounded-md bg-white p-2 text-xs leading-5 text-slate-500">取消原因：{item.cancelReason || "运营取消同步预检批次"}</p> : null}
                  {item.issues.length > 0 ? (
                    <div className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      {item.issues.slice(0, 3).map((issue) => (
                        <p key={`${item.id}-${issue.row}-${issue.message}`}>
                          第 {issue.row} 行 / {issue.level === "error" ? "错误" : "提醒"}：{issue.message}
                        </p>
                      ))}
                      {item.issues.length > 3 ? <p>还有 {item.issues.length - 3} 条异常，可导出导入记录继续复核。</p> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (module === "inbound" || module === "inventory") {
    return (
      <div className="grid gap-4">
        {module === "inbound" ? (
          <Panel
            icon={<Warehouse size={18} className="text-cyan-700" />}
            title="采购补货到货签收"
            aside={
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=purchase-receipt">
                <Download size={15} />
                下载签收模板
              </Link>
            }
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="grid gap-3">
                <form className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3" onSubmit={(event) => submitForm(event, "采购到货单已创建，可在列表中签收。")}>
                  <input name="action" type="hidden" value="create_purchase_receipt" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="客户编号">
                      <input className={inputClass} name="customerCode" placeholder="例如：CUST-202605-3054" required />
                    </Field>
                    <Field label="供应商">
                      <input className={inputClass} name="supplierName" placeholder="例如：义乌供应商A" required />
                    </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="仓库">
                      <input className={inputClass} name="warehouseCode" defaultValue="SHEFFIELD-MAIN" required />
                    </Field>
                    <Field label="预计到仓">
                      <input className={inputClass} name="expectedArrivalDate" type="date" />
                    </Field>
                    <Field label="追踪号">
                      <input className={inputClass} name="trackingNumber" placeholder="头程或快递追踪号" />
                    </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
                    <Field label="SKU 编码">
                      <input className={inputClass} name="skuCode" placeholder="SKU-001" required />
                    </Field>
                    <Field label="商品名称">
                      <input className={inputClass} name="productName" placeholder="商品名称" />
                    </Field>
                    <Field label="预计数量">
                      <input className={inputClass} min="1" name="expectedQty" type="number" defaultValue={1} required />
                    </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="建议库位">
                      <input className={inputClass} name="locationCode" placeholder="例如：RCV-A-01" />
                    </Field>
                    <Field label="批次号">
                      <input className={inputClass} name="lotNo" placeholder="例如：批次-202606" />
                    </Field>
                    <Field label="效期">
                      <input className={inputClass} name="expiryDate" type="date" />
                    </Field>
                  </div>
                  <Field label="备注">
                    <input className={inputClass} name="note" placeholder="例如：客户本周补货，优先签收上架" />
                  </Field>
                  <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
                    <Save size={15} />
                    创建采购到货单
                  </button>
                </form>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">批量导入采购到货</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">使用中文模板填写客户、供应商、SKU、数量、库位和批次信息，导入后生成待签收采购到货单。</p>
                    </div>
                    <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=purchase-receipt">
                      <Download size={14} />
                      模板
                    </Link>
                  </div>
                  <textarea className={`${textareaClass} mt-3 font-mono text-xs`} onChange={(event) => setPurchaseCsv(event.target.value)} value={purchaseCsv} />
                  <button className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} onClick={importPurchaseReceipts} type="button">
                    <Upload size={15} />
                    导入采购到货
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {purchaseReceipts.length === 0 ? (
                  <Empty text="暂无采购到货单。创建后可按单签收，签收数量先进入待上架库存，上架后转为可售。" />
                ) : (
                  purchaseReceipts.slice(0, 6).map((item) => (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-cyan-800">{item.id}</p>
                          <p className="mt-1 font-semibold text-slate-950">{item.supplierName} / {item.customerCode}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.warehouseCode} / {item.trackingNumber || "追踪号待补"} / {item.expectedArrivalDate || "到仓日期待定"}</p>
                        </div>
                        {statusPill(purchaseReceiptStatusLabel(item.status))}
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        <span className="rounded-md bg-white px-2 py-1">预计 {item.totalExpectedQty} 件</span>
                        <span className="rounded-md bg-white px-2 py-1">已签收 {item.totalReceivedQty} 件</span>
                        <span className="rounded-md bg-white px-2 py-1">已上架 {item.totalPutawayQty} 件</span>
                      </div>
                      {item.lines.slice(0, 3).map((line) => (
                        <p className="mt-2 text-xs text-slate-600" key={`${item.id}-${line.skuCode}`}>
                          {line.skuCode} / {line.productName || "商品名待补"} / 预计 {line.expectedQty} / 签收 {line.receivedQty} / 上架 {line.putawayQty}
                        </p>
                      ))}
                      {(item.discrepancyReports ?? []).length > 0 ? (
                        <div className="mt-2 grid gap-2">
                          {(item.discrepancyReports ?? []).slice(0, 3).map((report) => (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950" key={report.id}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold">{report.skuCode || "整单"} / {report.status === "customer_pending" ? "待客户确认" : report.status}</span>
                                {report.workOrderId ? <span className="font-mono text-amber-700">{report.workOrderId}</span> : null}
                              </div>
                              <p className="mt-1 line-clamp-2">{report.description}</p>
                              {report.resolutionNote ? <p className="mt-1 rounded-md bg-white px-2 py-1 text-amber-800">处理说明：{report.resolutionNote}</p> : null}
                              {report.status === "open" || report.status === "customer_pending" ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button className="inline-flex min-h-8 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60" disabled={isPending} onClick={() => resolvePurchaseDiscrepancy(item.id, report.id, "resolved")} type="button">
                                    <CheckCircle2 size={12} />
                                    标记已处理
                                  </button>
                                  <button className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isPending} onClick={() => resolvePurchaseDiscrepancy(item.id, report.id, "ignored")} type="button">
                                    <XCircle size={12} />
                                    忽略
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {item.exceptionNote ? <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{item.exceptionNote}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60" disabled={isPending || ["received", "putaway_completed", "cancelled"].includes(item.status)} onClick={() => receivePurchaseReceipt(item.id)} type="button">
                          <CheckCircle2 size={13} />
                          整单签收
                        </button>
                        <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60" disabled={isPending || !["received", "partially_received"].includes(item.status)} onClick={() => putawayPurchaseReceipt(item.id)} type="button">
                          <Warehouse size={13} />
                          上架入可售
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {feedback}
          </Panel>
        ) : null}

        <Panel
          icon={<ClipboardList size={18} className="text-cyan-700" />}
          title="批量作业中心"
          aside={
            <>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60" disabled={isPending} onClick={runDueBatches} type="button">
                <Play size={15} />
                执行到期任务
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={retryDueBatches} type="button">
                <Play size={15} />
                重试到期异常任务
              </button>
              <ExportLink kind="batch-plans">导出批量任务</ExportLink>
            </>
          }
        >
          <form className="grid gap-3" onSubmit={(event) => submitForm(event, "批量作业任务已进入队列。")}>
            <input name="action" type="hidden" value="create_batch_plan" />
            <input name="targetModule" type="hidden" value={module} />
            <div className="grid gap-3 md:grid-cols-[1fr_190px_150px]">
              <Field label="任务名称">
                <input className={inputClass} name="title" defaultValue={module === "inventory" ? "批量改库位 / 移库" : "批量入库资料导入"} required />
              </Field>
              <Field label="任务类型">
                <select className={inputClass} name="kind" defaultValue={module === "inventory" ? "location_move" : "inbound_import"}>
                  <option value="sku_import">批量导入 SKU</option>
                  <option value="inbound_import">批量入库</option>
                  <option value="location_move">批量改库位</option>
                  <option value="picking_wave">批量生成拣货波次</option>
                  <option value="weighing">批量称重</option>
                  <option value="tracking_upload">批量上传追踪号</option>
                  <option value="export">批量导出</option>
                </select>
              </Field>
              <Field label="记录数">
                <input className={inputClass} name="recordCount" min="0" type="number" defaultValue={0} />
              </Field>
            </div>
            <Field label="备注">
              <input className={inputClass} name="note" placeholder="例如：按模板导入后进入运营复核队列" />
            </Field>
            <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              <Save size={15} />
              创建批量任务
            </button>
          </form>
          <div className="mt-4 grid gap-2">
            {data.batchOperationPlans.length === 0 ? <Empty text="暂无批量任务。可以先创建导入、改库位、拣货波次或追踪号上传任务。" /> : data.batchOperationPlans.slice(0, 6).map((item) => (
              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:flex-row lg:items-center lg:justify-between" key={item.id}>
                <div>
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-slate-600">{item.kind} / {item.targetModule} / {item.recordCount} 条</p>
                  <p className="mt-1 text-xs text-slate-500">尝试 {item.attempts ?? 0}/{item.maxAttempts ?? 3}{item.nextRunAt ? ` / 下次执行 ${new Date(item.nextRunAt).toLocaleString("zh-CN")}` : ""}{item.lastError ? ` / 错误：${item.lastError}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {statusPill(item.status)}
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700" onClick={() => updateBatch(item.id, "processing")} type="button"><Play size={13} />开始</button>
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700" onClick={() => updateBatch(item.id, "completed")} type="button"><CheckCircle2 size={13} />完成</button>
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-700" onClick={() => updateBatch(item.id, "exception")} type="button"><XCircle size={13} />异常</button>
                  {item.status === "exception" ? <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-700" onClick={() => retryBatch(item.id)} type="button"><Play size={13} />重试</button> : null}
                </div>
              </div>
            ))}
          </div>
          {feedback}
        </Panel>

        <Panel icon={<Warehouse size={18} className="text-cyan-700" />} title="WMS 库区、库位与库存控制策略" aside={<ExportLink kind="wms-policies">导出 WMS 策略</ExportLink>}>
          <form className="grid gap-3" onSubmit={(event) => submitForm(event, "WMS 控制策略已保存。")}>
            <input name="action" type="hidden" value="upsert_wms_policy" />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="仓库编码">
                <input className={inputClass} name="warehouseCode" defaultValue="SHEFFIELD-MAIN" required />
              </Field>
              <Field label="策略名称">
                <input className={inputClass} name="name" defaultValue="库位容量与先进先出策略" required />
              </Field>
            </div>
            <Field label="库位层级">
              <input className={inputClass} name="zonePath" defaultValue="仓库 > 库区 > 货架 > 层 > 库位" />
            </Field>
            <Field label="容量规则">
              <input className={inputClass} name="capacityRule" defaultValue="按库位 CBM、SKU 件数、冻结状态和残次品状态校验。" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="库存控制">
                <textarea className={textareaClass} name="stockControls" defaultValue={"冻结库存\n残次品库存\n移库\n盘盈盘亏审批"} />
              </Field>
              <Field label="批次控制">
                <textarea className={textareaClass} name="batchControls" defaultValue={"先进先出\n批次号\n效期管理\n序列号管理"} />
              </Field>
            </div>
            <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              <PackageSearch size={15} />
              保存 WMS 策略
            </button>
          </form>
        </Panel>
      </div>
    );
  }

  if (module === "logistics") {
    return (
      <div className="grid gap-4">
        <Panel icon={<RadioTower size={18} className="text-cyan-700" />} title="真实物流渠道闭环配置" aside={<ExportLink kind="logistics-channels">导出物流渠道</ExportLink>}>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            {[
              ["可上线渠道", data.logisticsChannels.filter((item) => logisticsChannelHealth(item).label === "可上线").length, "text-emerald-700"],
              ["沙箱验证中", data.logisticsChannels.filter((item) => item.status === "sandbox").length, "text-cyan-700"],
              ["待补齐配置", data.logisticsChannels.filter((item) => logisticsChannelHealth(item).label === "待补齐").length, "text-amber-700"],
              ["暂停渠道", data.logisticsChannels.filter((item) => item.status === "paused").length, "text-rose-700"],
            ].map(([label, value, className]) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={label}>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className={`mt-1 text-2xl font-semibold ${className}`}>{value}</p>
              </div>
            ))}
          </div>
          <form className="grid gap-3" onSubmit={(event) => submitForm(event, "物流渠道配置已保存。")}>
            <input name="action" type="hidden" value="upsert_logistics_channel" />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="承运商">
                <input className={inputClass} name="carrierName" placeholder="Royal Mail / Evri / DPD" required />
              </Field>
              <Field label="服务">
                <input className={inputClass} name="serviceName" placeholder="Tracked 24/48" required />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="API 模式">
                <select className={inputClass} name="apiMode" defaultValue="sandbox">
                  <option value="manual">手工</option>
                  <option value="sandbox">沙箱</option>
                  <option value="live">正式</option>
                </select>
              </Field>
              <Field label="状态">
                <select className={inputClass} name="status" defaultValue="sandbox">
                  <option value="draft">草稿</option>
                  <option value="sandbox">沙箱</option>
                  <option value="active">启用</option>
                  <option value="paused">暂停</option>
                </select>
              </Field>
              <Field label="轨迹回传地址">
                <input className={inputClass} name="trackingWebhook" placeholder="/api/webhooks/carriers/provider" />
              </Field>
              <Field label="凭证引用">
                <input className={inputClass} name="credentialRef" placeholder="例如：ROYAL_MAIL_API_KEY" />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="能力">
                <textarea className={textareaClass} name="enabledFeatures" defaultValue={"面单购买\n轨迹自动回传\n派送失败处理\n签收证明\n物流赔付"} />
              </Field>
              <Field label="附加费规则">
                <textarea className={textareaClass} name="surchargeRules" defaultValue={"偏远附加费\n燃油费\n超尺寸费\n渠道黑名单"} />
              </Field>
            </div>
            <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              <Save size={15} />
              保存物流渠道
            </button>
          </form>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.logisticsChannels.length === 0 ? <Empty text="暂无物流渠道。先配置承运商、API 模式和附加费规则。" /> : data.logisticsChannels.map((item) => {
              const health = logisticsChannelHealth(item);
              return (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{item.carrierName} / {item.serviceName}</p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {statusPill(item.status)}
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${health.tone}`}>{health.label}</span>
                  </div>
                </div>
                <p className="mt-2 text-slate-600">{item.apiMode} / 凭证：{item.credentialRef || "未配置"} / {item.enabledFeatures.join("、") || "未配置能力"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {health.issues.map((issue) => (
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${issue === "配置完整" ? "border-emerald-200 bg-white text-emerald-700" : "border-amber-200 bg-white text-amber-800"}`} key={issue}>
                      {issue === "配置完整" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {issue}
                    </span>
                  ))}
                </div>
                {item.trackingWebhook ? <p className="mt-2 font-mono text-xs text-slate-500">Webhook：{item.trackingWebhook}</p> : null}
              </div>
              );
            })}
          </div>
          {feedback}
        </Panel>

        <Panel
          icon={<PoundSterling size={18} className="text-cyan-700" />}
          title="承运商账单导入与运费差异核对"
          aside={
            <>
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=carrier-bill">
                <Download size={15} />
                下载账单模板
              </Link>
              <ExportLink kind="carrier-bills">导出核对批次</ExportLink>
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-slate-600">上传承运商账单后，系统会按追踪号或出库单号匹配出库单，把实际运费写回订单，并统计与预估运费的差异。</p>
              <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                <Upload size={15} />
                上传承运商账单 CSV
                <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={uploadCarrierBill} type="file" />
              </label>
              <div className="mt-4 rounded-md border border-cyan-100 bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">匹配规则</p>
                <p>优先按追踪号匹配；没有追踪号时按出库单号匹配。差异绝对值达到 £1 会计入差异行。</p>
              </div>
            </div>
            <div className="grid gap-2">
              {data.carrierBillImportBatches.length === 0 ? (
                <Empty text="暂无承运商账单核对批次。导入真实账单后可在这里追踪匹配、跳过和差异情况。" />
              ) : (
                data.carrierBillImportBatches.slice(0, 6).map((item) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link className="font-mono text-xs font-semibold text-cyan-800 hover:text-cyan-950" href={`/ops/carrier-bills/${item.id}`}>{item.id}</Link>
                      {statusPill(item.diffRows > 0 || item.skippedRows > 0 ? "exception" : "completed")}
                    </div>
                    <p className="mt-2 font-semibold text-slate-950">{item.fileName}</p>
                    <p className="mt-1 text-slate-600">
                      匹配 {item.matchedRows}/{item.totalRows} 行 / 跳过 {item.skippedRows} 行 / 差异 {item.diffRows} 行
                    </p>
                    <p className="mt-1 text-xs text-slate-500">账单 £{item.totalBilledAmount.toFixed(2)} / 差异 £{item.totalDiffAmount.toFixed(2)} / {item.createdBy}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          {feedback}
        </Panel>
      </div>
    );
  }

  if (module === "billing") {
    return (
      <div className="grid gap-4">
      <Panel icon={<PoundSterling size={18} className="text-cyan-700" />} title="费用规则、月结与付款核销配置" aside={<ExportLink kind="billing-rules">导出费用规则</ExportLink>}>
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "费用规则已保存，后续生成账单可复用。")}>
          <input name="action" type="hidden" value="upsert_billing_rule" />
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="费用名称">
              <input className={inputClass} name="feeName" placeholder="仓租 / 操作费 / 偏远附加费" required />
            </Field>
            <Field label="费用类型">
              <select className={inputClass} name="feeType" defaultValue="operation">
                <option value="storage">仓租</option>
                <option value="operation">操作费</option>
                <option value="labeling">贴标/换箱</option>
                <option value="return">退货质检</option>
                <option value="oversize">超尺寸</option>
                <option value="remote_area">偏远</option>
                <option value="fuel">燃油</option>
                <option value="manual">人工服务</option>
              </select>
            </Field>
            <Field label="单位">
              <input className={inputClass} name="unitLabel" placeholder="单 / 箱 / 件 / 月" required />
            </Field>
            <Field label="单价">
              <input className={inputClass} name="unitPrice" type="number" step="0.01" min="0" defaultValue="0" />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="结算周期">
              <select className={inputClass} name="settlementCycle" defaultValue="monthly">
                <option value="realtime">实时</option>
                <option value="weekly">周结</option>
                <option value="monthly">月结</option>
              </select>
            </Field>
            <Field label="客户范围">
              <select className={inputClass} name="customerScope" defaultValue="verified">
                <option value="all">全部客户</option>
                <option value="verified">认证客户</option>
                <option value="custom">指定客户</option>
              </select>
            </Field>
          </div>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <Save size={15} />
            保存费用规则
          </button>
        </form>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {data.billingRules.length === 0 ? <Empty text="暂无费用规则。上线前至少配置仓租、出库操作、贴标、退货质检和物流附加费。" /> : data.billingRules.map((item) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-950">{item.feeName}</p>
                {statusPill(item.status)}
              </div>
              <p className="mt-2 text-slate-600">£{item.unitPrice} / {item.unitLabel} / {item.settlementCycle}</p>
            </div>
          ))}
        </div>
        {feedback}
      </Panel>
      <Panel
        icon={<PoundSterling size={18} className="text-cyan-700" />}
        title="银行流水导入与自动核销"
        aside={
          <>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/api/ops/mabang-modules?template=payment-reconciliation">
              <Download size={15} />
              下载流水模板
            </Link>
            <ExportLink kind="payment-imports">导出核销批次</ExportLink>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-600">
              上传银行收款流水后，系统会按账单编号、月结单号、付款参考号或客户编号加金额进行保守匹配。只有金额一致且唯一命中的记录会自动核销；多候选、争议账单或币种不一致会留给人工复核。
            </p>
            <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Upload size={15} />
              上传银行流水 CSV
              <input accept=".csv,text/csv" className="sr-only" disabled={isPending} onChange={uploadPaymentReconciliation} type="file" />
            </label>
            <div className="mt-4 grid gap-2 text-xs leading-5 text-slate-600">
              <div className="rounded-md border border-cyan-100 bg-white p-3">
                <p className="font-semibold text-slate-950">自动核销规则</p>
                <p>金额必须一致；单笔账单唯一命中时核销单笔，多条同月账单合计金额一致时核销月结。</p>
              </div>
              <div className="rounded-md border border-amber-100 bg-white p-3">
                <p className="font-semibold text-amber-900">人工复核规则</p>
                <p>多条候选、争议状态、非 GBP 币种、金额不一致、找不到客户或账单时，只记录跳过原因，不自动改账。</p>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            {data.paymentReconciliationImportBatches.length === 0 ? (
              <Empty text="暂无银行流水核销批次。导入真实收款流水后，可在这里查看自动核销、待复核和明细下载。" />
            ) : (
              data.paymentReconciliationImportBatches.slice(0, 6).map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-cyan-800">{item.id}</p>
                    {statusPill(item.skippedRows > 0 ? "exception" : "completed")}
                  </div>
                  <p className="mt-2 font-semibold text-slate-950">{item.fileName}</p>
                  <p className="mt-1 text-slate-600">
                    自动核销 {item.matchedRows}/{item.totalRows} 行 / 月结 {item.statementRows} 行 / 待复核 {item.skippedRows} 行
                  </p>
                  <p className="mt-1 text-xs text-slate-500">流水 £{item.totalAmount.toFixed(2)} / 已核销 £{item.matchedAmount.toFixed(2)} / {item.createdBy}</p>
                  <Link className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50" href={`/api/ops/mabang-modules?batchId=${encodeURIComponent(item.id)}&report=payment-reconciliation-detail`}>
                    <Download size={13} />
                    下载核销明细
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
        <PaymentReconciliationReviewBoard batches={data.paymentReconciliationImportBatches} />
        {feedback}
      </Panel>
      </div>
    );
  }

  if (module === "permissions") {
    const whitelistRisks = staffWhitelist.flatMap((account) => account.risks);
    return (
      <div className="grid gap-4">
        <Panel icon={<ShieldCheck size={18} className="text-cyan-700" />} title="员工白名单准入状态" aside={<ReportDownloadLink href="/api/ops/reports/staff-access">导出员工准入</ReportDownloadLink>}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">可登录员工</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{staffWhitelist.length}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">账号来源</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{staffWhitelist[0]?.source ?? "未配置"}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">准入风险</p>
              <p className={`mt-2 text-lg font-semibold ${whitelistRisks.length > 0 ? "text-amber-800" : "text-emerald-800"}`}>{whitelistRisks.length > 0 ? `${new Set(whitelistRisks).size} 项需复核` : "未发现风险"}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {staffWhitelist.length === 0 ? (
              <Empty text="暂无员工白名单。生产后台上线前需要配置 STAFF_WHITELIST_JSON，只允许指定员工登录。" />
            ) : (
              staffWhitelist.map((account) => (
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={`${account.username}-${account.role}`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{account.displayName}</p>
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{account.roleLabel}</span>
                      <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{account.source}</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-slate-500">{account.username}</p>
                    <p className="mt-1 text-xs text-slate-500">{account.risks.length > 0 ? `风险：${account.risks.join("、")}` : "登录准入正常，密码不会在后台页面展示。"}</p>
                  </div>
                  <div className="flex items-center lg:justify-end">{accessRiskPill(account.risks)}</div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel icon={<ShieldCheck size={18} className="text-cyan-700" />} title="正式员工账号治理">
          <form className="grid gap-3" onSubmit={submitStaffAccount}>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Field label="员工账号">
                <input className={inputClass} name="username" placeholder="例如：ops01" required />
              </Field>
              <Field label="显示名称">
                <input className={inputClass} name="displayName" placeholder="例如：运营一号" required />
              </Field>
              <Field label="角色">
                <select className={inputClass} name="role" defaultValue="ops">
                  <option value="admin">系统管理员</option>
                  <option value="ops">运营</option>
                  <option value="warehouse">仓库</option>
                  <option value="finance">财务</option>
                </select>
              </Field>
              <Field label="初始/重置密码">
                <input className={inputClass} name="password" placeholder="新员工必填" type="password" />
              </Field>
              <Field label="禁用原因">
                <input className={inputClass} name="reason" placeholder="禁用时填写" />
              </Field>
              <Field label="二次确认">
                <input className={inputClass} name="confirmation" placeholder="命中敏感规则时输入员工账号" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit" value="upsert">
                <Save size={15} />
                保存员工账号
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                disabled={isPending}
                type="submit"
                value="disable"
              >
                禁用该账号
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-200 bg-white px-4 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                disabled={isPending}
                type="submit"
                value="unlock"
              >
                解除登录锁定
              </button>
            </div>
          </form>
          <div className="mt-4 grid gap-2">
            {managedStaffAccounts.length === 0 ? (
              <Empty text="暂无正式员工账号。上线前建议至少创建管理员、运营、仓库三个正式账号。" />
            ) : (
              managedStaffAccounts.map((account) => {
                const pendingChange = account.pendingRoleChange?.status === "pending" ? account.pendingRoleChange : null;
                return (
                  <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={account.username}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{account.displayName}</p>
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{staffRoleLabel[account.role]}</span>
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{account.status === "disabled" ? "已禁用" : account.status === "invited" ? "已邀请" : "可登录"}</span>
                        {pendingChange ? <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">角色变更待审批</span> : null}
                      </div>
                      <p className="mt-2 font-mono text-xs text-slate-500">{account.username}</p>
                      <p className="mt-1 text-xs text-slate-500">邀请人：{account.invitedBy}；更新时间：{new Date(account.updatedAt).toLocaleString("zh-CN", { hour12: false })}</p>
                      {account.lastLoginAt ? <p className="mt-1 text-xs text-slate-500">最近登录：{new Date(account.lastLoginAt).toLocaleString("zh-CN", { hour12: false })}</p> : null}
                      {account.failedLoginCount ? <p className="mt-1 text-xs font-semibold text-amber-700">连续失败登录：{account.failedLoginCount} 次{account.lastFailedLoginAt ? `；最近失败：${new Date(account.lastFailedLoginAt).toLocaleString("zh-CN", { hour12: false })}` : ""}</p> : null}
                      {account.lockedUntil ? <p className="mt-1 text-xs font-semibold text-rose-700">登录锁定时间：{new Date(account.lockedUntil).toLocaleString("zh-CN", { hour12: false })}</p> : null}
                      {account.lastFailedLoginReason ? <p className="mt-1 text-xs text-slate-500">最近失败原因：{account.lastFailedLoginReason}</p> : null}
                      {account.disabledReason ? <p className="mt-1 text-xs font-semibold text-rose-700">禁用原因：{account.disabledReason}</p> : null}
                      {pendingChange ? (
                        <div className="mt-2 rounded-md border border-amber-200 bg-white p-2 text-xs leading-5 text-amber-900">
                          <p className="font-semibold">申请角色：{staffRoleLabel[pendingChange.currentRole]} → {staffRoleLabel[pendingChange.requestedRole]}</p>
                          <p>申请人：{pendingChange.requestedBy}；申请时间：{new Date(pendingChange.requestedAt).toLocaleString("zh-CN", { hour12: false })}</p>
                        </div>
                      ) : null}
                    </div>
                    {pendingChange ? (
                      <div className="grid gap-2 lg:min-w-60 lg:justify-end">
                        <input
                          className={inputClass}
                          onChange={(event) => setStaffRoleReviewConfirmation((current) => ({ ...current, [account.username]: event.target.value }))}
                          placeholder="二次确认：输入员工账号"
                          value={staffRoleReviewConfirmation[account.username] ?? ""}
                        />
                        <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                        <button className="inline-flex min-h-9 items-center gap-1 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={() => reviewStaffRoleChange(account.username, "approve")} type="button">
                          审批通过
                        </button>
                        <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" disabled={isPending} onClick={() => reviewStaffRoleChange(account.username, "reject")} type="button">
                          驳回
                        </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">正式员工账号会优先于环境变量白名单校验。生产环境仍可保留 `STAFF_WHITELIST_JSON` 作为紧急兜底。</p>
        </Panel>

        <Panel icon={<RadioTower size={18} className="text-cyan-700" />} title="消息订阅与 SLA 提醒">
          <form className="grid gap-3" onSubmit={submitNotificationSubscription}>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="消息来源">
                <textarea className={textareaClass} name="sources" defaultValue={"inbound\noutbound\nlogistics\nbilling\nwork_order\napproval\nsystem"} />
              </Field>
              <Field label="提醒级别">
                <textarea className={textareaClass} name="severities" defaultValue={"critical\nwarning"} />
              </Field>
              <Field label="通知渠道">
                <textarea className={textareaClass} name="channels" defaultValue={"站内信\n邮件\n短信\n微信"} />
              </Field>
            </div>
            <Field label="状态">
              <select className={inputClass} name="enabled" defaultValue="active">
                <option value="active">启用</option>
                <option value="paused">暂停</option>
              </select>
            </Field>
            <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              <Save size={15} />
              保存消息订阅
            </button>
          </form>
          <p className="mt-3 text-xs leading-5 text-slate-500">站内信已在系统内生效；邮件、短信和微信会在配置供应商密钥后由同一订阅规则触发。</p>
          {notificationProviderHealth.length > 0 ? (
            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">通知供应商健康</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">检查邮件、短信、微信 webhook 与令牌配置；上线前建议逐个渠道完成测试投递。</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {notificationProviderHealth.map((provider) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={provider.channel}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-950">{provider.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{provider.webhookEnv}</p>
                      </div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${provider.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                        {provider.configured ? "已配置" : "未配置"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-1">{provider.tokenConfigured ? "令牌已配置" : "令牌未配置"}</span>
                      {provider.usesFallbackWebhook ? <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">使用统一 webhook</span> : null}
                    </div>
                    <button className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-md border border-cyan-200 bg-white px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60" disabled={isPending} onClick={() => testNotificationProvider(provider.channel)} type="button">
                      测试投递
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {slaRules.length > 0 ? (
            <form className="mt-4 grid gap-3" onSubmit={saveSlaRules}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-950">SLA 提醒规则</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">按业务环节配置即将超时、已经超时和升级角色，保存后会影响站内待办、邮件/短信/微信投递和自动生成提醒。</p>
                </div>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
                  <Save size={14} />
                  保存 SLA 规则
                </button>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {slaRules.map((rule) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={rule.key}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{rule.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{rule.description}</p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <input className="h-4 w-4 rounded border-slate-300 text-cyan-700" defaultChecked={rule.enabled} name={`${rule.key}:enabled`} type="checkbox" />
                        启用
                      </label>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-4">
                      <Field label="超时小时">
                        <input className={inputClass} defaultValue={rule.overdueHours} min={0} name={`${rule.key}:overdueHours`} type="number" />
                      </Field>
                      <Field label="预警小时">
                        <input className={inputClass} defaultValue={rule.nearDueHours} min={0} name={`${rule.key}:nearDueHours`} type="number" />
                      </Field>
                      <Field label="升级角色">
                        <input className={inputClass} defaultValue={rule.escalationRole} name={`${rule.key}:escalationRole`} />
                      </Field>
                      <Field label="通知渠道">
                        <input className={inputClass} defaultValue={rule.channels.join("、")} name={`${rule.key}:channels`} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </form>
          ) : null}
          <div className="mt-4 grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">外部通知投递台账</p>
              <div className="flex flex-wrap items-center gap-2">
                <button className="inline-flex min-h-9 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending} onClick={generateDueNotifications} type="button">
                  立即生成提醒
                </button>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{notificationDeliveries.length} 条</span>
              </div>
            </div>
            {notificationDeliveries.length === 0 ? (
              <Empty text="暂无邮件、短信或微信投递记录。配置订阅渠道后，系统会自动生成可追踪的投递台账。" />
            ) : (
              notificationDeliveries.slice(0, 8).map((delivery) => (
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={delivery.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{delivery.title}</p>
                      {statusPill(delivery.channel)}
                      {statusPill(delivery.status === "sent" ? "已发送" : delivery.status === "queued" ? "待发送" : delivery.status === "failed" ? "失败" : "待配置")}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{delivery.body}</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">{delivery.source} / {delivery.sourceId} / 尝试 {delivery.attempts} 次</p>
                    {delivery.lastError ? <p className="mt-1 text-xs font-semibold text-rose-700">{delivery.lastError}</p> : null}
                    {delivery.nextRetryAt ? <p className="mt-1 text-xs text-amber-700">建议重试：{new Date(delivery.nextRetryAt).toLocaleString("zh-CN", { hour12: false })}</p> : null}
                  </div>
                  {delivery.status !== "sent" ? (
                    <button className="inline-flex min-h-9 items-center justify-center rounded-md border border-cyan-200 bg-white px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60" disabled={isPending} onClick={() => retryNotificationDelivery(delivery.id)} type="button">
                      重试投递
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel icon={<LockKeyhole size={18} className="text-cyan-700" />} title="角色权限矩阵" aside={<ExportLink kind="permissions">导出权限</ExportLink>}>
          <div className="grid gap-2 md:grid-cols-2">
            {data.rolePermissions.length === 0 ? (
              <Empty text="暂无自定义角色权限。系统会按默认角色开放对应模块，上线前建议为运营、仓库和财务分别确认权限。" />
            ) : (
              data.rolePermissions.map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.role}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">{item.role}</p>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{item.requireSecondConfirm ? "敏感操作二次确认" : "未开启二次确认"}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">模块：{item.allowedModules.join("、") || "未配置"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">敏感操作：{item.sensitiveActions.join("、") || "未配置"}</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel icon={<ShieldCheck size={18} className="text-cyan-700" />} title="审批规则中心" aside={<ExportLink kind="approval-rules">导出审批规则</ExportLink>}>
          <div className="grid gap-2">
            {data.approvalRules.length === 0 ? (
              <Empty text="暂无审批规则。建议先配置库存调整、账单锁定、运费差异和客户暂停的审批口径。" />
            ) : (
              data.approvalRules.slice(0, 8).map((item) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    {statusPill(item.status)}
                  </div>
                  <p className="mt-1 text-slate-600">
                    {approvalTriggerLabel[item.trigger] ?? item.trigger} / 审批角色 {item.approverRoles.join("、")} / SLA {item.slaHours} 小时
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.minAmount ? `金额达到 £${item.minAmount.toFixed(2)} 触发；` : ""}
                    {item.minQuantity ? `数量达到 ${item.minQuantity} 件触发；` : ""}
                    {item.requireReason ? "需原因；" : ""}
                    {item.requireAttachment ? "需附件；" : ""}
                    {item.escalationRole ? `超时升级给 ${item.escalationRole}` : "不自动升级"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    );
  }

  const latestAutomationRun = automationRuns[0];
  const automationFailureTasks = automationRuns.flatMap((run) =>
    run.results
      .filter((task) => task.status !== "completed" && !["ignored", "resolved"].includes(task.handlingStatus ?? "open"))
      .map((task) => ({ ...task, run })),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="xl:col-span-3">
        <Panel
          icon={<Play size={18} className="text-cyan-700" />}
          title="生产自动化运行看板"
          aside={
            <>
              <ReportDownloadLink href="/api/ops/reports/automation-runs">导出运行记录</ReportDownloadLink>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={runProductionAutomation} type="button">
                <Play size={15} />
                执行到期任务巡检
              </button>
            </>
          }
        >
          {latestAutomationRun ? (
            <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">最近一次运行</p>
                  {statusPill(latestAutomationRun.status === "completed" ? "全部完成" : latestAutomationRun.status === "partial_failed" ? "部分失败" : "全部失败")}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {new Date(latestAutomationRun.startedAt).toLocaleString("zh-CN")} / {latestAutomationRun.trigger === "cron" ? "定时任务" : "手动执行"} / {latestAutomationRun.actorName}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <span className="rounded-md border border-slate-200 bg-white p-2 font-semibold text-slate-700">总数<br />{latestAutomationRun.summary.total}</span>
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 p-2 font-semibold text-emerald-800">完成<br />{latestAutomationRun.summary.completed}</span>
                  <span className="rounded-md border border-rose-200 bg-rose-50 p-2 font-semibold text-rose-800">失败<br />{latestAutomationRun.summary.failed}</span>
                  <span className="rounded-md border border-amber-200 bg-amber-50 p-2 font-semibold text-amber-800">权限<br />{latestAutomationRun.summary.unauthorized}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">{latestAutomationRun.nextAction}</p>
              </div>
              <div className="grid gap-2">
                {automationFailureTasks.length === 0 ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">最近自动化任务未发现失败项。</div>
                ) : (
                  automationFailureTasks.slice(0, 5).map((item) => (
                    <div className="grid gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={`${item.run.id}-${item.key}`}>
                      <div>
                        <p className="font-semibold text-rose-950">{item.name}</p>
                        <p className="mt-1 text-xs leading-5 text-rose-800">{item.summary}</p>
                        <p className="mt-1 text-xs text-rose-700">{new Date(item.run.startedAt).toLocaleString("zh-CN")} / {item.endpoint}</p>
                        <p className="mt-1 text-xs text-rose-700">
                          处理状态：{item.handlingStatus === "assigned" ? "已指派" : item.handlingStatus === "ignored" ? "已忽略" : item.handlingStatus === "resolved" ? "已解决" : "待处理"}
                          {item.assignedTo ? ` / 负责人：${item.assignedTo}` : ""}
                          {item.retryCount ? ` / 已重试 ${item.retryCount} 次` : ""}
                        </p>
                        <form className="mt-2 grid gap-2 md:grid-cols-[minmax(120px,180px)_1fr_auto]" onSubmit={(event) => submitAutomationTaskAction(event, item.run.id, item.key)}>
                          <input className="min-h-9 rounded-md border border-rose-200 bg-white px-2 text-xs outline-none focus:border-rose-400" name="assignedTo" placeholder="负责人" defaultValue={item.assignedTo ?? ""} />
                          <input className="min-h-9 rounded-md border border-rose-200 bg-white px-2 text-xs outline-none focus:border-rose-400" name="note" placeholder="处理备注" defaultValue={item.handlingNote ?? ""} />
                          <span className="grid grid-cols-4 gap-1">
                            <button className="min-h-9 rounded-md bg-slate-950 px-2 text-xs font-semibold text-white disabled:opacity-60" disabled={isPending} name="action" type="submit" value="retry">重试</button>
                            <button className="min-h-9 rounded-md border border-amber-200 bg-white px-2 text-xs font-semibold text-amber-800 disabled:opacity-60" disabled={isPending} name="action" type="submit" value="assign">指派</button>
                            <button className="min-h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 disabled:opacity-60" disabled={isPending} name="action" type="submit" value="ignore">忽略</button>
                            <button className="min-h-9 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-800 disabled:opacity-60" disabled={isPending} name="action" type="submit" value="resolve">关闭</button>
                          </span>
                        </form>
                      </div>
                      <span className="inline-flex h-fit rounded-md border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-800">{item.status === "unauthorized" ? "权限不足" : "失败"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Empty text="暂无自动化运行记录。可以点击执行到期任务巡检，或配置 Cron 定时调用 /api/ops/automation/run-due。" />
          )}
          {feedback}
        </Panel>
      </div>
      <div className="xl:col-span-3">
        <Panel icon={<Cable size={18} className="text-cyan-700" />} title="客户自助工单处理队列" aside={<ExportLink kind="work-orders">导出工单</ExportLink>}>
          <div className="grid gap-3">
            {data.selfServiceWorkOrders.length === 0 ? (
              <Empty text="暂无客户自助工单。客户可在工作台提交物流异常、库存调整、账单争议、退货售后或资料补充。" />
            ) : (
              data.selfServiceWorkOrders.slice(0, 8).map((item) => (
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={item.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-semibold text-slate-500">{item.id}</p>
                      {statusPill(item.status)}
                      {item.priority === "urgent" ? <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">紧急</span> : null}
                      {item.financeReviewRequired ? <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">财务复核</span> : null}
                      {item.riskTag === "logistics_fee_review" ? <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">运费差异</span> : null}
                      {item.riskTag === "billing_dispute" ? <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800">账单争议</span> : null}
                    </div>
                    <h3 className="mt-2 font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-slate-600">{item.customerCode} / {item.category}{item.referenceNo ? ` / ${item.referenceNo}` : ""}</p>
                    <p className="mt-2 line-clamp-2 text-slate-600">{item.description}</p>
                    {item.customerContact ? <p className="mt-1 text-xs text-slate-500">联系方式：{item.customerContact}</p> : null}
                    {item.internalNote ? <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">内部提示：{item.internalNote}</p> : null}
                    {item.linkedDownloadHref ? (
                      <Link className="mt-2 inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-slate-300" href={item.linkedDownloadHref}>
                        查看证据/账单
                      </Link>
                    ) : null}
                    {(item.messages ?? []).filter((note) => note.visibleToCustomer).length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {(item.messages ?? [])
                          .filter((note) => note.visibleToCustomer)
                          .slice(-3)
                          .map((note) => (
                            <div className={`rounded-md border p-2 text-xs leading-5 ${note.authorRole === "customer" ? "border-slate-200 bg-white text-slate-600" : "border-cyan-100 bg-cyan-50 text-cyan-900"}`} key={note.id}>
                              <p className="font-semibold">{note.authorRole === "customer" ? "客户" : note.authorName} · {new Date(note.createdAt).toLocaleString("zh-CN")}</p>
                              <p className="mt-1">{note.body}</p>
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {item.status !== "resolved" && item.status !== "cancelled" ? (
                      <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => sendWorkOrderMessage(event, item.id)}>
                        <input className={inputClass} name="body" placeholder="回复客户，例如：请补充照片、平台订单号或改派地址" />
                        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} type="submit">
                          <Send size={14} />
                          回复客户
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 text-xs font-semibold text-cyan-800" onClick={() => updateWorkOrder(item.id, "processing")} type="button">
                      <Play size={13} />
                      接单
                    </button>
                    <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-violet-200 bg-white px-2 text-xs font-semibold text-violet-800" onClick={() => updateWorkOrder(item.id, "waiting_customer")} type="button">
                      <Upload size={13} />
                      待补充
                    </button>
                    <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-800" onClick={() => updateWorkOrder(item.id, "resolved")} type="button">
                      <CheckCircle2 size={13} />
                      关闭
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {feedback}
        </Panel>
      </div>

      <Panel
        icon={<BarChart3 size={18} className="text-cyan-700" />}
        title="高级筛选、保存视图与运营报表"
        aside={
          <>
            <ReportDownloadLink href="/api/ops/reports/inventory?kind=aging">导出库龄</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/inventory?kind=turnover">导出进销存</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/inventory?kind=reconcile">导出库存对账</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/inventory?kind=aging&risk=低于预警">导出低库存</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/sla?result=超时">导出超时单</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/sla?module=logistics">导出物流异常</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/platform-sync">导出平台同步任务</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/notification-deliveries">导出通知投递台账</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/returns?returnStatus=needs-decision">导出退货待确认</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/exceptions?severity=严重">导出严重异常</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/scans">导出扫码留痕</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/outbound-lot-allocation">导出出库批次分配</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/outbound-review">导出出库复核差异</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/pick-waves">导出波次执行效率</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/carrier-labels">导出承运商面单生命周期</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/carrier-claims">导出承运商赔付台账</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/locations">导出库位利用率</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/inventory-lots">导出库存批次风险</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/data-quality">导出数据质量巡检</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/profit">导出利润/成本</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/charge-events">导出费用事件台账</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/automation-runs">导出自动化运行记录</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/billing-aging">导出应收账龄</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/payment-review">导出付款复核</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/payment-reconciliation">导出收款核销</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/finance-adjustments">导出调账/赔付审批</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/customer-credit">导出客户信用风险</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/reports/staff-performance">导出员工绩效</ReportDownloadLink>
            <ReportDownloadLink href="/api/ops/system/backup">导出系统备份</ReportDownloadLink>
            <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isPending} onClick={runProductionAutomation} type="button">
              <Play size={15} />
              执行到期任务巡检
            </button>
            <ExportLink kind="report-views">导出视图</ExportLink>
          </>
        }
      >
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "报表视图已保存。")}>
          <input name="action" type="hidden" value="save_report_view" />
          <Field label="视图名称">
            <input className={inputClass} name="name" defaultValue="仓库效率与异常率看板" required />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="报表模块">
              <select className={inputClass} name="module" defaultValue="warehouse">
                <option value="orders">订单</option>
                <option value="warehouse">仓库效率</option>
                <option value="logistics">物流</option>
                <option value="returns">退货/RMA</option>
                <option value="exceptions">异常中心</option>
                <option value="scans">扫码留痕</option>
                <option value="locations">库位利用率</option>
                <option value="data_quality">数据质量巡检</option>
                <option value="outbound_lot_allocation">出库批次分配</option>
                <option value="outbound_review">出库复核差异</option>
                <option value="carrier_labels">承运商面单生命周期</option>
                <option value="carrier_claims">承运商赔付台账</option>
                <option value="platform_sync">平台同步任务</option>
                <option value="customer_credit">客户信用风险</option>
                <option value="customer_self_service">客户自助待办</option>
                <option value="documents_security">文件安全台账</option>
                <option value="billing">账单</option>
                <option value="charge_events">费用事件台账</option>
                <option value="automation_runs">自动化运行记录</option>
                <option value="payment_review">付款复核</option>
                <option value="payment_reconciliation">收款核销台账</option>
                <option value="finance_adjustments">财务调账/赔付审批</option>
                <option value="profit">利润/成本</option>
                <option value="staff_performance">员工绩效</option>
                <option value="sla">SLA</option>
              </select>
            </Field>
            <Field label="所属角色">
              <input className={inputClass} name="ownerRole" defaultValue="ops" />
            </Field>
          </div>
          <Field label="筛选条件">
            <textarea className={textareaClass} name="filters" defaultValue={"warehouse=SHEFFIELD-MAIN\ncustomerCode=\nrisk=低于预警\nrange=last_30_days"} />
          </Field>
          <Field label="指标">
            <textarea className={textareaClass} name="metrics" defaultValue={"入库 SLA\n出库 SLA\n异常率\n仓库效率\n利润/成本"} />
          </Field>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <Save size={15} />
            保存视图
          </button>
        </form>
        <div className="mt-4 grid gap-2">
          {data.savedViews.length === 0 ? (
            <Empty text="暂无保存视图。可先保存低库存、物流异常、账单逾期或客户专属筛选口径，后续导出会沿用同一套条件。" />
          ) : (
            data.savedViews.slice(0, 6).map((item) => (
              <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_auto]" key={item.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{reportModuleLabel(item.module)}</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{item.ownerRole}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">筛选：{Object.entries(item.filters).map(([key, value]) => `${key}=${value || "未填"}`).join("；") || "无"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">指标：{item.metrics.join("、") || "未配置"} / 更新时间：{new Date(item.updatedAt).toLocaleString("zh-CN")}</p>
                </div>
                <Link className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={reportViewHref(item)}>
                  <Download size={14} />
                  按视图导出
                </Link>
              </div>
            ))
          )}
        </div>
        <form className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3" onSubmit={submitReportSchedule}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="保存视图">
              <select className={inputClass} name="viewId" required>
                <option value="">请选择视图</option>
                {data.savedViews.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} / {reportModuleLabel(item.module)}</option>
                ))}
              </select>
            </Field>
            <Field label="报表名称">
              <input className={inputClass} name="name" defaultValue="每日运营异常报表" />
            </Field>
            <Field label="发送频率">
              <select className={inputClass} name="cadence" defaultValue="daily">
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </Field>
            <Field label="状态">
              <select className={inputClass} name="status" defaultValue="active">
                <option value="active">启用</option>
                <option value="paused">暂停</option>
                <option value="archived">归档</option>
              </select>
            </Field>
          </div>
          <Field label="收件人">
            <textarea className={textareaClass} name="recipients" placeholder="finance@example.com&#10;ops@example.com" />
          </Field>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending || data.savedViews.length === 0} type="submit">
            <Save size={15} />
            保存定时报表
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs leading-5 text-slate-500">配置 `REPORT_DELIVERY_WEBHOOK_URL` 后，定时报表会投递到邮件/企微/飞书等外部发送服务；未配置时只生成待发送链接并标记为待配置。</p>
          <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60" disabled={isPending || data.reportSchedules.filter((item) => item.status !== "archived").length === 0} onClick={runReportSchedules} type="button">
            <Send size={14} />
            立即执行定时报表
          </button>
        </div>
        {data.reportSchedules.filter((item) => item.status !== "archived").length > 0 ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.reportSchedules.filter((item) => item.status !== "archived").slice(0, 4).map((item) => (
              <div className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{item.name}</p>
                  {statusPill(item.status)}
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.cadence} / 收件人 {item.recipients.join("、") || "未配置"} / 更新时间 {new Date(item.updatedAt).toLocaleString("zh-CN")}</p>
                <p className="mt-1 text-xs text-slate-500">
                  最近执行：{item.lastRunAt ? new Date(item.lastRunAt).toLocaleString("zh-CN") : "未执行"} / 发送：{item.lastSentAt ? new Date(item.lastSentAt).toLocaleString("zh-CN") : "未发送"}
                </p>
                {item.lastDeliveryStatus ? <p className="mt-1 text-xs font-semibold text-slate-600">状态：{item.lastDeliveryStatus === "sent" ? "已投递" : item.lastDeliveryStatus === "skipped" ? "待配置投递" : "投递失败"}{item.lastDeliveryNote ? ` / ${item.lastDeliveryNote}` : ""}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
        {feedback}
      </Panel>

      <Panel icon={<LockKeyhole size={18} className="text-cyan-700" />} title="权限矩阵与敏感操作审计" aside={<ExportLink kind="permissions">导出权限</ExportLink>}>
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "角色权限已保存。", { requireSecondConfirm: new FormData(event.currentTarget).get("requireSecondConfirm") === "on" })}>
          <input name="action" type="hidden" value="upsert_role_permissions" />
          <Field label="角色">
            <select className={inputClass} name="role" defaultValue="ops">
              <option value="admin">Admin</option>
              <option value="ops">运营</option>
              <option value="warehouse">仓库</option>
              <option value="finance">财务</option>
            </select>
          </Field>
          <Field label="可访问模块">
            <textarea className={textareaClass} name="allowedModules" defaultValue={"询盘\n入库\n库存\n出库\n物流\n账单"} />
          </Field>
          <Field label="敏感操作">
            <textarea className={textareaClass} name="sensitiveActions" defaultValue={"账单锁定\n库存调整审批\n客户暂停/解封"} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input className="h-4 w-4 rounded border-slate-300" defaultChecked name="requireSecondConfirm" type="checkbox" />
            敏感操作需要二次确认
          </label>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <ShieldCheck size={15} />
            保存权限
          </button>
        </form>
      </Panel>

      <Panel icon={<ShieldCheck size={18} className="text-cyan-700" />} title="审批规则中心" aside={<ExportLink kind="approval-rules">导出审批规则</ExportLink>}>
        <form
          className="grid gap-3"
          onSubmit={(event) =>
            submitForm(event, "审批规则已保存。", {
              requireReason: new FormData(event.currentTarget).get("requireReason") === "on",
              requireAttachment: new FormData(event.currentTarget).get("requireAttachment") === "on",
            })
          }
        >
          <input name="action" type="hidden" value="upsert_approval_rule" />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="规则名称">
              <input className={inputClass} name="name" defaultValue="运费差异自动进入财务复核" required />
            </Field>
            <Field label="触发场景">
              <select className={inputClass} name="trigger" defaultValue="carrier_fee_diff">
                <option value="inventory_adjustment">库存调整</option>
                <option value="stocktake_difference">盘点差异</option>
                <option value="transfer_order">分仓调拨</option>
                <option value="billing_lock">账单锁定</option>
                <option value="carrier_fee_diff">运费差异</option>
                <option value="customer_status">客户状态</option>
                <option value="manual_inbound_outbound">手工出入库</option>
                <option value="manual_fee_adjustment">手工费用调整</option>
                <option value="outbound_intercept">出库截单回库</option>
                <option value="claim_approval">异常赔付审批</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="状态">
              <select className={inputClass} name="status" defaultValue="active">
                <option value="draft">草稿</option>
                <option value="active">启用</option>
                <option value="paused">暂停</option>
              </select>
            </Field>
            <Field label="金额阈值">
              <input className={inputClass} min="0" name="minAmount" placeholder="例如：5" step="0.01" type="number" />
            </Field>
            <Field label="数量阈值">
              <input className={inputClass} min="0" name="minQuantity" placeholder="例如：20" type="number" />
            </Field>
            <Field label="SLA 小时">
              <input className={inputClass} min="1" name="slaHours" type="number" defaultValue="24" />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="审批角色">
              <textarea className={textareaClass} name="approverRoles" defaultValue={"ops\nfinance\nadmin"} />
            </Field>
            <Field label="超时升级角色">
              <select className={inputClass} name="escalationRole" defaultValue="admin">
                <option value="">不升级</option>
                <option value="admin">Admin</option>
                <option value="ops">运营</option>
                <option value="warehouse">仓库</option>
                <option value="finance">财务</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input className="h-4 w-4 rounded border-slate-300" defaultChecked name="requireReason" type="checkbox" />
              必须填写审批原因
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input className="h-4 w-4 rounded border-slate-300" name="requireAttachment" type="checkbox" />
              必须上传附件
            </label>
          </div>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <ShieldCheck size={15} />
            保存审批规则
          </button>
        </form>
        <div className="mt-4 grid gap-2">
          {data.approvalRules.length === 0 ? (
            <Empty text="暂无审批规则。建议先配置库存调整、账单锁定、运费差异和客户暂停的审批口径。" />
          ) : (
            data.approvalRules.slice(0, 6).map((item) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{item.name}</p>
                  {statusPill(item.status)}
                </div>
                <p className="mt-1 text-slate-600">
                  {approvalTriggerLabel[item.trigger] ?? item.trigger} / 审批角色 {item.approverRoles.join("、")} / SLA {item.slaHours} 小时
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.minAmount ? `金额达到 £${item.minAmount.toFixed(2)} 触发；` : ""}
                  {item.minQuantity ? `数量达到 ${item.minQuantity} 件触发；` : ""}
                  {item.requireReason ? "需原因；" : ""}
                  {item.requireAttachment ? "需附件；" : ""}
                  {item.escalationRole ? `超时升级给 ${item.escalationRole}` : "不自动升级"}
                </p>
              </div>
            ))
          )}
        </div>
        {feedback}
      </Panel>

      <Panel icon={<Cable size={18} className="text-cyan-700" />} title="客户自助下载、模板与工单">
        <form className="grid gap-3" onSubmit={(event) => submitForm(event, "客户自助配置已保存。")}>
          <input name="action" type="hidden" value="update_self_service" />
          <Field label="可下载内容">
            <textarea className={textareaClass} name="enabledDownloads" defaultValue={data.selfService.enabledDownloads.join("\n")} />
          </Field>
          <Field label="工单类型">
            <textarea className={textareaClass} name="workOrderCategories" defaultValue={data.selfService.workOrderCategories.join("\n")} />
          </Field>
          <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            <Save size={15} />
            保存自助配置
          </button>
        </form>
      </Panel>
    </div>
  );
}
