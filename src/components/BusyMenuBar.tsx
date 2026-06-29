// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../store";

interface MenuItem {
  label: string;
  page?: string;
  children?: MenuItem[];
  separator?: boolean;
}

// ─── Menu Tree ────────────────────────────────────────────────────────────────
// Restructured per Phase 3.4:
//   • "Masters" split into Accounts, Inventory, and Operations sub-groups
//   • "Transactions" split into Sales, Purchase, Inventory, and Finance
//   • "Reports" organised into Financial, Inventory, and Party sub-groups
//   • "Utilities" consolidated at the end
// ─────────────────────────────────────────────────────────────────────────────

const MENU_TREE: { title: string; items: MenuItem[] }[] = [
  // ── Company ────────────────────────────────────────────────────────────────
  {
    title: "Company",
    items: [
      { label: "Gateway / Home", page: "gateway" },
      { label: "Company Settings", page: "settings" },
      { label: "Fiscal Year", page: "fiscal-year" },
      { separator: true, label: "" },
      { label: "Backup / Restore", page: "backup" },
      { label: "Audit Log", page: "audit-log" },
    ],
  },

  // ── Masters ─────────────────────────────────────────────────────────────────
  {
    title: "Masters",
    items: [
      // Accounts group
      {
        label: "Accounts",
        children: [
          { label: "Chart of Accounts", page: "accounts" },
          { label: "Cost Centers", page: "cost-centers" },
          { label: "Budget Master", page: "budget" },
        ],
      },
      // Parties group
      {
        label: "Parties",
        children: [
          { label: "Parties Directory", page: "parties" },
          { label: "Sales Persons", page: "sales-persons" },
        ],
      },
      // Inventory group
      {
        label: "Inventory",
        children: [
          { label: "Stock Items", page: "item-master" },
          { label: "Warehouses", page: "warehouses" },
          { label: "Units of Measure", page: "units" },
          { label: "Unit Conversions", page: "unit-conversion" },
          { label: "Price Lists", page: "price-lists" },
        ],
      },
      // Operations group
      {
        label: "Operations",
        children: [
          { label: "Standard Narrations", page: "standard-narration" },
          { label: "Bill Sundries", page: "bill-sundry" },
        ],
      },
    ],
  },

  // ── Transactions ────────────────────────────────────────────────────────────
  {
    title: "Transactions",
    items: [
      // Sales
      {
        label: "Sales",
        children: [
          { label: "Sales Voucher", page: "sales" },
          { label: "Sales Return", page: "sales-return" },
          { label: "Delivery Challan", page: "delivery-challan" },
          { label: "Quotation / Estimate", page: "quotation" },
          { label: "Sales Order", page: "sales-order" },
        ],
      },
      // Purchase
      {
        label: "Purchase",
        children: [
          { label: "Purchase Voucher", page: "purchase" },
          { label: "Purchase Return", page: "purchase-return" },
          { label: "Goods Receipt Note", page: "goods-receipt" },
          { label: "Purchase Order", page: "purchase-order" },
        ],
      },
      // Inventory Movements
      {
        label: "Inventory",
        children: [
          { label: "Stock Transfer", page: "stock-transfer" },
          { label: "Stock Adjustment", page: "stock-adjustment" },
          { label: "Physical Stock", page: "physical-stock" },
        ],
      },
      // Finance / Accounts
      {
        label: "Finance",
        children: [
          { label: "Journal Voucher", page: "journal" },
          { label: "Payment Voucher", page: "payment" },
          { label: "Receipt Voucher", page: "receipt" },
          { label: "Contra Voucher", page: "contra" },
          { label: "Credit Note", page: "credit-note" },
          { label: "Debit Note", page: "debit-note" },
        ],
      },
    ],
  },

  // ── Reports ─────────────────────────────────────────────────────────────────
  {
    title: "Reports",
    items: [
      // Financial Reports
      {
        label: "Financial",
        children: [
          { label: "Balance Sheet", page: "balance-sheet" },
          { label: "Profit & Loss", page: "profit-loss" },
          { label: "Trial Balance", page: "trial-balance" },
          { label: "Cash Flow", page: "cash-flow" },
          { label: "Day Book", page: "day-book" },
          { label: "Ledger Report", page: "ledger-report" },
        ],
      },
      // Party Reports
      {
        label: "Party",
        children: [
          { label: "Outstanding Receivables", page: "outstanding-receivables" },
          { label: "Outstanding Payables", page: "outstanding-payables" },
          { label: "Aging Report", page: "aging-report" },
          { label: "Party Statement", page: "party-statement" },
          { label: "Interest Calculation", page: "interest-calculation" },
        ],
      },
      // Inventory Reports
      {
        label: "Inventory",
        children: [
          { label: "Stock Summary", page: "stock-summary" },
          { label: "Stock Movement", page: "stock-movement" },
          { label: "Reorder Level Report", page: "reorder-report" },
          { label: "Godown-wise Stock", page: "godown-stock" },
        ],
      },
      // GST Reports
      {
        label: "GST",
        children: [
          { label: "GSTR-1", page: "gstr1" },
          { label: "GSTR-2", page: "gstr2" },
          { label: "GSTR-3B", page: "gstr3b" },
          { label: "GST Summary", page: "gst-summary" },
        ],
      },
    ],
  },

  // ── Utilities ───────────────────────────────────────────────────────────────
  {
    title: "Utilities",
    items: [
      { label: "Import / Export", page: "import-export" },
      { label: "Data Cleanup", page: "data-cleanup" },
      { label: "User Management", page: "user-management" },
      { label: "Workflow Rules", page: "workflow" },
      { separator: true, label: "" },
      { label: "About / Licence", page: "about" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const BusyMenuBar: React.FC = () => {
  const { setCurrentPage } = useStore();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setOpenSub(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (page: string) => {
    setCurrentPage(page);
    setOpenMenu(null);
    setOpenSub(null);
    setTimeout(() => {
      const main = document.querySelector("main");
      if (main) {
        main.setAttribute("tabIndex", "-1");
        main.focus();
      }
    }, 0);
  };

  const toggleMenu = (idx: number) => {
    setOpenMenu((prev) => (prev === idx ? null : idx));
    setOpenSub(null);
  };

  const toggleSub = (label: string) => {
    setOpenSub((prev) => (prev === label ? null : label));
  };

  // Recursive item renderer
  const renderItems = (items: MenuItem[], depth = 0) =>
    items.map((item, i) => {
      if (item.separator) {
        return <div key={`sep-${i}`} className="my-1 border-t border-gray-200" />;
      }

      if (item.children && item.children.length > 0) {
        const isSubOpen = openSub === item.label;
        return (
          <div key={item.label} className="relative">
            <button
              onClick={() => toggleSub(item.label)}
              className={`w-full flex items-center justify-between px-4 py-2 text-[12px] text-left
                hover:bg-[#1557b0]/10 hover:text-[#1557b0] transition-colors
                ${depth > 0 ? "pl-6" : ""}
                ${isSubOpen ? "bg-[#1557b0]/10 text-[#1557b0]" : "text-gray-700"}
              `}
            >
              <span>{item.label}</span>
              <svg
                className={`w-3.5 h-3.5 ml-2 transition-transform ${isSubOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {isSubOpen && (
              <div className="bg-gray-50 border-l-2 border-[#1557b0]/20 ml-2">
                {renderItems(item.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // Leaf item
      return (
        <button
          key={item.label}
          onClick={() => item.page && navigate(item.page)}
          className={`w-full text-left px-4 py-2 text-[12px] text-gray-700
            hover:bg-[#1557b0]/10 hover:text-[#1557b0] transition-colors
            ${depth > 0 ? "pl-8" : ""}
          `}
        >
          {item.label}
        </button>
      );
    });

  return (
    <div
      ref={barRef}
      className="flex items-center bg-white border-b border-gray-200 shadow-sm select-none"
    >
      {MENU_TREE.map((section, idx) => {
        const isOpen = openMenu === idx;
        return (
          <div key={section.title} className="relative">
            {/* Top-level menu button */}
            <button
              onClick={() => toggleMenu(idx)}
              className={`px-4 py-2.5 text-[12px] font-medium transition-colors
                ${
                  isOpen
                    ? "bg-[#1557b0] text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-800"
                }
              `}
            >
              {section.title}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
              <div className="absolute left-0 top-full mt-0 w-56 bg-white border border-gray-200 rounded-b-lg shadow-lg z-50 py-1 max-h-[80vh] overflow-y-auto">
                {renderItems(section.items)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BusyMenuBar;
