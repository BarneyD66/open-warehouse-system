import type { InboundSkuLine } from "./localStore";
import { calculateInboundMetrics } from "./inboundMetrics";

export type CustomerInboundInput = {
  customer: string;
  contact: string;
  phone: string;
  platform: string;
  eta: string;
  transport: string;
  tracking: string;
  cartons: number;
  skuCount: number;
  totalProductQty: number;
  skuLines: InboundSkuLine[];
  productName: string;
  service: string;
  attribute: string;
  attachmentNames: string[];
  supplementNote: string;
};

type ParseResult =
  | { input: CustomerInboundInput; error?: never }
  | { input?: never; error: string };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function positiveCartonCount(value: string) {
  const withUnit = value.match(/^(\d+)\s*(?:箱|托盘|托)$/);
  return positiveInt(withUnit ? withUnit[1] : value);
}

export function parseInboundSkuLines(value: unknown) {
  const raw = clean(value);
  if (!raw) return { lines: [], invalidLineNumbers: [], duplicateSkuCodes: [] };
  const invalidLineNumbers: number[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [skuCode = "", productName = "", qty = "", cartons = ""] = line.split(/[,，\t|]/).map((part) => part.trim());
      const expectedQty = positiveInt(qty);
      const cartonCount = positiveCartonCount(cartons);
      if (!skuCode || !productName || expectedQty <= 0 || cartonCount <= 0) invalidLineNumbers.push(index + 1);
      return {
        skuCode,
        productName,
        expectedQty: expectedQty || undefined,
        cartonCount: cartonCount || undefined,
      };
    })
    .filter((line) => line.skuCode);
  const seenSkuCodes = new Set<string>();
  const duplicateSkuCodes = Array.from(new Set(lines.flatMap((line) => {
    const normalized = line.skuCode.trim().toUpperCase();
    if (seenSkuCodes.has(normalized)) return [line.skuCode.trim()];
    seenSkuCodes.add(normalized);
    return [];
  })));
  return { lines, invalidLineNumbers, duplicateSkuCodes };
}

export function parseCustomerInboundInput(body: Record<string, unknown>, defaultContact = ""): ParseResult {
  const contact = clean(body.contact) || defaultContact;
  const phone = clean(body.phone);
  const eta = clean(body.eta);
  const transport = clean(body.transport);
  const productName = clean(body.productName);
  const parsedSkuLines = parseInboundSkuLines(body.skuLines);
  const metrics = calculateInboundMetrics(parsedSkuLines.lines);
  const attachmentNames = Array.isArray(body.attachmentNames)
    ? body.attachmentNames.map((name) => clean(name)).filter(Boolean)
    : [];

  if (!eta || !transport || !productName) {
    return { error: "缺少必填字段或数量不合法" };
  }
  if (parsedSkuLines.lines.length === 0) {
    return { error: "请填写 SKU 明细" };
  }
  if (parsedSkuLines.invalidLineNumbers.length > 0) {
    return {
      error: `SKU 明细第 ${parsedSkuLines.invalidLineNumbers.join("、")} 行格式不完整，请按“SKU编码, 商品名称, 商品数量, 箱数/托数”填写；箱数/托数可填 2、2箱或 2托`,
    };
  }
  if (parsedSkuLines.duplicateSkuCodes.length > 0) {
    return {
      error: `SKU 明细存在重复编码：${parsedSkuLines.duplicateSkuCodes.join("、")}，请合并为一行后再提交`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (eta < today) {
    return { error: "预计到仓日期不能早于今天" };
  }

  return {
    input: {
      customer: clean(body.customer),
      contact,
      phone,
      platform: clean(body.platform),
      eta,
      transport,
      tracking: clean(body.tracking),
      cartons: metrics.cartons,
      skuCount: metrics.skuCount,
      totalProductQty: metrics.totalProductQty,
      skuLines: parsedSkuLines.lines,
      productName,
      service: clean(body.service),
      attribute: clean(body.attribute),
      attachmentNames,
      supplementNote: clean(body.supplementNote),
    },
  };
}
