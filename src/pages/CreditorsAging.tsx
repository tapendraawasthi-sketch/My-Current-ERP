/**
 * Legacy creditors ageing — retired (Wave F / Function 15).
 * Canonical: AgingReport via `aging-report`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

export default function CreditorsAging() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("aging-report");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Ageing report…" />
    </div>
  );
}
