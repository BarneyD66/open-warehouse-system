import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { addCoreOutboundTrackingEvent, type OutboundTrackingEvent } from "@/lib/warehouseCoreStore";

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

export async function GET() {
  await requireStaffSession();
  return csvResponse("追踪号上传模板.csv", [
    ["出库单号", "追踪号", "承运商", "服务名称", "物流状态", "节点说明", "地点"],
    ["OUT-202605-0001", "RM123456789GB", "Royal Mail", "Tracked 48", "运输中", "承运商已扫描收件", "Sheffield"],
  ]);
}

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as { csv?: string };
  const rows = parseCsv(clean(body.csv));
  const errors: string[] = [];
  const updatedIds: string[] = [];

  if (rows.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, errors: ["CSV 没有可处理的追踪号明细"] }, { status: 400 });
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const id = clean(rowValue(row, ["出库单号", "出库订单号", "outboundId", "id", "orderId"]));
    const trackingNumber = clean(rowValue(row, ["追踪号", "物流单号", "运单号", "trackingNumber", "trackingNo", "trackNo"]));
    const status = normalizeTrackingStatus(clean(rowValue(row, ["物流状态", "状态", "status"])));

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
      detail: clean(rowValue(row, ["节点说明", "说明", "detail"])) || `${carrierName || "承运商"}追踪更新 / ${trackingNumber}`,
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
  }

  return NextResponse.json({
    updated: updatedIds.length,
    skipped: Math.max(rows.length - updatedIds.length, 0),
    updatedIds,
    errors,
  });
}
