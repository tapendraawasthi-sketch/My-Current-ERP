/**
 * scanning/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API barrel export for the Orbix AI Scanning feature module.
 * Import from here — do NOT reach into sub-folders directly from outside.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ScanMode,
  ScannerSource,
  ScanStatus,
  RawScanResult,
  ParsedScanResult,
  ScanEntityType,
  ResolvedEntityData,
  ScanSession,
  ScannerConfig,
  ScanState,
  ScanActions,
} from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────
export {
  SCANNING_ROUTE,
  DEFAULT_SCANNER_CONFIG,
  SCAN_MODE_LABELS,
  SCANNER_SOURCE_LABELS,
  MAX_HISTORY_SESSIONS,
} from "./constants";

// ── Store ─────────────────────────────────────────────────────────────────────
export { useScanStore } from "./store/scanStore";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useScanner } from "./hooks/useScanner";
export { useScanHistory } from "./hooks/useScanHistory";

// ── Components ────────────────────────────────────────────────────────────────
export { ScannerShell } from "./components/ScannerShell";
export { ScannerToolbar } from "./components/ScannerToolbar";
export { ScanResultCard } from "./components/ScanResultCard";
export { ScanHistoryPanel } from "./components/ScanHistoryPanel";

// ── Services ──────────────────────────────────────────────────────────────────
export {
  startUsbListener,
  stopUsbListener,
  scanFromFile,
  resolveEntity,
} from "./services/scanService";

// ── Page ──────────────────────────────────────────────────────────────────────
export { default as ScanningPage } from "./pages/ScanningPage";
