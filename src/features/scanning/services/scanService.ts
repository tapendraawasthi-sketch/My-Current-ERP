/**
 * scanning/services/scanService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core scanning engine adapter.
 * Phase 1: Scaffold with USB keyboard-wedge listener + file-based stub.
 * Future phases will plug in camera (WebRTC + ZXing) and OCR (Tesseract / API).
 */

import { v4 as uuidv4 } from "uuid";
import type {
  RawScanResult,
  ParsedScanResult,
  ScanMode,
  ScannerSource,
  ScanEntityType,
} from "../types";
import {
  USB_SCAN_TERMINATOR,
  USB_SCAN_PREFIX_DELAY_MS,
  CONFIDENCE_HIGH,
} from "../constants";

// ─── USB / Keyboard-Wedge Listener ───────────────────────────────────────────

type ScanCallback = (result: RawScanResult) => void;

let _usbBuffer = "";
let _usbTimer: ReturnType<typeof setTimeout> | null = null;
let _usbListener: ((e: KeyboardEvent) => void) | null = null;

/**
 * Start listening for USB barcode scanner input.
 * USB scanners emit characters very fast then send Enter (or another terminator).
 */
export function startUsbListener(
  mode: ScanMode,
  onScan: ScanCallback
): () => void {
  stopUsbListener();

  _usbListener = (e: KeyboardEvent) => {
    if (e.key === USB_SCAN_TERMINATOR) {
      const value = _usbBuffer.trim();
      _usbBuffer = "";
      if (_usbTimer) clearTimeout(_usbTimer);
      _usbTimer = null;
      if (value.length > 0) {
        onScan(buildRawResult(value, mode, "usb"));
      }
      return;
    }

    // Accumulate characters
    if (e.key.length === 1) {
      _usbBuffer += e.key;
    }

    // Reset buffer after timeout (guards against normal typing)
    if (_usbTimer) clearTimeout(_usbTimer);
    _usbTimer = setTimeout(() => {
      _usbBuffer = "";
    }, USB_SCAN_PREFIX_DELAY_MS * 10);
  };

  window.addEventListener("keydown", _usbListener);

  return stopUsbListener;
}

export function stopUsbListener() {
  if (_usbListener) {
    window.removeEventListener("keydown", _usbListener);
    _usbListener = null;
  }
  _usbBuffer = "";
  if (_usbTimer) {
    clearTimeout(_usbTimer);
    _usbTimer = null;
  }
}

// ─── File / Image Scan (Stub — Phase 2+ will use Tesseract / OCR API) ────────

export async function scanFromFile(
  file: File,
  mode: ScanMode
): Promise<RawScanResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Phase 1 stub: return the file name as the raw value
      // Phase 2+ will decode the image with ZXing or Tesseract
      resolve(
        buildRawResult(
          `[FILE:${file.name}] — OCR pending (Phase 2)`,
          mode,
          "file",
          reader.result as string
        )
      );
    };
    reader.readAsDataURL(file);
  });
}

// ─── Entity Resolution (Stub — Phase 2+ wires to ERP API) ────────────────────

export async function resolveEntity(
  raw: RawScanResult
): Promise<ParsedScanResult> {
  // Phase 1: return as-is with entityType "unknown"
  // Phase 2+ will call backend /api/scan/resolve
  const entityType: ScanEntityType = inferEntityType(raw.rawValue);

  return {
    ...raw,
    entityType,
    resolvedData:
      entityType !== "unknown"
        ? {
            entityType,
            displayName: `[Unresolved] ${raw.rawValue}`,
          }
        : undefined,
    warnings:
      entityType === "unknown"
        ? ["Could not resolve entity — manual lookup required"]
        : [],
    errors: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRawResult(
  rawValue: string,
  mode: ScanMode,
  source: ScannerSource,
  imageDataUrl?: string
): RawScanResult {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    mode,
    source,
    rawValue,
    confidence: source === "usb" ? CONFIDENCE_HIGH : undefined,
    imageDataUrl,
  };
}

/**
 * Heuristic entity type inference from raw scanned value.
 * Phase 2+ will replace with API-based resolution.
 */
function inferEntityType(value: string): ScanEntityType {
  if (/^[0-9]{8,14}$/.test(value)) return "item";     // EAN-8, EAN-13, UPC
  if (/^[A-Z]{2,4}-\d{4,}$/i.test(value)) return "voucher"; // e.g. SV-0001
  if (/^INV-/i.test(value)) return "invoice";
  if (/^AST-/i.test(value)) return "asset";
  if (/^EMP-/i.test(value)) return "employee";
  if (/^BTH-/i.test(value)) return "batch";
  if (/^SRL-/i.test(value)) return "serial";
  return "unknown";
}
