/**
 * Active branch helpers (Wave K / Function 23).
 * Working branch (stamps): localStorage erp_default_branch + ContextSwitcher.
 * List/report view filter: optional erp_branch_view_filter === "all" (STEP 2.4).
 * Does not invent balances — only IDs for stamp/filter.
 */

export const ACTIVE_BRANCH_KEY = "erp_default_branch";
/** When set to "all", lists/reports show every branch; stamps still use ACTIVE_BRANCH_KEY. */
export const BRANCH_VIEW_FILTER_KEY = "erp_branch_view_filter";
export const BRANCH_CHANGED_EVENT = "orbix-branch-changed";

export function readActiveBranchId(): string {
  try {
    return localStorage.getItem(ACTIVE_BRANCH_KEY) || "";
  } catch {
    return "";
  }
}

/** View filter for lists/reports — "all" or the working branch id. */
export function readBranchViewFilter(): string {
  try {
    if (localStorage.getItem(BRANCH_VIEW_FILTER_KEY) === "all") return "all";
  } catch {
    /* ignore */
  }
  return readActiveBranchId() || "all";
}

export function writeBranchViewFilter(filterId: string): void {
  try {
    if (filterId === "all") {
      localStorage.setItem(BRANCH_VIEW_FILTER_KEY, "all");
    } else {
      localStorage.removeItem(BRANCH_VIEW_FILTER_KEY);
      if (filterId) localStorage.setItem(ACTIVE_BRANCH_KEY, filterId);
    }
  } catch {
    /* ignore */
  }
}

/** True when filter is all, or row has no branch (legacy), or row matches active. */
export function matchesBranchFilter(
  rowBranchId: string | undefined | null,
  filterId: string,
): boolean {
  if (!filterId || filterId === "all") return true;
  if (!rowBranchId) return true; // legacy untamped rows stay visible
  return rowBranchId === filterId;
}

/**
 * Stock movements may stamp branchId directly, or only warehouseId.
 * Legacy rows without either remain visible under any branch filter.
 */
export function matchesMovementBranch(
  movement: { branchId?: string | null; warehouseId?: string | null },
  filterId: string,
  warehouses: { id: string; branchId?: string | null }[],
): boolean {
  if (!filterId || filterId === "all") return true;
  if (movement.branchId) return movement.branchId === filterId;
  if (!movement.warehouseId) return true;
  const wh = warehouses.find((w) => w.id === movement.warehouseId);
  if (!wh?.branchId) return true;
  return wh.branchId === filterId;
}

/**
 * Stamps new stock movements without changing legacy read behavior.
 * Explicit movement branch wins, then warehouse ownership, then active branch.
 */
export function stampMovementBranch<
  T extends { branchId?: string | null; warehouseId?: string | null },
>(movement: T, warehouses: { id: string; branchId?: string | null }[]): T & { branchId?: string } {
  const branchId =
    movement.branchId ||
    warehouses.find((warehouse) => warehouse.id === movement.warehouseId)?.branchId ||
    readActiveBranchId();

  return branchId ? { ...movement, branchId } : { ...movement, branchId: undefined };
}
