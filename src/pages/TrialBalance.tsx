// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { VoucherStatus } from "../lib/types";
import { isDebitNature } from "../lib/accounting";
import { Printer, FileSpreadsheet } from "lucide-react";
import Pagination from "../components/ui/Pagination";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

const TrialBalance: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();

  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";
  const fiscalEnd = currentFiscalYear?.endDate || "2027-07-15";

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);

  const tbData = useMemo(() => {
    try {
      const results: any[] = [];

      const postedVouchers = vouchers.filter(
        (v) => v.status === VoucherStatus.POSTED && v.date >= fiscalStart && v.date <= fiscalEnd
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
              periodDebit += line.debit || 0;
              periodCredit += line.credit || 0;
            }
          }
        }

        // Closing balance
        const totalDr = opDr + periodDebit;
        const totalCr = opCr + periodCredit;
        let closingDr = 0;
        let closingCr = 0;

        if (totalDr >= totalCr) {
          closingDr = Math.round((totalDr - totalCr) * 100) / 100;
        } else {
          closingCr = Math.round((totalCr - totalDr) * 100) / 100;
        }

        if (opDr > 0 || opCr > 0 || periodDebit > 0 || periodCredit > 0) {
          results.push({
            accountId: acc.id,
            accountName: acc.name,
            accountCode: acc.code,
            groupName: acc.group || "",
            type: acc.type,
            openingDr: Math.round(opDr * 100) / 100,
            openingCr: Math.round(opCr * 100) / 100,
            periodDebit: Math.round(periodDebit * 100) / 100,
            periodCredit: Math.round(periodCredit * 100) / 100,
            closingDr,
            closingCr,
          });
        }
      }

      // Totals
      const totals = results.reduce(
        (acc, r) => ({
          openingDr: acc.openingDr + r.openingDr,
          openingCr: acc.openingCr + r.openingCr,
          periodDebit: acc.periodDebit + r.periodDebit,
          periodCredit: acc.periodCredit + r.periodCredit,
          closingDr: acc.closingDr + r.closingDr,
          closingCr: acc.closingCr + r.closingCr,
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
      const header = ["Code", "Account Name", "Group", "Op Dr", "Op Cr", "Period Dr", "Period Cr", "Cl Dr", "Cl Cr"];
      const data = tbData.rows.map((r) => [
        r.accountCode, r.accountName, r.groupName,
        r.openingDr, r.openingCr, r.periodDebit, r.periodCredit, r.closingDr, r.closingCr,
      ]);
      data.push(["", "TOTALS", "",
        tbData.totals.openingDr, tbData.totals.openingCr,
        tbData.totals.periodDebit, tbData.totals.periodCredit,
        tbData.totals.closingDr, tbData.totals.closingCr,
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

  return (
    <div style={{ background: "#e8e4f0", padding: 12 }}>
      <PillTitle title="Trial Balance" />
      <FormPanel>
        <div className="flex flex-col gap-4 animate-fadeIn select-none">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-[15px] font-semibold text-[#000000]">Trial Balance</h1>
              <p className="text-[11px] text-[#000000] mt-0.5">
                Period: {fiscalStart} to {fiscalEnd} · {tbData.rows.length} ledgers
              </p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button onClick={handleExport} className="h-8 px-3 text-[11px] font-medium rounded-md border border-[#9DC07A] bg-white text-[#000000] hover:bg-[#EBF5E2] flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export
              </button>
              <button onClick={handlePrint} className="h-8 px-3 text-[11px] font-medium rounded-md border border-[#9DC07A] bg-white text-[#000000] hover:bg-[#EBF5E2] flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
          </div>

          {/* Balance check */}
          <div className={`px-4 py-2 rounded-md border text-[12px] font-semibold ${Math.abs(tbData.totals.closingDr - tbData.totals.closingCr) < 1 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {Math.abs(tbData.totals.closingDr - tbData.totals.closingCr) < 1
              ? "✓ Trial Balance is balanced (Total Dr = Total Cr)"
              : `✗ Unbalanced: Dr Rs. ${formatNumber(tbData.totals.closingDr)} ≠ Cr Rs. ${formatNumber(tbData.totals.closingCr)}`}
          </div>

          {tbData.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-[12px]">
              Error: {tbData.error}
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#EBF5E2] border-b-2 border-[#9DC07A]">
                    <th className="px-3 py-2.5 text-left font-bold text-[#000000] text-[10px] uppercase tracking-wide">Code</th>
                    <th className="px-3 py-2.5 text-left font-bold text-[#000000] text-[10px] uppercase tracking-wide">Account Name</th>
                    <th className="px-3 py-2.5 text-right font-bold text-[#000000] text-[10px] uppercase tracking-wide">Opening Dr</th>
                    <th className="px-3 py-2.5 text-right font-bold text-[#000000] text-[10px] uppercase tracking-wide">Opening Cr</th>
                    <th className="px-3 py-2.5 text-right font-bold text-[#000000] text-[10px] uppercase tracking-wide">Period Dr</th>
                    <th className="px-3 py-2.5 text-right font-bold text-[#000000] text-[10px] uppercase tracking-wide">Period Cr</th>
                    <th className="px-3 py-2.5 text-right font-bold text-[#000000] text-[10px] uppercase tracking-wide">Closing Dr</th>
                    <th className="px-3 py-2.5 text-right font-bold text-[#000000] text-[10px] uppercase tracking-wide">Closing Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-[#000000]">
                        No ledger accounts with transactions in this period.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.accountId} className="border-b border-[#9DC07A]/30 hover:bg-[#EBF5E2]/30">
                        <td className="px-3 py-2 font-mono text-[#000000]">{row.accountCode}</td>
                        <td className="px-3 py-2 text-[#000000] font-medium">{row.accountName}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.openingDr > 0 ? formatNumber(row.openingDr) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.openingCr > 0 ? formatNumber(row.openingCr) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.periodDebit > 0 ? formatNumber(row.periodDebit) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.periodCredit > 0 ? formatNumber(row.periodCredit) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{row.closingDr > 0 ? formatNumber(row.closingDr) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{row.closingCr > 0 ? formatNumber(row.closingCr) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#D4EABD] border-t-2 border-[#9DC07A] font-bold text-[12px]">
                    <td colSpan={2} className="px-3 py-2.5 text-right uppercase text-[#000000]">Totals:</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatNumber(tbData.totals.openingDr)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatNumber(tbData.totals.openingCr)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatNumber(tbData.totals.periodDebit)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatNumber(tbData.totals.periodCredit)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatNumber(tbData.totals.closingDr)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatNumber(tbData.totals.closingCr)}</td>
                  </tr>
                </tfoot>
              </table>
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
        </div>
      </FormPanel>
    </div>
  );
};

export default TrialBalance;
