import React from "react";
import { ReportWorkspace } from "@/features/reports";

export default function PDCRegister() {
  return (
    <ReportWorkspace
      title="Post-dated cheques"
      description="Future-dated cheques."
    >
      <p className="p-4 text-[13px] text-[var(--ds-text-muted)]">
        PDC register module is under construction.
      </p>
    </ReportWorkspace>
  );
}
