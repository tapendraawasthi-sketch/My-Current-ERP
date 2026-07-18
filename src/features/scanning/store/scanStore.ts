/**
 * scanning/store/scanStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Zustand store slice for the Orbix AI Scanning feature.
 * Holds live scanning state, session tracking, and history.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  ScanState,
  ScanActions,
  ScanMode,
  ScannerSource,
  ParsedScanResult,
  ScanSession,
  ScanStatus,
} from "../types";
import {
  DEFAULT_SCANNER_CONFIG,
  MAX_HISTORY_SESSIONS,
  SCAN_STORE_KEY,
} from "../constants";

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: ScanState = {
  config: DEFAULT_SCANNER_CONFIG,
  status: "idle",
  currentSession: null,
  history: [],
  lastResult: null,
  errorMessage: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useScanStore = create<ScanState & ScanActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ── Config ───────────────────────────────────────────────────────────
      setConfig: (config) =>
        set((s) => ({ config: { ...s.config, ...config } })),

      // ── Status ───────────────────────────────────────────────────────────
      setStatus: (status: ScanStatus) => set({ status, errorMessage: null }),

      // ── Session Management ───────────────────────────────────────────────
      startSession: (mode: ScanMode, source: ScannerSource) => {
        const session: ScanSession = {
          sessionId: uuidv4(),
          startedAt: new Date().toISOString(),
          mode,
          source,
          results: [],
          totalScans: 0,
          successCount: 0,
          errorCount: 0,
        };
        set({ currentSession: session, status: "scanning", errorMessage: null });
      },

      endSession: () => {
        const { currentSession, history } = get();
        if (!currentSession) return;

        const closed: ScanSession = {
          ...currentSession,
          endedAt: new Date().toISOString(),
        };

        // Prepend to history, keep only MAX_HISTORY_SESSIONS
        const updatedHistory = [closed, ...history].slice(0, MAX_HISTORY_SESSIONS);
        set({ currentSession: null, history: updatedHistory, status: "idle" });
      },

      // ── Results ──────────────────────────────────────────────────────────
      addResult: (result: ParsedScanResult) =>
        set((s) => {
          if (!s.currentSession) return {};

          const isError = (result.errors?.length ?? 0) > 0;
          const updated: ScanSession = {
            ...s.currentSession,
            results: [...s.currentSession.results, result],
            totalScans: s.currentSession.totalScans + 1,
            successCount: s.currentSession.successCount + (isError ? 0 : 1),
            errorCount: s.currentSession.errorCount + (isError ? 1 : 0),
          };

          return {
            currentSession: updated,
            lastResult: result,
            status: isError ? "error" : "success",
            errorMessage: isError ? (result.errors?.[0] ?? "Unknown error") : null,
          };
        }),

      // ── History ──────────────────────────────────────────────────────────
      clearHistory: () => set({ history: [] }),

      // ── Reset ────────────────────────────────────────────────────────────
      reset: () => set({ ...initialState }),
    }),
    {
      name: SCAN_STORE_KEY,
      // Only persist history and config — do NOT persist live session state
      partialize: (s) => ({
        config: s.config,
        history: s.history,
      }),
    }
  )
);
