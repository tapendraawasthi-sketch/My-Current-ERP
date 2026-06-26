import React, { useRef, useEffect } from 'react';
import { Monitor, BookOpen, FileText, BarChart2, Settings, ScrollText } from 'lucide-react';
import styles from './ExportMenu.module.css';
import { useMenu } from '@/context/MenuContext';
import { useApp } from '@/context/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { detectCurrentContext } from '@/utils/contextDetector';

export default function ExportMenu() {
  const { openModal, closeMenu } = useMenu();
  const { currentScreen, currentDocument } = useApp();
  const { can } = usePermissions();
  const menuRef = useRef(null);
  const ctx = detectCurrentContext(currentScreen, currentDocument);

  useEffect(() => { menuRef.current?.querySelector('button:not(:disabled)')?.focus(); }, []);

  const EXPORT_MENU_ITEMS = [
    {
      key: 'exportCurrentScreen',
      // DYNAMIC LABEL based on context
      label: ctx.exportable ? `Export ${ctx.label}` : 'Export Current Screen',
      shortcut: 'E',
      icon: Monitor,
      permission: 'canExportCurrentScreen',
      disabled: !ctx.exportable,
    },
    { divider: true },
    { key: 'exportMasters',      label: 'Export Masters',      shortcut: 'M', icon: BookOpen,  permission: 'canExportMasters'      },
    { key: 'exportTransactions', label: 'Export Transactions', shortcut: 'T', icon: FileText,  permission: 'canExportTransactions' },
    { key: 'exportReports',      label: 'Export Reports',      shortcut: 'R', icon: BarChart2, permission: 'canExportReports'      },
    { divider: true },
    { key: 'exportFormatSettings', label: 'Export Format Settings', shortcut: 'F', icon: Settings, permission: 'canExportReports' },
    { key: 'exportLogs',         label: 'Export Logs',         shortcut: 'L', icon: ScrollText, permission: 'canViewExportLogs'   },
  ];

  const handleItemClick = (item) => {
    if (!can(item.permission) || item.disabled) return;
    openModal(item.key, { context: ctx });
  };

  return (
    <div
      className={styles.dropdown}
      ref={menuRef}
      role="menu"
      aria-label="Export Menu"
      style={{ left: '420px' }} /* Position under Export button — adjust to match actual button offset */
    >
      <div className={styles.dropdownHeader}>Export</div>
      {EXPORT_MENU_ITEMS.map((item, i) => {
        if (item.divider) return <div key={`div-${i}`} className={styles.divider}/>;
        const hasPermission = can(item.permission) && !item.disabled;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            className={`${styles.menuItem} ${!hasPermission ? styles.disabled : ''}`}
            disabled={!hasPermission}
            onClick={() => handleItemClick(item)}
            role="menuitem"
          >
            <span className={styles.itemIcon}><Icon size={14}/></span>
            <span className={styles.itemLabel}>{item.label}</span>
            <span className={styles.itemShortcut}>{item.shortcut}</span>
          </button>
        );
      })}
    </div>
  );
}
