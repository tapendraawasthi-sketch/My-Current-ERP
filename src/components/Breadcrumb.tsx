import React from "react";
import { useStore } from "../store/useStore";
import { Home, ChevronRight } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "financial-dashboard": "Financial Dashboard",
  accounts: "Chart of Accounts",
  "chart-of-accounts": "Chart of Accounts",
  parties: "Parties Directory",
  "party-master": "Parties Directory",
  "item-master": "Stock Book",
  items: "Stock Book",
  "stock-book": "Stock Book",
  billing: "Sales Invoice",
  "billing-invoice": "Billing & Invoice",
  sales: "Sales Voucher",
  "sales-return": "Sales Return",
  purchase: "Purchase Voucher",
  "purchase-return": "Purchase Return",
  receipt: "Receipt Voucher",
  payment: "Payment Voucher",
  journal: "Journal Voucher",
  contra: "Contra Voucher",
  "debit-note": "Debit Note",
  "credit-note": "Credit Note",
  "sales-order": "Sales Orders",
  "purchase-order": "Purchase Orders",
  "delivery-challan": "Delivery Challans",
  grn: "Goods Receipt Notes",
  "goods-receipt": "Goods Receipt Notes",
  "stock-transfer": "Stock Transfer",
  "physical-stock": "Physical Stock",
  quotation: "Quotation",
  "day-book": "Day Book",
  ledger: "General Ledger",
  "ledger-report": "General Ledger",
  "party-statement": "Party Statement",
  vouchers: "Vouchers Register",
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit & Loss Statement",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow Statement",
  "funds-flow": "Funds Flow Statement",
  "stock-summary": "Stock Summary",
  "aging-report": "Aging Report",
  "vat-reports": "VAT Reports",
  gstr1: "GSTR-1 Report",
  gstr2: "GSTR-2 Report",
  gstr3b: "GSTR-3B Report",
  "gst-summary": "GST Summary",
  settings: "System Settings",
  "company-settings": "Company Settings",
  "fiscal-year": "Fiscal Year",
  users: "Users & Roles",
  budget: "Budget Master",
  "audit-log": "Audit Log",
  "audit-logs": "Audit Logs",
  backup: "Backup & Restore",
  warehouses: "Warehouses",
  units: "Units of Measure",
  "unit-conversion": "Unit Conversions",
  "cost-centers": "Cost Centers",
  "price-lists": "Price Lists",
  "sales-persons": "Sales Persons",
  "standard-narration": "Standard Narrations",
  "bill-sundry": "Bill Sundries",
  "outstanding-receivables": "Outstanding Receivables",
  "outstanding-payables": "Outstanding Payables",
  "interest-calculation": "Interest Calculation",
  "pdc-summary": "PDC Summary",
  "pdc-management": "PDC Management",
  "batch-management": "Batch Management",
  "fixed-assets": "Fixed Assets",
  payroll: "Payroll",
  "salary-process": "Salary Process",
  "budget-vs-actual": "Budget vs Actual",
  "multi-currency": "Multi Currency",
  "cost-centre": "Cost Centre",
  "approval-workflow": "Approval Workflow",
  "statutory-compliance": "Statutory Compliance",
  "recurring-vouchers": "Recurring Vouchers",
  "ratio-analysis": "Ratio Analysis",
  "equity-statement": "Equity Statement",
  gateway: "Gateway",
  "pos-mode": "POS Mode",
};

const Breadcrumb: React.FC = () => {
  const { currentPage, setCurrentPage } = useStore();

  const getBreadcrumbs = () => {
    const list = [{ label: "Home", page: "dashboard" }];

    if (currentPage !== "dashboard") {
      const label =
        PAGE_TITLES[currentPage] ||
        currentPage
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      list.push({ label, page: currentPage });
    }

    return list;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav className="flex items-center gap-0 select-none" aria-label="Breadcrumb">
      <button
        type="button"
        onClick={() => setCurrentPage("dashboard")}
        className="text-gray-500 hover:text-gray-800 transition-colors flex items-center"
        aria-label="Go to Dashboard"
      >
        <Home className="h-3.5 w-3.5" />
      </button>

      {currentPage !== "dashboard" && <ChevronRight className="h-3 w-3 text-gray-400 mx-1" />}

      {breadcrumbs.map((b, idx) => {
        if (idx === 0) return null;
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 1 && <ChevronRight className="h-3 w-3 text-gray-400 mx-1" />}
            {isLast ? (
              <span className="text-[12px] font-medium text-gray-800 truncate max-w-[120px] md:max-w-xs">
                {b.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentPage(b.page)}
                className="text-[12px] text-gray-500 hover:text-gray-800 cursor-pointer transition-colors"
              >
                {b.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
