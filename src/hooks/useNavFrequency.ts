// src/hooks/useNavFrequency.ts
/**
 * useNavFrequency
 *
 * Tracks how often the user navigates to each page by storing
 * a frequency map in localStorage under "sutra:nav_freq".
 *
 * Returns:
 *   - recordVisit(page): call this when navigating to a page
 *   - getTopPages(n): returns the top n most-visited page keys
 *   - frequencies: the full {[page]: count} map
 *
 * Used by Gateway.tsx to surface "Frequently Used" items
 * at the top of the Reports section panel.
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "sutra:nav_freq";
const MAX_TRACKED  = 100;   // cap total tracked pages to avoid unbounded growth

function loadFreq(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFreq(freq: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freq));
  } catch { /* quota exceeded — silent */ }
}

export function useNavFrequency() {
  const [frequencies, setFrequencies] = useState<Record<string, number>>(loadFreq);

  const recordVisit = useCallback((page: string) => {
    setFrequencies((prev) => {
      const next = { ...prev, [page]: (prev[page] || 0) + 1 };
      // Trim to top MAX_TRACKED entries if map grows too large
      const entries = Object.entries(next).sort((a, b) => b[1] - a[1]);
      const trimmed = Object.fromEntries(entries.slice(0, MAX_TRACKED));
      saveFreq(trimmed);
      return trimmed;
    });
  }, []);

  const getTopPages = useCallback(
    (n: number, filterPages?: string[]): string[] => {
      const entries = Object.entries(frequencies)
        .filter(([page]) => !filterPages || filterPages.includes(page))
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([page]) => page);
      return entries;
    },
    [frequencies],
  );

  return { frequencies, recordVisit, getTopPages };
}

export default useNavFrequency;
