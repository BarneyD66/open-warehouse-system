import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/auditLogStore";
import { getOpsExpansionData, type SavedReportView } from "@/lib/opsExpansionStore";
import { requireStaffSession } from "@/lib/staffAuth";
import { canAccessOpsModule } from "@/lib/staffPermissions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function reportUrlForView(request: Request, view: SavedReportView) {
  const params = new URLSearchParams();
  Object.entries(view.filters ?? {}).forEach(([key, value]) => {
    const cleanKey = key.trim();
    const cleanValue = String(value ?? "").trim();
    if (cleanKey && cleanValue) params.set(cleanKey, cleanValue);
  });

  if (view.module === "warehouse") {
    if (!params.has("kind")) params.set("kind", "aging");
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/inventory?${params.toString()}`, request.url);
  }

  if (view.module === "billing_aging") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/billing-aging?${params.toString()}`, request.url);
  }

  if (view.module === "charge_events") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/charge-events?${params.toString()}`, request.url);
  }

  if (view.module === "automation_runs") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/automation-runs?${params.toString()}`, request.url);
  }

  if (view.module === "payment_review") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/payment-review?${params.toString()}`, request.url);
  }

  if (view.module === "payment_reconciliation") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/payment-reconciliation?${params.toString()}`, request.url);
  }

  if (view.module === "finance_adjustments") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/finance-adjustments?${params.toString()}`, request.url);
  }

  if (view.module === "returns") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/returns?${params.toString()}`, request.url);
  }

  if (view.module === "exceptions") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/exceptions?${params.toString()}`, request.url);
  }

  if (view.module === "scans") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/scans?${params.toString()}`, request.url);
  }

  if (view.module === "locations") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/locations?${params.toString()}`, request.url);
  }

  if (view.module === "inventory_lots") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/inventory-lots?${params.toString()}`, request.url);
  }

  if (view.module === "outbound_lot_allocation") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/outbound-lot-allocation?${params.toString()}`, request.url);
  }

  if (view.module === "data_quality") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/data-quality?${params.toString()}`, request.url);
  }

  if (view.module === "profit") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/profit?${params.toString()}`, request.url);
  }

  if (view.module === "staff_performance") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/staff-performance?${params.toString()}`, request.url);
  }

  if (view.module === "outbound_review") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/outbound-review?${params.toString()}`, request.url);
  }

  if (view.module === "pick_waves") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/pick-waves?${params.toString()}`, request.url);
  }

  if (view.module === "customer_credit") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/customer-credit?${params.toString()}`, request.url);
  }

  if (view.module === "carrier_labels") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/carrier-labels?${params.toString()}`, request.url);
  }

  if (view.module === "carrier_claims") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/carrier-claims?${params.toString()}`, request.url);
  }

  if (view.module === "platform_sync") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/platform-sync?${params.toString()}`, request.url);
  }

  if (view.module === "notification_deliveries") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/notification-deliveries?${params.toString()}`, request.url);
  }

  if (view.module === "customer_self_service") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/customer-self-service?${params.toString()}`, request.url);
  }

  if (view.module === "documents_security") {
    params.set("auditSource", "saved_view");
    return new URL(`/api/ops/reports/documents-security?${params.toString()}`, request.url);
  }

  const reportModule = view.module === "orders" ? "outbound" : view.module;
  params.set("module", reportModule);
  params.set("auditSource", "saved_view");
  return new URL(`/api/ops/reports/sla?${params.toString()}`, request.url);
}

export async function GET(request: Request, context: RouteContext) {
  const staff = await requireStaffSession();
  const expansionData = await getOpsExpansionData();
  if (!canAccessOpsModule(staff, "reports", expansionData)) return NextResponse.json({ error: "当前角色无权导出报表" }, { status: 403 });

  const { id } = await context.params;
  const view = expansionData.savedViews.find((item) => item.id === decodeURIComponent(id));
  if (!view) return NextResponse.json({ error: "未找到保存视图" }, { status: 404 });

  await recordAuditLog({
    action: "report_export",
    actorRole: "staff",
    actorName: staff.displayName || staff.username,
    targetType: "report",
    targetId: view.id,
    summary: `导出保存视图：${view.name}`,
    note: `报表模块：${view.module}`,
    after: {
      filters: view.filters,
      metrics: view.metrics,
      ownerRole: view.ownerRole,
    },
  });

  return NextResponse.redirect(reportUrlForView(request, view));
}
