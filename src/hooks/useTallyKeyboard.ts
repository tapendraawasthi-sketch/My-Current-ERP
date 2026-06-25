import { useEffect, useCallback } from 'react';

export interface KeyboardActionMap {
  onF2?: () => void;      // Date
  onF3?: () => void;      // Company
  onF4?: () => void;      // Contra
  onF5?: () => void;      // Payment
  onF6?: () => void;      // Receipt
  onF7?: () => void;      // Journal
  onF10?: () => void;     // List
  onF12?: () => void;     // Configure / Accept
  onEscape?: () => void;  // Cancel
  onCtrlA?: () => void;   // Accept
  onCtrlD?: () => void;   // Duplicate row
  onCtrlH?: () => void;   // Toggle mode
  onAltC?: () => void;    // Create ledger
  onEnter?: () => void;   // Generic accept
  onDown?: () => void;    // Next row
  onUp?: () => void;      // Prev row
  onTab?: () => void;     // Next cell
  onShiftTab?: () => void; // Prev cell
}

export const useTallyKeyboard = (actions: KeyboardActionMap, enabled = true) => {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;

      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const shift = e.shiftKey;

      // Navigation inside inputs should be allowed unless a global combo is pressed.
      if (isTyping && !(ctrl || alt || key === 'Escape' || key === 'F2' || key === 'F3' || key === 'F12')) {
        return;
      }

      const maybePrevent = (cb?: () => void) => {
        if (cb) {
          e.preventDefault();
          e.stopPropagation();
          cb();
        }
      };

      if (key === 'F2') maybePrevent(actions.onF2);
      if (key === 'F3') maybePrevent(actions.onF3);
      if (key === 'F4') maybePrevent(actions.onF4);
      if (key === 'F5') maybePrevent(actions.onF5);
      if (key === 'F6') maybePrevent(actions.onF6);
      if (key === 'F7') maybePrevent(actions.onF7);
      if (key === 'F10') maybePrevent(actions.onF10);
      if (key === 'F12') maybePrevent(actions.onF12);
      if (key === 'Escape') maybePrevent(actions.onEscape);
      if (key === 'Enter' && ctrl) maybePrevent(actions.onCtrlA); // Ctrl+Enter fallback
      if (key.toLowerCase() === 'a' && ctrl) maybePrevent(actions.onCtrlA);
      if (key.toLowerCase() === 'd' && ctrl) maybePrevent(actions.onCtrlD);
      if (key.toLowerCase() === 'h' && ctrl) maybePrevent(actions.onCtrlH);
      if (key.toLowerCase() === 'c' && alt) maybePrevent(actions.onAltC);
      if (key === 'Enter' && !ctrl && !shift) maybePrevent(actions.onEnter);
      if (key === 'ArrowDown') maybePrevent(actions.onDown);
      if (key === 'ArrowUp') maybePrevent(actions.onUp);
      if (key === 'Tab' && shift) maybePrevent(actions.onShiftTab);
      if (key === 'Tab' && !shift) maybePrevent(actions.onTab);
    },
    [actions, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handler]);
};
