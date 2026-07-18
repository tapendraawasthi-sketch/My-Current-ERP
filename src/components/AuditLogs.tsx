/**
 * Legacy audit list component — retired (Wave C / Function 19).
 * Canonical surface is pages/AuditLog.tsx via nav `audit-log`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

const AuditLogs: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  useEffect(() => {
    setCurrentPage?.("audit-log");
  }, [setCurrentPage]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Audit log…" />
    </div>
  );
};

export default AuditLogs;
