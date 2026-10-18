import { NextResponse } from "next/server";
import { updateInboundWorkflow, type InboundStatus } from "@/lib/localStore";
import { requireStaffSession } from "@/lib/staffAuth";

export const runtime = "nodejs";

const allowedStatuses: InboundStatus[] = [
  "submitted",
  "docs_review",
  "docs_review_passed",
  "appointment_confirmed",
  "arrived",
  "receiving",
  "received",
  "putaway_completed",
  "closed",
  "on_hold",
  "exception",
  "cancelled",
];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  if (staff.role !== "admin" && staff.role !== "ops") {
    return NextResponse.json({ error: "当前员工角色无权更新入库审核流程。" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const status = clean(body.status) as InboundStatus;

  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "无效的入库状态" }, { status: 400 });
  }

  const updated = await updateInboundWorkflow({
    id,
    status: status || undefined,
    appointmentAt: clean(body.appointmentAt),
    opsNote: clean(body.opsNote),
    exceptionNote: clean(body.exceptionNote),
  });

  if (!updated) {
    return NextResponse.json({ error: "未找到入库预报" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    appointmentAt: updated.appointmentAt,
    opsNote: updated.opsNote,
    exceptionNote: updated.exceptionNote,
    updatedAt: updated.updatedAt,
  });
}
