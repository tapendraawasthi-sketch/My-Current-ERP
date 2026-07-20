import { getNatureProfile } from "../../lib/businessNature";
import { SHELL_NAV, type ShellNavGroup, type ShellNavItem, type ShellRoleHint } from "./navConfig";

/** Map store role strings onto shell role hints (no new permission engine). */
export function normalizeShellRole(role: string | undefined | null): ShellRoleHint {
  const r = (role || "viewer").toLowerCase();
  if (r === "admin" || r === "administrator") return "admin";
  if (r === "manager") return "manager";
  if (r === "owner" || r === "business_owner" || r === "business-owner") return "owner";
  if (r === "accountant") return "accountant";
  if (r === "cashier" || r === "clerk") return "cashier";
  if (r === "auditor") return "auditor";
  if (r === "inventory" || r === "inventory_user" || r === "stock") return "inventory";
  if (r === "banking" || r === "banking_user" || r === "bank") return "banking";
  return "viewer";
}

function roleMatch(allowed: ShellRoleHint[] | undefined, role: ShellRoleHint): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (allowed.includes("all")) return true;
  if (role === "admin" || role === "owner" || role === "manager") return true;
  return allowed.includes(role);
}

export type NavFilterOptions = {
  /** Company business nature id — filters modules/pages by industry pack. */
  businessNature?: string | null;
  /** When false, hide inventory group (overrides nature if set). */
  enableInventory?: boolean | null;
  /** When false, hide POS counter page. */
  enablePOS?: boolean | null;
  /** When false, hide job-work / production-ish pages. */
  enableProduction?: boolean | null;
  enableJobWork?: boolean | null;
  /** When false, hide batch management. */
  enableBatchTracking?: boolean | null;
  /** When false, hide budget pages. */
  enableBudget?: boolean | null;
  /** When false, hide payroll admin entry. */
  enablePayroll?: boolean | null;
};

function applyNatureAndFeatureFilters(
  groups: ShellNavGroup[],
  opts?: NavFilterOptions | null,
): ShellNavGroup[] {
  if (!opts) return groups;

  const nature = getNatureProfile(opts.businessNature);
  const hiddenGroups = new Set(nature.nav.hiddenGroups);
  const hiddenPages = new Set(nature.nav.hiddenPages);

  // Feature flags can further hide (never re-show what nature hid).
  if (opts.enableInventory === false) hiddenGroups.add("inventory");
  if (opts.enablePOS === false) hiddenPages.add("pos-billing");
  if (opts.enableProduction === false && opts.enableJobWork === false) {
    hiddenPages.add("job-work-register");
  }
  if (opts.enableJobWork === false) hiddenPages.add("job-work-register");
  if (opts.enableBatchTracking === false) hiddenPages.add("batch-management");
  if (opts.enableBudget === false) {
    hiddenPages.add("budget");
    hiddenPages.add("budget-vs-actual");
  }
  if (opts.enablePayroll === false) hiddenPages.add("payroll");

  // Always keep administration + settings reachable so nature can be changed.
  hiddenGroups.delete("administration");
  hiddenPages.delete("settings");
  hiddenPages.delete("company-features");

  return groups
    .map((g) => {
      if (hiddenGroups.has(g.id)) return null;
      if (!g.items.length) return g;
      const items = g.items.filter((i) => !hiddenPages.has(i.page) && !hiddenPages.has(i.id));
      if (!items.length && !g.page) return null;
      return { ...g, items };
    })
    .filter(Boolean) as ShellNavGroup[];
}

export function filterNavForRole(
  roleRaw: string | undefined | null,
  opts?: NavFilterOptions | null,
): ShellNavGroup[] {
  const role = normalizeShellRole(roleRaw);
  const byRole = SHELL_NAV.map((g) => {
    if (!roleMatch(g.roles, role)) return null;
    if (!g.items.length) return g;
    const items = g.items.filter((i) => roleMatch(i.roles ?? g.roles, role));
    if (!items.length && !g.page) return null;
    return { ...g, items };
  }).filter(Boolean) as ShellNavGroup[];

  return applyNatureAndFeatureFilters(byRole, opts);
}

/** Build nav filter opts from companySettings-like object. */
export function navFilterOptsFromCompany(company: {
  businessNature?: string | null;
  enableInventory?: boolean | null;
  enablePOS?: boolean | null;
  enableProduction?: boolean | null;
  enableJobWork?: boolean | null;
  enableBatchTracking?: boolean | null;
  enableBudget?: boolean | null;
  enablePayroll?: boolean | null;
} | null | undefined): NavFilterOptions | null {
  if (!company) return null;
  return {
    businessNature: company.businessNature ?? null,
    enableInventory: company.enableInventory,
    enablePOS: company.enablePOS,
    enableProduction: company.enableProduction,
    enableJobWork: company.enableJobWork,
    enableBatchTracking: company.enableBatchTracking,
    enableBudget: company.enableBudget,
    enablePayroll: company.enablePayroll,
  };
}

/** Soft deep-link gate for known admin surfaces — does not invent ACL. */
const ADMIN_PAGES = new Set([
  "users",
  "backup-restore",
  "accounts-configuration",
  "inventory-config",
]);

export function canNavigateToPage(page: string, roleRaw: string | undefined | null): boolean {
  const role = normalizeShellRole(roleRaw);
  if (role === "admin" || role === "owner") return true;
  if (ADMIN_PAGES.has(page) && role !== "manager") {
    if (page === "users" || page === "backup-restore") return false;
  }
  if (role === "auditor" && (page === "billing" || page === "purchase")) {
    /* auditors may still open read-only historical routes — App does not enforce; allow deep link */
    return true;
  }
  return true;
}

export function mobileBottomDestinations(
  roleRaw: string | undefined | null,
  opts?: NavFilterOptions | null,
): ShellNavItem[] {
  const all = filterNavForRole(roleRaw, opts).flatMap((g) =>
    g.items.length
      ? g.items
      : g.page
        ? [{ id: g.id, label: g.label, page: g.page!, icon: g.icon, orbix: g.orbix }]
        : [],
  );
  const pick = (page: string) => all.find((i) => i.page === page);
  const home = pick("dashboard") || {
    id: "home",
    label: "Home",
    page: "dashboard",
    icon: SHELL_NAV[0].icon,
  };
  const orbix = pick("orbix") || {
    id: "orbix",
    label: "Orbix",
    page: "orbix",
    icon: SHELL_NAV[1].icon,
    orbix: true,
  };
  const create =
    pick("billing") ||
    pick("receipt") ||
    all.find((i) => i.favouriteEligible) ||
    home;
  return [home, orbix, create].filter(Boolean) as ShellNavItem[];
}
