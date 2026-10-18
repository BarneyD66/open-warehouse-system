import { NextResponse } from "next/server";
import { updateInquiryWorkflow, type InquiryStatus } from "@/lib/localStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

const allowedStatuses: InquiryStatus[] = ["new", "contacted", "quoted", "waiting_customer", "quote_accepted", "quote_question", "converted_to_inbound", "closed"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: unknown) {
  const raw = clean(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function PATCH(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  if (staff.role !== "admin" && staff.role !== "ops") {
    return NextResponse.json({ error: "当前员工角色无权更新询盘报价。" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const status = clean(body.status) as InquiryStatus;

  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "无效的询盘状态" }, { status: 400 });
  }

  const quoteDraft = {
    monthlyFee: optionalNumber(body.monthlyFee),
    inboundFee: optionalNumber(body.inboundFee),
    storageFee: optionalNumber(body.storageFee),
    outboundFee: optionalNumber(body.outboundFee),
    returnFee: optionalNumber(body.returnFee),
    fbaFee: optionalNumber(body.fbaFee),
    valueAddedFee: optionalNumber(body.valueAddedFee),
    validUntil: clean(body.validUntil),
    notes: clean(body.quoteNotes),
  };

  const hasQuoteDraft = Object.values(quoteDraft).some((value) => value !== undefined && value !== "");
  const updated = await updateInquiryWorkflow({
    id,
    status: status || undefined,
    followUpNote: clean(body.followUpNote),
    nextFollowUpAt: clean(body.nextFollowUpAt),
    quoteDraft: hasQuoteDraft ? quoteDraft : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "未找到询盘" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt,
    quoteDraft: updated.quoteDraft,
  });
}
