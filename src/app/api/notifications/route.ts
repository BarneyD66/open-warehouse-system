import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseCustomerSession } from "@/lib/customerAuth";
import { dismissNotification } from "@/lib/notificationStore";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string; id?: string };
  if (body.action !== "dismiss" || !body.id) {
    return NextResponse.json({ error: "不支持的待办操作" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const customerSession = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staffSession = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!customerSession && !staffSession) return NextResponse.json({ error: "请先登录后再处理待办" }, { status: 401 });

  if (body.id.startsWith("staff:") && !staffSession) return NextResponse.json({ error: "当前账号无权处理员工待办" }, { status: 403 });
  if (body.id.startsWith("customer:") && !customerSession) return NextResponse.json({ error: "当前账号无权处理客户待办" }, { status: 403 });

  await dismissNotification(body.id);
  return NextResponse.json({ ok: true });
}
