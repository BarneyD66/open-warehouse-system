import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { createWarehouseSku, getWarehouseCoreDataForCustomer, importCustomerSkusCsv } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

function sessionFromRequest(request: Request) {
  return parseCustomerSession(request.headers.get("cookie")?.match(/(?:^|;\s*)uk-warehouse-session=([^;]+)/)?.[1]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
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

const skuStatusLabel: Record<string, string> = {
  active: "启用",
  paused: "暂停",
  archived: "已归档",
};

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const data = await getWarehouseCoreDataForCustomer(session.customerCode);
  const format = new URL(request.url).searchParams.get("format");

  if (format === "template") {
    return csvResponse("SKU批量导入模板.csv", [
      ["SKU 编码", "商品名称", "条码", "商品分类", "预警库存"],
      ["SKU-001", "蓝牙耳机黑色款", "5050000000011", "3C 配件", 20],
    ]);
  }

  if (format === "csv") {
    const balanceBySku = new Map(data.inventoryBalances.map((item) => [item.skuCode, item]));
    return csvResponse("SKU档案.csv", [
      ["SKU 编码", "商品名称", "条码", "商品分类", "状态", "可用库存", "销售占用", "冻结库存", "残次品库存", "预警库存", "库位编码"],
      ...data.skus.map((item) => {
        const balance = balanceBySku.get(item.skuCode);
        return [
          item.skuCode,
          item.productName,
          item.barcode ?? "",
          item.category ?? "",
          skuStatusLabel[item.status] ?? item.status,
          balance?.availableQty ?? 0,
          balance?.reservedQty ?? 0,
          balance?.frozenQty ?? 0,
          balance?.defectiveQty ?? 0,
          balance?.alertQty ?? 0,
          balance?.locationCode ?? "",
        ];
      }),
    ]);
  }

  return NextResponse.json({ skus: data.skus, inventoryBalances: data.inventoryBalances });
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "请先登录客户工作台" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.mode === "import_csv") {
    const result = await importCustomerSkusCsv(session.customerCode, clean(body.csv));
    return NextResponse.json(result);
  }

  const skuCode = clean(body.skuCode).toUpperCase();
  const productName = clean(body.productName);
  if (!skuCode || !productName) return NextResponse.json({ error: "SKU 编码和商品名称必填" }, { status: 400 });

  try {
    const sku = await createWarehouseSku({
      customerCode: session.customerCode,
      skuCode,
      productName,
      barcode: clean(body.barcode),
      category: clean(body.category),
      alertQty: positiveInt(body.alertQty),
    });
    if (!sku) return NextResponse.json({ error: "SKU 信息不完整" }, { status: 400 });
    return NextResponse.json({ sku });
  } catch (error) {
    if (error instanceof Error && error.message === "SKU_ALREADY_EXISTS") {
      return NextResponse.json({ error: "该 SKU 已存在" }, { status: 409 });
    }
    throw error;
  }
}
