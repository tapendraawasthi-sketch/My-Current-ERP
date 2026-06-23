import React, { useState, useEffect } from "react";
import { getBSTodayLong } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";
 
// ── TITLE BAR ────────────────────────────────────────────────────
export const TitleBar: React.FC = () => {
  const { companySettings, currentFiscalYear } = useStore();
  const company = companySettings?.company_name || "Company";
  const fy = currentFiscalYear ? `F.Y. ${currentFiscalYear.name}` : "";
  return (
    <div
      className="flex items-center justify-between px-2 shrink-0"
      style={{ height: 22, background: "#1f2a44", color: "#ffffff", fontSize: 11 }}
    >
      <div className="flex items-center gap-1">
        <div style={{ width: 18, height: 18, background: "#1557b0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 12 }}>S</div>
        <span>Sutra ERP 2.0 | Nepal Edition | VAT Ready | {company} ({fy})</span>
      </div>
      <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
        <span style={{ cursor: "pointer" }}>—</span>
        <span style={{ cursor: "pointer" }}>□</span>
        <span style={{ cursor: "pointer" }}>✕</span>
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
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = `${String(today.getDate()).padStart(2,"0")}-${String(today.getMonth()+1).padStart(2,"0")}-${today.getFullYear()}`;
 
  return (
    <div
      className="flex items-center shrink-0"
      style={{ height: 28, background: "#e0e0e0", borderTop: "1px solid #a0a0a0", fontSize: 11 }}
    >
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #a0a0a0", height: "100%", fontWeight: "bold", fontSize: 15, color: "#1557b0" }}>Sutra</div>
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #a0a0a0", height: "100%", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 11 }}>{company}</div>
        <div style={{ fontSize: 10, color: "#555" }}>F.Y.: {fy}</div>
      </div>
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #a0a0a0", height: "100%", flexDirection: "column", justifyContent: "center" }}>
        <div>VAT No.: {vatNo}</div>
        <div style={{ color: "#555" }}>User : {user}</div>
      </div>
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #a0a0a0", height: "100%", flexDirection: "column", justifyContent: "center" }}>
        <div>State : Nepal</div>
        <div style={{ color: "#555" }}>Currency : रू</div>
      </div>
      <div className="ml-auto flex items-center px-3" style={{ gap: 6, borderLeft: "1px solid #a0a0a0", height: "100%" }}>
        <div style={{ background: "#cc0000", color: "#fff", padding: "1px 5px", fontSize: 10, fontWeight: "bold" }}>ACCOUNTING SOFTWARE</div>
        <span style={{ fontWeight: "bold" }}>{weekday}</span>
        <div style={{ flexDirection: "column" }}><div>BS Date: {bsDate}</div><div style={{ color: "#555" }}>AD Date: {dateStr}</div></div>
      </div>
    </div>
  );
};
 
// ── COMMAND HINT BAR ─────────────────────────────────────────────
export const CommandHintBar: React.FC<{ hints?: string[] }> = ({ hints = ["Esc - Quit", "F2 - Save", "F5 - List", "F3 - Add New"] }) => (
  <div
    className="flex items-center gap-4 px-3 shrink-0"
    style={{ height: 20, background: "#d8d8d8", borderTop: "1px solid #bbb", color: "#444", fontSize: 11 }}
  >
    {hints.map(h => <span key={h}>[ {h} ]</span>)}
  </div>
);
 
// ── SHORTCUT KEYS RIGHT SIDEBAR ──────────────────────────────────
const fKeys = [
  { key: "F1", label: "Help" },
  { key: "F2", label: "Add Account" },
  { key: "F3", label: "Add Item" },
  { key: "F4", label: "Add Master" },
  { key: "F5", label: "Add Voucher" },
  { key: "F6", label: "Add Payment" },
  { key: "F7", label: "Add Receipt" },
  { key: "F8", label: "Add Journal" },
  { key: "F9", label: "Add Sales" },
];
const quickKeys = [
  { key: "B", label: "Balance Sheet" },
  { key: "T", label: "Trial Balance" },
  { key: "S", label: "Stock Status" },
  { key: "A", label: "Acc. Summary" },
  { key: "L", label: "Acc. Ledger" },
  { key: "V", label: "VAT Report" },
  { key: "D", label: "Day Book" },
  { key: "G", label: "GST/VAT Summary" },
  { key: "U", label: "Switch User" },
  { key: "F", label: "Configuration" },
  { key: "K", label: "Lock Program" },
];
 
export const ShortcutSidebar: React.FC<{ onShortcut?: (key: string) => void }> = ({ onShortcut }) => {
  return (
    <div
      className="flex flex-col shrink-0 overflow-y-auto"
      style={{ width: 148, background: "#f0f0f0", borderLeft: "1px solid #a0a0a0", fontSize: 11 }}
    >
      <div style={{ background: "#c8d4e0", textAlign: "center", padding: "3px 0", fontWeight: "bold", borderBottom: "1px solid #a0a0a0" }}>
        Shortcut Keys
      </div>
      {fKeys.map(({ key, label }) => (
        <div
          key={key}
          onClick={() => onShortcut?.(key)}
          className="flex items-center"
          style={{ height: 22, borderBottom: "1px solid #d0d0d0", cursor: "pointer", background: "#e8e8e8" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#d0e0f5")}
          onMouseLeave={e => (e.currentTarget.style.background = "#e8e8e8")}
        >
          <span style={{ width: 32, color: "#8b1a1a", fontWeight: "bold", textAlign: "center", flexShrink: 0 }}>{key}</span>
          <span style={{ color: "#000" }}>{label}</span>
        </div>
      ))}
      <div style={{ height: 6, borderBottom: "1px solid #a0a0a0" }} />
      {quickKeys.map(({ key, label }) => (
        <div
          key={key}
          onClick={() => onShortcut?.(key)}
          className="flex items-center"
          style={{ height: 22, borderBottom: "1px solid #d0d0d0", cursor: "pointer", background: "#e8e8e8" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#d0e0f5")}
          onMouseLeave={e => (e.currentTarget.style.background = "#e8e8e8")}
        >
          <span style={{ width: 32, color: "#8b1a1a", fontWeight: "bold", textAlign: "center", flexShrink: 0 }}>{key}</span>
          <span style={{ color: "#000" }}>{label}</span>
        </div>
      ))}
      <div style={{ height: 6, borderBottom: "1px solid #a0a0a0" }} />
      <div style={{ background: "#c8d4e0", textAlign: "center", padding: "2px 0", fontSize: 10 }}>Training Videos</div>
      <div style={{ color: "#1557b0", textDecoration: "underline", textAlign: "center", padding: "2px 0", cursor: "pointer", fontSize: 11 }}>IRD Portal</div>
      <div style={{ color: "#1557b0", textDecoration: "underline", textAlign: "center", padding: "2px 0", cursor: "pointer", fontSize: 11 }}>e-TDS Portal</div>
      <div style={{ textAlign: "center", padding: "2px 0", fontSize: 11 }}>F10 Calculator</div>
    </div>
  );
};
 
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
