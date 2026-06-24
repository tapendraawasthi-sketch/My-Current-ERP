/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * General Ledger report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker, Pagination } from "../components/ui";
import { Printer, FileSpreadsheet } from "lucide-react";
import { computeLedgerBalance, isDebitNature } from "../lib/accounting";
import { exportLedgerToExcel } from "../lib/exportUtils";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";
import { PillTitle, FormPanel } from "../components/BusyShell";

const GeneralLedger: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear, reportFilters } = useStore();
  const ledgerAccounts = useMemo(
    () => accounts.filter((acc) => !acc.isGroup && acc.isActive),
    [accounts],
  );

  const [accountId, setAccountId] = useState<string>(reportFilters.accountId || "");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "2026-07-16");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "2027-07-15");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    if (ledgerAccounts.length > 0 && !accountId) {
      setAccountId(ledgerAccounts[0].id);
    }
  }, [ledgerAccounts, accountId]);

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  const selectedAccount = useMemo(
    () => ledgerAccounts.find((acc) => acc.id === accountId),
    [ledgerAccounts, accountId],
  );

  const ledgerData = useMemo(() => {
    if (!accountId || !selectedAccount) return null;
    
    const isDr = isDebitNature(selectedAccount.type);
    const baseOpDr = selectedAccount.openingBalanceDr || 0;
    const baseOpCr = selectedAccount.openingBalanceCr || 0;
    let baseOp = 0;
    let baseOpSign: "DR" | "CR" = "DR";

    if (isDr) {
      baseOp = baseOpDr - baseOpCr;
      baseOpSign = baseOp >= 0 ? "DR" : "CR";
    } else {
      baseOp = baseOpCr - baseOpDr;
      baseOpSign = baseOp >= 0 ? "CR" : "DR";
    }
    
    return computeLedgerBalance(accountId, vouchers, [], startDate, endDate, Math.abs(baseOp), baseOpSign);
  }, [accountId, selectedAccount, vouchers, startDate, endDate]);

  const paginatedEntries = useMemo(() => {
    if (!ledgerData) return [];
    const start = (page - 1) * pageSize;
    return ledgerData.transactions.slice(start, start + pageSize);
  }, [ledgerData, page, pageSize]);

  const totalPages = useMemo(() => {
    if (!ledgerData) return 1;
    return Math.max(1, Math.ceil(ledgerData.transactions.length / pageSize));
  }, [ledgerData, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [accountId, startDate, endDate]);

  const accountOptions = useMemo(
    () => ledgerAccounts.map((acc) => ({ value: acc.id, label: `${acc.code} · ${acc.name}` })),
    [ledgerAccounts],
  );

  const handleExport = () => {
    if (!selectedAccount || !ledgerData) {
      toast.error("Select a ledger account to export.");
      return;
    }
    exportLedgerToExcel(selectedAccount.name, ledgerData.transactions as any);
    toast.success("Ledger exported.");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ background: "#e8e4f0", padding: 12 }}>
      <PillTitle title="General Ledger" />
      <FormPanel>
        <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs">
          {/* Print Header */}
          <div className="print-only hidden mb-6 text-center">
            <h1 className="text-xl font-bold">{companySettings?.companyNameEn || "Sutra ERP"}</h1>
            <h2 className="text-lg font-semibold mt-1">General Ledger: {selectedAccount?.name}</h2>
            <p className="text-sm text-[#000000] mt-1">Period: {startDate} to {endDate}</p>
          </div>

          <div className="flex items-center justify-between mb-4 no-print">
            <div>
              <h1 className="text-[15px] font-semibold text-[#000000]">General Ledger</h1>
              <p className="text-[11px] text-[#000000] mt-0.5">Account-wise transaction history</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<FileSpreadsheet className="h-4 w-4" />}
                onClick={handleExport}
              >
                Export Excel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Printer className="h-4 w-4" />}
                onClick={handlePrint}
              >
                Print
              </Button>
            </div>
          </div>

          <div className="report-toolbar no-print mb-3">
            <div className="grid gap-4 lg:grid-cols-3">
              <Select
                label="Ledger Account"
                value={accountId}
                onChange={setAccountId}
                options={[{ value: "", label: "Select account ledger" }, ...accountOptions]}
                required
              />
              <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
              <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
            </div>
          </div>

          {selectedAccount && ledgerData ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4 mb-4">
                <div className="p-3 bg-white border border-[#9DC07A] rounded-lg shadow-sm">
                  <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">
                    Opening Balance
                  </div>
                  <div className="mt-1 text-[16px] font-bold text-[#000000]">
                    {formatNumber(ledgerData.openingBalance)} {ledgerData.openingBalance > 0 ? "DR" : "CR"}
                  </div>
                </div>
                <div className="p-3 bg-white border border-[#9DC07A] rounded-lg shadow-sm">
                  <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">
                    Total Dr
                  </div>
                  <div className="mt-1 text-[16px] font-bold text-[#1557b0]">
                    {formatNumber(ledgerData.totalDebits)}
                  </div>
                </div>
                <div className="p-3 bg-white border border-[#9DC07A] rounded-lg shadow-sm">
                  <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">
                    Total Cr
                  </div>
                  <div className="mt-1 text-[16px] font-bold text-red-600">
                    {formatNumber(ledgerData.totalCredits)}
                  </div>
                </div>
                <div className="p-3 bg-white border border-[#9DC07A] rounded-lg shadow-sm">
                  <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">
                    Closing Balance
                  </div>
                  <div className="mt-1 text-[16px] font-bold text-[#000000]">
                    {formatNumber(ledgerData.closingBalance)} {ledgerData.closingDrCr}
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto border border-[#9DC07A] rounded-lg shadow-sm bg-white mb-4">
                <table role="table" className="data-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Date (BS)</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Voucher No</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide" style={{ width: "35%" }}>Narration</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Debit</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Credit</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {ledgerData.openingBalance !== undefined && (
                      <tr style={{ background: "#f0f7ff" }}>
                        <td colSpan={3} className="font-bold text-[11px] text-[#000000] px-3 py-2.5">Opening Balance</td>
                        <td className="px-3 py-2.5 text-[12px] text-right font-mono amt amt-dr">{ledgerData.openingBalance > 0 ? formatNumber(ledgerData.openingBalance) : ""}</td>
                        <td className="px-3 py-2.5 text-[12px] text-right font-mono amt amt-cr">{ledgerData.openingBalance < 0 ? formatNumber(Math.abs(ledgerData.openingBalance)) : ""}</td>
                        <td className="px-3 py-2.5 text-[12px] text-right font-mono font-bold">{formatNumber(Math.abs(ledgerData.openingBalance))}</td>
                      </tr>
                    )}

                    {paginatedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-[#000000] text-[12px]">
                          No transactions in this period.
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((row, idx) => (
                        <tr
                          key={row.voucherNo + idx}
                          className="border-b border-[#9DC07A] bg-white hover:bg-[#f5f6fa] transition-colors"
                        >
                          <td className="px-3 py-2.5 text-[12px] text-[#000000]">{row.dateBS}</td>
                          <td className="px-3 py-2.5 text-[12px] text-[#1557b0] cursor-pointer hover:underline">{row.voucherNo}</td>
                          <td
                            className="px-3 py-2.5 text-[12px] text-[#000000] truncate max-w-xs"
                            title={row.narration}
                          >
                            {row.narration}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#000000] text-right font-mono amt amt-dr">
                            {row.debit ? formatNumber(row.debit) : ""}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#000000] text-right font-mono amt amt-cr">
                            {row.credit ? formatNumber(row.credit) : ""}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#000000] text-right font-mono amt">
                            {formatNumber(Math.abs(row.runningBalance))} {row.runningBalance >= 0 ? "DR" : "CR"}
                          </td>
                        </tr>
                      ))
                    )}

                    <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                      <td colSpan={3} className="px-3 py-2.5 pl-3">Closing Balance</td>
                      <td className="px-3 py-2.5 text-right font-mono amt-dr">{formatNumber(ledgerData.totalDebits)}</td>
                      <td className="px-3 py-2.5 text-right font-mono amt-cr">{formatNumber(ledgerData.totalCredits)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#1557b0]">{formatNumber(Math.abs(ledgerData.closingBalance))} {ledgerData.closingDrCr}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalRecords={ledgerData.transactions.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <Card border padding="lg" className="text-center text-[#000000]">
              Select an account and date range to view ledger movements.
            </Card>
          )}
        </div>
      </FormPanel>
    </div>
  );
};

export default GeneralLedger;
