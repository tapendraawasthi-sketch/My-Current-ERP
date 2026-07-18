/**
 * Duplicate payroll processor — retired (Wave D / Function 14).
 * Canonical: Payroll.tsx via nav `payroll`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

export default function PayrollProcessing() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("payroll");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Payroll…" />
    </div>
  );
}
