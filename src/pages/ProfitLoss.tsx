// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { PillTitle } from "../components/BusyShell";
import { AccountType, VoucherStatus } from "../lib/types";
import { Printer, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

/* ────────────────────────────────────────────────────────────────────── */
/*  Busy 21 colour tokens                                                 */
/* ────────────────────────────────────────────────────────────────────── */
const BG_PAGE  = "#d8dce8";
const TEXT     = "#00008b";
const FONT     = "'Courier New', monospace";
const DASH_ROW = "—————————————————";

/* ── tiny helper: right-aligned amount cell ─────────────────────────── */
const AmtCell: React.FC<{ value: number; bold?: boolean }> = ({ value, bold }) => (
  <td
    style={{
      textAlign: "right",
      padding: "2px 10px",
      fontFamily: FONT,
      fontSize: 12,
      whiteSpace: "nowrap",
      fontWeight: bold ? "bold" : undefined,
      color: TEXT,
      minWidth: 110,
    }}
  >
    {Math.abs(value) < 0.005 ? "0.00" : formatNumber(Math.abs(value))}
  </td>
);

/* ── separator row (dashes) ─────────────────────────────────────────── */
const DashRow: React.FC = () => (
  <tr>
    <td style={{ padding: "0 10px", color: TEXT, fontFamily: FONT, fontSize: 12, textAlign: "right" }}>
      {DASH_ROW}
    </td>
    <td style={{ padding: "0 10px", color: TEXT, fontFamily: FONT, fontSize: 12, textAlign: "right" }}>
      {DASH_ROW}
    </td>
  </tr>
);

/* ── single debit/credit column table ──────────────────────────────── */
const SideTable: React.FC<{
  rows: { label: string; amount: number; bold?: boolean; isTotal?: boolean }[];
}> = ({ rows }) => (
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <tbody>
      {rows.map((r, i) =>
        r.label === "__DASH__" ? (
          <tr key={i}>
            <td colSpan={2} style={{ padding: "0 10px", color: TEXT, fontFamily: FONT, fontSize: 12, textAlign: "right" }}>
              {DASH_ROW}
            </td>
          </tr>
        ) : (
          <tr key={i} style={{ background: r.isTotal ? "#ddeeff" : undefined }}>
            <td
              style={{
                padding: "2px 10px",
                color: TEXT,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: r.bold ? "bold" : undefined,
              }}
            >
              {r.label}
            </td>
            <AmtCell value={r.amount} bold={r.bold} />
          </tr>
        )
      )}
    </tbody>
  </table>
);

/* ══════════════════════════════════════════════════════════════════════ */

const ProfitLoss: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();

  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";
  const fiscalEnd   = currentFiscalYear?.endDate   || "2027-07-15";

  /* ── compute account net movements (same logic as before) ─────────── */
  const plData = useMemo(() => {
    try {
      const postedVouchers = vouchers.filter(
        (v) =>
          v.status === VoucherStatus.POSTED &&
          v.date >= fiscalStart &&
          v.date <= fiscalEnd
      );

      const accountBalances = new Map<string, number>();
      for (const v of postedVouchers) {
        for (const line of v.lines) {
          const cur = accountBalances.get(line.accountId) || 0;
          accountBalances.set(
            line.accountId,
            cur + (line.debit || 0) - (line.credit || 0)
          );
        }
      }

      const incomeAccounts  = accounts.filter((a) => !a.isGroup && a.type === AccountType.INCOME);
      const expenseAccounts = accounts.filter((a) => !a.isGroup && a.type === AccountType.EXPENSE);

      const incomeItems = incomeAccounts
        .map((acc) => ({ id: acc.id, name: acc.name, code: acc.code, group: acc.group || "", amount: -(accountBalances.get(acc.id) || 0) }))
        .filter((i) => Math.abs(i.amount) > 0.01);

      const expenseItems = expenseAccounts
        .map((acc) => ({ id: acc.id, name: acc.name, code: acc.code, group: acc.group || "", amount: accountBalances.get(acc.id) || 0 }))
        .filter((i) => Math.abs(i.amount) > 0.01);

      /* ── categorise into Busy 21 sections ──────────────────────────── */
      const isDirectIncome = (i: any) =>
        i.group.toLowerCase().includes("sales") || i.name.toLowerCase().includes("sales");
      const isDirectExpense = (i: any) =>
        i.group.toLowerCase().includes("purchase") ||
        i.name.toLowerCase().includes("purchase") ||
        i.group.toLowerCase().includes("direct") ||
        i.group.toLowerCase().includes("cost of goods");

      const salesItems         = incomeItems.filter(isDirectIncome);
      const otherIncomeItems   = incomeItems.filter((i) => !isDirectIncome(i));
      const purchaseItems      = expenseItems.filter(isDirectExpense);
      const indirectExpItems   = expenseItems.filter((i) => !isDirectExpense(i));

      const totalSales        = salesItems.reduce((s, i) => s + i.amount, 0);
      const totalOtherIncome  = otherIncomeItems.reduce((s, i) => s + i.amount, 0);
      const totalPurchases    = purchaseItems.reduce((s, i) => s + i.amount, 0);
      const totalIndirectExp  = indirectExpItems.reduce((s, i) => s + i.amount, 0);

      const grossProfit = totalSales - totalPurchases;
      const netProfit   = grossProfit + totalOtherIncome - totalIndirectExp;

      return {
        salesItems, otherIncomeItems, purchaseItems, indirectExpItems,
        totalSales:       Math.round(totalSales       * 100) / 100,
        totalOtherIncome: Math.round(totalOtherIncome * 100) / 100,
        totalPurchases:   Math.round(totalPurchases   * 100) / 100,
        totalIndirectExp: Math.round(totalIndirectExp * 100) / 100,
        grossProfit:      Math.round(grossProfit      * 100) / 100,
        netProfit:        Math.round(netProfit        * 100) / 100,
        error: null,
      };
    } catch (error) {
      return {
        salesItems: [], otherIncomeItems: [], purchaseItems: [], indirectExpItems: [],
        totalSales: 0, totalOtherIncome: 0, totalPurchases: 0, totalIndirectExp: 0,
        grossProfit: 0, netProfit: 0, error: String(error),
      };
    }
  }, [accounts, vouchers, fiscalStart, fiscalEnd]);

  const handlePrint = () => window.print();
  const handleExport = () => {
    try {
      const rows: any[] = [
        ["PROFIT & LOSS A/C", "", `Period ending ${fiscalEnd}`], [],
        ["DEBIT (Rs.)", "", "CREDIT (Rs.)", ""],
        ["Opening Stock", "0.00", "Closing Stock", "0.00"],
        ["Purchase", formatNumber(plData.totalPurchases), "Sale", formatNumber(plData.totalSales)],
        ["Expenses (Direct/Mfg.)", "0.00", "Income (Direct/Opr.)", formatNumber(plData.totalOtherIncome)],
        ["Gross Profit", formatNumber(plData.grossProfit), "", ""],
        [], ["Expenses (Indirect/Admn.)", formatNumber(plData.totalIndirectExp), "Income (Indirect)", "0.00"],
        ["Nett Profit", formatNumber(plData.netProfit), "", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
      XLSX.writeFile(wb, `ProfitLoss_${fiscalEnd}.xlsx`);
      toast.success("Exported to Excel");
    } catch { toast.error("Export failed"); }
  };

  /* ── Build rows for each T-side ──────────────────────────────────── */
  // DEBIT side — Section 1 (Trading)
  const debitSection1 = [
    { label: "Opening Stock",          amount: 0 },
    ...plData.purchaseItems.map((i) => ({ label: i.name, amount: i.amount })),
    { label: "Expenses (Direct/Mfg.)", amount: 0 },
    { label: "Gross Profit",           amount: Math.max(0, plData.grossProfit), bold: true },
    { label: "__DASH__",               amount: 0 },
    { label: "Total",                  amount: plData.totalPurchases + Math.max(0, plData.grossProfit), bold: true, isTotal: true },
    { label: "__DASH__",               amount: 0 },
  ];

  // CREDIT side — Section 1 (Trading)
  const creditSection1 = [
    { label: "Closing Stock",         amount: 0 },
    ...plData.salesItems.map((i) => ({ label: "Sale — " + i.name, amount: i.amount })),
    ...(plData.salesItems.length === 0 ? [{ label: "Sale", amount: 0 }] : []),
    { label: "Income (Direct/Opr.)",  amount: plData.totalOtherIncome },
    { label: "__DASH__",              amount: 0 },
    { label: "Total",                 amount: plData.totalSales + plData.totalOtherIncome, bold: true, isTotal: true },
    { label: "__DASH__",              amount: 0 },
  ];

  // DEBIT side — Section 2 (P&L)
  const debitSection2 = [
    ...plData.indirectExpItems.map((i) => ({ label: i.name, amount: i.amount })),
    ...(plData.indirectExpItems.length === 0 ? [{ label: "Expenses (Indirect/Admn.)", amount: 0 }] : []),
    { label: plData.netProfit >= 0 ? "Nett Profit" : "Net Loss", amount: Math.abs(plData.netProfit), bold: true },
    { label: "__DASH__", amount: 0 },
    {
      label: "Total",
      amount: plData.totalIndirectExp + Math.max(0, plData.netProfit),
      bold: true,
      isTotal: true,
    },
    { label: "__DASH__", amount: 0 },
  ];

  // CREDIT side — Section 2 (P&L)
  const creditSection2 = [
    { label: "Gross Profit b/d", amount: Math.max(0, plData.grossProfit), bold: true },
    ...plData.otherIncomeItems.map((i) => ({ label: "Income (Indirect) — " + i.name, amount: i.amount })),
    ...(plData.otherIncomeItems.length === 0 ? [{ label: "Income (Indirect)", amount: 0 }] : []),
    { label: "__DASH__", amount: 0 },
    {
      label: "Total",
      amount: plData.grossProfit + plData.totalOtherIncome,
      bold: true,
      isTotal: true,
    },
    { label: "__DASH__", amount: 0 },
  ];

  /* ── helper to render one T-section row by row ───────────────────── */
  const maxLen = (a: any[], b: any[]) => Math.max(a.length, b.length);
  const renderTSection = (left: any[], right: any[]) => {
    const len = maxLen(left, right);
    return Array.from({ length: len }).map((_, i) => {
      const L = left[i];
      const R = right[i];
      const isDash = (x: any) => x?.label === "__DASH__";
      return (
        <tr key={i} style={{ background: (L?.isTotal || R?.isTotal) ? "#ddeeff" : undefined }}>
          {/* Left label */}
          <td
            style={{
              padding: "2px 10px",
              color: TEXT,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: L?.bold ? "bold" : undefined,
              borderRight: `1px solid #8899bb`,
            }}
          >
            {isDash(L) ? "" : (L?.label ?? "")}
          </td>
          {/* Left amount */}
          <td
            style={{
              textAlign: "right",
              padding: "2px 10px",
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: L?.bold ? "bold" : undefined,
              color: TEXT,
              whiteSpace: "nowrap",
              minWidth: 100,
              borderRight: `2px solid #8899bb`,
            }}
          >
            {isDash(L) ? DASH_ROW : (L ? (Math.abs(L.amount) < 0.005 ? "0.00" : formatNumber(Math.abs(L.amount))) : "")}
          </td>
          {/* Right label */}
          <td
            style={{
              padding: "2px 10px",
              color: TEXT,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: R?.bold ? "bold" : undefined,
              borderRight: `1px solid #8899bb`,
            }}
          >
            {isDash(R) ? "" : (R?.label ?? "")}
          </td>
          {/* Right amount */}
          <td
            style={{
              textAlign: "right",
              padding: "2px 10px",
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: R?.bold ? "bold" : undefined,
              color: TEXT,
              whiteSpace: "nowrap",
              minWidth: 100,
            }}
          >
            {isDash(R) ? DASH_ROW : (R ? (Math.abs(R.amount) < 0.005 ? "0.00" : formatNumber(Math.abs(R.amount))) : "")}
          </td>
        </tr>
      );
    });
  };

  return (
    <div style={{ background: BG_PAGE, padding: 12 }}>
      <PillTitle title="Profit & Loss A/c" />

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 6 }} className="no-print">
        {[
          { label: "Export - [E]", icon: <FileSpreadsheet size={13} />, fn: handleExport },
          { label: "Print - [P]",  icon: <Printer size={13} />,         fn: handlePrint  },
        ].map(({ label, icon, fn }) => (
          <button key={label} onClick={fn}
            style={{ fontSize: 11, padding: "2px 10px", background: "#e8e8e8", border: "1px solid #666", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: FONT }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Report body */}
      <div style={{ background: "white", border: "1px solid #8899bb", fontFamily: FONT }}>

        {/* Date header */}
        <div style={{ padding: "3px 10px", borderBottom: "1px solid #8899bb", color: TEXT, fontSize: 11 }}>
          For the period ending {fiscalEnd}
        </div>

        {/* Column headers */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#b8c8e8" }}>
              <th style={{ padding: "4px 10px", textAlign: "left",  color: TEXT, fontSize: 12, fontWeight: "bold", borderRight: "1px solid #8899bb", width: "35%" }}>
                D E B I T &nbsp; ( Rs. )
              </th>
              <th style={{ padding: "4px 10px", textAlign: "right", color: TEXT, fontSize: 12, fontWeight: "bold", borderRight: "2px solid #8899bb", width: "15%" }} />
              <th style={{ padding: "4px 10px", textAlign: "left",  color: TEXT, fontSize: 12, fontWeight: "bold", borderRight: "1px solid #8899bb", width: "35%" }}>
                C R E D I T &nbsp; ( Rs. )
              </th>
              <th style={{ padding: "4px 10px", textAlign: "right", color: TEXT, fontSize: 12, fontWeight: "bold", width: "15%" }} />
            </tr>
          </thead>

          <tbody>
            {/* ── Section 1: Trading Account ── */}
            {renderTSection(debitSection1, creditSection1)}

            {/* ── Gap row between sections ── */}
            <tr>
              <td colSpan={4} style={{ padding: "4px 0", borderTop: "1px solid #8899bb44" }} />
            </tr>

            {/* ── Section 2: Profit & Loss Account ── */}
            {renderTSection(debitSection2, creditSection2)}
          </tbody>
        </table>
      </div>

      {plData.error && (
        <div style={{ color: "red", marginTop: 8, fontSize: 11 }}>Error: {plData.error}</div>
      )}
    </div>
  );
};

export default ProfitLoss;
