import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker, Input } from "../components/ui";
import { FileSpreadsheet, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { computeTrialBalance, computeMultiYearTrialBalance } from "../lib/accounting";
import { workbookFromArray, downloadWorkbook } from "../lib/exportUtils";
import { generateTrialBalancePDF } from "../lib/printUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { AccountLevel, ReportPeriodPreset, TrialBalanceRow } from "../lib/types";
import toast from "react-hot-toast";

const groupByOptions = [
  { value: "all", label: "All Levels" },
  { value: AccountLevel.GROUP, label: "Group" },
  { value: AccountLevel.SUBGROUP, label: "Subgroup" },
  { value: AccountLevel.LEDGER, label: "Ledger" },
];

const levelOrder = {
  [AccountLevel.GROUP]: 0,
  [AccountLevel.SUBGROUP]: 1,
  [AccountLevel.LEDGER]: 2,
  [AccountLevel.SUBLEDGER]: 3,
};

interface HierarchyRow extends TrialBalanceRow {
  parentId?: string;
  level: AccountLevel;
  accountCode: string;
  accountName: string;
  accountNameNepali: string;
  indent: number;
  isGroup: boolean;
  children: HierarchyRow[];
}

const TrialBalance: React.FC = () => {
  const {
    accounts,
    vouchers,
    companySettings,
    currentFiscalYear,
    setCurrentPage,
    setReportFilters,
  } = useStore();

  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "2026-07-16");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "2027-07-15");
  
  // Options states
  const [format, setFormat] = useState<"balanceOnly" | "movement" | "sevenColumn">("sevenColumn");
  const [level, setLevel] = useState<"group" | "account" | "both">("both");
  const [compareMode, setCompareMode] = useState<"none" | "prev1" | "prev2">("none");
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [showNepaliNames, setShowNepaliNames] = useState(false);

  // Collapsed Groups State
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  // Compute fiscal year names
  const currentFYName = currentFiscalYear?.name || "Current FY";
  const priorFYName = useMemo(() => {
    const match = currentFYName.match(/(\d+)-(\d+)/);
    if (match) {
      const y1 = parseInt(match[1]) - 1;
      const y2 = parseInt(match[2]) - 1;
      return `FY ${y1}-${y2}`;
    }
    return "Previous FY";
  }, [currentFYName]);

  const prior2FYName = useMemo(() => {
    const match = currentFYName.match(/(\d+)-(\d+)/);
    if (match) {
      const y1 = parseInt(match[1]) - 2;
      const y2 = parseInt(match[2]) - 2;
      return `FY ${y1}-${y2}`;
    }
    return "Prior 2 FYs";
  }, [currentFYName]);

  // Load Trial Balance rows
  const multiYearRows = useMemo(() => {
    if (compareMode === "none") {
      return computeTrialBalance(accounts, vouchers, startDate, endDate);
    }
    const currentFYObj = currentFiscalYear || {
      id: "curr",
      name: currentFYName,
      startDate,
      endDate,
      isCurrent: true,
      status: "active" as any
    };
    return computeMultiYearTrialBalance(accounts, vouchers, currentFYObj as any);
  }, [accounts, vouchers, startDate, endDate, compareMode, currentFiscalYear, currentFYName]);

  const nonZeroFilter = (row: TrialBalanceRow) => {
    if (showZeroBalances) return true;
    return Boolean(
      row.openingDr || row.openingCr || row.debit || row.credit || row.closingDr || row.closingCr ||
      (row as any).priorOpeningDr || (row as any).priorOpeningCr || (row as any).priorDebit || (row as any).priorCredit || (row as any).priorClosingDr || (row as any).priorClosingCr
    );
  };

  const buildHierarchyRows = useMemo(() => {
    const map = new Map<string, HierarchyRow>();

    accounts.forEach((account) => {
      map.set(account.id, {
        accountId: account.id,
        accountCode: account.code || "",
        accountName: account.name,
        accountNameNepali: (account as any).nameNepali || account.name,
        level: account.level,
        parentId: account.parentId,
        isGroup: account.isGroup,
        openingDr: 0,
        openingCr: 0,
        debit: 0,
        credit: 0,
        closingDr: 0,
        closingCr: 0,
        indent: 0,
        children: [],
      });
    });

    multiYearRows.forEach((row) => {
      const node = map.get(row.accountId);
      if (node) {
        Object.assign(node, row, {
          indent: 0,
          children: node.children || [],
        });
      }
    });

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      }
    }

    const roots = Array.from(map.values()).filter(
      (node) => !node.parentId || !map.has(node.parentId),
    );

    const accumulate = (node: HierarchyRow) => {
      node.children.sort((a, b) => {
        const levelDiff = (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0);
        if (levelDiff !== 0) return levelDiff;
        return a.accountCode.localeCompare(b.accountCode);
      });

      node.children.forEach((child) => {
        accumulate(child);
        if (node.isGroup) {
          node.openingDr = roundSum(node.openingDr, child.openingDr);
          node.openingCr = roundSum(node.openingCr, child.openingCr);
          node.debit = roundSum(node.debit, child.debit);
          node.credit = roundSum(node.credit, child.credit);
          node.closingDr = roundSum(node.closingDr, child.closingDr);
          node.closingCr = roundSum(node.closingCr, child.closingCr);

          if (compareMode !== "none") {
            (node as any).priorOpeningDr = roundSum((node as any).priorOpeningDr || 0, (child as any).priorOpeningDr || 0);
            (node as any).priorOpeningCr = roundSum((node as any).priorOpeningCr || 0, (child as any).priorOpeningCr || 0);
            (node as any).priorDebit = roundSum((node as any).priorDebit || 0, (child as any).priorDebit || 0);
            (node as any).priorCredit = roundSum((node as any).priorCredit || 0, (child as any).priorCredit || 0);
            (node as any).priorClosingDr = roundSum((node as any).priorClosingDr || 0, (child as any).priorClosingDr || 0);
            (node as any).priorClosingCr = roundSum((node as any).priorClosingCr || 0, (child as any).priorClosingCr || 0);

            if (compareMode === "prev2") {
              (node as any).prior2OpeningDr = roundSum((node as any).prior2OpeningDr || 0, (child as any).prior2OpeningDr || 0);
              (node as any).prior2OpeningCr = roundSum((node as any).prior2OpeningCr || 0, (child as any).prior2OpeningCr || 0);
              (node as any).prior2Debit = roundSum((node as any).prior2Debit || 0, (child as any).prior2Debit || 0);
              (node as any).prior2Credit = roundSum((node as any).prior2Credit || 0, (child as any).prior2Credit || 0);
              (node as any).prior2ClosingDr = roundSum((node as any).prior2ClosingDr || 0, (child as any).prior2ClosingDr || 0);
              (node as any).prior2ClosingCr = roundSum((node as any).prior2ClosingCr || 0, (child as any).prior2ClosingCr || 0);
            }
          }
        }
      });
    };

    roots.forEach((root) => accumulate(root));

    const flatRows: HierarchyRow[] = [];
    const flatten = (node: HierarchyRow, depth: number) => {
      node.indent = depth;
      if (node.isGroup || nonZeroFilter(node) || showZeroBalances) {
        flatRows.push(node);
      }
      node.children.forEach((child) => flatten(child, depth + 1));
    };

    roots.sort((a, b) => {
      const orderDiff = (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.accountCode.localeCompare(b.accountCode);
    });
    roots.forEach((root) => flatten(root, 0));

    return flatRows;
  }, [accounts, multiYearRows, showZeroBalances, compareMode]);

  const filteredRows = useMemo(() => {
    return buildHierarchyRows.filter((row) => nonZeroFilter(row));
  }, [buildHierarchyRows, showZeroBalances]);

  const levelFilteredRows = useMemo(() => {
    return filteredRows.filter((row) => {
      if (level === "group") return row.isGroup;
      if (level === "account") return !row.isGroup;
      return true; // "both"
    });
  }, [filteredRows, level]);

  const visibleRows = useMemo(() => {
    const parentMap = new Map<string, string>();
    accounts.forEach((acc) => {
      if (acc.parentId) {
        parentMap.set(acc.id, acc.parentId);
      }
    });

    const isRowVisible = (row: HierarchyRow) => {
      if (level !== "both") return true;

      let currentParentId = row.parentId;
      while (currentParentId) {
        if (collapsedGroups.has(currentParentId)) {
          return false;
        }
        currentParentId = parentMap.get(currentParentId);
      }
      return true;
    };

    return levelFilteredRows.filter(isRowVisible);
  }, [levelFilteredRows, collapsedGroups, accounts, level]);

  // Calculate grand totals from ledger rows only
  const totals = useMemo(() => {
    const ledgers = buildHierarchyRows.filter((r) => !r.isGroup);
    return ledgers.reduce(
      (acc, row) => {
        acc.openingDr += row.openingDr || 0;
        acc.openingCr += row.openingCr || 0;
        acc.debit += row.debit || 0;
        acc.credit += row.credit || 0;
        acc.closingDr += row.closingDr || 0;
        acc.closingCr += row.closingCr || 0;

        acc.priorOpeningDr += (row as any).priorOpeningDr || 0;
        acc.priorOpeningCr += (row as any).priorOpeningCr || 0;
        acc.priorDebit += (row as any).priorDebit || 0;
        acc.priorCredit += (row as any).priorCredit || 0;
        acc.priorClosingDr += (row as any).priorClosingDr || 0;
        acc.priorClosingCr += (row as any).priorClosingCr || 0;

        acc.prior2OpeningDr += (row as any).prior2OpeningDr || 0;
        acc.prior2OpeningCr += (row as any).prior2OpeningCr || 0;
        acc.prior2Debit += (row as any).prior2Debit || 0;
        acc.prior2Credit += (row as any).prior2Credit || 0;
        acc.prior2ClosingDr += (row as any).prior2ClosingDr || 0;
        acc.prior2ClosingCr += (row as any).prior2ClosingCr || 0;

        return acc;
      },
      {
        openingDr: 0, openingCr: 0, debit: 0, credit: 0, closingDr: 0, closingCr: 0,
        priorOpeningDr: 0, priorOpeningCr: 0, priorDebit: 0, priorCredit: 0, priorClosingDr: 0, priorClosingCr: 0,
        prior2OpeningDr: 0, prior2OpeningCr: 0, prior2Debit: 0, prior2Credit: 0, prior2ClosingDr: 0, prior2ClosingCr: 0,
      }
    );
  }, [buildHierarchyRows]);

  const isBalanced = Math.abs(totals.closingDr - totals.closingCr) < 0.01;

  const handleExport = () => {
    try {
      const headers = ["Account Code", "Account Name"];
      
      const addFormatHeaders = (prefixLabel = "") => {
        if (format === "balanceOnly") {
          headers.push(prefixLabel + "Closing Dr", prefixLabel + "Closing Cr");
        } else if (format === "movement") {
          headers.push(prefixLabel + "Period Dr", prefixLabel + "Period Cr");
        } else {
          headers.push(
            prefixLabel + "Opening Dr",
            prefixLabel + "Opening Cr",
            prefixLabel + "Period Dr",
            prefixLabel + "Period Cr",
            prefixLabel + "Closing Dr",
            prefixLabel + "Closing Cr"
          );
        }
      };

      addFormatHeaders("");
      if (compareMode !== "none") addFormatHeaders(priorFYName + " ");
      if (compareMode === "prev2") addFormatHeaders(prior2FYName + " ");
      if (compareMode !== "none") {
        headers.push("Variance Amount", "Variance %");
      }

      const rowsData = visibleRows.map((row) => {
        const rowData = [
          row.accountCode,
          showNepaliNames ? row.accountNameNepali : row.accountName
        ];

        const pushFormatData = (prefix = "") => {
          if (format === "balanceOnly") {
            rowData.push(row[prefix + "closingDr"] || 0, row[prefix + "closingCr"] || 0);
          } else if (format === "movement") {
            rowData.push(row[prefix + "debit"] || 0, row[prefix + "credit"] || 0);
          } else {
            rowData.push(
              row[prefix + "openingDr"] || 0,
              row[prefix + "openingCr"] || 0,
              row[prefix + "debit"] || 0,
              row[prefix + "credit"] || 0,
              row[prefix + "closingDr"] || 0,
              row[prefix + "closingCr"] || 0
            );
          }
        };

        pushFormatData("");
        if (compareMode !== "none") pushFormatData("prior");
        if (compareMode === "prev2") pushFormatData("prior2");
        if (compareMode !== "none") {
          const currentNet = getNetBalance(row, "");
          const priorNet = getNetBalance(row, "prior");
          const varianceAmount = currentNet - priorNet;
          const variancePercent = priorNet !== 0 ? (varianceAmount / Math.abs(priorNet)) * 100 : 0;
          rowData.push(varianceAmount, priorNet !== 0 ? `${Math.round(variancePercent * 100) / 100}%` : "—");
        }

        return rowData;
      });

      const workbook = workbookFromArray(headers, rowsData, "Trial Balance");
      downloadWorkbook(workbook, `Trial_Balance_${endDate}.xlsx`);
      toast.success("Trial Balance exported to Excel.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to export Trial Balance.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRowClick = (row: HierarchyRow) => {
    if (row.isGroup) return;
    if (!row.accountId) return;
    setReportFilters({ accountId: row.accountId, selectedReport: undefined });
    setCurrentPage("ledger");
  };

  const toggleGroupCollapse = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(accountId)) {
      newCollapsed.delete(accountId);
    } else {
      newCollapsed.add(accountId);
    }
    setCollapsedGroups(newCollapsed);
  };

  const getNetBalance = (row: any, prefix = "") => {
    const dr = row[prefix + "closingDr"] || 0;
    const cr = row[prefix + "closingCr"] || 0;
    const type = row.level === AccountLevel.GROUP ? "group" : (accounts.find((a) => a.id === row.accountId)?.type || "asset");
    const isDrNature = type === "asset" || type === "expense";
    return isDrNature ? (dr - cr) : (cr - dr);
  };

  const getVarianceColor = (variance: number, type: string) => {
    if (variance === 0) return "text-gray-500";
    if (type === "expense") {
      return variance > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold";
    }
    if (type === "liability") {
      return variance > 0 ? "text-red-500 font-bold" : "text-green-600 font-bold";
    }
    return variance > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold";
  };

  const renderRowCells = (row: any, totalsRow = false) => {
    const formats = {
      balanceOnly: (prefix = "") => (
        <>
          <td className="amt text-right font-mono text-[12px]">{row[prefix + "closingDr"] ? formatNumber(row[prefix + "closingDr"]) : "—"}</td>
          <td className="amt text-right font-mono text-[12px]">{row[prefix + "closingCr"] ? formatNumber(row[prefix + "closingCr"]) : "—"}</td>
        </>
      ),
      movement: (prefix = "") => (
        <>
          <td className="amt amt-dr text-right font-mono text-[12px]">{row[prefix + "debit"] ? formatNumber(row[prefix + "debit"]) : "—"}</td>
          <td className="amt amt-cr text-right font-mono text-[12px]">{row[prefix + "credit"] ? formatNumber(row[prefix + "credit"]) : "—"}</td>
        </>
      ),
      sevenColumn: (prefix = "") => (
        <>
          <td className="amt text-right font-mono text-[12px]">{row[prefix + "openingDr"] ? formatNumber(row[prefix + "openingDr"]) : "—"}</td>
          <td className="amt text-right font-mono text-[12px]">{row[prefix + "openingCr"] ? formatNumber(row[prefix + "openingCr"]) : "—"}</td>
          <td className="amt amt-dr text-right font-mono text-[12px]">{row[prefix + "debit"] ? formatNumber(row[prefix + "debit"]) : "—"}</td>
          <td className="amt amt-cr text-right font-mono text-[12px]">{row[prefix + "credit"] ? formatNumber(row[prefix + "credit"]) : "—"}</td>
          <td className="amt amt-dr text-right font-mono text-[12px]">{row[prefix + "closingDr"] ? formatNumber(row[prefix + "closingDr"]) : "—"}</td>
          <td className="amt amt-cr text-right font-mono text-[12px]">{row[prefix + "closingCr"] ? formatNumber(row[prefix + "closingCr"]) : "—"}</td>
        </>
      )
    };

    const type = totalsRow ? "asset" : (row.isGroup ? "group" : (accounts.find((a) => a.id === row.accountId)?.type || "asset"));
    const currentNet = getNetBalance(row, "");
    const priorNet = getNetBalance(row, "prior");
    const varianceAmount = currentNet - priorNet;
    const variancePercent = priorNet !== 0 ? (varianceAmount / Math.abs(priorNet)) * 100 : 0;

    return (
      <>
        {formats[format]("")}
        {compareMode !== "none" && formats[format]("prior")}
        {compareMode === "prev2" && formats[format]("prior2")}
        {compareMode !== "none" && (
          <>
            <td className={`text-right font-mono text-[12px] font-bold ${getVarianceColor(varianceAmount, type)}`}>
              {varianceAmount !== 0 ? (varianceAmount > 0 ? "+" : "") + formatNumber(varianceAmount) : "0.00"}
            </td>
            <td className={`text-right font-mono text-[12px] font-bold ${getVarianceColor(varianceAmount, type)}`}>
              {priorNet !== 0 ? (varianceAmount > 0 ? "+" : "") + formatNumber(variancePercent) + "%" : "—"}
            </td>
          </>
        )}
      </>
    );
  };

  const colSpanCount = useMemo(() => {
    const colCountMap = { balanceOnly: 2, movement: 2, sevenColumn: 6 };
    let base = colCountMap[format];
    let multiplier = 1;
    if (compareMode === "prev1") multiplier = 2;
    if (compareMode === "prev2") multiplier = 3;
    let total = base * multiplier + 2; // +2 for code and name
    if (compareMode !== "none") total += 2; // +2 for variance amount & %
    return total;
  }, [format, compareMode]);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Account-wise debit and credit balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            Print PDF
          </Button>
        </div>
      </div>

      {/* Options Panel */}
      <Card border padding="md" className="no-print mb-4 bg-slate-50 border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 text-xs">
          {/* Format Radio */}
          <div>
            <span className="block font-bold text-gray-700 uppercase mb-2">Format</span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbFormat"
                  value="balanceOnly"
                  checked={format === "balanceOnly"}
                  onChange={() => setFormat("balanceOnly")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Balance Only
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbFormat"
                  value="movement"
                  checked={format === "movement"}
                  onChange={() => setFormat("movement")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Movement Only
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbFormat"
                  value="sevenColumn"
                  checked={format === "sevenColumn"}
                  onChange={() => setFormat("sevenColumn")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                7-Column (Full)
              </label>
            </div>
          </div>

          {/* Level Radio */}
          <div>
            <span className="block font-bold text-gray-700 uppercase mb-2">Display Level</span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbLevel"
                  value="group"
                  checked={level === "group"}
                  onChange={() => setLevel("group")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Groups Only
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbLevel"
                  value="account"
                  checked={level === "account"}
                  onChange={() => setLevel("account")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Ledgers Only
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbLevel"
                  value="both"
                  checked={level === "both"}
                  onChange={() => setLevel("both")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Both (Hierarchy)
              </label>
            </div>
          </div>

          {/* Compare With Radio */}
          <div>
            <span className="block font-bold text-gray-700 uppercase mb-2">Compare With</span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbCompare"
                  value="none"
                  checked={compareMode === "none"}
                  onChange={() => setCompareMode("none")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                None
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbCompare"
                  value="prev1"
                  checked={compareMode === "prev1"}
                  onChange={() => setCompareMode("prev1")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Previous FY
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="tbCompare"
                  value="prev2"
                  checked={compareMode === "prev2"}
                  onChange={() => setCompareMode("prev2")}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Previous 2 FYs
              </label>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="flex flex-col gap-4 justify-center">
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={showZeroBalances}
                onChange={(e) => setShowZeroBalances(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500/20"
              />
              Show Zero Balance
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={showNepaliNames}
                onChange={(e) => setShowNepaliNames(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500/20"
              />
              Show Nepali Names
            </label>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 font-medium shrink-0">From:</span>
              <NepaliDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 font-medium shrink-0">To:</span>
              <NepaliDatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>
      </Card>

      {/* Report Title Card */}
      <div className="bg-white border rounded-lg mb-3 overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="text-center py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">{companySettings?.name}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{companySettings?.address}</div>
          <div className="text-[14px] font-bold text-[#1557b0] mt-1 uppercase">Trial Balance</div>
          <div className="text-[11px] text-gray-500">
            As on {endDate} · FY: {currentFYName} 
            {compareMode !== "none" && ` vs ${priorFYName}`}
            {compareMode === "prev2" && `, ${prior2FYName}`}
          </div>
        </div>
      </div>

      {/* Trial Balance Main Table */}
      <Card border padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              {/* Row 1: Section Headers */}
              {compareMode !== "none" && (
                <tr className="border-b border-[#c5cad8]">
                  <th colSpan={2} className="px-4 py-2 font-bold text-[#4b5563] text-center border-r">Account Details</th>
                  <th colSpan={format === "balanceOnly" ? 2 : format === "movement" ? 2 : 6} className="px-4 py-2 font-bold text-[#4b5563] text-center border-r bg-blue-50/50">
                    {currentFYName} (Current)
                  </th>
                  <th colSpan={format === "balanceOnly" ? 2 : format === "movement" ? 2 : 6} className="px-4 py-2 font-bold text-[#4b5563] text-center border-r bg-amber-50/30">
                    {priorFYName}
                  </th>
                  {compareMode === "prev2" && (
                    <th colSpan={format === "balanceOnly" ? 2 : format === "movement" ? 2 : 6} className="px-4 py-2 font-bold text-[#4b5563] text-center border-r bg-purple-50/30">
                      {prior2FYName}
                    </th>
                  )}
                  <th colSpan={2} className="px-4 py-2 font-bold text-[#4b5563] text-center bg-green-50/30">Variance (Curr vs Prev)</th>
                </tr>
              )}

              {/* Row 2: Sub-headers */}
              <tr>
                <th className="px-4 py-2 font-bold text-[#4b5563] w-24">Account Code</th>
                <th className="px-4 py-2 font-bold text-[#4b5563] border-r">Account Name</th>
                
                {/* Current FY Columns */}
                {format === "balanceOnly" && (
                  <>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Closing Dr</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Closing Cr</th>
                  </>
                )}
                {format === "movement" && (
                  <>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Dr</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Period Cr</th>
                  </>
                )}
                {format === "sevenColumn" && (
                  <>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Opening Dr</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Opening Cr</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Dr</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Cr</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Closing Dr</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Closing Cr</th>
                  </>
                )}

                {/* Prior FY1 Columns */}
                {compareMode !== "none" && (
                  <>
                    {format === "balanceOnly" && (
                      <>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Closing Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Closing Cr</th>
                      </>
                    )}
                    {format === "movement" && (
                      <>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Period Cr</th>
                      </>
                    )}
                    {format === "sevenColumn" && (
                      <>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Opening Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Opening Cr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Cr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Closing Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Closing Cr</th>
                      </>
                    )}
                  </>
                )}

                {/* Prior FY2 Columns */}
                {compareMode === "prev2" && (
                  <>
                    {format === "balanceOnly" && (
                      <>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Closing Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Closing Cr</th>
                      </>
                    )}
                    {format === "movement" && (
                      <>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Period Cr</th>
                      </>
                    )}
                    {format === "sevenColumn" && (
                      <>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Opening Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Opening Cr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Period Cr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Closing Dr</th>
                        <th className="px-4 py-2 font-bold text-[#4b5563] text-right border-r">Closing Cr</th>
                      </>
                    )}
                  </>
                )}

                {/* Variance columns */}
                {compareMode !== "none" && (
                  <>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">Difference</th>
                    <th className="px-4 py-2 font-bold text-[#4b5563] text-right">% Var</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-250 bg-white">
              {visibleRows.map((row) => (
                <tr
                  key={row.accountId}
                  onClick={() => handleRowClick(row)}
                  className={`cursor-pointer hover:bg-slate-50 transition-colors ${row.isGroup ? "bg-slate-50/30" : ""}`}
                >
                  <td className="px-4 py-2.5 font-mono text-gray-700 text-[12px]">{row.accountCode}</td>
                  <td className="px-4 py-2.5 border-r">
                    <div
                      className={`truncate flex items-center gap-1.5 ${
                        row.level === AccountLevel.GROUP 
                          ? "font-bold text-gray-900" 
                          : row.level === AccountLevel.SUBGROUP 
                            ? "font-semibold text-gray-800" 
                            : "font-normal text-gray-700"
                      }`}
                      style={{ paddingLeft: `${((row.indent || 0) * 16) + 10}px` }}
                    >
                      {row.isGroup && level === "both" && (
                        <button
                          type="button"
                          onClick={(e) => toggleGroupCollapse(row.accountId, e)}
                          className="mr-1 hover:bg-gray-200 rounded p-0.5 text-gray-500 flex items-center justify-center shrink-0"
                          style={{ width: "16px", height: "16px" }}
                        >
                          {collapsedGroups.has(row.accountId) ? "▶" : "▼"}
                        </button>
                      )}
                      {(!row.isGroup || level !== "both") && <span style={{ width: "16px" }} />}
                      <span className="text-[12px]">{showNepaliNames ? row.accountNameNepali : row.accountName}</span>
                    </div>
                  </td>
                  {renderRowCells(row)}
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={colSpanCount} className="text-center py-8 text-gray-400 italic text-[12px]">
                    No rows to display based on selected filters.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 font-bold bg-[#16213e] text-white">
              <tr>
                <td className="px-4 py-3 uppercase text-[12px]">Grand Total</td>
                <td className="px-4 py-3 border-r text-left text-[12px]">Matched Accounts</td>
                {renderRowCells(totals, true)}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      
      {/* Balance check warning card */}
      <Card border padding="md" className={`mt-2 font-bold text-[12px] ${isBalanced ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
        {isBalanced
          ? `✓ Grand Totals are in balance (Closing Dr: ${formatNumber(totals.closingDr)} | Closing Cr: ${formatNumber(totals.closingCr)})`
          : `⚠ Grand Totals are out of balance! Difference of ${formatNumber(Math.abs(totals.closingDr - totals.closingCr))}`}
      </Card>
    </div>
  );
};

function roundSum(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

export default TrialBalance;
