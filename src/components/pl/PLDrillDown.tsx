// src/components/pl/PLDrillDown.tsx
// @ts-nocheck
import React, { useEffect, useState } from "react";
import type {
  PLComputation,
  PLReportOptions,
  PLDrillState,
  AccountLedgerData,
} from "../../lib/plTypes";
import { getAccountLedger } from "../../lib/profitLossEngine";
import { getDB } from "../../lib/db";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { useStore } from "../../store/useStore";

const fmt = (n: number) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  drillState: PLDrillState;
  options: PLReportOptions;
  plData: PLComputation | null;
  onDrillDown: (state: PLDrillState) => void;
  onBack: () => void;
  companyName: string;
}

// ─── Level 1: Group Account List ──────────────────────────────────────────────
function GroupAccountList({
  plData,
  drillState,
  options,
  onDrillDown,
}: {
  plData: PLComputation;
  drillState: PLDrillState;
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
}) {
  const groupId = drillState.selectedGroupId;
  let lines = [];

  switch (groupId) {
    case "sales":
      lines = plData.sales.lines;
      break;
    case "purchases":
      lines = plData.purchases.lines;
      break;
    case "direct-expenses":
      lines = plData.directExpenses.lines;
      break;
    case "direct-income":
      lines = plData.directIncome.lines;
      break;
    case "indirect-expenses":
      lines = plData.indirectExpenses.lines;
      break;
    case "indirect-income":
      lines = plData.indirectIncome.lines;
      break;
    default:
      // Try to find in all sections
      const all = [
        ...plData.sales.lines,
        ...plData.purchases.lines,
        ...plData.directExpenses.lines,
        ...plData.directIncome.lines,
        ...plData.indirectExpenses.lines,
        ...plData.indirectIncome.lines,
      ];
      lines = all.filter((l) => l.accountId === groupId || l.groupId === groupId);
  }

  const thCls =
    "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f9fafb]">
        <h3 className="text-[14px] font-semibold text-gray-800">{drillState.selectedGroupLabel}</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {options.fromDate} to {options.toDate} &nbsp;·&nbsp; {lines.length} accounts
        </p>
      </div>

      {lines.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-gray-500">
          No transactions in this group for the selected period.
          <p className="mt-2 text-[11px] text-gray-400">
            Accounts with zero balance are still shown if they exist in the chart of accounts.
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={`${thCls} text-left`}>Account Name</th>
              <th className={`${thCls} text-right`}>Debit (Rs.)</th>
              <th className={`${thCls} text-right`}>Credit (Rs.)</th>
              <th className={`${thCls} text-right`}>Net Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line) => {
              const net = line.credit - line.debit;
              return (
                <tr
                  key={line.accountId}
                  className="hover:bg-[#f5f8ff] cursor-pointer transition-colors"
                  onClick={() =>
                    onDrillDown({
                      level: 2,
                      selectedGroupId: drillState.selectedGroupId,
                      selectedGroupLabel: drillState.selectedGroupLabel,
                      selectedAccountId: line.accountId,
                      selectedAccountName: line.accountName,
                      fromDate: options.fromDate,
                      toDate: options.toDate,
                    })
                  }
                >
                  <td className="px-3 py-2.5 text-[12px] font-medium text-[var(--ds-action-primary)] hover:underline">
                    {line.accountName}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                    {line.debit > 0 ? fmt(line.debit) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                    {line.credit > 0 ? fmt(line.credit) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono text-[12px] font-semibold ${net >= 0 ? "text-green-700" : "text-red-600"}`}
                  >
                    {fmt(Math.abs(net))} {net >= 0 ? "Cr" : "Dr"}
                  </td>
                </tr>
              );
            })}
            {/* Zero-balance accounts note */}
            <tr className="bg-gray-50">
              <td colSpan={4} className="px-3 py-1.5 text-[10px] text-gray-400 italic">
                Accounts with zero balance in this period are displayed. Groups with no activity
                show — in amounts.
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Level 2: Account Ledger ──────────────────────────────────────────────────
function AccountLedgerView({
  drillState,
  options,
  onDrillDown,
}: {
  drillState: PLDrillState;
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
}) {
  const [ledger, setLedger] = useState<AccountLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const { setCurrentPage } = useStore();

  useEffect(() => {
    if (!drillState.selectedAccountId) return;
    setLoading(true);
    getAccountLedger(
      drillState.selectedAccountId,
      drillState.fromDate || options.fromDate,
      drillState.toDate || options.toDate,
    )
      .then(setLedger)
      .finally(() => setLoading(false));
  }, [
    drillState.selectedAccountId,
    drillState.fromDate,
    drillState.toDate,
    options.fromDate,
    options.toDate,
  ]);

  const thCls =
    "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--ds-action-primary)]" />
        <span className="ml-2 text-[12px] text-gray-600">Loading ledger…</span>
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
            Account Ledger &nbsp;·&nbsp; {options.fromDate} to {options.toDate}
            &nbsp;·&nbsp; {ledger.entries.length} transactions
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase font-semibold">Closing Balance</p>
          <p
            className={`font-mono text-[13px] font-bold ${ledger.closingBalance >= 0 ? "text-green-700" : "text-red-600"}`}
          >
            Rs. {fmt(Math.abs(ledger.closingBalance))} {ledger.closingBalance >= 0 ? "Cr" : "Dr"}
          </p>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th className={thCls} style={{ width: "100px" }}>
              Date
            </th>
            <th className={thCls}>Particulars</th>
            <th className={`${thCls}`} style={{ width: "100px" }}>
              Vch Type
            </th>
            <th className={`${thCls}`} style={{ width: "110px" }}>
              Vch No.
            </th>
            <th className={`${thCls} text-right`} style={{ width: "110px" }}>
              Debit
            </th>
            <th className={`${thCls} text-right`} style={{ width: "110px" }}>
              Credit
            </th>
            <th className={`${thCls} text-right`} style={{ width: "130px" }}>
              Balance
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {/* Opening Balance */}
          <tr className="bg-[#f5f6fa]">
            <td className="px-3 py-2 text-[11px] text-gray-500">{options.fromDate}</td>
            <td className="px-3 py-2 text-[12px] font-semibold text-gray-700" colSpan={3}>
              Opening Balance
            </td>
            <td className="px-3 py-2 text-right font-mono text-[12px]">
              {ledger.openingBalance < 0 ? fmt(Math.abs(ledger.openingBalance)) : ""}
            </td>
            <td className="px-3 py-2 text-right font-mono text-[12px]">
              {ledger.openingBalance >= 0 ? fmt(ledger.openingBalance) : ""}
            </td>
            <td
              className={`px-3 py-2 text-right font-mono text-[12px] font-semibold ${ledger.openingBalance >= 0 ? "text-green-700" : "text-red-600"}`}
            >
              {fmt(Math.abs(ledger.openingBalance))} {ledger.openingBalance >= 0 ? "Cr" : "Dr"}
            </td>
          </tr>

          {ledger.entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                No transactions in this period.
              </td>
            </tr>
          ) : (
            ledger.entries.map((entry) => (
              <tr
                key={entry.id}
                className="hover:bg-[#f5f8ff] cursor-pointer transition-colors"
                onClick={() =>
                  onDrillDown({
                    ...drillState,
                    level: 3,
                    selectedVoucherId: entry.voucherId,
                  })
                }
              >
                <td className="px-3 py-2 text-[11px] text-gray-600">{entry.date}</td>
                <td className="px-3 py-2 text-[12px] text-gray-700">
                  <div>{entry.particulars}</div>
                  {entry.narration && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{entry.narration}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-[11px] text-gray-500">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium uppercase">
                    {entry.voucherType}
                  </span>
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (entry.voucherId) {
                        sessionStorage.setItem("sutra:open-voucher-id", entry.voucherId);
                        sessionStorage.setItem(
                          "sutra:open-voucher-type",
                          entry.voucherType || "journal",
                        );
                      }
                      const pageMap: Record<string, string> = {
                        receipt: "receipt",
                        payment: "payment",
                        journal: "journal",
                        contra: "contra",
                        "sales-invoice": "billing",
                        "purchase-invoice": "purchase",
                        "debit-note": "debit-note",
                        "credit-note": "credit-note",
                      };
                      const targetPage =
                        pageMap[entry.voucherType?.toLowerCase() || ""] || "journal";
                      setCurrentPage(targetPage);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ds-action-primary)",
                      fontSize: 12,
                      fontFamily: "'Courier New', monospace",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "2px 4px",
                      borderRadius: 3,
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                      textDecorationStyle: "dotted",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "none";
                    }}
                    title={`Open ${entry.voucherType} voucher`}
                  >
                    {entry.voucherNo}
                  </button>
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-700">
                  {entry.debit > 0 ? fmt(entry.debit) : ""}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-700">
                  {entry.credit > 0 ? fmt(entry.credit) : ""}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono text-[12px] font-semibold ${entry.runningBalance >= 0 ? "text-green-700" : "text-red-600"}`}
                >
                  {fmt(Math.abs(entry.runningBalance))} {entry.runningBalance >= 0 ? "Cr" : "Dr"}
                </td>
              </tr>
            ))
          )}

          {/* Closing Balance */}
          <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
            <td className="px-3 py-2 text-[11px] text-gray-600">{options.toDate}</td>
            <td className="px-3 py-2 text-[12px] font-bold text-gray-800" colSpan={3}>
              Closing Balance
            </td>
            <td className="px-3 py-2 text-right font-mono text-[12px] font-bold">
              {fmt(ledger.totalDebit)}
            </td>
            <td className="px-3 py-2 text-right font-mono text-[12px] font-bold">
              {fmt(ledger.totalCredit)}
            </td>
            <td
              className={`px-3 py-2 text-right font-mono text-[12px] font-bold ${ledger.closingBalance >= 0 ? "text-green-700" : "text-red-600"}`}
            >
              {fmt(Math.abs(ledger.closingBalance))} {ledger.closingBalance >= 0 ? "Cr" : "Dr"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Level 3: Voucher View ────────────────────────────────────────────────────
function VoucherView({
  voucherId,
  onDrillDown,
  drillState,
}: {
  voucherId: string;
  onDrillDown: (state: PLDrillState) => void;
  drillState: PLDrillState;
}) {
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDB();
    db.table("vouchers")
      .get(voucherId)
      .then(setVoucher)
      .catch(() => setVoucher(null))
      .finally(() => setLoading(false));
  }, [voucherId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--ds-action-primary)]" />
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="p-8 text-center text-[12px] text-gray-500">
        Voucher not found or has been deleted.
      </div>
    );
  }

  const fmt2 = (n: number) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f9fafb] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-gray-800">
            {voucher.voucherNo || "Voucher"}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {voucher.type?.toUpperCase()} &nbsp;·&nbsp; Date: {voucher.date} &nbsp;·&nbsp; Status:{" "}
            <span
              className={`font-semibold ${voucher.status === "posted" ? "text-green-600" : "text-red-600"}`}
            >
              {voucher.status?.toUpperCase()}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase font-semibold">Amount</p>
          <p className="font-mono text-[14px] font-bold text-gray-800">
            Rs. {fmt2(voucher.totalDebit || voucher.grandTotal || 0)}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Narration */}
        {voucher.narration && (
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[12px] text-gray-700">
            <span className="font-semibold text-gray-500 text-[10px] uppercase">Narration:</span>
            &nbsp;
            {voucher.narration}
          </div>
        )}

        {/* Lines */}
        <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-[#f5f6fa]">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">
                Account
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">
                Debit
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">
                Credit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(voucher.lines || []).map((line: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-[12px] text-gray-700">
                  {line.accountName || line.accountId}
                  {line.narration && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{line.narration}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px]">
                  {(line.debit || 0) > 0 ? fmt2(line.debit) : ""}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px]">
                  {(line.credit || 0) > 0 ? fmt2(line.credit) : ""}
                </td>
              </tr>
            ))}
            <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
              <td className="px-3 py-2 text-[12px] font-bold text-gray-800">Total</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] font-bold">
                {fmt2(voucher.totalDebit || 0)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-[12px] font-bold">
                {fmt2(voucher.totalCredit || 0)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Balance indicator */}
        <div
          className={`px-3 py-2 rounded-md border text-[12px] font-semibold ${
            Math.abs((voucher.totalDebit || 0) - (voucher.totalCredit || 0)) < 0.01
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {Math.abs((voucher.totalDebit || 0) - (voucher.totalCredit || 0)) < 0.01
            ? "✓ Voucher is balanced (Dr = Cr)"
            : `⚠ Unbalanced by Rs. ${fmt2(Math.abs((voucher.totalDebit || 0) - (voucher.totalCredit || 0)))}`}
        </div>
      </div>
    </div>
  );
}

// ─── Main DrillDown Component ─────────────────────────────────────────────────
export default function PLDrillDown({
  drillState,
  options,
  plData,
  onDrillDown,
  onBack,
  companyName,
}: Props) {
  const levelLabels = ["P&L Report", "Account Group", "Ledger", "Voucher"];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-gray-500">
        <button
          onClick={() => onDrillDown({ level: 0 })}
          className="text-[var(--ds-action-primary)] hover:underline"
        >
          P&L Report
        </button>
        {drillState.selectedGroupLabel && (
          <>
            <span className="text-gray-300">›</span>
            <button
              onClick={() =>
                drillState.level > 1 &&
                onDrillDown({
                  ...drillState,
                  level: 1,
                  selectedAccountId: undefined,
                  selectedVoucherId: undefined,
                })
              }
              className={
                drillState.level > 1
                  ? "text-[var(--ds-action-primary)] hover:underline"
                  : "text-gray-700 font-semibold"
              }
            >
              {drillState.selectedGroupLabel}
            </button>
          </>
        )}
        {drillState.selectedAccountName && drillState.level >= 2 && (
          <>
            <span className="text-gray-300">›</span>
            <button
              onClick={() =>
                drillState.level > 2 &&
                onDrillDown({ ...drillState, level: 2, selectedVoucherId: undefined })
              }
              className={
                drillState.level > 2
                  ? "text-[var(--ds-action-primary)] hover:underline"
                  : "text-gray-700 font-semibold"
              }
            >
              {drillState.selectedAccountName}
            </button>
          </>
        )}
        {drillState.selectedVoucherId && drillState.level >= 3 && (
          <>
            <span className="text-gray-300">›</span>
            <span className="text-gray-700 font-semibold">Voucher</span>
          </>
        )}
      </div>

      {/* Content by level */}
      {drillState.level === 1 && plData && (
        <GroupAccountList
          plData={plData}
          drillState={drillState}
          options={options}
          onDrillDown={onDrillDown}
        />
      )}

      {drillState.level === 2 && drillState.selectedAccountId && (
        <AccountLedgerView drillState={drillState} options={options} onDrillDown={onDrillDown} />
      )}

      {drillState.level === 3 && drillState.selectedVoucherId && (
        <VoucherView
          voucherId={drillState.selectedVoucherId}
          onDrillDown={onDrillDown}
          drillState={drillState}
        />
      )}
    </div>
  );
}
