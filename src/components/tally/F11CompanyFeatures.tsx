/**
 * Tally-styled F11 duplicate — retired (Wave D / Function 13).
 * Canonical: pages/F11CompanyFeatures.tsx via `company-features`.
 */
import React, { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { LoadingState } from "@/design-system";

const F11CompanyFeatures = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("company-features");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Company features…" />
    </div>
  );
};

export default F11CompanyFeatures;
