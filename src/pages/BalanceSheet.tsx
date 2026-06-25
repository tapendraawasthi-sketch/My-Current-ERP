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
const BG_PAGE   = "#d8dce8";
const BG_HEADER = "#b8c8e8";
const TEXT      = "#00008b";
const FONT      = "'Courier New', monospace";
const BORDER    = "#8899bb";

const BalanceSheet: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();

  const fiscalEnd   = currentFiscalYear?.endDate   || "2027-07-15";
  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";

  const bsData = useMemo(() => {
    try {
      const postedVouchers = vouchers.filter(
        (v) => v.status === VoucherStatus.POSTED && v.date <= fiscalEnd
      );

      const balances = new Map<string, number>();
      for (const acc of accounts) {
        if (acc.isGroup) continue;
        balances.set(acc.id, (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0));
      }
      for (const v of postedVouchers) {
        for (const line of v.lines) {
          const cur = balances.get(line.accountId) || 0;
          balances.set(line.accountId, cur + (line.debit || 0) - (line.credit || 0));
        }
      }

      const pick = (type: AccountType, negate: boolean) =>
        accounts
          .filter((a) => !a.isGroup && a.type === type)
          .map((a) => ({ id: a.id, name: a.name, code: a.code, amount: negate ? -(balances.get(a.id) || 0) : (balances.get(a.id) || 0) }))
          .filter((i) => Math.abs(i.amount) > 0.01);

      const assetItems    = pick(AccountType.ASSET,     false);
      const liabItems     = pick(AccountType.LIABILITY, true);
      const equityItems   = pick(AccountType.EQUITY,    true);
      const incomeItems   = pick(AccountType.INCOME,    true);
      const expenseItems  = pick(AccountType.EXPENSE,   false);

      const totalIncome  = incomeItems.reduce((s, i) => s + i.amount, 0);
      const totalExpense = expenseItems.reduce((s, i) => s + i.amount, 0);
      const netProfit    = totalIncome - totalExpense;

      const totalAssets     = assetItems.reduce((s, i) => s + i.amount, 0);
      const totalLiab       = liabItems.reduce((s, i) => s + i.amount, 0);
      const totalEquity     = equityItems.reduce((s, i) => s + i.amount, 0);
      const totalLiabEquity = totalLiab + totalEquity + netProfit;
      const isBalanced      = Math.abs(totalAssets - totalLiabEquity) < 1;

      return {
        assetItems, liabItems, equityItems,
        totalAssets:     Math.round(totalAssets     * 100) / 100,
        totalLiab:       Math.round(totalLiab       * 100) / 100,
        totalEquity:     Math.round(totalEquity     * 100) / 100,
        netProfit:       Math.round(netProfit        * 100) / 100,
        totalLiabEquity: Math.round(totalLiabEquity * 100) / 100,
        isBalanced,
        difference:      Math.round(Math.abs(totalAssets - totalLiabEquity) * 100) / 100,
        error: null,
      };
    } catch (error) {
      return {
        assetItems: [], liabItems: [], equityItems: [],
        totalAssets: 0, totalLiab: 0, totalEquity: 0, netProfit: 0,
        totalLiabEquity: 0, isBalanced: false, difference: 0, error: String(error),
      };
    }
  }, [accounts, vouchers, fiscalEnd]);

  const handlePrint = () => window.print();
  const handleExport = () => {
    try {
      const rows: any[] = [
        ["BALANCE SHEET", "", `As at ${fiscalEnd}`], [],
        ["LIABILITIES", "Amount(Rs.)", "ASSETS", "Amount(Rs.)"],
        ["Profit for the period", bsData.netProfit, "Fixed Assets", "—"],
        ["Capital Account", bsData.totalEquity, "Current Assets", bsData.totalAssets],
        ["Current Liabilities", bsData.totalLiab, "", ""],
        [], ["Total", bsData.totalLiabEquity, "Total", bsData.totalAssets],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
      XLSX.writeFile(wb, `BalanceSheet_${fiscalEnd}.xlsx`);
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  };

  /* ── Build interleaved rows for the T-table ───────────────────────── */
  // Each element is { label, amount, bold, isGroup } for LEFT or RIGHT side
  const liabRows: any[] = [
    { label: "Profit for the period", amount: bsData.netProfit, bold: true, isGroup: true },
    ...( bsData.netProfit !== 0 ? [] : [] ), // spacer when zero
    { label: "Capital Account",       amount: bsData.totalEquity, bold: true, isGroup: true },
    ...bsData.equityItems.map((i) => ({ label: "  " + i.name, amount: i.amount })),
    { label: "Current Liabilities",   amount: bsData.totalLiab,  bold: true, isGroup: true },
    ...bsData.liabItems.map((i) => ({ label: "  " + i.name, amount: i.amount })),
  ];

  // Busy 21 splits assets into Fixed Assets and Current Assets by name/group heuristic
  const fixedAssets   = bsData.assetItems.filter((a) =>
    a.name.toLowerCase().includes("fixed") ||
    (a as any).code?.startsWith?.("1") ||
    a.name.toLowerCase().includes("equipment") ||
    a.name.toLowerCase().includes("furniture") ||
    a.name.toLowerCase().includes("vehicle") ||
    a.name.toLowerCase().includes("land") ||
    a.name.toLowerCase().includes("building")
  );
  const currentAssets = bsData.assetItems.filter((a) => !fixedAssets.includes(a));

  const assetRows: any[] = [
    { label: "Fixed Assets",   amount: fixedAssets.reduce((s, i) => s + i.amount, 0),   bold: true, isGroup: true },
    ...fixedAssets.map((i) => ({ label: "  " + i.name, amount: i.amount })),
    { label: "Current Assets", amount: currentAssets.reduce((s, i) => s + i.amount, 0), bold: true, isGroup: true },
    ...currentAssets.map((i) => ({ label: "  " + i.name, amount: i.amount })),
  ];

  const maxLen = Math.max(liabRows.length, assetRows.length);

  return (
    <div style={{ background: BG_PAGE, padding: 12 }}>
      <PillTitle title="Balance Sheet" />

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
      <div style={{ background: "white", border: `1px solid ${BORDER}`, fontFamily: FONT }}>

        {/* Date header */}
        <div style={{ padding: "3px 10px", borderBottom: `1px solid ${BORDER}`, color: TEXT, fontSize: 11 }}>
          At the end of : {fiscalEnd}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          {/* Column headers */}
          <thead>
            <tr style={{ background: BG_HEADER }}>
              <th style={{ padding: "5px 10px", textAlign: "left",  color: TEXT, fontSize: 13, fontWeight: "bold", letterSpacing: 2, borderRight: `1px solid ${BORDER}`, width: "30%" }}>
                L I A B I L I T I E S
              </th>
              <th style={{ padding: "5px 10px", textAlign: "right", color: TEXT, fontSize: 11, fontWeight: "bold", borderRight: `2px solid ${BORDER}`, width: "18%" }}>
                Amount( Rs. )
              </th>
              <th style={{ padding: "5px 10px", textAlign: "left",  color: TEXT, fontSize: 13, fontWeight: "bold", letterSpacing: 2, borderRight: `1px solid ${BORDER}`, width: "30%" }}>
                A S S E T S
              </th>
              <th style={{ padding: "5px 10px", textAlign: "right", color: TEXT, fontSize: 11, fontWeight: "bold", width: "18%" }}>
                Amount( Rs. )
              </th>
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: maxLen }).map((_, i) => {
              const L = liabRows[i];
              const R = assetRows[i];
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                  {/* LIABILITIES label */}
                  <td
                    style={{
                      padding: "3px 10px",
                      color: TEXT,
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: L?.isGroup ? "bold" : undefined,
                      borderRight: `1px solid ${BORDER}40`,
                    }}
                  >
                    {L?.label ?? ""}
                  </td>
                  {/* LIABILITIES amount */}
                  <td
                    style={{
                      padding: "3px 10px",
                      textAlign: "right",
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: L?.isGroup ? "bold" : undefined,
                      color: TEXT,
                      whiteSpace: "nowrap",
                      borderRight: `2px solid ${BORDER}`,
                    }}
                  >
                    {L
                      ? Math.abs(L.amount) < 0.005
                        ? "0.00"
                        : formatNumber(Math.abs(L.amount))
                      : ""}
                  </td>
                  {/* ASSETS label */}
                  <td
                    style={{
                      padding: "3px 10px",
                      color: TEXT,
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: R?.isGroup ? "bold" : undefined,
                      borderRight: `1px solid ${BORDER}40`,
                    }}
                  >
                    {R?.label ?? ""}
                  </td>
                  {/* ASSETS amount */}
                  <td
                    style={{
                      padding: "3px 10px",
                      textAlign: "right",
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: R?.isGroup ? "bold" : undefined,
                      color: TEXT,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {R
                      ? Math.abs(R.amount) < 0.005
                        ? "0.00"
                        : formatNumber(Math.abs(R.amount))
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Grand total row */}
          <tfoot>
            <tr style={{ background: "#d0dff0", borderTop: `2px solid ${BORDER}`, fontWeight: "bold" }}>
              <td style={{ padding: "5px 10px", color: TEXT, fontSize: 12, borderRight: `1px solid ${BORDER}` }} />
              <td
                style={{
                  padding: "5px 10px",
                  textAlign: "right",
                  color: TEXT,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: "bold",
                  borderRight: `2px solid ${BORDER}`,
                }}
              >
                {formatNumber(Math.abs(bsData.totalLiabEquity))}
              </td>
              <td style={{ padding: "5px 10px", color: TEXT, fontSize: 12, borderRight: `1px solid ${BORDER}` }} />
              <td
                style={{
                  padding: "5px 10px",
                  textAlign: "right",
                  color: TEXT,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: "bold",
                }}
              >
                {formatNumber(Math.abs(bsData.totalAssets))}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Balance check */}
        <div
          style={{
            padding: "3px 10px",
            borderTop: `1px solid ${BORDER}`,
            fontSize: 10,
            color: bsData.isBalanced ? "green" : "red",
            fontFamily: FONT,
          }}
        >
          {bsData.isBalanced
            ? "✓  Balance Sheet is balanced (Assets = Liabilities + Equity)"
            : `✗  Unbalanced — Difference: ${formatNumber(bsData.difference)}`}
        </div>
      </div>

      {bsData.error && (
        <div style={{ color: "red", marginTop: 8, fontSize: 11 }}>Error: {bsData.error}</div>
      )}
    </div>
  );
};

export default BalanceSheet;
