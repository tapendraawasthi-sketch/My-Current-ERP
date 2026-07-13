import React from "react";
import type { OrbixReportColumn, OrbixReportPayload } from "@/lib/ekhata/orbixReportTypes";
import { Download, RefreshCw } from "lucide-react";

interface OrbixReportTableProps {
  report: OrbixReportPayload;
  maximized?: boolean;
}

const OrbixReportTable: React.FC<OrbixReportTableProps> = ({ report, maximized = false }) => (
  <div
    className="mt-1 overflow-hidden rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)]"
    data-component="orbix-report-viewer"
  >
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--ox-text)]">{report.title}</p>
        <p className="mt-0.5 text-[12px] text-[var(--ox-text-muted)]">{report.subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-[var(--ox-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--ox-text-muted)]">
          Report
        </span>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2 text-[11px] text-[var(--ox-text-muted)]"
          title="Ask Orbix to refresh or revise this report in chat"
        >
          <RefreshCw className="h-3 w-3" />
          Revise in chat
        </button>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] text-[var(--ox-text-muted)]"
          title="Export where supported"
          disabled
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div
      className={`overflow-x-auto ${maximized ? "" : "max-w-full"}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <table className="w-full min-w-[480px] text-[13px]">
        <thead>
          <tr className="border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)]">
            {report.columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)] whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 ? (
            <tr>
              <td
                colSpan={report.columns.length}
                className="px-3 py-8 text-center text-[13px] text-[var(--ox-text-muted)]"
              >
                No data for this period.
              </td>
            </tr>
          ) : (
            report.rows.map((row, i) => {
              const depth = Number(row["depth"] ?? row["level"] ?? 0) || 0;
              const label = String(row["label"] ?? row["account"] ?? "");
              const isTotal = Boolean(row["isTotal"] || row["bold"] || /total|closing/i.test(label));
              return (
                <tr
                  key={i}
                  className={`border-b border-[var(--ox-border)]/70 hover:bg-[var(--ox-surface-muted)]/60 ${
                    isTotal ? "bg-[var(--ox-primary-soft)] font-semibold" : ""
                  }`}
                >
                  {report.columns.map((col: OrbixReportColumn, colIdx) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-[var(--ox-text)] whitespace-nowrap ${
                        col.align === "right" ? "text-right font-mono tabular-nums" : "text-left"
                      } ${col.mono ? "font-mono tabular-nums text-[12px]" : ""}`}
                      style={colIdx === 0 ? { paddingLeft: 12 + depth * 14 } : undefined}
                    >
                      {colIdx === 0 && depth > 0 && (
                        <span className="mr-1 text-[var(--ox-text-subtle)]" aria-hidden>
                          └
                        </span>
                      )}
                      {row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    {report.summary && report.summary.length > 0 && (
      <div className="grid gap-2 border-t border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-3.5 py-3 sm:grid-cols-3">
        {report.summary.map((item) => (
          <div key={item.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-subtle)]">
              {item.label}
            </p>
            <p
              className={`mt-0.5 font-mono text-[13px] font-semibold tabular-nums ${
                item.accent ? "text-[var(--ox-primary)]" : "text-[var(--ox-text)]"
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    )}

    {report.footerNote && (
      <p className="border-t border-[var(--ox-border)] px-3.5 py-2 text-[11px] text-[var(--ox-text-muted)]">
        {report.footerNote}
      </p>
    )}
  </div>
);

export default OrbixReportTable;
