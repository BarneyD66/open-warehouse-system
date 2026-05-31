import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { buildInboundDocumentChecklist, getSubmissions, inboundStatusLabel, type InboundSubmission, type StatusEvent, type Submission } from "@/lib/localStore";

export const runtime = "nodejs";

function clean(value: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function statusText(item: Submission) {
  if (item.type === "inquiry") {
    const labels = {
      new: "已收到，待方案评估",
      contacted: "客服已联系",
      quoted: "已生成报价方案",
      waiting_customer: "待客户确认报价",
      quote_accepted: "客户已确认报价",
      quote_question: "客户有报价问题",
      converted_to_inbound: "已转入入库预报",
      closed: "已关闭",
    };
    return labels[item.status] ?? labels.new;
  }
  const checklist = buildInboundDocumentChecklist(item);
  if (["exception", "on_hold", "cancelled", "closed"].includes(item.status)) return inboundStatusLabel(item.status);
  if (checklist.missingRequired.length > 0) return "待补资料";
  return inboundStatusLabel(item.status);
}

function inboundNextAction(item: InboundSubmission) {
  const checklist = buildInboundDocumentChecklist(item);
  if (checklist.missingRequired.length > 0) return `建议补交：${checklist.missingRequired.join("、")}，便于仓库审核。`;
  const actions: Record<InboundSubmission["status"], string> = {
    pending_review: "等待仓库审核资料，审核后会确认预约送仓和收货安排。",
    submitted: "等待仓库审核资料，审核后会确认预约送仓和收货安排。",
    docs_review: "仓库正在审核资料；如发现问题，客服会继续在时间线反馈需要补充的内容。",
    docs_review_passed: "资料已通过审核，请等待预约入仓确认或按客服要求安排送仓。",
    appointment_confirmed: item.appointmentAt ? `请按 ${item.appointmentAt.replace("T", " ")} 的安排送仓，并保持承运信息可查。` : "入仓预约已确认，请按客服确认的时间和要求安排送仓。",
    arrived: "货件已到仓，仓库将按预报核对箱数、SKU、外箱标签和装箱单。",
    receiving: "仓库正在收货验收，如有差异或破损会继续记录异常。",
    received: "货件已完成收货，等待上架或进入后续 FBA/一件代发处理。",
    putaway_completed: "货件已完成上架，后续可以进入库存周转、出库或 FBA 补仓。",
    closed: "该入库预报已关闭。如有新货件，请重新创建入库预报。",
    on_hold: item.opsNote || "该入库预报暂缓处理，请等待客服确认下一步。",
    exception: item.exceptionNote || "该入库预报存在异常，客服/仓库会继续核对并反馈处理方案。",
    cancelled: "该入库预报已取消，如需重新入仓请创建新的入库预报。",
  };
  return actions[item.status] ?? actions.submitted;
}

function nextAction(item: Submission) {
  if (item.type === "inquiry") {
    if (item.status === "quoted" && item.quoteDraft) {
      return `请确认报价方案${item.quoteDraft.validUntil ? `（有效期至 ${item.quoteDraft.validUntil}）` : ""}；如准备发货，可继续创建入库预报。`;
    }
    if (item.status === "quote_accepted") return "报价已确认。下一步请创建入库预报，并补齐装箱单、SKU 清单、外箱标签和预计到仓时间。";
    if (item.status === "quote_question") return "报价问题已提交，客服会结合服务项目、SKU、尺寸重量和尾程渠道继续核对回复。";
    if (item.status === "waiting_customer") return "客服正在等待您确认报价、SKU 清单、箱规或预计入库时间。";
    if (item.status === "converted_to_inbound") return "该咨询已进入入库预报阶段，请继续补齐外箱标签、装箱单、追踪号和到仓时间。";
    if (item.followUpNote) return `客服跟进：${item.followUpNote}`;
    return "客服会先确认平台、货量、品类和服务范围；如已准备发货，可继续创建入库预报。";
  }
  return inboundNextAction(item);
}

function quoteSummary(item: Submission) {
  if (item.type !== "inquiry" || !item.quoteDraft) return "";
  const total = typeof item.quoteDraft.monthlyFee === "number" ? ` / 报价方案 £${item.quoteDraft.monthlyFee.toLocaleString("en-GB", { maximumFractionDigits: 2 })}/月` : " / 已有报价方案";
  return total;
}

function timeline(item: Submission) {
  const events = item.events ?? [];
  return events
    .slice()
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 4)
    .map((event: StatusEvent) => ({
      id: event.id,
      occurredAt: event.occurredAt,
      message: event.messageCustomer,
      operator: event.operator,
    }));
}

function haystack(item: Submission) {
  const fields =
    item.type === "inquiry"
      ? [item.id, item.company, item.contact, item.phone, item.email, item.platform, item.service, item.status, item.quoteEstimate, item.followUpNote, item.quoteDraft?.notes]
      : [item.id, item.customer, item.contact, item.phone, item.platform, item.tracking, item.productName, item.service];
  return fields.filter(Boolean).join(" ").toLowerCase();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = clean(searchParams.get("q"));
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);

  if (!session) {
    return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  }

  if (query.length < 2) {
    return NextResponse.json({ error: "请输入至少 2 个字符" }, { status: 400 });
  }

  const submissions = await getSubmissions();
  const results = submissions
    .filter((item) => item.customerCode === session.customerCode)
    .filter((item) => haystack(item).includes(query))
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      type: item.type,
      createdAt: item.createdAt,
      status: statusText(item),
      nextAction: nextAction(item),
      timeline: timeline(item),
      documentChecklist: item.type === "inbound" ? buildInboundDocumentChecklist(item) : undefined,
      title: item.type === "inquiry" ? item.company : item.customer || item.productName,
      contact: item.contact,
      phone: item.phone,
      summary:
        item.type === "inquiry"
          ? `${item.platform} / ${item.volume} / ${item.service}${item.quoteEstimate ? " / 已带费用预估" : ""}${quoteSummary(item)}`
          : `${item.platform || "未填写平台"} / ${item.cartons} 箱/托 / ${item.skuCount} SKU${item.skuLines?.length ? ` / ${item.skuLines.length} 条明细` : ""} / 预计到仓 ${item.eta}`,
    }));

  return NextResponse.json({ results });
}
