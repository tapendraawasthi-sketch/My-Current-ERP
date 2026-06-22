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
  User,
  LogOut,
  Key,
  Settings,
  Heart,
  ShieldAlert,
  HelpCircle,
  Search,
  Sun,
  Moon,
} from "lucide-react";
import toast from "react-hot-toast";

const Header: React.FC = () => {
  const { companySettings, currentUser, logout, notifications, setCurrentPage, currentFiscalYear } = useStore();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const toggleDark = toggleTheme;

  const [dateStrBS, setDateStrBS] = useState("");
  const [dateStrAD, setDateStrAD] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const alertsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Current BS Date
    try {
      setDateStrBS(getBSTodayLong());
    } catch (e) {
      setDateStrBS(getBSToday());
    }

    // Current AD Date
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    setDateStrAD(today.toLocaleDateString("en-US", options));

    // Outside clicks handlers
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
    <header className="h-10 bg-white border-b px-3 flex items-center justify-between sticky top-0 z-40 select-none relative" style={{ borderColor: "var(--border)" }}>
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#1557b0]" />
      {/* 1. Left Section: Breadcrumb Path Tracking */}
      <div className="flex items-center gap-1.5 font-medium shrink-0">
        <Breadcrumb />
      </div>

      {/* Global Search trigger */}
      <div className="hidden md:block mx-4 flex-1 max-w-xs relative">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 text-gray-400 hover:bg-white transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <span>Search anything...</span>
          </span>
          <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] bg-white border border-gray-200 rounded font-mono text-gray-500">
            /
          </kbd>
        </button>
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>

      {/* 2. Middle Section: Company Header Entity Info */}
      <div className="hidden lg:flex flex-col items-center gap-0 absolute left-1/2 -translate-x-1/2">
        <span className="text-[12px] font-bold text-gray-800 truncate max-w-xs leading-none">
          {companySettings?.logo ? <img src={companySettings.logo} className="h-6 w-auto" alt={companySettings.name} /> : (companySettings?.name || "Sutra ERP")}
        </span>
        <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest leading-none mt-0.5">{currentFiscalYear?.name || "FY 2083/84"}</span>
      </div>

      {/* 3. Right Section: Live Calendars, Notifiers, User Session Dropdown */}
      <div className="flex items-center gap-4">
        {/* Date visual display widget */}
        <div className="hidden md:flex flex-col text-right pr-4 border-r border-gray-200 gap-0.5">
          <span
            className="text-[11px] font-semibold text-gray-700 leading-none"
            title="Bikram Sambat Nepali calendar"
          >
            {dateStrBS} (B.S.)
          </span>
          <span className="text-[10px] text-gray-400 leading-none">{dateStrAD} (A.D.)</span>
        </div>

        {/* Help docs and Notification alerts bell */}
        <div className="flex items-center gap-1.5" ref={alertsRef}>
          <a
            href="https://docs.sutraerp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="Help Documentation"
          >
            <HelpCircle className="h-4 w-4" />
          </a>

          <button type="button" onClick={toggleDark} title="Toggle dark mode" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors relative"
              title="Notification Center"
            >
              <Bell className="h-4 w-4" />
              {unreadAlerts > 0 && (
                <span className="absolute top-1 right-1 h-3.5 min-w-[14px] text-[8px] font-bold text-white bg-red-600 rounded-full flex items-center justify-center px-0.5 border border-white">
                  {unreadAlerts}
                </span>
              )}
            </button>

            {alertsOpen && <NotificationPanel onClose={() => setAlertsOpen(false)} />}
          </div>
        </div>

        {/* Logged in User visual profile controls */}
        <div className="relative shrink-0" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 group p-1 rounded-lg hover:bg-gray-100/70 transition-colors focus:outline-none"
            title="User Settings Context"
          >
            <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs shadow-inner">
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="hidden sm:flex flex-col text-left mr-1 shrink-0">
              <span className="text-xs font-bold text-gray-800 leading-none">
                {currentUser?.name}
              </span>
              <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase leading-none mt-1">
                {currentUser?.role || "User"}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50/50">
                <p className="text-xs font-bold text-gray-800 truncate">{currentUser?.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                  {currentUser?.email || "No email associated"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage("settings");
                  setProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Settings className="h-4 w-4 text-gray-500" />
                <span>Control Panel Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage("audit-logs");
                  setProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <ShieldAlert className="h-4 w-4 text-gray-500" />
                <span>Security logs audit</span>
              </button>

              <div className="border-t border-gray-200 my-1" />

              <button
                type="button"
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-red-650 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                <span>Logout Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
