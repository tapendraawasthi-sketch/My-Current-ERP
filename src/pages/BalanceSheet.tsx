// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Download, FileSpreadsheet, Printer, RefreshCw, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BalanceSheetLine {
  accountId: string;
  accountName: string;
  accountCode: string;
  amount: number;
  level: number;
  isGroup: boolean;
  children?: BalanceSheetLine[];
}

interface BalanceSheetSection {
  title: string;
  lines: BalanceSheetLine[];
  total: number;
}

// ─── ReportShell ──────────────────────────────────────────────────────────────

interface ReportShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const ReportShell: React.FC<ReportShellProps> = ({ title, subtitle, children }) => {
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `(${formatted})` : formatted;
}

function buildTree(
  accounts: any[],
  parentId: string | undefined,
  type: string,
  vouchers: any[],
  invoices: any[],
): BalanceSheetLine[] {
  return accounts
    .filter(
      (a) =>
        a.type === type &&
        (parentId === undefined ? !a.parentId : a.parentId === parentId) &&
        a.isActive !== false,
    )
    .map((account) => {
      const children = buildTree(accounts, account.id, type, vouchers, invoices);

      // Compute balance from voucher lines
      let balance = account.balance ?? 0;

      const childTotal = children.reduce((sum, c) => sum + c.amount, 0);
      const total = account.isGroup ? childTotal : balance;

      return {
        accountId: account.id,
        accountName: account.name,
        accountCode: account.code ?? "",
        amount: total,
        level: 0,
        isGroup: !!account.isGroup,
        children: children.length > 0 ? children : undefined,
      };
    })
    .filter((line) => line.amount !== 0 || line.isGroup);
}

function flattenLines(
  lines: BalanceSheetLine[],
  depth = 0,
): (BalanceSheetLine & { depth: number })[] {
  const result: (BalanceSheetLine & { depth: number })[] = [];
  for (const line of lines) {
    result.push({ ...line, depth });
    if (line.children && line.children.length > 0) {
      result.push(...flattenLines(line.children, depth + 1));
    }
  }
  return result;
}

function sumLines(lines: BalanceSheetLine[]): number {
  return lines.reduce((sum, line) => {
    if (line.isGroup && line.children) {
      return sum + sumLines(line.children);
    }
    return sum + line.amount;
  }, 0);
}

// ─── Row Component ─────────────────────────────────────────────────────────────

const BalanceSheetRow: React.FC<{
  line: BalanceSheetLine & { depth: number };
  isCredit?: boolean;
}> = ({ line, isCredit }) => {
  const indent = line.depth * 16;

  return (
    <tr
      className={`border-b border-gray-100 ${line.isGroup ? "bg-[#f5f6fa]" : "hover:bg-gray-50"}`}
    >
      <td className="px-3 py-2 text-[11px] font-mono text-gray-500 w-20">
        {line.accountCode || "—"}
      </td>
      <td className="px-3 py-2">
        <span
          style={{ paddingLeft: `${indent}px` }}
          className={`text-[12px] ${
            line.isGroup ? "font-semibold text-gray-700" : "font-normal text-gray-700"
          }`}
        >
          {line.accountName}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-700">
        {line.isGroup ? "" : formatAmount(line.amount)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-700">
        {line.isGroup && line.amount !== 0 ? formatAmount(line.amount) : ""}
      </td>
    </tr>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const BalanceSheet: React.FC = () => {
  const { accounts, vouchers, invoices, currentFiscalYear, companySettings } = useStore();

  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [expandAll, setExpandAll] = useState(true);

  // ── Compute Balance Sheet sections ──────────────────────────────────────────
  const { assets, liabilities, equity, isBalanced, difference } = useMemo(() => {
    const assetLines = buildTree(accounts, undefined, "asset", vouchers, invoices);
    const liabilityLines = buildTree(accounts, undefined, "liability", vouchers, invoices);
    const equityLines = buildTree(accounts, undefined, "equity", vouchers, invoices);

    const totalAssets = sumLines(assetLines);
    const totalLiabilities = sumLines(liabilityLines);
    const totalEquity = sumLines(equityLines);

    const liabEquity = totalLiabilities + totalEquity;
    const diff = Math.abs(totalAssets - liabEquity);
    const balanced = diff < 0.01;

    return {
      assets: { lines: assetLines, total: totalAssets },
      liabilities: { lines: liabilityLines, total: totalLiabilities },
      equity: { lines: equityLines, total: totalEquity },
      isBalanced: balanced,
      difference: diff,
    };
  }, [accounts, vouchers, invoices]);

  const flatAssets = useMemo(() => flattenLines(assets.lines), [assets.lines]);
  const flatLiabilities = useMemo(() => flattenLines(liabilities.lines), [liabilities.lines]);
  const flatEquity = useMemo(() => flattenLines(equity.lines), [equity.lines]);

  // ── Export to Excel ─────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const companyName = companySettings?.name || companySettings?.companyName || "Company";
      const fyName = currentFiscalYear?.name || "";

      const rows: any[][] = [
        [companyName],
        ["Balance Sheet"],
        [fyName ? `Fiscal Year: ${fyName}` : `As of: ${asOfDate}`],
        [],
        ["Code", "Account", "Amount", "Sub-Total"],
        [],
        ["ASSETS"],
      ];

      for (const line of flatAssets) {
        const indent = "  ".repeat(line.depth);
        rows.push([
          line.accountCode || "",
          indent + line.accountName,
          line.isGroup ? "" : line.amount,
          line.isGroup && line.amount !== 0 ? line.amount : "",
        ]);
      }

      rows.push(["", "TOTAL ASSETS", "", assets.total]);
      rows.push([]);
      rows.push(["LIABILITIES"]);

      for (const line of flatLiabilities) {
        const indent = "  ".repeat(line.depth);
        rows.push([
          line.accountCode || "",
          indent + line.accountName,
          line.isGroup ? "" : line.amount,
          line.isGroup && line.amount !== 0 ? line.amount : "",
        ]);
      }

      rows.push(["", "TOTAL LIABILITIES", "", liabilities.total]);
      rows.push([]);
      rows.push(["EQUITY"]);

      for (const line of flatEquity) {
        const indent = "  ".repeat(line.depth);
        rows.push([
          line.accountCode || "",
          indent + line.accountName,
          line.isGroup ? "" : line.amount,
          line.isGroup && line.amount !== 0 ? line.amount : "",
        ]);
      }

      rows.push(["", "TOTAL EQUITY", "", equity.total]);
      rows.push([]);
      rows.push(["", "TOTAL LIABILITIES & EQUITY", "", liabilities.total + equity.total]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
      XLSX.writeFile(wb, `BalanceSheet_${asOfDate.replace(/-/g, "")}.xlsx`);
      toast.success("Balance Sheet exported to Excel.");
    } catch (err) {
      toast.error("Export failed.");
    }
  };

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ReportShell title="Balance Sheet" subtitle="Assets, liabilities and equity position">
      {/* Action toolbar — moved INSIDE children, not passed as prop */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">As of Date:</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            {expandAll ? "Collapse" : "Expand"} All
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Balance indicator */}
      <div
        className={`mb-4 px-4 py-2.5 rounded-lg border flex items-center justify-between text-[12px] font-semibold ${
          isBalanced
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span>
            {isBalanced
              ? "Balance Sheet is balanced — Assets = Liabilities + Equity"
              : `Balance Sheet is OUT OF BALANCE — Difference: ${formatAmount(difference)}`}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>
            Assets: <strong className="font-mono">{formatAmount(assets.total)}</strong>
          </span>
          <span>
            Liab + Equity:{" "}
            <strong className="font-mono">{formatAmount(liabilities.total + equity.total)}</strong>
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ── Assets Column ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-[#1557b0] px-4 py-2.5">
            <h2 className="text-[13px] font-bold text-white uppercase tracking-wide">Assets</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                    Code
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Account
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Amount
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Sub-Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {flatAssets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-gray-400">
                      No asset accounts found.
                    </td>
                  </tr>
                ) : (
                  flatAssets.map((line, idx) => (
                    <BalanceSheetRow key={`asset-${line.accountId}-${idx}`} line={line} />
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">Total Assets</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                    {formatAmount(assets.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Liabilities & Equity Column ── */}
        <div className="flex flex-col gap-4">
          {/* Liabilities */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-[#dc2626] px-4 py-2.5">
              <h2 className="text-[13px] font-bold text-white uppercase tracking-wide">
                Liabilities
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                      Code
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Account
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Sub-Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flatLiabilities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-gray-400">
                        No liability accounts found.
                      </td>
                    </tr>
                  ) : (
                    flatLiabilities.map((line, idx) => (
                      <BalanceSheetRow key={`liab-${line.accountId}-${idx}`} line={line} isCredit />
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#fef2f2] border-t-2 border-[#fecaca]">
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Total Liabilities
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                      {formatAmount(liabilities.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-[#059669] px-4 py-2.5">
              <h2 className="text-[13px] font-bold text-white uppercase tracking-wide">Equity</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                      Code
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Account
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Sub-Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flatEquity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-gray-400">
                        No equity accounts found.
                      </td>
                    </tr>
                  ) : (
                    flatEquity.map((line, idx) => (
                      <BalanceSheetRow
                        key={`equity-${line.accountId}-${idx}`}
                        line={line}
                        isCredit
                      />
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f0fdf4] border-t-2 border-[#bbf7d0]">
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Total Equity
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                      {formatAmount(equity.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Grand Total — Liabilities + Equity */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full">
              <tbody>
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                  <td className="px-3 py-3 text-[13px] font-bold text-gray-800">
                    Total Liabilities &amp; Equity
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] font-bold text-gray-800">
                    {formatAmount(liabilities.total + equity.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
    </ReportShell>
  );
};

export default BalanceSheet;
