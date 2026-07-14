import React from "react";
import { Bell, MoreHorizontal, Plus } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useEKhataStore } from "../../store/eKhataStore";
import { mobileBottomDestinations } from "./shellNavVisibility";

export const MobileBottomNav: React.FC<{ onOpenNotifications: () => void }> = ({
  onOpenNotifications,
}) => {
  const role = useStore((s) => s.currentUser?.role);
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const openOrbix = useEKhataStore((s) => s.openPanel);
  const maximizeOrbix = useEKhataStore((s) => s.maximizePanel);
  const items = mobileBottomDestinations(role);
  const create = items[2];

  const go = (page: string, orbix?: boolean) => {
    if (orbix || page === "orbix") {
      setCurrentPage("orbix");
      openOrbix();
      maximizeOrbix();
    } else {
      setCurrentPage(page);
    }
  };

  return (
    <nav
      className="ds-no-print fixed inset-x-0 bottom-0 z-[var(--ds-z-sticky)] flex h-14 items-stretch justify-around border-t border-[var(--ds-border-default)] bg-[var(--ds-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Mobile primary"
      data-testid="shell-mobile-bottom-nav"
    >
      {items.slice(0, 2).map((item) => {
        const active = currentPage === item.page;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.page, item.orbix)}
            className={`ds-focus-ring flex min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] ${
              active ? "font-semibold text-[var(--ds-action-primary)]" : "text-[var(--ds-text-muted)]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {item.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => create && go(create.page, create.orbix)}
        className="ds-focus-ring flex min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] text-[var(--ds-text-muted)]"
        aria-label={create ? `Create — ${create.label}` : "Create"}
      >
        <Plus className="h-5 w-5" aria-hidden />
        Create
      </button>
      <button
        type="button"
        onClick={onOpenNotifications}
        className="ds-focus-ring flex min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] text-[var(--ds-text-muted)]"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" aria-hidden />
        Alerts
      </button>
      <button
        type="button"
        onClick={() => setCurrentPage("settings")}
        className="ds-focus-ring flex min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] text-[var(--ds-text-muted)]"
        aria-label="More"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
        More
      </button>
    </nav>
  );
};

export default MobileBottomNav;
