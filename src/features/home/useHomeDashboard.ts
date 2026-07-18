import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { usePermissionsStore } from "@/store/permissionsStore";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { buildHomeViewModel, type HomeAdapterInput } from "./dashboardAdapter";
import type { HomeViewModel } from "./types";

function companyIdFromSettings(settings: HomeAdapterInput["companySettings"]): string {
  return String(settings?.id || "main");
}

export function useHomeDashboard() {
  const companySettings = useStore((s) => s.companySettings);
  const currentFiscalYear = useStore((s) => s.currentFiscalYear);
  const currentUser = useStore((s) => s.currentUser);
  const accounts = useStore((s) => s.accounts) ?? [];
  const parties = useStore((s) => s.parties) ?? [];
  const items = useStore((s) => s.items) ?? [];
  const invoices = useStore((s) => s.invoices) ?? [];
  const vouchers = useStore((s) => s.vouchers) ?? [];
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const permissions = usePermissionsStore((s) => s.permissions);
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [model, setModel] = useState<HomeViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      const id = ++requestId.current;
      if (opts?.soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const online = typeof navigator !== "undefined" ? navigator.onLine : true;
        const scopedInvoices = ((invoices as HomeAdapterInput["invoices"]) || []).filter((i) =>
          matchBranch((i as { branchId?: string | null }).branchId),
        );
        const scopedVouchers = ((vouchers as HomeAdapterInput["vouchers"]) || []).filter((v) =>
          matchBranch((v as { branchId?: string | null }).branchId),
        );
        const vm = await buildHomeViewModel({
          companyId: companyIdFromSettings(companySettings as HomeAdapterInput["companySettings"]),
          companySettings: companySettings as HomeAdapterInput["companySettings"],
          currentFiscalYear: currentFiscalYear as HomeAdapterInput["currentFiscalYear"],
          currentUser: currentUser as HomeAdapterInput["currentUser"],
          permissions,
          accounts: (accounts as HomeAdapterInput["accounts"]) || [],
          parties: (parties as unknown[]) || [],
          items: (items as HomeAdapterInput["items"]) || [],
          invoices: scopedInvoices,
          vouchers: scopedVouchers,
          online,
          refreshing: Boolean(opts?.soft),
        });
        if (id !== requestId.current) return;
        setModel(vm);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Home could not be loaded.");
        if (!opts?.soft) setModel(null);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      companySettings,
      currentFiscalYear,
      currentUser,
      permissions,
      accounts,
      parties,
      items,
      invoices,
      vouchers,
      matchBranch,
      branchFilter,
    ],
  );

  const role = currentUser?.role;
  const userId = currentUser?.id;
  const companyId = (companySettings as { id?: string } | null)?.id;
  const fyId =
    (currentFiscalYear as { id?: string } | null)?.id ||
    (currentFiscalYear as { name?: string } | null)?.name;

  useEffect(() => {
    void load();
  }, [load, role, userId, companyId, fyId, branchFilter]);

  return {
    model,
    loading,
    refreshing,
    error,
    refresh: () => load({ soft: true }),
    retry: () => load(),
    setCurrentPage,
    branchFilter,
    setBranchFilter,
    branchOptions,
  };
}
