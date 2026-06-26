import { useEffect, useCallback } from 'react';
import { useMenu } from '../context/MenuContext';
import { useApp } from '../context/AppContext';

export function useKeyboardShortcuts(onOpenCompanyModal) {
  const { openMenu, toggleMenu, openGoTo, openSwitchTo, closeAll, openModal, activeMenu } = useMenu();
  const { activeCompany } = useApp();

  const handleKeyDown = useCallback((e) => {
    // Ignore when user is typing in an input, textarea, or select — EXCEPT for Escape and F keys
    const tag = document.activeElement?.tagName;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

    // Escape always closes everything
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAll();
      return;
    }

    // F1 — Help (no Alt needed)
    if (e.key === 'F1') {
      e.preventDefault();
      openMenu('help');
      return;
    }

    // F3 — Select Company (no Alt needed)
    if (e.key === 'F3' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      openModal('selectCompany');
      return;
    }

    // Ctrl+F3 — Shut Company
    if (e.key === 'F3' && e.ctrlKey) {
      e.preventDefault();
      if (activeCompany) {
        openModal('shutCompany', { company: activeCompany });
      }
      return;
    }

    // F11 — Company Features
    if (e.key === 'F11') {
      e.preventDefault();
      openModal('companyFeatures');
      return;
    }

    // Ctrl+G — Switch To
    if (e.key === 'g' && e.ctrlKey && !e.altKey) {
      e.preventDefault();
      openSwitchTo();
      return;
    }

    // Alt+* shortcuts — skip if user is typing
    if (!e.altKey || isTyping) return;

    switch (e.key.toLowerCase()) {
      case 'k':
        e.preventDefault();
        toggleMenu('company');
        break;
      case 'y':
        e.preventDefault();
        toggleMenu('data');
        break;
      case 'z':
        e.preventDefault();
        toggleMenu('exchange');
        break;
      case 'o':
        e.preventDefault();
        toggleMenu('import');
        break;
      case 'e':
        e.preventDefault();
        toggleMenu('export');
        break;
      case 'm':
        e.preventDefault();
        toggleMenu('share');
        break;
      case 'p':
        e.preventDefault();
        toggleMenu('print');
        break;
      case 'g':
        e.preventDefault();
        openGoTo();
        break;
      default:
        break;
    }
  }, [openMenu, toggleMenu, openGoTo, openSwitchTo, closeAll, openModal, activeCompany]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
