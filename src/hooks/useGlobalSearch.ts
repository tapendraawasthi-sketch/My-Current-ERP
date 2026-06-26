// src/hooks/useGlobalSearch.ts
import { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";

interface SearchResults {
  accounts: any[];
  parties: any[];
  vouchers: any[];
  invoices: any[];
  items: any[];
  pages: Array<{ name: string; path: string }>;
}

const ALL_PAGES = [
  { name: "Dashboard", path: "dashboard" },
  { name: "Chart of Accounts", path: "accounts" },
  { name: "Parties Directory", path: "parties" },
  { name: "Stock Items", path: "items" },
  { name: "Sales Invoice", path: "billing" },
  { name: "Purchase Invoice", path: "purchase-register" },
  { name: "Receipt Voucher", path: "receipt" },
  { name: "Payment Voucher", path: "payment" },
  { name: "Journal Voucher", path: "journal" },
  { name: "Contra Voucher", path: "contra" },
  { name: "Trial Balance", path: "trial-balance" },
  { name: "Profit & Loss", path: "profit-loss" },
  { name: "Balance Sheet", path: "balance-sheet" },
  { name: "General Ledger", path: "ledger" },
  { name: "Day Book", path: "day-book" },
  { name: "Cash Book", path: "cash-book" },
  { name: "Bank Book", path: "bank-book" },
  { name: "Stock Summary", path: "stock-summary" },
  { name: "VAT Reports", path: "vat-reports" },
  { name: "TDS Report", path: "tds-report" },
  { name: "Aging Report", path: "aging-report" },
  { name: "Company Settings", path: "settings" },
  { name: "Users & Roles", path: "users" },
  { name: "Audit Log", path: "audit-log" },
  { name: "Backup & Restore", path: "backup" },
  { name: "Warehouses", path: "warehouses" },
  { name: "Units of Measure", path: "units" },
  { name: "Cost Centers", path: "cost-centers" },
];

export function useGlobalSearch(query: string): {
  results: SearchResults;
  isSearching: boolean;
} {
  const { accounts, parties, vouchers, invoices, items } = useStore();
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo<SearchResults>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      return { accounts: [], parties: [], vouchers: [], invoices: [], items: [], pages: [] };
    }

    const matchAccounts = accounts
      .filter(
        (a) =>
          !a.isGroup &&
          (a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
      )
      .slice(0, 5);

    const matchParties = parties
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.pan && p.pan.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q))
      )
      .slice(0, 5);

    const matchVouchers = vouchers
      .filter(
        (v) =>
          v.voucherNo.toLowerCase().includes(q) ||
          (v.narration && v.narration.toLowerCase().includes(q))
      )
      .slice(0, 5);

    const matchInvoices = invoices
      .filter(
        (inv) =>
          (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(q)) ||
          inv.partyName.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchItems = items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchPages = ALL_PAGES.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q)
    ).slice(0, 5);

    return {
      accounts: matchAccounts,
      parties: matchParties,
      vouchers: matchVouchers,
      invoices: matchInvoices,
      items: matchItems,
      pages: matchPages,
    };
  }, [query, accounts, parties, vouchers, invoices, items]);

  useEffect(() => {
    if (query.length >= 2) {
      setIsSearching(true);
      const t = setTimeout(() => setIsSearching(false), 150);
      return () => clearTimeout(t);
    }
    setIsSearching(false);
  }, [query]);

  return { results, isSearching };
}
