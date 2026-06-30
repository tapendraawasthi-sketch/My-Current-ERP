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

export default function PLHorizontal({ pl, options, onDrillDown, onClosingStockUpdate }: Props) {
  const [editingClosingStock, setEditingClosingStock] = useState(false);
  const [closingStockInput, setClosingStockInput] = useState(pl.closingStock);

  const colCount = options.showPercentage ? 3 : 2;
  const totalColSpan = colCount;

  const SectionDivider = ({ label }: { label: string }) => (
    <tr>
      <td
        colSpan={totalColSpan}
        className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1557b0] bg-blue-50 border-y border-blue-100"
      >
        {label}
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

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800">Trading and Profit & Loss Account</h2>
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
          {pl.netProfitLabel}: Rs. {fmt(Math.abs(pl.netProfit))}
        </div>
      </div>

      {/* T-Format Table */}
      <div className="grid grid-cols-2 gap-4">
        {/* ── DEBIT (LEFT) ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thCls} text-left`}>DEBIT / EXPENDITURE</th>
                <th className={`${thCls} text-right`}>Amount (Rs.)</th>
                {options.showPercentage && <th className={`${thCls} text-right`}>%</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {/* === TRADING ACCOUNT — DEBIT === */}
              <SectionDivider label="Trading Account" />

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
              {pl.grossProfit < 0 && (
                <tr className="bg-red-50">
                  <td className={`${tdCls} text-red-700 font-bold`}>Gross Loss c/d</td>
                  <td className="text-right font-mono text-[12px] font-bold text-red-700 px-3">{fmt(Math.abs(pl.grossProfit))}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}

              <SubtotalRow label="Total (Trading)" amount={pl.tradingDebitTotal} />

              {/* === P&L ACCOUNT — DEBIT === */}
              <SectionDivider label="Profit & Loss Account" />

              {/* Gross Loss b/d */}
              {pl.grossProfit < 0 && (
                <tr>
                  <td className={`${tdCls} text-red-600 font-semibold`}>Gross Loss b/d</td>
                  <td className="text-right font-mono text-[12px] font-semibold text-red-600 px-3">{fmt(Math.abs(pl.grossProfit))}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}

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
              {pl.netProfit >= 0 && (
                <SubtotalRow label={`${pl.netProfitLabel} (transferred to Balance Sheet)`} amount={pl.netProfit} highlight />
              )}

              <GrandTotal amount={pl.grandDebitTotal} side="Dr" />
            </tbody>
          </table>
        </div>

        {/* ── CREDIT (RIGHT) ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thCls} text-left`}>CREDIT / INCOME</th>
                <th className={`${thCls} text-right`}>Amount (Rs.)</th>
                {options.showPercentage && <th className={`${thCls} text-right`}>%</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {/* === TRADING ACCOUNT — CREDIT === */}
              <SectionDivider label="Trading Account" />

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

              {/* Gross Loss c/d if applicable */}
              {pl.grossProfit >= 0 && (
                <tr className="bg-green-50">
                  <td className={`${tdCls} text-green-700 font-bold`}>Gross Profit c/d</td>
                  <td className="text-right font-mono text-[12px] font-bold text-green-700 px-3">{fmt(pl.grossProfit)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}

              <SubtotalRow label="Total (Trading)" amount={pl.tradingCreditTotal} />

              {/* === P&L ACCOUNT — CREDIT === */}
              <SectionDivider label="Profit & Loss Account" />

              {/* Gross Profit b/d */}
              {pl.grossProfit >= 0 && (
                <tr>
                  <td className={`${tdCls} text-green-700 font-semibold`}>Gross Profit b/d</td>
                  <td className="text-right font-mono text-[12px] font-semibold text-green-700 px-3">{fmt(pl.grossProfit)}</td>
                  {options.showPercentage && <td />}
                </tr>
              )}

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
              {pl.netProfit < 0 && (
                <SubtotalRow label={`${pl.netProfitLabel} (transferred to Balance Sheet)`} amount={Math.abs(pl.netProfit)} highlight />
              )}

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
