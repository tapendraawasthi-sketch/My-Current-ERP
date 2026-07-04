// src/components/reporting/ReportShell.tsx
import React, { useState, useCallback } from "react";
import {
  Download,
  Printer,
  Settings,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";

export interface ReportShellAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
}

export interface ReportShellProps {
  // Identity
  title: string;
  subtitle?: string;
  period?: string; // "2081 Shrawan 1 — 2081 Ashadh 32" — always shown
  // Data state
  hasData: boolean;
  isLoading?: boolean;
  // Standard actions (pass null to hide)
  onExportExcel?: (() => void) | null;
  onExportCsv?: (() => void) | null;
  onPrint?: (() => void) | null;
  onOptions?: (() => void) | null;
  onRefresh?: (() => void) | null;
  // Extra custom actions
  extraActions?: ReportShellAction[];
  /** Optional header actions rendered beside title/subtitle (AGENTS.md page header pattern) */
  actions?: React.ReactNode;
  // Content
  children: React.ReactNode;
  // Variant tabs (e.g., Alphabetical / Groupwise in Trial Balance)
  tabs?: Array<{ key: string; label: string }>;
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

// ─── Toolbar button helper ────────────────────────────────────────────────────

const ToolbarBtn: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}> = ({ label, icon, onClick, disabled, primary }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 30,
        padding: "0 10px",
        fontSize: 11,
        fontWeight: 600,
        background: primary
          ? hovered && !disabled
            ? "#0f4a96"
            : "#1557b0"
          : hovered && !disabled
            ? "#f0f6ff"
            : "#ffffff",
        color: primary ? "#ffffff" : disabled ? "#9ca3af" : hovered ? "#1557b0" : "#374151",
        border: primary
          ? "none"
          : `1px solid ${disabled ? "#e5e7eb" : hovered ? "#bfdbfe" : "#d1d5db"}`,
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 120ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </button>
  );
};

// ─── Main ReportShell ────────────────────────────────────────────────────────

const ReportShell: React.FC<ReportShellProps> = ({
  title,
  subtitle,
  period,
  hasData,
  isLoading,
  onExportExcel,
  onExportCsv,
  onPrint,
  onOptions,
  onRefresh,
  extraActions,
  actions,
  children,
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f5f6fa",
      }}
    >
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          flexShrink: 0,
          flexWrap: "wrap",
          minHeight: 48,
        }}
      >
        {/* Left: title + period */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </span>
            {/* Period — always shown immediately after title */}
            {period && (
              <span
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 400,
                  whiteSpace: "nowrap",
                }}
              >
                {period}
              </span>
            )}
          </div>
          {subtitle && (
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{subtitle}</div>
          )}
        </div>

        {/* Right: action buttons cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {actions}
          {/* Refresh */}
          {onRefresh && (
            <ToolbarBtn
              label=""
              icon={
                <RefreshCw
                  size={13}
                  style={{
                    animation: isLoading ? "spin 0.8s linear infinite" : "none",
                  }}
                />
              }
              onClick={onRefresh}
              disabled={isLoading}
            />
          )}

          {/* Export Excel */}
          {onExportExcel !== null && onExportExcel !== undefined && (
            <ToolbarBtn
              label="Excel"
              icon={<FileSpreadsheet size={13} style={{ color: "#059669" }} />}
              onClick={onExportExcel}
              disabled={!hasData}
            />
          )}

          {/* Export CSV */}
          {onExportCsv !== null && onExportCsv !== undefined && (
            <ToolbarBtn
              label="CSV"
              icon={<FileText size={13} />}
              onClick={onExportCsv}
              disabled={!hasData}
            />
          )}

          {/* Print */}
          {onPrint !== null && onPrint !== undefined && (
            <ToolbarBtn
              label="Print"
              icon={<Printer size={13} />}
              onClick={onPrint}
              disabled={!hasData}
            />
          )}

          {/* Extra custom actions */}
          {extraActions?.map((action) => (
            <ToolbarBtn
              key={action.key}
              label={action.label}
              icon={action.icon || null}
              onClick={action.onClick}
              disabled={action.disabled}
              primary={action.variant === "primary"}
            />
          ))}

          {/* Options — primary style, always enabled */}
          {onOptions && (
            <ToolbarBtn label="Options" icon={<Settings size={13} />} onClick={onOptions} primary />
          )}
        </div>
      </div>

      {/* ── Variant Tabs (optional) ────────────────────────────────────────── */}
      {tabs && tabs.length > 0 && (
        <div
          style={{
            display: "flex",
            background: "#ffffff",
            borderBottom: "2px solid #e5e7eb",
            padding: "0 16px",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange?.(tab.key)}
                style={{
                  height: 36,
                  padding: "0 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid #1557b0" : "2px solid transparent",
                  color: isActive ? "#1557b0" : "#6b7280",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 400,
                  cursor: "pointer",
                  marginBottom: -2,
                  whiteSpace: "nowrap",
                  transition: "all 150ms ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Report Content ─────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Loading skeleton overlay */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.85)",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 16,
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{
                  height: 20,
                  width: `${85 + Math.random() * 15}%`,
                  borderRadius: 3,
                }}
              />
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default ReportShell;
