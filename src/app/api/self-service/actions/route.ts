import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customerAuth";
import { buildCustomerSelfServiceCenterData, customerSelfServiceActionCsvRows } from "@/lib/customerSelfServiceCenter";
import { getDocumentsForCustomer } from "@/lib/documentStore";
import { getSubmissionsForCustomer } from "@/lib/localStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const session = await requireCustomerSession();
  const url = new URL(request.url);
  const [submissions, coreData, documents, expansionData] = await Promise.all([
    getSubmissionsForCustomer(session.customerCode),
    getWarehouseCoreDataForCustomer(session.customerCode),
    getDocumentsForCustomer(session.customerCode),
    getOpsExpansionData(),
  ]);
  const workOrders = expansionData.selfServiceWorkOrders.filter((item) => item.customerCode === session.customerCode);
  const data = buildCustomerSelfServiceCenterData({
    customerCode: session.customerCode,
    submissions,
    coreData,
    documents,
    workOrders,
  });

  if (url.searchParams.get("format") === "csv") {
    return csvResponse(`客户自助操作清单-${session.customerCode}.csv`, customerSelfServiceActionCsvRows(data));
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
