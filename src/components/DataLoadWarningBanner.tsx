import React from "react";
import { Banner } from "@/design-system";
import { useStore } from "../store/useStore";

/** Data-load warning — DS Banner (IMPLEMENT_NOW Wave 1). */
export default function DataLoadWarningBanner() {
  const { dataLoadWarning, dismissDataLoadWarning } = useStore();

  if (!dataLoadWarning) return null;

  return (
    <div className="ds-no-print no-print">
      <Banner
        tone="warning"
        title="Data load incomplete"
        description={dataLoadWarning}
        action={
          <button
            type="button"
            className="text-[12px] font-semibold text-[var(--ds-status-warning)] underline-offset-2 hover:underline transition-colors"
            onClick={() => dismissDataLoadWarning()}
          >
            Dismiss
          </button>
        }
      />
    </div>
  );
}
