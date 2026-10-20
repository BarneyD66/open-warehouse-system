import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { CustomerOutboundEditError } from "@/lib/customerOutboundInput";
import { withdrawCustomerOutboundOrder } from "@/lib/warehouseCoreStore";
export const runtime = "nodejs";
export async function POST(request: Request, context: {params:Promise<{id:string}>}) {
  const headers = {"Cache-Control":"private, no-store"};
  const session = parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
  if (!session) return NextResponse.json({error:"请先登录客户工作台"},{status:401,headers});
  const {id} = await context.params;
  const parsed = await request.json().catch(()=>null);
  const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const text = (value:unknown) => typeof value === "string" ? value.trim() : "";
  try {
    const order = await withdrawCustomerOutboundOrder({id,customerCode:session.customerCode,expectedUpdatedAt:text(body.expectedUpdatedAt)});
    return NextResponse.json({order},{headers});
  } catch(error) {
    if(error instanceof CustomerOutboundEditError) return NextResponse.json({error:error.message},{status:error.status,headers});
    console.error("CUSTOMER_OUTBOUND_WITHDRAW_FAILED");
    return NextResponse.json({error:"操作失败，请刷新确认申请状态后再试"},{status:500,headers});
  }
}
