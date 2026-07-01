// src/hooks/useGlobalKeyboardShortcuts.ts
// Central keyboard shortcut handler - mounted ONCE at app root level
import { useEffect, useRef } from "react";

type NavigateFn = (page: string) => void;

/** Normalise a KeyboardEvent into a canonical combo string like "Ctrl+B", "F2", "Alt+1" */
function getCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Normalize key
  let key = e.key;
  if (key === " ") key = "Space";
  // For single alpha keys, uppercase
  if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join("+");
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

// Map shortcut combos → page routes
const SHORTCUT_MAP: Record<string, string> = {
  // Ctrl combinations (work even while sidebar focused)
  "Ctrl+B": "balance-sheet",
  "Ctrl+T": "trial-balance",
  "Ctrl+L": "ledger",
  "Ctrl+G": "vat-reports",
  "Ctrl+D": "day-book",
  "Ctrl+M": "accounts",
  "Ctrl+P": "parties",
  "Ctrl+I": "item-master",
  "Ctrl+J": "journal",
  "Ctrl+R": "receipt",

  // Alt+Number navigation
  "Alt+1": "dashboard",
  "Alt+2": "billing",
  "Alt+3": "purchase",
  "Alt+4": "journal",
  "Alt+5": "payment",
  "Alt+6": "receipt",
  "Alt+7": "day-book",
  "Alt+8": "trial-balance",
  "Alt+9": "balance-sheet",
  "Alt+0": "profit-loss",

  // F-keys (always active, even in inputs for save/navigation)
  F1: "dashboard",
  F2: "billing",
  F3: "item-master",
  F4: "accounts",
  F5: "journal",
  F6: "payment",
  F7: "receipt",
  F8: "contra",
  F9: "billing",
  F10: "purchase",
  F11: "balance-sheet",
};

// Single-key shortcuts (ONLY when NOT typing)
const SINGLE_KEY_MAP: Record<string, string> = {
  B: "balance-sheet",
  T: "trial-balance",
  S: "stock-summary",
  L: "ledger",
  V: "vat-reports",
  D: "day-book",
  G: "vat-reports",
  A: "accounts",
};

export function useGlobalKeyboardShortcuts(navigate: NavigateFn) {
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const combo = getCombo(e);
      const typing = isTypingTarget(document.activeElement);

      // F-keys always navigate (except F12 which is handled by F12Panel)
      if (e.key.startsWith("F") && !isNaN(Number(e.key.slice(1)))) {
        const fKey = e.key; // "F1", "F2", etc.
        if (fKey === "F12") return; // F12 is config panel
        if (SHORTCUT_MAP[fKey]) {
          e.preventDefault();
          navigateRef.current(SHORTCUT_MAP[fKey]);
          return;
        }
      }

      // Ctrl/Alt shortcuts work everywhere (even in inputs, but don't break browser defaults)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        // Don't override Ctrl+A (select all), Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+X, Ctrl+S (system save)
        const dangerous = ["A", "C", "V", "Z", "X", "Y", "W", "N", "O", "S", "U", "F", "H", "K"];
        if ((e.ctrlKey || e.metaKey) && dangerous.includes(e.key.toUpperCase())) return;

        if (SHORTCUT_MAP[combo]) {
          e.preventDefault();
          navigateRef.current(SHORTCUT_MAP[combo]);
          return;
        }
      }

      // Single-key shortcuts ONLY when not in a text field
      if (!typing && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        const key = e.key.toUpperCase();
        if (SINGLE_KEY_MAP[key]) {
          e.preventDefault();
          navigateRef.current(SINGLE_KEY_MAP[key]);
        }
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, []);
}
