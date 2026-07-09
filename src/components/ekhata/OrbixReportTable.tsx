import React from "react";
import type { OrbixReportColumn, OrbixReportPayload } from "@/lib/ekhata/orbixReportTypes";

interface OrbixReportTableProps {
  report: OrbixReportPayload;
  maximized?: boolean;
}

const OrbixReportTable: React.FC<OrbixReportTableProps> = ({ report, maximized = false }) => (
  <div className="mt-2 rounded-lg border border-white/10 bg-[#060a12]/80 overflow-hidden">
    <div className="px-3 py-2 border-b border-white/10 bg-gradient-to-r from-cyan-500/5 to-violet-500/5">
      <p className="text-[11px] font-semibold text-slate-200">{report.title}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{report.subtitle}</p>
    </div>

    <div
      className={`overflow-x-auto ${maximized ? "" : "max-w-full"}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <table className="w-full min-w-[480px] text-[11px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {report.columns.map((col) => (
              <th
                key={col.key}
                className={`px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap ${
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
                className="px-3 py-6 text-center text-[11px] text-slate-600"
              >
                No data for this period.
              </td>
            </tr>
          ) : (
            report.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                {report.columns.map((col: OrbixReportColumn) => (
                  <td
                    key={col.key}
                    className={`px-2.5 py-1.5 text-slate-300 whitespace-nowrap ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${col.mono ? "font-mono tabular-nums text-[10px]" : ""} ${
                      col.key === "amount" || col.key === "debit" || col.key === "credit"
                        ? "text-[#fb923c]/90"
                        : ""
                    }`}
                  >
                    {row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {!maximized && report.rows.length > 3 && (
      <div className="px-3 py-1 border-t border-white/5 flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-500/60 to-violet-500/60" />
        </div>
        <span className="text-[9px] text-slate-600 whitespace-nowrap">Scroll →</span>
      </div>
    )}

    {report.summary.length > 0 && (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/10 border-t border-white/10">
        {report.summary.map((s) => (
          <div key={s.label} className="bg-[#080c14] px-2.5 py-2">
            <p className="text-[9px] text-slate-600 uppercase tracking-wide">{s.label}</p>
            <p
              className={`text-[11px] font-mono font-medium mt-0.5 ${
                s.accent ? "text-cyan-300" : "text-slate-300"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
    )}

    {report.footerNote && (
      <p className="px-3 py-1.5 text-[9px] text-slate-600 border-t border-white/5">{report.footerNote}</p>
    )}
  </div>
);

export default OrbixReportTable;
