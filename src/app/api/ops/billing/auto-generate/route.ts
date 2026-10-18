import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData } from "@/lib/opsExpansionStore";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimitStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { createOpsBillingRecordFromRule, getWarehouseCoreData, type BillingFeeCode, type BillingRecord } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type CoreData = Awaited<ReturnType<typeof getWarehouseCoreData>>;

function hasBilling(records: CoreData["billingRecords"], customerCode: string, refId: string, feeCode: string) {
  return records.some((record) => record.customerCode === customerCode && record.refId === refId && record.feeLines?.some((line) => line.feeCode === feeCode));
}

function remotePostcode(address?: string) {
  const prefix = address?.trim().match(/\b([A-Z]{1,2})\d/i)?.[1]?.toUpperCase();
  return Boolean(prefix && ["AB", "BT", "DD", "FK", "HS", "IV", "KA", "KW", "PA", "PH", "ZE", "IM", "GY", "JE"].includes(prefix));
}

function returnQuantity(order: CoreData["returnOrders"][number]) {
  return Math.max(1, order.skuLines.reduce((sum, line) => sum + line.quantity, 0));
}

async function createFee(input: {
  records: CoreData["billingRecords"];
  created: BillingRecord[];
  skipped: Array<{ refId: string; feeCode?: BillingFeeCode; reason?: string }>;
  customerCode: string;
  feeCode: BillingFeeCode;
  quantity: number;
  refId: string;
  note: string;
  reviewer: string;
}) {
  if (input.quantity <= 0) return;
  if (hasBilling(input.records, input.customerCode, input.refId, input.feeCode)) {
    input.skipped.push({ refId: input.refId, feeCode: input.feeCode, reason: "已存在同类计费记录，跳过重复生成" });
    return;
  }

  const result = await createOpsBillingRecordFromRule({
    customerCode: input.customerCode,
    feeCode: input.feeCode,
    quantity: input.quantity,
    refId: input.refId,
    note: input.note,
    reviewer: input.reviewer,
    status: "pending_confirmation",
  });

  if (result.record) input.created.push(result.record);
  else input.skipped.push({ refId: input.refId, feeCode: input.feeCode, reason: result.error ?? "生成失败" });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(rateLimitKey(request, "ops-billing-auto-generate"), 20, 10 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: "自动计费触发过于频繁，请稍后再试。" }, { status: 429 });

  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "billing", expansionData)) return NextResponse.json({ error: "当前角色无权生成费用账单。" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { customerCode?: string; month?: string };
  const coreData = await getWarehouseCoreData();
  const customerCode = body.customerCode?.trim();
  const month = body.month?.trim() || new Date().toISOString().slice(0, 7);
  const created: BillingRecord[] = [];
  const skipped: Array<{ refId: string; feeCode?: BillingFeeCode; reason?: string }> = [];
  const reviewer = staff.displayName || staff.username;

  const outbounds = coreData.outboundOrders.filter((order) => order.status === "shipped" && (!customerCode || order.customerCode === customerCode));
  for (const order of outbounds) {
    await createFee({
      records: coreData.billingRecords,
      created,
      skipped,
      customerCode: order.customerCode,
      feeCode: "outbound_order",
      quantity: Math.max(1, order.orderCount),
      refId: order.id,
      note: `自动生成 ${month} 出库基础处理费`,
      reviewer,
    });

    const itemQty = order.skuLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
    await createFee({
      records: coreData.billingRecords,
      created,
      skipped,
      customerCode: order.customerCode,
      feeCode: "outbound_item",
      quantity: itemQty,
      refId: order.id,
      note: `自动生成 ${month} 出库 SKU 件数费`,
      reviewer,
    });

    if (order.labelStatus === "generated") {
      await createFee({
        records: coreData.billingRecords,
        created,
        skipped,
        customerCode: order.customerCode,
        feeCode: "labeling_service",
        quantity: Math.max(1, order.packageCount ?? 1),
        refId: order.id,
        note: `自动生成 ${month} 面单/贴标处理费`,
        reviewer,
      });
    }

    const shippingAmount = order.actualShippingFee ?? order.shippingFee ?? 0;
    if (shippingAmount > 0) {
      await createFee({
        records: coreData.billingRecords,
        created,
        skipped,
        customerCode: order.customerCode,
        feeCode: "fuel_surcharge",
        quantity: shippingAmount,
        refId: order.id,
        note: `自动生成 ${month} 燃油附加费，计费基数 GBP ${shippingAmount.toFixed(2)}`,
        reviewer,
      });
    }

    if (remotePostcode(order.deliveryAddress)) {
      await createFee({
        records: coreData.billingRecords,
        created,
        skipped,
        customerCode: order.customerCode,
        feeCode: "remote_area_surcharge",
        quantity: 1,
        refId: order.id,
        note: `自动生成 ${month} 偏远地区附加费：${order.deliveryAddress ?? ""}`,
        reviewer,
      });
    }

    if ((order.packageWeightKg ?? 0) > 10 || (order.packageCount ?? 1) > 1) {
      await createFee({
        records: coreData.billingRecords,
        created,
        skipped,
        customerCode: order.customerCode,
        feeCode: "oversize_surcharge",
        quantity: Math.max(1, order.packageCount ?? 1),
        refId: order.id,
        note: `自动生成 ${month} 超尺寸/多包裹附加费`,
        reviewer,
      });
    }
  }

  const returns = coreData.returnOrders.filter(
    (order) => ["received", "inspection", "restocked", "repair", "disposed", "closed", "exception"].includes(order.status) && (!customerCode || order.customerCode === customerCode),
  );
  for (const order of returns) {
    const qty = returnQuantity(order);
    await createFee({
      records: coreData.billingRecords,
      created,
      skipped,
      customerCode: order.customerCode,
      feeCode: "return_inspection",
      quantity: qty,
      refId: order.id,
      note: `自动生成 ${month} 退货质检费`,
      reviewer,
    });

    if (order.status === "restocked" || order.resolution === "restock") {
      await createFee({
        records: coreData.billingRecords,
        created,
        skipped,
        customerCode: order.customerCode,
        feeCode: "return_restock",
        quantity: qty,
        refId: order.id,
        note: `自动生成 ${month} 退货重新上架费`,
        reviewer,
      });
    }

    if (order.status === "disposed" || order.resolution === "dispose") {
      await createFee({
        records: coreData.billingRecords,
        created,
        skipped,
        customerCode: order.customerCode,
        feeCode: "return_disposal",
        quantity: qty,
        refId: order.id,
        note: `自动生成 ${month} 退货销毁处理费`,
        reviewer,
      });
    }
  }

  const balances = coreData.inventoryBalances.filter((item) => item.availableQty > 0 && (!customerCode || item.customerCode === customerCode));
  for (const balance of balances) {
    const refId = `storage-${month}-${balance.id}`;
    const quantity = Math.max(1, Math.round((balance.availableQty * Math.max(1, balance.agingDays || 1)) / 30));
    await createFee({
      records: coreData.billingRecords,
      created,
      skipped,
      customerCode: balance.customerCode,
      feeCode: "storage_daily",
      quantity,
      refId,
      note: `自动生成 ${month} 仓租：${balance.skuCode} / 可用 ${balance.availableQty} / 库龄 ${balance.agingDays || 1} 天`,
      reviewer,
    });
  }

  await recordAuditLog({
    action: "billing_auto_generate",
    actorRole: "staff",
    actorName: reviewer,
    targetType: "billing",
    targetId: customerCode ? `auto-generate-${customerCode}-${month}` : `auto-generate-all-${month}`,
    customerCode,
    summary: `自动生成 ${month} 费用账单`,
    note: `新增 ${created.length} 条，跳过 ${skipped.length} 条`,
    after: {
      month,
      customerCode: customerCode ?? "all",
      createdCount: created.length,
      skippedCount: skipped.length,
      createdIds: created.map((record) => record.id),
    },
  });

  return NextResponse.json({ createdCount: created.length, skippedCount: skipped.length, created, skipped });
}
