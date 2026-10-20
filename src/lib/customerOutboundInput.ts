export class CustomerOutboundEditError extends Error { constructor(message: string, public status = 409) { super(message); } }
export type OutboundLine = { skuCode: string; quantity: number };
export function splitOutboundLines(lines: OutboundLine[] = []) {
  return { products: lines.filter(line => line.skuCode.toUpperCase() !== "PACKAGING"), packaging: lines.filter(line => line.skuCode.toUpperCase() === "PACKAGING") };
}
export function parseCustomerOutboundLines(value: unknown): OutboundLine[] {
  const rows = typeof value === "string" ? value.split(/\r?\n/).filter(row => row.trim()).map(row => {
    const parts = row.split(/[,，\t|]/).map(part => part.trim());
    if (parts.length !== 2) throw new CustomerOutboundEditError("每行请填写 SKU,数量，错误行不会被忽略", 400);
    return { skuCode: parts[0], quantity: parts[1] };
  }) : value;
  if (!Array.isArray(rows) || !rows.length) throw new CustomerOutboundEditError("请填写商品 SKU 明细", 400);
  return rows.map(row => {
    const skuCode = typeof row?.skuCode === "string" ? row.skuCode.trim() : "";
    const quantity = Number(row?.quantity);
    if (!skuCode || !Number.isSafeInteger(quantity) || quantity <= 0) throw new CustomerOutboundEditError("SKU 和正整数数量均为必填", 400);
    return { skuCode, quantity };
  });
}
