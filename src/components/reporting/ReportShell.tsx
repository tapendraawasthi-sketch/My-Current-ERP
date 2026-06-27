import React from "react";
import { Printer, Download, Settings, RefreshCw, Search } from "lucide-react";

interface ReportShellProps {
  title: string;
  subtitle?: string;
  companyName?: string;
  periodText?: string;
  actionBarButtons?: Array<{ label: string; onClick?: () => void }>;
  toolbarLeft?: React.ReactNode;
  onPrint?: () => void;
  onExport?: () => void;
  onOptions?: () => void;
  children: React.ReactNode;
}

const ReportShell: React.FC<ReportShellProps> = ({
  title,
  subtitle,
  companyName,
  periodText,
  actionBarButtons = [],
  toolbarLeft,
  onPrint,
  onExport,
  onOptions,
  children,
}) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#E4F1D9] p-4 text-[#000]">
      <div className="max-w-7xl mx-auto bg-[#EBF5E2] border border-black overflow-hidden" style={{borderRadius: '4px'}}>
        
        {/* Busy-like top action bar */}
        <div className="report-action-bar">
          <div className="report-action-left">
            {actionBarButtons.map((btn) => (
              <button key={btn.label} onClick={btn.onClick} className="report-action-btn" type="button">
                {btn.label}
              </button>
            ))}
          </div>
          <div className="report-title-pill">{title}</div>
        </div>

        {/* Header line */}
        <div className="px-4 py-2 border-b border-black bg-[#EBF5E2] flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold">{title}</div>
            {subtitle && <div className="text-[11px]">{subtitle}</div>}
          </div>
          <div className="text-right text-[11px]">
            {companyName && <div>{companyName}</div>}
            {periodText && <div>{periodText}</div>}
          </div>
        </div>

        {/* Secondary toolbar */}
        <div className="px-4 py-2 border-b border-black bg-[#D4EABD] flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2 flex-wrap">{toolbarLeft}</div>
          <div className="flex items-center gap-2">
            {onOptions && (
              <button onClick={onOptions} className="report-toolbar-btn">Options</button>
            )}
            {onExport && (
              <button onClick={onExport} className="report-toolbar-btn">Export</button>
            )}
            {onPrint && (
              <button onClick={onPrint} className="report-toolbar-btn">Print</button>
            )}
          </div>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default ReportShell;
