import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

interface Shortcut {
  key: string;
  description: string;
  action: string;
}

const shortcuts: Shortcut[] = [
  { key: "F2", description: "New Sales Invoice", action: "billing" },
  { key: "F4", description: "New Payment Voucher", action: "payment" },
  { key: "F5", description: "New Receipt Voucher", action: "receipt" },
  { key: "F6", description: "New Journal Voucher", action: "journal" },
  { key: "F7", description: "Open POS Mode", action: "pos" },
  { key: "F8", description: "Open Day Book", action: "day-book" },
  { key: "Ctrl+F", description: "Focus Global Search Input", action: "focus-search" },
  { key: "Ctrl+P", description: "Print Report / Document", action: "print" },
  { key: "Ctrl+S", description: "Trigger Save on Open Form", action: "save" },
  { key: "Escape", description: "Close Modal / Popups", action: "escape" },
];

export function useKeyboardShortcuts() {
  const { setCurrentPage } = useStore();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      const ctrl = e.ctrlKey || e.metaKey;

      // Allow Escape even if focused on inputs
      if (e.key === "Escape") {
        e.preventDefault();
        const event = new CustomEvent("erp:escape");
        window.dispatchEvent(event);
        return;
      }

      // Allow Ctrl+S even if focused on inputs
      if (ctrl && e.key === "s") {
        e.preventDefault();
        const event = new CustomEvent("erp:save");
        window.dispatchEvent(event);
        return;
      }

      // Allow Ctrl+F even if focused on inputs
      if (ctrl && e.key === "f") {
        e.preventDefault();
        const input = document.getElementById("global-search-input") as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }

      // Don't trigger other shortcuts if user is typing in an input
      if (isInput) {
        return;
      }

      // F2 - New Sales Invoice
      if (e.key === "F2") {
        e.preventDefault();
        setCurrentPage("billing");
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

      // F7 - POS Mode
      if (e.key === "F7") {
        e.preventDefault();
        setCurrentPage("pos");
      }

      // F8 - Day Book
      if (e.key === "F8") {
        e.preventDefault();
        setCurrentPage("day-book");
      }

      // Ctrl+P - Print
      if (ctrl && e.key === "p") {
        e.preventDefault();
        window.print();
      }

      // ? - Show help modal
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
