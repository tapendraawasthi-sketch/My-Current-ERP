/**
 * Single source of truth for toolbar/nav shortcut hints (STEP 3.5).
 * Must stay aligned with App.tsx global key handlers and ShortcutHelpModal.
 */
export const PAGE_SHORTCUT_HINTS: Record<string, string> = {
  "balance-sheet": "Ctrl+B",
  "trial-balance": "Ctrl+T",
  ledger: "Ctrl+L",
  "vat-reports": "Ctrl+G",
  users: "Ctrl+U",
};

/** Label for tooltip: "Balance Sheet (Ctrl+B)" */
export function shortcutTitle(label: string, pageId: string): string {
  const keys = PAGE_SHORTCUT_HINTS[pageId];
  return keys ? `${label} (${keys})` : label;
}
