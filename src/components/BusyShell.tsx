import React, { useState, useEffect } from "react";
import { getBSTodayLong } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";
import { RightButtonBar } from "./RightButtonBar";

const S = { background: "#C9DEB5", color: "#000000", border: "1px solid #000000" } as const;
const S_DARK = { background: "#D4EABD", color: "#000000", border: "1px solid #000000" } as const;
const S_TEXT = { color: "#000000" } as const;

export const TitleBar: React.FC<{ onMinimize?: () => void }> = ({ onMinimize }) => {
  const { companySettings, currentFiscalYear, logout } = useStore();
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
      logout();
      setTimeout(() => window.location.reload(), 100);
    }
  };

  const btnHover = (e: React.MouseEvent<HTMLSpanElement>, enter: boolean) => {
    (e.currentTarget as HTMLSpanElement).style.background = enter ? "#C9DEB5" : "transparent";
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 22,
        background: "#D4EABD",
        color: "#000000",
        fontSize: 11,
        padding: "0 8px",
        borderBottom: "1px solid #000000",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 18,
            height: 18,
            background: "#C9DEB5",
            border: "1px solid #000000",
            color: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: 12,
          }}
        >
          S
        </div>
        <span>
          Sutra ERP 2.0 | Nepal Edition | VAT Ready | {company} ({fy})
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 13 }}>
        {[
          { label: "—", onClick: onMinimize, title: "Minimize" },
          {
            label: isFullscreen ? "❐" : "□",
            onClick: handleFullscreen,
            title: isFullscreen ? "Restore" : "Fullscreen",
          },
          { label: "✕", onClick: handleClose, title: "Close" },
        ].map(({ label, onClick, title }) => (
          <span
            key={title}
            onClick={onClick}
            title={title}
            style={{
              cursor: "pointer",
              padding: "0 6px",
              lineHeight: "18px",
              display: "inline-block",
              borderRadius: 2,
            }}
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

  useEffect(() => {
    const update = () => {
      try { setBsDate(getBSTodayLong()); } catch { /* ignore */ }
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;

  const cellStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    borderRight: "1px solid #000000",
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
        background: "#D4EABD",
        borderTop: "1px solid #000000",
        fontSize: 11,
        color: "#000000",
      }}
    >
      <div style={{ ...cellStyle, fontWeight: "bold", fontSize: 15 }}>Sutra</div>
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
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderLeft: "1px solid #000000",
          padding: "0 12px",
          height: "100%",
        }}
      >
        <div
          style={{
            background: "#C9DEB5",
            color: "#000000",
            padding: "1px 5px",
            fontSize: 10,
            fontWeight: "bold",
            border: "1px solid #000000",
          }}
        >
          ACCOUNTING SOFTWARE
        </div>
        <span style={{ fontWeight: "bold" }}>{weekday}</span>
        <div style={{ flexDirection: "column" }}>
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
      background: "#D4EABD",
      borderTop: "1px solid #000000",
      color: "#000000",
      fontSize: 11,
    }}
  >
    {hints.map((h) => (
      <span key={h}>[ {h} ]</span>
    ))}
  </div>
);

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

export const ShortcutSidebar: React.FC<React.ComponentProps<typeof RightButtonBar>> = (props) => {
  return <RightButtonBar {...props} />;
};

export const PillTitle: React.FC<{ title: string; variant?: "tally" | "standard" }> = ({
  title,
  variant = "tally",
}) => (
  <div
    className={variant === "standard" ? "flex justify-center mb-2 mt-1" : ""}
    style={
      variant === "tally"
        ? { display: "flex", justifyContent: "center", marginBottom: 10, marginTop: 4 }
        : {}
    }
  >
    <span
      className={
        variant === "standard"
          ? "inline-block font-semibold text-[13px] px-[18px] py-[3px] text-center border"
          : ""
      }
      style={
        variant === "standard"
          ? {
              background: "#D4EABD",
              color: "#000000",
              border: "1px solid #000000",
              borderRadius: "4px",
            }
          : variant === "tally"
            ? {
                display: "inline-block",
                background: "#C9DEB5",
                color: "#000000",
                fontWeight: "bold",
                fontSize: 13,
                padding: "3px 18px",
                textAlign: "center",
                borderRadius: 4,
                border: "1px solid #000000",
              }
            : {}
      }
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
    className={variant === "standard" ? "bg-white border border-gray-200 rounded-md p-3" : ""}
    style={
      variant === "tally"
        ? {
            background: "#EBF5E2",
            border: "1px solid #000000",
            padding: "10px 14px",
            ...style,
          }
        : style
    }
  >
    {children}
  </div>
);

export const GroupBox: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div
    style={{
      border: "1px solid #000000",
      padding: "12px 10px 8px",
      position: "relative",
      marginTop: 10,
      borderRadius: 4,
      background: "#EBF5E2",
    }}
  >
    <span
      style={{
        position: "absolute",
        top: -8,
        left: 8,
        background: "#EBF5E2",
        padding: "0 4px",
        color: "#000000",
        fontSize: 11,
        fontWeight: "bold",
      }}
    >
      {label}
    </span>
    {children}
  </div>
);

export const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 3 }}>
    <span
      style={{
        color: "#000000",
        minWidth: 130,
        textAlign: "right",
        paddingRight: 8,
        paddingTop: 2,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <span style={{ flex: 1, color: "#000000" }}>{children}</span>
  </div>
);

export const BusyInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { width?: string | number }
> = (props) => (
  <input
    {...props}
    style={{
      border: "1px solid #000000",
      background: "#EBF5E2",
      color: "#000000",
      height: 20,
      padding: "0 3px",
      width: props.width || "100%",
      ...props.style,
    }}
  />
);

export const FlatBtn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; mnemonic?: string }
> = ({ label, mnemonic, ...rest }) => {
  const idx = mnemonic ? label.toLowerCase().indexOf(mnemonic.toLowerCase()) : -1;
  return (
    <button
      style={{
        background: "#D4EABD",
        border: "1px solid #000000",
        color: "#000000",
        padding: "4px 12px",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
        minWidth: 64,
        textAlign: "center",
      }}
      {...rest}
    >
      {idx >= 0 ? (
        <>
          {label.slice(0, idx)}
          <u>{label[idx]}</u>
          {label.slice(idx + 1)}
        </>
      ) : (
        label
      )}
    </button>
  );
};
