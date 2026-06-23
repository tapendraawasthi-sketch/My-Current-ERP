/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { getBSToday, getBSTodayLong } from "../lib/nepaliDate";
import Breadcrumb from "./Breadcrumb";
import NotificationPanel from "./ui/NotificationPanel";
import { GlobalSearch } from "./GlobalSearch";
import { useTheme } from "../context/ThemeContext";
import {
  Bell,
  LogOut,
  Settings,
  HelpCircle,
  Search,
  Sun,
  Moon,
} from "lucide-react";

const Header: React.FC = () => {
  const { currentUser, logout, notifications, setCurrentPage } = useStore();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [dateStrBS, setDateStrBS] = useState("");
  const [dateStrAD, setDateStrAD] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const alertsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setDateStrBS(getBSTodayLong());
    } catch (e) {
      setDateStrBS(getBSToday());
    }

    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    setDateStrAD(today.toLocaleDateString("en-US", options));

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setAlertsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  const unreadAlerts = notifications.filter((n) => !n.read).length;

  return (
    <header
      className="flex items-center justify-between sticky top-0 z-40 select-none"
      style={{
        height: "var(--header-height)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 20px",
        boxShadow: "0 1px 0 var(--color-border)",
      }}
    >
      {/* Left Section: Breadcrumb */}
      <div className="flex items-center shrink-0">
        <Breadcrumb />
      </div>

      {/* Middle Section: Global Search trigger */}
      <div className="hidden md:block mx-4 flex-1 max-w-sm relative absolute left-1/2 -translate-x-1/2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between transition-colors"
          style={{
            height: 34,
            padding: "0 10px",
            fontSize: "var(--font-size-base)",
            border: "1px solid var(--color-border-input)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface-sunken)",
            color: "var(--color-text-muted)"
          }}
        >
          <span className="flex items-center gap-1.5">
            <Search style={{ width: 14, height: 14, color: "var(--color-text-muted)" }} />
            <span>Search anything...</span>
          </span>
          <kbd
            className="hidden lg:flex items-center justify-center font-mono"
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-muted)"
            }}
          >
            /
          </kbd>
        </button>
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>

      {/* Right Section: Dates, Actions, Profile */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Date Display */}
        <div className="hidden md:flex flex-col text-right">
          <span style={{ color: "var(--color-text-primary)", fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>
            {dateStrBS} (B.S.)
          </span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 10, lineHeight: 1.2 }}>
            {dateStrAD} (A.D.)
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />

        {/* Action Icons */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative" ref={alertsRef}>
            <button
              type="button"
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="flex items-center justify-center transition-colors"
              style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "transparent", border: "none", cursor: "pointer" }}
              title="Notification Center"
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-sunken)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Bell style={{ width: 18, height: 18, color: "var(--color-text-muted)" }} />
              {unreadAlerts > 0 && (
                <span
                  className="absolute flex items-center justify-center"
                  style={{
                    top: -4,
                    right: -4,
                    width: 16,
                    height: 16,
                    background: "var(--color-accent)",
                    color: "white",
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: "50%",
                  }}
                >
                  {unreadAlerts}
                </span>
              )}
            </button>
            {alertsOpen && <NotificationPanel onClose={() => setAlertsOpen(false)} />}
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center transition-colors"
            style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "transparent", border: "none", cursor: "pointer" }}
            title="Toggle Theme"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-sunken)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {isDark ? (
              <Sun style={{ width: 18, height: 18, color: "var(--color-text-muted)" }} />
            ) : (
              <Moon style={{ width: 18, height: 18, color: "var(--color-text-muted)" }} />
            )}
          </button>
        </div>

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center justify-center focus:outline-none"
            style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--color-accent-subtle)", color: "var(--color-accent)", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
            title="User Settings"
          >
            {currentUser?.name?.charAt(0).toUpperCase() || "U"}
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 mt-2 py-1 z-50 flex flex-col"
              style={{
                width: 200,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-dropdown)",
              }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-raised)" }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }} className="truncate">
                  {currentUser?.name}
                </p>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }} className="truncate">
                  {currentUser?.email || "No email associated"}
                </p>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage("settings");
                    setProfileOpen(false);
                  }}
                  className="w-full text-left flex items-center transition-colors group"
                  style={{
                    height: 36,
                    padding: "0 14px",
                    gap: 10,
                    fontSize: 13,
                    color: "var(--color-text-primary)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Settings style={{ width: 14, height: 14, color: "var(--color-text-muted)" }} />
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setProfileOpen(false);
                  }}
                  className="w-full text-left flex items-center transition-colors group"
                  style={{
                    height: 36,
                    padding: "0 14px",
                    gap: 10,
                    fontSize: 13,
                    color: "var(--color-text-primary)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-negative-bg)";
                    e.currentTarget.style.color = "var(--color-negative)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--color-text-primary)";
                  }}
                >
                  <LogOut style={{ width: 14, height: 14, color: "inherit" }} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
