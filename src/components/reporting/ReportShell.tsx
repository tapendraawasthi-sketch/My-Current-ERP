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
            ? "var(--ds-action-primary-hover)"
            : "var(--ds-action-primary)"
          : hovered && !disabled
            ? "#f0f6ff"
            : "#ffffff",
        color: primary ? "#ffffff" : disabled ? "#9ca3af" : hovered ? "var(--ds-action-primary)" : "#374151",
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
    <div className="erp-report flex flex-col h-full bg-[#f5f6fa]">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="erp-report-toolbar no-print flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-300 shrink-0 flex-wrap min-h-[48px]">
        {/* Left: title + period */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="text-[15px] font-semibold text-gray-800 whitespace-nowrap">
              {title}
            </span>
            {period && (
              <span className="text-[11px] text-gray-500 whitespace-nowrap">{period}</span>
            )}
          </div>
          {subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}
        </div>

        {/* Right: action buttons cluster */}
        <div className="flex items-center gap-1.5 shrink-0">
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
        <div className="no-print flex bg-white border-b-2 border-gray-200 px-4 shrink-0 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange?.(tab.key)}
                className={`h-9 px-4 bg-transparent border-0 border-b-2 -mb-0.5 text-[12px] whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Report Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative p-4">
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
