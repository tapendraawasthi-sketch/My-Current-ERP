/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useStore } from "../store/useStore";
import { BarChart2, Package, FileBarChart, TrendingUp, BookOpen } from "lucide-react";

const ReportHub: React.FC = () => {
  const { setCurrentPage } = useStore();

  const reportCategories = [
    { title: "Account Books", icon: BookOpen, color: "#1557b0", reports: [
      { label: "Day Book", page: "day-book", desc: "All transactions by date" },
      { label: "Cash Book", page: "cash-book", desc: "Cash receipts and payments" },
      { label: "Bank Book", page: "bank-book", desc: "Bank transactions" },
      { label: "General Ledger", page: "ledger", desc: "Account-wise ledger" },
      { label: "Party Ledger", page: "party-statement", desc: "Customer/Supplier statement" },
    ]},
    { title: "Financial Statements", icon: BarChart2, color: "#15803d", reports: [
      { label: "Trial Balance", page: "trial-balance", desc: "Debit/Credit balance summary" },
      { label: "Profit & Loss", page: "profit-loss", desc: "Income and expense statement" },
      { label: "Balance Sheet", page: "balance-sheet", desc: "Assets, liabilities & equity" },
      { label: "Cash Flow", page: "cash-flow", desc: "Cash inflow and outflow" },
    ]},
    { title: "Sales & Purchase", icon: TrendingUp, color: "#b45309", reports: [
      { label: "Sales Register", page: "sales-register", desc: "All sales transactions" },
      { label: "Purchase Register", page: "purchase-register", desc: "All purchase transactions" },
      { label: "Bill-wise Pending", page: "bill-pending", desc: "Outstanding bills" },
      { label: "Aging Report", page: "aging-report", desc: "Debtor/creditor aging" },
    ]},
    { title: "Inventory", icon: Package, color: "#7c3aed", reports: [
      { label: "Stock Summary", page: "stock-summary", desc: "Item-wise stock position" },
      { label: "Stock Book", page: "items", desc: "Detailed stock ledger" },
    ]},
    { title: "Tax Reports", icon: FileBarChart, color: "#dc2626", reports: [
      { label: "VAT Report", page: "vat-reports", desc: "Annex-A, B, C and VAT summary" },
      { label: "TDS Report", page: "tds-report", desc: "TDS deducted and payable" },
    ]},
  ];

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4 select-none">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000]">Reports Directory</h1>
          <p className="text-[11px] text-[#000000] mt-0.5">Categorized list of accounting reports and registers</p>
        </div>
      </div>

      {reportCategories.map(cat => (
        <div key={cat.title} className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "#f8faff" }}>
            <div className="h-6 w-6 rounded flex items-center justify-center" style={{ background: cat.color + "20" }}>
              <cat.icon className="h-3.5 w-3.5" style={{ color: cat.color }} />
            </div>
            <span className="text-[12px] font-bold text-[#000000]">{cat.title}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0">
            {cat.reports.map(r => (
              <button key={r.page} type="button" onClick={() => setCurrentPage(r.page)}
                className="flex flex-col items-start gap-0.5 p-3 text-left hover:bg-[#D4EABD] transition-colors border-r border-b cursor-pointer" style={{ borderColor: "var(--border)" }}>
                <span className="text-[12px] font-semibold text-[#000000]">{r.label}</span>
                <span className="text-[10px] text-[#000000] font-medium">{r.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReportHub;
