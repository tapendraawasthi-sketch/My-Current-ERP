import React from "react";
import { Printer, Download, Settings } from "lucide-react";

interface ReportShellProps {
  title: string;
  subtitle?: string;
  companyName?: string;
  periodText?: string;
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
  toolbarLeft,
  onPrint,
  onExport,
  onOptions,
  children,
}) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f7f5] p-6 text-gray-800">
      <div className="max-w-7xl mx-auto bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-[#fafcfc]">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="text-right hidden sm:block">
            {companyName && <h2 className="text-[13px] font-medium text-gray-700">{companyName}</h2>}
            {periodText && <p className="text-[11px] text-gray-500">{periodText}</p>}
          </div>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2 flex-wrap">{toolbarLeft}</div>
          <div className="flex items-center gap-2">
            {onOptions && (
              <button
                onClick={onOptions}
                className="h-8 px-3 flex items-center gap-2 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Options
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="h-8 px-3 flex items-center gap-2 text-[12px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            )}
            {onPrint && (
              <button
                onClick={onPrint}
                className="h-8 px-3 flex items-center gap-2 text-[12px] font-medium text-white bg-[#1557b0] border border-transparent rounded-md hover:bg-[#0f4a96] transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="print-only hidden mb-6 text-center">
            {companyName && <h1 className="text-lg font-bold">{companyName}</h1>}
            <h2 className="text-md font-semibold">{title}</h2>
            {periodText && <p className="text-xs">{periodText}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};

export default ReportShell;
