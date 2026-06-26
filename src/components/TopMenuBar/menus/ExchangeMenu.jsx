import React, { useRef, useEffect } from 'react';
import { RefreshCw, Download, Upload, Wifi, Globe, ScrollText, Lock } from 'lucide-react';
import styles from './ExchangeMenu.module.css';
import { useMenu } from '@/context/MenuContext';
import { usePermissions } from '../hooks/usePermissions';

const EXCHANGE_MENU_ITEMS = [
  { key: 'synchronise',        label: 'Synchronise',         shortcut: 'S', icon: RefreshCw, permission: 'canSync'          },
  { key: 'exchangeImport',     label: 'Import',              shortcut: 'I', icon: Download,  permission: 'canImportData'    },
  { key: 'exchangeExport',     label: 'Export',              shortcut: 'E', icon: Upload,    permission: 'canExportData'    },
  { divider: true },
  { key: 'connectivity',       label: 'Connectivity Settings', shortcut: 'C', icon: Wifi,   permission: 'canConnectivity'  },
  { key: 'onlineExchange',     label: 'Online Exchange',     shortcut: 'O', icon: Globe,     permission: 'canSync'          },
  { key: 'exchangeLogs',       label: 'Exchange Logs',       shortcut: 'L', icon: ScrollText,permission: 'canSync'          },
];

export default function ExchangeMenu() {
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
    <div className={styles.dropdown} ref={menuRef} role="menu" aria-label="Exchange Menu">
      <div className={styles.dropdownHeader}>Exchange / Sync</div>
      {EXCHANGE_MENU_ITEMS.map((item, i) => {
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
