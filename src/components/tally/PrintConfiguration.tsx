/**
 * Legacy Busy/Tally print template studio — retired (Wave H / Function 21).
 * Canonical: PrintSettings.tsx via `print-settings`.
 */
import React, { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { LoadingState } from "@/design-system";

const PrintConfiguration = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("print-settings");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Print settings…" />
    </div>
  );
};

export default PrintConfiguration;
