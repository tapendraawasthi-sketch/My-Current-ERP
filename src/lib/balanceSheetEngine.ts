// src/lib/balanceSheetEngine.ts
// @ts-nocheck
import { getDB, openDB, safeTableGet } from "./db";
import type {
  BSComputation,
  BSOptions,
  BSSection,
  BSRowData,
  AccountLedgerReport,
  LedgerEntry,
} from "./balanceSheetTypes";
import { STANDARD_GROUP_SIDES, INCOME_EXPENSE_GROUPS } from "./balanceSheetTypes";
import { buildAccountTree, type AccountNode } from "./reportingHierarchy";
import { computeTotalClosingStockValue, mapConfigMethodToValuation } from "./stockValuation";
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

  for (const ig of INCOME_EXPENSE_GROUPS) {
    if (lname.includes(ig) || ltype.includes(ig) || lparent.includes(ig)) return null;
  }

  for (const [key, side] of Object.entries(STANDARD_GROUP_SIDES)) {
    if (lname.includes(key) || ltype.includes(key)) return side;
  }

  for (const [key, side] of Object.entries(STANDARD_GROUP_SIDES)) {
    if (lparent.includes(key)) return side;
  }

  if (ltype === "asset") return "assets";
  if (ltype === "liability") return "liabilities";
  if (ltype === "equity") return "equity";
  if (ltype === "income" || ltype === "expense") return null;

  if (lname.includes("asset") || lname.includes("receivable") || lname.includes("deposit"))
    return "assets";
  if (lname.includes("liability") || lname.includes("payable") || lname.includes("loan"))
    return "liabilities";
  if (lname.includes("capital") || lname.includes("reserve") || lname.includes("equity"))
    return "equity";

  return null;
}

function getAccountNetBalance(
  accId: string,
  balanceMap: Map<string, { debit: number; credit: number }>,
  accountMap: Map<string, any>,
): number {
  const acc = accountMap.get(accId);
  if (!acc) return 0;
  const bal = balanceMap.get(accId) || { debit: 0, credit: 0 };
  const openingDr = Number(acc.openingBalanceDr || acc.openingBalance || 0);
  const openingCr = Number(acc.openingBalanceCr || 0);
  return bal.credit + openingCr - (bal.debit + openingDr);
}

function toBSAmount(
  netBalance: number,
  side: "assets" | "liabilities" | "equity",
): number {
  return side === "assets" ? -netBalance : netBalance;
}

/** Build hierarchical BS rows from chart-of-accounts tree — groups always shown. */
function buildNodeRow(
  node: AccountNode,
  side: "assets" | "liabilities" | "equity",
  showZeroLedgers: boolean,
  depth: number,
  balanceMap: Map<string, { debit: number; credit: number }>,
  accountMap: Map<string, any>,
  getParentName: (a: any) => string,
): BSRowData | null {
  if (node.isGroup) {
    const childRows: BSRowData[] = [];
    for (const child of node.children || []) {
      const childSide =
        getGroupSide(child.name, child.type || (child as any).group || "", getParentName(child)) ||
        side;
      if (childSide !== side) continue;
      const row = buildNodeRow(
        child,
        side,
        showZeroLedgers,
        depth + 1,
        balanceMap,
        accountMap,
        getParentName,
      );
      if (row) childRows.push(row);
    }

    const groupTotal = childRows.reduce((s, r) => s + (r.amount || 0), 0);

    return {
      id: node.id,
      caption: node.name,
      amount: groupTotal,
      level: depth,
      indent: depth,
      bold: true,
      isClickable: true,
      groupId: node.id,
      children: childRows.length > 0 ? childRows : undefined,
      zeroBalance: Math.abs(groupTotal) < 0.005,
      hideIfZero: false,
    };
  }

  const netBal = getAccountNetBalance(node.id, balanceMap, accountMap);
  const amount = toBSAmount(netBal, side);
  const isZero = Math.abs(amount) < 0.005;
  if (!showZeroLedgers && isZero) return null;

  return {
    id: node.id,
    caption: node.name,
    amount,
    level: depth,
    indent: depth,
    bold: false,
    isClickable: true,
    accountId: node.id,
    zeroBalance: isZero,
    hideIfZero: false,
  };
}

function collectSideRows(
  roots: AccountNode[],
  side: "assets" | "liabilities" | "equity",
  showZeroLedgers: boolean,
  balanceMap: Map<string, { debit: number; credit: number }>,
  accountMap: Map<string, any>,
  getParentName: (a: any) => string,
): BSRowData[] {
  const rows: BSRowData[] = [];
  for (const root of roots) {
    const rootSide = getGroupSide(
      root.name,
      root.type || (root as any).group || "",
      getParentName(root),
    );
    if (rootSide !== side) continue;
    const row = buildNodeRow(
      root,
      side,
      showZeroLedgers,
      0,
      balanceMap,
      accountMap,
      getParentName,
    );
    if (row) rows.push(row);
  }
  return rows;
}

/** Include ledgers whose parent group was not placed in the tree (orphans). */
function collectOrphanLedgers(
  allAccounts: any[],
  side: "assets" | "liabilities" | "equity",
  showZeroLedgers: boolean,
  balanceMap: Map<string, { debit: number; credit: number }>,
  accountMap: Map<string, any>,
  getParentName: (a: any) => string,
  existingIds: Set<string>,
): BSRowData[] {
  const rows: BSRowData[] = [];
  for (const acc of allAccounts) {
    if (acc.isGroup || existingIds.has(acc.id)) continue;
    const accSide = getGroupSide(acc.name, acc.type || acc.group || "", getParentName(acc));
    if (accSide !== side) continue;
    const amount = toBSAmount(getAccountNetBalance(acc.id, balanceMap, accountMap), side);
    const isZero = Math.abs(amount) < 0.005;
    if (!showZeroLedgers && isZero) continue;
    rows.push({
      id: acc.id,
      caption: acc.name,
      amount,
      level: 1,
      indent: 1,
      bold: false,
      isClickable: true,
      accountId: acc.id,
      zeroBalance: isZero,
      hideIfZero: false,
    });
  }
  return rows;
}

function collectRowIds(rows: BSRowData[], ids: Set<string>) {
  for (const row of rows) {
    ids.add(row.id);
    if (row.children) collectRowIds(row.children, ids);
  }
}

// ─── Core Balance Sheet Computation ──────────────────────────────────────────

export async function computeBalanceSheet(options: BSOptions): Promise<BSComputation> {
  await openDB();
  const db = getDB();

  const [allAccounts, allVouchers] = await Promise.all([
    db
      .table("accounts")
      .toArray()
      .catch(() => []),
    db
      .table("vouchers")
      .toArray()
      .catch(() => []),
  ]);

  const vouchers = allVouchers.filter(
    (v: any) => v.status === "posted" && v.date <= options.toDate,
  );

  const balanceMap = new Map<string, { debit: number; credit: number }>();
  const addBalance = (accountId: string, debit: number, credit: number) => {
    if (!accountId) return;
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

  const accountMap = new Map<string, any>();
  allAccounts.forEach((a: any) => accountMap.set(a.id, a));

  const getParentName = (a: any): string => {
    if (!a?.parentId) return "";
    const p = accountMap.get(a.parentId);
    return p ? `${p.name} ${p.group || ""} ${p.type || ""}` : "";
  };

  const plAccounts = allAccounts.filter((acc: any) => {
    if (acc.isGroup) return false;
    const parentName = getParentName(acc);
    return getGroupSide(acc.name, acc.type || acc.group || "", parentName) === null;
  });

  let plDebit = 0;
  let plCredit = 0;
  for (const acc of plAccounts) {
    const bal = balanceMap.get(acc.id) || { debit: 0, credit: 0 };
    const openingDr = Number(acc.openingBalanceDr || acc.openingBalance || 0);
    const openingCr = Number(acc.openingBalanceCr || 0);
    plDebit += bal.debit + openingDr;
    plCredit += bal.credit + openingCr;
  }
  const currentPeriodPL = plCredit - plDebit;

  let closingStock = options.manualClosingStock || 0;
  let closingStockSource: "automatic" | "manual" | "gp-ratio" = "manual";

  if (options.stockUpdation === "automatic" || options.manualClosingStock == null) {
    const stockMovements = await db
      .table("stockMovements")
      .toArray()
      .catch(() => []);
    const invConfig = await safeTableGet("inventoryConfig", "global");
    const valuationMethod = mapConfigMethodToValuation(invConfig?.stockValuationMethod);
    closingStock = computeTotalClosingStockValue(stockMovements, valuationMethod, options.toDate);
    closingStockSource = "automatic";
  } else if (options.stockUpdation === "gp-ratio") {
    closingStockSource = "gp-ratio";
  }

  const tree = buildAccountTree(allAccounts);
  const showZero = options.showZeroBalances !== false;

  let assetRows = collectSideRows(
    tree.roots,
    "assets",
    showZero,
    balanceMap,
    accountMap,
    getParentName,
  );
  let liabilityRows = collectSideRows(
    tree.roots,
    "liabilities",
    showZero,
    balanceMap,
    accountMap,
    getParentName,
  );
  let equityRows = collectSideRows(
    tree.roots,
    "equity",
    showZero,
    balanceMap,
    accountMap,
    getParentName,
  );

  const placedIds = new Set<string>();
  collectRowIds(assetRows, placedIds);
  collectRowIds(liabilityRows, placedIds);
  collectRowIds(equityRows, placedIds);

  assetRows = [
    ...assetRows,
    ...collectOrphanLedgers(
      allAccounts,
      "assets",
      showZero,
      balanceMap,
      accountMap,
      getParentName,
      placedIds,
    ),
  ];
  liabilityRows = [
    ...liabilityRows,
    ...collectOrphanLedgers(
      allAccounts,
      "liabilities",
      showZero,
      balanceMap,
      accountMap,
      getParentName,
      placedIds,
    ),
  ];
  equityRows = [
    ...equityRows,
    ...collectOrphanLedgers(
      allAccounts,
      "equity",
      showZero,
      balanceMap,
      accountMap,
      getParentName,
      placedIds,
    ),
  ];

  if (closingStock > 0 || showZero) {
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
        isClickable: true,
        children: [stockRow],
        zeroBalance: closingStock === 0,
        hideIfZero: false,
      });
    }
  }

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
      zeroBalance: Math.abs(currentPeriodPL) < 0.005,
      hideIfZero: false,
    });
  }

  const sumRows = (rows: BSRowData[]) =>
    rows.reduce((s, r) => s + (r.amount || 0), 0);

  const liabilitiesSection: BSSection = {
    id: "liabilities",
    caption: "Liabilities",
    total: sumRows(liabilityRows),
    rows: liabilityRows,
    level: 0,
    bold: true,
  };

  const equitySection: BSSection = {
    id: "equity",
    caption: "Capital & Equity",
    total: sumRows(equityRows),
    rows: equityRows,
    level: 0,
    bold: true,
  };

  const assetsSection: BSSection = {
    id: "assets",
    caption: "Assets",
    total: sumRows(assetRows),
    rows: assetRows,
    level: 0,
    bold: true,
  };

  const totalLE = liabilitiesSection.total + equitySection.total;
  const totalA = assetsSection.total;
  const difference = totalLE - totalA;
  const isBalanced = Math.abs(difference) < 1;

  let plAdjustedAmount = 0;
  if (!isBalanced) {
    plAdjustedAmount = difference;
  }

  if (options.showPercentage && totalA > 0) {
    const addPct = (rows: BSRowData[], base: number) => {
      rows.forEach((r) => {
        r.percentage = base > 0 ? (Math.abs(r.amount) / base) * 100 : 0;
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
  await openDB();
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
        const totalLabel = `Total ${sec.caption}`;
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
