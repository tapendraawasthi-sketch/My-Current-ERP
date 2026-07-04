import React, { useState } from "react";
import { ReportDepth } from "./AccountTreeRenderer";

interface TabDef {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}

export interface ReportShellProps {
  title: string;
  subtitle?: string;
  children: (depth: ReportDepth) => React.ReactNode;
  onPrint?: () => void;
  onExport?: () => void;
  extraActions?: React.ReactNode;
  /** @deprecated use extraActions */
  actions?: React.ReactNode;
  tabs?: TabDef[];
}

const DEPTHS: { label: string; value: ReportDepth }[] = [
  { label: "Summary", value: "summary" },
  { label: "Detailed", value: "detailed" },
  { label: "Full Detail", value: "ultra_deep" },
];

const ReportShell: React.FC<ReportShellProps> = ({
  title,
  subtitle,
  children,
  onPrint,
  onExport,
  extraActions,
  actions,
  tabs,
}) => {
  const [depth, setDepth] = useState<ReportDepth>("detailed");
  const actionsToRender = extraActions ?? actions;

  return (
    <div className="erp-report p-4 bg-[#f5f6fa] min-h-screen">
      <div className="erp-report-toolbar flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Extra actions slot */}
          {actionsToRender}

          {/* Depth toggles */}
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            {DEPTHS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDepth(d.value)}
                className={`h-8 px-3 text-[12px] font-medium transition-colors ${
                  depth === d.value
                    ? "bg-[#1557b0] text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Print */}
          {onPrint && (
            <button
              onClick={onPrint}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              Print
            </button>
          )}

          {/* Export */}
          {onExport && (
            <button
              onClick={onExport}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tab strip */}
      {tabs && tabs.length > 0 && (
        <div className="flex border-b border-gray-200 mb-4 no-print">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={tab.onClick}
              className={`px-4 py-2 text-[12px] font-medium transition-colors cursor-pointer ${
                tab.active
                  ? "border-b-2 border-[#1557b0] text-[#1557b0]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Report content */}
      <div>{children(depth)}</div>
    </div>
  );
};

export default ReportShell;
