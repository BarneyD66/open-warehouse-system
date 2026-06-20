import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { confirmCustomerReturnResolution, type ReturnResolution } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const resolutions = new Set<ReturnResolution>(["restock", "repair", "dispose", "reship"]);

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const resolution = clean(body.resolution) as ReturnResolution;

  if (!resolutions.has(resolution)) return NextResponse.json({ error: "请选择有效的退货处理方式" }, { status: 400 });

  const result = await confirmCustomerReturnResolution({
    id,
    customerCode: session.customerCode,
    resolution,
    note: clean(body.note),
    operator: session.username,
  });

  if (result.error) return NextResponse.json({ error: result.error, order: result.order }, { status: result.order ? 400 : 404 });
  return NextResponse.json({ order: result.order });
}
