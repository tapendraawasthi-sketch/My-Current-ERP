import React, { useState, useEffect } from "react";
import { getBSTodayLong } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";
 
// ── TITLE BAR ────────────────────────────────────────────────────
export const TitleBar: React.FC = () => {
  const { companySettings, currentFiscalYear, currentUser } = useStore();
  const company = companySettings?.company_name || "Company";
  const fy = currentFiscalYear ? `F.Y. ${currentFiscalYear.name}` : "";
  const user = currentUser?.username || "NA";
  
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 36, background: "var(--color-sidebar-bg)", padding: "0 16px" }}
    >
      <div className="flex items-center gap-2">
        <div style={{ width: 20, height: 20, background: "var(--color-accent)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 12 }}>S</div>
        <span style={{ color: "white", fontWeight: 600, fontSize: 13, letterSpacing: "-0.01em" }}>Sutra ERP</span>
        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", margin: "0 4px" }} />
        <span style={{ color: "var(--color-sidebar-text)", fontSize: 11 }}>{company} ({fy})</span>
      </div>
      <div className="flex items-center">
        <div style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.70)", padding: "2px 10px", borderRadius: 3, fontSize: 11 }}>
          {user}
        </div>
      </div>
    </div>
  );
};
 
// ── STATUS BAR ───────────────────────────────────────────────────
export const StatusBar: React.FC = () => {
  const { companySettings, currentUser, currentFiscalYear } = useStore();
  const company = companySettings?.company_name || "—";
  const vatNo = companySettings?.tax_registration_number || "—";
  const user = currentUser?.username || "NA";
  const fy = currentFiscalYear?.name || "—";
  const [bsDate, setBsDate] = useState("");
  useEffect(() => {
    setBsDate(getBSTodayLong());
  }, []);
 
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2,"0")}-${String(today.getMonth()+1).padStart(2,"0")}-${today.getFullYear()}`;
 
  return (
    <div
      className="flex items-center shrink-0"
      style={{ height: 26, background: "var(--color-surface-raised)", borderTop: "1px solid var(--color-border)", padding: "0 16px" }}
    >
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>COMPANY</span>
          <span style={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500 }}>{company}</span>
        </div>
        <div style={{ width: 1, height: 12, background: "var(--color-border)" }} />
        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>F.Y.</span>
          <span style={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500 }}>{fy}</span>
        </div>
        <div style={{ width: 1, height: 12, background: "var(--color-border)" }} />
        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>VAT NO</span>
          <span style={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500 }}>{vatNo}</span>
        </div>
        <div style={{ width: 1, height: 12, background: "var(--color-border)" }} />
        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>USER</span>
          <span style={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500 }}>{user}</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>BS</span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500 }}>{bsDate}</span>
          </div>
          <div style={{ width: 1, height: 12, background: "var(--color-border)" }} />
          <div className="flex items-center gap-1.5">
            <span style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>AD</span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500 }}>{dateStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
 
// ── COMMAND HINT BAR ─────────────────────────────────────────────
export const CommandHintBar: React.FC<{ hints?: string[] }> = () => null;
 
// ── SHORTCUT KEYS RIGHT SIDEBAR ──────────────────────────────────
export const ShortcutSidebar: React.FC<{ onShortcut?: (key: string) => void }> = () => null;
 
// ── PAGE PILL TITLE ──────────────────────────────────────────────
export const PillTitle: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, marginTop: 4 }}>
    <span className="busy-pill">{title}</span>
  </div>
);
 
// ── FORM PANEL WRAPPER ───────────────────────────────────────────
export const FormPanel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: "#e8e4f0",
      border: "1px solid #a89cc4",
      padding: "10px 14px",
      ...style,
    }}
  >
    {children}
  </div>
);
 
// ── GROUP BOX ────────────────────────────────────────────────────
export const GroupBox: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="busy-groupbox">
    <span className="busy-groupbox-label">{label}</span>
    {children}
  </div>
);
 
// ── FIELD ROW ────────────────────────────────────────────────────
export const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="busy-field-row">
    <span className="busy-field-label">{label}</span>
    <span className="busy-field-value">{children}</span>
  </div>
);
 
// ── BUSY INPUT ───────────────────────────────────────────────────
export const BusyInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    style={{ border: "1px solid #808080", background: "#fff", color: "#000", height: 20, padding: "0 3px", width: props.width || "100%", ...props.style }}
  />
);
 
// ── FLAT BUTTON ──────────────────────────────────────────────────
export const FlatBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; mnemonic?: string }> = ({ label, mnemonic, ...rest }) => {
  const idx = mnemonic ? label.toLowerCase().indexOf(mnemonic.toLowerCase()) : -1;
  return (
    <button className="busy-flat-btn" {...rest}>
      {idx >= 0 ? (
        <>
          {label.slice(0, idx)}
          <u>{label[idx]}</u>
          {label.slice(idx + 1)}
        </>
      ) : label}
    </button>
  );
};
