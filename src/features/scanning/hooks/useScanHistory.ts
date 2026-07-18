/**
 * scanning/hooks/useScanHistory.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook for reading and managing scan session history.
 */

import { useMemo } from "react";
import { useScanStore } from "../store/scanStore";
import type { ScanSession } from "../types";

export function useScanHistory() {
  const history = useScanStore((s) => s.history);
  const clearHistory = useScanStore((s) => s.clearHistory);

  const stats = useMemo(() => {
    const total = history.reduce((acc, s) => acc + s.totalScans, 0);
    const successes = history.reduce((acc, s) => acc + s.successCount, 0);
    const errors = history.reduce((acc, s) => acc + s.errorCount, 0);
    return { sessions: history.length, total, successes, errors };
  }, [history]);

  const getSession = (sessionId: string): ScanSession | undefined =>
    history.find((s) => s.sessionId === sessionId);

  return { history, stats, clearHistory, getSession };
}
