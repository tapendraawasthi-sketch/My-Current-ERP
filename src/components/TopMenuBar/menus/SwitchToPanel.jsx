import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LayoutGrid, Search } from 'lucide-react';
import styles from './GoToPanel.module.css'; // reuse same CSS
import { useMenu } from '@/context/MenuContext';
import { useApp } from '@/context/AppContext';

// Only navigable screens (not modal-actions) are valid for SwitchTo
const SWITCHTO_ITEMS = [
  { label: 'Dashboard',         screen: 'dashboard'        },
  { label: 'Balance Sheet',     screen: 'balanceSheet'     },
  { label: 'Profit & Loss',     screen: 'profitLoss'       },
  { label: 'Trial Balance',     screen: 'trialBalance'     },
  { label: 'Day Book',          screen: 'dayBook'          },
  { label: 'Cash Book',         screen: 'cashBook'         },
  { label: 'Bank Book',         screen: 'bankBook'         },
  { label: 'Ledger',            screen: 'ledger'           },
  { label: 'Sales Register',    screen: 'salesRegister'    },
  { label: 'Purchase Register', screen: 'purchaseRegister' },
  { label: 'Stock Summary',     screen: 'stockSummary'     },
  { label: 'GST Report',        screen: 'gstReport'        },
  { label: 'Sales Voucher',     screen: 'salesVoucher'     },
  { label: 'Purchase Voucher',  screen: 'purchaseVoucher'  },
  { label: 'Payment Voucher',   screen: 'paymentVoucher'   },
  { label: 'Receipt Voucher',   screen: 'receiptVoucher'   },
  { label: 'Journal Voucher',   screen: 'journalVoucher'   },
];

export default function SwitchToPanel() {
  const { closeSwitchTo, switchToQuery, setSwitchToQuery, openModal } = useMenu();
  const { setCurrentScreen, hasUnsavedChanges, setUnsavedChanges } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const q = switchToQuery.trim().toLowerCase();
    return q ? SWITCHTO_ITEMS.filter(i => i.label.toLowerCase().includes(q)) : SWITCHTO_ITEMS;
  }, [switchToQuery]);

  const doSwitch = (item) => {
    setCurrentScreen(item.screen);
    closeSwitchTo();
  };

  const handleSelect = (item) => {
    if (hasUnsavedChanges) {
      openModal('unsavedChanges', {
        onSave: () => { setUnsavedChanges(false); doSwitch(item); },
        onDiscard: () => { setUnsavedChanges(false); doSwitch(item); },
        onCancel: () => {},
      });
    } else {
      doSwitch(item);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { closeSwitchTo(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIndex]) { handleSelect(filtered[selectedIndex]); }
  };

  return (
    <div className={styles.overlay} onClick={closeSwitchTo}>
      <div className={styles.panel} onClick={e => e.stopPropagation()} role="dialog" aria-label="Switch To">
        <div className={styles.searchRow}>
          <LayoutGrid size={16} className={styles.searchIcon}/>
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Switch to screen..."
            value={switchToQuery}
            onChange={e => { setSwitchToQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <span className={styles.escHint}>Esc to close</span>
        </div>
        <div className={styles.results}>
          {filtered.map((item, i) => (
            <button
              key={item.screen}
              className={`${styles.resultItem} ${i === selectedIndex ? styles.selected : ''}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className={styles.resultLabel}>{item.label}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className={styles.noResults}>No screen found for "{switchToQuery}"</div>}
        </div>
      </div>
    </div>
  );
}
