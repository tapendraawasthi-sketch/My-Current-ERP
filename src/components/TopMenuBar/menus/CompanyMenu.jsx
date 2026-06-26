import React, { useRef, useEffect } from 'react';
import {
  Building2, Plus, Edit, X, RefreshCw, Shield, Users,
  UserCheck, Lock, Settings, CreditCard, ChevronRight
} from 'lucide-react';
import styles from './CompanyMenu.module.css';
import { useMenu } from '@/context/MenuContext';
import { useApp } from '@/context/AppContext';
import { usePermissions } from '../hooks/usePermissions';

const COMPANY_MENU_ITEMS = [
  {
    key: 'selectCompany',   label: 'Select Company',     shortcut: 'F3',      icon: Building2,    permission: 'canSelectCompany'    },
  { key: 'createCompany',  label: 'Create Company',     shortcut: 'C',       icon: Plus,         permission: 'canCreateCompany'    },
  { key: 'alterCompany',   label: 'Alter Company',      shortcut: 'A',       icon: Edit,         permission: 'canAlterCompany'     },
  { key: 'shutCompany',    label: 'Shut Company',       shortcut: 'Ctrl+F3', icon: X,            permission: 'canShutCompany'      },
  { key: 'changeCompany',  label: 'Change Company',     shortcut: 'H',       icon: RefreshCw,    permission: 'canChangeCompany'    },
  { divider: true },
  { key: 'securityControl',label: 'Security Control',   shortcut: 'S',       icon: Shield,       permission: 'canSecurityControl'  },
  { key: 'userRoles',      label: 'User Roles',         shortcut: 'R',       icon: Users,        permission: 'canManageUserRoles'  },
  { key: 'changeUser',     label: 'Change User',        shortcut: 'U',       icon: UserCheck,    permission: 'canChangeUser'       },
  { divider: true },
  { key: 'dataEncryption', label: 'Data Encryption',    shortcut: 'V',       icon: Lock,         permission: 'canDataEncryption'   },
  { key: 'companyFeatures',label: 'Company Features',   shortcut: 'F11',     icon: Settings,     permission: 'canCompanyFeatures'  },
  { key: 'licensing',      label: 'Licensing',          shortcut: 'L',       icon: CreditCard,   permission: 'canLicensing'        },
];

export default function CompanyMenu() {
  const { openModal, closeMenu } = useMenu();
  const { activeCompany } = useApp();
  const { can } = usePermissions();
  const menuRef = useRef(null);

  // Trap keyboard navigation within the dropdown
  useEffect(() => {
    menuRef.current?.querySelector('button:not(:disabled)')?.focus();
  }, []);

  const handleItemClick = (item) => {
    if (!can(item.permission)) return;
    // Items that require an active company
    const requiresCompany = ['alterCompany','shutCompany','dataEncryption','companyFeatures'];
    if (requiresCompany.includes(item.key) && !activeCompany) {
      openModal('noCompanyError');
      return;
    }
    openModal(item.key, { company: activeCompany });
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
    <div className={styles.dropdown} ref={menuRef} role="menu" aria-label="Company Menu">
      <div className={styles.dropdownHeader}>Company</div>
      {COMPANY_MENU_ITEMS.map((item, i) => {
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
