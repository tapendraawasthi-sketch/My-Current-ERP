import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useEKhataStore } from "../../store/eKhataStore";
import { SHELL_NAV, type ShellNavGroup } from "./navConfig";

const PINNED_KEY = "orbix_nav_pinned_v1";

interface PrimarySideNavProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const PrimarySideNav: React.FC<PrimarySideNavProps> = ({
  collapsed,
  onCollapsedChange,
  mobileOpen = false,
  onMobileClose,
}) => {
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const openOrbix = useEKhataStore((s) => s.openPanel);
  const maximizeOrbix = useEKhataStore((s) => s.maximizePanel);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pinned, setPinned] = useState<string[]>(loadPinned);

  useEffect(() => {
    localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
  }, [pinned]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const group of SHELL_NAV) {
      if (group.items.some((i) => i.page === currentPage) || group.page === currentPage) {
        next[group.id] = true;
      }
    }
    setExpanded((prev) => ({ ...prev, ...next }));
  }, [currentPage]);

  const pinnedItems = useMemo(() => {
    const all = SHELL_NAV.flatMap((g) =>
      g.items.length
        ? g.items
        : g.page
          ? [{ id: g.id, label: g.label, page: g.page, icon: g.icon, orbix: g.orbix }]
          : [],
    );
    return pinned
      .map((id) => all.find((i) => i.id === id || i.page === id))
      .filter(Boolean) as typeof all;
  }, [pinned]);

  const navigate = (target: { page?: string; orbix?: boolean }) => {
    if (target.orbix || target.page === "orbix") {
      setCurrentPage("orbix");
      openOrbix();
      maximizeOrbix();
    } else if (target.page) {
      setCurrentPage(target.page);
    }
    onMobileClose?.();
  };

  const togglePin = (id: string) => {
    setPinned((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 8),
    );
  };

  const renderNav = (opts: { collapsedMode: boolean; showCollapseToggle: boolean }) => {
    const { collapsedMode, showCollapseToggle } = opts;
    return (
      <nav
        className={`flex h-full flex-col bg-[var(--ox-surface-sidebar)] text-[var(--ox-text-on-dark)] transition-[width] duration-200 ${
          collapsedMode ? "w-[var(--ox-sidenav-collapsed-w)]" : "w-[var(--ox-sidenav-w)]"
        }`}
        aria-label="Primary"
        data-component="primary-side-nav"
      >
        <div className="flex h-12 items-center justify-between border-b border-[var(--ox-border-sidebar)] px-2">
          {!collapsedMode && (
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-on-dark-muted)]">
              Navigation
            </span>
          )}
          {showCollapseToggle && (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] text-[var(--ox-text-on-dark-muted)] hover:bg-[var(--ox-surface-sidebar-hover)] hover:text-white"
              aria-label={collapsedMode ? "Expand navigation" : "Collapse navigation"}
              title={collapsedMode ? "Expand" : "Collapse"}
            >
              {collapsedMode ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {!collapsedMode && pinnedItems.length > 0 && (
            <div className="mb-2 px-2">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-on-dark-muted)]">
                Pinned
              </p>
              {pinnedItems.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.page;
                return (
                  <button
                    key={`pin-${item.id}`}
                    type="button"
                    onClick={() => navigate(item)}
                    className={`mb-0.5 flex w-full items-center gap-2 rounded-[var(--ox-radius-md)] px-2.5 py-2 text-left text-[12px] ${
                      active
                        ? "bg-[var(--ox-surface-sidebar-active)] text-white"
                        : "text-[var(--ox-text-on-dark)] hover:bg-[var(--ox-surface-sidebar-hover)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {SHELL_NAV.map((group: ShellNavGroup) => {
            const Icon = group.icon;
            const isLeaf = Boolean(group.page) && group.items.length === 0;
            const childActive = group.items.some((i) => i.page === currentPage);
            const active = isLeaf ? currentPage === group.page : childActive;
            const isOpen = expanded[group.id] ?? active;

            if (isLeaf) {
              return (
                <div key={group.id} className="px-2">
                  <button
                    type="button"
                    onClick={() => navigate(group)}
                    title={collapsedMode ? group.label : undefined}
                    className={`mb-0.5 flex w-full items-center gap-2 rounded-[var(--ox-radius-md)] px-2.5 py-2 text-left text-[12px] ${
                      active
                        ? "bg-[var(--ox-surface-sidebar-active)] text-white"
                        : "text-[var(--ox-text-on-dark)] hover:bg-[var(--ox-surface-sidebar-hover)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
                    {!collapsedMode && (
                      <span className="truncate font-medium">{group.label}</span>
                    )}
                  </button>
                </div>
              );
            }

            return (
              <div key={group.id} className="px-2">
                <button
                  type="button"
                  onClick={() => {
                    if (collapsedMode) {
                      onCollapsedChange(false);
                      setExpanded((p) => ({ ...p, [group.id]: true }));
                      return;
                    }
                    setExpanded((p) => ({ ...p, [group.id]: !isOpen }));
                  }}
                  title={collapsedMode ? group.label : undefined}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-[var(--ox-radius-md)] px-2.5 py-2 text-left text-[12px] ${
                    active
                      ? "bg-[var(--ox-surface-sidebar-active)]/70 text-white"
                      : "text-[var(--ox-text-on-dark)] hover:bg-[var(--ox-surface-sidebar-hover)]"
                  }`}
                  aria-expanded={isOpen}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
                  {!collapsedMode && (
                    <>
                      <span className="min-w-0 flex-1 truncate font-medium">{group.label}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-[var(--ox-text-on-dark-muted)] transition-transform ${
                          isOpen ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </>
                  )}
                </button>

                {!collapsedMode && isOpen && (
                  <div className="mb-1 ml-2 border-l border-[var(--ox-border-sidebar)] pl-2">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemActive = currentPage === item.page;
                      const isPinned = pinned.includes(item.id);
                      return (
                        <div key={item.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => navigate(item)}
                            className={`mb-0.5 flex w-full items-center gap-2 rounded-[var(--ox-radius-md)] px-2 py-1.5 text-left text-[12px] ${
                              itemActive
                                ? "bg-[var(--ox-primary)]/20 text-white"
                                : "text-[var(--ox-text-on-dark-muted)] hover:bg-[var(--ox-surface-sidebar-hover)] hover:text-white"
                            }`}
                          >
                            <ItemIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePin(item.id)}
                            className={`absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded text-[var(--ox-text-on-dark-muted)] hover:text-white group-hover:inline-flex ${
                              isPinned ? "!inline-flex text-[var(--ox-intelligence)]" : ""
                            }`}
                            title={isPinned ? "Unpin" : "Pin"}
                            aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                          >
                            <Pin className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    );
  };

  return (
    <>
      <div className="hidden h-full flex-shrink-0 lg:block">
        {renderNav({ collapsedMode: collapsed, showCollapseToggle: true })}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close navigation backdrop"
            onClick={onMobileClose}
          />
          <div className="absolute bottom-0 left-0 top-0 flex shadow-[var(--ox-shadow-md)]">
            <div className="relative flex h-full flex-col">
              <button
                type="button"
                onClick={onMobileClose}
                className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-[var(--ox-radius-md)] border border-[var(--ox-border-sidebar)] bg-[var(--ox-surface-sidebar-hover)] text-[var(--ox-text-on-dark)]"
                aria-label="Close navigation"
              >
                <span className="text-[16px] leading-none">×</span>
              </button>
              {renderNav({ collapsedMode: false, showCollapseToggle: false })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrimarySideNav;
