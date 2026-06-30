import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { getBSTodayLong, getBSToday } from "../lib/nepaliDate";
import Breadcrumb from "./Breadcrumb";
import { GlobalSearch } from "./GlobalSearch";
import { Bell, User, LogOut, Settings, HelpCircle, Search, Moon, Sun } from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../context/ThemeContext";

const Header: React.FC = () => {
  const { companySettings, currentUser, logout, notifications, setCurrentPage, currentFiscalYear } =
    useStore();
  const { theme, toggleTheme } = useTheme();
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
    } catch {
      setDateStrBS(getBSToday());
    }
    const today = new Date();
    setDateStrAD(
      today.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (alertsRef.current && !alertsRef.current.contains(target)) setAlertsOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
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

  const hdrStyle: React.CSSProperties = {
    height: 40,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 40,
    userSelect: "none",
    color: "#374151",
    flexShrink: 0,
  };

  const iconBtn: React.CSSProperties = {
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 4,
    padding: 6,
    cursor: "pointer",
    color: "#374151",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    right: 0,
    top: "100%",
    marginTop: 4,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    minWidth: 200,
    zIndex: 1000,
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  };

  const dropdownItem: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    fontSize: 12,
    cursor: "pointer",
    color: "#374151",
    background: "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
  };

  return (
    <header style={hdrStyle}>
      {/* Left: Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <Breadcrumb />
      </div>

      {/* Center: Search */}
      <div style={{ flex: 1, maxWidth: 280, margin: "0 16px" }} className="hidden md:block">
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 28,
            padding: "0 10px",
            fontSize: 12,
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: 3,
            cursor: "pointer",
            color: "#374151",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Search style={{ width: 13, height: 13, color: "#374151" }} />
            <span>Search anything...</span>
          </span>
          <kbd
            style={{
              fontSize: 9,
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 2,
              padding: "1px 4px",
              color: "#374151",
            }}
          >
            /
          </kbd>
        </button>
      </div>
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Company name center */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}
        className="hidden lg:block"
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
          {companySettings?.name || "Sutra ERP"}
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#6b7280",
          }}
        >
          {currentFiscalYear?.name || "FY 2083/84"}
        </div>
      </div>

      {/* Right: dates + icons */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Dates */}
        <div
          style={{
            textAlign: "right",
            paddingRight: 12,
            borderRight: "1px solid #000000",
            flexDirection: "column",
          }}
          className="hidden md:flex"
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: "#000000", display: "block" }}>
            {dateStrBS} (B.S.)
          </span>
          <span style={{ fontSize: 10, color: "#000000", display: "block" }}>
            {dateStrAD} (A.D.)
          </span>
        </div>

        {/* Help */}
        <a
          href="https://docs.sutraerp.com"
          target="_blank"
          rel="noopener noreferrer"
          style={iconBtn}
          title="Help"
        >
          <HelpCircle style={{ width: 16, height: 16, color: "#000000" }} />
        </a>


        {/* Notifications */}
        <div ref={alertsRef} style={{ position: "relative" }}>
          <button
            onClick={() => setAlertsOpen(!alertsOpen)}
            style={{ ...iconBtn, position: "relative" }}
            title="Notifications"
          >
            <Bell style={{ width: 16, height: 16, color: "#000000" }} />
            {unreadAlerts > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  width: 14,
                  height: 14,
                  background: "#C9DEB5",
                  border: "1px solid #000000",
                  borderRadius: "50%",
                  fontSize: 8,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000000",
                }}
              >
                {unreadAlerts}
              </span>
            )}
          </button>
          {alertsOpen && (
            <div style={{ ...dropdownStyle, width: 280 }}>
              <div
                style={{
                  padding: "8px 14px",
                  borderBottom: "1px solid #000000",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#000000",
                }}
              >
                Notifications
              </div>
              <div style={{ padding: "8px 14px", fontSize: 12, color: "#000000" }}>
                {notifications.length === 0 ? "No notifications." : `${unreadAlerts} unread`}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                background: "#C9DEB5",
                border: "1px solid #000000",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 12,
                color: "#000000",
              }}
            >
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="hidden sm:flex flex-col text-left" style={{ marginRight: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#000000", lineHeight: 1 }}>
                {currentUser?.name}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "#000000",
                  marginTop: 2,
                }}
              >
                {currentUser?.role || "User"}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div style={dropdownStyle}>
              <div
                style={{
                  padding: "8px 14px",
                  background: "#C9DEB5",
                  borderBottom: "1px solid #000000",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#000000" }}>
                  {currentUser?.name}
                </div>
                <div style={{ fontSize: 10, color: "#000000", marginTop: 2 }}>
                  {currentUser?.email || "No email"}
                </div>
              </div>
              <button
                style={dropdownItem}
                onClick={() => {
                  setCurrentPage("settings");
                  setProfileOpen(false);
                }}
              >
                <Settings style={{ width: 14, height: 14, color: "#000000" }} />
                <span>Settings</span>
              </button>
              <div style={{ height: 1, background: "#000000", margin: "2px 0" }} />
              <button
                style={{ ...dropdownItem }}
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                }}
              >
                <LogOut style={{ width: 14, height: 14, color: "#000000" }} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
