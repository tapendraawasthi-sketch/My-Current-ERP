// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { getBSTodayLong, getBSToday } from "../lib/nepaliDate";
import { GlobalSearch } from "./GlobalSearch";
import { Bell, User, LogOut, Settings, Search } from "lucide-react";
import toast from "react-hot-toast";

const Header: React.FC = () => {
  const { companySettings, currentUser, logout, notifications, setCurrentPage, currentFiscalYear } = useStore();
  const [dateStrBS, setDateStrBS] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const alertsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const unreadAlerts = (notifications || []).filter((n: any) => !n.read).length;

  useEffect(() => {
    try { setDateStrBS(getBSTodayLong()); } catch { setDateStrBS(getBSToday()); }
    const handleOutsideClick = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === "/" || (e.ctrlKey && e.key === "k")) && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <header style={{
      height: 36,
      background: "#dce8f5",
      borderBottom: "1px solid #a0b8d0",
      padding: "0 10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      userSelect: "none",
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#1a2a3a" }}>
          {companySettings?.name || "Sutra ERP"}
        </span>
        <span style={{ fontSize: 10, color: "#5a7a9a" }}>|</span>
        <span style={{ fontSize: 10, color: "#5a7a9a" }}>{currentFiscalYear?.name || "FY 2083/84"}</span>
      </div>

      {/* Center: Search */}
      <div style={{ flex: 1, maxWidth: 260, margin: "0 16px" }} className="hidden md:block">
        <button
          onClick={() => setSearchOpen(true)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", height: 24, padding: "0 8px", fontSize: 11, background: "#fff", border: "1px solid #a0b8d0", borderRadius: 2, cursor: "pointer", color: "#8a9ab0" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Search style={{ width: 12, height: 12 }} />
            <span>Search... (Ctrl+K)</span>
          </span>
          <kbd style={{ fontSize: 9, background: "#dce8f5", border: "1px solid #a0b8d0", borderRadius: 2, padding: "0 4px", color: "#5a7a9a" }}>/</kbd>
        </button>
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Date */}
        <div style={{ textAlign: "right", paddingRight: 10, borderRight: "1px solid #a0b8d0" }} className="hidden md:block">
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1a2a3a" }}>{dateStrBS} (BS)</div>
          <div style={{ fontSize: 9, color: "#5a7a9a" }}>{new Date().toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })} (AD)</div>
        </div>

        {/* Notifications */}
        <div ref={alertsRef} style={{ position: "relative" }}>
          <button onClick={() => setAlertsOpen(!alertsOpen)} style={{ background: "transparent", border: "none", cursor: "pointer", position: "relative", padding: 3 }}>
            <Bell style={{ width: 15, height: 15, color: "#5a7a9a" }} />
            {unreadAlerts > 0 && <span style={{ position: "absolute", top: 0, right: 0, width: 13, height: 13, background: "#dc2626", borderRadius: "50%", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{unreadAlerts}</span>}
          </button>
          {alertsOpen && (
            <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid #c8d8e8", borderRadius: 3, minWidth: 220, zIndex: 200, boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
              <div style={{ padding: "6px 12px", borderBottom: "1px solid #e8eef5", fontSize: 11, fontWeight: 700, color: "#1a2a3a" }}>Notifications</div>
              <div style={{ padding: "8px 12px", fontSize: 11, color: "#8a9ab0" }}>{unreadAlerts === 0 ? "No new notifications." : `${unreadAlerts} unread`}</div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button onClick={() => setProfileOpen(!profileOpen)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px" }}>
            <div style={{ width: 24, height: 24, background: "#1557b0", border: "1px solid #4080c0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#fff" }}>
              {(currentUser?.name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1a2a3a", lineHeight: 1 }}>{currentUser?.name}</span>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#5a7a9a" }}>{currentUser?.role || "User"}</span>
            </div>
          </button>
          {profileOpen && (
            <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid #c8d8e8", borderRadius: 3, minWidth: 180, zIndex: 200, boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
              <div style={{ padding: "7px 12px", background: "#dce8f5", borderBottom: "1px solid #c8d8e8", borderRadius: "3px 3px 0 0" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2a3a" }}>{currentUser?.name}</div>
                <div style={{ fontSize: 10, color: "#5a7a9a", marginTop: 1 }}>{currentUser?.email || "No email"}</div>
              </div>
              {[
                { label: "Settings", icon: Settings, onClick: () => { setCurrentPage("settings"); setProfileOpen(false); } },
                { label: "Logout", icon: LogOut, onClick: () => { logout(); setProfileOpen(false); } },
              ].map(({ label, icon: Icon, onClick }) => (
                <button key={label} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#1a2a3a", background: "transparent", border: "none", width: "100%", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f8fc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Icon style={{ width: 13, height: 13, color: "#5a7a9a" }} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
