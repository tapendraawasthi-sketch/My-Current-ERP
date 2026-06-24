// @ts-nocheck
/**
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Party ledger statement page with opening balance, bill-wise ledger and printable statement.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker, Table, PartySelect } from "../components/ui";
import { computePartyStatement, computeOutstandingAnalysis } from "../lib/accounting";
import { exportLedgerToExcel } from "../lib/exportUtils";
import { generatePartyStatementPDF } from "../lib/printUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { VoucherType, VoucherStatus, PaymentStatus, Party, ReportPeriodPreset } from "../lib/types";
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
  } = useStore();

  const [selectedPartyId, setSelectedPartyId] = useState<string>(reportFilters.partyId || "");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || dateToAD(new Date()));
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));
  const [summaryExpanded, setSummaryExpanded] = useState(true);

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

  const outstandingSummary = useMemo(() => {
    if (!selectedParty) return null;
    return computeOutstandingAnalysis(selectedParty.id, invoices);
  }, [selectedParty, invoices]);

  const creditLimitPercent = useMemo(() => {
    if (!selectedParty?.creditLimit || !outstandingSummary) return 0;
    const pct = (outstandingSummary.totalReceivable / selectedParty.creditLimit) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [selectedParty, outstandingSummary]);

  const statement = useMemo(() => {
    if (!selectedParty) {
      return null;
    }
    return computePartyStatement(selectedParty, accounts, vouchers, invoices, startDate, endDate);
  }, [selectedParty, accounts, vouchers, invoices, startDate, endDate]);

  const handlePrint = () => {
    if (!selectedParty || !statement) {
      toast.error("Select a party before printing.");
      return;
    }

    try {
      const blob = generatePartyStatementPDF(selectedParty, statement, companySettings, {
        startDate,
        endDate,
        preset: ReportPeriodPreset.CUSTOM,
      });
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (error: any) {
      toast.error(error?.message || "Could not generate statement PDF.");
    }
  };

  const handleExport = () => {
    if (!selectedParty || !statement) {
      toast.error("Select a party before export.");
      return;
    }

    const fileName = `${selectedParty.name.replace(/[^a-zA-Z0-9]/g, "_")}_Party_Statement.xlsx`;
    exportLedgerToExcel(`${selectedParty.name} Ledger`, statement.entries, fileName);
    toast.success("Party ledger statement exported to Excel.");
  };

  const partyOptions = useMemo(
    () =>
      parties
        .filter((party) => party.isActive)
        .map((party) => ({ value: party.id, label: `${party.name} (${party.type})` })),
    [parties],
  );

  const handlePartyChange = (id: string) => {
    setSelectedPartyId(id);
    setReportFilters({ partyId: id });
  };

  const statementColumns = [
    { key: "date", header: "Date", render: (_: any, row: any) => <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} /> },
    { key: "voucherNo", header: "Voucher No" },
    { key: "voucherType", header: "Type" },
    { key: "narration", header: "Narration", width: "40%" },
    {
      key: "debit",
      header: "Debit",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "credit",
      header: "Credit",
      align: "right",
      render: (value: number) => formatNumber(value),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (_: number, row: any) => `${formatNumber(row.balance)} ${row.balanceType}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000]">Party Ledger</h1>
          <p className="text-[11px] text-[#000000] mt-0.5">
            Transaction history for a specific party
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            icon={<span className="text-sm">📄</span>}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            icon={<span className="text-sm">🖨️</span>}
          >
            Print PDF
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
        <>
          {/* Party Summary Header Panel */}
          <div className="bg-white border rounded-lg p-4 mb-3 grid grid-cols-4 gap-4 animate-fadeIn" style={{ borderColor: "var(--border)" }}>
            <div>
              <div className="text-[10px] text-[#000000] font-bold uppercase mb-1">Party</div>
              <div className="font-bold text-[13px] text-[#000000]">{selectedParty?.name}</div>
              <div className="text-[11px] text-[#000000]">{selectedParty?.pan ? `PAN: ${selectedParty.pan}` : ""}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#000000] font-bold uppercase mb-1">Type</div>
              <span className={`badge bg-[#D4EABD] text-[#000000] px-2 py-0.5 rounded text-[10px] font-semibold uppercase`}>{selectedParty?.type}</span>
            </div>
            <div>
              <div className="text-[10px] text-[#000000] font-bold uppercase mb-1">Opening Balance</div>
              <div className="font-mono font-bold text-[14px] text-[#000000]">
                {formatNumber(Math.abs(statement?.openingBalance || 0))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#000000] font-bold uppercase mb-1">Closing Balance</div>
              {(() => {
                const closingBalance = statement.closingType === "Dr" ? statement.closingBalance : -statement.closingBalance;
                return (
                  <div className={`font-mono font-bold text-[14px] ${closingBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {formatNumber(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Outstanding Summary Collapsible Card */}
          <Card border padding="sm" className="mb-4 no-print">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setSummaryExpanded(!summaryExpanded)}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#000000] text-xs"> Outstanding Summary Analysis</span>
                <span className="text-[10px] text-[#000000] font-semibold">(Click to {summaryExpanded ? "Collapse" : "Expand"})</span>
              </div>
              <div className="text-[#000000] font-bold text-xs">
                {summaryExpanded ? "▲" : "▼"}
              </div>
            </div>

            {summaryExpanded && outstandingSummary && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#9DC07A] animate-fadeIn">
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-[#000000] font-bold uppercase">Total Receivable / Payable</div>
                  <div className="flex items-center gap-4 text-[11px] mt-0.5">
                    <div>
                      <span className="text-[#000000] mr-1">Receivable:</span>
                      <strong className="text-green-700 font-mono">रू {formatNumber(outstandingSummary.totalReceivable)}</strong>
                    </div>
                    <div>
                      <span className="text-[#000000] mr-1">Payable:</span>
                      <strong className="text-red-600 font-mono">रू {formatNumber(outstandingSummary.totalPayable)}</strong>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#000000] mt-1">
                    Net Outstanding: <strong className={outstandingSummary.netOutstanding >= 0 ? "text-green-700 font-mono" : "text-red-600 font-mono"}>
                      रू {formatNumber(Math.abs(outstandingSummary.netOutstanding))} {outstandingSummary.netOutstanding >= 0 ? "Dr" : "Cr"}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-[#000000] font-bold uppercase">Oldest Pending Bill</div>
                  {outstandingSummary.oldestBillNo ? (
                    <div className="text-[11px] text-[#000000] mt-0.5">
                      <strong>{outstandingSummary.oldestBillNo}</strong> dated <span className="font-mono">{outstandingSummary.oldestBillDate}</span>
                      <span className="text-red-600 font-semibold ml-2">({outstandingSummary.oldestDays} days old)</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#000000] italic mt-0.5">No pending bills.</div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-[#000000] font-bold uppercase">Credit Limit Utilization</div>
                  {selectedParty.creditLimit && selectedParty.creditLimit > 0 ? (
                    <div className="mt-1">
                      <div className="flex justify-between text-[9px] text-[#000000] mb-1">
                        <span>Limit: रू {formatNumber(selectedParty.creditLimit)}</span>
                        <span>{creditLimitPercent}% Used</span>
                      </div>
                      <div className="w-full bg-[#EBF5E2] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            creditLimitPercent > 90
                              ? "bg-red-600"
                              : creditLimitPercent > 50
                              ? "bg-amber-500"
                              : "bg-green-600"
                          }`}
                          style={{ width: `${creditLimitPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#000000] italic mt-0.5">No credit limit set.</div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <div className="w-full overflow-x-auto border border-[#9DC07A] rounded-lg shadow-sm bg-white animate-fadeIn" style={{ borderColor: "var(--border)" }}>
            <table className="data-table sticky-thead">
              <thead>
                <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Date (BS)</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Voucher No</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Type</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left" style={{ width: "40%" }}>Narration</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Debit</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Credit</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                <tr className="bg-[#D4EABD] text-[11px] font-medium text-[#000000] italic border-b border-[#9DC07A]">
                  <td className="px-3 py-2.5">{startDate}</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5 font-semibold">Opening Balance</td>
                  <td className="px-3 py-2.5 text-right font-mono">-</td>
                  <td className="px-3 py-2.5 text-right font-mono">-</td>
                  <td className="px-3 py-2.5 text-right font-mono amt font-bold">
                    {formatNumber(statement.openingBalance)} {statement.openingType}
                  </td>
                </tr>

                {statement.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-[#000000] text-[12px]">
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  statement.entries.map((row, idx) => (
                    <tr
                      key={`${row.voucherId}-${row.date}-${idx}`}
                      className="border-b border-[#9DC07A] bg-white hover:bg-[#e8eeff] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[12px] text-[#000000]">{row.dateNepali}</td>
                      <td className="px-3 py-2.5 text-[12px] text-[#000000] font-bold">
                        {row.voucherNo}
                        {row.invoiceRef && (
                          <span className="ml-1 text-[10px] text-[#000000]">({row.invoiceRef})</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[#000000]">{row.voucherType}</td>
                      <td
                        className="px-3 py-2.5 text-[12px] text-[#000000] truncate max-w-xs"
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
                        {formatNumber(row.balance)} {row.balanceType}
                      </td>
                    </tr>
                  ))
                )}

                <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe] text-[#000000]">
                  <td className="px-3 py-2.5">{endDate}</td>
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
        </>
      ) : (
        <Card border padding="lg" className="text-center text-[#000000]">
          Select a party and date range to view the ledger statement.
        </Card>
      )}
    </div>
  );
};

export default PartyLedgerStatement;

