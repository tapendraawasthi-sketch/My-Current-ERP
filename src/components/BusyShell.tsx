// @ts-nocheck
import React, { useState, useEffect } from "react";
import { getBSTodayLong } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";
 
// ── TITLE BAR ────────────────────────────────────────────────────
export const TitleBar: React.FC<{ onMinimize?: () => void }> = ({ onMinimize }) => {
  const { companySettings, currentFiscalYear } = useStore();
  const company = companySettings?.company_name || "Company";
  const fy = currentFiscalYear ? `F.Y. ${currentFiscalYear.name}` : "";

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const handleMinimize = () => {
    if (onMinimize) onMinimize();
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleClose = () => {
    const confirmed = window.confirm("Exit Sutra ERP? Any unsaved changes will be lost.");
    if (confirmed) {
      try {
        window.close();
      } catch {
        // browser blocked window.close(); no-op
      }
    }
  };

  return (
    <div
      className="flex items-center justify-between px-2 shrink-0 select-none"
      style={{ height: 22, background: "#0d1b2a", color: "#ffffff", fontSize: 11 }}
    >
      <div className="flex items-center gap-1">
        <div style={{ width: 18, height: 18, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 12 }}>S</div>
        <span>Sutra ERP 2.0 | Nepal Edition | VAT Ready | {company} ({fy})</span>
      </div>
      <div className="flex items-center gap-1" style={{ fontSize: 13 }}>
        <span
          onClick={handleMinimize}
          title="Minimize"
          style={{
            cursor: "pointer",
            padding: "0 6px",
            lineHeight: "18px",
            display: "inline-block",
            borderRadius: 2,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1b3a5c")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >—</span>
        <span
          onClick={handleFullscreen}
          title={isFullscreen ? "Restore" : "Fullscreen"}
          style={{
            cursor: "pointer",
            padding: "0 6px",
            lineHeight: "18px",
            display: "inline-block",
            borderRadius: 2,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1b3a5c")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >{isFullscreen ? "❐" : "□"}</span>
        <span
          onClick={handleClose}
          title="Close"
          style={{
            cursor: "pointer",
            padding: "0 6px",
            lineHeight: "18px",
            display: "inline-block",
            borderRadius: 2,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#c0392b"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#ffffff"; }}
        >✕</span>
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
      style={{ height: 28, background: "#0d1b2a", borderTop: "1px solid #1b3a5c", fontSize: 11, color: "#fffffffff" }}
    >
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #1b3a5c", height: "100%", fontWeight: "bold", fontSize: 15, color: "#60a5fa" }}>Sutra</div>
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #1b3a5c", height: "100%", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 11 }}>{company}</div>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>F.Y.: {fy}</div>
      </div>
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #1b3a5c", height: "100%", flexDirection: "column", justifyContent: "center" }}>
        <div>VAT No.: {vatNo}</div>
        <div style={{ color: "#94a3b8" }}>User : {user}</div>
      </div>
      <div className="flex items-center px-2" style={{ borderRight: "1px solid #1b3a5c", height: "100%", flexDirection: "column", justifyContent: "center" }}>
        <div>State : Nepal</div>
        <div style={{ color: "#94a3b8" }}>Currency : रू</div>
      </div>
      <div className="ml-auto flex items-center px-3" style={{ gap: 6, borderLeft: "1px solid #1b3a5c", height: "100%" }}>
        <div style={{ background: "#f08a2c", color: "#fffffffff", padding: "1px 5px", fontSize: 10, fontWeight: "bold" }}>ACCOUNTING SOFTWARE</div>
        <span style={{ fontWeight: "bold" }}>{weekday}</span>
        <div style={{ flexDirection: "column" }}><div>BS Date: {bsDate}</div><div style={{ color: "#94a3b8" }}>AD Date: {dateStr}</div></div>
      </div>
    </div>
  );
};
 
// ── COMMAND HINT BAR ─────────────────────────────────────────────
export const CommandHintBar: React.FC<{ hints?: string[] }> = ({ hints = ["Esc - Quit", "F2 - Save", "F5 - List", "F3 - Add New"] }) => (
  <div
    className="flex items-center gap-4 px-3 shrink-0"
    style={{ height: 20, background: "#162a46", borderTop: "1px solid #1b3a5c", color: "#94a3b8", fontSize: 11 }}
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
      style={{ width: 148, background: "#0d1b2a", borderLeft: "1px solid #1b3a5c", fontSize: 11 }}
    >
      <div style={{ background: "#162a46", textAlign: "center", padding: "3px 0", fontWeight: "bold", borderBottom: "1px solid #1b3a5c", color: "#fffffffff" }}>
        Shortcut Keys
      </div>
      {fKeys.map(({ key, label }) => (
        <div
          key={key}
          onClick={() => onShortcut?.(key)}
          className="flex items-center"
          style={{ height: 22, borderBottom: "1px solid #1b3a5c", cursor: "pointer", background: "#0d1b2a" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1b3a5c")}
          onMouseLeave={e => (e.currentTarget.style.background = "#0d1b2a")}
        >
          <span style={{ width: 32, color: "#f08a2c", fontWeight: "bold", textAlign: "center", flexShrink: 0 }}>{key}</span>
          <span style={{ color: "#fffffffff" }}>{label}</span>
        </div>
      ))}
      <div style={{ height: 6, borderBottom: "1px solid #1b3a5c" }} />
      {quickKeys.map(({ key, label }) => (
        <div
          key={key}
          onClick={() => onShortcut?.(key)}
          className="flex items-center"
          style={{ height: 22, borderBottom: "1px solid #1b3a5c", cursor: "pointer", background: "#0d1b2a" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1b3a5c")}
          onMouseLeave={e => (e.currentTarget.style.background = "#0d1b2a")}
        >
          <span style={{ width: 32, color: "#f08a2c", fontWeight: "bold", textAlign: "center", flexShrink: 0 }}>{key}</span>
          <span style={{ color: "#fffffffff" }}>{label}</span>
        </div>
      ))}
      <div style={{ height: 6, borderBottom: "1px solid #1b3a5c" }} />
      <div style={{ background: "#162a46", textAlign: "center", padding: "2px 0", fontSize: 10, color: "#fffffffff" }}>Training Videos</div>
      <a href="https://ird.gov.np" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline", textAlign: "center", padding: "2px 0", display: "block", fontSize: 11 }}>IRD Portal</a>
      <a href="https://etds.ird.gov.np" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline", textAlign: "center", padding: "2px 0", display: "block", fontSize: 11 }}>e-TDS Portal</a>
      <div
        onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write('<html><body style="background:#1a1a2e;color:white;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center"><div id="d" style="font-size:48px;margin-bottom:16px">0</div><div style="display:grid;grid-template-columns:repeat(4,60px);gap:8px"><button onclick="cl()" style="background:#e74c3c;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">C</button><button onclick="pct()" style="background:#555;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">%</button><button onclick="ap(\'/\')" style="background:#555;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">/</button><button onclick="ap(\'*\')" style="background:#555;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">×</button><button onclick="ap(7)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">7</button><button onclick="ap(8)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">8</button><button onclick="ap(9)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">9</button><button onclick="ap(\'-\')" style="background:#555;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">−</button><button onclick="ap(4)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">4</button><button onclick="ap(5)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">5</button><button onclick="ap(6)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">6</button><button onclick="ap(\'+\')" style="background:#555;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">+</button><button onclick="ap(1)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">1</button><button onclick="ap(2)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">2</button><button onclick="ap(3)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">3</button><button onclick="eq()" style="background:#f08a2c;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px;grid-row:span 2">=</button><button onclick="ap(0)" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px;grid-column:span 2">0</button><button onclick="ap(\'.\')" style="background:#333;color:white;border:none;height:48px;font-size:16px;cursor:pointer;border-radius:4px">.</button></div></div><script>let e="",o="",p="";function ap(v){e+=v;document.getElementById("d").textContent=e}function cl(){e="";o="";p="";document.getElementById("d").textContent="0"}function eq(){try{document.getElementById("d").textContent=eval(e);e=String(eval(e))}catch{document.getElementById("d").textContent="Err";e=""}}function pct(){try{e=String(parseFloat(e)/100);document.getElementById("d").textContent=e}catch{}}</script></body></html>'); w.document.close(); }}}
        style={{ textAlign: "center", padding: "2px 0", fontSize: 11, color: "#f08a2c", cursor: "pointer", textDecoration: "underline" }}
      >F10 Calculator</div>    </div>
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
      background: "#0d1b2a",
      border: "1px solid #1b3a5c",
      padding: "10px 14px",
      ...style,
    }}
  >
    {children}
  </div>
);
 
// ── GROUP BOX ────────────────────────────────────────────────────
export const GroupBox: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="busy-groupbox" style={{ border: "1px solid #1b3a5c" }}>
    <span className="busy-groupbox-label" style={{ background: "#0d1b2a", color: "#f08a2c" }}>{label}</span>
    {children}
  </div>
);
 
// ── FIELD ROW ────────────────────────────────────────────────────
export const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="busy-field-row">
    <span className="busy-field-label" style={{ color: "#94a3b8" }}>{label}</span>
    <span className="busy-field-value" style={{ color: "#fffffffff" }}>{children}</span>
  </div>
);
 
// ── BUSY INPUT ───────────────────────────────────────────────────
export const BusyInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    style={{ border: "1px solid #1b3a5c", background: "#162a46", color: "#fffffffff", height: 20, padding: "0 3px", width: props.width || "100%", ...props.style }}
  />
);
 
// ── FLAT BUTTON ──────────────────────────────────────────────────
export const FlatBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; mnemonic?: string }> = ({ label, mnemonic, ...rest }) => {
  const idx = mnemonic ? label.toLowerCase().indexOf(mnemonic.toLowerCase()) : -1;
  return (
    <button className="busy-flat-btn" style={{ background: "#1b3a5c", border: "2px outset #2a4a6b", color: "#fffffffff" }} onMouseEnter={e => (e.currentTarget.style.background = "#2a4a6b")} onMouseLeave={e => (e.currentTarget.style.background = "#1b3a5c")} {...rest}>
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

