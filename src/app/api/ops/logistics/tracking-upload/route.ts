import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import {
  addCoreOutboundTrackingEvent,
  createCoreOutboundDeliveryException,
  type CoreOutboundOrder,
  type OutboundClaimStatus,
  type OutboundDeliveryExceptionType,
  type OutboundTrackingEvent,
} from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

const trackingStatuses = new Set<OutboundTrackingEvent["status"]>([
  "label_created",
  "warehouse_processing",
  "carrier_handover",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
]);

const statusAliases: Record<string, OutboundTrackingEvent["status"]> = {
  "面单已生成": "label_created",
  "仓库处理中": "warehouse_processing",
  "已交运": "carrier_handover",
  "已交接承运商": "carrier_handover",
  "运输中": "in_transit",
  "运输途中": "in_transit",
  "派送中": "out_for_delivery",
  "已签收": "delivered",
  "签收": "delivered",
  "异常": "exception",
  "物流异常": "exception",
  "派送失败": "exception",
  "地址异常": "exception",
  "退回": "exception",
  "退回仓库": "exception",
};

const exceptionTypeAliases: Record<string, OutboundDeliveryExceptionType> = {
  delivery_failed: "delivery_failed",
  "派送失败": "delivery_failed",
  "投递失败": "delivery_failed",
  address_issue: "address_issue",
  "地址异常": "address_issue",
  "地址错误": "address_issue",
  customer_absent: "customer_absent",
  "收件人不在": "customer_absent",
  "无人签收": "customer_absent",
  damaged: "damaged",
  "运输破损": "damaged",
  "破损": "damaged",
  lost: "lost",
  "疑似丢件": "lost",
  "丢件": "lost",
  return_to_sender: "return_to_sender",
  "退回仓库": "return_to_sender",
  "退回": "return_to_sender",
  claim: "claim",
  "物流赔付": "claim",
  "赔付": "claim",
  proof_uploaded: "proof_uploaded",
  "签收证明": "proof_uploaded",
  manual: "manual",
  "其他异常": "manual",
};

const claimStatusAliases: Record<string, OutboundClaimStatus> = {
  not_required: "not_required",
  "无需赔付": "not_required",
  draft: "draft",
  "待整理材料": "draft",
  submitted: "submitted",
  "已提交承运商": "submitted",
  approved: "approved",
  "已通过": "approved",
  rejected: "rejected",
  "已拒赔": "rejected",
  paid: "paid",
  "已赔付到账": "paid",
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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

function parseCsv(csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [] as Record<string, string>[];

  const split = (line: string) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  const headers = split(lines[0]).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function rowValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const found = Object.entries(row).find(([header]) => header.trim().toLowerCase() === key.trim().toLowerCase());
    if (found) return found[1];
  }
  return "";
}

function normalizeTrackingStatus(value: string): OutboundTrackingEvent["status"] | "" {
  const cleanValue = value.trim();
  if (!cleanValue) return "in_transit";
  if (trackingStatuses.has(cleanValue as OutboundTrackingEvent["status"])) return cleanValue as OutboundTrackingEvent["status"];
  return statusAliases[cleanValue] ?? "";
}

function parseMoney(value: string) {
  const normalized = value.replace(/[£,\s]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function isYes(value: string) {
  return ["1", "true", "yes", "y", "是", "需要", "需要改派"].includes(value.trim().toLowerCase());
}

function normalizeClaimStatus(value: string, claimAmount?: number) {
  if (!value.trim()) return claimAmount ? "draft" : undefined;
  return claimStatusAliases[value.trim()] ?? undefined;
}

function inferExceptionType(value: string, detail: string, status: OutboundTrackingEvent["status"], proofUrl: string): OutboundDeliveryExceptionType | "" {
  const cleanValue = value.trim();
  if (cleanValue && exceptionTypeAliases[cleanValue]) return exceptionTypeAliases[cleanValue];
  if (proofUrl && status === "delivered") return "proof_uploaded";
  if (status !== "exception") return "";

  const text = `${cleanValue} ${detail}`.toLowerCase();
  if (text.includes("address") || text.includes("地址")) return "address_issue";
  if (text.includes("absent") || text.includes("无人") || text.includes("不在")) return "customer_absent";
  if (text.includes("damage") || text.includes("破损")) return "damaged";
  if (text.includes("lost") || text.includes("丢")) return "lost";
  if (text.includes("return") || text.includes("退回")) return "return_to_sender";
  if (text.includes("claim") || text.includes("赔付")) return "claim";
  if (text.includes("fail") || text.includes("失败")) return "delivery_failed";
  return "manual";
}

function alreadyHasSimilarException(order: CoreOutboundOrder, exceptionType: OutboundDeliveryExceptionType, message: string, proofUrl: string) {
  return (order.exceptions ?? []).some((item) => {
    if (item.status === "resolved" || item.status === "ignored") return false;
    if (item.deliveryExceptionType !== exceptionType) return false;
    if (proofUrl && item.proofUrl === proofUrl) return true;
    return item.message.trim() === message.trim();
  });
}

export async function GET() {
  await requireStaffSession();
  return csvResponse("追踪号上传模板.csv", [
    ["出库单号", "追踪号", "承运商", "服务名称", "物流状态", "节点说明", "地点", "异常类型", "是否改派", "改派说明", "签收证明链接", "赔付金额", "赔付状态", "赔付备注"],
    ["OUT-202605-0001", "RM123456789GB", "Royal Mail", "Tracked 48", "运输中", "承运商已扫描收件", "谢菲尔德", "", "", "", "", "", "", ""],
    ["OUT-202605-0002", "RM987654321GB", "Royal Mail", "Tracked 48", "异常", "派送失败，收件人不在", "伦敦", "收件人不在", "是", "请客户确认新地址或改派时间", "", "", "", ""],
    ["OUT-202605-0003", "EV123456789GB", "Evri", "标准服务", "已签收", "前台代签", "曼彻斯特", "签收证明", "", "", "https://carrier.example/pod/EV123456789GB", "", "", ""],
  ]);
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as { csv?: string };
  const rows = parseCsv(clean(body.csv));
  const errors: string[] = [];
  const updatedIds: string[] = [];
  const exceptionIds: string[] = [];

  if (rows.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, errors: ["CSV 没有可处理的追踪号明细"] }, { status: 400 });
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const id = clean(rowValue(row, ["出库单号", "出库订单号", "outboundId", "id", "orderId"]));
    const trackingNumber = clean(rowValue(row, ["追踪号", "物流单号", "运单号", "trackingNumber", "trackingNo", "trackNo"]));
    const status = normalizeTrackingStatus(clean(rowValue(row, ["物流状态", "状态", "status"])));
    const detail = clean(rowValue(row, ["节点说明", "说明", "detail"]));
    const proofUrl = clean(rowValue(row, ["签收证明链接", "签收证明", "POD", "proofUrl", "proof"]));
    const claimAmount = parseMoney(clean(rowValue(row, ["赔付金额", "claimAmount"])));
    const claimStatus = normalizeClaimStatus(clean(rowValue(row, ["赔付状态", "claimStatus"])), claimAmount);
    const claimNote = clean(rowValue(row, ["赔付备注", "赔付说明", "claimNote"]));
    const redeliveryRequired = isYes(clean(rowValue(row, ["是否改派", "需要改派", "redeliveryRequired"])));
    const redeliveryNote = clean(rowValue(row, ["改派说明", "改派要求", "redeliveryNote"]));

    if (!id) {
      errors.push(`第 ${rowNumber} 行缺少出库单号`);
      continue;
    }
    if (!trackingNumber) {
      errors.push(`第 ${rowNumber} 行缺少追踪号`);
      continue;
    }
    if (!status) {
      errors.push(`第 ${rowNumber} 行物流状态不支持：${clean(rowValue(row, ["物流状态", "状态", "status"]))}`);
      continue;
    }

    const carrierName = clean(rowValue(row, ["承运商", "carrierName"]));
    const order = await addCoreOutboundTrackingEvent({
      id,
      status,
      detail: detail || `${carrierName || "承运商"}追踪更新 / ${trackingNumber}`,
      location: clean(rowValue(row, ["地点", "location"])),
      trackingNumber,
      carrierName,
      carrierServiceName: clean(rowValue(row, ["服务名称", "carrierServiceName", "serviceName"])),
      operator: staff.displayName || staff.username,
    });

    if (!order) {
      errors.push(`第 ${rowNumber} 行出库单不存在：${id}`);
      continue;
    }
    updatedIds.push(order.id);

    const exceptionType = inferExceptionType(clean(rowValue(row, ["异常类型", "异常类别", "exceptionType"])), detail, status, proofUrl);
    if (exceptionType) {
      const exceptionMessage = clean(rowValue(row, ["异常说明", "异常备注", "exceptionMessage"])) || detail || `${carrierName || "承运商"}回传${status === "delivered" ? "签收证明" : "物流异常"}`;
      if (alreadyHasSimilarException(order, exceptionType, exceptionMessage, proofUrl)) continue;

      const result = await createCoreOutboundDeliveryException({
        id: order.id,
        exceptionType,
        message: exceptionMessage,
        severity: exceptionType === "proof_uploaded" ? "warning" : "critical",
        redeliveryRequired,
        redeliveryNote,
        proofUrl,
        claimAmount,
        claimStatus,
        claimNote,
        recordTrackingEvent: false,
        operator: staff.displayName || staff.username,
      });
      if (result.error || !result.exception) errors.push(`第 ${rowNumber} 行轨迹已更新，但异常工单生成失败：${result.error || id}`);
      else exceptionIds.push(result.exception.id);
    }
  }

  return NextResponse.json({
    updated: updatedIds.length,
    skipped: Math.max(rows.length - updatedIds.length, 0),
    exceptionsCreated: exceptionIds.length,
    updatedIds,
    exceptionIds,
    errors,
  });
}
