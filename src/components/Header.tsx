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
import { Bell, LogOut, Settings, ShieldAlert, HelpCircle, Search, Sun, Moon } from "lucide-react";

const Header: React.FC = () => {
  const {
    companySettings,
    currentUser,
    logout,
    notifications,
    setCurrentPage,
    currentFiscalYear,
    fiscalYears,
    setCurrentFiscalYear,
  } = useStore();
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
    <header
      className="h-12 bg-white border-b px-3 flex items-center justify-between sticky top-0 z-40 select-none relative"
      style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: "linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%)" }}
      />
      {/* 1. Left Section: Breadcrumb Path Tracking */}
      <div className="flex items-center gap-1.5 font-medium shrink-0">
        <Breadcrumb />
      </div>

      {/* Global Search trigger */}
      <div className="hidden md:block mx-4 flex-1 max-w-xs relative">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between h-9 px-2.5 text-[12px] border border-slate-200 rounded-lg bg-[#f8fafc] text-slate-400 hover:bg-white transition-colors"
          style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}
        >
          <span className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span>Search anything...</span>
          </span>
          <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] bg-white border border-slate-200 rounded-md font-mono text-slate-500">
            /
          </kbd>
        </button>
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>

      {/* 2. Middle Section: Company Header Entity Info */}
      <div className="hidden lg:flex flex-col items-center gap-0 absolute left-1/2 -translate-x-1/2">
        <span className="text-[13px] font-black text-slate-800 truncate max-w-xs leading-none tracking-tight">
          {companySettings?.logo ? (
            <img src={companySettings.logo} className="h-6 w-auto" alt={companySettings.name} />
          ) : (
            companySettings?.name || "Sutra ERP"
          )}
        </span>
        {currentFiscalYear ? (
          <select
            className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold uppercase tracking-widest leading-none mt-0.5 bg-transparent border-none outline-none focus:ring-0 p-0 cursor-pointer text-center text-center-last"
            style={{ textAlignLast: "center" }}
            value={currentFiscalYear.id}
            onChange={(e) => {
              if (e.target.value) {
                setCurrentFiscalYear(e.target.value);
              }
            }}
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest leading-none mt-0.5">
            FY 2083/84
          </span>
        )}
      </div>

      {/* 3. Right Section: Live Calendars, Notifiers, User Session Dropdown */}
      <div className="flex items-center gap-4">
        {/* Date visual display widget */}
        <div className="hidden md:flex flex-col text-right pr-4 border-r border-slate-200 gap-0.5">
          <span
            className="text-[11.5px] font-semibold text-slate-700 leading-none"
            title="Bikram Sambat Nepali calendar"
          >
            {dateStrBS} (B.S.)
          </span>
          <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
            {dateStrAD} (A.D.)
          </span>
        </div>

        {/* Help docs and Notification alerts bell */}
        <div className="flex items-center gap-1.5" ref={alertsRef}>
          <a
            href="https://docs.sutraerp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-[#f1f5f9] transition-all duration-150"
            title="Help Documentation"
          >
            <HelpCircle className="h-4 w-4" />
          </a>

          <button
            type="button"
            onClick={toggleDark}
            title="Toggle dark mode"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-[#f1f5f9] transition-all duration-150"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-[#f1f5f9] transition-all duration-150 relative"
              title="Notification Center"
            >
              <Bell className="h-4 w-4" />
              {unreadAlerts > 0 && (
                <span
                  className="absolute top-1 right-1 h-3.5 min-w-[14px] text-[8px] font-bold text-white rounded-full flex items-center justify-center px-0.5 border border-white"
                  style={{
                    background: "linear-gradient(135deg, #dc2626 0%, #9f1239 100%)",
                    boxShadow: "0 1px 4px rgba(220,38,38,0.4)",
                  }}
                >
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
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                border: "2px solid rgba(99,102,241,0.3)",
                boxShadow: "0 2px 6px rgba(79,70,229,0.25)",
              }}
            >
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="hidden sm:flex flex-col text-left mr-1 shrink-0">
              <span className="text-[12px] font-bold text-slate-800 leading-none">
                {currentUser?.name}
              </span>
              <span className="text-[10px] font-bold text-indigo-500 tracking-wider uppercase leading-none mt-0.5">
                {currentUser?.role || "User"}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50"
              style={{ boxShadow: "0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)" }}
            >
              <div
                className="px-4 py-3 border-b border-slate-100"
                style={{ background: "linear-gradient(135deg, #fafbff 0%, #f1f5f9 100%)" }}
              >
                <p className="text-[12px] font-bold text-slate-800 truncate">{currentUser?.name}</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5 truncate">
                  {currentUser?.email || "No email associated"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage("settings");
                  setProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-[#f8fafc] flex items-center gap-2.5 transition-colors"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                <span>Control Panel Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage("audit-logs");
                  setProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-[#f8fafc] flex items-center gap-2.5 transition-colors"
              >
                <ShieldAlert className="h-4 w-4 text-slate-400" />
                <span>Security logs audit</span>
              </button>

              <div className="border-t border-slate-100 my-1" />

              <button
                type="button"
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-red-650 hover:bg-red-50 hover:text-red-600 flex items-center gap-2.5 transition-colors"
              >
                <LogOut className="h-4 w-4 text-red-400" />
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
