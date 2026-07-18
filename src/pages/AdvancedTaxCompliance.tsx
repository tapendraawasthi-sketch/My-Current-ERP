/**
 * Advanced / India tax mega surface — retired (Wave G / Function 12).
 * Nepal path: VAT Reports + TDS Report.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

export default function AdvancedTaxCompliance() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("vat-reports");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening VAT reports…" />
    </div>
  );
}
