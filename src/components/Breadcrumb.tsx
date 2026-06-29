import React from "react";
import { useStore } from "../store/useStore";
import { Home, ChevronRight } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Chart of Accounts",
  parties: "Parties Directory",
  items: "Stock Book",
  "item-master": "Stock Book",
  "sales-invoice": "Sales Invoice",
  "purchase-invoice": "Purchase Invoice",
  "sales-return": "Sales Return",
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
  pos: "POS Billing",
  "pos-mode": "POS Mode",
  "day-book": "Day Book",
  ledger: "General Ledger",
  "ledger-report": "General Ledger",
  "party-statement": "Party Ledger Statement",
  vouchers: "Vouchers Register",
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit & Loss Statement",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow Statement",
  "stock-summary": "Stock Summary",
  "stock-book": "Stock Book",
  "aging-report": "Aging Report",
  "vat-reports": "VAT Reports",
  "gst-reports": "GST Reports",
  gstr1: "GSTR-1 Report",
  gstr2: "GSTR-2 Report",
  gstr3b: "GSTR-3B Report",
  "gst-summary": "GST Summary",
  "tds-report": "TDS Report",
  settings: "System Settings",
  "company-settings": "Company Settings",
  "fiscal-year": "Fiscal Year",
  users: "Users & Roles",
  budget: "Budget Master",
  budgets: "Budget Master",
  "audit-log": "Audit Log",
  "audit-logs": "Audit Logs",
  backup: "Backup & Restore",
  warehouses: "Warehouses",
  units: "Units of Measure",
  "cost-centers": "Cost Centers",
  "price-lists": "Price Lists",
  "item-groups": "Item Groups",
  "voucher-types": "Voucher Types",
  "sales-persons": "Sales Persons",
  "unit-conversion": "Unit Conversions",
  "standard-narration": "Standard Narrations",
  "bill-sundry": "Bill Sundries",
  "physical-stock": "Physical Stock",
  quotation: "Quotation",
  "outstanding-receivables": "Outstanding Receivables",
  "outstanding-payables": "Outstanding Payables",
  "interest-calculation": "Interest Calculation",
  "bank-reconciliation": "Bank Reconciliation",
  "auto-bank-reconciliation": "Auto Bank Reconciliation",
  "cheque-printing": "Cheque Printing",
  "cheque-register": "Cheque Register",
  "deposit-slip": "Deposit Slip",
  "payment-advice": "Payment Advice",
  "e-payments": "e-Payments",
  "pdc-summary": "PDC Summary",
  "banking-hub": "Banking Hub",
  "bank-statement-import": "Bank Statement Import",
  "overdue-bills-interest": "Overdue Bills Interest",
  "account-groups": "Account Groups",
  "f11-company-features": "F11 Company Features",
  "fixed-assets": "Fixed Assets",
  employees: "Employees",
  payroll: "Payroll",
  "payroll-reports": "Payroll Reports",
  "sales-register": "Sales Register",
  "purchase-register": "Purchase Register",
  billing: "Sales Invoice",
  "billing-invoice": "Billing & Invoice",
  "reports-hub": "Reports Hub",
  "configuration-hub": "Configuration Hub",
  "data-import-export": "Data Import / Export",
  "make-checker": "Maker-Checker Approval",
  "recurring-vouchers": "Recurring Vouchers",
  "party-reconciliation": "Party Reconciliation",
  "credit-limit-manager": "Credit Limit Manager",
  "batch-management": "Batch Management",
  "serial-tracking": "Serial Number Tracking",
  "bom-production": "BOM & Production",
  "stock-categories": "Stock Categories",
  "price-history": "Price History & Rates",
  "ratio-analysis": "Ratio Analysis",
  "statistics-report": "Statistics Report",
  "exception-reports": "Exception Reports",
  "advanced-tax-compliance": "Advanced Tax Compliance",
  "cost-center-report": "Cost Center Report",
  "funds-flow": "Funds Flow Statement",
  "sales-order-outstanding": "Sales Order Outstanding",
  "purchase-order-outstanding": "Purchase Order Outstanding",
  "debtors-aging": "Debtors Aging",
  "creditors-aging": "Creditors Aging",
  "bulk-updations": "Bulk Updations",
  "year-end-process": "Year End Process",
  "communication-hub": "Communication Hub",
  "opening-balance": "Opening Balance",
  gateway: "Gateway",
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
    <nav
      className="flex items-center gap-0 select-none"
      aria-label="Breadcrumb"
    >
      <button
        type="button"
        onClick={() => setCurrentPage("dashboard")}
        className="text-gray-500 hover:text-gray-800 transition-colors flex items-center"
      >
        <Home className="h-3.5 w-3.5" />
      </button>

      {currentPage !== "dashboard" && (
        <ChevronRight className="h-3 w-3 text-gray-400 mx-1" />
      )}

      {breadcrumbs.map((b, idx) => {
        if (idx === 0) return null;
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 1 && (
              <ChevronRight className="h-3 w-3 text-gray-400 mx-1" />
            )}
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
