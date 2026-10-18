import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getStaffWhitelistView, requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";

const approvalTriggerLabel: Record<string, string> = {
  inventory_adjustment: "库存调整",
  stocktake_difference: "盘点差异",
  transfer_order: "分仓调拨",
  billing_lock: "账单锁定",
  carrier_fee_diff: "运费差异",
  customer_status: "客户状态",
  manual_inbound_outbound: "手工出入库",
  manual_fee_adjustment: "手工费用调整",
  outbound_intercept: "出库截单回库",
  claim_approval: "异常赔付审批",
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function attachmentHeader(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download.csv";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function csvResponse(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\ufeff${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentHeader(filename),
    },
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "permissions", expansionData)) return NextResponse.json({ error: "当前账号无权限导出员工准入报表。" }, { status: 403 });

  const staffWhitelist = getStaffWhitelistView();
  const rows: unknown[][] = [["类型", "对象", "角色/场景", "来源/状态", "准入/权限", "风险/要求", "更新时间"]];

  if (staffWhitelist.length === 0) {
    rows.push(["员工白名单", "未配置", "", "", "不可确认", "生产后台上线前必须配置 STAFF_WHITELIST_JSON", ""]);
  } else {
    staffWhitelist.forEach((account) => {
      rows.push(["员工白名单", `${account.displayName}（${account.username}）`, account.roleLabel, account.source, "允许登录", account.risks.join("；") || "正常", ""]);
    });
  }

  if (expansionData.rolePermissions.length === 0) {
    rows.push(["角色权限", "系统默认权限", "全部角色", "默认", "按内置角色权限执行", "上线前建议导出复核运营、仓库、财务权限", ""]);
  } else {
    expansionData.rolePermissions.forEach((item) => {
      rows.push(["角色权限", item.role, item.role, item.requireSecondConfirm ? "敏感操作二次确认" : "未开启二次确认", item.allowedModules.join("、") || "未配置模块", item.sensitiveActions.join("、") || "未配置敏感操作", item.updatedAt]);
    });
  }

  if (expansionData.approvalRules.length === 0) {
    rows.push(["审批规则", "未配置", "", "", "暂无审批规则", "建议先配置库存调整、账单锁定、运费差异和客户状态审批", ""]);
  } else {
    expansionData.approvalRules.forEach((item) => {
      const requirements = [
        item.requireReason ? "必须填写原因" : "",
        item.requireAttachment ? "必须上传附件" : "",
        item.minAmount ? `金额达到 £${item.minAmount.toFixed(2)} 触发` : "",
        item.minQuantity ? `数量达到 ${item.minQuantity} 件触发` : "",
        item.escalationRole ? `超时升级：${item.escalationRole}` : "",
      ].filter(Boolean);
      rows.push([
        "审批规则",
        item.name,
        approvalTriggerLabel[item.trigger] ?? item.trigger,
        item.status === "active" ? "启用" : item.status === "paused" ? "暂停" : "草稿",
        `审批角色：${item.approverRoles.join("、")}；SLA ${item.slaHours} 小时`,
        requirements.join("；") || "无额外要求",
        item.updatedAt,
      ]);
    });
  }

  if (new URL(request.url).searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: `${staff.displayName} / ${staff.role}`,
      targetType: "report",
      targetId: "staff-access",
      summary: "导出员工准入与权限审计报表",
      note: `白名单 ${staffWhitelist.length} 个，角色权限 ${expansionData.rolePermissions.length} 条，审批规则 ${expansionData.approvalRules.length} 条。`,
    });
  }

  return csvResponse("员工准入与权限审计报表.csv", rows);
}
