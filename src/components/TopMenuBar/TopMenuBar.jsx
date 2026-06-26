import React, { useEffect, useRef, useCallback } from 'react';
import { Building2, Database, ArrowLeftRight, Download, Upload, Share2, Printer, HelpCircle, Search, LayoutGrid } from 'lucide-react';
import styles from './TopMenuBar.module.css';

import { useMenu } from '@/context/MenuContext';
import { useApp } from '@/context/AppContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePermissions } from './hooks/usePermissions';

import CompanyMenu from './menus/CompanyMenu';
import DataMenu from './menus/DataMenu';
import ExchangeMenu from './menus/ExchangeMenu';
import ImportMenu from './menus/ImportMenu';
import ExportMenu from './menus/ExportMenu';
import ShareMenu from './menus/ShareMenu';
import PrintMenu from './menus/PrintMenu';
import HelpMenu from './menus/HelpMenu';
import GoToPanel from './menus/GoToPanel';
import SwitchToPanel from './menus/SwitchToPanel';

import ModalRenderer from './modals/ModalRenderer';

export default function TopMenuBar() {
  const { activeMenu, openMenu, toggleMenu, closeAll, openGoTo, openSwitchTo, isGoToOpen, isSwitchToOpen } = useMenu();
  const { activeCompany, currentUser } = useApp();
  const { can } = usePermissions();
  const barRef = useRef(null);

  // Register all keyboard shortcuts
  useKeyboardShortcuts();

  // Close menus when clicking outside the bar
  useEffect(() => {
    function handleOutsideClick(e) {
      if (barRef.current && !barRef.current.contains(e.target)) {
        closeAll();
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [closeAll]);

  const menuButtons = [
    { key: 'company',  label: 'Company',  shortcut: 'K', icon: <Building2 size={14}/>,      alwaysVisible: true },
    { key: 'data',     label: 'Data',     shortcut: 'Y', icon: <Database size={14}/>,        alwaysVisible: true },
    { key: 'exchange', label: 'Exchange', shortcut: 'Z', icon: <ArrowLeftRight size={14}/>,  permission: 'canSync' },
    { key: 'import',   label: 'Import',   shortcut: 'O', icon: <Download size={14}/>,        permission: 'canImportData' },
    { key: 'export',   label: 'Export',   shortcut: 'E', icon: <Upload size={14}/>,          permission: 'canExportData' },
    { key: 'share',    label: 'Share',    shortcut: 'M', icon: <Share2 size={14}/>,          permission: 'canEmailShare' },
    { key: 'print',    label: 'Print',    shortcut: 'P', icon: <Printer size={14}/>,         permission: 'canPrint' },
    { key: 'help',     label: 'Help',     shortcut: 'F1', icon: <HelpCircle size={14}/>,     alwaysVisible: true },
  ];

  return (
    <>
      <div ref={barRef} className={styles.topBar} role="navigation" aria-label="Top Menu Bar">
        {/* ROW 1: Menu buttons */}
        <div className={styles.menuRow}>
          <div className={styles.menuButtonGroup}>
            {menuButtons.map(btn => {
              const visible = btn.alwaysVisible || can(btn.permission);
              if (!visible) return null;
              return (
                <button
                  key={btn.key}
                  className={`${styles.menuButton} ${activeMenu === btn.key ? styles.menuButtonActive : ''}`}
                  onClick={() => toggleMenu(btn.key)}
                  aria-haspopup="true"
                  aria-expanded={activeMenu === btn.key}
                  title={`${btn.label} (Alt+${btn.shortcut})`}
                >
                  {btn.icon}
                  <span className={styles.menuLabel}>{btn.label}</span>
                  <span className={styles.menuShortcut}>
                    {btn.key === 'help' ? 'F1' : `Alt+${btn.shortcut}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right side: GoTo + SwitchTo */}
          <div className={styles.navButtonGroup}>
            {can('canGoTo') && (
              <button
                className={`${styles.navButton} ${isGoToOpen ? styles.navButtonActive : ''}`}
                onClick={openGoTo}
                title="Go To (Alt+G)"
              >
                <Search size={14}/>
                <span>Go To</span>
                <span className={styles.menuShortcut}>Alt+G</span>
              </button>
            )}
            {can('canSwitchTo') && (
              <button
                className={`${styles.navButton} ${isSwitchToOpen ? styles.navButtonActive : ''}`}
                onClick={openSwitchTo}
                title="Switch To (Ctrl+G)"
              >
                <LayoutGrid size={14}/>
                <span>Switch To</span>
                <span className={styles.menuShortcut}>Ctrl+G</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 2: Company + User info strip */}
        <div className={styles.infoRow}>
          <div className={styles.companyInfo}>
            {activeCompany ? (
              <>
                <span className={styles.companyName}>{activeCompany.name}</span>
                <span className={styles.separator}>|</span>
                <span className={styles.fyLabel}>FY: {activeCompany.financialYear}</span>
              </>
            ) : (
              <span className={styles.noCompany}>No Company Selected</span>
            )}
          </div>
          <div className={styles.userInfo}>
            {currentUser && (
              <span className={styles.userName}>{currentUser.fullName} ({currentUser.role})</span>
            )}
          </div>
        </div>

        {/* Dropdowns — render only one at a time */}
        {activeMenu === 'company'  && <CompanyMenu />}
        {activeMenu === 'data'     && <DataMenu />}
        {activeMenu === 'exchange' && <ExchangeMenu />}
        {activeMenu === 'import'   && <ImportMenu />}
        {activeMenu === 'export'   && <ExportMenu />}
        {activeMenu === 'share'    && <ShareMenu />}
        {activeMenu === 'print'    && <PrintMenu />}
        {activeMenu === 'help'     && <HelpMenu />}

        {/* Go To and Switch To panels */}
        {isGoToOpen    && <GoToPanel />}
        {isSwitchToOpen && <SwitchToPanel />}
      </div>

      {/* Modal renderer — outside the top bar so it covers full page */}
      <ModalRenderer />
    </>
  );
}
