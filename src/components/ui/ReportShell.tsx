import React from "react";

export interface ReportShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Toolbar action buttons (Export, Print, Options, etc.) — Fix BUG-015 */
  actions?: React.ReactNode;
  /** Extra className for the wrapper */
  className?: string;
  /** Whether to show a loading overlay */
  loading?: boolean;
}

const ReportShell: React.FC<ReportShellProps> = ({
  title,
  subtitle,
  children,
  actions,
  className = "",
  loading = false,
}) => {
  return (
    <div className={`flex flex-col h-full bg-[#f5f6fa] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap">{actions}</div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#1557b0] border-t-transparent rounded-full animate-spin" />
              <span className="text-[12px] text-gray-600">Loading report…</span>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default ReportShell;
