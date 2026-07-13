import React, { useState } from "react";
import {
  Bell,
  HelpCircle,
  Menu,
  Moon,
  Search,
  Sun,
  User,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../context/ThemeContext";
import { findNavLabel } from "./navConfig";
import CompanySwitcher from "./CompanySwitcher";
import SyncStatusControl from "./SyncStatusControl";

interface TopCommandBarProps {
  onOpenPalette: () => void;
  onToggleNav: () => void;
  showMenuButton?: boolean;
}

const TopCommandBar: React.FC<TopCommandBarProps> = ({
  onOpenPalette,
  onToggleNav,
  showMenuButton = false,
}) => {
  const currentPage = useStore((s) => s.currentPage);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const { theme, toggleTheme } = useTheme();
  const [userOpen, setUserOpen] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const crumb = findNavLabel(currentPage);

  return (
    <header
      className="no-print flex h-[var(--ox-topbar-h)] flex-shrink-0 items-center gap-3 border-b border-[var(--ox-border)] bg-[var(--ox-surface)] px-3 shadow-[var(--ox-shadow-sm)]"
      data-component="top-command-bar"
    >
      {showMenuButton && (
        <button
          type="button"
          onClick={onToggleNav}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] bg-[var(--ox-primary)] text-[13px] font-bold text-white">
          O
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold tracking-tight text-[var(--ox-text)]">
              Orbix
            </span>
            <span className="hidden text-[11px] text-[var(--ox-text-subtle)] md:inline">ERP</span>
          </div>
          <p className="truncate text-[11px] text-[var(--ox-text-muted)]">{crumb}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="mx-auto hidden h-9 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-3 text-left hover:border-[var(--ox-border-strong)] md:flex"
        aria-label="Open search and command palette"
      >
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--ox-text-subtle)]" />
        <span className="truncate text-[12px] text-[var(--ox-text-muted)]">
          Search accounts, vouchers, reports, parties, items…
        </span>
        <kbd className="ml-auto hidden rounded border border-[var(--ox-border)] bg-[var(--ox-surface)] px-1.5 py-0.5 text-[10px] text-[var(--ox-text-subtle)] lg:inline">
          Ctrl+K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] text-[var(--ox-text-muted)] hover:bg-[var(--ox-surface-muted)] md:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        <CompanySwitcher />
        <SyncStatusControl />

        <span
          className={`hidden h-8 items-center gap-1.5 rounded-[var(--ox-radius-md)] border px-2 text-[11px] font-medium sm:inline-flex ${
            online
              ? "border-[color:rgba(5,150,105,0.25)] bg-[var(--ox-success-soft)] text-[var(--ox-success)]"
              : "border-[var(--ox-border)] bg-[var(--ox-surface-muted)] text-[var(--ox-text-muted)]"
          }`}
          title={online ? "Connected" : "Offline"}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[var(--ox-success)]" : "bg-[var(--ox-text-subtle)]"}`}
          />
          {online ? "Online" : "Offline"}
        </span>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] text-[var(--ox-text-muted)] hover:bg-[var(--ox-surface-muted)]"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setCurrentPage("configuration-hub")}
          className="hidden h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] text-[var(--ox-text-muted)] hover:bg-[var(--ox-surface-muted)] md:inline-flex"
          aria-label="Help"
          title="Help & configuration"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <button
          type="button"
          className="relative hidden h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] text-[var(--ox-text-muted)] hover:bg-[var(--ox-surface-muted)] sm:inline-flex"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-2 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2 hover:bg-[var(--ox-surface-muted)]"
            aria-haspopup="menu"
            aria-expanded={userOpen}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ox-surface-muted)] text-[var(--ox-text-muted)]">
              <User className="h-3.5 w-3.5" />
            </span>
            <span className="hidden max-w-[100px] truncate text-[12px] font-medium text-[var(--ox-text)] md:inline">
              {currentUser?.username || currentUser?.name || "User"}
            </span>
          </button>
          {userOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40"
                aria-label="Close user menu"
                onClick={() => setUserOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface-elevated)] shadow-[var(--ox-shadow-md)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-[12px] text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
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
                  className="block w-full border-t border-[var(--ox-border)] px-3 py-2 text-left text-[12px] text-[var(--ox-danger)] hover:bg-[var(--ox-danger-soft)]"
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
    </header>
  );
};

export default TopCommandBar;
