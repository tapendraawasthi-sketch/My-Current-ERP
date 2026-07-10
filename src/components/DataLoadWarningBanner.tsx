import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { useStore } from "../store/useStore";

export default function DataLoadWarningBanner() {
  const { dataLoadWarning, dismissDataLoadWarning } = useStore();

  if (!dataLoadWarning) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start justify-between gap-3 no-print">
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-medium text-amber-800">Data load incomplete</p>
          <p className="text-[11px] text-amber-700 mt-0.5">{dataLoadWarning}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss warning"
        className="text-amber-700 hover:text-amber-900 shrink-0"
        onClick={() => dismissDataLoadWarning()}
      >
        <X size={16} />
      </button>
    </div>
  );
}
