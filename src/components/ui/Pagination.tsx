import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const start = Math.min((page - 1) * pageSize + 1, totalRecords);
  const end = Math.min(page * pageSize, totalRecords);

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    height: 28,
    minWidth: 28,
    padding: "0 8px",
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    background: active ? "#C9DEB5" : "#EBF5E2",
    border: "1px solid #000000",
    borderRadius: 3,
    cursor: "pointer",
    color: "#000000",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: "#D4EABD",
        borderTop: "1px solid #000000",
        fontSize: 11,
        color: "#000000",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <span style={{ color: "#000000" }}>
        {totalRecords > 0 ? `${start}–${end} of ${totalRecords}` : "0 records"}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              height: 28,
              padding: "0 6px",
              fontSize: 11,
              border: "1px solid #000000",
              background: "#EBF5E2",
              color: "#000000",
              borderRadius: 3,
            }}
          >
            {[25, 50, 100, 200].map((s) => (
              <option key={s} value={s}>
                {s}/page
              </option>
            ))}
          </select>
        )}

        <button onClick={() => onPageChange(1)} disabled={page === 1} style={btnStyle()}>
          «
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1} style={btnStyle()}>
          ‹
        </button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p = page - 2 + i;
          if (p < 1) p = i + 1;
          if (p > totalPages) p = totalPages - (4 - i);
          if (p < 1 || p > totalPages) return null;
          return (
            <button key={p} onClick={() => onPageChange(p)} style={btnStyle(p === page)}>
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          style={btnStyle()}
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          style={btnStyle()}
        >
          »
        </button>
      </div>
    </div>
  );
};

export default Pagination;
