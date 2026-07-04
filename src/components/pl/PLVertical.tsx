// src/components/pl/PLVertical.tsx
import React from "react";
import type {
  PLComputation,
  PLReportOptions,
  PLAccountLine,
  PLDrillState,
} from "../../lib/plTypes";

const fmt = (n: number) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  pl: PLComputation;
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
  mode?: "pl" | "ie";
}

function VRow({
  label,
  amount,
  indent = 0,
  bold = false,
  highlight = false,
  isTotal = false,
  sign = 1,
  clickable = false,
  onClick,
  pct,
}: {
  label: string;
  amount: number;
  indent?: number;
  bold?: boolean;
  highlight?: boolean;
  isTotal?: boolean;
  sign?: number; // 1 = positive shown, -1 = shown as negative/deduction
  clickable?: boolean;
  onClick?: () => void;
  pct?: number;
}) {
  const dispAmount = sign < 0 ? -Math.abs(amount) : Math.abs(amount);
  const isNeg = sign < 0;
  const isZero = Math.abs(amount) < 0.005;

  return (
    <tr
      className={`
        ${isTotal ? "border-t-2 border-gray-300" : "border-b border-gray-100"}
        ${highlight ? "bg-[#eef2ff]" : ""}
        ${clickable && !isZero ? "cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]" : ""}
      `}
      onClick={clickable && !isZero ? onClick : undefined}
    >
      <td
        className={`px-3 py-2 text-[12px] ${bold ? "font-bold text-gray-800" : "text-gray-600"}`}
        style={{ paddingLeft: `${12 + indent * 20}px` }}
      >
        {label}
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12px]">
        {isZero ? (
          <span className="text-gray-300">—</span>
        ) : (
          <span
            className={
              isNeg ? "text-red-600" : bold || isTotal ? "text-gray-800 font-bold" : "text-gray-700"
            }
          >
            {isNeg ? "-" : ""}
            {fmt(Math.abs(amount))}
          </span>
        )}
      </td>
      {pct !== undefined && (
        <td className="px-3 py-2 text-right text-[11px] text-gray-400">
          {Math.abs(amount) > 0 ? `${pct.toFixed(1)}%` : ""}
        </td>
      )}
    </tr>
  );
}

function AccountGroup({
  lines,
  options,
  onDrillDown,
  sign,
  groupId,
  groupLabel,
}: {
  lines: PLAccountLine[];
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
  sign: 1 | -1;
  groupId: string;
  groupLabel: string;
}) {
  if (!options.showSecondLevel || lines.length === 0) return null;

  return (
    <>
      {lines.map((line) => {
        const amt = sign > 0 ? line.credit - line.debit : line.debit - line.credit;
        return (
          <VRow
            key={line.accountId}
            label={line.accountName}
            amount={amt}
            indent={2}
            sign={1}
            clickable
            onClick={() =>
              onDrillDown({
                level: 2,
                selectedAccountId: line.accountId,
                selectedAccountName: line.accountName,
                selectedGroupId: groupId,
                selectedGroupLabel: groupLabel,
              })
            }
            pct={options.showPercentage ? line.percentage : undefined}
          />
        );
      })}
    </>
  );
}

export default function PLVertical({ pl, options, onDrillDown, mode = "pl" }: Props) {
  const colCount = options.showPercentage ? 3 : 2;

  const totalRevenue = pl.sales.total + pl.directIncome.total;
  const cogs = pl.openingStock + pl.purchases.total + pl.directExpenses.total - pl.closingStock;

  const title =
    mode === "ie"
      ? "Income & Expenditure Account (Vertical)"
      : "Vertical Profit & Loss (Waterfall)";
  const grossLabel =
    mode === "ie" ? "Excess of Income over Expenditure (Gross)" : pl.grossProfitLabel;
  const netLabel =
    mode === "ie"
      ? pl.netProfit >= 0
        ? "Surplus for the Period"
        : "Deficit for the Period"
      : pl.netProfitLabel;

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden max-w-4xl mx-auto">
      <div className="px-3 py-2 border-b border-gray-200 bg-[#f5f6fa] flex items-center justify-between">
        <div>
          <h3 className="text-[12px] font-semibold text-gray-800">{title}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            For the period: {pl.fromDate} to {pl.toDate}
          </p>
        </div>
      </div>

      <table className="erp-bs-table w-full">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200">
              Particulars
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200">
              Amount (Rs.)
            </th>
            {options.showPercentage && (
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200">
                %
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {/* Revenue */}
          <VRow
            label="Revenue from Operations (Sales)"
            amount={pl.sales.total}
            bold
            clickable
            onClick={() =>
              onDrillDown({
                level: 1,
                selectedGroupId: "sales",
                selectedGroupLabel: "Sales Accounts",
              })
            }
            pct={options.showPercentage ? 100 : undefined}
          />
          <AccountGroup
            lines={pl.sales.lines}
            options={options}
            onDrillDown={onDrillDown}
            sign={1}
            groupId="sales"
            groupLabel="Sales Accounts"
          />

          <VRow
            label="Add: Direct Income"
            amount={pl.directIncome.total}
            indent={1}
            clickable
            onClick={() =>
              onDrillDown({
                level: 1,
                selectedGroupId: "direct-income",
                selectedGroupLabel: "Direct Income",
              })
            }
            pct={
              options.showPercentage ? (pl.directIncome.total / pl.revenueBase) * 100 : undefined
            }
          />
          <AccountGroup
            lines={pl.directIncome.lines}
            options={options}
            onDrillDown={onDrillDown}
            sign={1}
            groupId="direct-income"
            groupLabel="Direct Income"
          />

          <VRow label="Total Revenue" amount={totalRevenue} bold isTotal />

          {/* COGS */}
          <tr>
            <td
              colSpan={colCount}
              className="px-3 py-2 text-[12px] font-bold text-gray-800 bg-gray-50 border-y border-gray-100"
            >
              Less: Cost of Goods Sold (COGS)
            </td>
          </tr>
          <VRow
            label="Opening Stock"
            amount={pl.openingStock}
            indent={1}
            sign={-1}
            clickable
            onClick={() =>
              onDrillDown({
                level: 1,
                selectedGroupId: "opening-stock",
                selectedGroupLabel: "Opening Stock",
              })
            }
          />

          <VRow
            label="Add: Purchases"
            amount={pl.purchases.total}
            indent={1}
            sign={-1}
            clickable
            onClick={() =>
              onDrillDown({
                level: 1,
                selectedGroupId: "purchases",
                selectedGroupLabel: "Purchases",
              })
            }
            pct={options.showPercentage ? (pl.purchases.total / pl.revenueBase) * 100 : undefined}
          />
          <AccountGroup
            lines={pl.purchases.lines}
            options={options}
            onDrillDown={onDrillDown}
            sign={-1}
            groupId="purchases"
            groupLabel="Purchases"
          />

          <VRow
            label="Add: Direct Expenses"
            amount={pl.directExpenses.total}
            indent={1}
            sign={-1}
            clickable
            onClick={() =>
              onDrillDown({
                level: 1,
                selectedGroupId: "direct-expenses",
                selectedGroupLabel: "Direct Expenses",
              })
            }
            pct={
              options.showPercentage ? (pl.directExpenses.total / pl.revenueBase) * 100 : undefined
            }
          />
          <AccountGroup
            lines={pl.directExpenses.lines}
            options={options}
            onDrillDown={onDrillDown}
            sign={-1}
            groupId="direct-expenses"
            groupLabel="Direct Expenses"
          />

          <VRow label="Less: Closing Stock" amount={pl.closingStock} indent={1} sign={1} />

          <VRow label="Total Cost of Goods Sold" amount={cogs} bold indent={1} sign={-1} />

          {/* Gross Profit */}
          <VRow
            label={grossLabel}
            amount={pl.grossProfit}
            bold
            highlight
            isTotal
            pct={
              options.showPercentage ? (Math.abs(pl.grossProfit) / pl.revenueBase) * 100 : undefined
            }
          />

          {/* Indirect items */}
          <VRow
            label="Add: Indirect Income"
            amount={pl.indirectIncome.total}
            indent={1}
            clickable
            onClick={() =>
              onDrillDown({
                level: 1,
                selectedGroupId: "indirect-income",
                selectedGroupLabel: "Indirect Income",
              })
            }
            pct={
              options.showPercentage ? (pl.indirectIncome.total / pl.revenueBase) * 100 : undefined
            }
          />
          <AccountGroup
            lines={pl.indirectIncome.lines}
            options={options}
            onDrillDown={onDrillDown}
            sign={1}
            groupId="indirect-income"
            groupLabel="Indirect Income"
          />

          <VRow
            label="Less: Indirect Expenses"
            amount={pl.indirectExpenses.total}
            indent={1}
            sign={-1}
            clickable
            onClick={() =>
              onDrillDown({
                level: 1,
                selectedGroupId: "indirect-expenses",
                selectedGroupLabel: "Indirect Expenses",
              })
            }
            pct={
              options.showPercentage
                ? (pl.indirectExpenses.total / pl.revenueBase) * 100
                : undefined
            }
          />
          <AccountGroup
            lines={pl.indirectExpenses.lines}
            options={options}
            onDrillDown={onDrillDown}
            sign={-1}
            groupId="indirect-expenses"
            groupLabel="Indirect Expenses"
          />

          {/* Net Profit */}
          <VRow
            label={netLabel}
            amount={pl.netProfit}
            bold
            highlight
            isTotal
            pct={
              options.showPercentage ? (Math.abs(pl.netProfit) / pl.revenueBase) * 100 : undefined
            }
          />
        </tbody>
      </table>
    </div>
  );
}
