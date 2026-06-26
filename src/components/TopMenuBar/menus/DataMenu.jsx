import React, { useRef, useEffect } from 'react';
import { HardDrive, RotateCcw, GitBranch, Scissors, Wrench, Cloud, Lock } from 'lucide-react';
import styles from './DataMenu.module.css';
import { useMenu } from '../context/MenuContext';
import { usePermissions } from '../hooks/usePermissions';

const DATA_MENU_ITEMS = [
  { key: 'backup',       label: 'Backup',              shortcut: 'B', icon: HardDrive,  permission: 'canBackup'      },
  { key: 'restore',      label: 'Restore',             shortcut: 'R', icon: RotateCcw,  permission: 'canRestore'     },
  { key: 'migrate',      label: 'Migrate',             shortcut: 'M', icon: GitBranch,  permission: 'canMigrate'     },
  { divider: true },
  { key: 'splitCompany', label: 'Split Company Data',  shortcut: 'S', icon: Scissors,   permission: 'canSplitData'   },
  { key: 'repair',       label: 'Repair',              shortcut: 'P', icon: Wrench,     permission: 'canRepair'      },
  { divider: true },
  { key: 'cloudBackup',  label: 'Cloud Backup',        shortcut: 'C', icon: Cloud,      permission: 'canCloudBackup' },
];

export default function DataMenu() {
  const { openModal, closeMenu } = useMenu();
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
    <div className={styles.dropdown} ref={menuRef} role="menu" aria-label="Data Menu">
      <div className={styles.dropdownHeader}>Data Management</div>
      {DATA_MENU_ITEMS.map((item, i) => {
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
