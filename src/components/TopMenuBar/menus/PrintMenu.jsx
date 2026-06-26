import React, { useRef, useEffect } from 'react';
import { Printer, Settings, FileBarChart, FileText, SlidersHorizontal, ScrollText, Lock } from 'lucide-react';
import styles from './PrintMenu.module.css';
import { useMenu } from '@/context/MenuContext';
import { useApp } from '@/context/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { detectCurrentContext } from '@/utils/contextDetector';

export default function PrintMenu() {
  const { openModal } = useMenu();
  const { currentScreen, currentDocument } = useApp();
  const { can } = usePermissions();
  const menuRef = useRef(null);
  const ctx = detectCurrentContext(currentScreen, currentDocument);

  useEffect(() => { menuRef.current?.querySelector('button:not(:disabled)')?.focus(); }, []);

  const PRINT_MENU_ITEMS = [
    { key: 'printCurrentScreen', label: ctx.printable ? `Print: ${ctx.label}` : 'Print Current Screen', shortcut: 'P', icon: Printer,            permission: 'canPrint'          },
    { key: 'configurePrint',     label: 'Configure Print',      shortcut: 'C', icon: Settings,           permission: 'canConfigurePrint' },
    { divider: true },
    { key: 'printReports',       label: 'Print Reports',        shortcut: 'R', icon: FileBarChart,       permission: 'canPrint'          },
    { key: 'printVouchers',      label: 'Print Vouchers',       shortcut: 'V', icon: FileText,           permission: 'canPrint'          },
    { divider: true },
    { key: 'printerSettings',    label: 'Printer Settings',     shortcut: 'S', icon: SlidersHorizontal,  permission: 'canConfigurePrint' },
    { key: 'printLogs',          label: 'Print Logs',           shortcut: 'L', icon: ScrollText,         permission: 'canViewPrintLogs'  },
  ];

  const handleItemClick = (item) => {
    if (!can(item.permission)) return;
    openModal(item.key, { context: ctx });
  };

  const handleKeyDown = (e, item) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleItemClick(item);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const buttons = menuRef.current?.querySelectorAll('button:not(:disabled)');
      const arr = Array.from(buttons || []);
      const next = arr[arr.indexOf(document.activeElement) + 1];
      next?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = menuRef.current?.querySelectorAll('button:not(:disabled)');
      const arr = Array.from(buttons || []);
      const prev = arr[arr.indexOf(document.activeElement) - 1];
      prev?.focus();
    }
  };

  return (
    <div
      className={styles.dropdown}
      ref={menuRef}
      role="menu"
      aria-label="Print Menu"
    >
      <div className={styles.dropdownHeader}>Print</div>
      {PRINT_MENU_ITEMS.map((item, i) => {
        if (item.divider) return <div key={`div-${i}`} className={styles.divider}/>;
        const hasPermission = can(item.permission);
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            className={`${styles.menuItem} ${!hasPermission ? styles.disabled : ''}`}
            disabled={!hasPermission}
            onClick={() => handleItemClick(item)}
            onKeyDown={(e) => handleKeyDown(e, item)}
            role="menuitem"
          >
            <span className={styles.itemIcon}><Icon size={14}/></span>
            <span className={styles.itemLabel}>{item.label}</span>
            <span className={styles.itemShortcut}>{item.shortcut}</span>
            {!hasPermission && <Lock size={11} className={styles.lockIcon}/>}
          </button>
        );
      })}
    </div>
  );
}
