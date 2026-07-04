// src/hooks/useKeyboardShortcuts.ts
import { useState, useEffect, useCallback } from "react";
import { getDB } from "../lib/db";

export interface Shortcut {
  id: number;
  key_combo: string;
  label: string;
  action_type: string;
  action_value: string;
  category: string;
  is_active: boolean;
  description?: string;
}

const DEFAULT_SHORTCUTS: Omit<Shortcut, "id">[] = [
  // Navigation shortcuts
  {
    key_combo: "Alt+1",
    label: "Dashboard",
    action_type: "navigate",
    action_value: "dashboard",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+2",
    label: "Sales Invoice",
    action_type: "navigate",
    action_value: "billing",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+3",
    label: "Purchase Invoice",
    action_type: "navigate",
    action_value: "purchase",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+4",
    label: "Journal Entry",
    action_type: "navigate",
    action_value: "journal",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+5",
    label: "Payment Voucher",
    action_type: "navigate",
    action_value: "payment",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+6",
    label: "Receipt Voucher",
    action_type: "navigate",
    action_value: "receipt",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+7",
    label: "Day Book",
    action_type: "navigate",
    action_value: "day-book",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+8",
    label: "Trial Balance",
    action_type: "navigate",
    action_value: "trial-balance",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+9",
    label: "Balance Sheet",
    action_type: "navigate",
    action_value: "balance-sheet",
    category: "Navigation",
    is_active: true,
  },
  {
    key_combo: "Alt+0",
    label: "Profit & Loss",
    action_type: "navigate",
    action_value: "profit-loss",
    category: "Navigation",
    is_active: true,
  },

  // Report shortcuts
  {
    key_combo: "Ctrl+B",
    label: "Balance Sheet",
    action_type: "navigate",
    action_value: "balance-sheet",
    category: "Reports",
    is_active: true,
  },
  {
    key_combo: "Ctrl+T",
    label: "Trial Balance",
    action_type: "navigate",
    action_value: "trial-balance",
    category: "Reports",
    is_active: true,
  },
  {
    key_combo: "Ctrl+L",
    label: "General Ledger",
    action_type: "navigate",
    action_value: "ledger",
    category: "Reports",
    is_active: true,
  },
  {
    key_combo: "Ctrl+G",
    label: "VAT Reports",
    action_type: "navigate",
    action_value: "vat-reports",
    category: "Reports",
    is_active: true,
  },
  {
    key_combo: "Ctrl+D",
    label: "Day Book",
    action_type: "navigate",
    action_value: "day-book",
    category: "Reports",
    is_active: true,
  },

  // Masters shortcuts
  {
    key_combo: "Ctrl+M",
    label: "Chart of Accounts",
    action_type: "navigate",
    action_value: "accounts",
    category: "Masters",
    is_active: true,
  },
  {
    key_combo: "Ctrl+P",
    label: "Parties Directory",
    action_type: "navigate",
    action_value: "parties",
    category: "Masters",
    is_active: true,
  },
  {
    key_combo: "Ctrl+I",
    label: "Item Master",
    action_type: "navigate",
    action_value: "item-master",
    category: "Masters",
    is_active: true,
  },

  // Voucher shortcuts
  {
    key_combo: "Ctrl+J",
    label: "New Journal Entry",
    action_type: "navigate",
    action_value: "journal",
    category: "Vouchers",
    is_active: true,
  },
  {
    key_combo: "Ctrl+R",
    label: "New Receipt",
    action_type: "navigate",
    action_value: "receipt",
    category: "Vouchers",
    is_active: true,
  },

  // F-key shortcuts (right sidebar style)
  {
    key_combo: "F1",
    label: "Help / Dashboard",
    action_type: "navigate",
    action_value: "dashboard",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F2",
    label: "Save / New Sales",
    action_type: "navigate",
    action_value: "billing",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F3",
    label: "Item Master",
    action_type: "navigate",
    action_value: "item-master",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F4",
    label: "Accounts Master",
    action_type: "navigate",
    action_value: "accounts",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F5",
    label: "Journal Voucher",
    action_type: "navigate",
    action_value: "journal",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F6",
    label: "Payment Voucher",
    action_type: "navigate",
    action_value: "payment",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F7",
    label: "Receipt Voucher",
    action_type: "navigate",
    action_value: "receipt",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F8",
    label: "Contra Voucher",
    action_type: "navigate",
    action_value: "contra",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F9",
    label: "New Sales Invoice",
    action_type: "navigate",
    action_value: "billing",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F10",
    label: "Purchase Invoice",
    action_type: "navigate",
    action_value: "purchase",
    category: "Function Keys",
    is_active: true,
  },
  {
    key_combo: "F11",
    label: "Balance Sheet",
    action_type: "navigate",
    action_value: "balance-sheet",
    category: "Function Keys",
    is_active: true,
  },

  // Quick report shortcuts (right sidebar)
  {
    key_combo: "B",
    label: "Balance Sheet",
    action_type: "navigate",
    action_value: "balance-sheet",
    category: "Quick Keys",
    is_active: true,
  },
  {
    key_combo: "T",
    label: "Trial Balance",
    action_type: "navigate",
    action_value: "trial-balance",
    category: "Quick Keys",
    is_active: true,
  },
  {
    key_combo: "S",
    label: "Stock Status",
    action_type: "navigate",
    action_value: "stock-summary",
    category: "Quick Keys",
    is_active: true,
  },
  {
    key_combo: "L",
    label: "Ledger Report",
    action_type: "navigate",
    action_value: "ledger",
    category: "Quick Keys",
    is_active: true,
  },
  {
    key_combo: "V",
    label: "VAT Report",
    action_type: "navigate",
    action_value: "vat-reports",
    category: "Quick Keys",
    is_active: true,
  },
  {
    key_combo: "D",
    label: "Day Book",
    action_type: "navigate",
    action_value: "day-book",
    category: "Quick Keys",
    is_active: true,
  },
  {
    key_combo: "G",
    label: "GST/VAT Summary",
    action_type: "navigate",
    action_value: "vat-reports",
    category: "Quick Keys",
    is_active: true,
  },
];

// Global state so all hook instances share the same shortcuts
let globalShortcuts: Shortcut[] = [];
let globalListeners: Array<() => void> = [];
let isLoaded = false;

const notifyListeners = () => globalListeners.forEach((fn) => fn());

async function ensureShortcutsLoaded(): Promise<Shortcut[]> {
  if (isLoaded && globalShortcuts.length > 0) return globalShortcuts;

  try {
    const db = getDB();
    // Check if shortcuts table exists
    if (!db.shortcuts) {
      globalShortcuts = DEFAULT_SHORTCUTS.map((s, i) => ({ ...s, id: i + 1 }));
      isLoaded = true;
      return globalShortcuts;
    }

    const existing = await db.shortcuts.toArray().catch(() => []);

    if (!existing || existing.length === 0) {
      // Seed defaults
      const toInsert = DEFAULT_SHORTCUTS.map((s, i) => ({ ...s, id: i + 1 }));
      await db.shortcuts.bulkPut(toInsert).catch(() => {});
      globalShortcuts = toInsert;
    } else {
      globalShortcuts = existing as Shortcut[];
    }
  } catch {
    globalShortcuts = DEFAULT_SHORTCUTS.map((s, i) => ({ ...s, id: i + 1 }));
  }

  isLoaded = true;
  return globalShortcuts;
}

interface UseKeyboardShortcutsReturn {
  rawShortcuts: Shortcut[];
  setShortcuts: React.Dispatch<React.SetStateAction<Shortcut[]>>;
  showHelp: boolean;
  setShowHelp: (v: boolean) => void;
}

export function useKeyboardShortcuts(): UseKeyboardShortcutsReturn {
  const [shortcuts, setShortcutsState] = useState<Shortcut[]>(globalShortcuts);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let mounted = true;

    const listener = () => {
      if (mounted) setShortcutsState([...globalShortcuts]);
    };
    globalListeners.push(listener);

    ensureShortcutsLoaded().then((loaded) => {
      if (mounted) setShortcutsState([...loaded]);
    });

    // Toggle help with ?
    const handleHelp = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowHelp((v) => !v);
      }
    };
    window.addEventListener("keydown", handleHelp);

    return () => {
      mounted = false;
      globalListeners = globalListeners.filter((l) => l !== listener);
      window.removeEventListener("keydown", handleHelp);
    };
  }, []);

  const setShortcuts = useCallback((updater: React.SetStateAction<Shortcut[]>) => {
    setShortcutsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      globalShortcuts = next;
      notifyListeners();
      return next;
    });
  }, []);

  return { rawShortcuts: shortcuts, setShortcuts, showHelp, setShowHelp };
}
