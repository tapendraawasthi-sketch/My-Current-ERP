// ─── Global Keyboard Shortcut Manager ─────────────────────────────────────────
// Fixes BUG-035, BUG-036, BUG-038, BUG-039, BUG-040, BUG-042, BUG-043

import { useEffect, useCallback, useRef } from "react";
import { getDB } from "../lib/db";

export interface ShortcutBinding {
  key_combo: string;
  action: string;
  label: string;
  page?: string;
}

/**
 * Normalize a keyboard combo to canonical form.
 * Fixes BUG-038: normalization is consistent.
 * e.g. "ctrl+b" → "Ctrl+B", "F2" → "F2", "escape" → "Escape"
 */
export function normalizeCombo(combo: string): string {
  const parts = combo
    .replace(/\s/g, "")
    .split("+")
    .map((p) => {
      const l = p.toLowerCase();
      if (l === "ctrl" || l === "control") return "Ctrl";
      if (l === "alt")   return "Alt";
      if (l === "shift") return "Shift";
      if (l === "meta" || l === "cmd" || l === "win") return "Meta";
      // Function keys
      if (/^f\d{1,2}$/i.test(l)) return l.charAt(0).toUpperCase() + l.slice(1).toLowerCase().replace("f", "F").replace(l[0], l[0].toUpperCase());
      if (l === "escape") return "Escape";
      if (l === "enter")  return "Enter";
      if (l === "tab")    return "Tab";
      if (l === "delete" || l === "del") return "Delete";
      if (l === "backspace") return "Backspace";
      return p.toUpperCase();
    });
  return parts.join("+");
}

/**
 * Build combo string from a KeyboardEvent.
 */
export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey  || e.metaKey) parts.push("Ctrl");
  if (e.altKey)   parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const key = e.key;
  // Don't add modifier keys themselves as the final key
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
    if (key === "Escape") parts.push("Escape");
    else if (key === "Enter") parts.push("Enter");
    else if (key === "Tab")   parts.push("Tab");
    else if (key === "Delete") parts.push("Delete");
    else if (key === "Backspace") parts.push("Backspace");
    else if (/^F\d{1,2}$/.test(key)) parts.push(key); // F1-F12
    else parts.push(key.toUpperCase());
  }

  return parts.join("+");
}

function isTypingElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export interface UseKeyboardShortcutsOptions {
  onAction: (action: string, combo: string) => void;
  currentPage?: string;
  disabled?: boolean;
}

/**
 * Global keyboard shortcut hook.
 * Loads shortcuts from IndexedDB (with fallback to defaults).
 * Fixes BUG-035, BUG-036, BUG-039, BUG-040.
 */
export function useKeyboardShortcuts({
  onAction,
  currentPage = "*",
  disabled = false,
}: UseKeyboardShortcutsOptions): void {
  const shortcutsRef = useRef<ShortcutBinding[]>([]);
  const onActionRef  = useRef(onAction);
  onActionRef.current = onAction;

  // Load shortcuts from DB once
  useEffect(() => {
    let mounted = true;
    const loadShortcuts = async () => {
      try {
        const db = getDB();
        const dbShortcuts = await db.shortcuts.toArray();
        if (mounted && dbShortcuts.length > 0) {
          shortcutsRef.current = dbShortcuts.map((s) => ({
            key_combo: normalizeCombo(s.key_combo),
            action:    s.action,
            label:     s.label,
            page:      s.page,
          }));
        }
      } catch {
        // Use defaults silently
      }
    };
    loadShortcuts();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as Element;
      const combo  = eventToCombo(e);
      const typing = isTypingElement(target);

      // F-keys and Ctrl combos work even in inputs (except Ctrl+A, Ctrl+C etc.)
      const isFKey    = /^F\d{1,2}$/.test(combo);
      const isCtrl    = combo.startsWith("Ctrl+");
      const isEscape  = combo === "Escape";

      // In typing elements, only allow: F-keys, Escape, Ctrl combos
      if (typing && !isFKey && !isCtrl && !isEscape) return;

      // Find matching shortcut
      const bindings = shortcutsRef.current;
      let found = bindings.find((s) => {
        const normalized = normalizeCombo(s.key_combo);
        if (normalized !== combo) return false;
        if (!s.page || s.page === "*") return true;
        return s.page === currentPage;
      });

      // Fallback to hardcoded defaults if DB has no matching entry
      if (!found) {
        found = getDefaultShortcut(combo, currentPage);
      }

      if (found) {
        // Don't prevent default for typing shortcuts in inputs unless it's a form submit shortcut
        if (!typing || isFKey || isCtrl) {
          e.preventDefault();
        }
        onActionRef.current(found.action, combo);
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [disabled, currentPage]);
}

/**
 * Hardcoded default shortcuts (fallback when DB is empty).
 * Fixes BUG-039: ensures shortcuts work even before DB is seeded.
 */
function getDefaultShortcut(combo: string, page: string): ShortcutBinding | undefined {
  const defaults: ShortcutBinding[] = [
    { key_combo: "F2",      action: "save",          label: "Save",          page: "*"       },
    { key_combo: "F4",      action: "narration",     label: "Narration",     page: "*"       },
    { key_combo: "F5",      action: "refresh",       label: "Refresh",       page: "*"       },
    { key_combo: "F6",      action: "type",          label: "Type/Mode",     page: "*"       },
    { key_combo: "F9",      action: "delete-row",    label: "Delete Row",    page: "*"       },
    { key_combo: "F12",     action: "config",        label: "Config",        page: "*"       },
    { key_combo: "Escape",  action: "cancel",        label: "Cancel",        page: "*"       },
    { key_combo: "Ctrl+B",  action: "balance-sheet", label: "Balance Sheet", page: "*"       },
    { key_combo: "Ctrl+T",  action: "trial-balance", label: "Trial Balance", page: "*"       },
    { key_combo: "Ctrl+L",  action: "ledger",        label: "Ledger",        page: "*"       },
    { key_combo: "Ctrl+G",  action: "vat-reports",   label: "VAT Reports",   page: "*"       },
    { key_combo: "Ctrl+P",  action: "print",         label: "Print",         page: "*"       },
    { key_combo: "Ctrl+E",  action: "export",        label: "Export",        page: "*"       },
    { key_combo: "Ctrl+N",  action: "new",           label: "New",           page: "*"       },
  ];

  return defaults.find((d) => {
    if (d.key_combo !== combo) return false;
    if (!d.page || d.page === "*") return true;
    return d.page === page;
  });
}
