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

export function filterNavForRole(roleRaw: string | undefined | null): ShellNavGroup[] {
  const role = normalizeShellRole(roleRaw);
  return SHELL_NAV.map((g) => {
    if (!roleMatch(g.roles, role)) return null;
    if (!g.items.length) return g;
    const items = g.items.filter((i) => roleMatch(i.roles ?? g.roles, role));
    if (!items.length && !g.page) return null;
    return { ...g, items };
  }).filter(Boolean) as ShellNavGroup[];
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

export function mobileBottomDestinations(roleRaw: string | undefined | null): ShellNavItem[] {
  const role = normalizeShellRole(roleRaw);
  const all = filterNavForRole(roleRaw).flatMap((g) =>
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
