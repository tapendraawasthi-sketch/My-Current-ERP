// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import {
  buildAccountTree,
  computeLedgerTotals,
  computeGroupTotals,
} from "../lib/reportingHierarchy";
import { ReportWorkspace } from "@/features/reports";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useBranchFilter } from "../hooks/useBranchFilter";

const FundsFlowStatement: React.FC = () => {
  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");

  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setOptionsOpen(false);
  };

  const scopedVouchers = useMemo(
    () => (vouchers || []).filter((v) => matchBranch(v.branchId)),
    [vouchers, matchBranch, branchFilter],
  );

  // Compute funds flow data
  const fundsFlowData = useMemo(() => {
    if (!scopedVouchers || !accounts)
      return {
        sources: [],
        applications: [],
        netIncreaseInWC: 0,
        scheduleOfWorkingCapital: [],
      };

    // Define current asset and liability groups
    const currentAssetGroups = [
      "Cash-in-Hand",
      "Bank Accounts",
      "Sundry Debtors",
      "Stock-in-Hand",
      "Loans & Advances (Asset)",
      "Deposits (Asset)",
    ];
    const currentLiabilityGroups = [
      "Sundry Creditors",
      "Duties & Taxes",
      "Provisions",
      "Current Liabilities",
    ];
    const fixedAssetGroups = ["Fixed Assets"];
    const loanGroups = ["Loans (Liability)", "Long-term Loans"];
    const capitalGroups = ["Capital Account", "Reserves and Surplus"];

    // Helper function to check if an account belongs to a group
    const isInGroup = (accountId: string, groupNames: string[]): boolean => {
      const account = accounts.find((acc) => acc.id === accountId);
      if (!account) return false;

      // Check direct parent group
      if (account.parentId) {
        const parent = accounts.find((acc) => acc.id === account.parentId);
        if (parent && groupNames.includes(parent.name)) return true;
      }

      // Check if account name matches group
      return groupNames.includes(account.name);
    };

    // Compute ledger totals for the period
    const ledgerTotals = computeLedgerTotals(scopedVouchers, startDate, endDate);

    // Calculate opening and closing balances for working capital items
    const scheduleOfWorkingCapital = [];
    const totalOpeningWC =
      currentAssetGroups.reduce((sum, groupName) => {
        const groupAccounts = accounts.filter(
          (acc) =>
            acc.name === groupName ||
            acc.parentId === accounts.find((g) => g.name === groupName)?.id,
        );

        let openingBal = 0;
        let closingBal = 0;

        groupAccounts.forEach((acc) => {
          const opening = (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0);
          const closing =
            (ledgerTotals[acc.id]?.balanceDr || 0) - (ledgerTotals[acc.id]?.balanceCr || 0);
          openingBal += opening;
          closingBal += closing;
        });

        scheduleOfWorkingCapital.push({
          item: groupName,
          opening: openingBal,
          closing: closingBal,
          increase: closingBal > openingBal ? closingBal - openingBal : 0,
          decrease: closingBal < openingBal ? openingBal - closingBal : 0,
        });

        return sum + openingBal;
      }, 0) -
      currentLiabilityGroups.reduce((sum, groupName) => {
        const groupAccounts = accounts.filter(
          (acc) =>
            acc.name === groupName ||
            acc.parentId === accounts.find((g) => g.name === groupName)?.id,
        );

        let openingBal = 0;
        let closingBal = 0;

        groupAccounts.forEach((acc) => {
          const opening = (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0);
          const closing =
            (ledgerTotals[acc.id]?.balanceDr || 0) - (ledgerTotals[acc.id]?.balanceCr || 0);
          openingBal += opening;
          closingBal += closing;
        });

        scheduleOfWorkingCapital.push({
          item: groupName,
          opening: -openingBal, // Liability should be negative
          closing: -closingBal, // Liability should be negative
          increase: closingBal > openingBal ? closingBal - openingBal : 0, // This would actually be a decrease in WC
          decrease: closingBal < openingBal ? openingBal - closingBal : 0, // This would actually be an increase in WC
        });

        return sum + openingBal;
      }, 0);

    // Recalculate properly for schedule
    const scheduleWithCalculations = [...currentAssetGroups, ...currentLiabilityGroups].map(
      (groupName) => {
        const groupAccounts = accounts.filter(
          (acc) =>
            acc.name === groupName ||
            acc.parentId === accounts.find((g) => g.name === groupName)?.id,
        );

        let openingBal = 0;
        let closingBal = 0;

        groupAccounts.forEach((acc) => {
          const opening = (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0);
          const closing =
            (ledgerTotals[acc.id]?.balanceDr || 0) - (ledgerTotals[acc.id]?.balanceCr || 0);
          openingBal += opening;
          closingBal += closing;
        });

        // For liabilities, we want the opposite sign for WC calculation
        const isLiability = currentLiabilityGroups.includes(groupName);
        const openingWc = isLiability ? -openingBal : openingBal;
        const closingWc = isLiability ? -closingBal : closingBal;

        const diff = closingWc - openingWc;
        const increase = diff > 0 ? diff : 0;
        const decrease = diff < 0 ? Math.abs(diff) : 0;

        return {
          item: groupName,
          opening: openingWc,
          closing: closingWc,
          increase,
          decrease,
        };
      },
    );

    // Calculate net change in working capital
    const netChangeInWC = scheduleWithCalculations.reduce(
      (sum, item) => sum + (item.closing - item.opening),
      0,
    );

    // Compute sources and applications
    const relevantVouchers = scopedVouchers.filter(
      (v) => v.status === "posted" && v.date >= startDate && v.date <= endDate,
    );

    // Sources of funds
    let netProfit = 0;
    let depreciation = 0;
    let saleOfFixedAssets = 0;
    let longTermLoansRaised = 0;
    let capitalIntroduced = 0;

    // Applications of funds
    let purchaseOfFixedAssets = 0;
    let repaymentOfLoans = 0;
    let drawings = 0;
    let investmentsMade = 0;

    relevantVouchers.forEach((voucher) => {
      // Calculate net profit by looking at income and expense accounts
      voucher.lines.forEach((line) => {
        const account = accounts.find((acc) => acc.id === line.accountId);
        if (account) {
          if (account.type === "income" && line.credit > 0) {
            netProfit += line.credit;
          } else if (account.type === "expense" && line.debit > 0) {
            netProfit -= line.debit;
          }

          // Check for depreciation (commonly named accounts)
          if (account.name.toLowerCase().includes("depreciation") && line.debit > 0) {
            depreciation += line.debit;
          }

          // Fixed assets transactions
          if (isInGroup(account.id, fixedAssetGroups)) {
            if (line.credit > 0) {
              saleOfFixedAssets += line.credit;
            } else if (line.debit > 0) {
              purchaseOfFixedAssets += line.debit;
            }
          }

          // Loan transactions
          if (isInGroup(account.id, loanGroups)) {
            if (line.credit > 0) {
              longTermLoansRaised += line.credit;
            } else if (line.debit > 0) {
              repaymentOfLoans += line.debit;
            }
          }

          // Capital/equity transactions
          if (isInGroup(account.id, capitalGroups)) {
            if (line.credit > 0) {
              capitalIntroduced += line.credit;
            } else if (line.debit > 0) {
              drawings += line.debit;
            }
          }

          // Investment transactions (if there are specific investment accounts)
          if (account.name.toLowerCase().includes("investment") && line.debit > 0) {
            investmentsMade += line.debit;
          }
        }
      });
    });

    // Sources of funds
    const sources = [
      { id: "net-profit", label: "Net Profit for the Period", amount: Math.max(0, netProfit) },
      { id: "depreciation", label: "Add: Depreciation", amount: depreciation },
      { id: "sale-fixed-assets", label: "Sale of Fixed Assets", amount: saleOfFixedAssets },
      {
        id: "long-term-loans-raised",
        label: "Long-term Loans Raised",
        amount: longTermLoansRaised,
      },
      { id: "capital-introduced", label: "Capital Introduced", amount: capitalIntroduced },
    ];

    const totalSources = sources.reduce((sum, item) => sum + item.amount, 0);

    // Applications of funds
    const applications = [
      {
        id: "purchase-fixed-assets",
        label: "Purchase of Fixed Assets",
        amount: purchaseOfFixedAssets,
      },
      { id: "repayment-loans", label: "Repayment of Long-term Loans", amount: repaymentOfLoans },
      { id: "drawings", label: "Drawings", amount: drawings },
      { id: "investments-made", label: "Investments Made", amount: investmentsMade },
    ];

    const totalApplications = applications.reduce((sum, item) => sum + item.amount, 0);

    // Determine net increase/decrease in working capital
    const netIncreaseInWC = netChangeInWC; // Directly from WC schedule
    let netIncreaseInWcSource = 0;
    let netIncreaseInWcApplication = 0;

    if (netIncreaseInWC > 0) {
      // Working capital increased - this is an application of funds
      netIncreaseInWcApplication = netIncreaseInWC;
      applications.push({
        id: "net-increase-wc",
        label: "Net Increase in Working Capital",
        amount: netIncreaseInWC,
      });
    } else {
      // Working capital decreased - this is a source of funds
      netIncreaseInWcSource = Math.abs(netIncreaseInWC);
      sources.push({
        id: "net-decrease-wc",
        label: "Net Decrease in Working Capital",
        amount: Math.abs(netIncreaseInWC),
      });
    }

    const finalTotalSources = totalSources + netIncreaseInWcSource;
    const finalTotalApplications = totalApplications + netIncreaseInWcApplication;

    return {
      sources,
      applications,
      netIncreaseInWC,
      scheduleOfWorkingCapital: scheduleWithCalculations,
      totalSources: finalTotalSources,
      totalApplications: finalTotalApplications,
    };
  }, [scopedVouchers, accounts, startDate, endDate]);

  return (
    <ReportWorkspace
      title="Funds flow"
      description="Sources and uses of funds."
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodLabel={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setOptionsOpen(true);
      }}
      filterSlot={
        <>
          <label className="text-[12px] font-medium text-gray-600 flex items-center gap-1.5">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="text-[12px] font-medium text-gray-600 flex items-center gap-1.5">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          {branchOptions.length > 0 && (
            <label className="text-[12px] font-medium text-gray-600 flex items-center gap-1.5">
              Branch:
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
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
        </>
      }
    >
      {/* T-Format Funds Flow Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-md bg-white mb-8">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
              <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-1/2">
                SOURCES OF FUNDS
              </th>
              <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide text-right border-r border-gray-200 w-[120px]">
                Amount (Rs.)
              </th>
              <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-1/2">
                APPLICATIONS OF FUNDS
              </th>
              <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide text-right w-[120px]">
                Amount (Rs.)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Sources and Applications rows */}
            {(() => {
              const maxRows = Math.max(
                fundsFlowData.sources.length,
                fundsFlowData.applications.length,
              );
              const rows = [];

              for (let i = 0; i < maxRows; i++) {
                const source = fundsFlowData.sources[i];
                const application = fundsFlowData.applications[i];

                rows.push(
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 border-r border-gray-200">
                      {source ? source.label : ""}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right border-r border-gray-200">
                      {source && source.amount !== 0 ? formatNumber(source.amount) : ""}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 border-r border-gray-200">
                      {application ? application.label : ""}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right">
                      {application && application.amount !== 0
                        ? formatNumber(application.amount)
                        : ""}
                    </td>
                  </tr>,
                );
              }

              return rows;
            })()}

            {/* Totals */}
            <tr className="bg-[var(--ds-surface-selected)] border-t-2 border-[var(--ds-border-strong)]">
              <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-r border-[var(--ds-border-strong)]">
                TOTAL SOURCES
              </td>
              <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right border-r border-[var(--ds-border-strong)]">
                {formatNumber(fundsFlowData.totalSources)}
              </td>
              <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-r border-[var(--ds-border-strong)]">
                TOTAL APPLICATIONS
              </td>
              <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                {formatNumber(fundsFlowData.totalApplications)}
              </td>
            </tr>

            {/* Verification row */}
            <tr
              className={`border-t border-gray-200 ${fundsFlowData.totalSources === fundsFlowData.totalApplications ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
            >
              <td
                colSpan={4}
                className="px-3 py-3 text-[12px] font-bold text-center border-t border-gray-200"
              >
                {fundsFlowData.totalSources === fundsFlowData.totalApplications
                  ? "FUND FLOW STATEMENT BALANCES"
                  : "FUND FLOW STATEMENT DOES NOT BALANCE"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Schedule of Changes in Working Capital */}
      <div className="mb-6">
        <h3 className="text-[13px] font-semibold text-gray-800 mb-3 px-1">
          Schedule of Changes in Working Capital
        </h3>
        <div className="overflow-x-auto border border-gray-200 rounded-md bg-white">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  Item
                </th>
                <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide text-right border-r border-gray-200 w-[140px]">
                  Opening (Rs.)
                </th>
                <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide text-right border-r border-gray-200 w-[140px]">
                  Closing (Rs.)
                </th>
                <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide text-right border-r border-gray-200 w-[140px]">
                  Increase (Rs.)
                </th>
                <th className="px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide text-right w-[140px]">
                  Decrease (Rs.)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fundsFlowData.scheduleOfWorkingCapital.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 border-r border-gray-200">
                    {item.item}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right border-r border-gray-200">
                    {item.opening !== 0 ? formatNumber(item.opening) : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right border-r border-gray-200">
                    {item.closing !== 0 ? formatNumber(item.closing) : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right border-r border-gray-200">
                    {item.increase !== 0 ? formatNumber(item.increase) : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right">
                    {item.decrease !== 0 ? formatNumber(item.decrease) : "-"}
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              <tr className="bg-[var(--ds-surface-muted)] border-t-2 border-gray-200">
                <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-r border-gray-200">
                  TOTAL
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right border-r border-gray-200">
                  {formatNumber(
                    fundsFlowData.scheduleOfWorkingCapital.reduce(
                      (sum, item) => sum + item.opening,
                      0,
                    ),
                  )}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right border-r border-gray-200">
                  {formatNumber(
                    fundsFlowData.scheduleOfWorkingCapital.reduce(
                      (sum, item) => sum + item.closing,
                      0,
                    ),
                  )}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right border-r border-gray-200">
                  {formatNumber(
                    fundsFlowData.scheduleOfWorkingCapital.reduce(
                      (sum, item) => sum + item.increase,
                      0,
                    ),
                  )}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                  {formatNumber(
                    fundsFlowData.scheduleOfWorkingCapital.reduce(
                      (sum, item) => sum + item.decrease,
                      0,
                    ),
                  )}
                </td>
              </tr>

              {/* Net Change row */}
              <tr className="bg-[var(--ds-surface-selected)] border-t-2 border-[var(--ds-border-strong)]">
                <td
                  colSpan={2}
                  className="px-3 py-2.5 text-[12px] font-bold text-gray-800 border-r border-[var(--ds-border-strong)]"
                >
                  NET CHANGE IN WORKING CAPITAL
                </td>
                <td
                  colSpan={3}
                  className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right"
                >
                  {formatNumber(
                    fundsFlowData.scheduleOfWorkingCapital.reduce(
                      (sum, item) => sum + (item.closing - item.opening),
                      0,
                    ),
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Funds flow Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-gray-600">
            From Date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px] font-medium text-gray-600">
            To Date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
        </div>
      </ReportOptionsModal>
    </ReportWorkspace>
  );
};

export default FundsFlowStatement;
