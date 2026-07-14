// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Party ledger statement page with opening balance, bill-wise ledger and printable statement.
 */

import { DualDate } from "../components/ui/DualDate";
import React, { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { ReportWorkspace } from "@/features/reports";
import { useStore } from "../store/useStore";
import { NepaliDatePicker, PartySelect } from "../components/ui";
import { computePartyStatement, computePartyOutstandingSummary, computeInvoiceOutstanding } from "../lib/accounting";
import { exportLedgerToExcel } from "../lib/exportUtils";
import { generatePartyStatementPDF } from "../lib/printUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { VoucherType, VoucherStatus, PaymentStatus, Party, ReportPeriodPreset } from "../lib/types";
import toast from "@/lib/appToast";
import { mergeSystemConfiguration, getAgeingBucketIndex } from "../lib/systemConfiguration";

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

  const partyDashboard = mergeSystemConfiguration(
    companySettings?.systemConfiguration,
  ).partyDashboard;
  const ageingSlabs = mergeSystemConfiguration(companySettings?.systemConfiguration).ageingSlabs;

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
    return computePartyOutstandingSummary(selectedParty.id, invoices, vouchers);
  }, [selectedParty, invoices, vouchers]);

  const creditLimitPercent = useMemo(() => {
    if (!selectedParty?.creditLimit || !outstandingSummary) return 0;
    const pct = (outstandingSummary.totalReceivable / selectedParty.creditLimit) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [selectedParty, outstandingSummary]);

  const partyOutstanding = useMemo(() => {
    if (!selectedPartyId) return null;

    let balance = 0;
    let type: "debtor" | "creditor" = "debtor";

    for (const inv of invoices) {
      if (inv.partyId !== selectedPartyId) continue;
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const outstanding = computeInvoiceOutstanding(inv, vouchers);
      if (outstanding <= 0.005) continue;
      if (t.includes("sales-invoice")) {
        balance += outstanding;
        type = "debtor";
      }
      if (t.includes("purchase-invoice")) {
        balance -= outstanding;
        type = "creditor";
      }
    }

    return { balance: Math.abs(balance), type: balance >= 0 ? "debtor" : "creditor" };
  }, [invoices, selectedPartyId, vouchers]);

  const statement = useMemo(() => {
    if (!selectedParty) {
      return null;
    }
    return computePartyStatement(selectedParty, accounts, vouchers, invoices, startDate, endDate);
  }, [selectedParty, accounts, vouchers, invoices, startDate, endDate]);

  const lastInvoice = useMemo(() => {
    if (!selectedPartyId) return null;
    return [...invoices]
      .filter((inv) => inv.partyId === selectedPartyId && inv.status === "posted")
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
  }, [invoices, selectedPartyId]);

  const partyAgingBuckets = useMemo(() => {
    if (!selectedPartyId) return [];
    const today = new Date().toISOString().slice(0, 10);
    const buckets = ageingSlabs.map((s) => ({ label: s.label, amount: 0 }));
    for (const inv of invoices) {
      if (inv.partyId !== selectedPartyId || inv.status !== "posted") continue;
      const outstanding = computeInvoiceOutstanding(inv, vouchers);
      if (outstanding <= 0.005) continue;
      const refDate = inv.dueDate || inv.date;
      const days = refDate
        ? Math.max(
            0,
            Math.floor((new Date(today).getTime() - new Date(refDate).getTime()) / 86400000),
          )
        : 0;
      const idx = getAgeingBucketIndex(days, ageingSlabs);
      buckets[idx].amount += outstanding;
    }
    return buckets.filter((b) => b.amount > 0);
  }, [invoices, selectedPartyId, vouchers, ageingSlabs]);

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
    {
      key: "date",
      header: "Date",
      render: (_: any, row: any) => (
        <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} />
      ),
    },
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
    <ReportWorkspace
      title="Customer / supplier statement"
      description="Running balance for one party."
      companyName={companySettings?.companyNameEn || companySettings?.companyName || companySettings?.name}
      periodLabel={`${startDate} to ${endDate}`}
      onPrint={handlePrint}
      onExportExcel={handleExport}
      filterSlot={
        <>
          <PartySelect
            label="Party"
            value={selectedPartyId}
            onChange={handlePartyChange}
            placeholder="Select party"
          />
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
          <button
            type="button"
            onClick={() => {
              setSelectedPartyId("");
              setReportFilters({ partyId: undefined });
              if (currentFiscalYear) {
                setStartDate(currentFiscalYear.startDate);
                setEndDate(currentFiscalYear.endDate);
              }
            }}
            className="h-8 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 text-[13px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]"
          >
            Reset
          </button>
        </>
      }
    >

      {selectedParty && statement ? (
        <>
          <div className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                Party
              </div>
              <div className="text-[13px] font-semibold text-gray-800">{selectedParty?.name}</div>
              <div className="text-[12px] text-gray-500">
                {selectedParty?.pan ? `PAN: ${selectedParty.pan}` : ""}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                Type
              </div>
              <span className="inline-flex rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-blue-100 text-blue-700">
                {selectedParty?.type}
              </span>
            </div>
            <div>
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                Opening Balance
              </div>
              <div className="font-mono text-[14px] font-bold text-gray-800">
                {formatNumber(Math.abs(statement?.openingBalance || 0))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                Closing Balance
              </div>
              {(() => {
                const closingBalance =
                  statement.closingType === "Dr"
                    ? statement.closingBalance
                    : -statement.closingBalance;
                return (
                  <div
                    className={`font-mono text-[14px] font-bold ${closingBalance >= 0 ? "text-green-700" : "text-red-600"}`}
                  >
                    {formatNumber(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="mb-4 rounded-md border border-gray-200 bg-white p-3 no-print">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setSummaryExpanded(!summaryExpanded)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-800">
                  Outstanding Summary Analysis
                </span>
                <span className="text-[12px] font-medium text-gray-500">
                  (Click to {summaryExpanded ? "Collapse" : "Expand"})
                </span>
              </div>
              <div className="text-xs font-semibold text-gray-600">
                {summaryExpanded ? "▲" : "▼"}
              </div>
            </button>

            {summaryExpanded && outstandingSummary && (
              <div className="mt-3 space-y-3 border-t border-gray-200 pt-3 animate-fadeIn">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {partyDashboard.showOutstanding && (
                    <div className="flex flex-col gap-1">
                      <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                        Total Receivable / Payable
                      </div>
                      <div className="flex items-center gap-4 text-[12px] mt-0.5">
                        <div>
                          <span className="mr-1 text-gray-500">Receivable:</span>
                          <strong className="text-green-700 font-mono">
                            रू {formatNumber(outstandingSummary.totalReceivable)}
                          </strong>
                        </div>
                        <div>
                          <span className="mr-1 text-gray-500">Payable:</span>
                          <strong className="text-red-600 font-mono">
                            रू {formatNumber(outstandingSummary.totalPayable)}
                          </strong>
                        </div>
                      </div>
                      <div className="mt-1 text-[12px] text-gray-500">
                        Net Outstanding:{" "}
                        <strong
                          className={
                            outstandingSummary.netOutstanding >= 0
                              ? "text-green-700 font-mono"
                              : "text-red-600 font-mono"
                          }
                        >
                          रू {formatNumber(Math.abs(outstandingSummary.netOutstanding))}{" "}
                          {outstandingSummary.netOutstanding >= 0 ? "Dr" : "Cr"}
                        </strong>
                      </div>
                    </div>
                  )}

                  {partyDashboard.showLastInvoice && (
                    <div className="flex flex-col gap-1">
                      <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                        Last Invoice
                      </div>
                      {lastInvoice ? (
                        <div className="mt-0.5 text-[12px] text-gray-700">
                          <strong>{lastInvoice.invoiceNo || lastInvoice.voucherNo}</strong> dated{" "}
                          <span className="font-mono">{lastInvoice.date}</span>
                          <span className="ml-2 font-mono font-semibold">
                            रू {formatNumber(lastInvoice.grandTotal || 0)}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-0.5 text-[12px] italic text-gray-500">
                          No invoices found.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                      Oldest Pending Bill
                    </div>
                    {outstandingSummary.oldestBillNo ? (
                      <div className="mt-0.5 text-[12px] text-gray-700">
                        <strong>{outstandingSummary.oldestBillNo}</strong> dated{" "}
                        <span className="font-mono">{outstandingSummary.oldestBillDate}</span>
                        <span className="text-red-600 font-semibold ml-2">
                          ({outstandingSummary.oldestDays} days old)
                        </span>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[12px] italic text-gray-500">
                        No pending bills.
                      </div>
                    )}
                  </div>

                  {partyDashboard.showCreditLimit && (
                    <div className="flex flex-col gap-1">
                      <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                        Credit Limit Utilization
                      </div>
                      {selectedParty.creditLimit && selectedParty.creditLimit > 0 ? (
                        <div className="mt-1">
                          <div className="mb-1 flex justify-between text-[12px] text-gray-500">
                            <span>Limit: रू {formatNumber(selectedParty.creditLimit)}</span>
                            <span>{creditLimitPercent}% Used</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                creditLimitPercent > 90
                                  ? "bg-red-600"
                                  : creditLimitPercent > 50
                                    ? "bg-amber-500"
                                    : "bg-green-600"
                              }`}
                              style={{ width: `${creditLimitPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-0.5 text-[12px] italic text-gray-500">
                          No credit limit set.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {partyDashboard.showAgingSummary && partyAgingBuckets.length > 0 && (
                  <div>
                    <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                      Ageing Summary
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {partyAgingBuckets.map((b) => (
                        <span
                          key={b.label}
                          className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[12px] font-mono text-gray-700"
                        >
                          {b.label}: रू {formatNumber(b.amount)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full overflow-x-auto rounded-md border border-gray-200 bg-white animate-fadeIn">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Date (BS)
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Voucher No
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-500"
                    style={{ width: "40%" }}
                  >
                    Narration
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Debit
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Credit
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="border-b border-blue-100 bg-blue-50 text-[12px] text-gray-700">
                  <td className="px-3 py-2.5">{startDate}</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5 font-semibold">Opening Balance</td>
                  <td className="px-3 py-2.5 text-right font-mono">-</td>
                  <td className="px-3 py-2.5 text-right font-mono">-</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">
                    {formatNumber(statement.openingBalance)} {statement.openingType}
                  </td>
                </tr>

                {statement.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[12px] text-gray-500">
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  statement.entries.map((row, idx) => (
                    <tr
                      key={`${row.voucherId}-${row.date}-${idx}`}
                      className="bg-white transition-colors hover:bg-gray-50"
                    >
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.dateNepali}</td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-gray-800">
                        {row.voucherNo}
                        {row.invoiceRef && (
                          <span className="ml-1 text-[12px] text-gray-500">({row.invoiceRef})</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.voucherType}</td>
                      <td
                        className="max-w-xs truncate px-3 py-2.5 text-[12px] text-gray-700"
                        title={row.narration}
                      >
                        {row.narration}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {row.debit ? formatNumber(row.debit) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {row.credit ? formatNumber(row.credit) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                        {formatNumber(row.balance)} {row.balanceType}
                      </td>
                    </tr>
                  ))
                )}

                <tr className="bg-[var(--ds-brand-50)] text-[12px] font-bold text-gray-800 border-t-2 border-[var(--ds-action-primary)]">
                  <td className="px-3 py-2.5">{endDate}</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5">-</td>
                  <td className="px-3 py-2.5 font-bold">Closing Balance</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatNumber(statement.totalDebit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatNumber(statement.totalCredit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">
                    {formatNumber(statement.closingBalance)} {statement.closingType}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white px-6 py-12 text-center text-[12px] text-gray-500">
          Select a party and date range to view the ledger statement.
        </div>
      )}
    </ReportWorkspace>
  );
};

export default PartyLedgerStatement;
