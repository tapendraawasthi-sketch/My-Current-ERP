import React, { useState, useMemo, ReactNode } from "react";
import Table, { Column } from "./Table";
import Input from "./Input";
import Button from "./Button";
import { Search, Download } from "lucide-react";

interface SearchableTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  searchFields: (keyof T)[];
  rowKey: string | ((row: T) => string);
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  striped?: boolean;
  compact?: boolean;
  maxHeight?: string;
  stickyHeader?: boolean;
  headerAction?: ReactNode;
  placeholder?: string;
}

const SearchableTable: React.FC<SearchableTableProps> = ({
  columns,
  data,
  searchFields,
  rowKey,
  emptyMessage,
  onRowClick,
  striped = true,
  compact = false,
  maxHeight,
  stickyHeader = false,
  headerAction,
  placeholder = "Search records...",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(50);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;

    const term = searchTerm.toLowerCase();
    return data.filter((row) => {
      return searchFields.some((field) => {
        const val = row[field];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, searchFields]);

  const slicedData = useMemo(() => {
    return filteredData.slice(0, pageSize);
  }, [filteredData, pageSize]);

  const exportToCSV = (exportData: any[], exportColumns: Column[]) => {
    const headers = exportColumns.map((c) => c.header).join(",");
    const rows = exportData.map((row) =>
      exportColumns
        .map((c) => {
          const val = row[c.key];
          const valStr = val !== null && val !== undefined ? String(val) : "";
          return `"${valStr.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "exported_data.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Input
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={placeholder}
              className="w-full"
              inputClassName="pl-8"
            />
            <div className="absolute left-2.5 top-2 text-[#000000]">
              <Search className="h-4 w-4" />
            </div>
          </div>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 px-2 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>

          <span className="text-[11px] text-[#000000] whitespace-nowrap">
            {filteredData.length} records
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {headerAction ? (
            headerAction
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(filteredData, columns)}
              icon={<Download className="h-3.5 w-3.5" />}
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        data={slicedData}
        rowKey={rowKey}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        striped={striped}
        compact={compact}
        maxHeight={maxHeight}
        stickyHeader={stickyHeader}
      />
    </div>
  );
};

export default SearchableTable;
