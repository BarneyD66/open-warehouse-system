import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { saveOrderImportDraft, type ImportedOrderIssue } from "@/lib/opsExpansionStore";
import { createCustomerOutboundOrder, getWarehouseCoreDataForCustomer } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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

function parseSkuLines(value: unknown) {
  const raw = clean(value);
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [skuCode = "", quantity = ""] = line.split(/[,，\t|]/).map((part) => part.trim());
      return { skuCode, quantity: positiveInt(quantity) };
    })
    .filter((line) => line.skuCode && line.quantity > 0);
}

function rowValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const found = Object.entries(row).find(([header]) => header.trim().toLowerCase() === key.trim().toLowerCase());
    if (found) return found[1];
  }
  return "";
}

type CustomerOutboundImportGroup = {
  platform: string;
  orderNo: string;
  channel: string;
  recipientName: string;
  deliveryAddress: string;
  requestedShipDate: string;
  note: string;
  skuLines: Array<{ skuCode: string; quantity: number }>;
  rowNumbers: number[];
};

function prepareCustomerOutboundImport(csv: string, validSkuCodes: Set<string>) {
  const rows = parseCsv(csv);
  const groups = new Map<string, CustomerOutboundImportGroup>();
  const errors: string[] = [];
  const warnings: string[] = [];
  const previewRows: Array<{
    row: number;
    orderNo: string;
    skuCode: string;
    quantity: number;
    channel: string;
    recipientName?: string;
    deliveryAddress?: string;
    requestedShipDate?: string;
    note?: string;
    status: "ready" | "skipped";
    issue?: string;
  }> = [];
  let validLineCount = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const skuCode = clean(rowValue(row, ["SKU 编码", "商品编码", "skuCode", "sku", "SKU"])).toUpperCase();
    const quantity = positiveInt(rowValue(row, ["数量", "quantity", "qty"]));
    const orderNo = clean(rowValue(row, ["平台订单号", "订单号", "orderNo", "orderNumber"])) || `ROW-${rowNumber}`;
    const channel = clean(rowValue(row, ["物流渠道", "渠道", "channel"])) || "Royal Mail 48";
    const recipientName = clean(rowValue(row, ["收件人", "收货人", "recipientName"]));
    const deliveryAddress = clean(rowValue(row, ["收件地址", "收货地址", "deliveryAddress", "address"]));
    const requestedShipDate = clean(rowValue(row, ["要求发货日期", "发货日期", "requestedShipDate", "shipDate"]));
    const note = clean(rowValue(row, ["备注", "note"]));

    if (!skuCode || !validSkuCodes.has(skuCode)) {
      const issue = `第 ${rowNumber} 行 SKU 不存在或为空。`;
      errors.push(issue);
      previewRows.push({ row: rowNumber, orderNo, skuCode, quantity, channel, recipientName, deliveryAddress, requestedShipDate, note, status: "skipped", issue });
      return;
    }
    if (quantity <= 0) {
      const issue = `第 ${rowNumber} 行数量无效。`;
      errors.push(issue);
      previewRows.push({ row: rowNumber, orderNo, skuCode, quantity, channel, recipientName, deliveryAddress, requestedShipDate, note, status: "skipped", issue });
      return;
    }
    if (!recipientName || !deliveryAddress) warnings.push(`第 ${rowNumber} 行收件人或地址为空，提交后运营会复核。`);

    const key = `${orderNo}::${channel}::${recipientName}::${deliveryAddress}`;
    const existingOrderGroup = [...groups.values()].find((item) => item.orderNo === orderNo && `${item.orderNo}::${item.channel}::${item.recipientName}::${item.deliveryAddress}` !== key);
    if (existingOrderGroup) warnings.push(`第 ${rowNumber} 行同一订单号出现不同收件人、地址或物流渠道，请确认是否需要拆单。`);

    const current =
      groups.get(key) ??
      {
        platform: clean(rowValue(row, ["销售平台", "平台", "platform"])),
        orderNo,
        channel,
        recipientName,
        deliveryAddress,
        requestedShipDate,
        note,
        skuLines: [],
        rowNumbers: [],
      };
    const existingLine = current.skuLines.find((line) => line.skuCode === skuCode);
    if (existingLine) {
      existingLine.quantity += quantity;
      warnings.push(`第 ${rowNumber} 行同一订单内重复 SKU 已自动合并数量。`);
    } else {
      current.skuLines.push({ skuCode, quantity });
    }
    current.rowNumbers.push(rowNumber);
    validLineCount += 1;
    previewRows.push({ row: rowNumber, orderNo, skuCode, quantity, channel, recipientName, deliveryAddress, requestedShipDate, note, status: "ready" });
    groups.set(key, current);
  });

  return {
    rows,
    groups,
    errors,
    warnings,
    previewRows,
    totalRows: rows.length,
    readyRows: validLineCount,
    readyOrders: groups.size,
    skippedRows: rows.length - validLineCount,
  };
}

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  const format = new URL(request.url).searchParams.get("format");
  if (format === "template") {
    return csvResponse("出库订单导入模板.csv", [
      ["销售平台", "平台订单号", "SKU 编码", "数量", "物流渠道", "收件人", "收件地址", "要求发货日期", "备注"],
      ["Shopify", "ORDER-001", "SKU-001", 1, "Royal Mail 48", "张三", "10 Example Street, London, UK", "2026-05-26", "请按默认包材发货"],
    ]);
  }
  if (format === "csv") {
    return csvResponse("客户出库订单.csv", [
      ["出库单号", "物流渠道", "订单数", "状态", "收件人", "追踪号", "创建时间", "SKU 明细", "备注"],
      ...data.outboundOrders.map((item) => [item.id, item.channel, item.orderCount, item.status, item.recipientName ?? "", item.trackingNumber ?? "", item.createdAt, (item.skuLines ?? []).map((line) => `${line.skuCode} x ${line.quantity}`).join(" | "), item.note ?? ""]),
    ]);
  }
  return NextResponse.json({ outboundOrders: data.outboundOrders });
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.mode === "preview_import_csv" || body.mode === "save_import_draft" || body.mode === "import_csv") {
    const data = await getWarehouseCoreDataForCustomer(session.customerCode);
    const validSkuCodes = new Set(data.skus.map((item) => item.skuCode.toUpperCase()));
    const prepared = prepareCustomerOutboundImport(clean(body.csv), validSkuCodes);

    if (body.mode === "preview_import_csv") {
      return NextResponse.json({
        preview: {
          totalRows: prepared.totalRows,
          readyRows: prepared.readyRows,
          readyOrders: prepared.readyOrders,
          skippedRows: prepared.skippedRows,
          errors: prepared.errors,
          warnings: prepared.warnings,
          rows: prepared.previewRows,
        },
      });
    }

    if (body.mode === "save_import_draft") {
      const issues: ImportedOrderIssue[] = [
        ...prepared.errors.map((message) => ({ row: Number(message.match(/第\s+(\d+)\s+行/)?.[1] ?? 0), level: "error" as const, message })),
        ...prepared.warnings.map((message) => ({ row: Number(message.match(/第\s+(\d+)\s+行/)?.[1] ?? 0), level: "warning" as const, message })),
      ];
      const batch = await saveOrderImportDraft({
        source: "csv",
        fileName: clean(body.fileName) || "客户出库订单预检草稿.csv",
        operator: `${session.customerCode} / ${session.username}`,
        preview: {
          totalRows: prepared.totalRows,
          readyRows: prepared.readyRows,
          readyOrders: prepared.readyOrders,
          skippedRows: prepared.skippedRows,
          issues,
          rows: prepared.previewRows.map((row) => ({
            row: row.row,
            platform: "客户上传",
            orderNo: row.orderNo,
            customerCode: session.customerCode,
            skuCode: row.skuCode,
            quantity: row.quantity,
            channel: row.channel,
            recipientName: row.recipientName,
            deliveryAddress: row.deliveryAddress,
            requestedShipDate: row.requestedShipDate,
            note: row.note,
            status: row.status,
            issue: row.issue,
          })),
        },
      });
      return NextResponse.json({ batch });
    }

    const created = [];
    const errors = [...prepared.errors];
    for (const group of prepared.groups.values()) {
      const order = await createCustomerOutboundOrder({
        customerCode: session.customerCode,
        channel: group.channel,
        orderCount: 1,
        skuLines: group.skuLines,
        recipientName: group.recipientName,
        deliveryAddress: group.deliveryAddress,
        requestedShipDate: group.requestedShipDate,
        note: [group.platform, group.orderNo, group.note].filter(Boolean).join(" / "),
      });
      if (order) created.push(order);
      else errors.push(`订单 ${group.orderNo} 创建失败，请检查 SKU 明细。`);
    }

    return NextResponse.json({ imported: created.length, skipped: prepared.skippedRows, errors: [...errors, ...prepared.warnings], orders: created });
  }

  const channel = clean(body.channel);
  const orderCount = positiveInt(body.orderCount);
  const skuLines = Array.isArray(body.skuLines)
    ? body.skuLines
        .map((item) => (typeof item === "object" && item ? item : {}) as Record<string, unknown>)
        .map((item) => ({ skuCode: clean(item.skuCode), quantity: positiveInt(item.quantity) }))
        .filter((item) => item.skuCode && item.quantity > 0)
    : parseSkuLines(body.skuLines);

  if (!channel || orderCount <= 0 || skuLines.length === 0) {
    return NextResponse.json({ error: "请填写渠道、订单数和出库 SKU 明细" }, { status: 400 });
  }

  const order = await createCustomerOutboundOrder({
    customerCode: session.customerCode,
    channel,
    orderCount,
    skuLines,
    recipientName: clean(body.recipientName),
    deliveryAddress: clean(body.deliveryAddress),
    requestedShipDate: clean(body.requestedShipDate),
    note: clean(body.note),
  });

  if (!order) return NextResponse.json({ error: "SKU 明细无效，请先维护 SKU 档案" }, { status: 400 });
  return NextResponse.json({ order });
}
