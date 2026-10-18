import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import {
  getWarehouseCoreData,
  outboundClaimStatusLabel,
  outboundCustomerExceptionDecisionLabel,
  outboundDeliveryExceptionTypeLabel,
  type OutboundClaimStatus,
  type OutboundExceptionStatus,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type CarrierClaimRow = {
  outboundId: string;
  customerCode: string;
  platform: string;
  platformOrderNo: string;
  carrierName: string;
  carrierServiceName: string;
  trackingNumber: string;
  exceptionId: string;
  exceptionType: string;
  exceptionStatus: string;
  claimStatus: string;
  claimAmount: number | "";
  claimNote: string;
  redeliveryRequired: string;
  redeliveryNote: string;
  proofUrl: string;
  customerDecision: string;
  customerDecisionNote: string;
  owner: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
};

const exceptionStatusLabels: Record<OutboundExceptionStatus, string> = {
  open: "待处理",
  investigating: "处理中",
  resolved: "已处理",
  ignored: "已忽略",
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

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function nextActionFor(row: CarrierClaimRow) {
  if (row.exceptionStatus === "已处理" || row.exceptionStatus === "已忽略") return "归档复盘，必要时核对账单抵扣。";
  if (row.customerDecision === outboundCustomerExceptionDecisionLabel.claim_question) return "优先回复客户赔付疑问，并补充承运商处理证据。";
  if (row.claimStatus === outboundClaimStatusLabel.draft) return "整理承运商工单、POD、照片或客户确认记录。";
  if (row.claimStatus === outboundClaimStatusLabel.submitted) return "跟进承运商审核结果，超过 SLA 时升级。";
  if (row.claimStatus === outboundClaimStatusLabel.approved) return "等待赔付到账，并同步财务核销或客户账单抵扣。";
  if (row.claimStatus === outboundClaimStatusLabel.paid) return "确认到账凭证，关闭异常并关联账单。";
  if (row.redeliveryRequired === "是") return "等待客户确认改派信息或承运商改派结果。";
  return "继续处理物流异常并同步客户。";
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData) && !canAccessOpsModule(staff, "logistics", expansionData)) {
    return NextResponse.json({ error: "当前角色无权导出承运商赔付台账。" }, { status: 403 });
  }

  const url = new URL(request.url);
  const customerCode = clean(url.searchParams.get("customerCode")).toLowerCase();
  const claimStatus = clean(url.searchParams.get("claimStatus"));
  const exceptionStatus = clean(url.searchParams.get("status"));
  const carrier = clean(url.searchParams.get("carrier")).toLowerCase();
  const keyword = clean(url.searchParams.get("keyword")).toLowerCase();
  const format = clean(url.searchParams.get("format")) || "csv";
  const coreData = await getWarehouseCoreData();

  const rows = coreData.outboundOrders
    .flatMap((order) =>
      (order.exceptions ?? [])
        .filter((exception) => exception.deliveryExceptionType && (exception.claimAmount || (exception.claimStatus ?? "not_required") !== "not_required" || exception.deliveryExceptionType === "claim"))
        .map((exception) => {
          const row: CarrierClaimRow = {
            outboundId: order.id,
            customerCode: order.customerCode,
            platform: order.platform ?? "",
            platformOrderNo: order.platformOrderNo ?? "",
            carrierName: order.carrierName ?? "",
            carrierServiceName: order.carrierServiceName ?? "",
            trackingNumber: order.trackingNumber ?? "",
            exceptionId: exception.id,
            exceptionType: exception.deliveryExceptionType ? outboundDeliveryExceptionTypeLabel[exception.deliveryExceptionType] : "",
            exceptionStatus: exceptionStatusLabels[exception.status],
            claimStatus: outboundClaimStatusLabel[(exception.claimStatus ?? "draft") as OutboundClaimStatus],
            claimAmount: exception.claimAmount ?? "",
            claimNote: exception.claimNote ?? "",
            redeliveryRequired: exception.redeliveryRequired ? "是" : "否",
            redeliveryNote: exception.redeliveryNote ?? "",
            proofUrl: exception.proofUrl ? `/api/outbounds/${order.id}/proof` : "",
            customerDecision: exception.customerDecision ? outboundCustomerExceptionDecisionLabel[exception.customerDecision] : "",
            customerDecisionNote: exception.customerDecisionNote ?? "",
            owner: exception.operator,
            nextAction: "",
            createdAt: exception.createdAt,
            updatedAt: order.updatedAt ?? exception.createdAt,
            resolvedAt: exception.resolvedAt ?? "",
          };
          row.nextAction = nextActionFor(row);
          return row;
        }),
    )
    .filter((row) => !customerCode || row.customerCode.toLowerCase().includes(customerCode))
    .filter((row) => !claimStatus || claimStatus === "all" || row.claimStatus === outboundClaimStatusLabel[claimStatus as OutboundClaimStatus] || row.claimStatus === claimStatus)
    .filter((row) => !exceptionStatus || exceptionStatus === "all" || row.exceptionStatus === exceptionStatusLabels[exceptionStatus as OutboundExceptionStatus] || row.exceptionStatus === exceptionStatus)
    .filter((row) => !carrier || row.carrierName.toLowerCase().includes(carrier) || row.carrierServiceName.toLowerCase().includes(carrier))
    .filter((row) => !keyword || Object.values(row).join(" ").toLowerCase().includes(keyword))
    .sort((a, b) => {
      const rank: Record<string, number> = { [outboundClaimStatusLabel.submitted]: 0, [outboundClaimStatusLabel.draft]: 1, [outboundClaimStatusLabel.approved]: 2, [outboundClaimStatusLabel.paid]: 3 };
      return (rank[a.claimStatus] ?? 9) - (rank[b.claimStatus] ?? 9) || b.updatedAt.localeCompare(a.updatedAt);
    });

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "carrier-claims",
      summary: "导出承运商赔付台账",
      note: `客户：${customerCode || "全部"}；赔付状态：${claimStatus || "全部"}；承运商：${carrier || "全部"}；行数：${rows.length}`,
    });
  }

  if (format === "json") return NextResponse.json({ rows, generatedAt: new Date().toISOString(), filters: Object.fromEntries(url.searchParams.entries()) });

  return csvResponse("承运商赔付台账.csv", [
    ["出库单号", "客户编号", "平台", "平台订单号", "承运商", "服务", "追踪号", "异常编号", "异常类型", "异常状态", "赔付状态", "预计赔付金额", "赔付说明", "是否改派", "改派说明", "签收证明", "客户确认", "客户备注", "处理人", "下一步动作", "创建时间", "更新时间", "关闭时间"],
    ...rows.map((row) => [
      row.outboundId,
      row.customerCode,
      row.platform,
      row.platformOrderNo,
      row.carrierName,
      row.carrierServiceName,
      row.trackingNumber,
      row.exceptionId,
      row.exceptionType,
      row.exceptionStatus,
      row.claimStatus,
      row.claimAmount,
      row.claimNote,
      row.redeliveryRequired,
      row.redeliveryNote,
      row.proofUrl,
      row.customerDecision,
      row.customerDecisionNote,
      row.owner,
      row.nextAction,
      row.createdAt,
      row.updatedAt,
      row.resolvedAt,
    ]),
  ]);
}
