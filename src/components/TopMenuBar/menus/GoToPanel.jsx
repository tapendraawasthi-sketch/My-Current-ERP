import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Clock, ChevronRight } from 'lucide-react';
import styles from './GoToPanel.module.css';
import { useMenu } from '../context/MenuContext';
import { useApp } from '../context/AppContext';
import { usePermissions } from '../hooks/usePermissions';

// Master list of all navigable items
const ALL_GOTO_ITEMS = [
  // Reports
  { label: 'Balance Sheet',    category: 'Reports',  screen: 'balanceSheet',    action: 'navigate' },
  { label: 'Profit & Loss',    category: 'Reports',  screen: 'profitLoss',      action: 'navigate' },
  { label: 'Trial Balance',    category: 'Reports',  screen: 'trialBalance',    action: 'navigate' },
  { label: 'Day Book',         category: 'Reports',  screen: 'dayBook',         action: 'navigate' },
  { label: 'Cash Book',        category: 'Reports',  screen: 'cashBook',        action: 'navigate' },
  { label: 'Bank Book',        category: 'Reports',  screen: 'bankBook',        action: 'navigate' },
  { label: 'Ledger',           category: 'Reports',  screen: 'ledger',          action: 'navigate' },
  { label: 'Sales Register',   category: 'Reports',  screen: 'salesRegister',   action: 'navigate' },
  { label: 'Purchase Register',category: 'Reports',  screen: 'purchaseRegister',action: 'navigate' },
  { label: 'Stock Summary',    category: 'Reports',  screen: 'stockSummary',    action: 'navigate' },
  { label: 'GST Report',       category: 'Reports',  screen: 'gstReport',       action: 'navigate' },
  { label: 'Cash Flow',        category: 'Reports',  screen: 'cashFlow',        action: 'navigate' },
  // Vouchers
  { label: 'Sales Voucher',    category: 'Vouchers', screen: 'salesVoucher',    action: 'navigate' },
  { label: 'Purchase Voucher', category: 'Vouchers', screen: 'purchaseVoucher', action: 'navigate' },
  { label: 'Payment Voucher',  category: 'Vouchers', screen: 'paymentVoucher',  action: 'navigate' },
  { label: 'Receipt Voucher',  category: 'Vouchers', screen: 'receiptVoucher',  action: 'navigate' },
  { label: 'Journal Voucher',  category: 'Vouchers', screen: 'journalVoucher',  action: 'navigate' },
  { label: 'Contra Voucher',   category: 'Vouchers', screen: 'contraVoucher',   action: 'navigate' },
  { label: 'Debit Note',       category: 'Vouchers', screen: 'debitNote',       action: 'navigate' },
  { label: 'Credit Note',      category: 'Vouchers', screen: 'creditNote',      action: 'navigate' },
  // Masters
  { label: 'Create Ledger',    category: 'Masters',  screen: 'createLedger',    action: 'modal', modal: 'createLedger' },
  { label: 'Alter Ledger',     category: 'Masters',  screen: 'alterLedger',     action: 'modal', modal: 'alterLedger'  },
  { label: 'Create Stock Item',category: 'Masters',  screen: 'createStockItem', action: 'modal', modal: 'createStockItem'},
  { label: 'Create Customer',  category: 'Masters',  screen: 'createCustomer',  action: 'modal', modal: 'createCustomer'},
  { label: 'Create Supplier',  category: 'Masters',  screen: 'createSupplier',  action: 'modal', modal: 'createSupplier'},
  // Actions
  { label: 'Backup',           category: 'Actions',  screen: null,              action: 'modal', modal: 'backup'        },
  { label: 'Restore',          category: 'Actions',  screen: null,              action: 'modal', modal: 'restore'       },
  { label: 'Export',           category: 'Actions',  screen: null,              action: 'menu',  menu: 'export'         },
  { label: 'Import',           category: 'Actions',  screen: null,              action: 'menu',  menu: 'import'         },
  { label: 'Company Features', category: 'Actions',  screen: null,              action: 'modal', modal: 'companyFeatures'},
  { label: 'Security Control', category: 'Actions',  screen: null,              action: 'modal', modal: 'securityControl'},
];

export default function GoToPanel() {
  const { closeGoTo, openModal, openMenu, addRecentAction, recentActions, goToQuery, setGoToQuery } = useMenu();
  const { setCurrentScreen } = useApp();
  const { can } = usePermissions();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const q = goToQuery.trim().toLowerCase();
    if (!q) {
      // Show recent actions first when no query
      const recents = recentActions.map(r => ({ ...r, isRecent: true }));
      return recents.length ? recents : ALL_GOTO_ITEMS.slice(0, 8);
    }
    return ALL_GOTO_ITEMS.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [goToQuery, recentActions]);

  const handleSelect = (item) => {
    addRecentAction({ label: item.label, screen: item.screen, category: item.category });
    if (item.action === 'navigate' && item.screen) {
      setCurrentScreen(item.screen);
    } else if (item.action === 'modal' && item.modal) {
      openModal(item.modal);
    } else if (item.action === 'menu' && item.menu) {
      openMenu(item.menu);
    }
    closeGoTo();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { closeGoTo(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  // Group by category for display
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((item, idx) => {
      const cat = item.isRecent ? 'Recent' : item.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push({ ...item, _idx: idx });
    });
    return map;
  }, [filtered]);

  return (
    <div className={styles.overlay} onClick={closeGoTo}>
      <div className={styles.panel} onClick={e => e.stopPropagation()} role="dialog" aria-label="Go To">
        <div className={styles.searchRow}>
          <Search size={16} className={styles.searchIcon}/>
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search reports, vouchers, masters, actions..."
            value={goToQuery}
            onChange={e => { setGoToQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            aria-label="Go To search"
          />
          <span className={styles.escHint}>Esc to close</span>
        </div>
        <div className={styles.results}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className={styles.categoryLabel}>
                {cat === 'Recent' ? <><Clock size={11}/> Recent</> : cat}
              </div>
              {items.map((item) => (
                <button
                  key={item.label}
                  className={`${styles.resultItem} ${item._idx === selectedIndex ? styles.selected : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(item._idx)}
                >
                  <span className={styles.resultLabel}>{item.label}</span>
                  <ChevronRight size={13} className={styles.chevron}/>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className={styles.noResults}>No results for "{goToQuery}"</div>
          )}
        </div>
      </div>
    </div>
  );
}
