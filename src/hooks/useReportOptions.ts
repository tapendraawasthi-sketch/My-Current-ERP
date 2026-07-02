// src/hooks/useReportOptions.ts
/**
 * useReportOptions
 *
 * Standardises the "Options → Modal → Active Pill" pattern for all report pages.
 *
 * Usage:
 *   const { isOpen, open, close, activeConfig, applyConfig } =
 *     useReportOptions({ fromDate: "...", toDate: "...", format: "horizontal" });
 *
 * The hook manages:
 *   - whether the options modal is open
 *   - the current "draft" config being edited in the modal
 *   - the "applied" config that the report renders from
 *   - a list of active config pills for display in the toolbar
 */

import { useState, useCallback, useMemo } from "react";

export interface ReportConfig {
  fromDate?: string;
  toDate?: string;
  format?: string;
  grouping?: string;
  showZeroBalance?: boolean;
  [key: string]: unknown;
}

interface PillDescriptor {
  key: string;
  label: string;
  value: string;
}

interface UseReportOptionsReturn<T extends ReportConfig> {
  /** Whether the options modal is currently open */
  isOpen: boolean;
  /** Open the options modal */
  open: () => void;
  /** Close the options modal without applying changes */
  close: () => void;
  /** The config currently being drafted in the modal */
  draftConfig: T;
  /** Update a draft config field */
  updateDraft: (patch: Partial<T>) => void;
  /** The applied (live) config that the report renders from */
  activeConfig: T;
  /** Apply the draft config and close the modal */
  applyConfig: () => void;
  /** Reset draft to current active config (cancel) */
  resetDraft: () => void;
  /** List of descriptors for active config pills in the toolbar */
  pills: PillDescriptor[];
}

export function useReportOptions<T extends ReportConfig>(
  initial: T,
  pillFormatter?: (config: T) => PillDescriptor[],
): UseReportOptionsReturn<T> {
  const [isOpen, setIsOpen]           = useState(false);
  const [activeConfig, setActive]     = useState<T>(initial);
  const [draftConfig, setDraft]       = useState<T>(initial);

  const open  = useCallback(() => { setDraft(activeConfig); setIsOpen(true); },  [activeConfig]);
  const close = useCallback(() => setIsOpen(false), []);

  const updateDraft = useCallback((patch: Partial<T>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyConfig = useCallback(() => {
    setActive(draftConfig);
    setIsOpen(false);
  }, [draftConfig]);

  const resetDraft = useCallback(() => {
    setDraft(activeConfig);
    setIsOpen(false);
  }, [activeConfig]);

  // Default pill formatter — shows fromDate, toDate, format if set
  const pills = useMemo<PillDescriptor[]>(() => {
    if (pillFormatter) return pillFormatter(activeConfig);
    const result: PillDescriptor[] = [];
    if (activeConfig.fromDate && activeConfig.toDate) {
      result.push({
        key: "period",
        label: "Period",
        value: `${activeConfig.fromDate} — ${activeConfig.toDate}`,
      });
    }
    if (activeConfig.format) {
      result.push({
        key: "format",
        label: "Format",
        value: String(activeConfig.format).charAt(0).toUpperCase() +
               String(activeConfig.format).slice(1),
      });
    }
    if (activeConfig.grouping) {
      result.push({
        key: "grouping",
        label: "Groups",
        value: String(activeConfig.grouping),
      });
    }
    return result;
  }, [activeConfig, pillFormatter]);

  return {
    isOpen, open, close,
    draftConfig, updateDraft,
    activeConfig, applyConfig, resetDraft,
    pills,
  };
}

export default useReportOptions;
