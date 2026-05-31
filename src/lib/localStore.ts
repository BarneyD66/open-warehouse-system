import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSql, hasPostgresConfig } from "./db";

export type InquiryStatus = "new" | "contacted" | "quoted" | "waiting_customer" | "quote_accepted" | "quote_question" | "converted_to_inbound" | "closed";

export type InboundStatus =
  | "pending_review"
  | "submitted"
  | "docs_review"
  | "docs_review_passed"
  | "appointment_confirmed"
  | "arrived"
  | "receiving"
  | "received"
  | "putaway_completed"
  | "closed"
  | "on_hold"
  | "exception"
  | "cancelled";

export type StatusEvent = {
  id: string;
  refType: "inquiry" | "inbound";
  refId: string;
  fromStatus?: string;
  toStatus: string;
  messageCustomer: string;
  messageInternal?: string;
  operator: "system" | "customer" | "ops";
  occurredAt: string;
};

export type InquiryQuoteDraft = {
  updatedAt: string;
  validUntil?: string;
  currency: "GBP";
  monthlyFee?: number;
  inboundFee?: number;
  storageFee?: number;
  outboundFee?: number;
  returnFee?: number;
  fbaFee?: number;
  valueAddedFee?: number;
  notes?: string;
};

export type InquiryQuoteResponse = {
  decision: "accepted" | "question";
  message?: string;
  respondedAt: string;
};

export type InquirySubmission = {
  id: string;
  type: "inquiry";
  customerCode?: string;
  createdAt: string;
  updatedAt?: string;
  status: InquiryStatus;
  company: string;
  contact: string;
  phone: string;
  email?: string;
  platform: string;
  volume: string;
  service: string;
  leadIntent?: string;
  origin?: string;
  tailDeliveryNeed?: string;
  note?: string;
  quoteEstimate?: string;
  followUpNote?: string;
  nextFollowUpAt?: string;
  quoteDraft?: InquiryQuoteDraft;
  quoteResponse?: InquiryQuoteResponse;
  events: StatusEvent[];
};

export type InboundSubmission = {
  id: string;
  type: "inbound";
  customerCode?: string;
  createdAt: string;
  updatedAt?: string;
  status: InboundStatus;
  customer?: string;
  contact: string;
  phone: string;
  platform?: string;
  eta: string;
  transport: string;
  tracking?: string;
  cartons: number;
  skuCount: number;
  skuLines?: InboundSkuLine[];
  productName: string;
  service?: string;
  attribute?: string;
  attachmentNames: string[];
  supplementNote?: string;
  appointmentAt?: string;
  opsNote?: string;
  exceptionNote?: string;
  receivingExceptions?: InboundReceivingException[];
  events: StatusEvent[];
};

export type Submission = InquirySubmission | InboundSubmission;

export type InboundSkuLine = {
  skuCode: string;
  productName?: string;
  expectedQty?: number;
  cartonCount?: number;
};

export type InboundReceivingExceptionStatus = "open" | "investigating" | "resolved" | "ignored";
export type InboundReceivingExceptionType = "short_received" | "over_received" | "damaged" | "sku_mismatch" | "label_issue" | "missing_document" | "manual";

export type InboundReceivingException = {
  id: string;
  type: InboundReceivingExceptionType;
  status: InboundReceivingExceptionStatus;
  severity: "warning" | "critical";
  skuCode?: string;
  cartonNo?: string;
  expectedQty?: number;
  actualQty?: number;
  message: string;
  operator: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
};

export type InboundDocumentKey = "packing_list" | "sku_list" | "carton_label" | "tracking" | "label_file" | "vat_eori" | "product_photo";

export type InboundDocumentChecklistItem = {
  key: InboundDocumentKey;
  label: string;
  required: boolean;
  ready: boolean;
  hint: string;
  matchedBy?: string;
};

export type InboundDocumentChecklistSummary = {
  ready: number;
  total: number;
  requiredReady: number;
  requiredTotal: number;
  missingRequired: string[];
  items: InboundDocumentChecklistItem[];
};

const PUBLIC_LEAD_CUSTOMER_CODE = "PUBLIC_LEAD";

function makeId(prefix: string) {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${yyyymm}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function customerFacingId(id: string) {
  return id.replace(/^INQ-/i, "咨询-").replace(/^询盘-/i, "咨询-").replace(/^ASN-UK-/i, "入库-UK-");
}

function makeEventId() {
  return `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeInboundExceptionId() {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `入库异常-${yyyymm}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function inquiryCustomerMessage(status: InquiryStatus) {
  const labels: Record<InquiryStatus, string> = {
    new: "报价需求已提交，客服将确认平台、货量和服务范围。",
    contacted: "客服已联系，正在确认业务细节和报价口径。",
    quoted: "报价方案已生成，请确认费用口径、有效期和下一步入仓计划。",
    waiting_customer: "等待客户确认报价、SKU 清单、箱规或预计入库时间。",
    quote_accepted: "客户已确认报价，下一步可以创建入库预报并补齐发货资料。",
    quote_question: "客户已提出报价问题，客服会继续核对并回复。",
    converted_to_inbound: "该需求已进入入库预报阶段，请继续补齐发货资料。",
    closed: "该需求已关闭，如需重新报价可以再次提交需求。",
  };
  return labels[status] ?? labels.new;
}

function inboundCustomerMessage() {
  return "入库预报已提交，等待客服/仓库审核资料和到仓安排。";
}

export function inboundStatusLabel(status: InboundStatus) {
  const labels: Record<InboundStatus, string> = {
    pending_review: "待审核",
    submitted: "已提交",
    docs_review: "资料审核中",
    docs_review_passed: "资料已通过",
    appointment_confirmed: "已预约入仓",
    arrived: "已到仓",
    receiving: "收货验收中",
    received: "已收货",
    putaway_completed: "已上架",
    closed: "已关闭",
    on_hold: "暂缓处理",
    exception: "异常处理中",
    cancelled: "已取消",
  };
  return labels[status] ?? labels.submitted;
}

function inboundCustomerMessageForStatus(status: InboundStatus) {
  const labels: Record<InboundStatus, string> = {
    pending_review: "入库预报已提交，等待客服/仓库审核资料和到仓安排。",
    submitted: "入库预报已提交，等待客服/仓库审核资料和到仓安排。",
    docs_review: "仓库正在审核入库资料，请留意是否需要补充装箱单、标签或追踪号。",
    docs_review_passed: "入库资料已通过审核，下一步将确认预约入仓或到仓安排。",
    appointment_confirmed: "入仓预约已确认，请按预约时间和送仓要求安排到仓。",
    arrived: "货件已到仓，仓库将按预报核对箱数、标签和装箱资料。",
    receiving: "仓库正在收货验收，如有箱数或外箱异常会继续反馈。",
    received: "货件已完成收货，等待上架或后续 FBA/履约处理。",
    putaway_completed: "货件已完成上架，后续可进入库存周转、出库或 FBA 补货流程。",
    closed: "该入库预报已关闭。",
    on_hold: "该入库预报暂缓处理，请等待客服确认下一步。",
    exception: "该入库预报存在异常，客服/仓库会继续核对并反馈处理方案。",
    cancelled: "该入库预报已取消，如需重新入仓请创建新的入库预报。",
  };
  return labels[status] ?? labels.submitted;
}

export function openInboundReceivingExceptions(item: InboundSubmission) {
  return (item.receivingExceptions ?? []).filter((exception) => exception.status === "open" || exception.status === "investigating");
}

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word.toLowerCase()));
}

function attachmentMatch(attachmentNames: string[], words: string[]) {
  return attachmentNames.find((name) => includesAny(name.toLowerCase(), words));
}

export function buildInboundDocumentChecklist(item: InboundSubmission): InboundDocumentChecklistSummary {
  const names = item.attachmentNames ?? [];
  const serviceText = [item.service, item.attribute, item.productName].filter(Boolean).join(" ").toLowerCase();
  const needsLabelFile = includesAny(serviceText, ["fba", "fnsku", "贴标", "换标", "标签", "prep"]);
  const needsPhoto = includesAny(serviceText, ["退货", "质检", "拍照", "破损", "液体", "粉末", "食品", "化妆品", "需人工确认"]);

  const items: InboundDocumentChecklistItem[] = [
    {
      key: "packing_list",
      label: "装箱单",
      required: true,
      ready: Boolean(attachmentMatch(names, ["装箱", "packing", "pack list", "packing-list", "carton list"])),
      matchedBy: attachmentMatch(names, ["装箱", "packing", "pack list", "packing-list", "carton list"]),
      hint: "用于核对箱数、每箱 SKU、数量、箱规和箱重。",
    },
    {
      key: "sku_list",
      label: "SKU 清单",
      required: true,
      ready: Boolean(attachmentMatch(names, ["sku", "产品清单", "商品清单", "明细", "inventory", "库存"])),
      matchedBy: attachmentMatch(names, ["sku", "产品清单", "商品清单", "明细", "inventory", "库存"]),
      hint: "用于匹配商品、SKU 数量、品名和后续上架库存。",
    },
    {
      key: "carton_label",
      label: "外箱标签",
      required: true,
      ready: Boolean(attachmentMatch(names, ["外箱", "箱标", "carton label", "box label", "carton-label", "箱唛"])),
      matchedBy: attachmentMatch(names, ["外箱", "箱标", "carton label", "box label", "carton-label", "箱唛"]),
      hint: "用于到仓后识别客户、批次和入库预报编号。",
    },
    {
      key: "tracking",
      label: "追踪号/承运信息",
      required: true,
      ready: Boolean(item.tracking?.trim()),
      matchedBy: item.tracking,
      hint: "用于提前识别到仓批次、车辆、提单或快递包裹。",
    },
    {
      key: "label_file",
      label: "标签文件",
      required: needsLabelFile,
      ready: Boolean(attachmentMatch(names, ["fnsku", "标签", "label", "fba label", "shipping label"])),
      matchedBy: attachmentMatch(names, ["fnsku", "标签", "label", "fba label", "shipping label"]),
      hint: needsLabelFile ? "FBA、贴标或换标场景需要提前提供标签文件。" : "如需 FBA/换标/贴标，可补充标签文件。",
    },
    {
      key: "vat_eori",
      label: "VAT/EORI 或授权资料",
      required: false,
      ready: Boolean(attachmentMatch(names, ["vat", "eori", "授权", "authorization", "清关", "customs"])),
      matchedBy: attachmentMatch(names, ["vat", "eori", "授权", "authorization", "清关", "customs"]),
      hint: "涉及清关、授权、品牌或合规资料时建议留档。",
    },
    {
      key: "product_photo",
      label: "产品图片/异常图片",
      required: needsPhoto,
      ready: Boolean(attachmentMatch(names, ["图片", "照片", "photo", "image", ".jpg", ".jpeg", ".png", "破损"])),
      matchedBy: attachmentMatch(names, ["图片", "照片", "photo", "image", ".jpg", ".jpeg", ".png", "破损"]),
      hint: needsPhoto ? "质检、退货、特殊品类或异常处理建议提前提供图片。" : "如需质检拍照或异常说明，可补充图片。",
    },
  ];

  const requiredItems = items.filter((doc) => doc.required);
  const ready = items.filter((doc) => doc.ready).length;
  const requiredReady = requiredItems.filter((doc) => doc.ready).length;

  return {
    ready,
    total: items.length,
    requiredReady,
    requiredTotal: requiredItems.length,
    missingRequired: requiredItems.filter((doc) => !doc.ready).map((doc) => doc.label),
    items,
  };
}

function makeStatusEvent({
  refType,
  refId,
  fromStatus,
  toStatus,
  messageCustomer,
  messageInternal,
  operator = "system",
  occurredAt = new Date().toISOString(),
}: Omit<StatusEvent, "id" | "operator" | "occurredAt"> & { operator?: StatusEvent["operator"]; occurredAt?: string }) {
  return {
    id: makeEventId(),
    refType,
    refId,
    fromStatus,
    toStatus,
    messageCustomer,
    messageInternal,
    operator,
    occurredAt,
  };
}

function normalizeEvents(item: Submission, normalizedId: string): StatusEvent[] {
  const existing = Array.isArray(item.events) ? item.events : [];
  if (existing.length > 0) {
    return existing.map((event) => ({
      ...event,
      refId: normalizedId,
    }));
  }

  const createdAt = item.createdAt || new Date().toISOString();
  return [
    {
      id: `EVT-${normalizedId}-created`,
      refType: item.type,
      refId: normalizedId,
      toStatus: item.status,
      messageCustomer: item.type === "inquiry" ? inquiryCustomerMessage(item.status) : inboundCustomerMessage(),
      operator: "system",
      occurredAt: createdAt,
    },
  ];
}

function normalizeSubmission(item: Submission): Submission {
  const id = customerFacingId(item.id);
  return {
    ...item,
    id,
    events: normalizeEvents(item, id),
  } as Submission;
}

function submissionTitle(item: Submission) {
  return item.type === "inquiry" ? item.company : item.customer || item.productName;
}

function submissionSearchText(item: Submission) {
  const fields =
    item.type === "inquiry"
      ? [
          item.id,
          item.customerCode,
          item.company,
          item.contact,
          item.phone,
          item.email,
          item.platform,
          item.volume,
          item.service,
          item.status,
          item.tailDeliveryNeed,
          item.note,
          item.quoteEstimate,
          item.followUpNote,
          item.quoteDraft?.notes,
          item.quoteResponse?.message,
        ]
      : [
          item.id,
          item.customerCode,
          item.customer,
          item.contact,
          item.phone,
          item.platform,
          item.transport,
          item.tracking,
          item.productName,
          item.service,
          item.attribute,
          item.status,
          item.supplementNote,
          item.opsNote,
          item.exceptionNote,
          ...(item.attachmentNames ?? []),
          ...(item.skuLines ?? []).flatMap((line) => [line.skuCode, line.productName]),
        ];
  return fields.filter(Boolean).join(" ").toLowerCase();
}

const localStorePath = process.env.VERCEL
  ? path.join("/tmp", "warehouse-system-data", "submissions.json")
  : path.join(process.cwd(), ".local-data", "submissions.json");

async function readLocalSubmissions() {
  try {
    const raw = await readFile(localStorePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Submission[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeLocalSubmissions(items: Submission[]) {
  await mkdir(path.dirname(localStorePath), { recursive: true });
  await writeFile(localStorePath, JSON.stringify(items, null, 2), "utf8");
}

async function upsertLocalSubmission(item: Submission) {
  const normalized = normalizeSubmission(item);
  const items = await readLocalSubmissions();
  const nextItems = items.map((stored) => normalizeSubmission(stored));
  const index = nextItems.findIndex((stored) => stored.id.toLowerCase() === normalized.id.toLowerCase());

  if (index >= 0) {
    nextItems[index] = normalized;
  } else {
    nextItems.unshift(normalized);
  }

  nextItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  await writeLocalSubmissions(nextItems);
  return normalized;
}

async function findLocalSubmission(id: string, type?: Submission["type"], customerCode?: string) {
  const items = (await readLocalSubmissions()).map((item) => normalizeSubmission(item));
  return (
    items.find(
      (item) =>
        item.id.toLowerCase() === id.toLowerCase() &&
        (!type || item.type === type) &&
        (!customerCode || item.customerCode === customerCode),
    ) ?? null
  );
}

async function upsertSubmission(item: Submission) {
  if (!hasPostgresConfig()) return upsertLocalSubmission(item);

  const sql = getSql();
  const normalized = normalizeSubmission(item);
  await sql`
    insert into warehouse_submissions (
      id,
      type,
      customer_code,
      status,
      title,
      contact,
      phone,
      search_text,
      payload,
      created_at,
      updated_at
    )
    values (
      ${normalized.id},
      ${normalized.type},
      ${normalized.customerCode ?? PUBLIC_LEAD_CUSTOMER_CODE},
      ${normalized.status},
      ${submissionTitle(normalized)},
      ${normalized.contact},
      ${normalized.phone},
      ${submissionSearchText(normalized)},
      ${sql.json(normalized)},
      ${normalized.createdAt},
      ${normalized.updatedAt ?? null}
    )
    on conflict (id) do update set
      type = excluded.type,
      customer_code = excluded.customer_code,
      status = excluded.status,
      title = excluded.title,
      contact = excluded.contact,
      phone = excluded.phone,
      search_text = excluded.search_text,
      payload = excluded.payload,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `;
  return normalized;
}

async function findSubmission(id: string, type?: Submission["type"], customerCode?: string) {
  if (!hasPostgresConfig()) return findLocalSubmission(id, type, customerCode);

  const sql = getSql();
  const rows = await sql<{ payload: Submission }[]>`
    select payload
    from warehouse_submissions
    where lower(id) = ${id.toLowerCase()}
      and (${type ?? null}::text is null or type = ${type ?? null})
      and (${customerCode ?? null}::text is null or customer_code = ${customerCode ?? null})
    limit 1
  `;
  return rows[0]?.payload ? normalizeSubmission(rows[0].payload) : null;
}

export async function addInquiry(input: Omit<InquirySubmission, "id" | "type" | "createdAt" | "status" | "events">) {
  const id = makeId("咨询");
  const createdAt = new Date().toISOString();
  const submission: InquirySubmission = {
    ...input,
    id,
    type: "inquiry",
    createdAt,
    status: "new",
    events: [
      makeStatusEvent({
        refType: "inquiry",
        refId: id,
        toStatus: "new",
        messageCustomer: inquiryCustomerMessage("new"),
        messageInternal: "官网询盘表单创建新报价需求。",
        occurredAt: createdAt,
      }),
    ],
  };
  return upsertSubmission(submission) as Promise<InquirySubmission>;
}

export async function addInbound(input: Omit<InboundSubmission, "id" | "type" | "createdAt" | "status" | "events">) {
  const id = makeId("入库-UK");
  const createdAt = new Date().toISOString();
  const submission: InboundSubmission = {
    ...input,
    id,
    type: "inbound",
    createdAt,
    status: "submitted",
    events: [
      makeStatusEvent({
        refType: "inbound",
        refId: id,
        toStatus: "submitted",
        messageCustomer: inboundCustomerMessage(),
        messageInternal: "客户创建入库预报，等待资料审核。",
        occurredAt: createdAt,
      }),
    ],
  };
  return upsertSubmission(submission) as Promise<InboundSubmission>;
}

export async function supplementInbound({
  id,
  tracking,
  attachmentNames,
  supplementNote,
  customerCode,
}: {
  id: string;
  tracking?: string;
  attachmentNames?: string[];
  supplementNote?: string;
  customerCode?: string;
}) {
  const current = (await findSubmission(id, "inbound", customerCode)) as InboundSubmission | null;
  if (!current) return null;
  const nextAttachments = Array.from(new Set([...(current.attachmentNames ?? []), ...(attachmentNames ?? [])].map((name) => name.trim()).filter(Boolean)));
  const now = new Date().toISOString();
  const events = [
    ...(current.events ?? normalizeEvents(current, current.id)),
    makeStatusEvent({
      refType: "inbound",
      refId: current.id,
      toStatus: current.status,
      messageCustomer: "客户已补交入库资料，客服和仓库会继续审核追踪号、文件和到仓安排。",
      messageInternal: [
        tracking?.trim() ? "补充追踪号/承运信息" : "",
        attachmentNames?.length ? `补充 ${attachmentNames.length} 个附件名称` : "",
        supplementNote?.trim() ? "补充备注说明" : "",
      ]
        .filter(Boolean)
        .join("；"),
      operator: "customer",
      occurredAt: now,
    }),
  ];
  const updated: InboundSubmission = {
    ...current,
    tracking: tracking?.trim() || current.tracking,
    attachmentNames: nextAttachments,
    supplementNote: supplementNote?.trim() || current.supplementNote,
    updatedAt: now,
    events,
  };

  return upsertSubmission(updated) as Promise<InboundSubmission>;
}

export async function getInboundSubmission(id: string) {
  return (await findSubmission(id, "inbound")) as InboundSubmission | null;
}

export async function updateInboundWorkflow({
  id,
  status,
  appointmentAt,
  opsNote,
  exceptionNote,
}: {
  id: string;
  status?: InboundStatus;
  appointmentAt?: string;
  opsNote?: string;
  exceptionNote?: string;
}) {
  const current = (await findSubmission(id, "inbound")) as InboundSubmission | null;
  if (!current) return null;
  const now = new Date().toISOString();
  const nextStatus = status ?? current.status;
  const cleanOpsNote = opsNote?.trim();
  const cleanExceptionNote = exceptionNote?.trim();
  const events = [...(current.events ?? normalizeEvents(current, current.id))];
  const isStatusChanged = Boolean(status && status !== current.status);
  const hasNoteChange = Boolean(cleanOpsNote && cleanOpsNote !== current.opsNote);
  const hasExceptionChange = Boolean(cleanExceptionNote && cleanExceptionNote !== current.exceptionNote);

  if (isStatusChanged || hasNoteChange || hasExceptionChange) {
    events.push(
      makeStatusEvent({
        refType: "inbound",
        refId: current.id,
        fromStatus: current.status,
        toStatus: nextStatus,
        messageCustomer: isStatusChanged ? inboundCustomerMessageForStatus(nextStatus) : `仓库更新备注：${cleanOpsNote || cleanExceptionNote}`,
        messageInternal: [
          isStatusChanged ? `ASN 状态更新为 ${inboundStatusLabel(nextStatus)}` : "",
          cleanOpsNote ? `运营备注：${cleanOpsNote}` : "",
          cleanExceptionNote ? `异常说明：${cleanExceptionNote}` : "",
        ]
          .filter(Boolean)
          .join("；"),
        operator: "ops",
        occurredAt: now,
      }),
    );
  }

  const updated: InboundSubmission = {
    ...current,
    status: nextStatus,
    appointmentAt: appointmentAt?.trim() || current.appointmentAt,
    opsNote: cleanOpsNote || current.opsNote,
    exceptionNote: cleanExceptionNote || current.exceptionNote,
    updatedAt: now,
    events,
  };

  return upsertSubmission(updated) as Promise<InboundSubmission>;
}

export async function createInboundReceivingException({
  id,
  type,
  severity,
  skuCode,
  cartonNo,
  expectedQty,
  actualQty,
  message,
  operator,
}: {
  id: string;
  type: InboundReceivingExceptionType;
  severity: "warning" | "critical";
  skuCode?: string;
  cartonNo?: string;
  expectedQty?: number;
  actualQty?: number;
  message: string;
  operator: string;
}) {
  const current = (await findSubmission(id, "inbound")) as InboundSubmission | null;
  if (!current) return { task: null, error: "未找到入库任务" };

  const occurredAt = new Date().toISOString();
  const cleanMessage = message.trim() || "入库收货差异待核对";
  const exception: InboundReceivingException = {
    id: makeInboundExceptionId(),
    type,
    status: "open",
    severity,
    skuCode: skuCode?.trim() || undefined,
    cartonNo: cartonNo?.trim() || undefined,
    expectedQty,
    actualQty,
    message: cleanMessage,
    operator,
    createdAt: occurredAt,
  };
  const nextStatus: InboundStatus = severity === "critical" ? "exception" : "on_hold";
  const events = [
    ...(current.events ?? normalizeEvents(current, current.id)),
    makeStatusEvent({
      refType: "inbound",
      refId: current.id,
      fromStatus: current.status,
      toStatus: nextStatus,
      messageCustomer: severity === "critical" ? "入库收货发现差异，仓库正在核对处理方案。" : "入库收货有待确认事项，仓库正在复核。",
      messageInternal: `收货差异：${cleanMessage}`,
      operator: "ops",
      occurredAt,
    }),
  ];

  const updated: InboundSubmission = {
    ...current,
    status: nextStatus,
    exceptionNote: cleanMessage,
    receivingExceptions: [exception, ...(current.receivingExceptions ?? [])],
    updatedAt: occurredAt,
    events,
  };

  return { task: (await upsertSubmission(updated)) as InboundSubmission, exception, error: null };
}

export async function resolveInboundReceivingException({
  id,
  exceptionId,
  status,
  note,
  operator,
}: {
  id: string;
  exceptionId: string;
  status: InboundReceivingExceptionStatus;
  note?: string;
  operator: string;
}) {
  const current = (await findSubmission(id, "inbound")) as InboundSubmission | null;
  if (!current) return { task: null, error: "未找到入库任务" };
  const exception = current.receivingExceptions?.find((item) => item.id === exceptionId);
  if (!exception) return { task: current, error: "未找到入库异常记录" };

  const occurredAt = new Date().toISOString();
  const cleanNote = note?.trim();
  const nextExceptions = (current.receivingExceptions ?? []).map((item) =>
    item.id === exceptionId
      ? {
          ...item,
          status,
          resolvedBy: status === "resolved" || status === "ignored" ? operator : item.resolvedBy,
          resolvedAt: status === "resolved" || status === "ignored" ? occurredAt : item.resolvedAt,
          resolutionNote: cleanNote || item.resolutionNote,
        }
      : item,
  );
  const stillOpenCritical = nextExceptions.some((item) => (item.status === "open" || item.status === "investigating") && item.severity === "critical");
  const nextStatus: InboundStatus = current.status === "exception" && !stillOpenCritical ? "receiving" : current.status;
  const events = [
    ...(current.events ?? normalizeEvents(current, current.id)),
    makeStatusEvent({
      refType: "inbound",
      refId: current.id,
      fromStatus: current.status,
      toStatus: nextStatus,
      messageCustomer: status === "resolved" ? "入库收货差异已处理，仓库继续推进验收。" : status === "ignored" ? "入库收货差异已关闭，仓库继续推进验收。" : "入库收货差异正在处理中。",
      messageInternal: `${status === "resolved" ? "收货差异已处理" : status === "ignored" ? "收货差异已忽略" : "收货差异处理中"}：${exception.message}${cleanNote ? `；${cleanNote}` : ""}`,
      operator: "ops",
      occurredAt,
    }),
  ];

  const updated: InboundSubmission = {
    ...current,
    status: nextStatus,
    receivingExceptions: nextExceptions,
    updatedAt: occurredAt,
    events,
  };

  return { task: (await upsertSubmission(updated)) as InboundSubmission, error: null };
}

export async function updateInquiryWorkflow({
  id,
  status,
  followUpNote,
  nextFollowUpAt,
  quoteDraft,
}: {
  id: string;
  status?: InquiryStatus;
  followUpNote?: string;
  nextFollowUpAt?: string;
  quoteDraft?: Omit<InquiryQuoteDraft, "updatedAt" | "currency">;
}) {
  const current = (await findSubmission(id, "inquiry")) as InquirySubmission | null;
  if (!current) return null;
  const now = new Date().toISOString();
  const nextStatus = status ?? current.status;
  const events = [...(current.events ?? normalizeEvents(current, current.id))];
  const isStatusChanged = Boolean(status && status !== current.status);
  const hasFollowUpNote = Boolean(followUpNote?.trim() && followUpNote.trim() !== current.followUpNote);

  if (isStatusChanged) {
    events.push(
      makeStatusEvent({
        refType: "inquiry",
        refId: current.id,
        fromStatus: current.status,
        toStatus: nextStatus,
        messageCustomer: inquiryCustomerMessage(nextStatus),
        messageInternal: "运营后台更新询盘状态。",
        operator: "ops",
        occurredAt: now,
      }),
    );
  } else if (quoteDraft) {
    events.push(
      makeStatusEvent({
        refType: "inquiry",
        refId: current.id,
        toStatus: nextStatus,
        messageCustomer: "客服已更新报价方案，请核对服务项目、费用口径和有效期。",
        messageInternal: "运营后台更新报价草案。",
        operator: "ops",
        occurredAt: now,
      }),
    );
  } else if (hasFollowUpNote) {
    events.push(
      makeStatusEvent({
        refType: "inquiry",
        refId: current.id,
        toStatus: nextStatus,
        messageCustomer: `客服已更新跟进说明：${followUpNote?.trim()}`,
        messageInternal: "运营后台更新跟进备注。",
        operator: "ops",
        occurredAt: now,
      }),
    );
  }

  const updated: InquirySubmission = {
    ...current,
    status: nextStatus,
    followUpNote: followUpNote?.trim() || current.followUpNote,
    nextFollowUpAt: nextFollowUpAt?.trim() || current.nextFollowUpAt,
    quoteDraft: quoteDraft
      ? {
          ...(current.quoteDraft ?? { currency: "GBP", updatedAt: now }),
          ...quoteDraft,
          currency: "GBP",
          updatedAt: now,
        }
      : current.quoteDraft,
    updatedAt: now,
    events,
  };

  return upsertSubmission(updated) as Promise<InquirySubmission>;
}

export async function respondToInquiryQuote({
  id,
  decision,
  message,
  customerCode,
}: {
  id: string;
  decision: InquiryQuoteResponse["decision"];
  message?: string;
  customerCode?: string;
}) {
  const current = (await findSubmission(id, "inquiry", customerCode)) as InquirySubmission | null;
  if (!current) return null;
  if (!current.quoteDraft) return null;

  const now = new Date().toISOString();
  const nextStatus: InquiryStatus = decision === "accepted" ? "quote_accepted" : "quote_question";
  const cleanMessage = message?.trim();
  const events = [
    ...(current.events ?? normalizeEvents(current, current.id)),
    makeStatusEvent({
      refType: "inquiry",
      refId: current.id,
      fromStatus: current.status,
      toStatus: nextStatus,
      messageCustomer:
        decision === "accepted"
          ? "客户已确认报价方案，可以继续创建入库预报。"
          : `客户已提交报价问题${cleanMessage ? `：${cleanMessage}` : "，等待客服核对回复。"}`,
      messageInternal:
        decision === "accepted"
          ? "客户在工作台确认报价。"
          : `客户在工作台提出报价问题${cleanMessage ? `：${cleanMessage}` : ""}`,
      operator: "customer",
      occurredAt: now,
    }),
  ];

  const updated: InquirySubmission = {
    ...current,
    status: nextStatus,
    quoteResponse: {
      decision,
      message: cleanMessage,
      respondedAt: now,
    },
    updatedAt: now,
    events,
  };

  return upsertSubmission(updated) as Promise<InquirySubmission>;
}

export async function getSubmissions() {
  if (!hasPostgresConfig()) {
    return (await readLocalSubmissions())
      .map((row) => normalizeSubmission(row))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const sql = getSql();
  const rows = await sql<{ payload: Submission }[]>`
    select payload
    from warehouse_submissions
    order by created_at desc
  `;
  return rows.map((row) => normalizeSubmission(row.payload));
}

export async function getSubmissionsForCustomer(customerCode: string) {
  if (!hasPostgresConfig()) {
    return (await readLocalSubmissions())
      .map((row) => normalizeSubmission(row))
      .filter((row) => row.customerCode === customerCode)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const sql = getSql();
  const rows = await sql<{ payload: Submission }[]>`
    select payload
    from warehouse_submissions
    where customer_code = ${customerCode}
    order by created_at desc
  `;
  return rows.map((row) => normalizeSubmission(row.payload));
}
