/**
 * scanning/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature-wide constants and default configuration for the Scanning module.
 */

import type { ScannerConfig, ScanMode, ScannerSource } from "./types";

// ─── Route ───────────────────────────────────────────────────────────────────

export const SCANNING_ROUTE = "/scanning";

// ─── Default Config ──────────────────────────────────────────────────────────

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  mode: "barcode",
  source: "camera",
  autoProcess: true,
  beepOnSuccess: true,
  vibrationOnScan: false,
  overlayGuide: true,
  continuousScan: false,
  debounceMs: 1500,
  cameraFacingMode: "environment",
};

// ─── Scan Mode Labels ─────────────────────────────────────────────────────────

export const SCAN_MODE_LABELS: Record<ScanMode, string> = {
  barcode: "Barcode",
  qr: "QR Code",
  document: "Document",
  invoice: "Invoice OCR",
  batch: "Batch / Lot",
  serial: "Serial Number",
};

// ─── Scanner Source Labels ───────────────────────────────────────────────────

export const SCANNER_SOURCE_LABELS: Record<ScannerSource, string> = {
  camera: "Camera",
  usb: "USB Scanner",
  file: "File Upload",
  api: "Remote API",
};

// ─── Max History Sessions ─────────────────────────────────────────────────────

export const MAX_HISTORY_SESSIONS = 50;

// ─── Local Storage Keys ──────────────────────────────────────────────────────

export const SCAN_STORE_KEY = "orbix_scan_store";
export const SCAN_HISTORY_KEY = "orbix_scan_history";

// ─── USB Scanner: keyboard-wedge terminator ───────────────────────────────────

export const USB_SCAN_TERMINATOR = "Enter";
export const USB_SCAN_PREFIX_DELAY_MS = 50; // Time within which chars form one scan

// ─── Confidence Thresholds ────────────────────────────────────────────────────

export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MEDIUM = 0.60;
export const CONFIDENCE_LOW = 0.0;
