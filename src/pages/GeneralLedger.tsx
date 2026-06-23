/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * General Ledger report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker, Pagination } from "../components/ui";
import { Printer, FileSpreadsheet, BookOpen } from "lucide-react";
import { computeLedger } from "../lib/accounting";
import { exportLedgerToExcel } from "../lib/exportUtils";
import { generateLedgerPDF } from "../lib/printUtils";
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
    return computeLedger(accountId, accounts, vouchers, startDate, endDate);
  }, [accountId, accounts, vouchers, startDate, endDate, selectedAccount]);

  const paginatedEntries = useMemo(() => {
    if (!ledgerData) return [];
    const start = (page - 1) * pageSize;
    return ledgerData.entries.slice(start, start + pageSize);
  }, [ledgerData, page, pageSize]);

  const totalPages = useMemo(() => {
    if (!ledgerData) return 1;
    return Math.max(1, Math.ceil(ledgerData.entries.length / pageSize));
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
    exportLedgerToExcel(selectedAccount.name, ledgerData.entries);
    toast.success("Ledger exported.");
  };

  const handlePrint = () => {
    if (!selectedAccount || !ledgerData) {
      toast.error("Select a ledger account to print.");
      return;
    }

    try {
      const blob = generateLedgerPDF(selectedAccount.name, ledgerData, companySettings, {
        startDate,
        endDate,
        preset: "custom",
      });
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (error) {
      toast.error("Unable to render ledger PDF.");
    }
  };

  const columns = [
    { key: "dateNepali", header: "Date (BS)" },
    { key: "voucherNo", header: "Voucher No" },
    { key: "voucherType", header: "Type" },
    { key: "narration", header: "Narration", width: "35%" },
    { key: "debit", header: "Debit", align: "right", render: (v: number) => formatNumber(v) },
    { key: "credit", header: "Credit", align: "right", render: (v: number) => formatNumber(v) },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (_: number, row: any) => `${formatNumber(row.balance)} ${row.balanceType}`,
    },
  ];

  return (


    <div style={{ background: "#e8e4f0", padding: 12 }}>


      <PillTitle title="General Ledger" />


      <FormPanel>


        <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">General Ledger</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Account-wise transaction history</p>
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
            Print PDF
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
            <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Opening Balance
              </div>
              <div className="mt-1 text-[16px] font-bold text-gray-800">
                {formatNumber(ledgerData.openingBalance)} {ledgerData.openingType}
              </div>
            </div>
            <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Total Dr
              </div>
              <div className="mt-1 text-[16px] font-bold text-[#1557b0]">
                {formatNumber(ledgerData.totalDebit)}
              </div>
            </div>
            <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Total Cr
              </div>
              <div className="mt-1 text-[16px] font-bold text-red-600">
                {formatNumber(ledgerData.totalCredit)}
              </div>
            </div>
            <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Closing Balance
              </div>
              <div className="mt-1 text-[16px] font-bold text-gray-800">
                {formatNumber(ledgerData.closingBalance)} {ledgerData.closingType}
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white mb-4">
            <table role="table" className="data-table sticky-thead">
              <thead>
                <tr>
                  <th>Date (BS)</th>
                  <th>Voucher No</th>
                  <th>Type</th>
                  <th style={{ width: "35%" }}>Narration</th>
                  <th className="th-right">Debit</th>
                  <th className="th-right">Credit</th>
                  <th className="th-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {ledgerData?.openingBalance !== undefined && (
                  <tr style={{ background: "#f0f7ff" }}>
                    <td colSpan={3} className="font-bold text-[11px] text-blue-700 pl-3 py-2">Opening Balance</td>
                    <td />
                    <td className="amt amt-dr">{ledgerData.openingBalance > 0 ? formatNumber(ledgerData.openingBalance) : ""}</td>
                    <td className="amt amt-cr">{ledgerData.openingBalance < 0 ? formatNumber(Math.abs(ledgerData.openingBalance)) : ""}</td>
                    <td className="amt font-bold">{formatNumber(Math.abs(ledgerData.openingBalance))}</td>
                  </tr>
                )}

                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-gray-400 text-[12px]">
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((row, idx) => (
                    <tr
                      key={row.voucherId || idx}
                      className="border-b border-gray-100 bg-white hover:bg-[#f5f6fa] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.dateNepali}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.voucherNo}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.voucherType}</td>
                      <td
                        className="px-3 py-2.5 text-[12px] text-gray-700 truncate max-w-xs"
                        title={row.narration}
                      >
                        {row.narration}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono amt amt-dr">
                        {row.debit ? formatNumber(row.debit) : ""}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono amt amt-cr">
                        {row.credit ? formatNumber(row.credit) : ""}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono amt">
                        {formatNumber(row.balance)} {row.balanceType}
                      </td>
                    </tr>
                  ))
                )}

                <tr style={{ background: "#eef1f8" }}>
                  <td colSpan={3} className="font-bold text-[11px] text-gray-700 pl-3 py-2">Closing Balance</td>
                  <td />
                  <td className="amt font-bold amt-dr">{formatNumber(ledgerData.totalDebit)}</td>
                  <td className="amt font-bold amt-cr">{formatNumber(ledgerData.totalCredit)}</td>
                  <td className="amt font-bold" style={{ color: "#1557b0" }}>{formatNumber(Math.abs(ledgerData.closingBalance))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalRecords={ledgerData.entries.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </>
      ) : (
        <Card border padding="lg" className="text-center text-slate-500">
          Select an account and date range to view ledger movements.
        </Card>
      )}
    </div>

      </FormPanel>

    </div>
  );
};

export default GeneralLedger;
