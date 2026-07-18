/**
 * Combined outstanding megapage — retired (Wave F / Function 15).
 * Canonical: OutstandingReceivables + OutstandingPayables + AgingReport.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

const OutstandingManagement: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("outstanding-receivables");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Receivables…" />
    </div>
  );
};

export default OutstandingManagement;
