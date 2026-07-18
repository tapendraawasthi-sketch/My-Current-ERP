/**
 * Active-branch filter state for lists/reports (Wave M / P).
 * Defaults to erp_default_branch; follows BranchSwitcher events.
 */
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  BRANCH_CHANGED_EVENT,
  matchesBranchFilter,
  matchesMovementBranch,
  readActiveBranchId,
} from "../lib/activeBranch";

export function useBranchFilter() {
  const branches = useStore((s) => s.branches || []);
  const warehouses = useStore((s) => (s as { warehouses?: { id: string; branchId?: string }[] }).warehouses || []);
  const [branchFilter, setBranchFilter] = useState(() => readActiveBranchId() || "all");

  useEffect(() => {
    const sync = () => {
      const id = readActiveBranchId();
      if (id) setBranchFilter(id);
    };
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

  return {
    branchFilter,
    setBranchFilter,
    branchOptions,
    matchBranch,
    matchMovement,
    warehouses: warehouseList,
  };
}
