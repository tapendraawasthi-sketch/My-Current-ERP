import React, { useRef, useEffect } from 'react';
import { Users, FileText, Landmark, Package, UserSquare, FileInput, Truck, ScrollText, Lock } from 'lucide-react';
import styles from './ImportMenu.module.css';
import { useMenu } from '@/context/MenuContext';
import { usePermissions } from '../hooks/usePermissions';

const IMPORT_MENU_ITEMS = [
  { key: 'importMasters',       label: 'Import Masters',        shortcut: 'M', icon: Users,       permission: 'canImportMasters'        },
  { key: 'importTransactions',  label: 'Import Transactions',   shortcut: 'T', icon: FileText,    permission: 'canImportTransactions'   },
  { key: 'importBankStatements',label: 'Import Bank Statements',shortcut: 'B', icon: Landmark,    permission: 'canImportBankStatements' },
  { divider: true },
  { key: 'importInventory',     label: 'Import Inventory Data', shortcut: 'I', icon: Package,     permission: 'canImportMasters'        },
  { key: 'importPayroll',       label: 'Import Payroll Data',   shortcut: 'P', icon: UserSquare,  permission: 'canImportMasters'        },
  { divider: true },
  { key: 'importEInvoice',      label: 'Upload / Import E-Invoices', shortcut: 'E', icon: FileInput, permission: 'canImportEInvoice'  },
  { key: 'importEWayBill',      label: 'Upload / Import E-Way Bills', shortcut: 'W', icon: Truck, permission: 'canImportEWayBill'    },
  { divider: true },
  { key: 'importLogs',          label: 'Import Logs',           shortcut: 'L', icon: ScrollText,  permission: 'canViewImportLogs'       },
];

export default function ImportMenu() {
  const { openModal } = useMenu();
  const { can } = usePermissions();
  const menuRef = useRef(null);

  useEffect(() => {
    menuRef.current?.querySelector('button:not(:disabled)')?.focus();
  }, []);

  const handleItemClick = (item) => {
    if (!can(item.permission)) return;
    openModal(item.key);
  };

  const handleKeyDown = (e, item, index) => {
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
    <div className={styles.dropdown} ref={menuRef} role="menu" aria-label="Import Menu">
      <div className={styles.dropdownHeader}>Import Data</div>
      {IMPORT_MENU_ITEMS.map((item, i) => {
        if (item.divider) return <div key={`div-${i}`} className={styles.divider}/>;
        const hasPermission = can(item.permission);
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            className={`${styles.menuItem} ${!hasPermission ? styles.disabled : ''}`}
            role="menuitem"
            disabled={!hasPermission}
            onClick={() => handleItemClick(item)}
            onKeyDown={(e) => handleKeyDown(e, item, i)}
            title={!hasPermission ? 'You do not have permission to access this option.' : ''}
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
