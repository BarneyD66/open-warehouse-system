import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { documentScanStatusLabel, documentStorageProviderLabel, getDocuments, type DocumentRecord } from "@/lib/documentStore";
import { getOpsExpansionData, type BillingRuleConfig, type LogisticsChannelConfig } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";
import { getWarehouseCoreData, type CoreOutboundOrder, type InventoryBalance, type WarehouseLocation } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";

type DataQualitySeverity = "严重" | "关注";

type DataQualityRow = {
  module: "客户资料" | "SKU 档案" | "库存库位" | "出库订单" | "退货/RMA" | "物流渠道" | "费用规则" | "账单" | "资料文件";
  severity: DataQualitySeverity;
  sourceId: string;
  customerCode?: string;
  issue: string;
  suggestion: string;
  owner: "产品" | "运营" | "仓库" | "财务";
  updatedAt?: string;
};

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

function balanceTotal(item: InventoryBalance) {
  return item.availableQty + item.reservedQty + item.frozenQty + item.defectiveQty + item.inboundQty;
}

function locationIssues(location: WarehouseLocation) {
  return [
    location.status !== "active" ? `库位状态为${location.status === "blocked" ? "停用" : "预留"}` : "",
    typeof location.capacityQty !== "number" || location.capacityQty <= 0 ? "未设置件数容量" : "",
    location.allowMixedSku === undefined ? "未确认是否允许混放 SKU" : "",
  ].filter(Boolean);
}

function logisticsIssues(channel: LogisticsChannelConfig) {
  const features = channel.enabledFeatures.join(" ");
  return [
    channel.status !== "active" ? `渠道状态为${channel.status === "sandbox" ? "沙箱" : channel.status === "paused" ? "暂停" : "草稿"}` : "",
    channel.apiMode !== "manual" && !channel.credentialRef ? "缺少承运商凭证引用" : "",
    channel.apiMode === "live" && !channel.trackingWebhook ? "正式接口缺少轨迹回传地址" : "",
    channel.apiMode !== "manual" && !features.includes("面单购买") ? "缺少面单购买能力" : "",
    channel.apiMode !== "manual" && !features.includes("轨迹自动回传") ? "缺少轨迹自动回传" : "",
    !features.includes("派送失败处理") ? "缺少派送失败处理" : "",
    !features.includes("签收证明") ? "缺少签收证明" : "",
    !features.includes("物流赔付") ? "缺少物流赔付" : "",
    channel.surchargeRules.length === 0 ? "未配置附加费规则" : "",
  ].filter(Boolean);
}

function billingRuleIssue(rule: BillingRuleConfig) {
  if (rule.status !== "active") return `费用规则状态为${rule.status === "paused" ? "暂停" : "草稿"}`;
  if (rule.unitPrice <= 0) return "单价未配置或为 0";
  return "";
}

function outboundIssue(order: CoreOutboundOrder) {
  const issues = [
    !order.recipientName ? "缺少收件人" : "",
    !order.deliveryAddress ? "缺少收件地址" : "",
    order.status === "shipped" && !order.trackingNumber ? "已发货但缺少追踪号" : "",
    !order.skuLines?.length ? "缺少 SKU 明细" : "",
  ].filter(Boolean);
  return issues.join("；");
}

function documentRows(documents: DocumentRecord[]): DataQualityRow[] {
  return documents
    .filter((item) => item.scanStatus === "blocked" || item.scanStatus === "pending" || !item.scanStatus || item.storageProvider === "local")
    .map((item) => {
      const issues = [
        item.scanStatus === "blocked" ? "文件已被安全扫描拦截" : "",
        item.scanStatus === "pending" || !item.scanStatus ? "文件仍待扫描确认" : "",
        item.storageProvider === "local" ? "文件仍在本地存储，生产存在丢失风险" : "",
      ].filter(Boolean);
      return {
        module: "资料文件" as const,
        severity: item.scanStatus === "blocked" || item.storageProvider === "local" ? "严重" as const : "关注" as const,
        sourceId: item.id,
        customerCode: item.customerCode,
        issue: `${item.originalName}：${issues.join("；")}；扫描状态 ${documentScanStatusLabel(item.scanStatus)}；存储方式 ${documentStorageProviderLabel(item.storageProvider)}`,
        suggestion: item.scanStatus === "blocked" ? "请客户或运营重新上传安全文件，并保留拦截原因。" : "请确认病毒扫描/对象存储配置，必要时重新上传或迁移文件。",
        owner: "运营" as const,
        updatedAt: item.uploadedAt,
      };
    });
}

function buildRows(coreData: Awaited<ReturnType<typeof getWarehouseCoreData>>, expansionData: Awaited<ReturnType<typeof getOpsExpansionData>>, documents: DocumentRecord[]): DataQualityRow[] {
  const rows: DataQualityRow[] = [];
  rows.push(...documentRows(documents));

  coreData.customers.forEach((customer) => {
    const issues = [
      !customer.companyName ? "缺少公司名称" : "",
      !customer.contactName ? "缺少联系人" : "",
      !customer.phone ? "缺少联系电话" : "",
      !customer.email ? "缺少邮箱" : "",
      !customer.vatNumber ? "缺少 VAT" : "",
      !customer.eoriNumber ? "缺少 EORI" : "",
      customer.status !== "verified" ? `账号状态为${customer.status === "paused" ? "暂停" : "未认证"}` : "",
    ].filter(Boolean);
    if (issues.length) {
      rows.push({
        module: "客户资料",
        severity: issues.some((issue) => issue.includes("公司") || issue.includes("联系人") || issue.includes("联系电话")) ? "严重" : "关注",
        sourceId: customer.customerCode,
        customerCode: customer.customerCode,
        issue: issues.join("；"),
        suggestion: "请客户在账号资料页补齐公司、VAT、EORI、平台店铺和联系人信息，运营复核后再标记已认证。",
        owner: "运营",
        updatedAt: customer.updatedAt,
      });
    }
  });

  coreData.skus.forEach((sku) => {
    const issues = [!sku.productName ? "缺少商品名称" : "", !sku.barcode ? "缺少条码" : "", !sku.category ? "缺少分类" : "", sku.status !== "active" ? "SKU 未启用" : ""].filter(Boolean);
    if (issues.length) {
      rows.push({
        module: "SKU 档案",
        severity: !sku.barcode ? "严重" : "关注",
        sourceId: sku.skuCode,
        customerCode: sku.customerCode,
        issue: issues.join("；"),
        suggestion: "请客户或运营补齐商品名称、条码、分类和状态，避免扫码、拣货和导入订单时无法匹配。",
        owner: "运营",
      });
    }
  });

  coreData.inventoryBalances.filter((item) => balanceTotal(item) > 0 && !item.locationCode).forEach((item) => {
    rows.push({
      module: "库存库位",
      severity: "严重",
      sourceId: item.skuCode,
      customerCode: item.customerCode,
      issue: "库存有数量但未分配库位",
      suggestion: "请通过移库或上架流程补齐库位，后续拣货和盘点才能准确执行。",
      owner: "仓库",
      updatedAt: item.updatedAt,
    });
  });

  coreData.locations.forEach((location) => {
    const issues = locationIssues(location);
    if (issues.length) {
      rows.push({
        module: "库存库位",
        severity: issues.some((issue) => issue.includes("容量")) ? "严重" : "关注",
        sourceId: location.locationCode,
        issue: issues.join("；"),
        suggestion: "请在库位管理中补齐容量、混放规则并确认库位状态。",
        owner: "仓库",
        updatedAt: location.updatedAt,
      });
    }
  });

  coreData.outboundOrders.forEach((order) => {
    const issue = outboundIssue(order);
    if (issue) {
      rows.push({
        module: "出库订单",
        severity: issue.includes("地址") || issue.includes("SKU") ? "严重" : "关注",
        sourceId: order.id,
        customerCode: order.customerCode,
        issue,
        suggestion: "请客户补齐收件信息或由运营复核订单，发货后必须保留追踪号。",
        owner: "运营",
        updatedAt: order.updatedAt ?? order.createdAt,
      });
    }
  });

  coreData.returnOrders.filter((item) => !["received", "inspection", "repair", "restocked", "disposed", "closed"].includes(item.status) && !item.buyerReturnTracking).forEach((item) => {
    rows.push({
      module: "退货/RMA",
      severity: "关注",
      sourceId: item.id,
      customerCode: item.customerCode,
      issue: "开放退货单缺少买家退货追踪号",
      suggestion: "请客户补充买家退货追踪号，仓库到货后才能快速匹配 RMA。",
      owner: "运营",
      updatedAt: item.updatedAt ?? item.createdAt,
    });
  });

  expansionData.logisticsChannels.forEach((channel) => {
    const issues = logisticsIssues(channel);
    if (issues.length) {
      rows.push({
        module: "物流渠道",
        severity: issues.some((issue) => issue.includes("面单") || issue.includes("轨迹")) ? "严重" : "关注",
        sourceId: channel.id,
        issue: `${channel.carrierName} / ${channel.serviceName}：${issues.join("；")}`,
        suggestion: "请补齐承运商 API 模式、webhook、面单购买、轨迹回传、签收证明、赔付和附加费规则。",
        owner: "运营",
        updatedAt: channel.updatedAt,
      });
    }
  });

  if (expansionData.logisticsChannels.length === 0) {
    rows.push({
      module: "物流渠道",
      severity: "严重",
      sourceId: "logistics-channels",
      issue: "尚未配置物流渠道",
      suggestion: "上线发货前至少配置一个可用承运商服务。",
      owner: "运营",
    });
  }

  expansionData.billingRules.forEach((rule) => {
    const issue = billingRuleIssue(rule);
    if (issue) {
      rows.push({
        module: "费用规则",
        severity: issue.includes("单价") ? "严重" : "关注",
        sourceId: rule.id,
        issue: `${rule.feeName}：${issue}`,
        suggestion: "请财务确认费用规则状态、单价、结算周期和客户范围。",
        owner: "财务",
        updatedAt: rule.updatedAt,
      });
    }
  });

  if (expansionData.billingRules.length === 0) {
    rows.push({
      module: "费用规则",
      severity: "严重",
      sourceId: "billing-rules",
      issue: "尚未配置运营费用规则",
      suggestion: "上线前至少配置仓租、出库操作、贴标、退货质检和物流附加费。",
      owner: "财务",
    });
  }

  coreData.billingRecords.filter((record) => record.status === "disputed" || (record.status !== "paid" && record.dueDate && new Date(record.dueDate).getTime() < Date.now())).forEach((record) => {
    rows.push({
      module: "账单",
      severity: record.status === "disputed" ? "严重" : "关注",
      sourceId: record.id,
      customerCode: record.customerCode,
      issue: record.status === "disputed" ? "账单争议未处理" : "账单已逾期未支付",
      suggestion: "请财务跟进客户确认、付款核销或争议处理。",
      owner: "财务",
      updatedAt: record.updatedAt ?? record.createdAt,
    });
  });

  return rows;
}

function applyFilters(rows: DataQualityRow[], url: URL) {
  const moduleFilter = url.searchParams.get("module")?.trim();
  const severity = url.searchParams.get("severity")?.trim();
  const customerCode = url.searchParams.get("customerCode")?.trim().toUpperCase();
  const keyword = url.searchParams.get("keyword")?.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.module, row.severity, row.sourceId, row.customerCode, row.issue, row.suggestion, row.owner].join(" ").toLowerCase();
    return (
      (!moduleFilter || moduleFilter === "all" || row.module === moduleFilter) &&
      (!severity || severity === "all" || row.severity === severity) &&
      (!customerCode || row.customerCode?.toUpperCase() === customerCode) &&
      (!keyword || haystack.includes(keyword))
    );
  });
}

export async function GET(request: Request) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出数据质量巡检" }, { status: 403 });

  const url = new URL(request.url);
  const [coreData, documents] = await Promise.all([getWarehouseCoreData(), getDocuments()]);
  const rows = applyFilters(buildRows(coreData, expansionData, documents), url).sort((a, b) => (a.severity === b.severity ? a.module.localeCompare(b.module) : a.severity === "严重" ? -1 : 1));

  if (url.searchParams.get("auditSource") !== "saved_view") {
    await recordAuditLog({
      action: "report_export",
      actorRole: "staff",
      actorName: staff.displayName || staff.username,
      targetType: "report",
      targetId: "data-quality",
      summary: "导出数据质量巡检报表",
      note: "覆盖客户资料、SKU、库存库位、出库、退货、物流渠道、费用规则、账单和资料文件",
      after: {
        module: url.searchParams.get("module") ?? "all",
        severity: url.searchParams.get("severity") ?? "all",
        customerCode: url.searchParams.get("customerCode") ?? "",
        keyword: url.searchParams.get("keyword") ?? "",
        rowCount: rows.length,
      },
    });
  }

  return csvResponse("数据质量巡检报表.csv", [
    ["模块", "严重程度", "关联编号", "客户编号", "问题", "处理建议", "负责人", "更新时间"],
    ...rows.map((row) => [row.module, row.severity, row.sourceId, row.customerCode ?? "", row.issue, row.suggestion, row.owner, row.updatedAt ?? ""]),
  ]);
}
