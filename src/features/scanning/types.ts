/**
 * scanning/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared TypeScript types & interfaces for the Orbix AI Scanning feature.
 * All phase-specific types should be added here as the feature grows.
 */

// ─── Scan Modes ─────────────────────────────────────────────────────────────

export type ScanMode =
  | "barcode"        // 1-D / 2-D barcode (camera or USB scanner)
  | "qr"             // QR code
  | "document"       // Document / receipt OCR scan
  | "invoice"        // Invoice-specific OCR + field extraction
  | "batch"          // Batch / lot number barcode
  | "serial";        // Serial number lookup

// ─── Scanner Source ──────────────────────────────────────────────────────────

export type ScannerSource =
  | "camera"         // Device camera (WebRTC / getUserMedia)
  | "usb"            // USB HID barcode gun (keyboard-wedge emulation)
  | "file"           // Image file upload → OCR
  | "api";           // Remote scanning API

// ─── Scan Status ─────────────────────────────────────────────────────────────

export type ScanStatus =
  | "idle"
  | "initializing"
  | "scanning"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

// ─── Raw Scan Result ─────────────────────────────────────────────────────────

export interface RawScanResult {
  id: string;                    // UUID for this scan event
  timestamp: string;             // ISO-8601
  mode: ScanMode;
  source: ScannerSource;
  rawValue: string;              // Raw decoded string from scanner
  confidence?: number;           // 0–1 confidence score (OCR / AI)
  imageDataUrl?: string;         // Base64 preview (document scans)
  metadata?: Record<string, unknown>;
}

// ─── Enriched / Parsed Result ────────────────────────────────────────────────

export interface ParsedScanResult extends RawScanResult {
  entityType?: ScanEntityType;
  resolvedData?: ResolvedEntityData;
  warnings?: string[];
  errors?: string[];
}

// ─── Entity Resolution ───────────────────────────────────────────────────────

export type ScanEntityType =
  | "item"           // Stock item (by barcode / HSN)
  | "party"          // Customer / Supplier
  | "voucher"        // Sales / Purchase voucher
  | "invoice"        // Invoice document
  | "asset"          // Fixed asset tag
  | "employee"       // Employee ID
  | "unknown";

export interface ResolvedEntityData {
  entityType: ScanEntityType;
  entityId?: string;
  displayName?: string;
  fields?: Record<string, string | number | boolean>;
}

// ─── Scanner Session ─────────────────────────────────────────────────────────

export interface ScanSession {
  sessionId: string;
  startedAt: string;             // ISO-8601
  endedAt?: string;
  mode: ScanMode;
  source: ScannerSource;
  results: ParsedScanResult[];
  totalScans: number;
  successCount: number;
  errorCount: number;
}

// ─── Scanner Config ──────────────────────────────────────────────────────────

export interface ScannerConfig {
  mode: ScanMode;
  source: ScannerSource;
  autoProcess: boolean;          // Auto-resolve entity after scan
  beepOnSuccess: boolean;
  vibrationOnScan: boolean;
  overlayGuide: boolean;         // Show camera guide overlay
  continuousScan: boolean;       // Keep scanning without user trigger
  debounceMs: number;            // Min ms between duplicate scans
  cameraFacingMode: "user" | "environment";
}

// ─── Store Slice ─────────────────────────────────────────────────────────────

export interface ScanState {
  config: ScannerConfig;
  status: ScanStatus;
  currentSession: ScanSession | null;
  history: ScanSession[];
  lastResult: ParsedScanResult | null;
  errorMessage: string | null;
}

export interface ScanActions {
  setConfig: (config: Partial<ScannerConfig>) => void;
  setStatus: (status: ScanStatus) => void;
  startSession: (mode: ScanMode, source: ScannerSource) => void;
  endSession: () => void;
  addResult: (result: ParsedScanResult) => void;
  clearHistory: () => void;
  reset: () => void;
}
