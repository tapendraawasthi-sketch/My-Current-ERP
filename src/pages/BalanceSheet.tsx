// src/pages/BalanceSheet.tsx
// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { computeBalanceSheet, getAccountLedger, exportBSToExcel, exportBSToCSV } from "../lib/balanceSheetEngine";
import type { BSComputation, BSOptions, DrillState, AccountLedgerReport } from "../lib/balanceSheetTypes";
import {
  RefreshCw, AlertTriangle, Download, Printer, Settings,
  ChevronRight, ChevronDown, ArrowLeft, FileSpreadsheet,
  FileText, ChevronDown as DropIcon, BarChart2, Scale,
} from "lucide-react";
import toast from "react-hot-toast";
import ReportDateRangePicker from "../components/ui/ReportDateRangePicker";

// ─── Default Options ──────────────────────────────────────────────────────────

const makeDefaultOptions = (fy: any): BSOptions => ({
  fromDate: fy?.startDate || new Date(new Date().getFullYear(), 3, 1).toISOString().split("T")[0],
  toDate: fy?.endDate || new Date().toISOString().split("T")[0],
  orientation: "horizontal",
  formatId: "standard",
  showSecondLevel: false,
  showZeroBalances: true,
  showPercentage: false,
  showPreviousYear: false,
  stockUpdation: "automatic",
  roundOff: false,
  comparativeYears: 1,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  Math.abs(n) < 0.005
    ? "—"
    : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt2 = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Options Dialog ───────────────────────────────────────────────────────────

function OptionsDialog({
  options,
  onConfirm,
  onCancel,
  companyName,
  fiscalYear,
}: {
  options: BSOptions;
  onConfirm: (o: BSOptions) => void;
  onCancel: () => void;
  companyName: string;
  fiscalYear?: any;
}) {
  const [opts, setOpts] = useState<BSOptions>({ ...options });
  const set = (k: keyof BSOptions, v: any) => setOpts((p) => ({ ...p, [k]: v }));

  const inp = "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const lbl = "block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1";
  const tog = (active: boolean) =>
    `inline-flex h-7 px-3 text-[11px] font-semibold rounded transition-colors ${
      active ? "bg-[#1557b0] text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-[#1e2433] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-white">Balance Sheet — Report Options</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{companyName}</p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Orientation */}
          <div>
            <label className={lbl}>Report Format / Orientation</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { v: "horizontal", l: "Horizontal (T-Format)" },
                { v: "vertical", l: "Vertical (Schedule III)" },
              ].map(({ v, l }) => (
                <button key={v} type="button" onClick={() => set("orientation", v)} className={tog(opts.orientation === v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-4">
            <ReportDateRangePicker
              value={{ fromDate: opts.fromDate, toDate: opts.toDate }}
              onChange={(r) => {
                setOpts((p) => ({ ...p, fromDate: r.fromDate, toDate: r.toDate }));
              }}
              label="Report Period"
            />
          </div>

          {/* FY presets */}
          {fiscalYear && (
            <div className="flex gap-2 text-[11px]">
              <button type="button" onClick={() => setOpts((p) => ({ ...p, fromDate: fiscalYear.startDate || p.fromDate, toDate: fiscalYear.endDate || p.toDate }))} className="text-[#1557b0] hover:underline">
                Full Fiscal Year ({fiscalYear.name})
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => set("toDate", new Date().toISOString().split("T")[0])} className="text-[#1557b0] hover:underline">
                Up to Today
              </button>
            </div>
          )}

          {/* Toggle Options */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "showSecondLevel", label: "Show Second Level Details", desc: "Pre-expand sub-groups inline (Y/N)" },
              { key: "showZeroBalances", label: "Show Zero Balance Groups", desc: "Display groups even with 0 balance" },
              { key: "showPercentage", label: "Show % of Total", desc: "Add percentage column (base = total assets)" },
              { key: "showPreviousYear", label: "Show Previous Year", desc: "Side-by-side comparative column" },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={() => set(key as any, !opts[key as keyof BSOptions])}
              >
                <div className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${opts[key as keyof BSOptions] ? "border-[#1557b0] bg-[#1557b0]" : "border-gray-300"}`}>
                  {opts[key as keyof BSOptions] && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-gray-700">{label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stock updation */}
          <div>
            <label className={lbl}>Closing Stock Updation</label>
            <div className="flex gap-2">
              {[
                { v: "automatic", l: "Auto (from Stock)" },
                { v: "manual", l: "Manual" },
                { v: "gp-ratio", l: "GP Ratio" },
              ].map(({ v, l }) => (
                <button key={v} type="button" onClick={() => set("stockUpdation", v)} className={tog(opts.stockUpdation === v)}>
                  {l}
                </button>
              ))}
            </div>
            {opts.stockUpdation === "manual" && (
              <div className="mt-2">
                <label className={lbl}>Manual Closing Stock Value (Rs.)</label>
                <input
                  type="number"
                  className={inp}
                  value={opts.manualClosingStock || ""}
                  onChange={(e) => set("manualClosingStock", Number(e.target.value) || 0)}
                  placeholder="Enter closing stock amount"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button type="button" onClick={onCancel} className="h-8 px-4 text-[12px] font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(opts)} className="h-8 px-4 text-[12px] font-medium rounded-md bg-[#1557b0] text-white hover:bg-[#0f4a96]">
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BSRow component ──────────────────────────────────────────────────────────

function BSRow({
  row,
  onDrillDown,
  options,
  showSecond,
  depth = 0,
}: {
  row: any;
  onDrillDown: (id: string, name: string, isAccount: boolean) => void;
  options: BSOptions;
  showSecond: boolean;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(showSecond);
  const hasChildren = (row.children?.length || 0) > 0;
  const isZero = Math.abs(row.amount || 0) < 0.005;
  const indent = depth * 16;

  const cls = `flex items-center justify-between px-3 py-1.5 border-b border-gray-100 transition-colors ${
    row.bold ? "bg-[#f9fafb] font-semibold" : "bg-white"
  } ${row.isClickable ? "cursor-pointer hover:bg-[#f0f4ff]" : ""} ${
    row.isPLLine ? "bg-green-50" : ""
  } ${row.isPLAdjusted ? "bg-yellow-50" : ""}`;

  const handleClick = () => {
    if (!row.isClickable) return;
    if (hasChildren) {
      setExpanded((p) => !p);
    } else if (row.accountId) {
      onDrillDown(row.accountId, row.caption, true);
    } else if (row.groupId) {
      onDrillDown(row.groupId, row.caption, false);
    }
  };

  return (
    <>
      <div className={cls} onClick={handleClick} style={{ paddingLeft: `${12 + indent}px` }}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren && (
            <span className="text-gray-400 shrink-0">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
          )}
          <span
            className={`text-[12px] truncate ${row.bold ? "font-semibold text-gray-800" : "text-gray-600"} ${
              isZero ? "text-gray-400" : ""
            } ${row.isPLLine ? "text-green-700 font-semibold" : ""} ${
              row.isClosingStock ? "text-blue-700" : ""
            }`}
          >
            {row.caption}
            {isZero && !row.isClosingStock && (
              <span className="ml-1.5 text-[10px] text-gray-300 font-normal">(0)</span>
            )}
            {row.isPLAdjusted && (
              <span className="ml-1.5 text-[9px] text-amber-600 font-normal">[screen only]</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {options.showPercentage && row.percentage !== undefined && (
            <span className="text-[10px] text-gray-400 w-10 text-right">
              {isZero ? "" : `${row.percentage?.toFixed(1)}%`}
            </span>
          )}
          {options.showPreviousYear && (
            <span className="text-[11px] font-mono text-gray-400 w-24 text-right">
              {row.prevYearAmount !== undefined ? fmt(row.prevYearAmount) : ""}
            </span>
          )}
          <span
            className={`text-[12px] font-mono font-semibold w-28 text-right ${
              isZero ? "text-gray-300" : row.bold ? "text-gray-800" : "text-gray-700"
            } ${row.isPLLine ? "text-green-700" : ""}`}
          >
            {fmt(Math.abs(row.amount || 0))}
          </span>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {(row.children || []).map((child: any, ci: number) => (
            <BSRow key={ci} row={child} onDrillDown={onDrillDown} options={options} showSecond={showSecond} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Horizontal BS ────────────────────────────────────────────────────────────

function HorizontalBS({
  bs,
  options,
  onDrillDown,
  onClosingStockEdit,
}: {
  bs: BSComputation;
  options: BSOptions;
  onDrillDown: (id: string, name: string, isAccount: boolean) => void;
  onClosingStockEdit: () => void;
}) {
  const thCls = "px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-[#f5f6fa] border-b border-gray-200";

  const renderSection = (section: any) => (
    <div key={section.id} className="border-b border-gray-200">
      <div className="px-3 py-1.5 bg-[#eef2ff] border-b border-blue-100">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1557b0]">{section.caption}</span>
      </div>
      {section.rows.map((row: any, ri: number) => (
        <BSRow key={ri} row={row} onDrillDown={onDrillDown} options={options} showSecond={options.showSecondLevel} />
      ))}
      <div className="flex items-center justify-between px-3 py-2 bg-[#f9fafb] border-t border-gray-200">
        <span className="text-[12px] font-bold text-gray-700">Total {section.caption}</span>
        <span className="text-[12px] font-mono font-bold text-gray-800">{fmt(Math.abs(section.total))}</span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left: Liabilities + Equity */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className={`${thCls} text-left flex items-center justify-between`}>
          <span>Liabilities & Capital</span>
          <span>Amount (Rs.)</span>
        </div>
        {bs.liabilitiesEquity.map(renderSection)}
        {bs.plAdjustedAmount !== 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-yellow-50 border-t border-yellow-200">
            <span className="text-[11px] text-amber-700">Profit & Loss Adjusted <span className="text-[9px]">[screen only, not printed]</span></span>
            <span className="text-[11px] font-mono text-amber-700">{fmt(Math.abs(bs.plAdjustedAmount))}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#1557b0] text-white">
          <span className="text-[12px] font-bold">TOTAL</span>
          <span className="text-[13px] font-mono font-bold">{fmt(bs.totalLiabilitiesEquity + Math.abs(bs.plAdjustedAmount))}</span>
        </div>
      </div>

      {/* Right: Assets */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className={`${thCls} text-left flex items-center justify-between`}>
          <span>Assets</span>
          <span>Amount (Rs.)</span>
        </div>
        {bs.assets.map(renderSection)}
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#1557b0] text-white">
          <span className="text-[12px] font-bold">TOTAL</span>
          <span className="text-[13px] font-mono font-bold">{fmt(bs.totalAssets)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Vertical BS ──────────────────────────────────────────────────────────────

function VerticalBS({
  bs,
  options,
  onDrillDown,
}: {
  bs: BSComputation;
  options: BSOptions;
  onDrillDown: (id: string, name: string, isAccount: boolean) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Particulars</span>
        <div className="flex gap-4">
          {options.showPreviousYear && <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 w-28 text-right">Previous Year</span>}
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 w-28 text-right">Amount (Rs.)</span>
        </div>
      </div>

      {/* Equity + Liabilities */}
      <div className="px-3 py-1.5 bg-[#eef2ff] border-b border-blue-100">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1557b0]">I. EQUITY AND LIABILITIES</span>
      </div>
      {bs.liabilitiesEquity.map((sec) => (
        <div key={sec.id}>
          <div className="px-3 py-1 bg-gray-50 border-b border-gray-100">
            <span className="text-[11px] font-semibold text-gray-700 uppercase">{sec.caption}</span>
          </div>
          {sec.rows.map((row: any, ri: number) => (
            <BSRow key={ri} row={row} onDrillDown={onDrillDown} options={options} showSecond={options.showSecondLevel} />
          ))}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#f9fafb] border-t border-gray-200">
            <span className="text-[12px] font-bold text-gray-700">Total {sec.caption}</span>
            <span className="text-[12px] font-mono font-bold">{fmt(sec.total)}</span>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between px-3 py-2 bg-[#eef2ff] border-y border-blue-100">
        <span className="text-[12px] font-bold text-[#1557b0]">Total Liabilities & Equity</span>
        <span className="text-[13px] font-mono font-bold text-[#1557b0]">{fmt(bs.totalLiabilitiesEquity)}</span>
      </div>

      {/* Assets */}
      <div className="px-3 py-1.5 bg-[#eef2ff] border-b border-blue-100 mt-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1557b0]">II. ASSETS</span>
      </div>
      {bs.assets.map((sec) => (
        <div key={sec.id}>
          {sec.rows.map((row: any, ri: number) => (
            <BSRow key={ri} row={row} onDrillDown={onDrillDown} options={options} showSecond={options.showSecondLevel} />
          ))}
        </div>
      ))}

      <div className="flex items-center justify-between px-3 py-2.5 bg-[#1557b0] text-white">
        <span className="text-[12px] font-bold">TOTAL ASSETS</span>
        <span className="text-[13px] font-mono font-bold">{fmt(bs.totalAssets)}</span>
      </div>
    </div>
  );
}

// ─── Drill-down: Group Summary ────────────────────────────────────────────────

function GroupSummaryView({
  groupId,
  groupName,
  bs,
  options,
  onDrillAccount,
}: {
  groupId: string;
  groupName: string;
  bs: BSComputation;
  options: BSOptions;
  onDrillAccount: (id: string, name: string) => void;
}) {
  // Find all accounts under this group
  const allRows: any[] = [];
  const findRows = (sections: any[]) => {
    for (const sec of sections) {
      for (const row of sec.rows) {
        if (row.caption === groupName || row.groupId === groupId || row.id === `grp-${groupName}`) {
          allRows.push(...(row.children || [row]));
        }
        if (row.children) {
          for (const c of row.children) {
            if (c.caption === groupName || c.groupId === groupId) {
              allRows.push(...(c.children || [c]));
            }
          }
        }
      }
    }
  };
  findRows(bs.liabilitiesEquity);
  findRows(bs.assets);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f9fafb]">
        <h3 className="text-[14px] font-semibold text-gray-800">{groupName}</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Group Detail · {options.fromDate} to {options.toDate} · {allRows.length} accounts
        </p>
      </div>
      {allRows.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-gray-500">
          No accounts in this group for the selected period.
          <p className="mt-1 text-[10px] text-gray-400">Groups with zero balance are still shown as per settings.</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Debit</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Credit</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allRows.map((row, i) => {
              const isZero = Math.abs(row.amount || 0) < 0.005;
              return (
                <tr
                  key={i}
                  className={`transition-colors ${row.accountId ? "hover:bg-[#f0f4ff] cursor-pointer" : ""}`}
                  onClick={() => row.accountId && onDrillAccount(row.accountId, row.caption)}
                >
                  <td className="px-3 py-2.5 text-[12px] text-[#1557b0] font-medium">
                    {row.caption}
                    {isZero && <span className="ml-2 text-[10px] text-gray-300">(zero)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-600">—</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-600">—</td>
                  <td className={`px-3 py-2.5 text-right font-mono text-[12px] font-semibold ${isZero ? "text-gray-300" : "text-gray-800"}`}>
                    {isZero ? "—" : fmt(Math.abs(row.amount || 0))}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
              <td className="px-3 py-2 text-[12px] font-bold text-gray-800">Total {groupName}</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right font-mono text-[12px] font-bold text-[#1557b0]">
                {fmt(Math.abs(allRows.reduce((s, r) => s + (r.amount || 0), 0)))}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Account Ledger View ──────────────────────────────────────────────────────

function AccountLedgerView({
  accountId,
  accountName,
  fromDate,
  toDate,
  onDrillVoucher,
}: {
  accountId: string;
  accountName: string;
  fromDate: string;
  toDate: string;
  onDrillVoucher: (id: string, no: string) => void;
}) {
  const [ledger, setLedger] = useState<AccountLedgerReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAccountLedger(accountId, fromDate, toDate).then(data => {
      setLedger(data);
      setLoading(false);
    });
  }, [accountId, fromDate, toDate]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#1557b0] mx-auto" />
      </div>
    );
  }

  if (!ledger) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f9fafb] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-gray-800">{ledger.accountName}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Account Ledger · {fromDate} to {toDate} · {ledger.entries.length} transactions
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-gray-500 uppercase">Closing Balance</p>
          <p className={`font-mono text-[14px] font-bold ${ledger.closingBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
            Rs. {fmt2(Math.abs(ledger.closingBalance))} {ledger.closingBalance >= 0 ? "Cr" : "Dr"}
          </p>
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-[#f5f6fa] border-b border-gray-200">
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-24">Date</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Particulars</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-24">Vch Type</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-24">Vch No</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-28">Debit</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-28">Credit</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-32">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr className="bg-[#f5f6fa]">
            <td className="px-3 py-2 text-[11px] text-gray-500">{fromDate}</td>
            <td className="px-3 py-2 text-[12px] font-semibold text-gray-700" colSpan={3}>Opening Balance</td>
            <td className="px-3 py-2 text-right font-mono text-[12px]">{ledger.openingBalance < 0 ? fmt2(Math.abs(ledger.openingBalance)) : ""}</td>
            <td className="px-3 py-2 text-right font-mono text-[12px]">{ledger.openingBalance >= 0 ? fmt2(ledger.openingBalance) : ""}</td>
            <td className={`px-3 py-2 text-right font-mono text-[12px] font-semibold ${ledger.openingBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
              {fmt2(Math.abs(ledger.openingBalance))} {ledger.openingBalance >= 0 ? "Cr" : "Dr"}
            </td>
          </tr>
          {ledger.entries.map((entry, i) => (
            <tr key={i} className="hover:bg-[#f0f4ff] cursor-pointer" onClick={() => onDrillVoucher(entry.voucherId, entry.voucherNo)}>
              <td className="px-3 py-2 text-[11px] text-gray-600">{entry.date}</td>
              <td className="px-3 py-2 text-[12px] text-gray-800">
                {entry.particulars}
                {entry.narration && <p className="text-[10px] text-gray-500 mt-0.5">{entry.narration}</p>}
              </td>
              <td className="px-3 py-2 text-[11px] text-gray-500">{entry.voucherType}</td>
              <td className="px-3 py-2 text-[11px] font-mono text-[#1557b0]">{entry.voucherNo}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px]">{entry.debit > 0 ? fmt2(entry.debit) : ""}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px]">{entry.credit > 0 ? fmt2(entry.credit) : ""}</td>
              <td className={`px-3 py-2 text-right font-mono text-[12px] font-semibold ${entry.runningBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
                {fmt2(Math.abs(entry.runningBalance))} {entry.runningBalance >= 0 ? "Cr" : "Dr"}
              </td>
            </tr>
          ))}
          <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
            <td className="px-3 py-2 text-[11px] font-bold text-gray-700">{toDate}</td>
            <td className="px-3 py-2 text-[12px] font-bold text-gray-800" colSpan={3}>Closing Balance</td>
            <td className="px-3 py-2 text-right font-mono text-[12px] font-bold">{fmt2(ledger.totalDebit)}</td>
            <td className="px-3 py-2 text-right font-mono text-[12px] font-bold">{fmt2(ledger.totalCredit)}</td>
            <td className={`px-3 py-2 text-right font-mono text-[12px] font-bold ${ledger.closingBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
              {fmt2(Math.abs(ledger.closingBalance))} {ledger.closingBalance >= 0 ? "Cr" : "Dr"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Voucher View ─────────────────────────────────────────────────────────────

function VoucherView({ voucherId }: { voucherId: string }) {
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../lib/db").then(({ getDB }) => {
      getDB().table("vouchers").get(voucherId).then(v => {
        setVoucher(v);
        setLoading(false);
      });
    });
  }, [voucherId]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#1557b0] mx-auto" />
      </div>
    );
  }

  if (!voucher) return <div className="p-8 text-center text-gray-500">Voucher not found</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-3xl mx-auto">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f9fafb] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-gray-800">{voucher.voucherNo || "Voucher"}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {voucher.type?.toUpperCase()} · Date: {voucher.date}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-gray-500 uppercase">Amount</p>
          <p className="font-mono text-[14px] font-bold text-gray-800">
            Rs. {fmt2(voucher.totalDebit || voucher.grandTotal || 0)}
          </p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {voucher.narration && (
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[12px] text-gray-700">
            <span className="font-semibold text-gray-500 text-[10px] uppercase mr-2">Narration:</span>
            {voucher.narration}
          </div>
        )}
        <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-[#f5f6fa]">
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Account</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Debit</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(voucher.lines || []).map((line: any, i: number) => (
              <tr key={i}>
                <td className="px-3 py-2 text-[12px] text-gray-700">
                  {line.accountName || line.accountId}
                  {line.narration && <p className="text-[10px] text-gray-400 mt-0.5">{line.narration}</p>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px]">{(line.debit || 0) > 0 ? fmt2(line.debit) : ""}</td>
                <td className="px-3 py-2 text-right font-mono text-[12px]">{(line.credit || 0) > 0 ? fmt2(line.credit) : ""}</td>
              </tr>
            ))}
            <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
              <td className="px-3 py-2 text-[12px] font-bold text-gray-800">Total</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] font-bold text-[#1557b0]">{fmt2(voucher.totalDebit || 0)}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] font-bold text-[#1557b0]">{fmt2(voucher.totalCredit || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Balance Sheet Component ─────────────────────────────────────────────

export default function BalanceSheet() {
  const { tenant } = useStore();
  const fy = tenant?.fiscalYears?.[0];
  
  const [options, setOptions] = useState<BSOptions>(makeDefaultOptions(fy));
  const [showOptions, setShowOptions] = useState(false);
  const [bsData, setBsData] = useState<BSComputation | null>(null);
  const [loading, setLoading] = useState(false);
  const [drillState, setDrillState] = useState<DrillState>({ level: 0, path: [] });

  const loadBS = useCallback(async (opts: BSOptions = options) => {
    setLoading(true);
    try {
      const result = await computeBalanceSheet(opts);
      setBsData(result);
      setOptions(opts);
      setDrillState({ level: 0, path: [] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Balance Sheet");
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    loadBS();
  }, []);

  const handleDrillDown = (id: string, name: string, isAccount: boolean) => {
    if (isAccount) {
      setDrillState({
        level: 3,
        accountId: id,
        accountName: name,
        fromDate: options.fromDate,
        toDate: options.toDate,
        path: [...drillState.path, { id, label: name, level: 3 }]
      });
    } else {
      setDrillState({
        level: 1,
        groupId: id,
        groupName: name,
        fromDate: options.fromDate,
        toDate: options.toDate,
        path: [...drillState.path, { id, label: name, level: 1 }]
      });
    }
  };

  const handleDrillVoucher = (id: string, no: string) => {
    setDrillState(prev => ({
      ...prev,
      level: 4,
      voucherId: id,
      voucherNo: no,
      path: [...prev.path, { id, label: no || "Voucher", level: 4 }]
    }));
  };

  const navigateBack = (toLevel: number = -1) => {
    setDrillState(prev => {
      const targetLevel = toLevel >= 0 ? toLevel : prev.path.length > 1 ? prev.path[prev.path.length - 2].level : 0;
      const targetPath = toLevel >= 0 ? prev.path.filter(p => p.level <= toLevel) : prev.path.slice(0, -1);
      
      const last = targetPath[targetPath.length - 1];
      
      return {
        level: targetLevel as any,
        path: targetPath,
        groupId: targetLevel === 1 ? last?.id : undefined,
        groupName: targetLevel === 1 ? last?.label : undefined,
        accountId: targetLevel === 3 ? last?.id : undefined,
        accountName: targetLevel === 3 ? last?.label : undefined,
        voucherId: targetLevel === 4 ? last?.id : undefined,
        voucherNo: targetLevel === 4 ? last?.label : undefined,
        fromDate: prev.fromDate,
        toDate: prev.toDate,
      };
    });
  };

  const handleExport = (type: "excel" | "csv") => {
    if (!bsData) return;
    if (type === "excel") exportBSToExcel(bsData, tenant?.name || "Company", options.orientation);
    else exportBSToCSV(bsData);
  };

  return (
    <div className="flex flex-col h-full bg-[#e4f1d9] relative">
      {/* Options Dialog */}
      {showOptions && (
        <OptionsDialog
          options={options}
          companyName={tenant?.name || ""}
          fiscalYear={fy}
          onConfirm={(opts) => { setShowOptions(false); loadBS(opts); }}
          onCancel={() => setShowOptions(false)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#d4eabd] border-b border-gray-400 shrink-0 shadow-sm z-10 no-print">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Balance Sheet</h1>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {tenant?.name} &nbsp;·&nbsp; As at: {options.toDate}
            </p>
          </div>
          {drillState.level > 0 && (
            <button
              onClick={() => navigateBack()}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-4 bg-white border border-gray-300 rounded-md text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => loadBS()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors" title="Refresh (F5)">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          
          <div className="flex bg-white rounded-md border border-gray-300 overflow-hidden">
            <button onClick={() => handleExport("excel")} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-200 transition-colors">
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
              Excel
            </button>
            <button onClick={() => handleExport("csv")} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              CSV
            </button>
          </div>
          
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          
          <button onClick={() => setShowOptions(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1557b0] text-white rounded-md text-[12px] font-medium hover:bg-[#0f4a96] transition-colors ml-2 shadow-sm">
            <Settings className="h-3.5 w-3.5" />
            Options
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 print-container relative">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-[#1557b0]" />
          </div>
        ) : !bsData ? (
          <div className="text-center py-20 text-gray-500 text-[12px]">No data generated. Click Options to begin.</div>
        ) : (
          <div className="max-w-[1200px] mx-auto pb-10">
            {/* Imbalance Warning */}
            {!bsData.isBalanced && drillState.level === 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 no-print">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[13px] font-bold text-red-800">Balance Sheet is not balanced!</h4>
                  <p className="text-[12px] text-red-700 mt-1">
                    Difference in Opening Balances / Vouchers: <span className="font-mono font-bold">Rs. {fmt2(Math.abs(bsData.difference))}</span>
                  </p>
                  <p className="text-[11px] text-red-600 mt-1">
                    This usually happens if opening balances do not match (Total Dr ≠ Total Cr) or if there are unposted entries.
                    <br/>The report below forces a balance by inserting a "Profit & Loss Adjusted" line.
                  </p>
                </div>
              </div>
            )}

            {/* Print Header */}
            <div className="print-only hidden mb-6 text-center">
              <h2 className="text-[18px] font-bold uppercase">{tenant?.name}</h2>
              <h3 className="text-[14px] font-semibold mt-1">Balance Sheet</h3>
              <p className="text-[12px] mt-1">As at {options.toDate}</p>
            </div>

            {/* Navigation Breadcrumbs */}
            {drillState.level > 0 && (
              <div className="flex items-center gap-2 text-[12px] text-gray-500 mb-4 px-1 no-print">
                <button onClick={() => navigateBack(0)} className="text-[#1557b0] hover:underline font-medium">Balance Sheet</button>
                {drillState.path.map((p, i) => (
                  <React.Fragment key={i}>
                    <ChevronRight className="h-3 w-3" />
                    <button 
                      onClick={() => navigateBack(p.level)} 
                      className={i === drillState.path.length - 1 ? "text-gray-800 font-bold" : "text-[#1557b0] hover:underline"}
                    >
                      {p.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Drill State Views */}
            <div className="animate-fadeIn">
              {drillState.level === 0 && (
                options.orientation === "horizontal" ? (
                  <HorizontalBS bs={bsData} options={options} onDrillDown={handleDrillDown} onClosingStockEdit={() => {}} />
                ) : (
                  <VerticalBS bs={bsData} options={options} onDrillDown={handleDrillDown} />
                )
              )}
              
              {drillState.level === 1 && drillState.groupId && (
                <GroupSummaryView 
                  groupId={drillState.groupId} 
                  groupName={drillState.groupName || ""} 
                  bs={bsData} 
                  options={options}
                  onDrillAccount={(id, name) => handleDrillDown(id, name, true)} 
                />
              )}
              
              {drillState.level === 3 && drillState.accountId && drillState.fromDate && drillState.toDate && (
                <AccountLedgerView 
                  accountId={drillState.accountId}
                  accountName={drillState.accountName || ""}
                  fromDate={drillState.fromDate}
                  toDate={drillState.toDate}
                  onDrillVoucher={handleDrillVoucher}
                />
              )}

              {drillState.level === 4 && drillState.voucherId && (
                <VoucherView voucherId={drillState.voucherId} />
              )}
            </div>

            {/* Closing Stock Info (only on main report) */}
            {drillState.level === 0 && (
              <div className="mt-6 text-[10px] text-gray-400 text-center no-print flex items-center justify-center gap-2">
                <Scale className="h-3.5 w-3.5" />
                Closing Stock Source: <span className="font-semibold uppercase">{bsData.closingStockSource}</span> 
                (Rs. {fmt2(bsData.closingStock)})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
