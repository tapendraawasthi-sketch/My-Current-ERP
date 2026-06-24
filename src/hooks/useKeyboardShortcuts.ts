import { useEffect, useState } from "react";
import { useStore } from "../store";

export interface Shortcut {
  id: number;
  key_combo: string;
  label: string;
  action_type: string;
  action_value: string;
  category: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

export function useKeyboardShortcuts() {
  const { setCurrentPage } = useStore();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // Fetch shortcuts
    fetch('/api/shortcuts')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setShortcuts(json.data);
        }
      })
      .catch(err => console.error("Failed to load shortcuts", err));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // Only allow Escape to close modals
        if (e.key === "Escape") {
          const modals = document.querySelectorAll('[role="dialog"], .fixed');
          if (modals.length > 0) {
            // We let the modal handle escape if it wants, or we could force close
          }
        }
        return;
      }

      // Reconstruct key combo string
      let pressedCombo = [];
      if (e.ctrlKey) pressedCombo.push("Ctrl");
      if (e.altKey) pressedCombo.push("Alt");
      if (e.shiftKey) pressedCombo.push("Shift");
      
      // Handle letters/function keys
      if (e.key !== "Control" && e.key !== "Alt" && e.key !== "Shift") {
        pressedCombo.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      
      const comboStr = pressedCombo.join("+");

      // ? - Show help
      if (comboStr === "?" || comboStr === "Shift+?") {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Escape - Go back
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      // Match against API shortcuts
      const matched = shortcuts.find(s => s.key_combo.toUpperCase() === comboStr.toUpperCase() && s.is_active);
      
      if (matched) {
        e.preventDefault();
        
        if (matched.action_type === 'navigate') {
          // the db seeded actions with '/reports/ledger' or 'ledger'
          // in the existing app, useStore setCurrentPage uses string IDs like "ledger", "dashboard"
          // We will strip leading slash if present to map to setCurrentPage
          let targetPage = matched.action_value;
          if (targetPage.startsWith('/')) {
            targetPage = targetPage.substring(1);
          }
          // specific mapping for paths in seed
          if (targetPage === 'company/settings') targetPage = 'settings';
          if (targetPage === 'reports/ledger') targetPage = 'ledger';
          
          setCurrentPage(targetPage);
        } else if (matched.action_type === 'report') {
          // e.g. balance_sheet -> balance-sheet
          const pageId = matched.action_value.replace(/_/g, '-');
          setCurrentPage(pageId);
        } else if (matched.action_type === 'modal') {
          // Trigger custom event so modals can listen
          const event = new CustomEvent('open-modal', { detail: { modalName: matched.action_value } });
          window.dispatchEvent(event);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, setCurrentPage]);

  // Map backend format to old format for KeyboardShortcutsHelp in App.tsx
  const formattedShortcuts = shortcuts.map(s => ({
    key: s.key_combo,
    description: s.label,
    action: s.action_value
  }));

  return { shortcuts: formattedShortcuts, rawShortcuts: shortcuts, setShortcuts, showHelp, setShowHelp };
}
