/**
 * scanning/components/ScanResultCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays one parsed scan result in a compact card.
 */

import React from "react";
import type { ParsedScanResult } from "../types";

interface ScanResultCardProps {
  result: ParsedScanResult;
  index: number;
}

export const ScanResultCard: React.FC<ScanResultCardProps> = ({ result, index }) => {
  const hasError = (result.errors?.length ?? 0) > 0;
  const hasWarning = (result.warnings?.length ?? 0) > 0;

  return (
    <div
      className={`border rounded-md p-3 text-[12px] ${
        hasError
          ? "border-red-200 bg-red-50"
          : hasWarning
          ? "border-amber-200 bg-amber-50"
          : "border-green-200 bg-green-50"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-gray-700">#{index + 1}</span>
        <div className="flex items-center gap-1.5">
          {result.entityType && result.entityType !== "unknown" && (
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-blue-100 text-blue-700">
              {result.entityType}
            </span>
          )}
          <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
            hasError
              ? "bg-red-100 text-red-700"
              : hasWarning
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          }`}>
            {hasError ? "Error" : hasWarning ? "Warning" : "OK"}
          </span>
        </div>
      </div>

      {/* Raw value */}
      <div className="font-mono text-gray-800 break-all mb-1">
        {result.rawValue}
      </div>

      {/* Resolved name (if available) */}
      {result.resolvedData?.displayName && (
        <div className="text-gray-600 italic text-[11px]">
          → {result.resolvedData.displayName}
        </div>
      )}

      {/* Errors */}
      {result.errors?.map((e, i) => (
        <div key={i} className="mt-1 text-red-700 text-[11px]">⚠ {e}</div>
      ))}

      {/* Warnings */}
      {result.warnings?.map((w, i) => (
        <div key={i} className="mt-1 text-amber-700 text-[11px]">ℹ {w}</div>
      ))}

      {/* Timestamp */}
      <div className="mt-1.5 text-[10px] text-gray-400">
        {new Date(result.timestamp).toLocaleTimeString()} · {result.source} · {result.mode}
        {result.confidence !== undefined && (
          <> · {Math.round(result.confidence * 100)}% confidence</>
        )}
      </div>
    </div>
  );
};
