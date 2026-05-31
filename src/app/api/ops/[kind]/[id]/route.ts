import { NextResponse } from "next/server";
import { updateOpsItem, type OpsKind } from "@/lib/opsStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";

const allowedStatuses = {
  logistics: ["open", "investigating", "waiting_customer", "resolved"],
  outbound: ["pending_review", "picking", "label_pending", "packing_check", "handover", "shipped", "blocked"],
  inventory: ["normal", "low_stock", "aging", "replenishment_pending", "sync_issue"],
} satisfies Record<OpsKind, string[]>;

type RouteContext = {
  params: Promise<{ kind: string; id: string }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isOpsKind(value: string): value is OpsKind {
  return value === "logistics" || value === "outbound" || value === "inventory";
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = parseStaffSession(request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${staffCookieName}=([^;]+)`))?.[1]);
  if (!session) {
    return NextResponse.json({ error: "请先登录运营后台" }, { status: 401 });
  }

  const { kind: rawKind, id } = await context.params;
  const kind = rawKind as OpsKind;

  if (!isOpsKind(kind)) {
    return NextResponse.json({ error: "无效的运营模块" }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const status = clean(body.status);

  if (status && !allowedStatuses[kind].includes(status)) {
    return NextResponse.json({ error: "无效的状态" }, { status: 400 });
  }

  const updated = await updateOpsItem(kind, decodeURIComponent(id), {
    status: status || undefined,
    owner: clean(body.owner),
    note: clean(body.note),
  });

  if (!updated) {
    return NextResponse.json({ error: "未找到运营记录" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
