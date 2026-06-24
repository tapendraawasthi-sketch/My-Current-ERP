/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useStore } from "../store/useStore";
import { Home, ChevronRight } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Chart of Accounts",
  parties: "Parties Directory",
  items: "Stock Book",
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
  "stock-journal": "Stock Journals",
  pos: "POS Billing",
  "day-book": "Day Book",
  "cash-book": "Cash Book",
  "bank-book": "Bank Book",
  ledger: "General Ledger",
  "party-statement": "Party Ledger Statement",
  vouchers: "Vouchers Register",
  "bank-reconciliation": "Bank Reconciliation",
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit & Loss Statement",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow Statement",
  "sales-register": "Sales Register",
  "purchase-register": "Purchase Register",
  "stock-summary": "Stock Summary",
  "inventory-report": "Inventory Report",
  "aging-report": "Aging Report",
  "bill-pending": "Bill-wise Pending",
  "vat-reports": "VAT Reports",
  "tds-report": "TDS Report",
  "cost-center-report": "Cost Center Report",
  "budget-vs-actual": "Budget vs Actual",
  settings: "System Settings",
  "fiscal-year": "Fiscal Year",
  users: "Users & Roles",
  budget: "Budget Master",
  "recurring-vouchers": "Recurring Vouchers",
  "audit-log": "Audit Log",
  backup: "Backup & Restore",
  warehouses: "Warehouses",
  units: "Units of Measure",
  "cost-centers": "Cost Centers",
  "bank-accounts": "Bank Accounts",
};

const Breadcrumb: React.FC = () => {
  const { currentPage, setCurrentPage } = useStore();

  const getBreadcrumbs = () => {
    const list = [{ label: "Home", page: "dashboard" }];

    if (currentPage !== "dashboard") {
      const label =
        PAGE_TITLES[currentPage] ||
        currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace("-", " ");
      list.push({ label, page: currentPage });
    }

    return list;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav className="flex items-center gap-0 select-none" aria-label="Breadcrumb">
      <button type="button" onClick={() => setCurrentPage("dashboard")} className="text-[#000000] hover:text-[#000000] transition-colors flex items-center"><Home className="h-3.5 w-3.5" /></button>
      {currentPage !== "dashboard" && <ChevronRight className="h-3 w-3 text-[#000000] mx-1" />}

      {breadcrumbs.map((b, idx) => {
        if (idx === 0) return null;
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 1 && <ChevronRight className="h-3 w-3 text-[#000000] mx-1" />}
            {isLast ? (
              <span className="text-[12px] font-medium text-[#000000] truncate max-w-[120px] md:max-w-xs">
                {b.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentPage(b.page)}
                className="text-[12px] text-[#000000] hover:text-[#000000] cursor-pointer transition-colors"
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
