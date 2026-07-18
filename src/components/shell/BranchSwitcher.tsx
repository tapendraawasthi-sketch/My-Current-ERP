/**
 * Active branch chip for TopCommandBar (Wave H / Function 23).
 * Uses store.branches + localStorage erp_default_branch — does not invent balances.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Settings } from "lucide-react";
import { useStore } from "../../store/useStore";
import {
  ACTIVE_BRANCH_KEY,
  BRANCH_CHANGED_EVENT,
  readActiveBranchId,
} from "../../lib/activeBranch";

export const BranchSwitcher: React.FC = () => {
  const branches = useStore((s) => s.branches || []);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(readActiveBranchId);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeList = useMemo(
    () => (branches as { id: string; name?: string; code?: string; isActive?: boolean }[]).filter(
      (b) => b && b.isActive !== false,
    ),
    [branches],
  );

  const active = useMemo(() => {
    if (!activeList.length) return null;
    return activeList.find((b) => b.id === activeId) || activeList[0];
  }, [activeList, activeId]);

  useEffect(() => {
    if (!activeList.length) return;
    if (!activeId || !activeList.some((b) => b.id === activeId)) {
      const next = activeList[0].id;
      setActiveId(next);
      try {
        localStorage.setItem(ACTIVE_BRANCH_KEY, next);
      } catch {
        /* ignore */
      }
    }
  }, [activeList, activeId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_BRANCH_KEY) setActiveId(e.newValue || "");
    };
    const onCustom = () => setActiveId(readActiveBranchId());
    window.addEventListener("storage", onStorage);
    window.addEventListener(BRANCH_CHANGED_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(BRANCH_CHANGED_EVENT, onCustom as EventListener);
    };
  }, []);

  if (!activeList.length) return null;

  const label = active?.name || active?.code || "Branch";

  return (
    <div ref={rootRef} className="relative hidden items-center lg:flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 max-w-[140px] items-center gap-1.5 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2 hover:bg-[var(--ds-surface-muted)]"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Branch: ${label}`}
        data-testid="shell-branch-switcher"
      >
        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ds-action-primary)]" />
        <span className="truncate text-[12px] font-medium text-[var(--ds-text-default)]">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ds-text-subtle)]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[var(--ds-z-dropdown)] mt-1 w-56 overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-2)]"
        >
          <p className="border-b border-[var(--ds-border-default)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
            Working branch
          </p>
          <div className="max-h-56 overflow-y-auto py-1">
            {activeList.map((b) => {
              const selected = b.id === active?.id;
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
                  onClick={() => {
                    setActiveId(b.id);
                    try {
                      localStorage.setItem(ACTIVE_BRANCH_KEY, b.id);
                    } catch {
                      /* ignore */
                    }
                    window.dispatchEvent(new Event(BRANCH_CHANGED_EVENT));
                    setOpen(false);
                  }}
                >
                  <span className="truncate">
                    <span className="font-medium">{b.name || b.code}</span>
                    {b.code ? (
                      <span className="ml-1 text-[11px] text-[var(--ds-text-muted)]">{b.code}</span>
                    ) : null}
                  </span>
                  {selected ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-[var(--ds-border-default)] px-3 py-2 text-left text-[12px] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)] hover:text-[var(--ds-text-default)]"
            onClick={() => {
              setOpen(false);
              setCurrentPage("branch-master");
            }}
          >
            <Settings className="h-3.5 w-3.5" />
            Manage branches
          </button>
        </div>
      )}
    </div>
  );
};

export default BranchSwitcher;
