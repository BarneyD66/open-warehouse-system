import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { getWarehouseCoreDataForCustomer, updateCustomerReturnTracking } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

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

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  const firstOpenReturn = data.returnOrders.find((item) => !["restocked", "disposed", "closed"].includes(item.status));
  return csvResponse("退货追踪号批量补充模板.csv", [
    ["退货单号", "买家退货追踪号", "预计到仓日期", "备注"],
    [firstOpenReturn?.id ?? "RET-202606-0001", "RM123456789GB", new Date().toISOString().slice(0, 10), "客户批量补充退货追踪号"],
  ]);
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = parseCsv(clean(body.csv));
  if (rows.length === 0) return NextResponse.json({ error: "请上传包含退货单号和追踪号的 CSV 文件" }, { status: 400 });

  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  const validIds = new Set(data.returnOrders.map((item) => item.id));
  const results: Array<{ row: number; returnId: string; status: "updated" | "skipped"; message: string }> = [];
  let updated = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const returnId = clean(rowValue(row, ["退货单号", "RMA单号", "RMA", "returnId", "id"]));
    const buyerReturnTracking = clean(rowValue(row, ["买家退货追踪号", "退货追踪号", "追踪号", "tracking", "trackingNo"]));
    const expectedArrivalDate = clean(rowValue(row, ["预计到仓日期", "预计到仓", "expectedArrivalDate"]));
    const note = clean(rowValue(row, ["备注", "note"]));

    if (!returnId || !validIds.has(returnId)) {
      results.push({ row: rowNumber, returnId, status: "skipped", message: "退货单号不存在或不属于当前客户" });
      continue;
    }
    if (!buyerReturnTracking) {
      results.push({ row: rowNumber, returnId, status: "skipped", message: "买家退货追踪号为空" });
      continue;
    }

    const result = await updateCustomerReturnTracking({
      id: returnId,
      customerCode: session.customerCode,
      buyerReturnTracking,
      expectedArrivalDate,
      customerNote: note,
    });

    if (result.error) {
      results.push({ row: rowNumber, returnId, status: "skipped", message: result.error });
      continue;
    }
    updated += 1;
    results.push({ row: rowNumber, returnId, status: "updated", message: "已更新" });
  }

  return NextResponse.json({ updated, skipped: results.length - updated, results });
}
