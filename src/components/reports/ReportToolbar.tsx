import React, { ReactNode } from "react";
import { Printer, FileDown, FileSpreadsheet, FileText } from "lucide-react";

interface ReportToolbarProps {
  title?: string;
  children?: ReactNode;
  onPrint?: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  additionalActions?: ReactNode;
}

export const ReportToolbar: React.FC<ReportToolbarProps> = ({
  title,
  children,
  onPrint,
  onExportPDF,
  onExportExcel,
  additionalActions,
}) => {
  const handlePdfClick = onExportPDF || onPrint;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-white border border-[#9DC07A] rounded-md mb-3 no-print">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {title && (
          <span className="text-[12px] font-bold text-[#000000] uppercase tracking-wide">
            {title}
          </span>
        )}
        {children}
        {additionalActions}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {onExportExcel && (
          <button
            onClick={onExportExcel}
            className="h-7 px-2.5 text-[11px] text-[#000000] bg-white border border-[#9DC07A] rounded-md hover:bg-[#EBF5E2] flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
        )}

        {handlePdfClick && (
          <button
            onClick={handlePdfClick}
            className="h-7 px-2.5 text-[11px] text-[#000000] bg-white border border-[#9DC07A] rounded-md hover:bg-[#EBF5E2] flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-red-600" />
            <span>PDF</span>
          </button>
        )}
      </div>
    </div>
  );
};
