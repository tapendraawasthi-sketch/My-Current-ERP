/**
 * Single top-bar context control — Company · Branch · FY (Phase A simple-premium IA).
 * Preserves all switcher functions; collapses three chrome chips into one.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  MapPin,
  Search,
  Settings,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import type { FiscalYear } from "../../store/store.types";
import {
  ACTIVE_BRANCH_KEY,
  BRANCH_CHANGED_EVENT,
  readActiveBranchId,
} from "../../lib/activeBranch";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type Panel = "main" | "branch" | "fy";

export const ContextSwitcher: React.FC = () => {
  const {
    companySettings,
    currentFiscalYear,
    fiscalYears,
    setCurrentFiscalYear,
    setCurrentPage,
    branches,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("main");
  const [fyQuery, setFyQuery] = useState("");
  const [activeBranchId, setActiveBranchId] = useState(readActiveBranchId);
  const rootRef = useRef<HTMLDivElement>(null);

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "Company";

  const activeList = useMemo(
    () =>
      ((branches || []) as { id: string; name?: string; code?: string; isActive?: boolean }[]).filter(
        (b) => b && b.isActive !== false,
      ),
    [branches],
  );

  const activeBranch = useMemo(() => {
    if (!activeList.length) return null;
    return activeList.find((b) => b.id === activeBranchId) || activeList[0];
  }, [activeList, activeBranchId]);

  const years = useMemo(() => {
    const list = (fiscalYears || []) as FiscalYear[];
    const q = fyQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((fy) => (fy.name || "").toLowerCase().includes(q));
  }, [fiscalYears, fyQuery]);

  useEffect(() => {
    if (!activeList.length) return;
    if (!activeBranchId || !activeList.some((b) => b.id === activeBranchId)) {
      const next = activeList[0].id;
      setActiveBranchId(next);
      try {
        localStorage.setItem(ACTIVE_BRANCH_KEY, next);
      } catch {
        /* ignore */
      }
    }
  }, [activeList, activeBranchId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPanel("main");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_BRANCH_KEY) setActiveBranchId(e.newValue || "");
    };
    const onCustom = () => setActiveBranchId(readActiveBranchId());
    window.addEventListener("storage", onStorage);
    window.addEventListener(BRANCH_CHANGED_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(BRANCH_CHANGED_EVENT, onCustom as EventListener);
    };
  }, []);

  const branchLabel = activeBranch?.name || activeBranch?.code || null;
  const fyLabel = currentFiscalYear?.name || "FY";
  const summary = [branchLabel, fyLabel].filter(Boolean).join(" · ");

  const selectBranch = (id: string) => {
    setActiveBranchId(id);
    try {
      localStorage.setItem(ACTIVE_BRANCH_KEY, id);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(BRANCH_CHANGED_EVENT));
    setPanel("main");
  };

  return (
    <div ref={rootRef} className="relative" data-testid="shell-context-switcher">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setPanel("main");
        }}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2 hover:bg-[var(--ds-surface-muted)] sm:max-w-[280px]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Company, branch, and fiscal year"
        title={`${companyName}${summary ? ` · ${summary}` : ""}`}
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[var(--ds-surface-muted)] text-[12px] font-semibold text-[var(--ds-action-primary)]">
          {initials(companyName)}
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-[12px] font-medium text-[var(--ds-text-default)]">
            {companyName}
          </span>
          {summary ? (
            <span className="hidden truncate text-[11px] text-[var(--ds-text-muted)] sm:block">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ds-text-subtle)]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[var(--ds-z-dropdown)] mt-1 w-72 overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-2)]"
        >
          {panel === "main" && (
            <>
              <div className="border-b border-[var(--ds-border-default)] px-3 py-2.5">
                <p className="text-[12px] font-semibold text-[var(--ds-text-strong)]">{companyName}</p>
                <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
                  {branchLabel ? `${branchLabel} · ` : ""}
                  FY {fyLabel}
                </p>
              </div>

              {activeList.length > 0 ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
                  onClick={() => setPanel("branch")}
                >
                  <MapPin className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
                  <span className="flex-1 truncate">Branch · {branchLabel || "Select"}</span>
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-[var(--ds-text-subtle)]" />
                </button>
              ) : null}

              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
                onClick={() => setPanel("fy")}
              >
                <Calendar className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
                <span className="flex-1 truncate">Fiscal year · {fyLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-[var(--ds-text-subtle)]" />
              </button>

              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 border-t border-[var(--ds-border-default)] px-3 py-2 text-left text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
                onClick={() => {
                  setOpen(false);
                  setCurrentPage("settings");
                }}
              >
                <Settings className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
                Company settings
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
                onClick={() => {
                  setOpen(false);
                  setCurrentPage("branch-master");
                }}
              >
                <Building2 className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
                Manage branches
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
                onClick={() => {
                  setOpen(false);
                  setCurrentPage("fiscal-year");
                }}
              >
                <Calendar className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
                Manage fiscal years
              </button>
            </>
          )}

          {panel === "branch" && (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-[var(--ds-border-default)] px-3 py-2 text-left text-[12px] font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)]"
                onClick={() => setPanel("main")}
              >
                ← Working branch
              </button>
              <div className="max-h-56 overflow-y-auto py-1">
                {activeList.map((b) => {
                  const selected = b.id === activeBranch?.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="menuitem"
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--ds-surface-muted)] ${
                        selected
                          ? "bg-[var(--ds-surface-muted)] text-[var(--ds-action-primary)]"
                          : "text-[var(--ds-text-default)]"
                      }`}
                      onClick={() => selectBranch(b.id)}
                    >
                      <span className="truncate font-medium">{b.name || b.code}</span>
                      {selected ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {panel === "fy" && (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-[var(--ds-border-default)] px-3 py-2 text-left text-[12px] font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)]"
                onClick={() => {
                  setPanel("main");
                  setFyQuery("");
                }}
              >
                ← Fiscal year
              </button>
              <div className="border-b border-[var(--ds-border-default)] p-2">
                <div className="flex h-8 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2">
                  <Search className="h-3.5 w-3.5 text-[var(--ds-text-subtle)]" />
                  <input
                    value={fyQuery}
                    onChange={(e) => setFyQuery(e.target.value)}
                    placeholder="Search fiscal years…"
                    className="h-full w-full border-0 bg-transparent text-[12px] text-[var(--ds-text-default)] outline-none placeholder:text-[var(--ds-text-subtle)]"
                    aria-label="Search fiscal years"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {years.length === 0 && (
                  <p className="px-3 py-4 text-center text-[12px] text-[var(--ds-text-muted)]">
                    No fiscal years found
                  </p>
                )}
                {years.map((fy) => {
                  const selected = fy.id === currentFiscalYear?.id;
                  return (
                    <button
                      key={fy.id}
                      type="button"
                      role="menuitem"
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--ds-surface-muted)] ${
                        selected
                          ? "bg-[var(--ds-surface-muted)] text-[var(--ds-action-primary)]"
                          : "text-[var(--ds-text-default)]"
                      }`}
                      onClick={() => {
                        setCurrentFiscalYear(fy);
                        setPanel("main");
                        setFyQuery("");
                      }}
                    >
                      <span className="truncate font-medium">{fy.name}</span>
                      {selected ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextSwitcher;
