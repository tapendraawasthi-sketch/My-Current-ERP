import React, { useState } from "react";

export type ReportDepth = "summary" | "detailed" | "ultra_deep";

export interface ReportShellProps {
  title: string;
  subtitle?: string;
  children: (depth: ReportDepth) => React.ReactNode;
  onPrint?: () => void;
  onExport?: () => void;
}

const ReportShell: React.FC<ReportShellProps> = ({
  title,
  subtitle,
  children,
  onPrint,
  onExport,
}) => {
  const [depth, setDepth] = useState<ReportDepth>("summary");

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Depth toggle */}
          <div className="flex rounded-md border border-gray-300 overflow-hidden h-8">
            {([
              ["summary","Summary"],
              ["detailed","Detailed"],
              ["ultra_deep","Ultra Deep"],
            ] as [ReportDepth, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setDepth(v)}
                className={`px-3 text-[11px] font-semibold transition-colors
                  ${depth === v
                    ? "bg-[#1557b0] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {onExport && (
            <button
              onClick={onExport}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              Export
            </button>
          )}
          {onPrint && (
            <button
              onClick={onPrint}
              className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96]"
            >
              Print
            </button>
          )}
        </div>
      </div>
      {children(depth)}
    </div>
  );
};

export default ReportShell;
