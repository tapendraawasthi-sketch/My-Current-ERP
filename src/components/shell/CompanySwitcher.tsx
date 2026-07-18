import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  LogOut,
  Search,
  Settings,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import type { FiscalYear } from "../../store/store.types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const CompanySwitcher: React.FC = () => {
  const {
    companySettings,
    currentFiscalYear,
    fiscalYears,
    setCurrentFiscalYear,
    setCurrentPage,
    logout,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [fyOpen, setFyOpen] = useState(false);
  const [fyQuery, setFyQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "Company";

  const years = useMemo(() => {
    const list = (fiscalYears || []) as FiscalYear[];
    const q = fyQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((fy) => (fy.name || "").toLowerCase().includes(q));
  }, [fiscalYears, fyQuery]);

  useEffect(() => {
    if (!open && !fyOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFyOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, fyOpen]);

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setFyOpen(false);
        }}
        className="inline-flex h-8 max-w-[120px] items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2 hover:bg-[var(--ds-surface-muted)] sm:max-w-[200px]"
        aria-haspopup="menu"
        aria-expanded={open}
        title={companyName}
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[var(--ds-surface-muted)] text-[12px] font-semibold text-[var(--ds-action-primary)]">
          {initials(companyName)}
        </span>
        <span className="hidden truncate text-[12px] font-medium text-[var(--ds-text-default)] sm:inline">
          {companyName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ds-text-subtle)]" />
      </button>

      <button
        type="button"
        onClick={() => {
          setFyOpen((v) => !v);
          setOpen(false);
        }}
        className="inline-flex h-8 max-w-[96px] items-center gap-1.5 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2 hover:bg-[var(--ds-surface-muted)] sm:max-w-[140px]"
        aria-haspopup="listbox"
        aria-expanded={fyOpen}
        title="Financial year"
      >
        <Calendar className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
        <span className="truncate text-[12px] text-[var(--ds-text-default)]">
          {currentFiscalYear?.name || "FY"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ds-text-subtle)]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[var(--ds-z-dropdown)] mt-2 w-64 overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-2)]"
        >
          <div className="border-b border-[var(--ds-border-default)] px-3 py-2.5">
            <p className="text-[12px] font-semibold text-[var(--ds-text-default)]">{companyName}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
              FY {currentFiscalYear?.name || "—"}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
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
              setCurrentPage("fiscal-year");
            }}
          >
            <Building2 className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
            Manage fiscal years
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <Building2 className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
            Switch company…
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-[var(--ds-border-default)] px-3 py-2 text-left text-[12px] text-[var(--ds-status-danger)] hover:bg-[var(--ds-status-danger-surface)]"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}

      {fyOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-[var(--ds-z-dropdown)] mt-2 w-72 overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-2)]"
        >
          <div className="border-b border-[var(--ds-border-default)] p-2">
            <div className="flex h-8 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2">
              <Search className="h-3.5 w-3.5 text-[var(--ds-text-subtle)]" />
              <input
                value={fyQuery}
                onChange={(e) => setFyQuery(e.target.value)}
                placeholder="Search fiscal years…"
                className="h-full w-full border-0 bg-transparent text-[12px] text-[var(--ds-text-default)] outline-none placeholder:text-[var(--ds-text-subtle)]"
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
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--ds-surface-muted)] ${
                    selected ? "bg-[var(--ds-surface-muted)] text-[var(--ds-action-primary)]" : "text-[var(--ds-text-default)]"
                  }`}
                  onClick={() => {
                    setCurrentFiscalYear(fy);
                    setFyOpen(false);
                    setFyQuery("");
                  }}
                >
                  <span className="truncate font-medium">{fy.name}</span>
                  {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySwitcher;
