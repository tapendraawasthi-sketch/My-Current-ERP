// src/hooks/useKeyboardShortcuts.ts
/**
 * Global keyboard shortcuts (app-level navigation).
 *
 * IMPORTANT — Tally F-key alignment:
 *   F4  Contra  |  F5  Payment  |  F6  Receipt  |  F7  Journal
 *   F8  Sales   |  F9  Purchase
 *
 * The previous F5 = "List View" assignment conflicted with Tally's F5 = Payment.
 * List view is now accessible via Alt+L or the sidebar.
 */
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getDB } from '../lib/db';

export interface Shortcut {
  id: number;
  key_combo: string;
  label: string;
  action_type: string;
  action_value: string;
  category: string;
  is_active: boolean;
}

// ─── Default shortcuts ────────────────────────────────────────────────────────
// NOTE: F4–F9 are intentionally absent here; they are handled inside
//       useTallyKeyboard (voucher-entry screens) and TallyVoucherPage.
//       Do NOT reassign F4–F9 in this list.
const DEFAULT_SHORTCUTS: Shortcut[] = [
  // General
  { id: 1,  key_combo: 'Ctrl+N',  label: 'New Journal Voucher',  action_type: 'navigate', action_value: 'journal',        category: 'Transactions', is_active: true },
  { id: 2,  key_combo: 'Ctrl+I',  label: 'New Sales Invoice',    action_type: 'navigate', action_value: 'billing',        category: 'Transactions', is_active: true },
  { id: 3,  key_combo: 'F2',      label: 'Save (voucher ctx)',   action_type: 'save',     action_value: 'save',           category: 'General',      is_active: true },
  { id: 4,  key_combo: 'Alt+L',   label: 'Voucher Register',     action_type: 'navigate', action_value: 'vouchers',       category: 'General',      is_active: true },
  { id: 5,  key_combo: '?',       label: 'Shortcuts Panel',      action_type: 'help',     action_value: 'shortcuts',      category: 'General',      is_active: true },
  // Reports
  { id: 6,  key_combo: 'Ctrl+B',  label: 'Balance Sheet',        action_type: 'report',   action_value: 'balance-sheet',  category: 'Reports',      is_active: true },
  { id: 7,  key_combo: 'Ctrl+G',  label: 'Trial Balance',        action_type: 'report',   action_value: 'trial-balance',  category: 'Reports',      is_active: true },
  // Masters
  { id: 8,  key_combo: 'Ctrl+P',  label: 'Parties Directory',    action_type: 'navigate', action_value: 'parties',        category: 'Masters',      is_active: true },
  { id: 9,  key_combo: 'Ctrl+A',  label: 'Chart of Accounts',    action_type: 'navigate', action_value: 'accounts',       category: 'Masters',      is_active: true },
  { id: 10, key_combo: 'Ctrl+D',  label: 'Dashboard',            action_type: 'navigate', action_value: 'dashboard',      category: 'General',      is_active: true },
  // Tally voucher pages (F4-F9 handled in useTallyKeyboard, listed here for help panel display only)
  { id: 11, key_combo: 'F4',      label: 'Contra Voucher',       action_type: 'navigate', action_value: 'contra',         category: 'Vouchers',     is_active: true },
  { id: 12, key_combo: 'F5',      label: 'Payment Voucher',      action_type: 'navigate', action_value: 'payment',        category: 'Vouchers',     is_active: true },
  { id: 13, key_combo: 'F6',      label: 'Receipt Voucher',      action_type: 'navigate', action_value: 'receipt',        category: 'Vouchers',     is_active: true },
  { id: 14, key_combo: 'F7',      label: 'Journal Voucher',      action_type: 'navigate', action_value: 'journal',        category: 'Vouchers',     is_active: true },
  { id: 15, key_combo: 'F8',      label: 'Sales Voucher',        action_type: 'navigate', action_value: 'sales',          category: 'Vouchers',     is_active: true },
  { id: 16, key_combo: 'F9',      label: 'Purchase Voucher',     action_type: 'navigate', action_value: 'purchase',       category: 'Vouchers',     is_active: true },
  { id: 17, key_combo: 'Alt+V',   label: 'Voucher Entry Hub',    action_type: 'navigate', action_value: 'voucher-hub',    category: 'Vouchers',     is_active: true },
  { id: 18, key_combo: 'Alt+F8',  label: 'Sales Voucher (Alt+F8)', action_type: 'navigate', action_value: 'sales-voucher',  category: 'Vouchers',     is_active: true },
  { id: 19, key_combo: 'Alt+F9',  label: 'Purchase Voucher (Alt+F9)', action_type: 'navigate', action_value: 'purchase-voucher', category: 'Vouchers',  is_active: true },
  { id: 20, key_combo: 'Ctrl+F10', label: 'Memorandum Voucher',  action_type: 'navigate', action_value: 'memorandum-voucher', category: 'Vouchers',   is_active: true },
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

  // Load persisted shortcuts from IndexedDB
  useEffect(() => {
    const db = getDB();
    db.shortcuts
      .toArray()
      .then((dbShortcuts) => {
        if (dbShortcuts.length > 0) {
          _shortcuts = dbShortcuts as Shortcut[];
          setRawShortcuts([..._shortcuts]);
          notifyListeners();
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  useEffect(() => {
    const listener = (s: Shortcut[]) => setRawShortcuts(s);
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  }, []);

  const setShortcuts = useCallback(
    (updater: ((prev: Shortcut[]) => Shortcut[]) | Shortcut[]) => {
      _shortcuts = typeof updater === 'function' ? updater(_shortcuts) : updater;
      notifyListeners();
    },
    [],
  );

  // action_value → page route
  const ACTION_VALUE_TO_PAGE: Record<string, string> = {
    journal:        'journal',
    billing:        'billing',
    vouchers:       'vouchers',
    dashboard:      'dashboard',
    accounts:       'accounts',
    parties:        'parties',
    items:          'items',
    payment:        'payment',
    receipt:        'receipt',
    contra:         'contra',
    sales:          'sales',      // ← new
    purchase:       'purchase',   // ← new
    'balance-sheet':'balance-sheet',
    'trial-balance':'trial-balance',
    settings:       'settings',
    'day-book':     'day-book',
    'vat-reports':  'vat-reports',
    'stock-summary':'stock-summary',
    ledger:         'ledger',
    'voucher-hub':  'voucher-hub',
    'sales-voucher': 'sales-voucher',
    'purchase-voucher': 'purchase-voucher',
    'memorandum-voucher': 'memorandum-voucher',
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Help panel toggle
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setShowHelp((h) => !h);
        return;
      }

      if (e.key === 'F11' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          setCurrentPage('f11-company-features');
        }
        return;
      }

      // F4–F9: only fire when NOT inside a tally-shell (they handle themselves)
      const inTallyShell = !!document.querySelector('.tally-shell');
      const fKey = e.key.match(/^F([4-9])$/)?.[0];
      if (fKey && inTallyShell) return; // let useTallyKeyboard handle it

      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      for (const sc of _shortcuts) {
        if (!sc.is_active) continue;

        const combo = sc.key_combo.toLowerCase();
        const pressed = [
          e.ctrlKey  ? 'ctrl+'  : '',
          e.metaKey  ? 'meta+'  : '',
          e.altKey   ? 'alt+'   : '',
          e.shiftKey && combo.includes('shift+') ? 'shift+' : '',
          e.key.toLowerCase(),
        ].join('');

        if (pressed !== combo && e.key.toLowerCase() !== combo) continue;

        e.preventDefault();

        if (sc.action_type === 'save' || sc.action_type === 'search') break;
        if (sc.action_type === 'help') {
          setShowHelp((h) => !h);
        } else if (
          sc.action_type === 'navigate' ||
          sc.action_type === 'report' ||
          sc.action_type === 'modal'
        ) {
          const page =
            ACTION_VALUE_TO_PAGE[sc.action_value] ||
            ACTION_VALUE_TO_PAGE[sc.action_value.replace(/^\//, '')];
          if (page) setCurrentPage(page);
        }
        break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCurrentPage]);

  return { rawShortcuts, setShortcuts, showHelp, setShowHelp };
}
