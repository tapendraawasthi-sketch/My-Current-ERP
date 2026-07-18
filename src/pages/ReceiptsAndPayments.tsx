// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useBranchFilter } from "../hooks/useBranchFilter";

const ReceiptsAndPayments: React.FC = () => {
  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");

  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingBranchFilter, setPendingBranchFilter] = useState(branchFilter);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setBranchFilter(pendingBranchFilter);
    setOptionsOpen(false);
  };

  // Compute receipts and payments data
  const reportData = useMemo(() => {
    if (!vouchers || !accounts)
      return {
        openingBalance: 0,
        closingBalance: 0,
        receipts: [],
        payments: [],
        totalReceipts: 0,
        totalPayments: 0,
      };

    // Identify cash and bank accounts
    const cashBankAccounts = accounts.filter(
      (acc) =>
        !acc.isGroup &&
        (acc.name.toLowerCase().includes("cash") || acc.name.toLowerCase().includes("bank")),
    );

    const cashBankAccountIds = new Set(cashBankAccounts.map((acc) => acc.id));

    // Calculate opening balance (sum of opening balances for cash/bank accounts)
    const openingBalance = cashBankAccounts.reduce((sum, acc) => {
      return sum + (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0);
    }, 0);

    // Filter vouchers that involve cash or bank accounts
    const relevantVouchers = vouchers.filter(
      (v) =>
        v.status === "posted" &&
        v.date >= startDate &&
        v.date <= endDate &&
        matchBranch(v.branchId) &&
        v.lines.some((line) => cashBankAccountIds.has(line.accountId)),
    );

    // Separate receipts and payments based on whether cash/bank was debited or credited
    const receiptVouchers = relevantVouchers.filter((v) =>
      v.lines.some((line) => cashBankAccountIds.has(line.accountId) && line.debit > 0),
    );

    const paymentVouchers = relevantVouchers.filter((v) =>
      v.lines.some((line) => cashBankAccountIds.has(line.accountId) && line.credit > 0),
    );

    // Helper function to categorize accounts
    const categorizeAccount = (accountId: string, isReceipt: boolean) => {
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) return isReceipt ? "Other Receipts" : "Other Payments";

      const lowerName = acc.name.toLowerCase();
      const lowerGroup =
        (acc.parentId ? accounts.find((a) => a.id === acc.parentId)?.name?.toLowerCase() : "") ||
        "";

      // Receipt categories
      if (isReceipt) {
        if (lowerName.includes("salary") || lowerName.includes("wages")) return "Salaries";
        if (lowerName.includes("rent")) return "Rent";
        if (lowerName.includes("electricity") || lowerName.includes("utility")) return "Utilities";
        if (acc.type === "income" || lowerGroup.includes("sales")) return "Sales (Cash)";
        if (acc.type === "liability" && (lowerName.includes("loan") || lowerGroup.includes("loan")))
          return "Loans Received";
        if (lowerGroup.includes("sundry debtors") || acc.type === "customer")
          return "Receipts from Customers";
        if (lowerName.includes("capital") || lowerName.includes("equity"))
          return "Capital Introduced";
        if (lowerName.includes("interest")) return "Interest Received";
        return "Other Receipts";
      }
      // Payment categories
      else {
        if (lowerName.includes("salary") || lowerName.includes("wages")) return "Salaries Paid";
        if (lowerName.includes("rent")) return "Rent Paid";
        if (lowerName.includes("electricity") || lowerName.includes("utility"))
          return "Utilities / Electricity";
        if (acc.type === "expense" || lowerGroup.includes("purchase")) return "Purchase (Cash)";
        if (lowerGroup.includes("sundry creditors") || acc.type === "supplier")
          return "Payments to Suppliers";
        if (lowerName.includes("loan") || lowerGroup.includes("loan")) return "Loan Repayments";
        if (lowerName.includes("capital") || lowerName.includes("drawing"))
          return "Capital Withdrawn / Drawings";
        return "Other Payments";
      }
    };

    // Group receipts by category
    const receiptGroups: Record<string, number> = {};
    receiptVouchers.forEach((voucher) => {
      // Find the non-cash/bank account in the voucher
      const nonCashBankLine = voucher.lines.find((line) => !cashBankAccountIds.has(line.accountId));
      if (nonCashBankLine) {
        const category = categorizeAccount(nonCashBankLine.accountId, true);
        const amount = nonCashBankLine.credit || 0; // For receipts, the non-cash account is credited
        receiptGroups[category] = (receiptGroups[category] || 0) + amount;
      }
    });

    // Group payments by category
    const paymentGroups: Record<string, number> = {};
    paymentVouchers.forEach((voucher) => {
      // Find the non-cash/bank account in the voucher
      const nonCashBankLine = voucher.lines.find((line) => !cashBankAccountIds.has(line.accountId));
      if (nonCashBankLine) {
        const category = categorizeAccount(nonCashBankLine.accountId, false);
        const amount = nonCashBankLine.debit || 0; // For payments, the non-cash account is debited
        paymentGroups[category] = (paymentGroups[category] || 0) + amount;
      }
    });

    // Calculate closing balance
    const totalReceipts = Object.values(receiptGroups).reduce((sum, val) => sum + val, 0);
    const totalPayments = Object.values(paymentGroups).reduce((sum, val) => sum + val, 0);
    const closingBalance = openingBalance + totalReceipts - totalPayments;

    // Convert groups to arrays for display
    const receipts = Object.entries(receiptGroups).map(([category, amount]) => ({
      category,
      amount,
    }));

    const payments = Object.entries(paymentGroups).map(([category, amount]) => ({
      category,
      amount,
    }));

    // Add opening balance to receipts
    receipts.unshift({ category: "Opening Balance", amount: openingBalance });
    // Add closing balance to payments
    payments.push({ category: "Closing Balance", amount: closingBalance });

    return {
      openingBalance,
      closingBalance,
      receipts,
      payments,
      totalReceipts: openingBalance + totalReceipts,
      totalPayments: totalPayments + closingBalance,
    };
  }, [vouchers, accounts, startDate, endDate, matchBranch, branchFilter]);

  return (
    <ReportShell
      title="Receipts and Payments Account"
      subtitle="Cash basis income and expenditure summary"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingBranchFilter(branchFilter);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }]}
      toolbarLeft={
        <>
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
        </>
      }
    >
      {/* T-Format Receipts and Payments Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-md bg-white mb-6">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-1/2">
                RECEIPTS
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right border-r border-gray-200 w-[120px]">
                Amount (Rs.)
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-1/2">
                PAYMENTS
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right w-[120px]">
                Amount (Rs.)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Receipts and Payments rows */}
            {(() => {
              const maxRows = Math.max(reportData.receipts.length, reportData.payments.length);
              const rows = [];

              for (let i = 0; i < maxRows; i++) {
                const receipt = reportData.receipts[i];
                const payment = reportData.payments[i];

                rows.push(
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 border-r border-gray-200">
                      {receipt ? receipt.category : ""}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right border-r border-gray-200">
                      {receipt && receipt.amount !== 0 ? formatNumber(receipt.amount) : ""}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 border-r border-gray-200">
                      {payment ? payment.category : ""}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right">
                      {payment && payment.amount !== 0 ? formatNumber(payment.amount) : ""}
                    </td>
                  </tr>,
                );
              }

              return rows;
            })()}

            {/* Totals */}
            <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
              <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-r border-[#c7d2fe]">
                TOTAL RECEIPTS
              </td>
              <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right border-r border-[#c7d2fe]">
                {formatNumber(reportData.totalReceipts)}
              </td>
              <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-r border-[#c7d2fe]">
                TOTAL PAYMENTS
              </td>
              <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                {formatNumber(reportData.totalPayments)}
              </td>
            </tr>

            {/* Verification row */}
            <tr
              className={`border-t border-gray-200 ${Math.abs(reportData.totalReceipts - reportData.totalPayments) < 0.01 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
            >
              <td
                colSpan={4}
                className="px-3 py-3 text-[12px] font-bold text-center border-t border-gray-200"
              >
                {Math.abs(reportData.totalReceipts - reportData.totalPayments) < 0.01
                  ? "✓ RECEIPTS AND PAYMENTS BALANCE"
                  : "⚠️ RECEIPTS AND PAYMENTS DO NOT BALANCE"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Receipts and Payments Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          {branchOptions.length > 0 && (
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
              Branch
              <select
                value={pendingBranchFilter}
                onChange={(e) => setPendingBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default ReceiptsAndPayments;
