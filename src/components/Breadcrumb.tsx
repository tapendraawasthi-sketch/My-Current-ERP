import React, { useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Home, ChevronRight } from "lucide-react";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import { useNavCrumbStore, type NavCrumb } from "../routing/navCrumbStore";

export const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "financial-dashboard": "Financial Dashboard",
  accounts: "Chart of Accounts",
  "chart-of-accounts": "Chart of Accounts",
  parties: "Parties",
  "party-master": "Parties",
  "item-master": "Item Master",
  items: "Item Master",
  "stock-book": "Stock Book",
  billing: "Billing",
  "billing-invoice": "Billing",
  sales: "Sales Invoice",
  "sales-invoice": "Sales Invoice",
  "sales-return": "Sales Return",
  purchase: "Purchase Invoice",
  "purchase-invoice": "Purchase Invoice",
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
  settings: "System Settings",
  "company-settings": "Company Settings",
  "fiscal-year": "Fiscal Year",
  users: "Users & Roles",
  budget: "Budget Master",
  "audit-log": "Audit Log",
  backup: "Backup & Restore",
  warehouses: "Warehouses",
  units: "Units of Measure",
  "cost-centers": "Cost Centers",
  "price-lists": "Price Lists",
  "sales-persons": "Sales Persons",
  "standard-narration": "Standard Narrations",
  "bill-sundry": "Bill Sundries",
  "outstanding-receivables": "Outstanding Receivables",
  "outstanding-payables": "Outstanding Payables",
  "interest-calculation": "Interest Calculation",
  "fixed-assets": "Fixed Assets",
  payroll: "Payroll",
  "budget-vs-actual": "Budget vs Actual",
  "recurring-vouchers": "Recurring Vouchers",
  "ratio-analysis": "Ratio Analysis",
  "equity-statement": "Equity Statement",
  gateway: "Gateway",
  "pos-mode": "POS Mode",
  "pos-billing": "POS Billing",
  employees: "Employees",
  "employee-master": "Employees",
};

function pageLabel(page: string): string {
  return (
    PAGE_TITLES[page] ||
    page
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function resolveEntityLabel(
  pageId: string,
  entityId: string,
  parties: Array<{ id: string; name?: string }>,
  items: Array<{ id: string; name?: string }>,
  invoices: Array<{ id: string; invoiceNo?: string }>,
  vouchers: Array<{ id: string; voucherNo?: string }>,
): string {
  if (entityId === "new") {
    if (pageId.includes("party")) return "New party";
    if (pageId.includes("item") || pageId === "items") return "New item";
    if (pageId === "payment") return "New payment";
    if (pageId === "receipt") return "New receipt";
    if (pageId === "journal") return "New journal";
    if (pageId === "sales-order") return "New sales order";
    if (pageId === "purchase-order") return "New purchase order";
    if (pageId.includes("billing") || pageId.includes("sales") || pageId.includes("purchase")) {
      return "New invoice";
    }
    return "New";
  }
  if (pageId === "parties" || pageId === "party-master") {
    return parties.find((p) => p.id === entityId)?.name || entityId;
  }
  if (pageId === "items" || pageId === "item-master") {
    return items.find((i) => i.id === entityId)?.name || entityId;
  }
  if (
    pageId === "billing" ||
    pageId === "sales" ||
    pageId === "sales-invoice" ||
    pageId === "purchase-invoice" ||
    pageId === "sales-return" ||
    pageId === "purchase-return"
  ) {
    return invoices.find((i) => i.id === entityId)?.invoiceNo || entityId;
  }
  if (pageId === "payment" || pageId === "receipt" || pageId === "journal") {
    return vouchers.find((v) => v.id === entityId)?.voucherNo || entityId;
  }
  if (pageId === "sales-order" || pageId === "purchase-order") {
    return entityId; // session-local orders — id until list loads label
  }
  return entityId;
}

const Breadcrumb: React.FC = () => {
  const { currentPage, setCurrentPage, parties, items, invoices, vouchers } = useStore();
  const route = useAppRoute();
  const { go, clearEntity } = useNavigateApp();
  const stack = useNavCrumbStore((s) => s.stack);
  const reset = useNavCrumbStore((s) => s.reset);
  const popTo = useNavCrumbStore((s) => s.popTo);

  // Keep stack aligned with primary page when sidebar/palette changes page
  useEffect(() => {
    if (currentPage === "dashboard" || currentPage === "financial-dashboard") {
      reset([]);
      return;
    }
    const base: NavCrumb = { page: currentPage, label: pageLabel(currentPage) };
    const top = stack[0];
    if (!top || top.page !== currentPage || top.entityId) {
      // Preserve deeper drill crumbs only when they start with this page
      if (stack.length > 0 && stack[0]?.page === currentPage && !stack[0]?.entityId) {
        return;
      }
      reset([base]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on page change only
  }, [currentPage]);

  const crumbs = useMemo(() => {
    const list: NavCrumb[] = [{ page: "dashboard", label: "Home" }];

    if (stack.length > 0) {
      list.push(...stack);
    } else if (currentPage !== "dashboard" && currentPage !== "financial-dashboard") {
      list.push({ page: currentPage, label: pageLabel(currentPage) });
    }

    // Append entity segment from URL when not already represented
    if (route.entityId) {
      const label = resolveEntityLabel(
        route.pageId,
        route.entityId,
        parties ?? [],
        items ?? [],
        invoices ?? [],
        vouchers ?? [],
      );
      const last = list[list.length - 1];
      if (!last || last.entityId !== route.entityId) {
        list.push({ page: route.pageId, label, entityId: route.entityId });
      } else if (last.label !== label) {
        list[list.length - 1] = { ...last, label };
      }
    }

    return list;
  }, [stack, currentPage, route.pageId, route.entityId, parties, items, invoices, vouchers]);

  const handleCrumbClick = (crumb: NavCrumb, index: number) => {
    if (index === 0) {
      reset([]);
      setCurrentPage("dashboard");
      return;
    }
    // crumbs[0] is Home; stack items start at crumbs[1]
    const stackIndex = index - 1;
    if (stackIndex >= 0) popTo(stackIndex);

    if (crumb.entityId) {
      go(crumb.page, crumb.entityId);
      return;
    }
    // Page-level crumb: drop entity from URL if present
    if (route.entityId) {
      clearEntity(crumb.page);
    } else {
      setCurrentPage(crumb.page);
    }
  };

  return (
    <nav className="flex items-center gap-0 select-none min-w-0" aria-label="Breadcrumb">
      <button
        type="button"
        onClick={() => {
          reset([]);
          setCurrentPage("dashboard");
        }}
        className="text-gray-400 hover:text-gray-600 transition-colors flex items-center p-0.5 rounded hover:bg-gray-100 shrink-0"
        aria-label="Go to Dashboard"
      >
        <Home className="h-3.5 w-3.5" />
      </button>

      {crumbs.map((b, idx) => {
        if (idx === 0) return null;
        const isLast = idx === crumbs.length - 1;
        return (
          <React.Fragment key={`${b.page}-${b.entityId ?? ""}-${idx}`}>
            <ChevronRight className="h-3 w-3 text-gray-300 mx-1 shrink-0" />
            {isLast ? (
              <span className="text-[12px] font-semibold text-gray-700 truncate max-w-[160px] md:max-w-xs">
                {b.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleCrumbClick(b, idx)}
                className="text-[12px] text-gray-500 hover:text-[var(--ds-action-primary)] cursor-pointer transition-colors truncate max-w-[120px] md:max-w-[180px]"
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
