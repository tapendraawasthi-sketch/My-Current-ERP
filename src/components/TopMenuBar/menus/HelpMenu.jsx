import React, { useRef, useEffect } from 'react';
import { BookOpen, ArrowUp, Wrench, Settings, Puzzle, Headphones, Info, Globe, Lock } from 'lucide-react';
import styles from './HelpMenu.module.css';
import { useMenu } from '@/context/MenuContext';
import { usePermissions } from '../hooks/usePermissions';

const HELP_MENU_ITEMS = [
  { key: 'openHelp',      label: 'Open Help',         shortcut: 'F1',     icon: BookOpen,    permission: 'canOpenHelp'          },
  { key: 'onlineHelp',    label: 'Online Help',        shortcut: 'Ctrl+F1',icon: Globe,      permission: 'canOpenHelp'          },
  { divider: true },
  { key: 'upgrade',       label: 'Upgrade',            shortcut: 'U',      icon: ArrowUp,    permission: 'canUpgrade'           },
  { key: 'troubleshoot',  label: 'Troubleshoot',       shortcut: 'T',      icon: Wrench,     permission: 'canTroubleshoot'      },
  { key: 'appSettings',   label: 'Settings',           shortcut: 'S',      icon: Settings,   permission: 'canSettings'          },
  { divider: true },
  { key: 'addonManager',  label: 'Add-On Manager',     shortcut: 'A',      icon: Puzzle,     permission: 'canAddOnManagement'   },
  { key: 'contactSupport',label: 'Contact Support',    shortcut: 'C',      icon: Headphones, permission: 'canContactSupport'    },
  { divider: true },
  { key: 'about',         label: 'About',              shortcut: 'B',      icon: Info,       permission: 'canOpenHelp'          },
];

export default function HelpMenu() {
  const { openModal, closeMenu } = useMenu();
  const { can } = usePermissions();
  const menuRef = useRef(null);

  useEffect(() => {
    menuRef.current?.querySelector('button:not(:disabled)')?.focus();
  }, []);

  const handleItemClick = (item) => {
    if (!can(item.permission)) return;
    if (item.key === 'onlineHelp') {
      window.open('https://help.example.com', '_blank');
      closeMenu();
    } else {
      openModal(item.key);
    }
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
    <div className={styles.dropdown} ref={menuRef} role="menu" aria-label="Help Menu" style={{ right: 0, left: 'auto' }}>
      <div className={styles.dropdownHeader}>Help & Support</div>
      {HELP_MENU_ITEMS.map((item, i) => {
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
