/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Balance Sheet report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Table, NepaliDatePicker } from "../components/ui";
import { ReportHeader } from "../components/reports/ReportHeader";
import { FileSpreadsheet, Printer, Layers, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { computeBalanceSheet } from "../lib/accounting";
import { exportBalanceSheetToExcel } from "../lib/exportUtils";
import { generateBalanceSheetPDF } from "../lib/printUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { subYears } from "date-fns";
import toast from "react-hot-toast";

interface BalanceLine {
  id: string;
  name: string;
  amount: number;
  prevAmount?: number;
  diffAmount?: number;
  level: number;
  isGroup?: boolean;
  isSummary?: boolean;
  parentId?: string;
  children?: BalanceLine[];
}

const BalanceSheet: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear } = useStore();
  const [asOfDate, setAsOfDate] = useState<string>(
    currentFiscalYear?.endDate || dateToAD(new Date()),
  );
  const [showPreviousYear, setShowPreviousYear] = useState<boolean>(true);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(
    new Set([
      "shareholders-funds",
      "long-term-liabilities",
      "current-liabilities",
      "fixed-assets",
      "current-assets",
      "fixed-schedule",
    ]),
  );

  useEffect(() => {
    if (currentFiscalYear?.endDate) {
      setAsOfDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  const balanceSheet = useMemo(() => {
    return computeBalanceSheet(accounts, vouchers, asOfDate);
  }, [accounts, vouchers, asOfDate]);

  const previousAsOfDate = useMemo(() => {
    return dateToAD(subYears(new Date(asOfDate), 1));
  }, [asOfDate]);

  const previousBalanceSheet = useMemo(() => {
    return computeBalanceSheet(accounts, vouchers, previousAsOfDate);
  }, [accounts, vouchers, previousAsOfDate]);

  const fixedAssetSchedule = useMemo(() => {
    const fixedAssets =
      balanceSheet.assets.find((row) => row.accountId === "bs-fa")?.children || [];
    const depreciationAccounts = fixedAssets.filter((row) =>
      /depreciation|accumulated depreciation/i.test(row.accountName),
    );
    const assetAccounts = fixedAssets.filter(
      (row) => !/depreciation|accumulated depreciation/i.test(row.accountName),
    );

    return assetAccounts.map((asset) => {
      const dep =
        depreciationAccounts.find((depRow) => {
          return asset.accountName.toLowerCase().includes("land") &&
            depRow.accountName.toLowerCase().includes("depreciation")
            ? true
            : asset.accountName.toLowerCase().includes("plant") &&
                /machinery|plant/i.test(depRow.accountName);
        }) || null;

      const gross = dep ? round2(asset.amount + Math.abs(dep.amount)) : asset.amount;
      const depreciation = dep ? Math.abs(dep.amount) : 0;
      const net = asset.amount;

      return {
        id: `fixed-schedule-${asset.accountId}`,
        name: asset.accountName,
        gross,
        depreciation,
        net,
      };
    });
  }, [balanceSheet.assets]);

  const liabilitiesCategories = useMemo(() => {
    const longTermRows =
      balanceSheet.liabilities.find((row) => row.accountId === "bs-tl")?.children || [];
    const currentRows =
      balanceSheet.liabilities.find((row) => row.accountId === "bs-cl")?.children || [];

    return {
      longTerm: categorizeLiabilities(longTermRows),
      current: categorizeLiabilities(currentRows),
    };
  }, [balanceSheet.liabilities]);

  const shareholderFunds = useMemo(() => {
    const equityChildren =
      balanceSheet.equity.find((row) => row.accountId === "bs-eq-cap")?.children || [];
    const shareCapital = equityChildren
      .filter((row) => /share|capital|equity|partners?/i.test(row.accountName))
      .reduce((sum, row) => sum + row.amount, 0);
    const retainedEarnings = equityChildren
      .filter((row) => /retained|earnings|reserves|surplus/i.test(row.accountName))
      .reduce((sum, row) => sum + row.amount, 0);
    const netProfit = balanceSheet.equity.find((row) => row.accountId === "bs-eq-re")?.amount || 0;
    return {
      shareCapital: shareCapital || balanceSheet.equity[0]?.amount || 0,
      retainedEarnings,
      netProfit,
      totalFunds: round2(
        (shareCapital || balanceSheet.equity[0]?.amount || 0) + retainedEarnings + netProfit,
      ),
    };
  }, [balanceSheet.equity]);

  const currentAssetCategories = useMemo(() => {
    const currentRows =
      balanceSheet.assets.find((row) => row.accountId === "bs-ca")?.children || [];
    return categorizeAssets(currentRows);
  }, [balanceSheet.assets]);

  const totalSources = round2(balanceSheet.totalLiabilities + balanceSheet.totalEquity);
  const totalApplication = balanceSheet.totalAssets;
  const balanced = balanceSheet.isBalanced;

  const dataRows = useMemo(() => {
    const rows: BalanceLine[] = [
      {
        id: "shareholders-funds",
        name: "SHAREHOLDER'S FUNDS",
        amount: shareholderFunds.totalFunds,
        prevAmount: showPreviousYear
          ? round2(previousBalanceSheet.totalLiabilities + previousBalanceSheet.totalEquity)
          : undefined,
        diffAmount: showPreviousYear
          ? round2(
              shareholderFunds.totalFunds -
                round2(previousBalanceSheet.totalLiabilities + previousBalanceSheet.totalEquity),
            )
          : undefined,
        level: 0,
        isGroup: true,
        isSummary: true,
        children: [
          {
            id: "share-capital",
            name: "Share Capital",
            amount: shareholderFunds.shareCapital,
            prevAmount: showPreviousYear
              ? round2(previousBalanceSheet.equity[0]?.amount || 0)
              : undefined,
            level: 1,
          },
          {
            id: "retained-earnings",
            name: "Retained Earnings",
            amount: shareholderFunds.retainedEarnings,
            prevAmount: showPreviousYear
              ? round2(
                  previousBalanceSheet.equity
                    .find((r) => r.accountId === "bs-eq-cap")
                    ?.children?.filter((row) =>
                      /retained|earnings|reserves|surplus/i.test(row.accountName),
                    )
                    .reduce((sum, row) => sum + row.amount, 0) ?? 0,
                )
              : undefined,
            level: 1,
          },
          {
            id: "net-profit-year",
            name: "Net Profit for the Year",
            amount: shareholderFunds.netProfit,
            prevAmount: showPreviousYear
              ? round2(
                  previousBalanceSheet.equity.find((r) => r.accountId === "bs-eq-re")?.amount || 0,
                )
              : undefined,
            level: 1,
          },
          {
            id: "total-shareholder-funds",
            name: "Total Shareholder’s Funds",
            amount: shareholderFunds.totalFunds,
            prevAmount: showPreviousYear
              ? round2(previousBalanceSheet.totalLiabilities + previousBalanceSheet.totalEquity)
              : undefined,
            level: 1,
            isSummary: true,
          },
        ],
      },
      {
        id: "long-term-liabilities",
        name: "LONG-TERM LIABILITIES",
        amount: balanceSheet.liabilities.find((row) => row.accountId === "bs-tl")?.amount || 0,
        prevAmount: showPreviousYear
          ? previousBalanceSheet.liabilities.find((row) => row.accountId === "bs-tl")?.amount || 0
          : undefined,
        diffAmount: showPreviousYear
          ? round2(
              (balanceSheet.liabilities.find((row) => row.accountId === "bs-tl")?.amount || 0) -
                (previousBalanceSheet.liabilities.find((row) => row.accountId === "bs-tl")
                  ?.amount || 0),
            )
          : undefined,
        level: 0,
        isGroup: true,
        children: [
          ...liabilitiesCategories.longTerm,
          {
            id: "total-long-term-liabilities",
            name: "Total Long-term Liabilities",
            amount: balanceSheet.liabilities.find((row) => row.accountId === "bs-tl")?.amount || 0,
            level: 1,
            isSummary: true,
          },
        ],
      },
      {
        id: "current-liabilities",
        name: "CURRENT LIABILITIES",
        amount: balanceSheet.liabilities.find((row) => row.accountId === "bs-cl")?.amount || 0,
        prevAmount: showPreviousYear
          ? previousBalanceSheet.liabilities.find((row) => row.accountId === "bs-cl")?.amount || 0
          : undefined,
        diffAmount: showPreviousYear
          ? round2(
              (balanceSheet.liabilities.find((row) => row.accountId === "bs-cl")?.amount || 0) -
                (previousBalanceSheet.liabilities.find((row) => row.accountId === "bs-cl")
                  ?.amount || 0),
            )
          : undefined,
        level: 0,
        isGroup: true,
        children: [
          ...liabilitiesCategories.current,
          {
            id: "total-current-liabilities",
            name: "Total Current Liabilities",
            amount: balanceSheet.liabilities.find((row) => row.accountId === "bs-cl")?.amount || 0,
            level: 1,
            isSummary: true,
          },
        ],
      },
      {
        id: "total-sources",
        name: "TOTAL SOURCES",
        amount: totalSources,
        prevAmount: showPreviousYear
          ? round2(previousBalanceSheet.totalLiabilities + previousBalanceSheet.totalEquity)
          : undefined,
        diffAmount: showPreviousYear
          ? round2(
              totalSources -
                round2(previousBalanceSheet.totalLiabilities + previousBalanceSheet.totalEquity),
            )
          : undefined,
        level: 0,
        isSummary: true,
      },
      {
        id: "fixed-assets",
        name: "FIXED ASSETS",
        amount: balanceSheet.assets.find((row) => row.accountId === "bs-fa")?.amount || 0,
        prevAmount: showPreviousYear
          ? previousBalanceSheet.assets.find((row) => row.accountId === "bs-fa")?.amount || 0
          : undefined,
        diffAmount: showPreviousYear
          ? round2(
              (balanceSheet.assets.find((row) => row.accountId === "bs-fa")?.amount || 0) -
                (previousBalanceSheet.assets.find((row) => row.accountId === "bs-fa")?.amount || 0),
            )
          : undefined,
        level: 0,
        isGroup: true,
        children: [
          ...fixedAssetSchedule.map((asset) => ({
            id: asset.id,
            name: asset.name,
            amount: asset.net,
            prevAmount: undefined,
            diffAmount: undefined,
            level: 1,
          })),
          {
            id: "total-fixed-assets",
            name: "Total Fixed Assets",
            amount: balanceSheet.assets.find((row) => row.accountId === "bs-fa")?.amount || 0,
            level: 1,
            isSummary: true,
          },
        ],
      },
      {
        id: "current-assets",
        name: "CURRENT ASSETS",
        amount: balanceSheet.assets.find((row) => row.accountId === "bs-ca")?.amount || 0,
        prevAmount: showPreviousYear
          ? previousBalanceSheet.assets.find((row) => row.accountId === "bs-ca")?.amount || 0
          : undefined,
        diffAmount: showPreviousYear
          ? round2(
              (balanceSheet.assets.find((row) => row.accountId === "bs-ca")?.amount || 0) -
                (previousBalanceSheet.assets.find((row) => row.accountId === "bs-ca")?.amount || 0),
            )
          : undefined,
        level: 0,
        isGroup: true,
        children: [
          ...currentAssetCategories,
          {
            id: "total-current-assets",
            name: "Total Current Assets",
            amount: balanceSheet.assets.find((row) => row.accountId === "bs-ca")?.amount || 0,
            level: 1,
            isSummary: true,
          },
        ],
      },
      {
        id: "total-application",
        name: "TOTAL APPLICATION",
        amount: totalApplication,
        prevAmount: showPreviousYear ? previousBalanceSheet.totalAssets : undefined,
        diffAmount: showPreviousYear
          ? round2(totalApplication - previousBalanceSheet.totalAssets)
          : undefined,
        level: 0,
        isSummary: true,
      },
    ];

    return flatten(rows, expandedRowIds);
  }, [
    shareholderFunds,
    balanceSheet,
    previousBalanceSheet,
    showPreviousYear,
    liabilitiesCategories,
    currentAssetCategories,
    fixedAssetSchedule,
    totalSources,
    totalApplication,
    expandedRowIds,
  ]);

  const handleExport = () => {
    try {
      exportBalanceSheetToExcel({
        assets: balanceSheet.assets,
        liabilities: balanceSheet.liabilities,
        equity: balanceSheet.equity,
        totalAssets: balanceSheet.totalAssets,
        totalLiabilities: balanceSheet.totalLiabilities,
        totalEquity: balanceSheet.totalEquity,
      });
      toast.success("Balance Sheet exported to Excel.");
    } catch (error: any) {
      toast.error(error?.message || "Could not export Balance Sheet.");
    }
  };

  const handlePrint = () => {
    try {
      const blob = generateBalanceSheetPDF(
        {
          assets: balanceSheet.assets,
          liabilities: balanceSheet.liabilities,
          equity: balanceSheet.equity,
          totalAssets: balanceSheet.totalAssets,
          totalLiabilities: balanceSheet.totalLiabilities,
          totalEquity: balanceSheet.totalEquity,
          isBalanced: balanced,
        },
        companySettings,
        asOfDate,
      );
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (error: any) {
      toast.error(error?.message || "Could not generate PDF.");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const columns = [
    {
      key: "name",
      header: "Particulars",
      width: "40%",
      render: (_: any, row: BalanceLine) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex w-4 justify-center text-slate-400">
            {row.children && row.children.length > 0 ? (
              row.isGroup ? (
                expandedRowIds.has(row.id) ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : (
                  <ArrowUpRight className="h-3 w-3" />
                )
              ) : null
            ) : null}
          </span>
          <span
            className={`${row.level === 0 ? "font-bold text-slate-900" : row.level === 1 ? "font-semibold text-slate-800" : "text-slate-600"} ${row.isSummary ? "text-slate-900" : ""}`}
            style={{ paddingLeft: `${row.level * 12}px` }}
          >
            {row.name}
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount (Rs.)",
      align: "right",
      render: (value: number) => <span className="font-mono">Rs. {formatNumber(value)}</span>,
    },
    {
      key: "prevAmount",
      header: showPreviousYear ? "Previous Year" : " ",
      align: "right",
      render: (value: number) =>
        showPreviousYear ? <span className="font-mono">Rs. {formatNumber(value || 0)}</span> : null,
    },
    {
      key: "diffAmount",
      header: showPreviousYear ? "Variance" : " ",
      align: "right",
      render: (value: number) =>
        showPreviousYear ? (
          <span
            className={value >= 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}
          >
            {value !== undefined ? `Rs. ${formatNumber(value)}` : "-"}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn text-xs select-none">
      {companySettings && (
        <ReportHeader
          title="Balance Sheet"
          period={`As of ${asOfDate}`}
          company={companySettings}
        />
      )}
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Balance Sheet</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Assets, liabilities and equity as of selected date
          </p>
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
            variant="outline"
            size="sm"
            icon={<Printer className="h-4 w-4" />}
            onClick={handlePrint}
          >
            Print PDF
          </Button>
        </div>
      </div>

      <Card border padding="md" className="no-print">
        <div className="grid gap-4 lg:grid-cols-3">
          <NepaliDatePicker label="As of Date" value={asOfDate} onChange={setAsOfDate} />
          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={showPreviousYear}
                onChange={(event) => setShowPreviousYear(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Compare with Previous Year
            </label>
            {showPreviousYear && (
              <div className="text-[11px] text-slate-500">
                Previous comparison as of{" "}
                <span className="font-semibold text-slate-700">{previousAsOfDate}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card border padding="md" className="bg-slate-50 no-print">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Total Sources
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              Rs. {formatNumber(totalSources)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Total Application
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              Rs. {formatNumber(totalApplication)}
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm font-bold">
          {balanced ? (
            <Badge variant="success">BALANCED ✓</Badge>
          ) : (
            <Badge variant="danger">
              UNBALANCED (Diff: Rs. {formatNumber(round2(totalSources - totalApplication))})
            </Badge>
          )}
        </div>
      </Card>

      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
        <table role="table" className="data-table w-full">
          <thead>
            <tr>
              <th
                scope="col"
                className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left"
                style={{ width: "40%" }}
              >
                Particulars
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right"
              >
                Amount (Rs.)
              </th>
              {showPreviousYear && (
                <>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right"
                  >
                    Previous Year
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right"
                  >
                    Variance
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {dataRows.length === 0 ? (
              <tr>
                <td
                  colSpan={showPreviousYear ? 4 : 2}
                  className="text-center py-8 text-gray-400 font-medium text-[12px]"
                >
                  No balance sheet data available.
                </td>
              </tr>
            ) : (
              dataRows.map((row) => {
                const isLevel0 = row.level === 0;
                const rowClass = isLevel0
                  ? "bg-[#f0f4ff] font-semibold text-[11px] text-gray-700 uppercase tracking-wide cursor-pointer"
                  : "border-b border-gray-100 hover:bg-[#f0f4ff] bg-white transition-colors cursor-pointer";

                return (
                  <tr
                    key={row.id}
                    onClick={() => row.children?.length && toggleExpand(row.id)}
                    className={rowClass}
                  >
                    <td className="px-3 py-2.5 text-left">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex w-4 justify-center text-slate-400">
                          {row.children && row.children.length > 0 ? (
                            row.isGroup ? (
                              expandedRowIds.has(row.id) ? (
                                <ArrowDownRight className="h-3 w-3" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3" />
                              )
                            ) : null
                          ) : null}
                        </span>
                        <span
                          className={`${isLevel0 ? "" : row.level === 1 ? "font-semibold text-slate-800 text-[12px]" : "text-slate-600 text-[12px]"} ${row.isSummary && !isLevel0 ? "text-slate-900 font-bold" : ""}`}
                          style={{ paddingLeft: `${row.level * 12}px` }}
                        >
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right amt font-mono ${isLevel0 ? "text-[11px]" : "text-[12px]"}`}
                    >
                      Rs. {formatNumber(row.amount)}
                    </td>
                    {showPreviousYear && (
                      <>
                        <td
                          className={`px-3 py-2.5 text-right amt font-mono ${isLevel0 ? "text-[11px]" : "text-[12px]"}`}
                        >
                          Rs. {formatNumber(row.prevAmount || 0)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right amt ${isLevel0 ? "text-[11px]" : "text-[12px]"}`}
                        >
                          <span
                            className={
                              (row.diffAmount || 0) >= 0
                                ? "text-[#059669] font-semibold"
                                : "text-[#dc2626] font-semibold"
                            }
                          >
                            {row.diffAmount !== undefined
                              ? `Rs. ${formatNumber(row.diffAmount)}`
                              : "-"}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Card border padding="md" className="bg-white">
        <div className="text-xs text-slate-600 leading-relaxed space-y-2">
          <p className="font-bold uppercase tracking-[0.25em] text-slate-500">
            Fixed Assets Schedule
          </p>
          {fixedAssetSchedule.length === 0 ? (
            <p>No fixed asset schedule available.</p>
          ) : (
            <div className="grid gap-2 text-[11px]">
              {fixedAssetSchedule.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-12 gap-2 items-center border-b border-slate-100 py-2"
                >
                  <div className="col-span-6 text-slate-700">{row.name}</div>
                  <div className="col-span-2 text-right text-slate-600">
                    Gross: Rs. {formatNumber(row.gross)}
                  </div>
                  <div className="col-span-2 text-right text-slate-600">
                    Dep: Rs. {formatNumber(row.depreciation)}
                  </div>
                  <div className="col-span-2 text-right font-bold text-slate-900">
                    Net: Rs. {formatNumber(row.net)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

function categorizeLiabilities(rows: any[]) {
  const categories = [
    {
      id: "sundry-creditors",
      name: "Sundry Creditors",
      keyword: ["creditor", "creditors"],
      amount: 0,
    },
    {
      id: "outstanding-expenses",
      name: "Outstanding Expenses",
      keyword: ["outstanding", "expense"],
      amount: 0,
    },
    { id: "vat-payable", name: "VAT Payable", keyword: ["vat"], amount: 0 },
    { id: "tds-payable", name: "TDS Payable", keyword: ["tds"], amount: 0 },
    {
      id: "short-term-loans",
      name: "Short-term Loans",
      keyword: ["loan", "short-term", "short term"],
      amount: 0,
    },
    { id: "other-liabilities", name: "Other Liabilities", keyword: [], amount: 0 },
  ];

  rows.forEach((row) => {
    const found = categories.find((category) =>
      category.keyword.some((keyword) => row.accountName.toLowerCase().includes(keyword)),
    );
    if (found) {
      found.amount += row.amount;
    } else {
      categories[categories.length - 1].amount += row.amount;
    }
  });

  return categories
    .filter((row) => row.amount !== 0)
    .map((row) => ({ id: row.id, name: row.name, amount: row.amount, level: 1 }));
}

function categorizeAssets(rows: any[]) {
  const categories = [
    { id: "stock-in-hand", name: "Stock in Hand", keyword: ["stock", "inventory"], amount: 0 },
    {
      id: "sundry-debtors",
      name: "Sundry Debtors",
      keyword: ["debtor", "debtors", "receivable"],
      amount: 0,
    },
    { id: "cash-in-hand", name: "Cash in Hand", keyword: ["cash"], amount: 0 },
    { id: "bank-balances", name: "Bank Balances", keyword: ["bank"], amount: 0 },
    { id: "loans-advances", name: "Loans & Advances", keyword: ["loan", "advance"], amount: 0 },
    { id: "prepaid-expenses", name: "Prepaid Expenses", keyword: ["prepaid"], amount: 0 },
    {
      id: "duties-taxes",
      name: "Duties & Taxes",
      keyword: ["vat", "tds", "tax", "duty"],
      amount: 0,
    },
    { id: "other-assets", name: "Other Current Assets", keyword: [], amount: 0 },
  ];

  rows.forEach((row) => {
    const found = categories.find((category) =>
      category.keyword.some((keyword) => row.accountName.toLowerCase().includes(keyword)),
    );
    if (found) {
      found.amount += row.amount;
    } else {
      categories[categories.length - 1].amount += row.amount;
    }
  });

  return categories
    .filter((row) => row.amount !== 0)
    .map((row) => ({ id: row.id, name: row.name, amount: row.amount, level: 1 }));
}

function flatten(rows: BalanceLine[], expanded: Set<string>) {
  const result: BalanceLine[] = [];
  rows.forEach((row) => {
    result.push(row);
    if (row.children && row.children.length > 0 && expanded.has(row.id)) {
      result.push(...flatten(row.children, expanded));
    }
  });
  return result;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default BalanceSheet;
