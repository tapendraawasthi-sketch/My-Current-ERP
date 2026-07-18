/**
 * scanning/components/ScannerToolbar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Top toolbar for the scanning workspace — start/stop controls, mode selector.
 */

import React from "react";
import type { ScanMode, ScannerSource, ScanStatus } from "../types";
import { SCAN_MODE_LABELS, SCANNER_SOURCE_LABELS } from "../constants";

interface ScannerToolbarProps {
  mode: ScanMode;
  source: ScannerSource;
  status: ScanStatus;
  onModeChange: (mode: ScanMode) => void;
  onSourceChange: (source: ScannerSource) => void;
  onStart: () => void;
  onStop: () => void;
  onFileSelect: (file: File) => void;
}

const MODES = Object.entries(SCAN_MODE_LABELS) as [ScanMode, string][];
const SOURCES = Object.entries(SCANNER_SOURCE_LABELS) as [ScannerSource, string][];

export const ScannerToolbar: React.FC<ScannerToolbarProps> = ({
  mode,
  source,
  status,
  onModeChange,
  onSourceChange,
  onStart,
  onStop,
  onFileSelect,
}) => {
  const isActive = status === "scanning" || status === "processing";

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Mode selector */}
      <select
        id="scan-mode-select"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as ScanMode)}
        disabled={isActive}
        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:opacity-50"
      >
        {MODES.map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {/* Source selector */}
      <select
        id="scan-source-select"
        value={source}
        onChange={(e) => onSourceChange(e.target.value as ScannerSource)}
        disabled={isActive}
        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:opacity-50"
      >
        {SOURCES.map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {/* File upload (only when source = file) */}
      {source === "file" && (
        <label
          htmlFor="scan-file-input"
          className="cursor-pointer h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z" />
          </svg>
          Upload Image
          <input
            id="scan-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      )}

      {/* Start / Stop */}
      {!isActive ? (
        <button
          id="scan-start-btn"
          onClick={onStart}
          disabled={source === "file"}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
          </svg>
          Start Scan
        </button>
      ) : (
        <button
          id="scan-stop-btn"
          onClick={onStop}
          className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z" />
          </svg>
          Stop
        </button>
      )}

      {/* Status badge */}
      <StatusBadge status={status} />
    </div>
  );
};

const STATUS_STYLES: Record<ScanStatus, string> = {
  idle: "bg-gray-100 text-gray-700",
  initializing: "bg-blue-100 text-blue-700",
  scanning: "bg-green-100 text-green-700",
  processing: "bg-amber-100 text-amber-700",
  success: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const StatusBadge: React.FC<{ status: ScanStatus }> = ({ status }) => (
  <span
    className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${STATUS_STYLES[status]}`}
  >
    {status}
  </span>
);
