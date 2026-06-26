// src/hooks/useTallyKeyboard.ts
import { useEffect, useCallback } from 'react';

/**
 * All keyboard actions exposed by Tally Prime voucher screens.
 * Consumers pass only the handlers they need; unset ones are ignored.
 */
export interface KeyboardActionMap {
  // ── Function keys (voucher switching) ──────────────────────────────────────
  onF2?: () => void;       // Date change
  onF3?: () => void;       // Company selector
  onF4?: () => void;       // Contra Voucher
  onF5?: () => void;       // Payment Voucher
  onF6?: () => void;       // Receipt Voucher
  onF7?: () => void;       // Journal Voucher
  onF8?: () => void;       // Sales Voucher      ← new
  onF9?: () => void;       // Purchase Voucher   ← new
  onF10?: () => void;      // List / F10 browse
  onF12?: () => void;      // Configure (F12 panel)
  // ── Ctrl combos ────────────────────────────────────────────────────────────
  onCtrlA?: () => void;    // Accept / Save
  onCtrlD?: () => void;    // Duplicate row
  onCtrlH?: () => void;    // Toggle entry mode (Single ↔ Double; Invoice ↔ Voucher)
  onCtrlI?: () => void;    // Toggle Item ↔ Accounting Invoice mode (Alt+I alias)
  onCtrlT?: () => void;    // Mark as Post-Dated  ← new
  onCtrlL?: () => void;    // Mark as Optional    ← new
  onCtrlR?: () => void;    // Recall last narration for same voucher type ← new
  onCtrlV?: () => void;    // Toggle Invoice ↔ Voucher mode ← new
  // ── Alt combos ─────────────────────────────────────────────────────────────
  onAltC?: () => void;     // Create Ledger on-the-fly (Alt+C)
  onAltD?: () => void;     // Delete voucher      ← new
  onAltX?: () => void;     // Cancel voucher      ← new
  onAltR?: () => void;     // Recall last narration for same party ← new
  onAltI?: () => void;     // Toggle Item ↔ Accounting Invoice    ← new
  onAltJ?: () => void;     // Stat / GST adjustments              ← new
  onAltS?: () => void;     // Stock query                         ← new
  onAltA?: () => void;     // Add row (Alt+A)                     ← new
  // ── Navigation ─────────────────────────────────────────────────────────────
  onEscape?: () => void;   // Cancel / back
  onEnter?: () => void;    // Generic confirm / next field
  onDown?: () => void;     // Next row
  onUp?: () => void;       // Previous row
  onTab?: () => void;      // Next cell
  onShiftTab?: () => void; // Previous cell
}

/**
 * Attaches a single keydown listener on `window` and routes to the matching
 * handler.  All handlers that could fire from inside an input are guard-checked
 * so normal typing is never interrupted.
 *
 * @param actions  Map of callback functions (only set what you need)
 * @param enabled  Pass `false` to temporarily disable (e.g. while a modal is open)
 */
export const useTallyKeyboard = (
  actions: KeyboardActionMap,
  enabled = true,
): void => {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        (e.target as HTMLElement)?.isContentEditable;

      const key  = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const alt  = e.altKey;
      const shift = e.shiftKey;

      // Allow normal typing unless a global combo key is pressed
      if (
        isTyping &&
        !(ctrl || alt ||
          key === 'Escape' ||
          key.startsWith('F') // all F-keys pass through
        )
      ) {
        return;
      }

      /** Prevent default and call `cb` if it is defined */
      const fire = (cb?: () => void) => {
        if (cb) {
          e.preventDefault();
          e.stopPropagation();
          cb();
        }
      };

      // ── Function keys ────────────────────────────────────────────────────
      if (key === 'F2'  && !ctrl && !alt) { fire(actions.onF2);  return; }
      if (key === 'F3'  && !ctrl && !alt) { fire(actions.onF3);  return; }
      if (key === 'F4'  && !ctrl && !alt) { fire(actions.onF4);  return; }
      if (key === 'F5'  && !ctrl && !alt) { fire(actions.onF5);  return; }
      if (key === 'F6'  && !ctrl && !alt) { fire(actions.onF6);  return; }
      if (key === 'F7'  && !ctrl && !alt) { fire(actions.onF7);  return; }
      if (key === 'F8'  && !ctrl && !alt) { fire(actions.onF8);  return; }  // ← new
      if (key === 'F9'  && !ctrl && !alt) { fire(actions.onF9);  return; }  // ← new
      if (key === 'F10' && !ctrl && !alt) { fire(actions.onF10); return; }
      if (key === 'F12' && !ctrl && !alt) { fire(actions.onF12); return; }

      // ── Escape ───────────────────────────────────────────────────────────
      if (key === 'Escape') { fire(actions.onEscape); return; }

      // ── Ctrl combos ──────────────────────────────────────────────────────
      if (ctrl && !alt && !shift) {
        switch (key.toLowerCase()) {
          case 'a':      fire(actions.onCtrlA); return;
          case 'enter':  fire(actions.onCtrlA); return; // Ctrl+Enter alias
          case 'd':      fire(actions.onCtrlD); return;
          case 'h':      fire(actions.onCtrlH); return;
          case 'i':      fire(actions.onCtrlI); return;
          case 't':      fire(actions.onCtrlT); return; // ← new Post-Dated
          case 'l':      fire(actions.onCtrlL); return; // ← new Optional
          case 'r':      fire(actions.onCtrlR); return; // ← new Recall narration
          case 'v':      fire(actions.onCtrlV); return; // ← new Invoice/Voucher
          default:       break;
        }
      }

      // Ctrl+Enter as accept
      if (key === 'Enter' && ctrl) { fire(actions.onCtrlA); return; }

      // ── Alt combos ───────────────────────────────────────────────────────
      if (alt && !ctrl) {
        switch (key.toLowerCase()) {
          case 'c':      fire(actions.onAltC); return;
          case 'd':      fire(actions.onAltD); return; // ← new Delete
          case 'x':      fire(actions.onAltX); return; // ← new Cancel
          case 'r':      fire(actions.onAltR); return; // ← new Recall (party)
          case 'i':      fire(actions.onAltI); return; // ← new Item/Acctg toggle
          case 'j':      fire(actions.onAltJ); return; // ← new Stat adjust
          case 's':      fire(actions.onAltS); return; // ← new Stock query
          case 'a':      fire(actions.onAltA); return; // ← new Add row
          default:       break;
        }
      }

      // ── Enter / navigation ───────────────────────────────────────────────
      if (key === 'Enter' && !ctrl && !shift) { fire(actions.onEnter);    return; }
      if (key === 'ArrowDown')                { fire(actions.onDown);     return; }
      if (key === 'ArrowUp')                  { fire(actions.onUp);       return; }
      if (key === 'Tab' && shift)             { fire(actions.onShiftTab); return; }
      if (key === 'Tab' && !shift)            { fire(actions.onTab);      return; }
    },
    // Recreate handler only when the actions reference or enabled flag changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...Object.values(actions)],
  );

  useEffect(() => {
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handler]);
};
