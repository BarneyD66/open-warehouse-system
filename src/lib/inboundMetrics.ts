export type InboundMetricLine = {
  skuCode?: string;
  expectedQty?: number;
  cartonCount?: number;
};

export type InboundMetrics = {
  skuCount: number;
  totalProductQty: number;
  cartons: number;
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizedSkuCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function calculateInboundMetrics(
  lines: InboundMetricLine[] | undefined,
  fallback?: Partial<InboundMetrics>,
): InboundMetrics {
  const validLines = Array.isArray(lines) ? lines.filter((line) => normalizedSkuCode(line.skuCode)) : [];
  if (validLines.length === 0) {
    return {
      skuCount: positiveInteger(fallback?.skuCount),
      totalProductQty: positiveInteger(fallback?.totalProductQty),
      cartons: positiveInteger(fallback?.cartons),
    };
  }

  const skuCodes = new Set<string>();
  let totalProductQty = 0;
  let cartons = 0;

  for (const line of validLines) {
    skuCodes.add(normalizedSkuCode(line.skuCode));
    totalProductQty += positiveInteger(line.expectedQty);
    cartons += positiveInteger(line.cartonCount);
  }

  return {
    skuCount: skuCodes.size,
    totalProductQty: totalProductQty || positiveInteger(fallback?.totalProductQty),
    cartons: cartons || positiveInteger(fallback?.cartons),
  };
}
