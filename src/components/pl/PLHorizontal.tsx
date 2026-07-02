// src/components/pl/PLHorizontal.tsx
// @ts-nocheck
import React, { useState } from "react";
import type { PLComputation, PLReportOptions, PLAccountLine, PLDrillState } from "../../lib/plTypes";
import { ChevronRight, ChevronDown, Edit3 } from "lucide-react";

const fmt = (n: number) =>
  n === 0 ? "—" :
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const amtCls = "text-right font-mono text-[12px] font-semibold text-gray-800 whitespace-nowrap";
const amtCls0 = "text-right font-mono text-[12px] text-gray-400 whitespace-nowrap";
const thCls = "px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-b border-gray-200 bg-[#f5f6fa]";
const tdCls = "px-3 py-1.5 text-[12px]";

interface Props {
  mode?: "pl" | "ie"; // "ie" = Income & Expenditure mode
  pl: PLComputation;
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
  onClosingStockUpdate?: (value: number) => void;
}

function AccountLines({
  lines,
  options,
  onDrillDown,
  side,
  indent = 0,
}: {
  lines: PLAccountLine[];
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
  side: "debit" | "credit";
  indent?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!lines.length) {
    return (
      <tr>
        <td className={`${tdCls} text-gray-400 italic`} colSpan={options.showPercentage ? 3 : 2}>
          — No accounts —
        </td>
      </tr>
    );
  }

  return (
    <>
      {lines.map((line) => {
        const isExp = expanded[line.accountId];
        const hasChildren = (line.children?.length || 0) > 0;
        const amt = side === "debit" ? (line.debit - line.credit) : (line.credit - line.debit);
        const absAmt = Math.abs(amt);
        const isZero = absAmt < 0.005;

        return (
          <React.Fragment key={line.accountId}>
            <tr
              className={`hover:bg-[#f5f8ff] transition-colors ${line.isGroup ? "bg-[#fafafa]" : ""} ${!isZero ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (isZero && !line.isGroup) return;
                if (hasChildren) {
                  setExpanded((p) => ({ ...p, [line.accountId]: !p[line.accountId] }));
                } else {
                  onDrillDown({
                    level: 1,
                    selectedGroupId: line.accountId,
                    selectedGroupLabel: line.accountName,
                    fromDate: undefined,
                    toDate: undefined,
                  });
                }
              }}
            >
              <td className={tdCls} style={{ paddingLeft: `${12 + indent * 16}px` }}>
                <div className="flex items-center gap-1.5">
                  {hasChildren && (
                    <span className="text-gray-400">
                      {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </span>
                  )}
                  <span className={`${line.isGroup ? "font-semibold text-gray-700" : "text-gray-600"} text-[12px]`}>
                    {line.accountName}
                  </span>
                </div>
              </td>
              <td className={isZero ? amtCls0 : amtCls}>
                {isZero ? "—" : fmt(absAmt)}
              </td>
              {options.showPercentage && (
                <td className="text-right text-[11px] text-gray-400 px-2">
                  {line.percentage ? `${line.percentage.toFixed(1)}%` : ""}
                </td>
              )}
            </tr>
            {isExp && line.children && (
              <AccountLines
                lines={line.children}
                options={options}
                onDrillDown={onDrillDown}
                side={side}
                indent={indent + 1}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

export default function PLHorizontal({ mode = "pl", pl, options, onDrillDown, onClosingStockUpdate }: Props) {
  const [editingClosingStock, setEditingClosingStock] = useState(false);
  const [closingStockInput, setClosingStockInput] = useState(pl.closingStock);

  const isIE = mode === "ie";
  const colCount = options.showPercentage ? 3 : 2;
  const totalColSpan = colCount;

  const SectionDivider = ({ label }: { label: string }) => (
    <tr>
      <td colSpan={totalColSpan} style={{ padding: "0", lineHeight: 0 }}>
        <div style={{
          position: "relative",
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "8px 0",
        }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: "2px solid #d1d5db" }} />
          <div style={{
            position: "relative",
            background: "#ffffff",
            padding: "2px 16px",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#6b7280",
            border: "1px solid #d1d5db",
            borderRadius: 3,
          }}>
            {label}
          </div>
        </div>
      </td>
    </tr>
  );

  const SubtotalRow = ({ label, amount, highlight = false }: { label: string; amount: number; highlight?: boolean }) => (
    <tr className={highlight ? "bg-[#eef2ff] font-bold" : "bg-[#f5f6fa] font-semibold"}>
      <td className={`${tdCls} ${highlight ? "text-[#1557b0]" : "text-gray-700"} text-[12px] font-bold`}>{label}</td>
      <td className={`${amtCls} ${highlight ? "text-[#1557b0]" : ""} border-t border-gray-200`}>
        {fmt(Math.abs(amount))}
      </td>
      {options.showPercentage && <td />}
    </tr>
  );

  const GrandTotal = ({ amount, side }: { amount: number; side: string }) => (
    <tr className="bg-[#1557b0] text-white">
      <td className="px-3 py-2 text-[12px] font-bold">Total ({side})</td>
      <td className="text-right font-mono text-[13px] font-bold px-3 py-2">{fmt(amount)}</td>
      {options.showPercentage && <td />}
    </tr>
  );

  const renderGrossProfitRow = (grossProfit: number, isCD: boolean) => {
    const isGrossProfit = grossProfit >= 0;
    const absGrossProfit = Math.abs(grossProfit);
    const profitText = isIE ? "Excess of Income over Expenditure" : "Gross Profit";
    const lossText = isIE ? "Excess of Expenditure over Income" : "Gross Loss";
    
    return (
      <tr style={{
        background: isGrossProfit ? "#f0fdf4" : "#fef2f2",
        borderTop: "1px solid #d1d5db",
        boxShadow: `inset 0 -4px 0 0 ${isGrossProfit ? "#bbf7d0" : "#fecaca"}, inset 0 -7px 0 0 ${isGrossProfit ? "#f0fdf4" : "#fef2f2"}, inset 0 -8px 0 0 ${isGrossProfit ? "#bbf7d0" : "#fecaca"}`,
        paddingBottom: 8,
      }}>
        <td style={{ padding: "10px 16px", fontWeight: 700, fontSize: 12, color: "#111827" }}>
          {isGrossProfit ? profitText : lossText} {isCD ? "c/d" : "b/d"}
        </td>
        <td className="num-cell-bold" style={{ color: isGrossProfit ? "#059669" : "#dc2626", padding: "10px 16px" }}>
          {absGrossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </td>
        {options.showPercentage && <td />}
      </tr>
    );
  };

  const renderNetProfitRow = (netProfit: number) => {
    const isNetProfit = netProfit >= 0;
    const absNetProfit = Math.abs(netProfit);
    
    return (
      <tr style={{
        background: isNetProfit ? "#f0fdf4" : "#fef2f2",
        borderTop: "2px solid #d1d5db",
        boxShadow: `inset 0 -4px 0 0 ${isNetProfit ? "#86efac" : "#fca5a5"}, inset 0 -7px 0 0 ${isNetProfit ? "#f0fdf4" : "#fef2f2"}, inset 0 -8px 0 0 ${isNetProfit ? "#86efac" : "#fca5a5"}`,
      }}>
        <td style={{ padding: "12px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
            {isIE 
              ? (isNetProfit ? "Surplus for the Period" : "Deficit for the Period")
              : `Net ${isNetProfit ? "Profit" : "(Loss)"}`}
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic", marginTop: 2 }}>
            {isIE
              ? (isNetProfit ? "Transferred to Corpus / General Fund" : "Charged to Corpus / General Fund")
              : "Transferred to Balance Sheet"}
          </div>
        </td>
        <td className="num-cell-bold" style={{ color: isNetProfit ? "#059669" : "#dc2626", fontSize: 14, padding: "12px 16px" }}>
          {absNetProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </td>
        {options.showPercentage && <td />}
      </tr>
    );
  };

  const reportTitle = isIE ? "Income & Expenditure Account" : "Trading and Profit & Loss Account";
  const netResultLabel = isIE 
    ? (pl.netProfit >= 0 ? "Surplus" : "Deficit")
    : pl.netProfitLabel;
  const leftHeader = isIE ? "EXPENDITURE" : "DEBIT / EXPENDITURE";
  const rightHeader = isIE ? "INCOME" : "CREDIT / INCOME";
  const sec1Label = isIE ? "Operating Account" : "Trading Account";
  const sec2Label = isIE ? "Income & Expenditure Account" : "Profit & Loss Account";

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800">{reportTitle}</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            For the period: <strong>{pl.fromDate}</strong> to <strong>{pl.toDate}</strong>
            {options.showSecondLevel && " · Detailed View"}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-lg border text-[13px] font-bold ${
          pl.netProfit >= 0
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {netResultLabel}: Rs. {fmt(Math.abs(pl.netProfit))}
        </div>
      </div>

      {/* T-Format Table */}
      <div className="grid grid-cols-2 gap-4">
        {/* ── DEBIT (LEFT) ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thCls} text-left`}>{leftHeader}</th>
                <th className={`${thCls} text-right`}>Amount (Rs.)</th>
                {options.showPercentage && <th className={`${thCls} text-right`}>%</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {/* === TRADING ACCOUNT — DEBIT === */}
              <SectionDivider label={sec1Label} />

              {/* Opening Stock */}
              <tr className="hover:bg-[#f5f8ff] cursor-pointer" onClick={() => onDrillDown({ level: 1, selectedGroupId: "opening-stock", selectedGroupLabel: "Opening Stock" })}>
                <td className={tdCls}><span className="text-gray-600">Opening Stock</span></td>
                <td className={pl.openingStock === 0 ? amtCls0 : amtCls}>{fmt(pl.openingStock)}</td>
                {options.showPercentage && <td />}
              </tr>

              {/* Purchases */}
              {options.showSecondLevel ? (
                <AccountLines lines={pl.purchases.lines} options={options} onDrillDown={onDrillDown} side="debit" />
              ) : (
                <tr
                  className="hover:bg-[#f5f8ff] cursor-pointer"
                  onClick={() => onDrillDown({ level: 1, selectedGroupId: "purchases", selectedGroupLabel: "Purchase Accounts" })}
                >
                  <td className={tdCls}><span className="text-gray-600">Purchases</span></td>
                  <td className={pl.purchases.total === 0 ? amtCls0 : amtCls}>{fmt(pl.purchases.total)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}
              {options.showSecondLevel && pl.purchases.lines.length > 0 && (
                <SubtotalRow label="Total Purchases" amount={pl.purchases.total} />
              )}

              {/* Direct Expenses */}
              {options.showSecondLevel ? (
                <AccountLines lines={pl.directExpenses.lines} options={options} onDrillDown={onDrillDown} side="debit" />
              ) : (
                <tr
                  className="hover:bg-[#f5f8ff] cursor-pointer"
                  onClick={() => onDrillDown({ level: 1, selectedGroupId: "direct-expenses", selectedGroupLabel: "Direct Expenses" })}
                >
                  <td className={tdCls}><span className="text-gray-600">Direct Expenses</span></td>
                  <td className={pl.directExpenses.total === 0 ? amtCls0 : amtCls}>{fmt(pl.directExpenses.total)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}
              {options.showSecondLevel && pl.directExpenses.lines.length > 0 && (
                <SubtotalRow label="Total Direct Expenses" amount={pl.directExpenses.total} />
              )}

              {/* Gross Loss if applicable */}
              {pl.grossProfit < 0 && renderGrossProfitRow(pl.grossProfit, true)}

              <SubtotalRow label={`Total (${sec1Label.split(" ")[0]})`} amount={pl.tradingDebitTotal} />

              {/* === P&L ACCOUNT — DEBIT === */}
              <SectionDivider label={sec2Label} />

              {/* Gross Loss b/d */}
              {pl.grossProfit < 0 && renderGrossProfitRow(pl.grossProfit, false)}

              {/* Indirect Expenses */}
              {options.showSecondLevel ? (
                <AccountLines lines={pl.indirectExpenses.lines} options={options} onDrillDown={onDrillDown} side="debit" />
              ) : (
                <tr
                  className="hover:bg-[#f5f8ff] cursor-pointer"
                  onClick={() => onDrillDown({ level: 1, selectedGroupId: "indirect-expenses", selectedGroupLabel: "Indirect Expenses" })}
                >
                  <td className={tdCls}><span className="text-gray-600">Indirect Expenses</span></td>
                  <td className={pl.indirectExpenses.total === 0 ? amtCls0 : amtCls}>{fmt(pl.indirectExpenses.total)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}
              {options.showSecondLevel && pl.indirectExpenses.lines.length > 0 && (
                <SubtotalRow label="Total Indirect Expenses" amount={pl.indirectExpenses.total} />
              )}

              {/* Net Profit */}
              {pl.netProfit >= 0 && renderNetProfitRow(pl.netProfit)}

              <GrandTotal amount={pl.grandDebitTotal} side="Dr" />
            </tbody>
          </table>
        </div>

        {/* ── CREDIT (RIGHT) ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thCls} text-left`}>{rightHeader}</th>
                <th className={`${thCls} text-right`}>Amount (Rs.)</th>
                {options.showPercentage && <th className={`${thCls} text-right`}>%</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {/* === TRADING ACCOUNT — CREDIT === */}
              <SectionDivider label={sec1Label} />

              {/* Sales */}
              {options.showSecondLevel ? (
                <AccountLines lines={pl.sales.lines} options={options} onDrillDown={onDrillDown} side="credit" />
              ) : (
                <tr
                  className="hover:bg-[#f5f8ff] cursor-pointer"
                  onClick={() => onDrillDown({ level: 1, selectedGroupId: "sales", selectedGroupLabel: "Sales Accounts" })}
                >
                  <td className={tdCls}><span className="text-gray-600">Sales (Revenue from Operations)</span></td>
                  <td className={pl.sales.total === 0 ? amtCls0 : amtCls}>{fmt(pl.sales.total)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}
              {options.showSecondLevel && pl.sales.lines.length > 0 && (
                <SubtotalRow label="Total Sales" amount={pl.sales.total} />
              )}

              {/* Direct Income */}
              {options.showSecondLevel ? (
                <AccountLines lines={pl.directIncome.lines} options={options} onDrillDown={onDrillDown} side="credit" />
              ) : (
                <tr
                  className="hover:bg-[#f5f8ff] cursor-pointer"
                  onClick={() => onDrillDown({ level: 1, selectedGroupId: "direct-income", selectedGroupLabel: "Direct Income" })}
                >
                  <td className={tdCls}><span className="text-gray-600">Direct Income</span></td>
                  <td className={pl.directIncome.total === 0 ? amtCls0 : amtCls}>{fmt(pl.directIncome.total)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}
              {options.showSecondLevel && pl.directIncome.lines.length > 0 && (
                <SubtotalRow label="Total Direct Income" amount={pl.directIncome.total} />
              )}

              {/* Closing Stock */}
              <tr
                className="hover:bg-[#f5f8ff] cursor-pointer"
                onClick={() => {
                  if (onClosingStockUpdate) setEditingClosingStock(true);
                }}
              >
                <td className={tdCls}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">Closing Stock</span>
                    {onClosingStockUpdate && (
                      <Edit3 className="h-3 w-3 text-gray-400" title="Click to update closing stock" />
                    )}
                  </div>
                </td>
                <td className={pl.closingStock === 0 ? amtCls0 : amtCls}>{fmt(pl.closingStock)}</td>
                {options.showPercentage && <td />}
              </tr>

              {/* Gross Profit c/d if applicable */}
              {pl.grossProfit >= 0 && renderGrossProfitRow(pl.grossProfit, true)}

              <SubtotalRow label={`Total (${sec1Label.split(" ")[0]})`} amount={pl.tradingCreditTotal} />

              {/* === P&L ACCOUNT — CREDIT === */}
              <SectionDivider label={sec2Label} />

              {/* Gross Profit b/d */}
              {pl.grossProfit >= 0 && renderGrossProfitRow(pl.grossProfit, false)}

              {/* Indirect Income */}
              {options.showSecondLevel ? (
                <AccountLines lines={pl.indirectIncome.lines} options={options} onDrillDown={onDrillDown} side="credit" />
              ) : (
                <tr
                  className="hover:bg-[#f5f8ff] cursor-pointer"
                  onClick={() => onDrillDown({ level: 1, selectedGroupId: "indirect-income", selectedGroupLabel: "Indirect Income" })}
                >
                  <td className={tdCls}><span className="text-gray-600">Indirect Income (Other Income)</span></td>
                  <td className={pl.indirectIncome.total === 0 ? amtCls0 : amtCls}>{fmt(pl.indirectIncome.total)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}
              {options.showSecondLevel && pl.indirectIncome.lines.length > 0 && (
                <SubtotalRow label="Total Indirect Income" amount={pl.indirectIncome.total} />
              )}

              {/* Net Loss */}
              {pl.netProfit < 0 && renderNetProfitRow(pl.netProfit)}

              <GrandTotal amount={pl.grandCreditTotal} side="Cr" />
            </tbody>
          </table>
        </div>
      </div>

      {/* Closing Stock Edit Modal */}
      {editingClosingStock && onClosingStockUpdate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-[14px] font-bold text-gray-800 mb-3">Update Closing Stock</h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Enter the manual closing stock value. This overrides auto-calculated stock.
            </p>
            <input
              type="number"
              className="w-full h-10 px-3 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              value={closingStockInput}
              onChange={(e) => setClosingStockInput(Number(e.target.value) || 0)}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="h-8 px-3 text-[12px] border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setEditingClosingStock(false)}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 text-[12px] bg-[#1557b0] text-white rounded-md hover:bg-[#0f4a96]"
                onClick={() => {
                  onClosingStockUpdate(closingStockInput);
                  setEditingClosingStock(false);
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
