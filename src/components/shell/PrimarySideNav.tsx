import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useEKhataStore } from "../../store/eKhataStore";
import { type ShellNavGroup } from "./navConfig";
import { filterNavForRole } from "./shellNavVisibility";

const PINNED_KEY = "orbix_nav_pinned_v1";
const RECENT_KEY = "orbix_nav_recent_v1";

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

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
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
  const role = useStore((s) => s.currentUser?.role);
  const openOrbix = useEKhataStore((s) => s.openPanel);
  const maximizeOrbix = useEKhataStore((s) => s.maximizePanel);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pinned, setPinned] = useState<string[]>(loadPinned);
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const nav = useMemo(() => filterNavForRole(role), [role]);

  useEffect(() => {
    localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
  }, [pinned]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }, [recent]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const group of nav) {
      if (group.items.some((i) => i.page === currentPage) || group.page === currentPage) {
        next[group.id] = true;
      }
    }
    setExpanded((prev) => ({ ...prev, ...next }));
    setRecent((prev) => {
      const nextR = [currentPage, ...prev.filter((p) => p !== currentPage)].slice(0, 8);
      return nextR;
    });
  }, [currentPage, nav]);

  const allItems = useMemo(
    () =>
      nav.flatMap((g) =>
        g.items.length
          ? g.items
          : g.page
            ? [{ id: g.id, label: g.label, page: g.page, icon: g.icon, orbix: g.orbix }]
            : [],
      ),
    [nav],
  );

  const pinnedItems = useMemo(
    () =>
      pinned
        .map((id) => allItems.find((i) => i.id === id || i.page === id))
        .filter(Boolean) as typeof allItems,
    [pinned, allItems],
  );

  const recentItems = useMemo(
    () =>
      recent
        .map((page) => allItems.find((i) => i.page === page))
        .filter((i): i is NonNullable<typeof i> => Boolean(i))
        .filter((i) => !pinnedItems.some((p) => p.page === i.page))
        .slice(0, 5),
    [recent, allItems, pinnedItems],
  );

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

  const itemClass = (active: boolean) =>
    `mb-0.5 flex w-full items-center gap-2 rounded-[var(--ds-radius-md)] px-2.5 py-2 text-left text-[13px] border-l-2 ${
      active
        ? "border-l-[var(--ds-action-primary)] bg-white/10 font-semibold text-[var(--ds-text-inverse)]"
        : "border-l-transparent text-[var(--ds-text-inverse)]/80 hover:bg-white/5"
    }`;

  const renderNav = (opts: { collapsedMode: boolean; showCollapseToggle: boolean }) => {
    const { collapsedMode, showCollapseToggle } = opts;
    return (
      <nav
        className={`flex h-full flex-col bg-[var(--ds-surface-inverse)] text-[var(--ds-text-inverse)] transition-[width] duration-200 motion-reduce:transition-none ${
          collapsedMode ? "w-[64px]" : "w-[240px]"
        }`}
        aria-label="Primary"
        data-component="primary-side-nav"
        data-testid="shell-primary-nav"
      >
        <div className="flex h-12 items-center justify-between border-b border-white/10 px-2">
          {!collapsedMode && (
            <span className="px-2 text-[12px] font-semibold text-[var(--ds-text-inverse)]/70">
              Orbix ERP
            </span>
          )}
          {showCollapseToggle && (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="ds-focus-ring ml-auto inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] text-[var(--ds-text-inverse)]/70 hover:bg-white/5 hover:text-[var(--ds-text-inverse)]"
              aria-label={collapsedMode ? "Expand navigation" : "Collapse navigation"}
              title={collapsedMode ? "Expand" : "Collapse"}
            >
              {collapsedMode ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {!collapsedMode && pinnedItems.length > 0 && (
            <div className="mb-2 px-2">
              <p className="mb-1 px-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-inverse)]/70">
                Favourites
              </p>
              {pinnedItems.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.page;
                return (
                  <button
                    key={`pin-${item.id}`}
                    type="button"
                    onClick={() => navigate(item)}
                    className={itemClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!collapsedMode && recentItems.length > 0 && (
            <div className="mb-2 px-2">
              <p className="mb-1 px-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-inverse)]/70">
                Recent
              </p>
              {recentItems.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.page;
                return (
                  <button
                    key={`recent-${item.id}`}
                    type="button"
                    onClick={() => navigate(item)}
                    className={itemClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {nav.map((group: ShellNavGroup) => {
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
                    className={itemClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-80" aria-hidden />
                    {!collapsedMode && <span className="truncate font-medium">{group.label}</span>}
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
                  className={itemClass(active)}
                  aria-expanded={isOpen}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 opacity-80" aria-hidden />
                  {!collapsedMode && (
                    <>
                      <span className="min-w-0 flex-1 truncate font-medium">{group.label}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-[var(--ds-text-inverse)]/70 transition-transform ${
                          isOpen ? "rotate-0" : "-rotate-90"
                        }`}
                        aria-hidden
                      />
                    </>
                  )}
                </button>

                {!collapsedMode && isOpen && (
                  <div className="mb-1 ml-2 border-l border-white/10 pl-2">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemActive = currentPage === item.page;
                      const isPinned = pinned.includes(item.id);
                      return (
                        <div key={item.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => navigate(item)}
                            className={`mb-0.5 flex w-full items-center gap-2 rounded-[var(--ds-radius-md)] px-2 py-2 text-left text-[13px] ${
                              itemActive
                                ? "bg-white/15 font-semibold text-white"
                                : "text-[var(--ds-text-inverse)]/70 hover:bg-white/5 hover:text-white"
                            }`}
                            aria-current={itemActive ? "page" : undefined}
                          >
                            <ItemIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePin(item.id)}
                            className={`absolute right-1 top-1 h-8 w-8 items-center justify-center rounded text-[var(--ds-text-inverse)]/70 hover:text-white ${
                              isPinned ? "inline-flex text-[var(--ds-intelligence)]" : "hidden group-hover:inline-flex focus:inline-flex"
                            }`}
                            title={isPinned ? "Unpin" : "Pin"}
                            aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                          >
                            <Pin className="h-3 w-3" aria-hidden />
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
      <div className="hidden h-full flex-shrink-0 lg:block">{renderNav({ collapsedMode: collapsed, showCollapseToggle: true })}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[var(--ds-z-drawer)] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--ds-surface-inverse)_45%,transparent)]"
            aria-label="Close navigation backdrop"
            onClick={onMobileClose}
          />
          <div className="absolute bottom-0 left-0 top-0 flex shadow-[var(--ds-shadow-3)]">
            <div className="relative flex h-full flex-col">
              <button
                type="button"
                onClick={onMobileClose}
                className="ds-focus-ring absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] border border-white/10 bg-white/10 text-[var(--ds-text-inverse)]"
                aria-label="Close navigation"
              >
                <span className="text-[16px] leading-none" aria-hidden>
                  ×
                </span>
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
