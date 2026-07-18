/**
 * Duplicate audit list page — retired (Wave C / Function 19).
 * Canonical surface is Audit log (`audit-log` → pages/AuditLog.tsx).
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

export default function AuditLogs() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  useEffect(() => {
    setCurrentPage?.("audit-log");
  }, [setCurrentPage]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Audit log…" />
    </div>
  );
}
