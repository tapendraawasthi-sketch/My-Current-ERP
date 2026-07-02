import React, { useState, useEffect } from "react";
import { getBSTodayLong } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";
import { RightButtonBar } from "./RightButtonBar";

// TitleBar (Section 7.1): the fake minimize/maximize/close window-chrome buttons
// have been removed entirely. This component now renders nothing — it is kept
// as a no-op export only so any remaining import elsewhere in the codebase does
// not break the build. Do not render this component; TopMenuBar/BusyMenuBar is
// the real application header now.
export const TitleBar: React.FC<{ onMinimize?: () => void }> = () => null;

// StatusBar (Section 7.2): now matches the dark navy chrome of the top bar
// instead of the Tally-green #D4EABD, creating a professional "bookend" look.
// The redundant "ACCOUNTING SOFTWARE" badge (Section 15.3) has been removed.
export const StatusBar: React.FC = () => {
  const { companySettings, currentUser, currentFiscalYear } = useStore();
  const company = companySettings?.companyNameEn || companySettings?.name || "—";
  const vatNo = companySettings?.vatNumber || companySettings?.panNumber || "—";
  const user = currentUser?.username || currentUser?.name || "NA";
  const fy = currentFiscalYear?.name || "—";
  const [bsDate, setBsDate] = useState("");

  useEffect(() => {
    setBsDate(getBSTodayLong());
  }, []);

  const today = new Date();
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;

  const cellStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "0 10px",
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
      <div style={{ ...cellStyle, fontWeight: 700, fontSize: 13, color: "#ffffff" }}>Sutra</div>
      <div style={cellStyle}>
        <div style={{ fontSize: 11, color: "#ffffff" }}>{company}</div>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>F.Y.: {fy}</div>
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
          borderLeft: "1px solid #2d3748",
          padding: "0 12px",
          height: "100%",
        }}
      >
        <span style={{ fontWeight: 600, color: "#ffffff" }}>{weekday}</span>
        <div style={{ flexDirection: "column" }}>
          <div>BS: {bsDate}</div>
          <div>AD: {dateStr}</div>
        </div>
      </div>
    </div>
  );
};

// CommandHintBar (Section 7.3): kept available for contextual use inside a
// specific voucher/form screen (pass real hints as props), but is no longer
// rendered globally in Layout.tsx since RightButtonBar already covers
// shortcut discovery — two persistent shortcut displays was redundant clutter.
export const CommandHintBar: React.FC<{ hints?: string[] }> = ({
  hints = ["Esc - Cancel", "F2 - Save", "F5 - List", "F3 - Add New"],
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "0 12px",
      flexShrink: 0,
      height: 22,
      background: "#1e2433",
      borderTop: "1px solid #2d3748",
      color: "#94a3b8",
      fontSize: 11,
    }}
  >
    {hints.map((h) => (
      <span key={h}>{h}</span>
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

export const ShortcutSidebar: React.FC<React.ComponentProps<typeof RightButtonBar>> = (props) => {
  return <RightButtonBar {...props} />;
};

// PillTitle (Section 1.2 / 1.1): replaced Tally-green pill backgrounds
// (#C9DEB5 / #D4EABD) with a clean light-blue pill matching your brand accent.
export const PillTitle: React.FC<{ title: string; variant?: "tally" | "standard" }> = ({
  title,
}) => (
  <div className="flex justify-center mb-2 mt-1">
    <span className="inline-block font-semibold text-[13px] px-4 py-1 text-center rounded-full bg-[#eef2ff] text-[#1557b0] border border-[#c7d2fe]">
      {title}
    </span>
  </div>
);

// FormPanel (Section 1.2): white background, soft border, rounded — no more
// #EBF5E2 green fill and hard black border.
export const FormPanel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  variant?: "tally" | "standard";
}> = ({ children, style }) => (
  <div
    className="bg-white border border-gray-200 rounded-lg"
    style={{ padding: "14px 16px", ...style }}
  >
    {children}
  </div>
);

// GroupBox (Section 1.2): white/near-white background, gray-300 border
// instead of hard black.
export const GroupBox: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div
    style={{
      border: "1px solid #d1d5db",
      padding: "14px 12px 10px",
      position: "relative",
      marginTop: 12,
      borderRadius: 6,
      background: "#f9fafb",
    }}
  >
    <span
      style={{
        position: "absolute",
        top: -9,
        left: 10,
        background: "#f9fafb",
        padding: "0 6px",
        color: "#374151",
        fontSize: 11,
        fontWeight: 700,
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
  <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 6 }}>
    <span
      style={{
        color: "#4b5563",
        fontSize: 11,
        fontWeight: 500,
        minWidth: 130,
        textAlign: "right",
        paddingRight: 8,
        paddingTop: 5,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <span style={{ flex: 1 }}>{children}</span>
  </div>
);

// BusyInput (Section 1.2 / 4.5): proper modern focus ring added, gray-300
// border, rounded-md, 32px height — no more Win98-style flat field.
export const BusyInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { width?: string | number }
> = ({ width, style, ...props }) => (
  <input
    {...props}
    className="transition-shadow duration-100"
    style={{
      border: "1px solid #d1d5db",
      background: props.readOnly ? "#f9fafb" : "#ffffff",
      color: "#111827",
      height: 32,
      padding: "0 8px",
      width: width || "100%",
      borderRadius: 6,
      fontSize: 12,
      outline: "none",
      ...style,
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = "#1557b0";
      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(21,87,176,0.12)";
      props.onFocus?.(e);
    }}
    onBlur={(e) => {
      e.currentTarget.style.borderColor = "#d1d5db";
      e.currentTarget.style.boxShadow = "none";
      props.onBlur?.(e);
    }}
  />
);

// FlatBtn (Section 6.1): deprecated Tally-green button retired in favor of
// the canonical primary-blue button style used everywhere else.
export const FlatBtn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; mnemonic?: string }
> = ({ label, mnemonic, ...rest }) => {
  const idx = mnemonic ? label.toLowerCase().indexOf(mnemonic.toLowerCase()) : -1;
  return (
    <button
      className="bg-[#1557b0] hover:bg-[#0f4a96] text-white transition-colors"
      style={{
        border: "none",
        padding: "6px 14px",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 500,
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
