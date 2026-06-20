import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { addCustomerWorkOrderMessage, createCustomerWorkOrder, getCustomerWorkOrders } from "@/lib/opsExpansionStore";

export const runtime = "nodejs";

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function classifyWorkOrder(input: { category: string; title: string; description: string; referenceNo?: string }) {
  const text = [input.category, input.title, input.description, input.referenceNo ?? ""].join(" ").toLowerCase();
  const isLogisticsFeeReview = containsAny(text, [
    "物流费用",
    "运费差异",
    "运费复核",
    "费用差异",
    "物流证据包",
    "shipping fee",
    "carrier fee",
    "freight difference",
  ]);
  if (isLogisticsFeeReview) {
    return {
      riskTag: "logistics_fee_review" as const,
      linkedDownloadHref: "/api/downloads?kind=logistics-evidence",
      financeReviewRequired: true,
      priority: "urgent" as const,
      internalNote: "系统识别：客户提交物流费用差异复核，请财务/物流优先核对物流证据包、承运商实际费用和月结账单。",
    };
  }

  const isBillingDispute = containsAny(text, [
    "账单争议",
    "账单异议",
    "费用争议",
    "付款争议",
    "billing dispute",
    "invoice dispute",
  ]);
  if (isBillingDispute) {
    return {
      riskTag: "billing_dispute" as const,
      linkedDownloadHref: "/billing",
      financeReviewRequired: true,
      priority: "urgent" as const,
      internalNote: "系统识别：客户提交账单争议，请财务优先核对账单明细、费用规则和客户说明。",
    };
  }

  return {};
}

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台。" }, { status: 401 });
  const workOrders = await getCustomerWorkOrders(session.customerCode);
  return NextResponse.json({ workOrders });
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台。" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (clean(body.action) === "add_message") {
    const result = await addCustomerWorkOrderMessage({
      id: clean(body.id),
      customerCode: session.customerCode,
      authorRole: "customer",
      authorName: session.username,
      body: clean(body.body),
      visibleToCustomer: true,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ workOrder: result.workOrder });
  }

  const category = clean(body.category);
  const title = clean(body.title);
  const description = clean(body.description);
  if (!category || !title || !description) return NextResponse.json({ error: "请选择工单类型，并填写标题和说明。" }, { status: 400 });

  const referenceNo = clean(body.referenceNo);
  const classification = classifyWorkOrder({ category, title, description, referenceNo });
  const workOrder = await createCustomerWorkOrder({
    customerCode: session.customerCode,
    category,
    title,
    priority: classification.priority ?? (clean(body.priority) === "urgent" ? "urgent" : "normal"),
    referenceNo,
    description,
    customerContact: clean(body.customerContact),
    internalNote: classification.internalNote,
    riskTag: classification.riskTag,
    linkedDownloadHref: classification.linkedDownloadHref,
    financeReviewRequired: classification.financeReviewRequired,
  });
  return NextResponse.json({ workOrder });
}
