/**
 * scanning/components/ScannerShell.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Root shell / layout for the scanning workspace.
 * Orchestrates toolbar + live result feed + history panel.
 */

import React, { useState } from "react";
import { useScanner } from "../hooks/useScanner";
import { ScannerToolbar } from "./ScannerToolbar";
import { ScanResultCard } from "./ScanResultCard";
import { ScanHistoryPanel } from "./ScanHistoryPanel";
import type { ScanMode, ScannerSource } from "../types";

export const ScannerShell: React.FC = () => {
  const [historyOpen, setHistoryOpen] = useState(false);

  const {
    config,
    status,
    currentSession,
    isScanning,
    setConfig,
    startScanning,
    stopScanning,
    scanFile,
  } = useScanner();

  const handleModeChange = (mode: ScanMode) => setConfig({ mode });
  const handleSourceChange = (source: ScannerSource) => setConfig({ source });

  const results = currentSession?.results ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Orbix AI Scanner
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Barcode · QR · Invoice OCR · Serial &amp; Batch lookup
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="scan-history-btn"
            onClick={() => setHistoryOpen(true)}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            History
          </button>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-md px-4 py-3 mb-4">
        <ScannerToolbar
          mode={config.mode}
          source={config.source}
          status={status}
          onModeChange={handleModeChange}
          onSourceChange={handleSourceChange}
          onStart={startScanning}
          onStop={stopScanning}
          onFileSelect={scanFile}
        />
      </div>

      {/* ── Session Stats ────────────────────────────────────────────────── */}
      {currentSession && (
        <div className="flex items-center gap-4 mb-3 px-1">
          <StatChip label="Scanned" value={currentSession.totalScans} />
          <StatChip label="OK" value={currentSession.successCount} color="green" />
          <StatChip label="Errors" value={currentSession.errorCount} color="red" />
        </div>
      )}

      {/* ── Scanning indicator ───────────────────────────────────────────── */}
      {isScanning && config.source === "usb" && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-[12px] text-green-700">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Waiting for USB scanner input…
        </div>
      )}

      {/* ── Camera / document capture (uses Orbix document camera helper) ── */}
      {isScanning && config.source === "camera" && (
        <div className="mb-3 rounded-md border border-gray-200 bg-white p-4 text-[12px] text-gray-600">
          <p className="font-medium text-gray-800 mb-1">Document camera</p>
          <p className="text-[11px] text-gray-500 mb-3">
            For AI accounting from bill photos, open Ask Orbix and use the camera button on the
            composer (mobile rear camera / Capacitor). Barcode live-view remains a separate path.
          </p>
          <a
            href="/app/orbix"
            className="inline-flex h-8 items-center rounded-md bg-[#1557b0] px-3 text-[12px] font-medium text-white hover:bg-[#0f4a96]"
          >
            Open Orbix camera scan
          </a>
        </div>
      )}

      {/* ── Results Feed ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {results.length === 0 && !isScanning ? (
          <div className="text-center text-[12px] text-gray-400 mt-12">
            <div className="text-4xl mb-2">🔍</div>
            <p>Start a scan session to see results here.</p>
            <p className="mt-1 text-[11px]">
              Supports USB barcode guns, QR codes, and file uploads.
            </p>
          </div>
        ) : (
          [...results].reverse().map((r, i) => (
            <ScanResultCard key={r.id} result={r} index={results.length - 1 - i} />
          ))
        )}
      </div>

      {/* ── History Panel ────────────────────────────────────────────────── */}
      <ScanHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
};

// ─── Stat Chip ────────────────────────────────────────────────────────────────

const StatChip: React.FC<{
  label: string;
  value: number;
  color?: "green" | "red" | "default";
}> = ({ label, value, color = "default" }) => {
  const colorClass =
    color === "green"
      ? "text-green-700"
      : color === "red"
      ? "text-red-700"
      : "text-gray-700";

  return (
    <span className="text-[11px] text-gray-500">
      {label}:{" "}
      <strong className={`text-[12px] ${colorClass}`}>{value}</strong>
    </span>
  );
};
