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
        className="inline-flex h-8 max-w-[120px] items-center gap-2 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2 hover:bg-[var(--ox-surface-muted)] sm:max-w-[200px]"
        aria-haspopup="menu"
        aria-expanded={open}
        title={companyName}
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[var(--ox-primary-soft)] text-[10px] font-semibold text-[var(--ox-primary)]">
          {initials(companyName)}
        </span>
        <span className="hidden truncate text-[12px] font-medium text-[var(--ox-text)] sm:inline">
          {companyName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ox-text-subtle)]" />
      </button>

      <button
        type="button"
        onClick={() => {
          setFyOpen((v) => !v);
          setOpen(false);
        }}
        className="inline-flex h-8 max-w-[96px] items-center gap-1.5 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2 hover:bg-[var(--ox-surface-muted)] sm:max-w-[140px]"
        aria-haspopup="listbox"
        aria-expanded={fyOpen}
        title="Financial year"
      >
        <Calendar className="h-3.5 w-3.5 text-[var(--ox-text-muted)]" />
        <span className="truncate text-[12px] text-[var(--ox-text)]">
          {currentFiscalYear?.name || "FY"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ox-text-subtle)]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface-elevated)] shadow-[var(--ox-shadow-md)]"
        >
          <div className="border-b border-[var(--ox-border)] px-3 py-2.5">
            <p className="text-[12px] font-semibold text-[var(--ox-text)]">{companyName}</p>
            <p className="mt-0.5 text-[11px] text-[var(--ox-text-muted)]">
              FY {currentFiscalYear?.name || "—"}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
            onClick={() => {
              setOpen(false);
              setCurrentPage("settings");
            }}
          >
            <Settings className="h-3.5 w-3.5 text-[var(--ox-text-muted)]" />
            Company settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
            onClick={() => {
              setOpen(false);
              setCurrentPage("fiscal-year");
            }}
          >
            <Building2 className="h-3.5 w-3.5 text-[var(--ox-text-muted)]" />
            Manage fiscal years
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-[var(--ox-border)] px-3 py-2 text-left text-[12px] text-[var(--ox-danger)] hover:bg-[var(--ox-danger-soft)]"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out / switch company
          </button>
        </div>
      )}

      {fyOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface-elevated)] shadow-[var(--ox-shadow-md)]"
        >
          <div className="border-b border-[var(--ox-border)] p-2">
            <div className="flex h-8 items-center gap-2 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2">
              <Search className="h-3.5 w-3.5 text-[var(--ox-text-subtle)]" />
              <input
                value={fyQuery}
                onChange={(e) => setFyQuery(e.target.value)}
                placeholder="Search fiscal years…"
                className="h-full w-full border-0 bg-transparent text-[12px] text-[var(--ox-text)] outline-none placeholder:text-[var(--ox-text-subtle)]"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {years.length === 0 && (
              <p className="px-3 py-4 text-center text-[12px] text-[var(--ox-text-muted)]">
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
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--ox-surface-muted)] ${
                    selected ? "bg-[var(--ox-primary-soft)] text-[var(--ox-primary)]" : "text-[var(--ox-text)]"
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
