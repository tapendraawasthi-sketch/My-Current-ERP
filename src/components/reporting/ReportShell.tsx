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
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f6fa] p-4">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actionBarButtons.map((btn) => (
            <button key={btn.label} onClick={btn.onClick} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md" type="button">
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden mb-4">
        {/* Header line for print/context */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <div className="text-[13px] font-bold text-gray-800">{companyName}</div>
          </div>
          <div className="text-right text-[11px] text-gray-600 font-medium">
            {periodText && <div>{periodText}</div>}
          </div>
        </div>

        {/* Secondary toolbar */}
        <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-3 flex-wrap">{toolbarLeft}</div>
          <div className="flex items-center gap-2">
            {onOptions && (
              <button onClick={onOptions} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" /> Options
              </button>
            )}
            {onExport && (
              <button onClick={onExport} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            )}
            {onPrint && (
              <button onClick={onPrint} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            )}
          </div>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default ReportShell;
