import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, totalRecords, pageSize, onPageChange, onPageSizeChange, pageSizeOptions = [25, 50, 100, 200] }) => {
  const from = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRecords);
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 text-[11px] text-gray-500">
        <span>Show</span>
        {onPageSizeChange && (
          <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))} className="h-6 px-1 border rounded text-[11px] font-semibold text-gray-700" style={{ borderColor: "var(--border)" }}>
            {pageSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <span>rows · {from}–{to} of {totalRecords}</span>
      </div>
      <div className="flex items-center gap-1">
        {[
          { onClick: () => onPageChange(1), disabled: page === 1, Icon: ChevronsLeft },
          { onClick: () => onPageChange(page - 1), disabled: page === 1, Icon: ChevronLeft },
        ].map(({ onClick, disabled, Icon }, i) => (
          <button key={i} type="button" onClick={onClick} disabled={disabled} className="h-7 w-7 flex items-center justify-center rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" style={{ borderColor: "var(--border)" }}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p = i + 1;
          if (totalPages > 5) {
            if (page <= 3) p = i + 1;
            else if (page >= totalPages - 2) p = totalPages - 4 + i;
            else p = page - 2 + i;
          }
          return (
            <button key={p} type="button" onClick={() => onPageChange(p)}
              className={`h-7 min-w-[28px] px-2 text-[11px] font-semibold rounded border transition-colors ${p === page ? "bg-[#1557b0] text-white border-[#1557b0]" : "text-gray-600 hover:bg-gray-50 border-gray-200"}`}>
              {p}
            </button>
          );
        })}
        {[
          { onClick: () => onPageChange(page + 1), disabled: page === totalPages, Icon: ChevronRight },
          { onClick: () => onPageChange(totalPages), disabled: page === totalPages, Icon: ChevronsRight },
        ].map(({ onClick, disabled, Icon }, i) => (
          <button key={i} type="button" onClick={onClick} disabled={disabled} className="h-7 w-7 flex items-center justify-center rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" style={{ borderColor: "var(--border)" }}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
};
export default Pagination;
