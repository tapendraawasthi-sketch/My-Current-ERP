import React, { useRef, useEffect } from 'react';
import { Mail, MessageCircle, Link, UserCheck, Settings2, ScrollText, Lock } from 'lucide-react';
import styles from './ShareMenu.module.css';
import { useMenu } from '@/context/MenuContext';
import { useApp } from '@/context/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { detectCurrentContext } from '@/utils/contextDetector';

export default function ShareMenu() {
  const { openModal } = useMenu();
  const { currentScreen, currentDocument } = useApp();
  const { can } = usePermissions();
  const menuRef = useRef(null);
  const ctx = detectCurrentContext(currentScreen, currentDocument);

  useEffect(() => { menuRef.current?.querySelector('button:not(:disabled)')?.focus(); }, []);

  const SHARE_MENU_ITEMS = [
    { key: 'emailShare',         label: ctx.shareable ? `Email: ${ctx.label}` : 'Email Current Report/Voucher', shortcut: 'E', icon: Mail,          permission: 'canEmailShare'       },
    { key: 'whatsappShare',      label: 'WhatsApp Share',               shortcut: 'W', icon: MessageCircle, permission: 'canWhatsAppShare'    },
    { key: 'shareLink',          label: 'Generate Share Link',          shortcut: 'L', icon: Link,          permission: 'canGenerateShareLink'},
    { key: 'shareWithUser',      label: 'Share with Internal User',     shortcut: 'S', icon: UserCheck,     permission: 'canShareWithUser'    },
    { divider: true },
    { key: 'emailSettings',      label: 'Email Settings',               shortcut: 'T', icon: Settings2,     permission: 'canEmailShare'       },
    { key: 'shareHistory',       label: 'Share History',                shortcut: 'H', icon: ScrollText,    permission: 'canViewShareHistory' },
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
      aria-label="Share Menu"
    >
      <div className={styles.dropdownHeader}>Share / E-mail</div>
      {SHARE_MENU_ITEMS.map((item, i) => {
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
