import React, { useState, useEffect } from "react";
import { getBSTodayLong } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";
import { RightButtonBar } from "./RightButtonBar";

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
      try { 
        window.close(); 
        window.location.href = "about:blank";
      } catch {}
    }
  };

  const btnHover = (e: React.MouseEvent<HTMLSpanElement>, enter: boolean) => {
    const el = e.currentTarget as HTMLSpanElement;
    if (el.title === "Close") {
      el.style.background = enter ? "#dc2626" : "transparent";
      el.style.color = enter ? "#fff" : "inherit";
    } else {
      el.style.background = enter ? "#374151" : "transparent";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 22,
        background: "#1e2433",
        color: "#cbd5e1",
        fontSize: 11,
        padding: "0 8px",
        borderBottom: "1px solid #2d3748",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 18,
            height: 18,
            background: "#273148",
            border: "none",
            color: "#93c5fd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: 12,
          }}
        >
          S
        </div>
        <span>Sutra ERP 2.0 | Nepal Edition | VAT Ready | {company} ({fy})</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 13 }}>
        {[
          { label: "—", onClick: onMinimize, title: "Minimize" },
          { label: isFullscreen ? "❐" : "□", onClick: handleFullscreen, title: isFullscreen ? "Restore" : "Fullscreen" },
          { label: "✕", onClick: handleClose, title: "Close" },
        ].map(({ label, onClick, title }) => (
          <span
            key={title}
            onClick={onClick}
            title={title}
            style={{ cursor: "pointer", padding: "0 6px", lineHeight: "18px", display: "inline-block", borderRadius: 2 }}
            onMouseEnter={(e) => btnHover(e, true)}
            onMouseLeave={(e) => btnHover(e, false)}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export const StatusBar: React.FC = () => {
  const { companySettings, currentUser, currentFiscalYear } = useStore();
  const company = companySettings?.companyNameEn || companySettings?.name || "—";
  const vatNo = companySettings?.vatNumber || companySettings?.panNumber || "—";
  const user = currentUser?.username || currentUser?.name || "NA";
  const fy = currentFiscalYear?.name || "—";
  const [bsDate, setBsDate] = useState("");

  useEffect(() => { setBsDate(getBSTodayLong()); }, []);

  const today = new Date();
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = `${String(today.getDate()).padStart(2,"0")}-${String(today.getMonth()+1).padStart(2,"0")}-${today.getFullYear()}`;

  const cellStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    borderRight: "1px solid #2d3748",
    height: "100%",
    flexDirection: "column",
    justifyContent: "center",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        height: 28,
        background: "#1e2433",
        borderTop: "1px solid #2d3748",
        fontSize: 11,
        color: "#cbd5e1",
      }}
    >
      <div style={{ ...cellStyle, fontWeight: "bold", fontSize: 13, color: "#93c5fd" }}>Sutra</div>
      <div style={cellStyle}>
        <div style={{ fontSize: 11 }}>{company}</div>
        <div style={{ fontSize: 10 }}>F.Y.: {fy}</div>
      </div>
      <div style={cellStyle}>
        <div>VAT No.: {vatNo}</div>
        <div>User: {user}</div>
      </div>
      <div style={cellStyle}>
        <div>State: Nepal</div>
        <div>Currency: रू</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, borderLeft: "1px solid #2d3748", padding: "0 12px", height: "100%" }}>
        <div style={{ background: "#273148", color: "#94a3b8", padding: "1px 5px", fontSize: 10, fontWeight: "bold", border: "1px solid #374151" }}>
          ACCOUNTING SOFTWARE
        </div>
        <span style={{ fontWeight: "bold", color: "#cbd5e1" }}>{weekday}</span>
        <div style={{ flexDirection: "column", color: "#cbd5e1" }}>
          <div>BS Date: {bsDate}</div>
          <div>AD Date: {dateStr}</div>
        </div>
      </div>
    </div>
  );
};

export const CommandHintBar: React.FC<{ hints?: string[] }> = ({
  hints = ["Esc - Quit", "F2 - Save", "F5 - List", "F3 - Add New"],
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "0 12px",
      flexShrink: 0,
      height: 20,
      background: "#1e2433",
      borderTop: "1px solid #2d3748",
      color: "#6b7280",
      fontSize: 10,
    }}
  >
    {hints.map((h) => <span key={h}>[ {h} ]</span>)}
  </div>
);

export const ShortcutSidebar: React.FC<React.ComponentProps<typeof RightButtonBar>> = (props) => {
  return <RightButtonBar {...props} />;
};

export const PillTitle: React.FC<{ title: string; variant?: "tally" | "standard" }> = ({ title, variant = "tally" }) => (
  <div className={variant === "standard" ? "flex justify-center mb-2 mt-1" : ""} style={variant === "tally" ? { display: "flex", justifyContent: "center", marginBottom: 10, marginTop: 4 } : {}}>
    <span
      className={variant === "standard" ? "inline-block font-semibold text-[13px] px-[18px] py-[3px] text-center border rounded" : ""}
      style={variant === "standard" ? {
        background: '#e8f1ff', color: '#1557b0', border: '1px solid #1557b0'
      } : variant === "tally" ? {
        display: "inline-block",
        background: "#e8f1ff",
        color: "#1557b0",
        fontWeight: "600",
        fontSize: 12,
        padding: "3px 18px",
        textAlign: "center",
        borderRadius: 4,
        border: "1px solid #1557b0",
      } : {}}
    >
      {title}
    </span>
  </div>
);

export const FormPanel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  variant?: "tally" | "standard";
}> = ({ children, style, variant = "tally" }) => (
  <div
    className={
      variant === "standard"
        ? "bg-white border border-gray-200 rounded-md p-3"
        : ""
    }
    style={
      variant === "tally"
        ? {
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "12px 16px",
            ...style,
          }
        : style
    }
  >
    {children}
  </div>
);

export const GroupBox: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ border: "1px solid #e5e7eb", padding: "12px 10px 8px", position: "relative", marginTop: 10, borderRadius: 4, background: "#ffffff" }}>
    <span style={{ position: "absolute", top: -8, left: 8, background: "#ffffff", padding: "0 4px", color: "#6b7280", fontSize: 11, fontWeight: "600" }}>
      {label}
    </span>
    {children}
  </div>
);

export const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 3 }}>
    <span style={{ color: "#6b7280", minWidth: 130, textAlign: "right", paddingRight: 8, paddingTop: 2, flexShrink: 0 }}>
      {label}
    </span>
    <span style={{ flex: 1, color: "#1f2937" }}>{children}</span>
  </div>
);

export const BusyInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { width?: string | number }> = (props) => (
  <input
    {...props}
    style={{
      border: "1px solid #d1d5db",
      background: "#ffffff",
      color: "#1f2937",
      height: 24,
      padding: "0 3px",
      width: props.width || "100%",
      outline: "none",
      ...props.style,
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = "#1557b0";
      if (props.onFocus) props.onFocus(e);
    }}
    onBlur={(e) => {
      e.currentTarget.style.borderColor = "#d1d5db";
      if (props.onBlur) props.onBlur(e);
    }}
  />
);

export const FlatBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; mnemonic?: string }> = ({
  label, mnemonic, ...rest
}) => {
  const idx = mnemonic ? label.toLowerCase().indexOf(mnemonic.toLowerCase()) : -1;
  return (
    <button
      style={{
        background: "#ffffff",
        border: "1px solid #d1d5db",
        color: "#374151",
        padding: "4px 12px",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
        minWidth: 64,
        textAlign: "center",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
      {...rest}
    >
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
