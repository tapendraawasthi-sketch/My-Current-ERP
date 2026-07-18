/**
 * Legacy Busy POS chrome — retired (Wave D / Function 18).
 * Canonical: POSBilling.tsx via `pos` / `pos-mode` / `pos-billing`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

export default function POSMode() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("pos-billing");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening POS…" />
    </div>
  );
}
