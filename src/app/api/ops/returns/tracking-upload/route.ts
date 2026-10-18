import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/staffAuth";
import { getWarehouseCoreData, updateCustomerReturnTracking } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function POST(request: Request) {
  const staff = await requireStaffSession();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = parseCsv(clean(body.csv));
  if (rows.length === 0) return NextResponse.json({ error: "请上传退货追踪号 CSV" }, { status: 400 });

  const data = await getWarehouseCoreData();
  const returnById = new Map(data.returnOrders.map((item) => [item.id, item]));
  const results: Array<{ row: number; returnId: string; customerCode?: string; status: "updated" | "skipped"; message: string }> = [];
  let updated = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const returnId = clean(rowValue(row, ["退货单号", "RMA单号", "RMA", "returnId", "id"]));
    const buyerReturnTracking = clean(rowValue(row, ["买家退货追踪号", "退货追踪号", "追踪号", "tracking", "trackingNo"]));
    const expectedArrivalDate = clean(rowValue(row, ["预计到仓日期", "预计到仓", "expectedArrivalDate"]));
    const note = clean(rowValue(row, ["备注", "note"]));
    const order = returnById.get(returnId);

    if (!order) {
      results.push({ row: rowNumber, returnId, status: "skipped", message: "退货单号不存在" });
      continue;
    }
    if (!buyerReturnTracking) {
      results.push({ row: rowNumber, returnId, customerCode: order.customerCode, status: "skipped", message: "买家退货追踪号为空" });
      continue;
    }

    const result = await updateCustomerReturnTracking({
      id: returnId,
      customerCode: order.customerCode,
      buyerReturnTracking,
      expectedArrivalDate,
      customerNote: note || `运营批量补充 / ${staff.displayName || staff.username}`,
    });

    if (result.error) {
      results.push({ row: rowNumber, returnId, customerCode: order.customerCode, status: "skipped", message: result.error });
      continue;
    }
    updated += 1;
    results.push({ row: rowNumber, returnId, customerCode: order.customerCode, status: "updated", message: "已更新" });
  }

  return NextResponse.json({ updated, skipped: results.length - updated, results });
}
