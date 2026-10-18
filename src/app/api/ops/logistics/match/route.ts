import { NextResponse } from "next/server";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { batchMatchCoreOutboundCarriers } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "logistics", expansionData)) return NextResponse.json({ error: "当前角色无权操作物流模块" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
  };

  const result = await batchMatchCoreOutboundCarriers({
    ids: Array.isArray(body.ids) ? body.ids : undefined,
    operator: staff.displayName || staff.username,
    carrierConfigs: expansionData.logisticsChannels,
  });

  return NextResponse.json(result);
}
