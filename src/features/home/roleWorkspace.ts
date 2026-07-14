import {
  getDefaultPermissionsForRole,
  type ScreenId,
  type ScreenPermission,
  type UserPermission,
} from "@/lib/permissions";
import { normalizeShellRole } from "@/components/shell/shellNavVisibility";
import type { HomeWorkspaceId } from "./types";

export function resolveWorkspaceIds(roleRaw: string | undefined | null): HomeWorkspaceId[] {
  const shell = normalizeShellRole(roleRaw);
  switch (shell) {
    case "owner":
    case "manager":
      return ["owner"];
    case "accountant":
      return ["accountant"];
    case "cashier":
      return ["cashier"];
    case "banking":
      return ["banking"];
    case "inventory":
      return ["inventory"];
    case "auditor":
      return ["auditor"];
    case "admin":
      return ["administrator"];
    case "viewer":
      return ["restricted"];
    default:
      return ["restricted"];
  }
}

/** Combined-role: when user role string contains multiple hints (rare), merge without dup. */
export function resolveWorkspaces(roleRaw: string | undefined | null): {
  primary: HomeWorkspaceId;
  all: HomeWorkspaceId[];
  label: string;
} {
  const raw = String(roleRaw || "viewer").toLowerCase().trim();
  const found = new Set<HomeWorkspaceId>();

  if (/\b(owner|manager|business_owner|business-owner)\b/.test(raw) || raw === "business") {
    found.add("owner");
  }
  // Prefer admin before accountant — "administrator" contains the substring "account"
  if (/\b(admin|administrator|super_admin|superuser)\b/.test(raw)) {
    found.add("administrator");
  } else if (/\b(accountant|accounts)\b/.test(raw)) {
    found.add("accountant");
  }
  if (/\b(cashier|clerk)\b/.test(raw)) found.add("cashier");
  if (/\b(banking|banking_user|bank)\b/.test(raw)) found.add("banking");
  if (/\b(inventory|inventory_user|stock)\b/.test(raw)) found.add("inventory");
  if (/\b(auditor|audit)\b/.test(raw)) found.add("auditor");
  if (/\b(viewer|readonly|read-only|restricted)\b/.test(raw)) found.add("restricted");

  if (found.size === 0) {
    for (const id of resolveWorkspaceIds(roleRaw)) found.add(id);
  }
  const all = Array.from(found);
  if (all.length > 1) {
    return {
      primary: "combined",
      all,
      label: "Combined workspace",
    };
  }
  const primary = all[0] ?? "restricted";
  const labels: Record<HomeWorkspaceId, string> = {
    owner: "Business overview",
    accountant: "Accounting workspace",
    cashier: "Cashier workspace",
    banking: "Banking workspace",
    inventory: "Inventory workspace",
    auditor: "Audit workspace",
    administrator: "Administration workspace",
    restricted: "Limited workspace",
    combined: "Combined workspace",
  };
  return { primary, all, label: labels[primary] };
}

export function resolvePermissionProfile(
  userId: string | undefined,
  role: string | undefined,
  stored: UserPermission | null,
): UserPermission {
  if (stored?.screenPermissions) return stored;
  return getDefaultPermissionsForRole(role || "viewer", userId || "anonymous");
}

export function canViewScreen(profile: UserPermission, screen: ScreenId, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const sp = profile.screenPermissions?.[screen] as ScreenPermission | undefined;
  return Boolean(sp?.canView);
}

export function canCreateScreen(
  profile: UserPermission,
  screen: ScreenId,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  const sp = profile.screenPermissions?.[screen] as ScreenPermission | undefined;
  return Boolean(sp?.canCreate);
}

/** Metric ids preferred per workspace (order = priority). Max 7 shown. */
export const WORKSPACE_METRICS: Record<HomeWorkspaceId, string[]> = {
  owner: [
    "cash_and_bank",
    "receivables",
    "payables",
    "sales_period",
    "net_result",
    "inventory_value",
  ],
  accountant: [
    "cash_and_bank",
    "receivables",
    "payables",
    "trial_balance_health",
    "sales_period",
    "net_result",
  ],
  cashier: ["todays_sales", "cash_and_bank", "receivables"],
  banking: ["cash_and_bank", "receivables", "payables"],
  inventory: ["inventory_value", "items_count", "parties_count"],
  auditor: [
    "cash_and_bank",
    "receivables",
    "payables",
    "net_result",
    "trial_balance_health",
  ],
  administrator: ["parties_count", "items_count", "trial_balance_health"],
  restricted: ["parties_count", "items_count"],
  combined: [
    "cash_and_bank",
    "receivables",
    "payables",
    "sales_period",
    "net_result",
    "todays_sales",
    "inventory_value",
  ],
};

export const WORKSPACE_SECTION_ORDER: Record<HomeWorkspaceId, string[]> = {
  owner: [
    "attention",
    "financial",
    "quickActions",
    "trends",
    "activity",
    "orbix",
  ],
  accountant: [
    "attention",
    "financial",
    "quickActions",
    "activity",
    "trends",
    "orbix",
  ],
  cashier: ["attention", "quickActions", "financial", "activity", "orbix"],
  banking: ["attention", "financial", "quickActions", "activity", "orbix"],
  inventory: ["attention", "financial", "quickActions", "activity", "orbix"],
  auditor: ["attention", "financial", "activity", "trends", "orbix"],
  administrator: ["attention", "quickActions", "financial", "activity", "orbix"],
  restricted: ["attention", "financial", "quickActions", "activity"],
  combined: [
    "attention",
    "quickActions",
    "financial",
    "activity",
    "trends",
    "orbix",
  ],
};

/** Mobile priority: attention → primary action → metrics → recent → trends */
export const MOBILE_SECTION_ORDER = [
  "attention",
  "quickActions",
  "financial",
  "activity",
  "trends",
  "orbix",
] as const;
