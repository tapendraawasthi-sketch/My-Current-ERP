import React, { useState } from "react";
import { Menu, Moon, Search, Settings, Sun } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../context/ThemeContext";
import { findNavLabel } from "./navConfig";
import ContextSwitcher from "./ContextSwitcher";
import SyncStatusControl from "./SyncStatusControl";
import { NotificationBellButton } from "./NotificationCentre";
import { DisplayLanguageModal } from "../ui/LanguageModal";
import { Avatar, type Density } from "@/design-system";

interface TopCommandBarProps {
  onOpenPalette: () => void;
  onToggleNav: () => void;
  onOpenNotifications: () => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  showMenuButton?: boolean;
}

function environmentLabel(): { label: string; kind: "production" | "nonprod" } {
  if (import.meta.env.DEV) return { label: "Development", kind: "nonprod" };
  if (import.meta.env.MODE === "test") return { label: "Test", kind: "nonprod" };
  return { label: "Production", kind: "production" };
}

const DENSITY_LABEL: Record<Density, string> = {
  comfortable: "Comfortable",
  productive: "Productive",
  compact: "Compact",
};

const TopCommandBar: React.FC<TopCommandBarProps> = ({
  onOpenPalette,
  onToggleNav,
  onOpenNotifications,
  density,
  onDensityChange,
  showMenuButton = false,
}) => {
  const currentPage = useStore((s) => s.currentPage);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const { theme, preference, setThemePreference, toggleTheme } = useTheme();
  const [userOpen, setUserOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const env = environmentLabel();
  const crumb = findNavLabel(currentPage);

  return (
    <header
      className="ds-no-print flex h-14 flex-shrink-0 items-center gap-3 border-b border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3"
      data-component="top-command-bar"
      data-testid="shell-top-command-bar"
      role="banner"
    >
      {showMenuButton && (
        <button
          type="button"
          onClick={onToggleNav}
          className="ds-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>
      )}

      <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--ds-action-primary)] text-[13px] font-bold text-[var(--ds-action-primary-text)]"
          aria-hidden
        >
          O
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold tracking-tight text-[var(--ds-text-strong)]">Orbix ERP</span>
            {env.kind !== "production" ? (
              <span
                className="rounded-[var(--ds-radius-sm)] border border-[var(--ds-status-warning)]/40 bg-[var(--ds-status-warning-surface)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--ds-status-warning)]"
                title="Non-production environment"
              >
                {env.label}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[12px] text-[var(--ds-text-muted)]">{crumb}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="ds-focus-ring mx-auto hidden h-9 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] px-3 text-left hover:border-[var(--ds-border-strong)] md:flex"
        aria-label="Open search and command palette"
        data-testid="shell-command-trigger"
      >
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--ds-text-subtle)]" aria-hidden />
        <span className="truncate text-[13px] text-[var(--ds-text-muted)]">
          Search invoices, parties, or ask Orbix…
        </span>
        <kbd className="ml-auto hidden rounded border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-1.5 py-0.5 text-[12px] text-[var(--ds-text-subtle)] lg:inline">
          Ctrl+K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className="ds-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)] md:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>

        <ContextSwitcher />
        <SyncStatusControl />

        <button
          type="button"
          onClick={toggleTheme}
          className="ds-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)]"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={`Theme: ${preference}`}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        </button>

        <NotificationBellButton onClick={onOpenNotifications} />

        <div className="relative">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className="ds-focus-ring inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2 hover:bg-[var(--ds-surface-hover)]"
            aria-haspopup="menu"
            aria-expanded={userOpen}
            data-testid="shell-user-menu"
          >
            <Avatar
              name={currentUser?.name || currentUser?.username || "User"}
              seed={currentUser?.id || currentUser?.username}
              size="sm"
            />
            <span className="hidden max-w-[100px] truncate text-[13px] font-medium text-[var(--ds-text-default)] md:inline">
              {currentUser?.username || currentUser?.name || "User"}
            </span>
          </button>
          {userOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[var(--ds-z-dropdown)]"
                aria-label="Close user menu"
                onClick={() => setUserOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-[var(--ds-z-dropdown)] mt-2 w-56 overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-2)]"
              >
                <div className="border-b border-[var(--ds-border-subtle)] px-3 py-2 text-[12px] text-[var(--ds-text-muted)]">
                  {currentUser?.role || "user"}
                </div>
                <div className="border-b border-[var(--ds-border-subtle)] px-3 py-2">
                  <p className="mb-1 text-[12px] font-medium text-[var(--ds-text-muted)]">Density</p>
                  <p className="mb-1.5 text-[12px] text-[var(--ds-text-subtle)]">
                    Applies to updated screens
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(["comfortable", "productive", "compact"] as Density[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="menuitemradio"
                        aria-checked={density === d}
                        className={`rounded px-2 py-1 text-[12px] ${
                          density === d
                            ? "bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)]"
                            : "hover:bg-[var(--ds-surface-hover)]"
                        }`}
                        onClick={() => onDensityChange(d)}
                      >
                        {DENSITY_LABEL[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-b border-[var(--ds-border-subtle)] px-3 py-2">
                  <p className="mb-1 text-[12px] font-medium text-[var(--ds-text-muted)]">Theme</p>
                  <div className="flex flex-wrap gap-1">
                    {(["light", "dark", "system"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="menuitemradio"
                        aria-checked={preference === p}
                        className={`rounded px-2 py-1 text-[12px] capitalize ${
                          preference === p
                            ? "bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)]"
                            : "hover:bg-[var(--ds-surface-hover)]"
                        }`}
                        onClick={() => setThemePreference(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-[13px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]"
                  onClick={() => {
                    setUserOpen(false);
                    setLanguageOpen(true);
                  }}
                >
                  Display language
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]"
                  onClick={() => {
                    setUserOpen(false);
                    setCurrentPage("configuration-hub");
                  }}
                >
                  <Settings className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" aria-hidden />
                  Help & configuration
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-[13px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]"
                  onClick={() => {
                    setUserOpen(false);
                    setCurrentPage("users");
                  }}
                >
                  Account & users
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full border-t border-[var(--ds-border-subtle)] px-3 py-2 text-left text-[13px] text-[var(--ds-status-danger)] hover:bg-[var(--ds-status-danger-surface)]"
                  onClick={() => {
                    setUserOpen(false);
                    void logout();
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <DisplayLanguageModal isOpen={languageOpen} onClose={() => setLanguageOpen(false)} />
    </header>
  );
};

export default TopCommandBar;
