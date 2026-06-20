import { useEffect, useState } from "react";
import { useStore } from "../store";

interface Shortcut {
  key: string;
  description: string;
  action: string;
}

const shortcuts: Shortcut[] = [
  { key: "Ctrl+D", description: "Dashboard", action: "dashboard" },
  { key: "F2", description: "New Sales Invoice", action: "sales-invoice" },
  { key: "F3", description: "New Purchase Invoice", action: "purchase-invoice" },
  { key: "F4", description: "New Payment Voucher", action: "payment" },
  { key: "F5", description: "New Receipt Voucher", action: "receipt" },
  { key: "F6", description: "New Journal Voucher", action: "journal" },
  { key: "F7", description: "New Contra Voucher", action: "contra" },
  { key: "Ctrl+L", description: "General Ledger", action: "ledger" },
  { key: "Ctrl+T", description: "Trial Balance", action: "trial-balance" },
  { key: "Ctrl+U", description: "Users", action: "users" },
  { key: "Ctrl+S", description: "Settings", action: "settings" },
  { key: "Ctrl+B", description: "Balance Sheet", action: "balance-sheet" },
  { key: "Ctrl+P", description: "Print", action: "print" },
  { key: "Ctrl+E", description: "Export", action: "export" },
  { key: "Escape", description: "Go Back / Close Modal", action: "escape" },
];

export function useKeyboardShortcuts() {
  const { setCurrentPage } = useStore();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+D - Dashboard
      if (ctrl && e.key === "d") {
        e.preventDefault();
        setCurrentPage("dashboard");
      }

      // F2 - Sales Invoice
      if (e.key === "F2") {
        e.preventDefault();
        setCurrentPage("sales-invoice");
      }

      // F3 - Purchase Invoice
      if (e.key === "F3") {
        e.preventDefault();
        setCurrentPage("purchase-invoice");
      }

      // F4 - Payment
      if (e.key === "F4") {
        e.preventDefault();
        setCurrentPage("payment");
      }

      // F5 - Receipt
      if (e.key === "F5") {
        e.preventDefault();
        setCurrentPage("receipt");
      }

      // F6 - Journal
      if (e.key === "F6") {
        e.preventDefault();
        setCurrentPage("journal");
      }

      // F7 - Contra
      if (e.key === "F7") {
        e.preventDefault();
        setCurrentPage("contra");
      }

      // Ctrl+L - Ledger
      if (ctrl && e.key === "l") {
        e.preventDefault();
        setCurrentPage("ledger");
      }

      // Ctrl+T - Trial Balance
      if (ctrl && e.key === "t") {
        e.preventDefault();
        setCurrentPage("trial-balance");
      }

      // Ctrl+U - Users
      if (ctrl && e.key === "u") {
        e.preventDefault();
        setCurrentPage("users");
      }

      // Ctrl+S - Settings
      if (ctrl && e.key === "s") {
        e.preventDefault();
        setCurrentPage("settings");
      }

      // Ctrl+B - Balance Sheet
      if (ctrl && e.key === "b") {
        e.preventDefault();
        setCurrentPage("balance-sheet");
      }

      // Ctrl+P - Print
      if (ctrl && e.key === "p") {
        e.preventDefault();
        window.print();
      }

      // Ctrl+E - Export (placeholder)
      if (ctrl && e.key === "e") {
        e.preventDefault();
        console.log("Export triggered");
      }

      // Escape - Go back
      if (e.key === "Escape") {
        // Check if any modals are open, close them
        const modals = document.querySelectorAll('[role="dialog"]');
        if (modals.length > 0) {
          e.preventDefault();
        }
      }

      // ? - Show help
      if (e.key === "?" && !ctrl) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setCurrentPage]);

  return { shortcuts, showHelp, setShowHelp };
}
