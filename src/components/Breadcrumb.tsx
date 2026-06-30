import React from "react";
import { useStore } from "../store/useStore";
import { ChevronRight, Home } from "lucide-react";

// Fix BUG-003: All duplicate keys removed — each key appears exactly once.
const PAGE_TITLES: Record<string, { label: string; parent?: string }> = {
  // Dashboard
  "dashboard":                { label: "Dashboard" },
  // Accounting
  "accounts":                 { label: "Chart of Accounts",     parent: "Accounting" },
  "journal":                  { label: "Journal Voucher",        parent: "Accounting" },
  "payment":                  { label: "Payment Voucher",        parent: "Accounting" },
  "receipt":                  { label: "Receipt Voucher",        parent: "Accounting" },
  "contra":                   { label: "Contra Voucher",         parent: "Accounting" },
  "day-book":                 { label: "Day Book",               parent: "Reports" },
  "ledger":                   { label: "General Ledger",         parent: "Reports" },
  "trial-balance":            { label: "Trial Balance",          parent: "Reports" },
  "balance-sheet":            { label: "Balance Sheet",          parent: "Reports" },
  "profit-loss":              { label: "Profit & Loss",          parent: "Reports" },
  "cash-flow":                { label: "Cash Flow Statement",    parent: "Reports" },
  "aging-report":             { label: "Aging Report",           parent: "Reports" },
  "outstanding-receivables":  { label: "Outstanding Receivables", parent: "Reports" },
  "outstanding-payables":     { label: "Outstanding Payables",  parent: "Reports" },
  "interest-calculation":     { label: "Interest Calculation",  parent: "Reports" },
  "budget-vs-actual":         { label: "Budget vs Actual",      parent: "Reports" },
  // Inventory
  "items":                    { label: "Stock Items",            parent: "Inventory" },
  "stock-summary":            { label: "Stock Summary",          parent: "Inventory" },
  "stock-ledger":             { label: "Stock Ledger",           parent: "Inventory" },
  "stock-journal":            { label: "Stock Journal",          parent: "Inventory" },
  "physical-stock":           { label: "Physical Stock",         parent: "Inventory" },
  "godown-transfer":          { label: "Godown Transfer",        parent: "Inventory" },
  "stock-status":             { label: "Stock Status",           parent: "Reports" },
  // Billing / Sales
  "billing":                  { label: "Sales Invoice",          parent: "Billing" },
  "sales-register":           { label: "Sales Register",         parent: "Reports" },
  "sales-analysis":           { label: "Sales Analysis",         parent: "Reports" },
  "purchase-register":        { label: "Purchase Register",      parent: "Reports" },
  "delivery-challan":         { label: "Delivery Challan",       parent: "Billing" },
  "sales-order":              { label: "Sales Order",            parent: "Billing" },
  "purchase-order":           { label: "Purchase Order",         parent: "Billing" },
  "quotation":                { label: "Quotation",              parent: "Billing" },
  // GST / VAT
  "vat-reports":              { label: "VAT Reports",            parent: "Compliance" },
  "gst-reports":              { label: "GST Reports",            parent: "Compliance" },
  "tds-reports":              { label: "TDS Reports",            parent: "Compliance" },
  "cbms":                     { label: "CBMS / IRD",             parent: "Compliance" },
  // Masters
  "parties":                  { label: "Parties Directory",      parent: "Masters" },
  "warehouses":               { label: "Warehouses",             parent: "Masters" },
  "units":                    { label: "Units of Measure",       parent: "Masters" },
  "price-list":               { label: "Price Lists",            parent: "Masters" },
  "cost-centers":             { label: "Cost Centers",           parent: "Masters" },
  "bill-sundry":              { label: "Bill Sundry Master",     parent: "Masters" },
  "sale-type":                { label: "Sale Type Master",       parent: "Masters" },
  "purchase-type":            { label: "Purchase Type Master",   parent: "Masters" },
  "tax-category":             { label: "Tax Category Master",    parent: "Masters" },
  "voucher-type":             { label: "Voucher Type Master",    parent: "Masters" },
  "standard-narration":       { label: "Standard Narration",     parent: "Masters" },
  "misc-masters":             { label: "Misc Masters",           parent: "Masters" },
  "scheme-master":            { label: "Scheme Master",          parent: "Masters" },
  // POS
  "pos":                      { label: "POS Billing",            parent: "Sales" },
  // Settings
  "users":                    { label: "User Management",        parent: "Settings" },
  "company-settings":         { label: "Company Settings",       parent: "Settings" },
  "shortcuts":                { label: "Keyboard Shortcuts",     parent: "Settings" },
  "fiscal-years":             { label: "Fiscal Years",           parent: "Settings" },
  "audit-log":                { label: "Audit Log",              parent: "Settings" },
  "system-settings":          { label: "System Settings",        parent: "Settings" },
  "inventory-config":         { label: "Inventory Configuration", parent: "Settings" },
  // Finance
  "bank-reconciliation":      { label: "Bank Reconciliation",    parent: "Finance" },
  "fixed-assets":             { label: "Fixed Assets",           parent: "Finance" },
  "depreciation":             { label: "Depreciation",           parent: "Finance" },
  "budgets":                  { label: "Budgets",                parent: "Finance" },
  "payroll":                  { label: "Payroll",                parent: "Finance" },
  // Reports
  "nepal-reports":            { label: "Nepal Financial Statements", parent: "Reports" },
};

interface BreadcrumbItem {
  label: string;
  page?: string;
}

function getBreadcrumbs(currentPage: string): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ label: "Home", page: "dashboard" }];

  const entry = PAGE_TITLES[currentPage];
  if (!entry) {
    if (currentPage && currentPage !== "dashboard") {
      crumbs.push({ label: currentPage.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
    }
    return crumbs;
  }

  if (entry.parent) {
    crumbs.push({ label: entry.parent });
  }

  if (currentPage !== "dashboard") {
    crumbs.push({ label: entry.label, page: currentPage });
  }

  return crumbs;
}

const Breadcrumb: React.FC = () => {
  const { currentPage, setCurrentPage } = useStore();
  const crumbs = getBreadcrumbs(currentPage);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      className="flex items-center gap-1 text-[11px] text-gray-500 select-none"
      aria-label="Breadcrumb"
    >
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={`${crumb.label}-${idx}`}>
          {idx > 0 && (
            <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
          )}
          {idx === 0 ? (
            <button
              onClick={() => setCurrentPage("dashboard")}
              className="flex items-center gap-0.5 hover:text-[#1557b0] transition-colors"
              title="Go to Dashboard"
            >
              <Home className="h-3 w-3" />
            </button>
          ) : crumb.page && idx < crumbs.length - 1 ? (
            <button
              onClick={() => setCurrentPage(crumb.page!)}
              className="hover:text-[#1557b0] transition-colors hover:underline"
            >
              {crumb.label}
            </button>
          ) : (
            <span className={idx === crumbs.length - 1 ? "text-gray-800 font-medium" : ""}>
              {crumb.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
