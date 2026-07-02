// src/components/ReportEmptyState.tsx
import React from "react";

interface ReportEmptyStateProps {
  message?: string;
  hint?: string;
}

/**
 * ReportEmptyState — professional, text-only empty state.
 *
 * Rules applied:
 * - No cartoon images or emoji
 * - No coloured icons (icon is neutral #d1d5db)
 * - Title in #374151, hint in #9ca3af
 * - No green from old palette
 */
export const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({
  message = "No transactions found for the selected period.",
  hint = "Adjust the date range or check your filter settings.",
}) => {
  return (
    <div className="empty-state">
      {/* Minimal geometric icon — no cartoon, no colour */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        className="empty-state-icon"
        aria-hidden="true"
      >
        <rect x="4" y="6" width="24" height="20" rx="2"
          stroke="#d1d5db" strokeWidth="1.5" fill="none" />
        <line x1="9"  y1="12" x2="23" y2="12" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9"  y1="16" x2="23" y2="16" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9"  y1="20" x2="17" y2="20" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <p className="empty-state-title">{message}</p>
      <p className="empty-state-sub">{hint}</p>
    </div>
  );
};

export default ReportEmptyState;
