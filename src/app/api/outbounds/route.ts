import { NextResponse } from "next/server";
import { withApiErrorCapture } from "@/lib/apiErrorBoundary";
import { recordAuditLog } from "@/lib/auditLogStore";
import { parseCustomerSession } from "@/lib/customerAuth";
import { addDocument } from "@/lib/documentStore";
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

function hasUkPostcode(value: string) {
  return /\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.test(value);
}

function availableQuantityBySku(data: Awaited<ReturnType<typeof getWarehouseCoreDataForCustomer>>) {
  const result = new Map<string, number>();
  data.inventoryBalances.forEach((item) => result.set(item.skuCode.toUpperCase(), (result.get(item.skuCode.toUpperCase()) ?? 0) + Math.max(0, item.availableQty)));
  return result;
}

function stockShortages(availableBySku: Map<string, number>, skuLines: Array<{ skuCode: string; quantity: number }>) {
  const required = new Map<string, number>();
  skuLines.forEach((line) => required.set(line.skuCode.toUpperCase(), (required.get(line.skuCode.toUpperCase()) ?? 0) + line.quantity));
  return [...required.entries()].flatMap(([skuCode, quantity]) => {
    const available = availableBySku.get(skuCode) ?? 0;
    return quantity > available ? [`${skuCode} 需要 ${quantity} 件，可用 ${available} 件，缺少 ${quantity - available} 件`] : [];
  });
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
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, noarchive");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

function csvFileName(value: unknown) {
  const cleaned = clean(value).replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 100);
  if (!cleaned) return "客户订单上传.csv";
  return cleaned.toLowerCase().endsWith(".csv") ? cleaned : `${cleaned}.csv`;
}

async function archiveCustomerOrderCsv({
  customerCode,
  username,
  csv,
  fileName,
  refId,
  note,
}: {
  customerCode: string;
  username: string;
  csv: string;
  fileName: string;
  refId: string;
  note: string;
}) {
  const bytes = Buffer.from(csv, "utf8");
  const document = await addDocument({
    customerCode,
    refType: "outbound",
    refId,
    category: "other",
    originalName: fileName,
    mimeType: "text/csv; charset=utf-8",
    size: bytes.length,
    bytes,
    note,
    uploadedByRole: "customer",
    uploadedBy: username,
  });
  await recordAuditLog({
    action: "document_upload",
    actorRole: "customer",
    actorName: username,
    targetType: "document",
    targetId: document.id,
    customerCode,
    summary: "归档客户订单 CSV",
    note: `${fileName} / ${refId}`,
    after: { refType: "outbound", refId, size: bytes.length },
  });
  return document;
}

const outboundStatusLabel: Record<string, string> = {
  pending_review: "待审核",
  picking: "拣货中",
  label_pending: "待生成面单",
  packing_check: "打包复核",
  handover: "待交运",
  shipped: "已发货",
  blocked: "异常阻塞",
};

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
    if (!recipientName || !deliveryAddress) {
      const issue = `第 ${rowNumber} 行收件人或完整收件地址为空。`;
      errors.push(issue);
      previewRows.push({ row: rowNumber, orderNo, skuCode, quantity, channel, recipientName, deliveryAddress, requestedShipDate, note, status: "skipped", issue });
      return;
    }
    if (!hasUkPostcode(deliveryAddress)) {
      const issue = `第 ${rowNumber} 行收件地址缺少可识别的英国邮编。`;
      errors.push(issue);
      previewRows.push({ row: rowNumber, orderNo, skuCode, quantity, channel, recipientName, deliveryAddress, requestedShipDate, note, status: "skipped", issue });
      return;
    }

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

async function handleGet(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return privateJson({ error: "请先登录客户工作台" }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format");
  if (format === "template") {
    return csvResponse("出库订单导入模板.csv", [
      ["销售平台", "平台订单号", "SKU 编码", "数量", "物流渠道", "收件人", "收件地址", "要求发货日期", "备注"],
    ]);
  }
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  if (format === "csv") {
    return csvResponse("客户批量发货结果.csv", [
      ["出库单号", "物流渠道", "订单数", "状态", "收件人", "收件地址", "追踪号", "面单状态", "要求发货日", "创建时间", "更新时间", "SKU 明细", "备注"],
      ...data.outboundOrders.map((item) => [item.id, item.channel, item.orderCount, outboundStatusLabel[item.status] ?? item.status, item.recipientName ?? "", item.deliveryAddress ?? "", item.trackingNumber ?? "", item.labelStatus ?? "not_requested", item.requestedShipDate ?? "", item.createdAt, item.updatedAt ?? "", (item.skuLines ?? []).map((line) => `${line.skuCode} × ${line.quantity}`).join(" | "), item.note ?? ""]),
    ]);
  }
  return privateJson({ outboundOrders: data.outboundOrders });
}

async function handlePost(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = clean(body.mode);
  if (mode === "preview_import_csv" || mode === "save_import_draft" || mode === "import_csv") {
    const rawCsv = clean(body.csv);
    const originalFileName = csvFileName(body.fileName);
    const data = await getWarehouseCoreDataForCustomer(session.customerCode);
    const validSkuCodes = new Set(data.skus.map((item) => item.skuCode.toUpperCase()));
    const prepared = prepareCustomerOutboundImport(rawCsv, validSkuCodes);

    if (mode === "preview_import_csv") {
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

    if (mode === "save_import_draft") {
      const issues: ImportedOrderIssue[] = [
        ...prepared.errors.map((message) => ({ row: Number(message.match(/第\s+(\d+)\s+行/)?.[1] ?? 0), level: "error" as const, message })),
        ...prepared.warnings.map((message) => ({ row: Number(message.match(/第\s+(\d+)\s+行/)?.[1] ?? 0), level: "warning" as const, message })),
      ];
      const batch = await saveOrderImportDraft({
        source: "csv",
        fileName: originalFileName,
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
      let archiveWarning: string | undefined;
      try {
        await archiveCustomerOrderCsv({
          customerCode: session.customerCode,
          username: session.username,
          csv: rawCsv,
          fileName: originalFileName,
          refId: batch.id,
          note: "客户保存订单预检草稿时归档的原始 CSV。",
        });
      } catch (error) {
        archiveWarning = `预检草稿已保存，但原始文件归档失败：${error instanceof Error ? error.message : "未知错误"}`;
      }
      return NextResponse.json({ batch, archiveWarning });
    }

    const created = [];
    const errors = [...prepared.errors];
    const availableBySku = availableQuantityBySku(data);
    for (const group of prepared.groups.values()) {
      const shortages = stockShortages(availableBySku, group.skuLines);
      if (shortages.length) {
        errors.push(`订单 ${group.orderNo} 库存不足：${shortages.join("；")}`);
        continue;
      }
      const order = await createCustomerOutboundOrder({
        customerCode: session.customerCode,
        channel: group.channel,
        orderCount: 1,
        skuLines: group.skuLines,
        recipientName: group.recipientName,
        deliveryAddress: group.deliveryAddress,
        requestedShipDate: group.requestedShipDate,
        note: group.note,
        platform: group.platform,
        platformOrderNo: group.orderNo,
      });
      if (order) {
        created.push(order);
        group.skuLines.forEach((line) => availableBySku.set(line.skuCode.toUpperCase(), (availableBySku.get(line.skuCode.toUpperCase()) ?? 0) - line.quantity));
      }
      else errors.push(`订单 ${group.orderNo} 创建失败，请检查 SKU 明细。`);
    }

    let archiveWarning: string | undefined;
    try {
      await archiveCustomerOrderCsv({
        customerCode: session.customerCode,
        username: session.username,
        csv: rawCsv,
        fileName: originalFileName,
        refId: created[0]?.id ?? `ORDER-UPLOAD-${Date.now()}`,
        note: `客户确认提交订单文件，创建 ${created.length} 个出库订单。`,
      });
    } catch (error) {
      archiveWarning = `订单已提交，但原始文件归档失败：${error instanceof Error ? error.message : "未知错误"}`;
    }

    return NextResponse.json({ imported: created.length, skipped: prepared.skippedRows, errors: [...errors, ...prepared.warnings, ...(archiveWarning ? [archiveWarning] : [])], orders: created, archiveWarning });
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
  const recipientName = clean(body.recipientName);
  const deliveryAddress = clean(body.deliveryAddress);
  if (!recipientName || !deliveryAddress) return NextResponse.json({ error: "请填写收件人和完整收件地址" }, { status: 400 });
  if (!hasUkPostcode(deliveryAddress)) return NextResponse.json({ error: "收件地址缺少可识别的英国邮编，请检查后再提交" }, { status: 400 });
  const customerData = await getWarehouseCoreDataForCustomer(session.customerCode);
  const shortages = stockShortages(availableQuantityBySku(customerData), skuLines);
  if (shortages.length) return NextResponse.json({ error: `库存不足：${shortages.join("；")}` }, { status: 409 });

  const order = await createCustomerOutboundOrder({
    customerCode: session.customerCode,
    channel,
    orderCount,
    skuLines,
    recipientName,
    deliveryAddress,
    requestedShipDate: clean(body.requestedShipDate),
    note: clean(body.note),
  });

  if (!order) return NextResponse.json({ error: "SKU 明细无效，请先维护 SKU 档案" }, { status: 400 });
  return NextResponse.json({ order });
}

export async function GET(request: Request) {
  return withApiErrorCapture(request, "/api/outbounds", () => handleGet(request));
}

export async function POST(request: Request) {
  return withApiErrorCapture(request, "/api/outbounds", () => handlePost(request));
}
