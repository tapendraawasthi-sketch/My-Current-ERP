// src/hooks/useF12Config.tsx
// F12 Configuration System — React Context & Hook

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  type F12ValueMap,
  type F12ScreenDef,
  type F12ScreenId,
  F12_SCREEN_REGISTRY,
  getDefaultValues,
} from "../lib/f12Types";
import { loadF12Values, saveF12Values, resetF12Values, getF12Value } from "../lib/f12Storage";

// ─── Context shape ───────────────────────────────────────────────────────────
interface F12ContextValue {
  /** Currently active screen ID for F12 purposes */
  activeScreenId: F12ScreenId;
  /** Set which screen is currently active — call this in each screen's useEffect */
  setActiveScreenId: (screenId: F12ScreenId) => void;
  /** Whether the F12 panel is open */
  isOpen: boolean;
  /** Open the F12 panel for the currently active screen */
  openF12: () => void;
  /** Close the F12 panel */
  closeF12: () => void;
  /** Toggle the F12 panel */
  toggleF12: () => void;
  /** Current values for the active screen (merged defaults + saved overrides) */
  values: F12ValueMap;
  /** The screen definition for the active screen (or null if not registered) */
  screenDef: F12ScreenDef | null;
  /** Update one or more values locally (not saved yet) */
  setValues: (patch: Partial<F12ValueMap>) => void;
  /** Persist the current values to localStorage */
  saveValues: () => void;
  /** Reset the active screen to global defaults */
  resetToDefaults: () => void;
  /** Read a single config value for the active screen */
  getConfig: <T extends boolean | string | number>(key: string) => T | undefined;
  /** Read a single config value for any screen (for cross-screen access) */
  getConfigFor: <T extends boolean | string | number>(
    screenId: F12ScreenId,
    key: string,
  ) => T | undefined;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const F12Context = createContext<F12ContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const F12Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companySettings } = useStore();
  const companyId = companySettings?.id || "default";

  const [activeScreenId, setActiveScreenIdState] = useState<F12ScreenId>("global");
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValuesState] = useState<F12ValueMap>(() => loadF12Values(companyId, "global"));

  // Keep a ref to companyId so callbacks always have the latest value
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;

  const screenDef = F12_SCREEN_REGISTRY[activeScreenId] ?? null;

  const setActiveScreenId = useCallback((screenId: F12ScreenId) => {
    setActiveScreenIdState(screenId);
    // Load this screen's saved values immediately
    const loaded = loadF12Values(companyIdRef.current, screenId);
    setValuesState(loaded);
  }, []);

  const openF12 = useCallback(() => setIsOpen(true), []);
  const closeF12 = useCallback(() => setIsOpen(false), []);
  const toggleF12 = useCallback(() => setIsOpen((prev) => !prev), []);

  const setValues = useCallback((patch: Partial<F12ValueMap>) => {
    setValuesState((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveValues = useCallback(() => {
    saveF12Values(companyIdRef.current, activeScreenId, values);
  }, [activeScreenId, values]);

  const resetToDefaults = useCallback(() => {
    resetF12Values(companyIdRef.current, activeScreenId);
    const fresh = getDefaultValues(activeScreenId);
    setValuesState(fresh);
  }, [activeScreenId]);

  const getConfig = useCallback(
    <T extends boolean | string | number>(key: string): T | undefined => {
      return values[key] as T | undefined;
    },
    [values],
  );

  const getConfigFor = useCallback(
    <T extends boolean | string | number>(screenId: F12ScreenId, key: string): T | undefined => {
      return getF12Value<T>(companyIdRef.current, screenId, key);
    },
    [],
  );

  const contextValue: F12ContextValue = {
    activeScreenId,
    setActiveScreenId,
    isOpen,
    openF12,
    closeF12,
    toggleF12,
    values,
    screenDef,
    setValues,
    saveValues,
    resetToDefaults,
    getConfig,
    getConfigFor,
  };

  return <F12Context.Provider value={contextValue}>{children}</F12Context.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useF12Config(): F12ContextValue {
  const ctx = useContext(F12Context);
  if (!ctx) {
    throw new Error("useF12Config must be used inside <F12Provider>");
  }
  return ctx;
}

// ─── Convenience hook for screens ────────────────────────────────────────────
/**
 * Call this at the top of any screen component to register it with the F12 system.
 * @param screenId — must match a key in F12_SCREEN_REGISTRY (e.g. 'trial-balance', 'payment', 'ledger-master')
 * @returns getConfig — function to read a single F12 config value for this screen
 */
export function useScreenF12(
  screenId: F12ScreenId,
): <T extends boolean | string | number>(key: string) => T | undefined {
  const { setActiveScreenId, getConfig } = useF12Config();

  React.useEffect(() => {
    setActiveScreenId(screenId);
  }, [screenId, setActiveScreenId]);

  return getConfig;
}
