// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useState, useCallback } from "react";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";

export interface Shortcut {
  id: number;
  key_combo: string;
  label: string;
  action_type: string;
  action_value: string;
  category: string;
  is_active: boolean;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 1, key_combo: "Ctrl+N", label: "New Voucher", action_type: "navigate", action_value: "journal", category: "Transactions", is_active: true },
  { id: 2, key_combo: "Ctrl+I", label: "New Invoice", action_type: "navigate", action_value: "billing", category: "Transactions", is_active: true },
  { id: 3, key_combo: "F2", label: "Save", action_type: "save", action_value: "save", category: "General", is_active: true },
  { id: 4, key_combo: "F5", label: "List View", action_type: "navigate", action_value: "vouchers", category: "General", is_active: true },
  { id: 5, key_combo: "?", label: "Shortcuts Panel", action_type: "help", action_value: "shortcuts", category: "General", is_active: true },
  { id: 6, key_combo: "Ctrl+B", label: "Balance Sheet", action_type: "report", action_value: "balance-sheet", category: "Reports", is_active: true },
  { id: 7, key_combo: "Ctrl+T", label: "Trial Balance", action_type: "report", action_value: "trial-balance", category: "Reports", is_active: true },
  { id: 8, key_combo: "Ctrl+P", label: "Parties Directory", action_type: "navigate", action_value: "parties", category: "Masters", is_active: true },
  { id: 9, key_combo: "Ctrl+A", label: "Chart of Accounts", action_type: "navigate", action_value: "accounts", category: "Masters", is_active: true },
  { id: 10, key_combo: "Ctrl+D", label: "Dashboard", action_type: "navigate", action_value: "dashboard", category: "General", is_active: true },
];

let _shortcuts: Shortcut[] = DEFAULT_SHORTCUTS;
let _listeners: Array<(s: Shortcut[]) => void> = [];

function notifyListeners() {
  _listeners.forEach((fn) => fn([..._shortcuts]));
}

export function useKeyboardShortcuts() {
  const { setCurrentPage } = useStore();
  const [rawShortcuts, setRawShortcuts] = useState<Shortcut[]>(_shortcuts);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // Load from DB
    const db = getDB();
    db.shortcuts.toArray().then((dbShortcuts) => {
      if (dbShortcuts.length > 0) {
        _shortcuts = dbShortcuts as Shortcut[];
        setRawShortcuts([..._shortcuts]);
        notifyListeners();
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const listener = (s: Shortcut[]) => setRawShortcuts(s);
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  }, []);

  const setShortcuts = useCallback((updater: ((prev: Shortcut[]) => Shortcut[]) | Shortcut[]) => {
    if (typeof updater === "function") {
      _shortcuts = updater(_shortcuts);
    } else {
      _shortcuts = updater;
    }
    notifyListeners();
  }, []);

  // Map every known action_value → correct page route
  const ACTION_VALUE_TO_PAGE: Record<string, string> = {
    "journal": "journal", "billing": "billing", "vouchers": "vouchers",
    "/help": "dashboard", "/masters": "accounts",
    "dashboard": "dashboard", "accounts": "accounts", "parties": "parties",
    "items": "items", "payment": "payment", "receipt": "receipt",
    "company/settings": "settings", "/company/settings": "settings",
    "/reports/ledger": "ledger",
    "balance_sheet": "balance-sheet", "balance-sheet": "balance-sheet",
    "trial_balance": "trial-balance", "trial-balance": "trial-balance",
    "stock_status": "stock-summary", "stock-status": "stock-summary",
    "acc_summary": "ledger", "acc-summary": "ledger",
    "vat_report": "vat-reports", "vat-report": "vat-reports",
    "day_book": "day-book", "day-book": "day-book",
    "gst_vat_summary": "vat-reports", "gst-vat-summary": "vat-reports",
    "AddAccountModal": "accounts", "AddItemModal": "items",
    "AddVoucherModal": "journal", "AddPaymentModal": "payment",
    "AddReceiptModal": "receipt", "AddJournalModal": "journal",
    "AddSalesModal": "billing", "SwitchUserModal": "dashboard",
    "LockProgramModal": "dashboard",
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Show help panel
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setShowHelp((h) => !h);
        return;
      }

      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

      for (const sc of _shortcuts) {
        if (!sc.is_active) continue;
        const combo = sc.key_combo.toLowerCase();
        const pressed = [
          e.ctrlKey ? "ctrl+" : "",
          e.metaKey ? "meta+" : "",
          e.altKey ? "alt+" : "",
          e.shiftKey && !combo.includes("shift+") ? "" : e.shiftKey ? "shift+" : "",
          e.key.toLowerCase(),
        ].join("");

        const normalizedCombo = combo
          .replace("ctrl+", "ctrl+")
          .replace("meta+", "meta+");

        if (pressed === normalizedCombo || e.key.toLowerCase() === combo) {
          e.preventDefault();
          if (sc.action_type === "save" || sc.action_type === "search") break;
          if (sc.action_type === "help") {
            setShowHelp((h) => !h);
          } else if (sc.action_type === "navigate" || sc.action_type === "report" || sc.action_type === "modal") {
            const av = sc.action_value;
            const page = ACTION_VALUE_TO_PAGE[av] || ACTION_VALUE_TO_PAGE[av.replace(/^\//, "")];
            if (page) setCurrentPage(page);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCurrentPage]);

  return { rawShortcuts, setShortcuts, showHelp, setShowHelp };
}
