import type { OpsExpansionData, RolePermissionConfig } from "./opsExpansionStore";
import type { StaffRole, StaffSession } from "./staffAuth";

export type OpsPermissionModule = "overview" | "inquiry" | "inbound" | "inventory" | "outbound" | "logistics" | "billing" | "reports" | "permissions" | "warehouse";

const defaultModuleAccess: Record<StaffRole, OpsPermissionModule[]> = {
  admin: ["overview", "inquiry", "inbound", "inventory", "outbound", "logistics", "billing", "reports", "permissions", "warehouse"],
  ops: ["overview", "inquiry", "inbound", "inventory", "outbound", "logistics", "billing", "reports", "warehouse"],
  warehouse: ["overview", "inbound", "inventory", "outbound", "warehouse"],
  finance: ["overview", "billing", "reports"],
};

const moduleAliases: Record<string, OpsPermissionModule> = {
  总览: "overview",
  询盘: "inquiry",
  入库: "inbound",
  库存: "inventory",
  出库: "outbound",
  物流: "logistics",
  账单: "billing",
  报表: "reports",
  权限: "permissions",
  仓库: "warehouse",
  warehouse: "warehouse",
  overview: "overview",
  inquiry: "inquiry",
  inbound: "inbound",
  inventory: "inventory",
  outbound: "outbound",
  logistics: "logistics",
  billing: "billing",
  reports: "reports",
  permissions: "permissions",
};

function normalizeModule(value: string): OpsPermissionModule | null {
  return moduleAliases[value.trim()] ?? moduleAliases[value.trim().toLowerCase()] ?? null;
}

function configForRole(data: Pick<OpsExpansionData, "rolePermissions"> | undefined, role: StaffRole): RolePermissionConfig | undefined {
  return data?.rolePermissions?.find((item) => item.role === role);
}

export function staffAllowedModules(staff: StaffSession, data?: Pick<OpsExpansionData, "rolePermissions">): OpsPermissionModule[] {
  const configured = configForRole(data, staff.role);
  if (!configured || configured.allowedModules.length === 0) return defaultModuleAccess[staff.role];
  const normalized = configured.allowedModules.map(normalizeModule).filter((item): item is OpsPermissionModule => Boolean(item));
  return normalized.length > 0 ? Array.from(new Set(["overview", ...normalized])) : defaultModuleAccess[staff.role];
}

export function canAccessOpsModule(staff: StaffSession, module: OpsPermissionModule, data?: Pick<OpsExpansionData, "rolePermissions">) {
  return staffAllowedModules(staff, data).includes(module);
}

export function staffSensitiveActions(staff: StaffSession, data?: Pick<OpsExpansionData, "rolePermissions">): string[] {
  const configured = configForRole(data, staff.role);
  if (staff.role === "admin") return configured?.sensitiveActions ?? ["账单锁定", "库存调整审批", "客户暂停/解封", "权限配置"];
  if (configured?.sensitiveActions?.length) return configured.sensitiveActions;
  if (staff.role === "ops") return ["库存调整审批", "客户暂停/解封"];
  if (staff.role === "finance") return ["账单锁定"];
  return [];
}

export function canPerformSensitiveAction(staff: StaffSession, action: string, data?: Pick<OpsExpansionData, "rolePermissions">) {
  if (staff.role === "admin") return true;
  const actions = staffSensitiveActions(staff, data);
  return actions.includes(action);
}

export function requiresSecondConfirmation(staff: StaffSession, action: string, data?: Pick<OpsExpansionData, "rolePermissions">) {
  const configured = configForRole(data, staff.role);
  if (!configured?.requireSecondConfirm) return false;
  return canPerformSensitiveAction(staff, action, data);
}

export function secondConfirmationError({
  staff,
  action,
  confirmation,
  expected,
  data,
}: {
  staff: StaffSession;
  action: string;
  confirmation?: string;
  expected: string;
  data?: Pick<OpsExpansionData, "rolePermissions">;
}) {
  if (!requiresSecondConfirmation(staff, action, data)) return "";
  if (confirmation?.trim() === expected) return "";
  return `该敏感操作需要二次确认，请输入 ${expected}`;
}
