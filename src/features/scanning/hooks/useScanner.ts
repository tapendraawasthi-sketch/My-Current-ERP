/**
 * scanning/hooks/useScanner.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Primary hook for consuming the scanning engine in React components.
 * Coordinates store state + service calls.
 */

import { useCallback, useEffect } from "react";
import { useScanStore } from "../store/scanStore";
import {
  startUsbListener,
  stopUsbListener,
  scanFromFile,
  resolveEntity,
} from "../services/scanService";
import type { ScanMode, ScannerSource, RawScanResult } from "../types";

export function useScanner() {
  const {
    config,
    status,
    currentSession,
    lastResult,
    errorMessage,
    setConfig,
    setStatus,
    startSession,
    endSession,
    addResult,
    reset,
  } = useScanStore();

  // ── Process a raw scan result ─────────────────────────────────────────────
  const processRaw = useCallback(
    async (raw: RawScanResult) => {
      setStatus("processing");
      try {
        const parsed = await resolveEntity(raw);
        addResult(parsed);
      } catch {
        setStatus("error");
      }
    },
    [addResult, setStatus]
  );

  // ── Start a scanning session ──────────────────────────────────────────────
  const startScanning = useCallback(
    (mode?: ScanMode, source?: ScannerSource) => {
      const resolvedMode = mode ?? config.mode;
      const resolvedSource = source ?? config.source;

      startSession(resolvedMode, resolvedSource);

      if (resolvedSource === "usb") {
        startUsbListener(resolvedMode, processRaw);
      }
      // Camera source: handled inside ScannerShell component (Phase 2)
    },
    [config.mode, config.source, startSession, processRaw]
  );

  // ── Stop scanning session ─────────────────────────────────────────────────
  const stopScanning = useCallback(() => {
    stopUsbListener();
    endSession();
  }, [endSession]);

  // ── Scan from file upload ─────────────────────────────────────────────────
  const scanFile = useCallback(
    async (file: File) => {
      setStatus("processing");
      try {
        const raw = await scanFromFile(file, config.mode);
        await processRaw(raw);
      } catch {
        setStatus("error");
      }
    },
    [config.mode, processRaw, setStatus]
  );

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopUsbListener();
    };
  }, []);

  return {
    config,
    status,
    currentSession,
    lastResult,
    errorMessage,
    isScanning: status === "scanning" || status === "processing",
    setConfig,
    startScanning,
    stopScanning,
    scanFile,
    reset,
  };
}
