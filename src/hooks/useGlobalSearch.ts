import { useState, useEffect, useMemo } from "react";

interface SearchResults {
  accounts: Array<{ id: number; name: string; code: string; balance: number }>;
  parties: Array<{ id: number; name: string; type: string; balance: number }>;
  vouchers: Array<{ id: number; voucherNo: string; type: string; narration: string }>;
  invoices: Array<{ id: number; invoiceNo: string; partyName: string; date: string }>;
  items: Array<{ id: number; name: string; code: string }>;
  pages: Array<{ name: string; path: string }>;
}

const PAGES = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Chart of Accounts", path: "/chart-of-accounts" },
  { name: "Parties", path: "/parties" },
  { name: "Items", path: "/items" },
  { name: "Warehouses", path: "/warehouses" },
  { name: "Units", path: "/units" },
  { name: "Bank Accounts", path: "/bank-accounts" },
  { name: "Sales Invoice", path: "/sales-invoice" },
  { name: "Purchase Invoice", path: "/purchase-invoice" },
  { name: "Payment Voucher", path: "/payment-voucher" },
  { name: "Receipt Voucher", path: "/receipt-voucher" },
  { name: "Journal Voucher", path: "/journal-voucher" },
  { name: "Contra Voucher", path: "/contra-voucher" },
  { name: "Trial Balance", path: "/trial-balance" },
  { name: "Profit & Loss", path: "/profit-loss" },
  { name: "Balance Sheet", path: "/balance-sheet" },
  { name: "Ledger Report", path: "/ledger" },
  { name: "Day Book", path: "/day-book" },
  { name: "Cash Book", path: "/cash-book" },
  { name: "Bank Book", path: "/bank-book" },
  { name: "Sales Register", path: "/sales-register" },
  { name: "Purchase Register", path: "/purchase-register" },
  { name: "Stock Summary", path: "/stock-summary" },
  { name: "Stock Movement", path: "/stock-movement" },
  { name: "Aging Analysis", path: "/aging-analysis" },
  { name: "GST/VAT Report", path: "/gst-report" },
  { name: "TDS Report", path: "/tds-report" },
  { name: "TDS Payment", path: "/tds-payment" },
  { name: "Bank Reconciliation", path: "/bank-reconciliation" },
  { name: "Cost Centers", path: "/cost-centers" },
  { name: "Cost Center Report", path: "/cost-center-report" },
  { name: "Budget vs Actual", path: "/budget-actual" },
  { name: "Opening Balance", path: "/opening-balance" },
  { name: "Fiscal Year", path: "/fiscal-year" },
  { name: "Company Settings", path: "/settings" },
];

export const useGlobalSearch = (query: string) => {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    accounts: [],
    parties: [],
    vouchers: [],
    invoices: [],
    items: [],
    pages: [],
  });

  // Mock data - in real app, this would come from your store/API
  const mockAccounts = useMemo(
    () => [
      { id: 1, name: "Cash in Hand", code: "1001", balance: 50000 },
      { id: 2, name: "Bank Account - HDFC", code: "1002", balance: 250000 },
      { id: 3, name: "Sales Account", code: "4001", balance: 500000 },
      { id: 4, name: "Purchase Account", code: "5001", balance: 300000 },
      { id: 5, name: "Salary Expenses", code: "6001", balance: 100000 },
    ],
    [],
  );

  const mockParties = useMemo(
    () => [
      { id: 1, name: "ABC Suppliers", type: "Vendor", balance: 45000 },
      { id: 2, name: "XYZ Customers Ltd", type: "Customer", balance: -25000 },
      { id: 3, name: "Global Traders", type: "Vendor", balance: 80000 },
      { id: 4, name: "Tech Solutions Inc", type: "Customer", balance: -60000 },
    ],
    [],
  );

  const mockVouchers = useMemo(
    () => [
      { id: 1, voucherNo: "PAY/001", type: "Payment", narration: "Paid to supplier for goods" },
      { id: 2, voucherNo: "REC/001", type: "Receipt", narration: "Received from customer" },
      { id: 3, voucherNo: "JV/001", type: "Journal", narration: "Salary accrual entry" },
    ],
    [],
  );

  const mockInvoices = useMemo(
    () => [
      { id: 1, invoiceNo: "INV-001", partyName: "XYZ Customers Ltd", date: "15 Baisakh 2083" },
      { id: 2, invoiceNo: "INV-002", partyName: "Tech Solutions Inc", date: "20 Baisakh 2083" },
    ],
    [],
  );

  const mockItems = useMemo(
    () => [
      { id: 1, name: "Laptop Dell Inspiron", code: "ITEM001" },
      { id: 2, name: "Office Chair", code: "ITEM002" },
      { id: 3, name: "Printer HP LaserJet", code: "ITEM003" },
    ],
    [],
  );

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({
        accounts: [],
        parties: [],
        vouchers: [],
        invoices: [],
        items: [],
        pages: [],
      });
      return;
    }

    setIsSearching(true);

    // Simulate async search with timeout
    const timer = setTimeout(() => {
      const lowerQuery = query.toLowerCase();

      const filteredAccounts = mockAccounts
        .filter(
          (acc) =>
            acc.name.toLowerCase().includes(lowerQuery) ||
            acc.code.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 5);

      const filteredParties = mockParties
        .filter(
          (party) =>
            party.name.toLowerCase().includes(lowerQuery) ||
            party.type.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 5);

      const filteredVouchers = mockVouchers
        .filter(
          (voucher) =>
            voucher.voucherNo.toLowerCase().includes(lowerQuery) ||
            voucher.narration.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 5);

      const filteredInvoices = mockInvoices
        .filter(
          (invoice) =>
            invoice.invoiceNo.toLowerCase().includes(lowerQuery) ||
            invoice.partyName.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 5);

      const filteredItems = mockItems
        .filter(
          (item) =>
            item.name.toLowerCase().includes(lowerQuery) ||
            item.code.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 5);

      const filteredPages = PAGES.filter(
        (page) =>
          page.name.toLowerCase().includes(lowerQuery) ||
          page.path.toLowerCase().includes(lowerQuery),
      ).slice(0, 5);

      setResults({
        accounts: filteredAccounts,
        parties: filteredParties,
        vouchers: filteredVouchers,
        invoices: filteredInvoices,
        items: filteredItems,
        pages: filteredPages,
      });

      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [query, mockAccounts, mockParties, mockVouchers, mockInvoices, mockItems]);

  return { results, isSearching };
};
