import { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";

export interface SearchResultItem {
  id: string;
  type: 'page' | 'party' | 'account' | 'item' | 'invoice' | 'voucher';
  label: string;
  subtitle: string;
  page: string;
  metadata?: any;
}

const PAGES = [
  { name: "Dashboard", path: "dashboard", keywords: "home main kpi" },
  { name: "Chart of Accounts", path: "accounts", keywords: "ledger coa list" },
  { name: "Parties Directory", path: "parties", keywords: "customers vendors suppliers" },
  { name: "Stock Book", path: "items", keywords: "inventory products items list" },
  { name: "Warehouses", path: "warehouses", keywords: "godowns locations" },
  { name: "Units of Measure", path: "units", keywords: "uom measurement" },
  { name: "Bank Accounts", path: "bank-accounts", keywords: "banks details" },
  { name: "Sales Invoice", path: "billing", keywords: "sales bill new" },
  { name: "Purchase Invoice", path: "billing", keywords: "purchase bill new" },
  { name: "Payment Voucher", path: "payment", keywords: "pay supplier" },
  { name: "Receipt Voucher", path: "receipt", keywords: "receive customer" },
  { name: "Journal Voucher", path: "journal", keywords: "jv manual entry" },
  { name: "Contra Voucher", path: "contra", keywords: "bank cash transfer" },
  { name: "Trial Balance", path: "trial-balance", keywords: "tb report" },
  { name: "Profit & Loss", path: "profit-loss", keywords: "pl income statement" },
  { name: "Balance Sheet", path: "balance-sheet", keywords: "bs statement financial" },
  { name: "Day Book", path: "day-book", keywords: "daily transactions" },
  { name: "Cash Book", path: "cash-book", keywords: "cash transactions" },
  { name: "Bank Book", path: "bank-book", keywords: "bank transactions" },
  { name: "Sales Register", path: "sales-register", keywords: "sales report" },
  { name: "Purchase Register", path: "purchase-register", keywords: "purchase report" },
  { name: "Inventory Report", path: "inventory-report", keywords: "stock report" },
  { name: "Aging Report", path: "aging-report", keywords: "receivables payables age" },
  { name: "System Settings", path: "settings", keywords: "configuration options" },
  { name: "CBMS Logs", path: "cbms-log", keywords: "ird sync logs" },
  { name: "Currency Master", path: "currencies", keywords: "forex rates nrb" },
];

export const useGlobalSearch = (query: string) => {
  const { parties, accounts, items, invoices, vouchers } = useStore();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(() => {
      const q = query.toLowerCase().trim();
      
      const isCommand = q.startsWith(">");
      const searchQuery = isCommand ? q.slice(1).trim() : q;
      
      let allItems: SearchResultItem[] = [];

      // 1. Pages (Commands or Navigation)
      PAGES.forEach(p => {
        if (p.name.toLowerCase().includes(searchQuery) || p.keywords.includes(searchQuery)) {
          allItems.push({
            id: `page-${p.path}-${p.name}`,
            type: 'page',
            label: p.name,
            subtitle: `Navigation > ${p.name}`,
            page: p.path
          });
        }
      });

      // If it's explicitly a command mode, we only return pages
      if (isCommand) {
        setResults(allItems);
        setIsSearching(false);
        return;
      }

      // 2. Parties
      parties.forEach(p => {
        if (p.name.toLowerCase().includes(searchQuery) || (p.phone && p.phone.includes(searchQuery))) {
          allItems.push({
            id: `party-${p.id}`,
            type: 'party',
            label: p.name,
            subtitle: `${p.type} • Bal: ${p.balance || 0}`,
            page: 'parties'
          });
        }
      });

      // 3. Accounts
      accounts.forEach(a => {
        if (a.name.toLowerCase().includes(searchQuery) || a.code.toLowerCase().includes(searchQuery)) {
          allItems.push({
            id: `account-${a.id}`,
            type: 'account',
            label: `${a.name} [${a.code}]`,
            subtitle: `${a.group || a.type} • Bal: ${a.balance || 0}`,
            page: 'accounts'
          });
        }
      });

      // 4. Items
      items.forEach(i => {
        if (i.name.toLowerCase().includes(searchQuery) || i.code?.toLowerCase().includes(searchQuery)) {
          allItems.push({
            id: `item-${i.id}`,
            type: 'item',
            label: `${i.name} [${i.code || ''}]`,
            subtitle: `Category: ${i.category || 'N/A'} • Price: ${i.salesPrice || 0}`,
            page: 'items'
          });
        }
      });

      // 5. Invoices
      invoices.forEach(inv => {
        if (inv.invoiceNo.toLowerCase().includes(searchQuery) || inv.partyName.toLowerCase().includes(searchQuery)) {
          allItems.push({
            id: `invoice-${inv.id}`,
            type: 'invoice',
            label: `Invoice: ${inv.invoiceNo}`,
            subtitle: `${inv.partyName} • ${inv.date} • Total: ${inv.grandTotal}`,
            page: 'billing'
          });
        }
      });

      // 6. Vouchers
      vouchers.forEach(v => {
        if (v.voucherNo.toLowerCase().includes(searchQuery) || (v.narration && v.narration.toLowerCase().includes(searchQuery))) {
          allItems.push({
            id: `voucher-${v.id}`,
            type: 'voucher',
            label: `Voucher: ${v.voucherNo}`,
            subtitle: `${v.type} • ${v.date} • Amt: ${Math.max(v.totalDebit, v.totalCredit)}`,
            page: v.type.toLowerCase().includes('receipt') ? 'receipt' : 
                  v.type.toLowerCase().includes('payment') ? 'payment' : 
                  v.type.toLowerCase().includes('contra') ? 'contra' : 'journal'
          });
        }
      });

      // Sort logic: Prefix matches go first, then by type
      allItems.sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aStarts = aLabel.startsWith(searchQuery);
        const bStarts = bLabel.startsWith(searchQuery);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0; // Maintain original order roughly (which is grouped by type implicitly)
      });

      setResults(allItems.slice(0, 20)); // Limit to top 20 results
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [query, parties, accounts, items, invoices, vouchers]);

  return { results, isSearching };
};
