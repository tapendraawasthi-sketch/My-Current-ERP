/**
 * Active-branch filter for lists/reports (Wave M / P).
 *
 * STEP 2.4 — One identity strip: Company / Branch / FY live only in shell
 * `ContextSwitcher`. Pages must not render a duplicate Branch `<select>` or
 * Company/FY badges — follow BRANCH_CHANGED_EVENT via this hook. Optional
 * “All branches” is a shell view mode (erp_branch_view_filter); stamps still
 * use the working branch. ReportWorkspace filterSlot may override scope when
 * multi-branch comparison is the report’s job.
 */
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  BRANCH_CHANGED_EVENT,
  matchesBranchFilter,
  matchesMovementBranch,
  readBranchViewFilter,
} from "../lib/activeBranch";

export function useBranchFilter() {
  const branches = useStore((s) => s.branches || []);
  const warehouses = useStore(
    (s) => (s as { warehouses?: { id: string; branchId?: string }[] }).warehouses || [],
  );
  const [branchFilter, setBranchFilterState] = useState(() => readBranchViewFilter());

  useEffect(() => {
    const sync = () => setBranchFilterState(readBranchViewFilter());
    sync();
    window.addEventListener(BRANCH_CHANGED_EVENT, sync as EventListener);
    return () => window.removeEventListener(BRANCH_CHANGED_EVENT, sync as EventListener);
  }, []);

  const branchOptions = useMemo(
    () =>
      (branches as { id: string; name?: string; code?: string; isActive?: boolean }[]).filter(
        (b) => b && b.isActive !== false,
      ),
    [branches],
  );

  const warehouseList = useMemo(
    () => (warehouses as { id: string; branchId?: string }[]) || [],
    [warehouses],
  );

  const matchBranch = (rowBranchId?: string | null) =>
    matchesBranchFilter(rowBranchId, branchFilter);

  const matchMovement = (movement: { branchId?: string | null; warehouseId?: string | null }) =>
    matchesMovementBranch(movement, branchFilter, warehouseList);

  /** Prefer shell ContextSwitcher; keep setter for rare report-scope overrides. */
  const setBranchFilter = setBranchFilterState;

  return {
    branchFilter,
    setBranchFilter,
    branchOptions,
    matchBranch,
    matchMovement,
    warehouses: warehouseList,
  };
}
