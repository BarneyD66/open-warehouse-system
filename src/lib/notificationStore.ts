import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentRecord } from "./documentStore";
import { buildInboundDocumentChecklist, type InboundSubmission, type InquirySubmission, type Submission } from "./localStore";
import type { OpsWorkbenchData } from "./opsStore";
import type { WarehouseCoreData } from "./warehouseCoreStore";

export type NotificationAudience = "customer" | "staff";
export type NotificationSeverity = "info" | "warning" | "critical" | "success";
export type NotificationSource = "inquiry" | "inbound" | "billing" | "inventory" | "outbound" | "returns" | "logistics" | "document";

export type NotificationItem = {
  id: string;
  audience: NotificationAudience;
  customerCode?: string;
  source: NotificationSource;
  sourceId: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  href: string;
  createdAt: string;
};

type NotificationState = {
  dismissedIds: string[];
};

const notificationStorePath = process.env.VERCEL
  ? path.join("/tmp", "warehouse-system-data", "notifications.json")
  : path.join(process.cwd(), ".local-data", "notifications.json");

function isInbound(item: Submission): item is InboundSubmission {
  return item.type === "inbound";
}

function isInquiry(item: Submission): item is InquirySubmission {
  return item.type === "inquiry";
}

function nowFallback(value?: string) {
  return value || new Date().toISOString();
}

async function readNotificationState(): Promise<NotificationState> {
  try {
    const raw = await readFile(notificationStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<NotificationState>;
    return { dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [] };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { dismissedIds: [] };
    if (error instanceof SyntaxError) return { dismissedIds: [] };
    throw error;
  }
}

async function writeNotificationState(data: NotificationState) {
  await mkdir(path.dirname(notificationStorePath), { recursive: true });
  await writeFile(notificationStorePath, JSON.stringify(data, null, 2), "utf8");
}

async function filterDismissed(items: NotificationItem[]) {
  const state = await readNotificationState();
  const dismissed = new Set(state.dismissedIds);
  return items
    .filter((item) => !dismissed.has(item.id))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function severityRank(severity: NotificationSeverity) {
  if (severity === "critical") return 4;
  if (severity === "warning") return 3;
  if (severity === "info") return 2;
  return 1;
}

export async function dismissNotification(id: string) {
  const state = await readNotificationState();
  if (!state.dismissedIds.includes(id)) state.dismissedIds.push(id);
  await writeNotificationState(state);
}

export async function getCustomerNotifications({
  customerCode,
  submissions,
  opsData,
  coreData,
}: {
  customerCode: string;
  submissions: Submission[];
  opsData: OpsWorkbenchData;
  coreData: Pick<WarehouseCoreData, "billingRecords" | "inventoryBalances" | "outboundOrders" | "returnOrders">;
}) {
  const items: NotificationItem[] = [];
  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);

  inquiries.forEach((item) => {
    if ((item.status === "quoted" || item.status === "waiting_customer") && item.quoteDraft) {
      items.push({
        id: `customer:${customerCode}:quote:${item.id}`,
        audience: "customer",
        customerCode,
        source: "inquiry",
        sourceId: item.id,
        title: "报价待确认",
        body: `${item.service || "报价方案"} 已生成，请确认费用或提出问题。`,
        severity: "warning",
        href: "/portal",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  inbounds.forEach((item) => {
    const checklist = buildInboundDocumentChecklist(item);
    if (checklist.missingRequired.length > 0) {
      items.push({
        id: `customer:${customerCode}:inbound-docs:${item.id}`,
        audience: "customer",
        customerCode,
        source: "inbound",
        sourceId: item.id,
        title: "入库资料待补",
        body: `${item.id} 缺少 ${checklist.missingRequired.join("、")}。`,
        severity: "warning",
        href: "/supplement",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
    if (!item.tracking) {
      items.push({
        id: `customer:${customerCode}:inbound-tracking:${item.id}`,
        audience: "customer",
        customerCode,
        source: "inbound",
        sourceId: item.id,
        title: "追踪号待补",
        body: `${item.id} 尚未补充追踪号，仓库到货识别会变慢。`,
        severity: "critical",
        href: "/supplement",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  coreData.billingRecords.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if (["pending_confirmation", "confirmed", "disputed"].includes(item.status)) {
      items.push({
        id: `customer:${customerCode}:billing:${item.id}:${item.status}`,
        audience: "customer",
        customerCode,
        source: "billing",
        sourceId: item.id,
        title: item.status === "confirmed" ? "账单待付款" : item.status === "disputed" ? "账单异议处理中" : "账单待确认",
        body: `${item.title} / £${item.amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`,
        severity: item.status === "disputed" ? "critical" : "warning",
        href: "/billing",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  coreData.inventoryBalances.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if (item.availableQty < item.alertQty) {
      items.push({
        id: `customer:${customerCode}:inventory-low:${item.id}`,
        audience: "customer",
        customerCode,
        source: "inventory",
        sourceId: item.id,
        title: "库存低于预警",
        body: `${item.skuCode} 可用 ${item.availableQty}，低于预警 ${item.alertQty}。`,
        severity: "warning",
        href: "/skus",
        createdAt: item.updatedAt,
      });
    }
  });

  coreData.outboundOrders.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if (item.status === "blocked" || item.status === "label_pending") {
      items.push({
        id: `customer:${customerCode}:outbound:${item.id}:${item.status}`,
        audience: "customer",
        customerCode,
        source: "outbound",
        sourceId: item.id,
        title: item.status === "blocked" ? "出库异常阻塞" : "出库待面单",
        body: `${item.id} / ${item.channel} / ${item.orderCount} 单。`,
        severity: item.status === "blocked" ? "critical" : "warning",
        href: "/outbound",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  coreData.returnOrders.forEach((item) => {
    if (item.customerCode !== customerCode) return;
    if (["requested", "received", "inspection", "exception"].includes(item.status)) {
      items.push({
        id: `customer:${customerCode}:returns:${item.id}:${item.status}`,
        audience: "customer",
        customerCode,
        source: "returns",
        sourceId: item.id,
        title: item.status === "exception" ? "退货异常处理中" : item.status === "inspection" ? "退货质检中" : "退货处理待推进",
        body: `${item.id} / ${item.platform} / ${item.skuLines.map((line) => `${line.skuCode} x ${line.quantity}`).join("，")}`,
        severity: item.status === "exception" ? "critical" : "warning",
        href: "/returns",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  opsData.logistics
    .filter((item) => item.customerCode === customerCode && item.status !== "resolved")
    .forEach((item) => {
      items.push({
        id: `customer:${customerCode}:logistics:${item.id}:${item.status}`,
        audience: "customer",
        customerCode,
        source: "logistics",
        sourceId: item.id,
        title: "物流异常处理中",
        body: `${item.trackingNo} / ${item.issue}`,
        severity: item.status === "waiting_customer" ? "critical" : "warning",
        href: "/tracking",
        createdAt: item.updatedAt,
      });
    });

  return filterDismissed(items);
}

export async function getStaffNotifications({
  submissions,
  opsData,
  coreData,
  documents,
}: {
  submissions: Submission[];
  opsData: OpsWorkbenchData;
  coreData: Pick<WarehouseCoreData, "billingRecords" | "inventoryBalances" | "outboundOrders" | "returnOrders">;
  documents: DocumentRecord[];
}) {
  const items: NotificationItem[] = [];
  const inbounds = submissions.filter(isInbound);
  const inquiries = submissions.filter(isInquiry);

  inquiries.forEach((item) => {
    if (item.status === "new" || item.status === "quote_question") {
      items.push({
        id: `staff:inquiry:${item.id}:${item.status}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "inquiry",
        sourceId: item.id,
        title: item.status === "quote_question" ? "客户提出报价疑问" : "新询盘待处理",
        body: `${item.company || item.contact} / ${item.service || "服务待确认"}`,
        severity: item.status === "quote_question" ? "critical" : "warning",
        href: "/ops",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  inbounds.forEach((item) => {
    const checklist = buildInboundDocumentChecklist(item);
    if (checklist.missingRequired.length > 0 || !item.tracking || item.status === "exception" || item.status === "on_hold") {
      items.push({
        id: `staff:inbound:${item.id}:${item.status}:${checklist.missingRequired.length}:${item.tracking ? "tracked" : "no-track"}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "inbound",
        sourceId: item.id,
        title: item.status === "exception" ? "入库异常待处理" : "入库资料待复核",
        body: `${item.id} / 资料 ${checklist.requiredReady}/${checklist.requiredTotal}${item.tracking ? "" : " / 缺追踪号"}`,
        severity: item.status === "exception" || !item.tracking ? "critical" : "warning",
        href: "/ops",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  opsData.logistics
    .filter((item) => item.status !== "resolved")
    .forEach((item) => {
      items.push({
        id: `staff:logistics:${item.id}:${item.status}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "logistics",
        sourceId: item.id,
        title: "物流异常待推进",
        body: `${item.trackingNo} / ${item.issue} / 截止 ${item.deadline}`,
        severity: item.status === "open" ? "critical" : "warning",
        href: "/ops",
        createdAt: item.updatedAt,
      });
    });

  coreData.billingRecords.forEach((item) => {
    if (item.status === "payment_submitted" || item.status === "disputed" || item.status === "pending_confirmation") {
      items.push({
        id: `staff:billing:${item.id}:${item.status}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "billing",
        sourceId: item.id,
        title: item.status === "payment_submitted" ? "付款凭证待复核" : item.status === "disputed" ? "账单异议待处理" : "账单待客户确认",
        body: `${item.id} / ${item.title} / £${item.amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`,
        severity: item.status === "disputed" ? "critical" : "warning",
        href: "/ops",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  coreData.outboundOrders.forEach((item) => {
    if (item.status !== "shipped") {
      items.push({
        id: `staff:outbound:${item.id}:${item.status}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "outbound",
        sourceId: item.id,
        title: item.status === "blocked" ? "出库异常阻塞" : "客户出库申请待推进",
        body: `${item.id} / ${item.channel} / ${item.orderCount} 单`,
        severity: item.status === "blocked" || item.status === "label_pending" ? "critical" : "warning",
        href: "/ops",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  coreData.returnOrders.forEach((item) => {
    if (!["restocked", "disposed", "closed"].includes(item.status)) {
      items.push({
        id: `staff:returns:${item.id}:${item.status}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "returns",
        sourceId: item.id,
        title: item.status === "exception" ? "退货异常待处理" : "退货 RMA 待推进",
        body: `${item.customerCode} / ${item.platform} / ${item.buyerReturnTracking || "追踪号待补"}`,
        severity: item.status === "exception" || item.status === "received" ? "critical" : "warning",
        href: "/ops",
        createdAt: nowFallback(item.updatedAt ?? item.createdAt),
      });
    }
  });

  coreData.inventoryBalances.forEach((item) => {
    if (item.availableQty < item.alertQty) {
      items.push({
        id: `staff:inventory-low:${item.id}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "inventory",
        sourceId: item.id,
        title: "库存低于预警",
        body: `${item.customerCode} / ${item.skuCode} 可用 ${item.availableQty}，预警 ${item.alertQty}`,
        severity: "warning",
        href: "/ops",
        createdAt: item.updatedAt,
      });
    }
  });

  documents
    .filter((item) => item.category === "payment_proof")
    .slice(0, 12)
    .forEach((item) => {
      items.push({
        id: `staff:document:${item.id}`,
        audience: "staff",
        customerCode: item.customerCode,
        source: "document",
        sourceId: item.id,
        title: "新付款凭证待查看",
        body: `${item.customerCode} / ${item.originalName}`,
        severity: "info",
        href: "/ops",
        createdAt: item.uploadedAt,
      });
    });

  return filterDismissed(items);
}
