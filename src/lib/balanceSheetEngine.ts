// src/lib/balanceSheetEngine.ts
// @ts-nocheck
import { getDB } from "./db";
import type {
  BSComputation,
  BSOptions,
  BSSection,
  BSRowData,
  AccountLedgerReport,
  LedgerEntry,
  BSFormat,
  BSFormatRow,
} from "./balanceSheetTypes";
import { STANDARD_GROUP_SIDES, INCOME_EXPENSE_GROUPS } from "./balanceSheetTypes";
import * as XLSX from "xlsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt2 = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getGroupSide(
  groupName: string,
  groupType: string,
  parentName: string,
): "assets" | "liabilities" | "equity" | null {
  const lname = (groupName || "").toLowerCase().trim();
  const ltype = (groupType || "").toLowerCase().trim();
  const lparent = (parentName || "").toLowerCase().trim();

  // Income/Expense groups → P&L, not BS
  for (const ig of INCOME_EXPENSE_GROUPS) {
    if (lname.includes(ig) || ltype.includes(ig) || lparent.includes(ig)) return null;
  }

  // Check against known groups
  for (const [key, side] of Object.entries(STANDARD_GROUP_SIDES)) {
    if (lname.includes(key) || ltype.includes(key)) return side;
  }

  // Check parent
  for (const [key, side] of Object.entries(STANDARD_GROUP_SIDES)) {
    if (lparent.includes(key)) return side;
  }

  // Fallback by account type
  if (ltype === "asset") return "assets";
  if (ltype === "liability") return "liabilities";
  if (ltype === "equity") return "equity";
  if (ltype === "income" || ltype === "expense") return null;

  // Check names with broader keywords
  if (lname.includes("asset") || lname.includes("receivable") || lname.includes("deposit"))
    return "assets";
  if (lname.includes("liability") || lname.includes("payable") || lname.includes("loan"))
    return "liabilities";
  if (lname.includes("capital") || lname.includes("reserve") || lname.includes("equity"))
    return "equity";

  return null; // exclude from BS
}

// ─── Core Balance Sheet Computation ──────────────────────────────────────────

export async function computeBalanceSheet(options: BSOptions): Promise<BSComputation> {
  const db = getDB();

  const [allAccounts, allVouchers, allInvoices] = await Promise.all([
    db
      .table("accounts")
      .toArray()
      .catch(() => []),
    db
      .table("vouchers")
      .toArray()
      .catch(() => []),
    db
      .table("invoices")
      .toArray()
      .catch(() => []),
  ]);

  // Filter posted vouchers up to toDate
  const vouchers = allVouchers.filter(
    (v: any) => v.status === "posted" && v.date <= options.toDate,
  );
  const invoices = allInvoices.filter(
    (v: any) => v.status === "posted" && v.date <= options.toDate,
  );

  // Build account balance map
  const balanceMap = new Map<string, { debit: number; credit: number }>();

  const addBalance = (accountId: string, debit: number, credit: number) => {
    const cur = balanceMap.get(accountId) || { debit: 0, credit: 0 };
    balanceMap.set(accountId, {
      debit: cur.debit + (debit || 0),
      credit: cur.credit + (credit || 0),
    });
  };

  for (const v of vouchers) {
    for (const line of v.lines || []) {
      if (line.accountId) addBalance(line.accountId, line.debit || 0, line.credit || 0);
    }
  }

  // Build account map
  const accountMap = new Map<string, any>();
  allAccounts.forEach((a: any) => accountMap.set(a.id, a));

  const getParentName = (a: any): string => {
    if (!a.parentId) return "";
    const p = accountMap.get(a.parentId);
    return p ? `${p.name} ${p.group || ""} ${p.type || ""}` : "";
  };

  // Separate accounts into BS vs P&L
  const assetsMap = new Map<string, any[]>();
  const liabilitiesMap = new Map<string, any[]>();
  const equityMap = new Map<string, any[]>();
  const plAccounts: any[] = [];

  for (const acc of allAccounts) {
    const parentName = getParentName(acc);
    const side = getGroupSide(acc.name, acc.type || acc.group || "", parentName);

    if (side === null) {
      // P&L account
      plAccounts.push(acc);
      continue;
    }

    const bal = balanceMap.get(acc.id) || { debit: 0, credit: 0 };
    const openingDr = Number(acc.openingBalanceDr || acc.openingBalance || 0);
    const openingCr = Number(acc.openingBalanceCr || 0);
    const totalDebit = bal.debit + openingDr;
    const totalCredit = bal.credit + openingCr;
    const netBalance = totalCredit - totalDebit; // positive = credit

    const entry = {
      ...acc,
      balance: netBalance,
      debit: totalDebit,
      credit: totalCredit,
      side,
    };

    const target = side === "assets" ? assetsMap : side === "equity" ? equityMap : liabilitiesMap;
    const groupKey = acc.parentId
      ? accountMap.get(acc.parentId)?.name || "Ungrouped"
      : acc.isGroup
        ? acc.name
        : "Ungrouped";

    if (!target.has(groupKey)) target.set(groupKey, []);
    target.get(groupKey)!.push(entry);
  }

  // Compute P&L result
  let plDebit = 0;
  let plCredit = 0;
  for (const acc of plAccounts) {
    const bal = balanceMap.get(acc.id) || { debit: 0, credit: 0 };
    const openingDr = Number(acc.openingBalanceDr || acc.openingBalance || 0);
    const openingCr = Number(acc.openingBalanceCr || 0);
    plDebit += bal.debit + openingDr;
    plCredit += bal.credit + openingCr;
  }
  const currentPeriodPL = plCredit - plDebit; // positive = profit

  // Closing stock
  let closingStock = options.manualClosingStock || 0;
  let closingStockSource: "automatic" | "manual" | "gp-ratio" = "manual";

  if (options.stockUpdation === "automatic" || !options.manualClosingStock) {
    const stockMovements = await db
      .table("stockMovements")
      .toArray()
      .catch(() => []);
    let autoStock = 0;
    for (const mov of stockMovements) {
      if (mov.date > options.toDate) continue;
      const qty = Number(mov.qty || 0);
      const rate = Number(mov.rate || mov.costRate || 0);
      const t = String(mov.type || "").toLowerCase();
      if (t.includes("in") || t.includes("purchase") || t.includes("opening")) {
        autoStock += qty * rate;
      } else if (t.includes("out") || t.includes("sale") || t.includes("transfer-out")) {
        autoStock -= qty * rate;
      }
    }
    closingStock = Math.max(0, autoStock);
    closingStockSource = "automatic";
  } else if (options.stockUpdation === "gp-ratio") {
    // GP ratio method: Closing Stock = Opening Stock + Purchases - COGS (estimated)
    closingStockSource = "gp-ratio";
  }

  // Build sections
  const buildRows = (
    groupMap: Map<string, any[]>,
    side: string,
    showZero: boolean,
  ): BSRowData[] => {
    const rows: BSRowData[] = [];

    // Group by primary group name
    const primaryGroups = new Map<string, any[]>();
    for (const [groupName, accounts] of groupMap) {
      // Find parent group
      const firstAcc = accounts[0];
      let primaryGroupName = groupName;
      if (firstAcc?.parentId) {
        const parent = accountMap.get(firstAcc.parentId);
        const grandparent = parent?.parentId ? accountMap.get(parent.parentId) : null;
        primaryGroupName = grandparent?.name || parent?.name || groupName;
      }
      if (!primaryGroups.has(primaryGroupName)) primaryGroups.set(primaryGroupName, []);
      primaryGroups.get(primaryGroupName)!.push(...accounts);
    }

    for (const [pgName, accounts] of primaryGroups) {
      const groupTotal = accounts.reduce((s, a) => {
        const netBal = side === "assets" ? -a.balance : a.balance;
        return s + netBal;
      }, 0);

      if (!showZero && Math.abs(groupTotal) < 0.005 && !accounts.some((a) => a.isGroup)) {
        // Still show groups with 0 balance as per spec
      }

      const subRows: BSRowData[] = [];
      for (const acc of accounts) {
        const netBal = side === "assets" ? -acc.balance : acc.balance;
        if (!showZero && Math.abs(netBal) < 0.005 && !acc.isGroup) continue;

        subRows.push({
          id: acc.id,
          caption: acc.name,
          amount: netBal,
          level: 2,
          indent: 2,
          bold: acc.isGroup,
          isClickable: true,
          accountId: acc.isGroup ? undefined : acc.id,
          groupId: acc.isGroup ? acc.id : undefined,
          zeroBalance: Math.abs(netBal) < 0.005,
          hideIfZero: false, // always show groups with 0
        });
      }

      rows.push({
        id: `grp-${pgName}`,
        caption: pgName,
        amount: groupTotal,
        level: 1,
        indent: 1,
        bold: true,
        isClickable: true,
        groupId: pgName,
        children: subRows,
        isSubtotal: false,
        zeroBalance: Math.abs(groupTotal) < 0.005,
        hideIfZero: false,
      });
    }

    return rows;
  };

  const assetRows = buildRows(assetsMap, "assets", options.showZeroBalances);
  const liabilityRows = buildRows(liabilitiesMap, "liabilities", options.showZeroBalances);
  const equityRows = buildRows(equityMap, "equity", options.showZeroBalances);

  // Add closing stock to assets (Stock-in-hand group)
  if (closingStock > 0 || options.showZeroBalances) {
    const stockRow: BSRowData = {
      id: "closing-stock",
      caption: "Closing Stock",
      amount: closingStock,
      level: 2,
      indent: 2,
      bold: false,
      isClickable: true,
      isClosingStock: true,
      zeroBalance: closingStock === 0,
    };

    const stockGroup = assetRows.find((r) => r.caption.toLowerCase().includes("stock"));
    if (stockGroup) {
      stockGroup.children = [...(stockGroup.children || []), stockRow];
      stockGroup.amount += closingStock;
    } else {
      assetRows.push({
        id: "grp-stock",
        caption: "Stock-in-Hand",
        amount: closingStock,
        level: 1,
        indent: 1,
        bold: true,
        isClickable: false,
        children: [stockRow],
        zeroBalance: false,
      });
    }
  }

  // P&L line on liabilities/equity side
  const plRow: BSRowData = {
    id: "pl-result",
    caption: currentPeriodPL >= 0 ? "Net Profit for the Period" : "Net Loss for the Period",
    amount: Math.abs(currentPeriodPL),
    level: 2,
    indent: 1,
    bold: true,
    isClickable: true,
    isPLLine: true,
    zeroBalance: Math.abs(currentPeriodPL) < 0.005,
  };

  // Add P&L to Reserves & Surplus or Capital section
  const capitalSection = equityRows.find(
    (r) =>
      r.caption.toLowerCase().includes("capital") ||
      r.caption.toLowerCase().includes("reserve") ||
      r.caption.toLowerCase().includes("equity"),
  );
  if (capitalSection) {
    capitalSection.children = [...(capitalSection.children || []), plRow];
    capitalSection.amount +=
      currentPeriodPL >= 0 ? Math.abs(currentPeriodPL) : -Math.abs(currentPeriodPL);
  } else {
    equityRows.push({
      id: "grp-pl",
      caption: "Profit & Loss Account",
      amount: currentPeriodPL,
      level: 1,
      indent: 1,
      bold: true,
      isClickable: true,
      isPLLine: true,
      children: [plRow],
      zeroBalance: false,
    });
  }

  // Build sections
  const liabilitiesSection: BSSection = {
    id: "liabilities",
    caption: "Liabilities",
    total: liabilityRows.reduce((s, r) => s + r.amount, 0),
    rows: liabilityRows,
    level: 0,
    bold: true,
  };

  const equitySection: BSSection = {
    id: "equity",
    caption: "Capital & Equity",
    total: equityRows.reduce((s, r) => s + r.amount, 0),
    rows: equityRows,
    level: 0,
    bold: true,
  };

  const assetsSection: BSSection = {
    id: "assets",
    caption: "Assets",
    total: assetRows.reduce((s, r) => s + (r.amount || 0), 0),
    rows: assetRows,
    level: 0,
    bold: true,
  };

  const totalLE = liabilitiesSection.total + equitySection.total;
  const totalA = assetsSection.total;
  const difference = totalLE - totalA;
  const isBalanced = Math.abs(difference) < 1;

  // Pl Adjusted (screen-only balancing) if needed
  let plAdjustedAmount = 0;
  if (!isBalanced) {
    plAdjustedAmount = difference;
  }

  // Percentage calculation
  if (options.showPercentage && totalA > 0) {
    const addPct = (rows: BSRowData[], base: number) => {
      rows.forEach((r) => {
        r.percentage = totalA > 0 ? (Math.abs(r.amount) / base) * 100 : 0;
        if (r.children) addPct(r.children, base);
      });
    };
    addPct(liabilityRows, totalA);
    addPct(equityRows, totalA);
    addPct(assetRows, totalA);
  }

  return {
    liabilitiesEquity: [equitySection, liabilitiesSection],
    assets: [assetsSection],
    totalLiabilitiesEquity: totalLE,
    totalAssets: totalA,
    currentPeriodPL,
    plTransferred: false,
    plAdjustedAmount,
    closingStock,
    closingStockSource,
    isBalanced,
    difference,
    fromDate: options.fromDate,
    toDate: options.toDate,
    options,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Account Ledger ───────────────────────────────────────────────────────────

export async function getAccountLedger(
  accountId: string,
  fromDate: string,
  toDate: string,
): Promise<AccountLedgerReport> {
  const db = getDB();
  const [allVouchers, allAccounts] = await Promise.all([
    db
      .table("vouchers")
      .toArray()
      .catch(() => []),
    db
      .table("accounts")
      .toArray()
      .catch(() => []),
  ]);

  const acc = allAccounts.find((a: any) => a.id === accountId);
  const accountName = acc?.name || accountId;
  const accountCode = acc?.code || "";

  // Opening balance before fromDate
  const beforeVouchers = allVouchers.filter((v: any) => v.status === "posted" && v.date < fromDate);
  let openingDr = Number(acc?.openingBalanceDr || acc?.openingBalance || 0);
  let openingCr = Number(acc?.openingBalanceCr || 0);

  for (const v of beforeVouchers) {
    for (const line of v.lines || []) {
      if (line.accountId === accountId) {
        openingDr += Number(line.debit || 0);
        openingCr += Number(line.credit || 0);
      }
    }
  }
  const openingBalance = openingCr - openingDr;

  // Period vouchers
  const periodVouchers = allVouchers.filter(
    (v: any) => v.status === "posted" && v.date >= fromDate && v.date <= toDate,
  );

  const entries: LedgerEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let runningBalance = openingBalance;

  const relevant = periodVouchers
    .flatMap((v: any) =>
      (v.lines || [])
        .filter((l: any) => l.accountId === accountId)
        .map((l: any) => ({
          ...l,
          _date: v.date,
          _voucherNo: v.voucherNo || v.number || "",
          _voucherType: v.type || "",
          _narration: l.narration || v.narration || "",
          _voucherId: v.id,
          _particulars: l.accountName || v.narration || v.type || "",
        })),
    )
    .sort((a: any, b: any) => (a._date < b._date ? -1 : a._date > b._date ? 1 : 0));

  for (const entry of relevant) {
    const dr = Number(entry.debit || 0);
    const cr = Number(entry.credit || 0);
    runningBalance += cr - dr;
    totalDebit += dr;
    totalCredit += cr;
    entries.push({
      id: entry.id || Math.random().toString(36).slice(2),
      date: entry._date,
      voucherNo: entry._voucherNo,
      voucherType: entry._voucherType,
      particulars: entry._particulars,
      narration: entry._narration,
      debit: dr,
      credit: cr,
      runningBalance,
      voucherId: entry._voucherId,
    });
  }

  return {
    accountId,
    accountName,
    accountCode,
    openingBalance,
    closingBalance: runningBalance,
    totalDebit,
    totalCredit,
    entries,
    fromDate,
    toDate,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportBSToExcel(bs: BSComputation, companyName: string, orientation: string) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];

  rows.push([`${companyName}`]);
  rows.push([`Balance Sheet`]);
  rows.push([`As at: ${bs.toDate}`]);
  rows.push([]);

  if (orientation === "horizontal") {
    rows.push(["LIABILITIES & EQUITY", "Amount (Rs.)", "", "ASSETS", "Amount (Rs.)"]);
    const addSectionH = (sections: any[], side: "le" | "a") => {
      for (const sec of sections) {
        for (const row of sec.rows) {
          const indent = "  ".repeat(row.indent || 0);
          if (side === "le") {
            rows.push([indent + row.caption, row.amount, "", "", ""]);
          } else {
            rows.push(["", "", "", indent + row.caption, row.amount]);
          }
          if (row.children) {
            for (const c of row.children) {
              const ci = "  ".repeat((c.indent || 0) + 1);
              if (side === "le") rows.push([ci + c.caption, c.amount, "", "", ""]);
              else rows.push(["", "", "", ci + c.caption, c.amount]);
            }
          }
        }
        const totalLabel = side === "le" ? `Total ${sec.caption}` : `Total ${sec.caption}`;
        if (side === "le") rows.push([totalLabel, sec.total, "", "", ""]);
        else rows.push(["", "", "", totalLabel, sec.total]);
      }
    };
    addSectionH(bs.liabilitiesEquity, "le");
    addSectionH(bs.assets, "a");
    rows.push(["TOTAL", bs.totalLiabilitiesEquity, "", "TOTAL", bs.totalAssets]);
  } else {
    rows.push(["PARTICULARS", "Amount (Rs.)"]);
    const addSectionV = (sections: any[]) => {
      for (const sec of sections) {
        rows.push([sec.caption.toUpperCase(), ""]);
        for (const row of sec.rows) {
          const indent = "  ".repeat(row.indent || 0);
          rows.push([indent + row.caption, row.amount]);
          if (row.children) {
            for (const c of row.children) {
              rows.push(["  ".repeat((c.indent || 0) + 1) + c.caption, c.amount]);
            }
          }
        }
        rows.push([`Total ${sec.caption}`, sec.total]);
        rows.push([]);
      }
    };
    addSectionV(bs.liabilitiesEquity);
    addSectionV(bs.assets);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
  XLSX.writeFile(wb, `BalanceSheet_${bs.toDate}.xlsx`);
}

export function exportBSToCSV(bs: BSComputation) {
  const rows: string[] = ["Caption,Amount"];
  const addRows = (sections: any[]) => {
    for (const sec of sections) {
      rows.push(`"${sec.caption}",""`);
      for (const row of sec.rows) {
        rows.push(`"${row.caption}","${row.amount}"`);
        if (row.children) {
          for (const c of row.children) rows.push(`"  ${c.caption}","${c.amount}"`);
        }
      }
      rows.push(`"Total ${sec.caption}","${sec.total}"`);
    }
  };
  addRows(bs.liabilitiesEquity);
  addRows(bs.assets);
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BalanceSheet_${bs.toDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
