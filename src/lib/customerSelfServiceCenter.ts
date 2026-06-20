import { buildInboundDocumentChecklist, type InboundSubmission, type Submission } from "./localStore";
import type { CustomerWorkOrder } from "./opsExpansionStore";
import type { DocumentRecord } from "./documentStore";
import type { BillingRecord, CoreOutboundOrder, ReturnOrder, WarehouseCoreData } from "./warehouseCoreStore";

export type CustomerSelfServiceActionSeverity = "正常" | "待处理" | "紧急";

export type CustomerSelfServiceAction = {
  id: string;
  module: string;
  sourceId: string;
  title: string;
  status: string;
  severity: CustomerSelfServiceActionSeverity;
  nextAction: string;
  href: string;
  downloadableHref?: string;
  createdAt?: string;
  dueAt?: string;
  slaLevel?: "normal" | "near_due" | "overdue";
  overdueHours?: number;
  reminderChannels?: Array<"站内信" | "邮件" | "短信" | "微信">;
};

export type CustomerSelfServiceCenterData = {
  generatedAt: string;
  summary: {
    actionCount: number;
    urgentCount: number;
    downloadableCount: number;
    documents: number;
    workOrders: number;
    openExceptions: number;
    billingDue: number;
    returnsNeedDecision: number;
    labels: number;
    proofs: number;
  };
  actions: CustomerSelfServiceAction[];
};

type CustomerCoreData = Pick<WarehouseCoreData, "billingRecords" | "inventoryBalances" | "outboundOrders" | "returnOrders">;

type BuildCustomerSelfServiceCenterInput = {
  customerCode: string;
  submissions: Submission[];
  coreData: CustomerCoreData;
  documents: DocumentRecord[];
  workOrders: CustomerWorkOrder[];
};

const severityRank: Record<CustomerSelfServiceActionSeverity, number> = {
  "紧急": 3,
  "待处理": 2,
  "正常": 1,
};

function addHours(value: string | undefined, hours: number) {
  const base = value ? new Date(value).getTime() : Date.now();
  const time = Number.isFinite(base) ? base : Date.now();
  return new Date(time + hours * 3_600_000).toISOString();
}

function slaFromDueAt(dueAt?: string): Pick<CustomerSelfServiceAction, "slaLevel" | "overdueHours"> {
  if (!dueAt) return {};
  const dueMs = new Date(dueAt).getTime();
  if (!Number.isFinite(dueMs)) return {};
  const diff = dueMs - Date.now();
  if (diff < 0) return { slaLevel: "overdue", overdueHours: Math.ceil(Math.abs(diff) / 3_600_000) };
  if (diff <= 12 * 3_600_000) return { slaLevel: "near_due" };
  return { slaLevel: "normal" };
}

function withSla(action: CustomerSelfServiceAction, dueAt?: string): CustomerSelfServiceAction {
  const sla = slaFromDueAt(dueAt);
  return {
    ...action,
    dueAt,
    ...sla,
    reminderChannels: action.reminderChannels ?? (action.severity === "紧急" || sla.slaLevel === "overdue" ? ["站内信", "邮件"] : ["站内信"]),
  };
}

const billingStatusLabel: Record<BillingRecord["status"], string> = {
  draft: "草稿待确认",
  pending_confirmation: "待客户确认",
  confirmed: "已确认待付款",
  payment_submitted: "付款待复核",
  paid: "已付款",
  disputed: "争议处理中",
};

const returnStatusLabel: Record<ReturnOrder["status"], string> = {
  requested: "待审核",
  label_sent: "已发送退货指引",
  in_transit: "退货在途",
  received: "已到仓",
  inspection: "质检中",
  restocked: "已重新上架",
  repair: "维修处理中",
  disposed: "已报废",
  closed: "已关闭",
  exception: "异常处理",
};

const workOrderStatusLabel: Record<CustomerWorkOrder["status"], string> = {
  open: "待运营处理",
  processing: "处理中",
  waiting_customer: "待客户补充",
  resolved: "已解决",
  cancelled: "已取消",
};

const deliveryExceptionTypeLabel: Record<string, string> = {
  delivery_failed: "派送失败",
  address_issue: "地址异常",
  customer_absent: "收件人不在",
  damaged: "运输破损",
  lost: "疑似丢件",
  return_to_sender: "退回仓库",
  claim: "物流赔付",
  proof_uploaded: "签收证明",
  manual: "其他异常",
};

function isInbound(item: Submission): item is InboundSubmission {
  return item.type === "inbound";
}

function isOverdue(value?: string) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function pushAction(actions: CustomerSelfServiceAction[], action: CustomerSelfServiceAction) {
  actions.push(action);
}

function buildInboundActions(actions: CustomerSelfServiceAction[], submissions: Submission[]) {
  submissions.filter(isInbound).forEach((item) => {
    const checklist = buildInboundDocumentChecklist(item);
    const baseTime = item.updatedAt ?? item.createdAt;
    if (checklist.missingRequired.length > 0) {
      pushAction(actions, {
        ...withSla(
          {
            id: `${item.id}-missing-documents`,
            module: "入库资料",
            sourceId: item.id,
            title: `缺少 ${checklist.missingRequired.join("、")}`,
            status: "待补资料",
            severity: "待处理",
            nextAction: "请补充装箱单、SKU 清单、外箱标签或平台资料，避免到仓后暂缓处理。",
            href: "/supplement",
            downloadableHref: "/api/downloads?kind=documents",
            createdAt: baseTime,
          },
          addHours(baseTime, 24),
        ),
      });
    }

    if (!item.tracking && item.status !== "cancelled" && item.status !== "closed") {
      pushAction(actions, {
        ...withSla(
          {
            id: `${item.id}-missing-tracking`,
            module: "入库资料",
            sourceId: item.id,
            title: "入库追踪号待补充",
            status: "待补追踪号",
            severity: "紧急",
            nextAction: "请补充头程或快递追踪号，仓库才能提前识别到仓货件。",
            href: "/supplement",
            createdAt: baseTime,
          },
          addHours(baseTime, 12),
        ),
      });
    }
  });
}

function buildBillingActions(actions: CustomerSelfServiceAction[], billingRecords: BillingRecord[]) {
  billingRecords
    .filter((item) => item.status !== "paid" && item.status !== "draft")
    .forEach((item) => {
      const overdue = isOverdue(item.dueDate);
      const title =
        item.status === "pending_confirmation"
          ? `费用待确认：£${item.amount.toFixed(2)}`
          : item.status === "confirmed"
            ? `费用待付款：£${item.amount.toFixed(2)}`
            : item.status === "payment_submitted"
              ? `付款待复核：£${item.amount.toFixed(2)}`
              : item.status === "disputed"
                ? `账单争议处理中：£${item.amount.toFixed(2)}`
                : `账单待处理：£${item.amount.toFixed(2)}`;
      const nextAction =
        item.status === "pending_confirmation"
          ? "请核对费用明细，确认无误后提交确认；如有疑问可提交账单争议工单。"
          : item.status === "confirmed"
            ? "请安排付款并提交付款参考号，方便财务核销。"
            : item.status === "payment_submitted"
              ? "财务正在复核付款到账情况，如被驳回请重新提交凭证。"
              : item.status === "disputed"
                ? "运营正在复核争议项，您也可以补充说明或附件。"
                : "请进入费用账单页面继续处理。";

      pushAction(actions, {
        ...withSla(
          {
            id: `${item.id}-billing`,
            module: "费用账单",
            sourceId: item.id,
            title: overdue ? `${title}（已逾期）` : title,
            status: overdue ? "已逾期" : billingStatusLabel[item.status],
            severity: overdue ? "紧急" : item.status === "payment_submitted" || item.status === "disputed" ? "正常" : "待处理",
            nextAction,
            href: "/billing",
            downloadableHref: item.status === "confirmed" || item.status === "payment_submitted" || item.status === "paid" ? "/api/downloads?kind=payment-reconciliation" : "/api/downloads?kind=billing",
            createdAt: item.updatedAt ?? item.createdAt,
          },
          item.dueDate ? `${item.dueDate}T23:59:59.000Z` : addHours(item.updatedAt ?? item.createdAt, 48),
        ),
      });
    });
}

function hasDeliveredTracking(item: CoreOutboundOrder) {
  return (item.trackingEvents ?? []).some((event) => event.status === "delivered");
}

function buildOutboundActions(actions: CustomerSelfServiceAction[], outboundOrders: CoreOutboundOrder[]) {
  outboundOrders.forEach((order) => {
    if (order.labelStatus === "generated") {
      pushAction(actions, {
        id: `${order.id}-label`,
        module: "出库物流",
        sourceId: order.id,
        title: "面单已生成，可自助下载",
        status: "可下载",
        severity: "正常",
        nextAction: "可下载面单用于核对出库渠道、追踪号和收件信息。",
        href: "/tracking",
        downloadableHref: `/api/outbounds/${encodeURIComponent(order.id)}/label`,
        createdAt: order.labelGeneratedAt ?? order.updatedAt ?? order.createdAt,
      });
    }

    const proofException = (order.exceptions ?? []).find((item) => item.proofUrl);
    if (proofException || hasDeliveredTracking(order)) {
      pushAction(actions, {
        id: `${order.id}-proof`,
        module: "出库物流",
        sourceId: order.id,
        title: proofException ? "签收证明已回传，可自助下载" : "订单已签收，等待签收证明回传",
        status: proofException ? "可下载" : "待回传",
        severity: "正常",
        nextAction: proofException ? "可下载签收证明用于平台售后、客诉或内部归档。" : "承运商已显示签收，系统会继续等待签收证明回传。",
        href: "/tracking",
        downloadableHref: proofException ? `/api/outbounds/${encodeURIComponent(order.id)}/proof` : "/api/downloads?kind=proofs",
        createdAt: proofException?.createdAt ?? order.updatedAt ?? order.createdAt,
      });
    }

    (order.exceptions ?? [])
      .filter((item) => item.deliveryExceptionType && (item.status === "open" || item.status === "investigating") && !item.customerDecision)
      .forEach((exception) => {
        pushAction(actions, {
          ...withSla(
            {
              id: `${order.id}-${exception.id}-delivery-exception`,
              module: "物流异常",
              sourceId: order.id,
              title: deliveryExceptionTypeLabel[exception.deliveryExceptionType ?? "manual"] ?? "物流异常待确认",
              status: exception.status === "open" ? "待确认" : "处理中",
              severity: exception.severity === "critical" ? "紧急" : "待处理",
              nextAction: exception.redeliveryRequired
                ? "请确认是否改派或补充收件信息；如涉及赔付，请在异常中心确认处理意见。"
                : exception.claimStatus && exception.claimStatus !== "not_required"
                  ? "请查看赔付状态并确认是否认可处理结果。"
                  : "请查看异常说明，必要时提交确认意见或补充资料。",
              href: "/portal",
              downloadableHref: "/api/downloads?kind=delivery-exceptions",
              createdAt: exception.createdAt,
            },
            addHours(exception.createdAt, 24),
          ),
        });
      });
  });
}

function buildReturnActions(actions: CustomerSelfServiceAction[], returnOrders: ReturnOrder[]) {
  returnOrders
    .filter((item) => ["received", "inspection", "repair", "exception"].includes(item.status) && !item.customerResolutionDecision)
    .forEach((item) => {
      pushAction(actions, {
        ...withSla(
          {
            id: `${item.id}-return-decision`,
            module: "退货售后",
            sourceId: item.id,
            title: "退货处理方式待确认",
            status: returnStatusLabel[item.status],
            severity: item.status === "exception" ? "紧急" : "待处理",
            nextAction: "请确认重新上架、维修翻新、报废或转寄，避免退货件长时间占用库位。",
            href: "/returns?status=needs-decision",
            downloadableHref: "/api/downloads?kind=returns&status=needs-decision",
            createdAt: item.updatedAt ?? item.createdAt,
          },
          addHours(item.updatedAt ?? item.createdAt, item.status === "exception" ? 12 : 24),
        ),
      });
    });
}

function buildWorkOrderActions(actions: CustomerSelfServiceAction[], workOrders: CustomerWorkOrder[]) {
  workOrders
    .filter((item) => item.status !== "resolved" && item.status !== "cancelled")
    .forEach((item) => {
      const visibleOpsMessages = (item.messages ?? []).filter((message) => message.visibleToCustomer && message.authorRole !== "customer");
      pushAction(actions, {
        ...withSla(
          {
            id: `${item.id}-work-order`,
            module: "工单沟通",
            sourceId: item.id,
            title: item.status === "waiting_customer" ? `工单待您补充：${item.title}` : item.title,
            status: workOrderStatusLabel[item.status],
            severity: item.priority === "urgent" || item.status === "waiting_customer" ? "待处理" : "正常",
            nextAction: item.status === "waiting_customer" ? "请补充运营要求的信息或附件。" : visibleOpsMessages.length > 0 ? "可查看运营最新回复，必要时继续补充说明。" : "运营正在处理，您可以继续补充说明。",
            href: "/portal#work-orders",
            createdAt: item.updatedAt ?? item.createdAt,
          },
          item.status === "waiting_customer" ? addHours(item.updatedAt ?? item.createdAt, 24) : undefined,
        ),
      });
    });
}

function buildInventoryActions(actions: CustomerSelfServiceAction[], coreData: CustomerCoreData) {
  coreData.inventoryBalances
    .filter((item) => item.availableQty < item.alertQty || (item.frozenQty ?? 0) > 0 || (item.defectiveQty ?? 0) > 0 || item.agingDays >= 120)
    .slice(0, 20)
    .forEach((item) => {
      const reasons = [
        item.availableQty < item.alertQty ? "低于预警库存" : "",
        (item.frozenQty ?? 0) > 0 ? `冻结 ${item.frozenQty}` : "",
        (item.defectiveQty ?? 0) > 0 ? `残次 ${item.defectiveQty}` : "",
        item.agingDays >= 120 ? `库龄 ${item.agingDays} 天` : "",
      ].filter(Boolean);
      pushAction(actions, {
        id: `${item.id}-inventory-risk`,
        module: "库存风险",
        sourceId: item.skuCode,
        title: reasons.join("；"),
        status: item.availableQty < 0 || item.agingDays >= 365 ? "高风险" : "待关注",
        severity: item.availableQty < 0 || item.agingDays >= 365 ? "紧急" : "待处理",
        nextAction: "请结合销售计划确认补货、清仓、移库或残次处理方案。",
        href: "/skus",
        downloadableHref: "/api/downloads?kind=inventory-aging",
        createdAt: item.updatedAt,
        reminderChannels: ["站内信"],
      });
    });
}

function sortActions(actions: CustomerSelfServiceAction[]) {
  return actions.sort((a, b) => {
    const severity = severityRank[b.severity] - severityRank[a.severity];
    if (severity !== 0) return severity;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
}

export function buildCustomerSelfServiceCenterData(input: BuildCustomerSelfServiceCenterInput): CustomerSelfServiceCenterData {
  const actions: CustomerSelfServiceAction[] = [];
  buildInboundActions(actions, input.submissions);
  buildBillingActions(actions, input.coreData.billingRecords);
  buildOutboundActions(actions, input.coreData.outboundOrders);
  buildReturnActions(actions, input.coreData.returnOrders);
  buildWorkOrderActions(actions, input.workOrders);
  buildInventoryActions(actions, input.coreData);

  const sortedActions = sortActions(actions);
  const downloadableCount = sortedActions.filter((item) => item.downloadableHref).length;
  const openExceptions = sortedActions.filter((item) => item.module.includes("异常") || item.module.includes("风险")).length;
  const labels = input.coreData.outboundOrders.filter((item) => item.labelStatus === "generated").length;
  const proofs = input.coreData.outboundOrders.filter((item) => hasDeliveredTracking(item) || (item.exceptions ?? []).some((exception) => exception.proofUrl)).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      actionCount: sortedActions.filter((item) => item.severity !== "正常").length,
      urgentCount: sortedActions.filter((item) => item.severity === "紧急").length,
      downloadableCount,
      documents: input.documents.length,
      workOrders: input.workOrders.filter((item) => item.status !== "resolved" && item.status !== "cancelled").length,
      openExceptions,
      billingDue: input.coreData.billingRecords.filter((item) => item.status !== "paid" && item.status !== "draft").length,
      returnsNeedDecision: input.coreData.returnOrders.filter((item) => ["received", "inspection", "repair", "exception"].includes(item.status) && !item.customerResolutionDecision).length,
      labels,
      proofs,
    },
    actions: sortedActions,
  };
}

export function customerSelfServiceActionCsvRows(data: CustomerSelfServiceCenterData) {
  return [
    ["模块", "关联单号/SKU", "事项", "状态", "紧急程度", "SLA状态", "截止时间", "超时小时", "建议通知渠道", "下一步动作", "处理入口", "下载入口", "创建/更新时间"],
    ...data.actions.map((item) => [
      item.module,
      item.sourceId,
      item.title,
      item.status,
      item.severity,
      item.slaLevel === "overdue" ? "已超时" : item.slaLevel === "near_due" ? "即将超时" : item.slaLevel === "normal" ? "正常跟进" : "",
      item.dueAt ?? "",
      item.overdueHours ?? "",
      item.reminderChannels?.join("、") ?? "",
      item.nextAction,
      item.href,
      item.downloadableHref ?? "",
      item.createdAt ?? "",
    ]),
  ];
}
