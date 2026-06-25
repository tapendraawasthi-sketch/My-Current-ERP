// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { VoucherStatus } from "../lib/types";
import { Printer, FileSpreadsheet } from "lucide-react";
import Pagination from "../components/ui/Pagination";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

/** Format a net amount as "1,234.56 Dr" or "1,234.56 Cr" or "—" */
const fmtNet = (dr: number, cr: number): string => {
  const net = dr - cr;
  if (Math.abs(net) < 0.005) return "—";
  return net > 0
    ? formatNumber(Math.abs(net)) + " Dr"
    : formatNumber(Math.abs(net)) + " Cr";
};

const TrialBalance: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();

  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";
  const fiscalEnd   = currentFiscalYear?.endDate   || "2027-07-15";

  const [page, setPage]         = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);

  const tbData = useMemo(() => {
    try {
      const results: any[] = [];

      const postedVouchers = vouchers.filter(
        (v) =>
          v.status === VoucherStatus.POSTED &&
          v.date >= fiscalStart &&
          v.date <= fiscalEnd
      );

      for (const acc of accounts) {
        if (acc.isGroup) continue;

        const opDr = acc.openingBalanceDr || 0;
        const opCr = acc.openingBalanceCr || 0;

        let periodDebit = 0;
        let periodCredit = 0;

        for (const v of postedVouchers) {
          for (const line of v.lines) {
            if (line.accountId === acc.id) {
              periodDebit  += line.debit  || 0;
              periodCredit += line.credit || 0;
            }
          }
        }

        const totalDr = opDr + periodDebit;
        const totalCr = opCr + periodCredit;
        let closingDr = 0;
        let closingCr = 0;
        if (totalDr >= totalCr) closingDr = Math.round((totalDr - totalCr) * 100) / 100;
        else                    closingCr = Math.round((totalCr - totalDr) * 100) / 100;

        if (opDr > 0 || opCr > 0 || periodDebit > 0 || periodCredit > 0) {
          results.push({
            accountId:    acc.id,
            accountName:  acc.name,
            accountCode:  acc.code,
            groupName:    acc.group || "",
            openingDr:    Math.round(opDr         * 100) / 100,
            openingCr:    Math.round(opCr         * 100) / 100,
            periodDebit:  Math.round(periodDebit  * 100) / 100,
            periodCredit: Math.round(periodCredit * 100) / 100,
            closingDr,
            closingCr,
          });
        }
      }

      const totals = results.reduce(
        (acc, r) => ({
          openingDr:    acc.openingDr    + r.openingDr,
          openingCr:    acc.openingCr    + r.openingCr,
          periodDebit:  acc.periodDebit  + r.periodDebit,
          periodCredit: acc.periodCredit + r.periodCredit,
          closingDr:    acc.closingDr    + r.closingDr,
          closingCr:    acc.closingCr    + r.closingCr,
        }),
        { openingDr: 0, openingCr: 0, periodDebit: 0, periodCredit: 0, closingDr: 0, closingCr: 0 }
      );

      return { rows: results, totals, error: null };
    } catch (error) {
      console.error("TrialBalance error:", error);
      return {
        rows: [],
        totals: { openingDr: 0, openingCr: 0, periodDebit: 0, periodCredit: 0, closingDr: 0, closingCr: 0 },
        error: String(error),
      };
    }
  }, [accounts, vouchers, fiscalStart, fiscalEnd]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tbData.rows.slice(start, start + pageSize);
  }, [tbData.rows, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(tbData.rows.length / pageSize));

  const handlePrint = () => window.print();

  const handleExport = () => {
    try {
      const header = ["Account/Group", "Opening", "Debit", "Credit", "Closing"];
      const data = tbData.rows.map((r) => [
        r.accountName,
        fmtNet(r.openingDr, r.openingCr),
        r.periodDebit  > 0 ? formatNumber(r.periodDebit)  : "—",
        r.periodCredit > 0 ? formatNumber(r.periodCredit) : "—",
        fmtNet(r.closingDr, r.closingCr),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
      XLSX.writeFile(wb, `TrialBalance_${fiscalStart}_${fiscalEnd}.xlsx`);
      toast.success("Exported to Excel");
    } catch {
      toast.error("Export failed");
    }
  };

  /* ─── Busy 21 colours ─────────────────────────────────────────────── */
  const BG_PAGE   = "#d8dce8";   // outer lavender page background
  const BG_HEADER = "#b8c8e8";   // column-header row
  const BG_TOTAL  = "#d0dff0";   // totals footer row
  const BORDER    = "#8899bb";   // table border colour
  const TEXT      = "#00008b";   // dark-blue text (same shade Busy uses)
  const FONT      = "'Courier New', monospace";

  return (
    <div style={{ background: BG_PAGE, padding: 12 }}>
      <PillTitle title="Trial Balance" />

      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 6,
          marginBottom: 6,
        }}
        className="no-print"
      >
        {[
          { label: "Export - [E]", icon: <FileSpreadsheet size={13} />, fn: handleExport },
          { label: "Print - [P]",  icon: <Printer size={13} />,         fn: handlePrint  },
        ].map(({ label, icon, fn }) => (
          <button
            key={label}
            onClick={fn}
            style={{
              fontSize: 11,
              padding: "2px 10px",
              background: "#e8e8e8",
              border: "1px solid #666",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: FONT,
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Report body ── */}
      <div
        style={{
          background: "white",
          border: `1px solid ${BORDER}`,
          fontFamily: FONT,
          fontSize: 12,
        }}
      >
        {/* Sub-header: All Groups + date range */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 8px",
            borderBottom: `1px solid ${BORDER}`,
            color: TEXT,
            fontSize: 11,
          }}
        >
          <span style={{ fontWeight: "bold" }}>All Groups</span>
          <span>
            From {fiscalStart} &nbsp; To {fiscalEnd}
          </span>
        </div>

        {/* Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            color: TEXT,
          }}
        >
          <thead>
            <tr style={{ background: BG_HEADER }}>
              {["Account/Group", "Opening", "Debit", "Credit", "Closing"].map(
                (col, i) => (
                  <th
                    key={col}
                    style={{
                      padding: "4px 8px",
                      textAlign: i === 0 ? "left" : "right",
                      borderBottom: `2px solid ${BORDER}`,
                      borderRight: i < 4 ? `1px solid ${BORDER}` : undefined,
                      fontWeight: "bold",
                      fontSize: 11,
                    }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "32px 0",
                    color: "#666",
                    fontSize: 11,
                  }}
                >
                  No ledger accounts with transactions in this period.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => (
                <tr
                  key={row.accountId}
                  style={{
                    background: idx % 2 === 0 ? "white" : "#f4f7fc",
                    borderBottom: `1px solid ${BORDER}30`,
                  }}
                >
                  <td style={{ padding: "3px 8px", borderRight: `1px solid ${BORDER}30` }}>
                    {row.accountName}
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "right", borderRight: `1px solid ${BORDER}30` }}>
                    {fmtNet(row.openingDr, row.openingCr)}
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "right", borderRight: `1px solid ${BORDER}30` }}>
                    {row.periodDebit  > 0 ? formatNumber(row.periodDebit)  : "—"}
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "right", borderRight: `1px solid ${BORDER}30` }}>
                    {row.periodCredit > 0 ? formatNumber(row.periodCredit) : "—"}
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "right" }}>
                    {fmtNet(row.closingDr, row.closingCr)}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Totals footer */}
          <tfoot>
            <tr style={{ background: BG_TOTAL, borderTop: `2px solid ${BORDER}`, fontWeight: "bold" }}>
              <td style={{ padding: "4px 8px", borderRight: `1px solid ${BORDER}` }}>
                Total
              </td>
              <td style={{ padding: "4px 8px", textAlign: "right", borderRight: `1px solid ${BORDER}` }}>
                {fmtNet(tbData.totals.openingDr, tbData.totals.openingCr)}
              </td>
              <td style={{ padding: "4px 8px", textAlign: "right", borderRight: `1px solid ${BORDER}` }}>
                {formatNumber(tbData.totals.periodDebit)}
              </td>
              <td style={{ padding: "4px 8px", textAlign: "right", borderRight: `1px solid ${BORDER}` }}>
                {formatNumber(tbData.totals.periodCredit)}
              </td>
              <td style={{ padding: "4px 8px", textAlign: "right" }}>
                {fmtNet(tbData.totals.closingDr, tbData.totals.closingCr)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Balance check */}
        <div
          style={{
            padding: "4px 8px",
            borderTop: `1px solid ${BORDER}`,
            fontSize: 10,
            color:
              Math.abs(tbData.totals.closingDr - tbData.totals.closingCr) < 1
                ? "green"
                : "red",
          }}
        >
          {Math.abs(tbData.totals.closingDr - tbData.totals.closingCr) < 1
            ? "✓  Trial Balance is balanced"
            : `✗  Unbalanced — Diff: ${formatNumber(Math.abs(tbData.totals.closingDr - tbData.totals.closingCr))}`}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalRecords={tbData.rows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {tbData.error && (
        <div style={{ color: "red", marginTop: 8, fontSize: 11 }}>
          Error: {tbData.error}
        </div>
      )}
    </div>
  );
};

export default TrialBalance;
