/**
 * Lightweight print prefs (Wave L / Function 21).
 * localStorage orbix_print_prefs — consumed by InvoicePrint + printUtils.
 */

export const PRINT_PREFS_KEY = "orbix_print_prefs";

export type PrintPrefs = {
  pageSize: "A4" | "Letter" | "A5";
  orientation: "Portrait" | "Landscape";
  showLogo: boolean;
  showNepali: boolean;
  showPan: boolean;
  copies: number;
};

export const DEFAULT_PRINT_PREFS: PrintPrefs = {
  pageSize: "A4",
  orientation: "Portrait",
  showLogo: true,
  showNepali: true,
  showPan: true,
  copies: 1,
};

export function loadPrintPrefs(): PrintPrefs {
  try {
    const raw = localStorage.getItem(PRINT_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PRINT_PREFS };
    return { ...DEFAULT_PRINT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRINT_PREFS };
  }
}

export function savePrintPrefs(prefs: PrintPrefs): void {
  localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(prefs));
}
