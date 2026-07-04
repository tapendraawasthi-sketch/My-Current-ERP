import React, { useEffect, useMemo, useState } from "react";

export interface ColumnVisibilityItem {
  key: string;
  label: string;
  visible?: boolean;
}

interface ColumnReportShellProps {
  title: string;
  subtitle?: string;
  reportMeta?: {
    accountName?: string;
    accountCode?: string;
    period?: string;
    companyName?: string;
    pan?: string;
  };

  fromBS: string;
  toBS: string;
  onFromBSChange: (value: string) => void;
  onToBSChange: (value: string) => void;

  columns: ColumnVisibilityItem[];
  onVisibleColumnsChange?: (keys: string[]) => void;

  totalRows: number;
  page: number;
  pageSize: number | "all";
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number | "all") => void;

  rowHeight: "compact" | "normal" | "comfortable";
  onRowHeightChange: (height: "compact" | "normal" | "comfortable") => void;

  zoom: 80 | 100 | 120;
  onZoomChange: (zoom: 80 | 100 | 120) => void;

  onPrint: () => void;
  onExport: () => void;
  onRefresh?: () => void;

  children: React.ReactNode;
}

const pageSizeOptions: Array<number | "all"> = [50, 100, 500, "all"];

const ColumnReportShell: React.FC<ColumnReportShellProps> = ({
  title,
  subtitle,
  fromBS,
  toBS,
  onFromBSChange,
  onToBSChange,
  columns,
  onVisibleColumnsChange,
  totalRows,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  rowHeight,
  onRowHeightChange,
  zoom,
  onZoomChange,
  onPrint,
  onExport,
  onRefresh,
  reportMeta,
  children,
}) => {
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() =>
    columns.filter((c) => c.visible !== false).map((c) => c.key),
  );

  useEffect(() => {
    onVisibleColumnsChange?.(visibleKeys);
  }, [visibleKeys, onVisibleColumnsChange]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        onPrint();
      }

      if (event.ctrlKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        onExport();
      }

      if (event.key === "F5") {
        event.preventDefault();
        onRefresh?.();
      }

      if (event.key === "Escape") {
        setColumnMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrint, onExport, onRefresh]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(totalRows / pageSize));
  }, [pageSize, totalRows]);

  const rowHeightClass =
    rowHeight === "compact" ? "h-7" : rowHeight === "comfortable" ? "h-11" : "h-9";

  return (
    <div
      className="flex flex-col h-full bg-[#f5f6fa] text-gray-800"
      style={{
        fontSize: zoom === 80 ? "11px" : zoom === 120 ? "14px" : "12px",
      }}
    >
      {/* Header */}
      <div className="no-print bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Ctrl+P Print
          </button>

          <button
            type="button"
            onClick={onExport}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Ctrl+E Export
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            F5 Refresh
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="no-print bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <label className="text-[11px] font-medium text-gray-600">From BS</label>
          <input
            value={fromBS}
            onChange={(e) => onFromBSChange(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
            placeholder="2081-04-01"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-[11px] font-medium text-gray-600">To BS</label>
          <input
            value={toBS}
            onChange={(e) => onToBSChange(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
            placeholder="2082-03-31"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setColumnMenuOpen((v) => !v)}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Columns
          </button>

          {columnMenuOpen && (
            <div className="absolute top-9 left-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg w-64 p-2">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-2 py-1.5 text-[12px] hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleKeys.includes(col.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibleKeys((prev) => [...prev, col.key]);
                      } else {
                        setVisibleKeys((prev) => prev.filter((x) => x !== col.key));
                      }
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <label className="text-[11px] font-medium text-gray-600">Zoom</label>
          <select
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value) as 80 | 100 | 120)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
          >
            <option value={80}>80%</option>
            <option value={100}>100%</option>
            <option value={120}>120%</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label className="text-[11px] font-medium text-gray-600">Row</label>
          <select
            value={rowHeight}
            onChange={(e) =>
              onRowHeightChange(e.target.value as "compact" | "normal" | "comfortable")
            }
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
          >
            <option value="compact">Compact 28px</option>
            <option value="normal">Normal 36px</option>
            <option value="comfortable">Comfortable 44px</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              const value = e.target.value === "all" ? "all" : Number(e.target.value);
              onPageSizeChange(value);
              onPageChange(1);
            }}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size === "all" ? "Show All" : `${size} rows`}
              </option>
            ))}
          </select>

          {pageSize !== "all" && (
            <div className="flex items-center gap-1 text-[12px]">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="h-8 px-2 border border-gray-300 rounded disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="h-8 px-2 border border-gray-300 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Report body */}
      <div className={`flex-1 overflow-auto column-report-body ${rowHeightClass}`}>
        {reportMeta && (
          <div
            className="print-only hidden"
            style={{ marginBottom: 12, borderBottom: "2px solid #111827", paddingBottom: 10 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, textAlign: "center" }}>
              {reportMeta.companyName}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: "center", marginTop: 2 }}>
              General Ledger
            </div>
            <div style={{ fontSize: 11, textAlign: "center", color: "#6b7280", marginTop: 2 }}>
              Account: {reportMeta.accountName} ({reportMeta.accountCode})
            </div>
            <div style={{ fontSize: 11, textAlign: "center", color: "#6b7280" }}>
              Period: {reportMeta.period}
            </div>
            <div style={{ fontSize: 10, textAlign: "center", color: "#9ca3af", marginTop: 2 }}>
              PAN: {reportMeta.pan}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default ColumnReportShell;
