import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customerAuth";
import { billingExportRows, filterBillingRecords } from "@/lib/billingUtils";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
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
  const session = await requireCustomerSession();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const status = searchParams.get("status");
  const coreData = await getWarehouseCoreDataForCustomer(session.customerCode);
  const records = filterBillingRecords(coreData.billingRecords, { month, status }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const suffix = month || "all";

  return csvResponse(`账单导出-${session.customerCode}-${suffix}.csv`, billingExportRows(records));
}
