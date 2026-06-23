import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker, PartySelect, Modal } from "../components/ui";
import { computePartyStatement, isDebitNature } from "../lib/accounting";
import { formatNumber, dateToAD } from "../lib/utils";
import { VoucherType, VoucherStatus, PaymentStatus, Party } from "../lib/types";
import { formatADToBS } from "../lib/nepaliDate";
import toast from "react-hot-toast";

const PartyLedgerStatement: React.FC = () => {
  const {
    parties,
    invoices,
    accounts,
    vouchers,
    companySettings,
    currentFiscalYear,
    reportFilters,
    setReportFilters,
    setCurrentPage,
  } = useStore();

  const [selectedPartyId, setSelectedPartyId] = useState<string>(reportFilters.partyId || "");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || dateToAD(new Date()));
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  useEffect(() => {
    if (reportFilters.partyId) {
      setSelectedPartyId(reportFilters.partyId);
    }
  }, [reportFilters.partyId]);

  const selectedParty = useMemo(
    () => parties.find((party) => party.id === selectedPartyId),
    [parties, selectedPartyId],
  );

  const statement = useMemo(() => {
    if (!selectedParty) {
      return null;
    }
    return computePartyStatement(selectedParty, accounts, vouchers, invoices, startDate, endDate);
  }, [selectedParty, accounts, vouchers, invoices, startDate, endDate]);

  // Compute cumulative running balance row-by-row
  const computedEntriesWithRunningBalance = useMemo(() => {
    if (!statement || !selectedParty) return [];

    const partyAccount = accounts.find((a) => a.id === selectedParty.accountId);
    const isDrNature = partyAccount ? isDebitNature(partyAccount.type) : true;

    let running = isDrNature
      ? statement.openingType === "Dr"
        ? statement.openingBalance
        : -statement.openingBalance
      : statement.openingType === "Cr"
        ? statement.openingBalance
        : -statement.openingBalance;

    return statement.entries.map((entry) => {
      const debit = entry.debit || 0;
      const credit = entry.credit || 0;
      const change = isDrNature ? debit - credit : credit - debit;
      running = Math.round((running + change) * 100) / 100;

      let balType: "Dr" | "Cr" = "Dr";
      const absBal = Math.abs(running);
      if (isDrNature) {
        balType = running >= 0 ? "Dr" : "Cr";
      } else {
        balType = running >= 0 ? "Cr" : "Dr";
      }

      return {
        ...entry,
        cumulativeBalance: absBal,
        cumulativeBalanceType: balType,
      };
    });
  }, [statement, selectedParty, accounts]);

  const handlePrint = () => {
    if (!selectedParty || !statement) {
      toast.error("Select a party before printing.");
      return;
    }
    window.print();
  };

  const handleExportCSV = () => {
    if (!selectedParty || !statement) {
      toast.error("Select a party before export.");
      return;
    }

    const csvHeaders = ["Date", "Voucher No", "Type", "Narration", "Debit", "Credit", "Balance"];
    const csvRows = [
      csvHeaders,
      // Opening balance row
      [
        companySettings?.dateFormat === "BS" ? formatADToBS(startDate) : startDate,
        "-",
        "-",
        "Opening Balance",
        "-",
        "-",
        `${statement.openingBalance} ${statement.openingType}`,
      ],
      // Entries
      ...computedEntriesWithRunningBalance.map((entry) => [
        companySettings?.dateFormat === "BS" ? entry.dateNepali : entry.date,
        entry.voucherNo,
        entry.voucherType,
        entry.narration,
        entry.debit || 0,
        entry.credit || 0,
        `${entry.cumulativeBalance} ${entry.cumulativeBalanceType}`,
      ]),
      // Closing balance row
      [
        companySettings?.dateFormat === "BS" ? formatADToBS(endDate) : endDate,
        "-",
        "-",
        "Closing Balance",
        statement.totalDebit,
        statement.totalCredit,
        `${statement.closingBalance} ${statement.closingType}`,
      ],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `${selectedParty.name.replace(/[^a-zA-Z0-9]/g, "_")}_Ledger_Statement.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Party ledger statement exported to CSV.");
  };

  const handlePartyChange = (id: string) => {
    setSelectedPartyId(id);
    setReportFilters({ partyId: id });
  };

  const handleOpenVoucher = (voucherId: string) => {
    const v = vouchers.find((voucher) => voucher.id === voucherId);
    if (v) {
      setSelectedVoucher(v);
    } else {
      toast.error("Voucher not found.");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Party Ledger</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Transaction history for a specific party
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<span className="text-sm">📄</span>}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            icon={<span className="text-sm">🖨️</span>}
          >
            Print
          </Button>
        </div>
      </div>

      <Card border padding="md" className="no-print">
        <div className="grid gap-4 lg:grid-cols-4">
          <PartySelect
            label="Party"
            value={selectedPartyId}
            onChange={handlePartyChange}
            placeholder="Select party"
          />
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedPartyId("");
                setReportFilters({ partyId: undefined });
                if (currentFiscalYear) {
                  setStartDate(currentFiscalYear.startDate);
                  setEndDate(currentFiscalYear.endDate);
                }
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {selectedParty && statement ? (
        <div className="no-print">
          {/* Party Summary Header Panel */}
          <div
            className="bg-white border rounded-lg p-4 mb-3 grid grid-cols-4 gap-4 animate-fadeIn"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Party</div>
              <div className="font-bold text-[13px] text-gray-800">{selectedParty?.name}</div>
              <div className="text-[11px] text-gray-500">
                {selectedParty?.pan ? `PAN: ${selectedParty.pan}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Type</div>
              <span className="badge bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                {selectedParty?.type}
              </span>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">
                Opening Balance
              </div>
              <div className="font-mono font-bold text-[14px] text-blue-700">
                {formatNumber(statement?.openingBalance)} {statement?.openingType}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">
                Closing Balance
              </div>
              <div
                className={`font-mono font-bold text-[14px] ${statement.closingType === "Dr" ? "text-green-700" : "text-red-650"}`}
              >
                {formatNumber(statement.closingBalance)} {statement.closingType}
              </div>
            </div>
          </div>

          <div
            className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white animate-fadeIn"
            style={{ borderColor: "var(--border)" }}
          >
            <table className="data-table sticky-thead">
              <thead>
                <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left"
                  >
                    {companySettings?.dateFormat === "BS" ? "Date (BS)" : "Date (AD)"}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left"
                  >
                    Voucher No
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left"
                    style={{ width: "40%" }}
                  >
                    Narration
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right"
                  >
                    Debit
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right"
                  >
                    Credit
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right"
                  >
                    Running Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                <tr className="bg-blue-50 text-[11px] font-medium text-blue-800 italic border-b border-gray-100">
                  <td className="px-3 py-2.5">
                    {companySettings?.dateFormat === "BS" ? formatADToBS(startDate) : startDate}
                  </td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5 font-semibold">Opening Balance</td>
                  <td className="px-3 py-2.5 text-right font-mono">-</td>
                  <td className="px-3 py-2.5 text-right font-mono">-</td>
                  <td className="px-3 py-2.5 text-right font-mono amt font-bold">
                    {formatNumber(statement.openingBalance)} {statement.openingType}
                  </td>
                </tr>

                {computedEntriesWithRunningBalance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-gray-400 text-[12px]">
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  computedEntriesWithRunningBalance.map((row, idx) => (
                    <tr
                      key={`${row.voucherId}-${row.date}-${idx}`}
                      className="border-b border-gray-100 bg-white hover:bg-[#e8eeff] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {companySettings?.dateFormat === "BS" ? row.dateNepali : row.date}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-bold">
                        <button
                          onClick={() => handleOpenVoucher(row.voucherId)}
                          className="text-[#1557b0] hover:underline focus:outline-none"
                        >
                          {row.voucherNo}
                        </button>
                        {row.invoiceRef && (
                          <span className="ml-1 text-[10px] text-gray-400">({row.invoiceRef})</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.voucherType}</td>
                      <td
                        className="px-3 py-2.5 text-[12px] text-gray-700 truncate max-w-xs"
                        title={row.narration}
                      >
                        {row.narration}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-right font-mono amt amt-dr">
                        {row.debit ? formatNumber(row.debit) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-right font-mono amt amt-cr">
                        {row.credit ? formatNumber(row.credit) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-right font-mono amt font-bold">
                        {formatNumber(row.cumulativeBalance)} {row.cumulativeBalanceType}
                      </td>
                    </tr>
                  ))
                )}

                <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe] text-gray-800">
                  <td className="px-3 py-2.5">
                    {companySettings?.dateFormat === "BS" ? formatADToBS(endDate) : endDate}
                  </td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5 font-bold">Closing Balance</td>
                  <td className="px-3 py-2.5 text-right font-mono amt amt-dr">
                    {formatNumber(statement.totalDebit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono amt amt-cr">
                    {formatNumber(statement.totalCredit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono amt font-bold">
                    {formatNumber(statement.closingBalance)} {statement.closingType}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Card border padding="lg" className="text-center text-slate-500 no-print">
          Select a party and date range to view the ledger statement.
        </Card>
      )}

      {/* Voucher Detail Modal Popup */}
      {selectedVoucher && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVoucher(null)}
          title={`Voucher Details: ${selectedVoucher.voucherNo}`}
          size="md"
        >
          <div className="flex flex-col gap-4 text-xs select-none">
            <div className="grid grid-cols-2 gap-4 pb-2 border-b">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">
                  Date (AD)
                </span>
                <span className="font-mono">{selectedVoucher.date}</span>
              </div>
              {selectedVoucher.dateNepali && (
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">
                    Date (BS)
                  </span>
                  <span className="font-mono">{selectedVoucher.dateNepali}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Type</span>
                <span className="uppercase font-semibold">{selectedVoucher.type}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Status</span>
                <span className="badge badge-active uppercase">{selectedVoucher.status}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">
                Particular Ledger Entries
              </span>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#f5f6fa]">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-semibold text-gray-600">
                        Account Head
                      </th>
                      <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Debit</th>
                      <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedVoucher.lines.map((line: any, idx: number) => {
                      const acc = accounts.find((a) => a.id === line.accountId);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2">
                            <div className="font-bold text-gray-800">
                              {acc?.name || line.accountId}
                            </div>
                            {line.narration && (
                              <div className="text-[10px] text-gray-400 italic mt-0.5">
                                {line.narration}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono">
                            {line.debit ? formatNumber(line.debit) : "-"}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono">
                            {line.credit ? formatNumber(line.credit) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedVoucher.narration && (
              <div className="pt-2 border-t">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">
                  Narration
                </span>
                <p className="text-gray-700 italic mt-1">{selectedVoucher.narration}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Print-only View Layout */}
      {selectedParty && statement && (
        <div className="print-only hidden">
          <div className="mb-6 flex justify-between items-end border-b pb-4">
            <div>
              <h1 className="text-[18px] font-bold text-gray-800">SUTRA ERP</h1>
              <h2 className="text-[14px] font-bold text-gray-800 uppercase">
                Party Ledger Statement
              </h2>
              <p className="text-[11px] text-gray-500 mt-1">Party: {selectedParty?.name}</p>
              <p className="text-[11px] text-gray-500">
                Period:{" "}
                {companySettings?.dateFormat === "BS"
                  ? `${formatADToBS(startDate)} to ${formatADToBS(endDate)}`
                  : `${startDate} to ${endDate}`}
              </p>
            </div>
            <div className="text-right text-[10px] text-gray-400">
              Report Date: {new Date().toISOString().split("T")[0]}
            </div>
          </div>

          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                  Date
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                  Voucher No
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                  Type
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                  Narration
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold uppercase">
                  Debit
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold uppercase">
                  Credit
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold uppercase">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="italic bg-gray-50">
                <td className="border border-gray-300 px-3 py-2">
                  {companySettings?.dateFormat === "BS" ? formatADToBS(startDate) : startDate}
                </td>
                <td className="border border-gray-300 px-3 py-2">-</td>
                <td className="border border-gray-300 px-3 py-2">-</td>
                <td className="border border-gray-300 px-3 py-2 font-semibold">Opening Balance</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">-</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">-</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono font-bold">
                  {formatNumber(statement.openingBalance)} {statement.openingType}
                </td>
              </tr>
              {computedEntriesWithRunningBalance.map((row, idx) => (
                <tr key={idx} className="even:bg-gray-50/50">
                  <td className="border border-gray-300 px-3 py-2">
                    {companySettings?.dateFormat === "BS" ? row.dateNepali : row.date}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 font-mono">{row.voucherNo}</td>
                  <td className="border border-gray-300 px-3 py-2 uppercase">{row.voucherType}</td>
                  <td className="border border-gray-300 px-3 py-2">{row.narration}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                    {row.debit ? formatNumber(row.debit) : "-"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                    {row.credit ? formatNumber(row.credit) : "-"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-mono font-bold">
                    {formatNumber(row.cumulativeBalance)} {row.cumulativeBalanceType}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="border border-gray-300 px-3 py-2">
                  {companySettings?.dateFormat === "BS" ? formatADToBS(endDate) : endDate}
                </td>
                <td className="border border-gray-300 px-3 py-2">-</td>
                <td className="border border-gray-300 px-3 py-2">-</td>
                <td className="border border-gray-300 px-3 py-2 font-bold">Closing Balance</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                  {formatNumber(statement.totalDebit)}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                  {formatNumber(statement.totalCredit)}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono font-bold">
                  {formatNumber(statement.closingBalance)} {statement.closingType}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PartyLedgerStatement;
