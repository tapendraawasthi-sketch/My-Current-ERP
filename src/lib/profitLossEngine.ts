// src/lib/profitLossEngine.ts
// Core computation engine for Profit & Loss reports

import { getDB } from "./db";
import type {
  PLReportOptions,
  PLComputation,
  PLSection,
  PLAccountLine,
  MonthlyPLData,
  AccountLedgerData,
  AccountLedgerEntry,
  PLGroupType,
} from "./plTypes";
import { GROUP_TYPE_KEYWORDS } from "./plTypes";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

// ─── Helpers ────────────────────────────────────────────────────────────────

const money = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const addMonths = (dateStr: string, months: number): string => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};

const getMonthLabel = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleString("default", { month: "short", year: "2-digit" });
};

const getMonthsInRange = (from: string, to: string): Array<{ start: string; end: string; label: string; year: number; idx: number }> => {
  const months: Array<{ start: string; end: string; label: string; year: number; idx: number }> = [];
  const start = new Date(from);
  const end = new Date(to);
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  let idx = 0;
  while (current <= end) {
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const actualEnd = monthEnd > end ? end : monthEnd;
    months.push({
      start: current.toISOString().split("T")[0],
      end: actualEnd.toISOString().split("T")[0],
      label: current.toLocaleString("default", { month: "short", year: "2-digit" }),
      year: current.getFullYear(),
      idx: idx++,
    });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return months;
};

// ─── Group Classification ────────────────────────────────────────────────────

export function classifyGroup(
  groupName: string,
  groupType?: string,
  parentGroupName?: string
): PLGroupType {
  const lname = (groupName || "").toLowerCase();
  const ltype = (groupType || "").toLowerCase();
  const lparent = (parentGroupName || "").toLowerCase();
  const combined = `${lname} ${ltype} ${lparent}`;

  // Explicit type strings first
  if (ltype === "sales" || ltype === "revenue") return "sales";
  if (ltype === "purchase" || ltype === "purchases") return "purchase";
  if (ltype === "direct-expense" || ltype === "direct expense") return "direct-expense";
  if (ltype === "direct-income" || ltype === "direct income") return "direct-income";
  if (ltype === "indirect-expense" || ltype === "indirect expense") return "indirect-expense";
  if (ltype === "indirect-income" || ltype === "indirect income") return "indirect-income";
  if (ltype === "income") return "indirect-income";
  if (ltype === "expense") return "indirect-expense";

  // Keyword matching
  for (const [plType, keywords] of Object.entries(GROUP_TYPE_KEYWORDS)) {
    if (plType === "balance-sheet") continue;
    for (const kw of keywords) {
      if (combined.includes(kw)) return plType as PLGroupType;
    }
  }

  // Check parent
  if (lparent.includes("sales") || lparent.includes("revenue")) return "sales";
  if (lparent.includes("purchase")) return "purchase";
  if (lparent.includes("direct expense") || lparent.includes("direct cost")) return "direct-expense";
  if (lparent.includes("direct income")) return "direct-income";
  if (lparent.includes("indirect expense") || lparent.includes("overhead")) return "indirect-expense";
  if (lparent.includes("indirect income") || lparent.includes("other income")) return "indirect-income";
  if (lparent.includes("income") && !lparent.includes("expenditure")) return "indirect-income";
  if (lparent.includes("expense") || lparent.includes("expenditure")) return "indirect-expense";

  return "balance-sheet";
}

// ─── Main Computation Engine ─────────────────────────────────────────────────

export async function computeProfitLoss(options: PLReportOptions): Promise<PLComputation> {
  const db = getDB();

  // 1. Load all data
  const [allAccounts, allVouchers] = await Promise.all([
    db.table("accounts").toArray().catch(() => []),
    db.table("vouchers").toArray().catch(() => []),
  ]);

  // Filter vouchers to date range & posted status
  const vouchers = allVouchers.filter(
    (v: any) =>
      v.status === "posted" &&
      v.date >= options.fromDate &&
      v.date <= options.toDate
  );

  // Also load invoices for sales/purchase data
  const allInvoices = await db.table("invoices").toArray().catch(() => []);
  const invoices = allInvoices.filter(
    (inv: any) =>
      inv.status === "posted" &&
      inv.date >= options.fromDate &&
      inv.date <= options.toDate
  );

  // 2. Build account balance map from voucher lines
  const balanceMap: Map<string, { debit: number; credit: number }> = new Map();
  const updateBalance = (accountId: string, debit: number, credit: number) => {
    const current = balanceMap.get(accountId) || { debit: 0, credit: 0 };
    balanceMap.set(accountId, {
      debit: current.debit + (debit || 0),
      credit: current.credit + (credit || 0),
    });
  };

  for (const v of vouchers) {
    for (const line of v.lines || []) {
      if (line.accountId) {
        updateBalance(line.accountId, line.debit || 0, line.credit || 0);
      }
    }
  }

  // Also process invoice-level amounts for direct account posting
  for (const inv of invoices) {
    const isSales = inv.type?.includes("sales") || inv.type === "sales-invoice";
    const isPurchase = inv.type?.includes("purchase") || inv.type === "purchase-invoice";
    
    // Add VAT/tax amounts
    if (inv.taxableAmount && inv.partyId) {
      // These are typically already captured in voucher lines
      // Only add if no corresponding voucher
    }
  }

  // 3. Classify accounts into P&L buckets
  const accountMap = new Map<string, any>();
  for (const acc of allAccounts) accountMap.set(acc.id, acc);

  const getParentGroup = (acc: any): string => {
    if (!acc.parentId) return "";
    const parent = accountMap.get(acc.parentId);
    return parent ? `${parent.name} ${parent.group || ""} ${parent.type || ""}` : "";
  };

  interface BucketEntry {
    accountId: string;
    accountName: string;
    isGroup: boolean;
    parentId?: string;
    groupType: PLGroupType;
    balance: number; // net balance, sign depends on groupType
    debit: number;
    credit: number;
    depth: number;
  }
  const buckets: Record<PLGroupType, BucketEntry[]> = {
    sales: [],
    purchase: [],
    "direct-expense": [],
    "direct-income": [],
    "indirect-expense": [],
    "indirect-income": [],
    stock: [],
    "balance-sheet": [],
  };

  for (const acc of allAccounts) {
    if (!acc.isActive && acc.balance === 0) continue;

    const parentGroupName = getParentGroup(acc);
    const groupType = classifyGroup(
      acc.name || "",
      acc.type || acc.group || acc.accountType || "",
      parentGroupName
    );

    const bal = balanceMap.get(acc.id) || { debit: 0, credit: 0 };
    // Also include opening balance contributions
    const openingBal = acc.openingBalance || acc.openingBalanceDr || 0;
    const openingCr = acc.openingBalanceCr || 0;
    const netDebit = bal.debit + (acc.level === "ledger" || acc.level === "subledger" ? (openingBal > 0 ? openingBal : 0) : 0);
    const netCredit = bal.credit + (openingCr > 0 ? openingCr : 0);
    const netBalance = netCredit - netDebit;

    // Skip balance sheet items and zero-balance non-groups from P&L calculation
    // But include groups (even 0 balance) for display hierarchy
    if (groupType === "balance-sheet") continue;

    buckets[groupType].push({
      accountId: acc.id,
      accountName: acc.name,
      isGroup: acc.isGroup || false,
      parentId: acc.parentId,
      groupType,
      balance: netBalance,
      debit: netDebit,
      credit: netCredit,
      depth: acc.level === "group" ? 0 : acc.level === "subgroup" ? 1 : 2,
    });
  }

  // 4. Build sections with hierarchy
  const buildSection = (entries: BucketEntry[], positiveSign: "credit" | "debit"): PLSection => {
    const lines: PLAccountLine[] = entries
      .sort((a, b) => a.accountName.localeCompare(b.accountName))
      .map((e) => ({
        accountId: e.accountId,
        accountName: e.accountName,
        debit: e.debit,
        credit: e.credit,
        netBalance: e.balance,
        absBalance: Math.abs(e.balance),
        nature: positiveSign,
        isGroup: e.isGroup,
        depth: e.depth,
      }));

    const total = lines.reduce((sum, l) => {
      if (positiveSign === "credit") {
        return sum + (l.credit - l.debit);
      } else {
        return sum + (l.debit - l.credit);
      }
    }, 0);

    return {
      id: positiveSign,
      label: positiveSign,
      lines,
      total: Math.max(0, total),
    };
  };

  const salesSection = buildSection(buckets["sales"], "credit");
  const purchaseSection = buildSection(buckets["purchase"], "debit");
  const directExpSection = buildSection(buckets["direct-expense"], "debit");
  const directIncSection = buildSection(buckets["direct-income"], "credit");
  const indirectExpSection = buildSection(buckets["indirect-expense"], "debit");
  const indirectIncSection = buildSection(buckets["indirect-income"], "credit");

  // 5. Closing stock
  let closingStock = 0;
  if (options.updateClosingStock) {
    // Auto from stock movements
    const stockMovements = await db.table("stockMovements").toArray().catch(() => []);
    const inwardQty: Map<string, { qty: number; totalCost: number }> = new Map();
    
    for (const mov of stockMovements) {
      if (mov.date > options.toDate) continue;
      const item = inwardQty.get(mov.itemId) || { qty: 0, totalCost: 0 };
      const qty = Number(mov.qty || 0);
      const rate = Number(mov.rate || 0);
      const movType = String(mov.type || "").toLowerCase();
      
      if (movType.includes("in") || movType.includes("purchase") || movType.includes("opening")) {
        item.qty += qty;
        item.totalCost += qty * rate;
      } else if (movType.includes("out") || movType.includes("sale") || movType.includes("transfer-out")) {
        item.qty -= qty;
        item.totalCost -= qty * rate;
      }
      inwardQty.set(mov.itemId, item);
    }
    
    // Use weighted average for closing stock value
    for (const [, data] of inwardQty) {
      if (data.qty > 0 && data.totalCost > 0) {
        closingStock += data.totalCost;
      }
    }
  }

  // Opening stock from previous period stock account
  let openingStock = 0;
  const stockAccounts = allAccounts.filter((a: any) => {
    const lname = (a.name || "").toLowerCase();
    return lname.includes("stock") && !a.isGroup && a.isActive;
  });
  for (const sa of stockAccounts) {
    const openBal = Number(sa.openingBalance || sa.openingBalanceDr || 0);
    openingStock += openBal;
  }

  // 6. Compute gross profit
  const tradingDebitTotal = purchaseSection.total + directExpSection.total + openingStock;
  const tradingCreditTotal = salesSection.total + directIncSection.total + closingStock;
  const grossProfit = tradingCreditTotal - tradingDebitTotal;

  // 7. Compute net profit
  const plDebitBase = grossProfit < 0 ? Math.abs(grossProfit) : 0;
  const plCreditBase = grossProfit > 0 ? grossProfit : 0;
  const plDebitTotal = plDebitBase + indirectExpSection.total;
  const plCreditTotal = plCreditBase + indirectIncSection.total;
  const netProfit = plCreditTotal - plDebitTotal;

  // 8. Calculate percentages if requested
  const revenueBase = salesSection.total + directIncSection.total;
  if (options.showPercentage && revenueBase > 0) {
    const addPct = (lines: PLAccountLine[]) => {
      lines.forEach((l) => {
        l.percentage = (l.absBalance / revenueBase) * 100;
      });
    };
    addPct(salesSection.lines);
    addPct(purchaseSection.lines);
    addPct(directExpSection.lines);
    addPct(directIncSection.lines);
    addPct(indirectExpSection.lines);
    addPct(indirectIncSection.lines);
  }

  // 9. Monthly data if needed
  let monthLabels: string[] | undefined;
  let monthlyData: MonthlyPLData[] | undefined;

  if (options.variant === "monthly-summary" || options.variant === "detailed-monthly") {
    const months = getMonthsInRange(options.fromDate, options.toDate);
    monthLabels = months.map((m) => m.label);
    monthlyData = [];

    for (const month of months) {
      const monthVouchers = allVouchers.filter(
        (v: any) =>
          v.status === "posted" &&
          v.date >= month.start &&
          v.date <= month.end
      );

      const monthBalMap: Map<string, { debit: number; credit: number }> = new Map();
      for (const v of monthVouchers) {
        for (const line of v.lines || []) {
          if (line.accountId) {
            const cur = monthBalMap.get(line.accountId) || { debit: 0, credit: 0 };
            monthBalMap.set(line.accountId, {
              debit: cur.debit + (line.debit || 0),
              credit: cur.credit + (line.credit || 0),
            });
          }
        }
      }

      const getMonthSection = (entries: BucketEntry[], sign: "credit" | "debit"): number => {
        return entries.reduce((sum, e) => {
          const bal = monthBalMap.get(e.accountId) || { debit: 0, credit: 0 };
          if (sign === "credit") return sum + (bal.credit - bal.debit);
          return sum + (bal.debit - bal.credit);
        }, 0);
      };

      const mSales = Math.max(0, getMonthSection(buckets["sales"], "credit"));
      const mDirectInc = Math.max(0, getMonthSection(buckets["direct-income"], "credit"));
      const mPurchase = Math.max(0, getMonthSection(buckets["purchase"], "debit"));
      const mDirectExp = Math.max(0, getMonthSection(buckets["direct-expense"], "debit"));
      const mIndirectInc = Math.max(0, getMonthSection(buckets["indirect-income"], "credit"));
      const mIndirectExp = Math.max(0, getMonthSection(buckets["indirect-expense"], "debit"));
      const mGross = mSales + mDirectInc + closingStock / months.length - (openingStock / months.length) - mPurchase - mDirectExp;
      const mNet = mGross + mIndirectInc - mIndirectExp;

      // Per-account breakdown for detailed monthly
      const accountBreakdown: Record<string, number> = {};
      if (options.variant === "detailed-monthly") {
        for (const acc of allAccounts) {
          const bal = monthBalMap.get(acc.id);
          if (bal && (bal.debit > 0 || bal.credit > 0)) {
            accountBreakdown[acc.id] = bal.credit - bal.debit;
          }
        }
      }

      monthlyData.push({
        monthLabel: month.label,
        monthIndex: month.idx,
        year: month.year,
        sales: mSales,
        directIncome: mDirectInc,
        openingStock: openingStock / months.length,
        purchases: mPurchase,
        directExpenses: mDirectExp,
        closingStock: closingStock / months.length,
        grossProfit: mGross,
        indirectIncome: mIndirectInc,
        indirectExpenses: mIndirectExp,
        netProfit: mNet,
        accountBreakdown,
      });
    }
  }

  return {
    openingStock,
    purchases: purchaseSection,
    directExpenses: directExpSection,
    closingStock,
    sales: salesSection,
    directIncome: directIncSection,
    grossProfit,
    grossProfitLabel: grossProfit >= 0 ? "Gross Profit" : "Gross Loss",
    indirectExpenses: indirectExpSection,
    indirectIncome: indirectIncSection,
    netProfit,
    netProfitLabel: netProfit >= 0 ? "Net Profit" : "Net Loss",
    tradingDebitTotal,
    tradingCreditTotal,
    plDebitTotal,
    plCreditTotal,
    grandDebitTotal: tradingDebitTotal + plDebitTotal,
    grandCreditTotal: tradingCreditTotal + plCreditTotal,
    revenueBase,
    monthLabels,
    monthlyData,
    fromDate: options.fromDate,
    toDate: options.toDate,
    options,
  };
}

// ─── Account Ledger ──────────────────────────────────────────────────────────

export async function getAccountLedger(
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<AccountLedgerData> {
  const db = getDB();
  const [allVouchers, allAccounts] = await Promise.all([
    db.table("vouchers").toArray().catch(() => []),
    db.table("accounts").toArray().catch(() => []),
  ]);

  const acc = allAccounts.find((a: any) => a.id === accountId);
  const accountName = acc?.name || accountId;

  // Opening balance = balance before fromDate
  const beforeVouchers = allVouchers.filter(
    (v: any) => v.status === "posted" && v.date < fromDate
  );
  let openingDebit = Number(acc?.openingBalanceDr || acc?.openingBalance || 0);
  let openingCredit = Number(acc?.openingBalanceCr || 0);

  for (const v of beforeVouchers) {
    for (const line of v.lines || []) {
      if (line.accountId === accountId) {
        openingDebit += Number(line.debit || 0);
        openingCredit += Number(line.credit || 0);
      }
    }
  }
  const openingBalance = openingCredit - openingDebit;

  // Period transactions
  const periodVouchers = allVouchers.filter(
    (v: any) =>
      v.status === "posted" &&
      v.date >= fromDate &&
      v.date <= toDate
  );

  const entries: AccountLedgerEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let runningBalance = openingBalance;

  const relevant = periodVouchers
    .flatMap((v: any) =>
      (v.lines || [])
        .filter((l: any) => l.accountId === accountId)
        .map((l: any) => ({
          ...l,
          date: v.date,
          voucherNo: v.voucherNo || v.number || "",
          voucherType: v.type || "",
          narration: l.narration || v.narration || "",
          voucherId: v.id,
          particulars: l.accountName || v.narration || v.type || "",
        }))
    )
    .sort((a: any, b: any) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const entry of relevant) {
    const dr = Number(entry.debit || 0);
    const cr = Number(entry.credit || 0);
    runningBalance += cr - dr;
    totalDebit += dr;
    totalCredit += cr;
    entries.push({
      id: entry.id || Math.random().toString(36).slice(2),
      date: entry.date,
      voucherNo: entry.voucherNo,
      voucherType: entry.voucherType,
      particulars: entry.particulars,
      narration: entry.narration,
      debit: dr,
      credit: cr,
      runningBalance,
      voucherId: entry.voucherId,
    });
  }

  return {
    accountId,
    accountName,
    openingBalance,
    closingBalance: runningBalance,
    entries,
    totalDebit,
    totalCredit,
  };
}

// ─── Export Utilities ────────────────────────────────────────────────────────

export function exportPLToExcel(pl: PLComputation, companyName: string) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];

  rows.push([`${companyName} — Profit & Loss Account`]);
  rows.push([`For the period: ${pl.fromDate} to ${pl.toDate}`]);
  rows.push([]);

  if (pl.options.variant === "horizontal") {
    rows.push(["DEBIT SIDE", "", "AMOUNT", "", "CREDIT SIDE", "", "AMOUNT"]);
    rows.push(["Opening Stock", "", pl.openingStock, "", "Sales", "", pl.sales.total]);
    
    for (const line of pl.purchases.lines) {
      rows.push([line.accountName, "", line.absBalance, "", "", "", ""]);
    }
    rows.push(["Total Purchases", "", pl.purchases.total, "", "", "", ""]);
    
    for (const line of pl.directExpenses.lines) {
      rows.push([line.accountName, "", line.absBalance, "", "", "", ""]);
    }
    rows.push(["Total Direct Expenses", "", pl.directExpenses.total, "", "Closing Stock", "", pl.closingStock]);
    
    if (pl.grossProfit >= 0) {
      rows.push(["", "", "", "", "Gross Profit c/d", "", pl.grossProfit]);
    } else {
      rows.push(["Gross Loss c/d", "", Math.abs(pl.grossProfit), "", "", "", ""]);
    }

    rows.push(["--- P&L Account ---", "", "", "", "--- P&L Account ---", "", ""]);
    
    if (pl.grossProfit < 0) {
      rows.push(["Gross Loss b/d", "", Math.abs(pl.grossProfit), "", "", "", ""]);
    } else {
      rows.push(["", "", "", "", "Gross Profit b/d", "", pl.grossProfit]);
    }

    for (const line of pl.indirectExpenses.lines) {
      rows.push([line.accountName, "", line.absBalance, "", "", "", ""]);
    }

    for (const line of pl.indirectIncome.lines) {
      rows.push(["", "", "", "", line.accountName, "", line.absBalance]);
    }

    if (pl.netProfit >= 0) {
      rows.push(["Net Profit", "", pl.netProfit, "", "", "", ""]);
    } else {
      rows.push(["", "", "", "", "Net Loss", "", Math.abs(pl.netProfit)]);
    }

    rows.push(["TOTAL", "", pl.grandDebitTotal, "", "TOTAL", "", pl.grandCreditTotal]);
  } else {
    // Vertical format
    rows.push(["PARTICULARS", "AMOUNT"]);
    rows.push(["Revenue from Operations (Sales)", pl.sales.total]);
    rows.push(["Add: Direct Income", pl.directIncome.total]);
    rows.push(["Total Revenue", pl.sales.total + pl.directIncome.total]);
    rows.push(["Less: Cost of Goods Sold"]);
    rows.push(["  Opening Stock", pl.openingStock]);
    rows.push(["  Add: Purchases", pl.purchases.total]);
    rows.push(["  Add: Direct Expenses", pl.directExpenses.total]);
    rows.push(["  Less: Closing Stock", -pl.closingStock]);
    rows.push(["= Gross Profit / (Gross Loss)", pl.grossProfit]);
    rows.push(["Add: Indirect Income", pl.indirectIncome.total]);
    rows.push(["Less: Indirect Expenses", -pl.indirectExpenses.total]);
    rows.push([pl.netProfitLabel, pl.netProfit]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "P&L");
  XLSX.writeFile(wb, `ProfitLoss_${pl.fromDate}_${pl.toDate}.xlsx`);
}

export function exportPLToCSV(pl: PLComputation) {
  const rows: string[] = [];
  rows.push("Account,Amount");
  rows.push(`Opening Stock,${pl.openingStock}`);
  
  for (const line of pl.purchases.lines) {
    rows.push(`${line.accountName},${line.absBalance}`);
  }
  for (const line of pl.directExpenses.lines) {
    rows.push(`${line.accountName},${line.absBalance}`);
  }
  rows.push(`Closing Stock,${pl.closingStock}`);
  for (const line of pl.sales.lines) {
    rows.push(`${line.accountName},${line.absBalance}`);
  }
  for (const line of pl.directIncome.lines) {
    rows.push(`${line.accountName},${line.absBalance}`);
  }
  for (const line of pl.indirectExpenses.lines) {
    rows.push(`${line.accountName},${line.absBalance}`);
  }
  for (const line of pl.indirectIncome.lines) {
    rows.push(`${line.accountName},${line.absBalance}`);
  }
  rows.push(`${pl.netProfitLabel},${pl.netProfit}`);

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ProfitLoss_${pl.fromDate}_${pl.toDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
