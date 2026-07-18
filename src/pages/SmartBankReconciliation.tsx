/**
 * Duplicate bank reco / chart hub — retired (Wave D / Function 10).
 * Canonical: BankReconciliation.tsx via `bank-reconciliation`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

export default function SmartBankReconciliation() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("bank-reconciliation");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening bank reconciliation…" />
    </div>
  );
}
