import { useEffect, useState, useCallback } from "react";
import { useStore } from "../store/useStore";

interface Shortcut {
  key: string;
  description: string;
  category: "navigation" | "global" | "voucher";
}

const globalShortcuts: Shortcut[] = [
  { key: "Alt+J", description: "Journal Voucher", category: "navigation" },
  { key: "Alt+P", description: "Payment Voucher", category: "navigation" },
  { key: "Alt+R", description: "Receipt Voucher", category: "navigation" },
  { key: "Alt+C", description: "Contra Voucher", category: "navigation" },
  { key: "Alt+S", description: "Sales Invoice", category: "navigation" },
  { key: "Alt+U", description: "Purchase Invoice", category: "navigation" },
  { key: "Alt+L", description: "Ledger", category: "navigation" },
  { key: "Alt+T", description: "Trial Balance", category: "navigation" },
  { key: "Alt+B", description: "Balance Sheet", category: "navigation" },
  { key: "Alt+D", description: "Dashboard", category: "navigation" },
  { key: "Ctrl+K", description: "Global Search", category: "global" },
  { key: "F1", description: "Shortcuts Help", category: "global" },
];

const voucherShortcutsList: Shortcut[] = [
  { key: "F2", description: "Save Voucher", category: "voucher" },
  { key: "F4", description: "Pick Narration", category: "voucher" },
  { key: "F9", description: "Delete Row", category: "voucher" },
  { key: "F11", description: "Pick Item / Party", category: "voucher" },
  { key: "F12", description: "Copy Voucher", category: "voucher" },
];

const allShortcuts = [...globalShortcuts, ...voucherShortcutsList];

interface FormHandlers {
  onSave?: () => void;
  onNarrationPick?: () => void;
  onDeleteRow?: () => void;
  onItemPick?: () => void;
  onCopyVoucher?: () => void;
}

// Global active handlers map
let activeFormHandlers: FormHandlers = {};

export function useKeyboardShortcuts() {
  const { setCurrentPage } = useStore();
  const [showHelp, setShowHelp] = useState(false);

  const registerFormShortcuts = useCallback((handlers: FormHandlers) => {
    activeFormHandlers = handlers;
    return () => {
      activeFormHandlers = {};
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Form shortcuts (work even in inputs if applicable)
      if (e.key === "F2") {
        e.preventDefault();
        activeFormHandlers.onSave?.();
        return;
      }
      if (e.key === "F4") {
        if (activeFormHandlers.onNarrationPick) {
          e.preventDefault();
          activeFormHandlers.onNarrationPick();
          return;
        }
      }
      if (e.key === "F9") {
        e.preventDefault();
        activeFormHandlers.onDeleteRow?.();
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        activeFormHandlers.onItemPick?.();
        return;
      }
      if (e.key === "F12") {
        e.preventDefault();
        activeFormHandlers.onCopyVoucher?.();
        return;
      }

      // Help Modal F1
      if (e.key === "F1") {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      // Escape to close help
      if (e.key === "Escape") {
        setShowHelp(false);
        // Let it bubble or dispatch generic event if needed
        return;
      }

      // Ctrl+K for Global Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("global-search-input") as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }

      // If user is typing in an input, don't trigger global navigation shortcuts
      if (isInput) return;

      // Alt+ Navigation Shortcuts
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case "j":
            e.preventDefault();
            setCurrentPage("journal");
            break;
          case "p":
            e.preventDefault();
            setCurrentPage("payment");
            break;
          case "r":
            e.preventDefault();
            setCurrentPage("receipt");
            break;
          case "c":
            e.preventDefault();
            setCurrentPage("contra");
            break;
          case "s":
            e.preventDefault();
            setCurrentPage("sales-invoice");
            break;
          case "u":
            e.preventDefault();
            setCurrentPage("purchase-invoice");
            break;
          case "l":
            e.preventDefault();
            setCurrentPage("ledger");
            break;
          case "t":
            e.preventDefault();
            setCurrentPage("trial-balance");
            break;
          case "b":
            e.preventDefault();
            setCurrentPage("balance-sheet");
            break;
          case "d":
            e.preventDefault();
            setCurrentPage("dashboard");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setCurrentPage]);

  return { shortcuts: allShortcuts, showHelp, setShowHelp, registerFormShortcuts };
}
