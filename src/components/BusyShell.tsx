// @ts-nocheck
import React, { useState, useEffect } from "react";
import { getBSTodayLong } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";

/* ─── TitleBar ─────────────────────────────────────────────────────────────── */
export const TitleBar: React.FC<{ onMinimize?: () => void }> = ({ onMinimize }) => {
  const { companySettings, currentFiscalYear } = useStore();
  const company = companySettings?.companyNameEn || companySettings?.name || "Company";
  const fy = currentFiscalYear ? `F.Y. ${currentFiscalYear.name}` : "";
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleClose = () => {
    if (window.confirm("Exit Sutra ERP? Any unsaved changes will be lost.")) {
      try { window.close(); } catch {}
    }
  };

  return (
    <div className="busy-titlebar">
      <div className="busy-titlebar-left">
        <div className="busy-logo-box">S</div>
        <span style={{ fontSize: 11, fontWeight: 600 }}>
          Sutra ERP 3.0 &nbsp;|&nbsp; {company} &nbsp;|&nbsp; {fy} &nbsp;|&nbsp; VAT/TDS Ready
        </span>
      </div>
      <div className="busy-titlebar-buttons">
        <button className="busy-titlebar-btn" onClick={onMinimize} title="Minimize">—</button>
        <button className="busy-titlebar-btn" onClick={handleFullscreen} title={isFullscreen ? "Restore" : "Maximize"}>
          {isFullscreen ? "❐" : "□"}
        </button>
        <button className="busy-titlebar-btn close" onClick={handleClose} title="Close">✕</button>
      </div>
    </div>
  );
};

/* ─── StatusBar ─────────────────────────────────────────────────────────────── */
export const StatusBar: React.FC = () => {
  const { companySettings, currentUser, currentFiscalYear } = useStore();
  const company = companySettings?.companyNameEn || companySettings?.name || "—";
  const vatNo = companySettings?.vatNumber || companySettings?.panNumber || "—";
  const user = currentUser?.username || currentUser?.name || "NA";
  const fy = currentFiscalYear?.name || "—";
  const [bsDate, setBsDate] = useState("");

  useEffect(() => {
    try { setBsDate(getBSTodayLong()); } catch { setBsDate("—"); }
  }, []);

  const today = new Date();
  const adDate = `${String(today.getDate()).padStart(2,"0")}-${String(today.getMonth()+1).padStart(2,"0")}-${today.getFullYear()}`;
  const weekday = today.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <div className="busy-statusbar">
      <div className="busy-status-cell" style={{ minWidth: 48 }}>
        <span className="busy-status-pill">Sutra</span>
      </div>
      <div className="busy-status-cell">
        <span className="label">Company</span>
        <span className="value">{company}</span>
      </div>
      <div className="busy-status-cell">
        <span className="label">FY</span>
        <span className="value">{fy}</span>
      </div>
      <div className="busy-status-cell">
        <span className="label">PAN/VAT</span>
        <span className="value">{vatNo}</span>
      </div>
      <div className="busy-status-cell">
        <span className="label">User</span>
        <span className="value">{user}</span>
      </div>
      <div className="busy-status-cell" style={{ marginLeft: "auto" }}>
        <span className="label">BS Date</span>
        <span className="value">{bsDate}</span>
      </div>
      <div className="busy-status-cell">
        <span className="label">{weekday}</span>
        <span className="value">{adDate}</span>
      </div>
    </div>
  );
};

/* ─── CommandHintBar ────────────────────────────────────────────────────────── */
export const CommandHintBar: React.FC<{ hints?: string[] }> = ({
  hints = ["Esc-Quit", "F2-Save", "F4-Narration", "F5-List", "F6-Type", "F9-DelRow", "Ctrl+P-Print", "Alt+C-Company"],
}) => (
  <div className="busy-hint-bar">
    {hints.map((h) => {
      const [key, ...rest] = h.split("-");
      return (
        <span key={h} className="busy-hint-item">
          <span className="busy-hint-key">{key}</span>
          <span>{rest.join("-")}</span>
        </span>
      );
    })}
  </div>
);

/* ─── ShortcutSidebar ───────────────────────────────────────────────────────── */
const FKEYS = [
  { key: "F1", label: "Help" }, { key: "F2", label: "Save" },
  { key: "F3", label: "New Item" }, { key: "F4", label: "Narration" },
  { key: "F5", label: "Masters" }, { key: "F6", label: "Vch Type" },
  { key: "F7", label: "Stock" }, { key: "F8", label: "Stk Jrnl" },
  { key: "F9", label: "Del Row" }, { key: "F10", label: "Reports" },
  { key: "F11", label: "Features" }, { key: "F12", label: "Post" },
];

const QUICK_KEYS = [
  { key: "B", label: "Bal Sheet" }, { key: "T", label: "Trial Bal" },
  { key: "P", label: "Prft/Loss" }, { key: "L", label: "Ledger" },
  { key: "D", label: "Day Book" }, { key: "V", label: "VAT Rpt" },
  { key: "S", label: "Stk Status" }, { key: "O", label: "Outstandng" },
  { key: "U", label: "Switch User" }, { key: "?", label: "Shortcuts" },
];

export const ShortcutSidebar: React.FC<{ onShortcut?: (key: string) => void }> = ({ onShortcut }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="busy-shortcut-sidebar">
      <div className="busy-shortcut-header-row">Shortcut Keys</div>
      {FKEYS.map(({ key, label }) => (
        <div
          key={key}
          className="busy-shortcut-row"
          style={{ background: hovered === key ? "#d8e8f5" : undefined }}
          onClick={() => onShortcut?.(key)}
          onMouseEnter={() => setHovered(key)}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="busy-shortcut-key">{key}</span>
          <span className="busy-shortcut-label">{label}</span>
        </div>
      ))}
      <div className="busy-shortcut-header-row" style={{ marginTop: 4 }}>Quick Reports</div>
      {QUICK_KEYS.map(({ key, label }) => (
        <div
          key={key}
          className="busy-shortcut-row"
          style={{ background: hovered === key ? "#d8e8f5" : undefined }}
          onClick={() => onShortcut?.(key)}
          onMouseEnter={() => setHovered(key)}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="busy-shortcut-key">{key}</span>
          <span className="busy-shortcut-label">{label}</span>
        </div>
      ))}
      <div style={{ height: 6 }} />
      <div className="busy-shortcut-header-row">Links</div>
      <a href="https://ird.gov.np" target="_blank" rel="noopener noreferrer"
        style={{ color: "#1557b0", textDecoration: "underline", textAlign: "center", padding: "3px 0", display: "block", fontSize: 10 }}>
        IRD Nepal Portal
      </a>
      <a href="https://etds.ird.gov.np" target="_blank" rel="noopener noreferrer"
        style={{ color: "#1557b0", textDecoration: "underline", textAlign: "center", padding: "3px 0", display: "block", fontSize: 10 }}>
        e-TDS Portal
      </a>
    </div>
  );
};

/* ─── FormPanel (legacy wrapper) ────────────────────────────────────────────── */
export const FormPanel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children, style,
}) => (
  <div className="busy-card" style={{ ...style }}>
    <div className="busy-card-body">{children}</div>
  </div>
);

/* ─── PillTitle (legacy wrapper) ────────────────────────────────────────────── */
export const PillTitle: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: 2 }}>
    <div
      style={{
        display: "inline-block",
        background: "#1557b0",
        color: "#fff",
        fontWeight: 700,
        fontSize: 13,
        padding: "4px 20px",
        borderRadius: 2,
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {title}
    </div>
  </div>
);

/* ─── GroupBox ───────────────────────────────────────────────────────────────── */
export const GroupBox: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ border: "1px solid var(--busy-border)", padding: "12px 10px 8px", position: "relative", marginTop: 10, borderRadius: 2, background: "var(--busy-form-section)" }}>
    <span style={{ position: "absolute", top: -8, left: 8, background: "var(--busy-form-section)", padding: "0 4px", color: "#1a3a6a", fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
    {children}
  </div>
);

/* ─── FieldRow ────────────────────────────────────────────────────────────────── */
export const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 4 }}>
    <span style={{ color: "#5a7a9a", minWidth: 130, textAlign: "right", paddingRight: 8, paddingTop: 2, flexShrink: 0, fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
    <span style={{ flex: 1, color: "#1a2a3a" }}>{children}</span>
  </div>
);

/* ─── BusyInput ───────────────────────────────────────────────────────────────── */
export const BusyInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`busy-input ${props.className || ""}`} />
);

/* ─── FlatBtn ─────────────────────────────────────────────────────────────────── */
export const FlatBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: string }> = ({
  label, variant = "outline", ...rest
}) => (
  <button className={`btn btn-${variant}`} {...rest}>{label}</button>
);
