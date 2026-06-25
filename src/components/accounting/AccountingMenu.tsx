import React, { useState } from "react";
import { GeneralJournal } from "./GeneralJournal";
import { SalesInvoice } from "./SalesInvoice";
import { VendorBill } from "./VendorBill";
import { PaymentReceiptForm } from "./PaymentReceipt";
import { RepeatingInvoice } from "./RepeatingInvoice";
import { BankReconciliation } from "./BankReconciliation";
import { BatchPayment } from "./BatchPayment";
import { PeriodLockSettings } from "./PeriodLock";
import { AuditLog } from "./AuditLog";
import { useAccountingStore } from "@/store/accountingStore";

type MenuPage = "dashboard" | "journal" | "sales-invoice" | "vendor-bill" | "payment-receipt" | "repeating-invoice" | "bank-reconciliation" | "batch-payment" | "period-lock" | "audit-log";

const MENU_SECTIONS = [
  { title: "Journals", icon: "📔", items: [{ id: "journal" as MenuPage, label: "General Journal", icon: "✏️", desc: "Manual double-entry" }] },
  { title: "Accounts Receivable", icon: "📥", items: [
      { id: "sales-invoice" as MenuPage, label: "Sales Invoice", icon: "🧾", desc: "Create & post AR invoices" },
      { id: "repeating-invoice" as MenuPage, label: "Repeating Invoice", icon: "🔄", desc: "Automate recurring billing" },
      { id: "payment-receipt" as MenuPage, label: "Receipt / Payment", icon: "💰", desc: "Allocate customer payments" },
  ] },
  { title: "Accounts Payable", icon: "📤", items: [
      { id: "vendor-bill" as MenuPage, label: "Vendor Bill", icon: "📋", desc: "Enter & 3-way match bills" },
      { id: "batch-payment" as MenuPage, label: "Batch Payment", icon: "💳", desc: "Process multiple vendor payments" },
  ] },
  { title: "Banking", icon: "🏦", items: [{ id: "bank-reconciliation" as MenuPage, label: "Bank Reconciliation", icon: "🔗", desc: "Match statement to ledger" }] },
  { title: "System", icon: "⚙️", items: [
      { id: "period-lock" as MenuPage, label: "Period Lock", icon: "🔒", desc: "Control posting periods" },
      { id: "audit-log" as MenuPage, label: "Audit Log", icon: "📊", desc: "Full transaction trail" },
  ] },
];

export function AccountingMenu() {
  const [currentPage, setCurrentPage] = useState<MenuPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { auditLogs, currentUserName } = useAccountingStore();

  const renderPage = () => {
    switch (currentPage) {
      case "journal": return <GeneralJournal />;
      case "sales-invoice": return <SalesInvoice />;
      case "vendor-bill": return <VendorBill />;
      case "payment-receipt": return <PaymentReceiptForm />;
      case "repeating-invoice": return <RepeatingInvoice />;
      case "bank-reconciliation": return <BankReconciliation />;
      case "batch-payment": return <BatchPayment />;
      case "period-lock": return <PeriodLockSettings />;
      case "audit-log": return <AuditLog />;
      default: return <Dashboard setPage={setCurrentPage} />;
    }
  };

  const getPageTitle = () => {
    for (const section of MENU_SECTIONS) {
      const item = section.items.find((i) => i.id === currentPage);
      if (item) return item.label;
    }
    return "Dashboard";
  };

  return (
    <div className="flex h-screen bg-[#f5f6fa] font-sans">
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} bg-[#1e2433] border-r border-[#2d3748] flex flex-col transition-all duration-300 overflow-hidden text-white`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2d3748]">
          <div className="w-8 h-8 bg-[#1557b0] rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0">S</div>
          {sidebarOpen && <div><div className="text-[13px] font-bold text-gray-100">Sutra ERP</div><div className="text-[11px] text-gray-400">Accounting</div></div>}
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          <button onClick={() => setCurrentPage("dashboard")} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${currentPage === "dashboard" ? "bg-[#273148] text-white font-semibold border-r-2 border-[#1557b0]" : "text-gray-400 hover:bg-[#273148] hover:text-white"}`}>
            <span className="text-base flex-shrink-0">🏠</span>{sidebarOpen && <span className="text-[13px]">Dashboard</span>}
          </button>
          {MENU_SECTIONS.map((section) => (
            <div key={section.title}>
              {sidebarOpen && <div className="px-4 pt-4 pb-1"><span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{section.icon} {section.title}</span></div>}
              {!sidebarOpen && <div className="h-2" />}
              {section.items.map((item) => (
                <button key={item.id} onClick={() => setCurrentPage(item.id)} title={!sidebarOpen ? item.label : undefined} className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${currentPage === item.id ? "bg-[#273148] text-white font-semibold border-r-2 border-[#1557b0]" : "text-gray-400 hover:bg-[#273148] hover:text-white"}`}>
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  {sidebarOpen && <div className="text-left min-w-0"><div className="truncate text-[13px]">{item.label}</div></div>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-[#2d3748] p-3">
          {sidebarOpen && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-[#1557b0] rounded-full flex items-center justify-center text-white text-xs font-bold">{currentUserName.slice(0, 1)}</div>
              <div className="text-[12px] text-gray-300 truncate">{currentUserName}</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full text-[11px] text-gray-500 hover:text-gray-300 py-1">{sidebarOpen ? "← Collapse" : "→"}</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-gray-600">
            <span className="cursor-pointer hover:text-[#1557b0]" onClick={() => setCurrentPage("dashboard")}>Accounting</span>
            {currentPage !== "dashboard" && <><span className="text-gray-400">/</span><span className="text-gray-800 font-semibold">{getPageTitle()}</span></>}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-600 font-medium">
            <span className="bg-[#f5f6fa] border border-gray-200 px-2.5 py-1 rounded-sm">{new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
            <span className="bg-[#eef2ff] text-[#1557b0] border border-[#c7d2fe] px-2.5 py-1 rounded-sm font-semibold">{auditLogs.length} events logged</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{renderPage()}</main>
      </div>
    </div>
  );
}

function Dashboard({ setPage }: { setPage: (page: MenuPage) => void }) {
  const { journalEntries, invoices, payments, bankReconciliations, auditLogs } = useAccountingStore();

  const totalJournals = journalEntries.length;
  const postedJournals = journalEntries.filter((j) => j.status === "POSTED").length;
  const totalInvoices = invoices.length;
  const totalPayments = payments.length;

  const stats = [
    { label: "Total Journals", value: totalJournals, sub: `${postedJournals} posted`, icon: "📔", color: "bg-[#f5f6fa]", click: "journal" as MenuPage },
    { label: "Total Invoices", value: totalInvoices, sub: "AR + AP", icon: "🧾", color: "bg-[#f5f6fa]", click: "sales-invoice" as MenuPage },
    { label: "Payments", value: totalPayments, sub: "Receipts & payouts", icon: "💰", color: "bg-[#f5f6fa]", click: "payment-receipt" as MenuPage },
    { label: "Reconciliations", value: bankReconciliations.length, sub: "Bank matches", icon: "🔗", color: "bg-[#f5f6fa]", click: "bank-reconciliation" as MenuPage },
    { label: "Audit Events", value: auditLogs.length, sub: "Full trail", icon: "📊", color: "bg-[#f5f6fa]", click: "audit-log" as MenuPage },
  ];

  const quickActions = [
    { label: "New Journal Entry", icon: "✏️", page: "journal" as MenuPage },
    { label: "New Sales Invoice", icon: "🧾", page: "sales-invoice" as MenuPage },
    { label: "Enter Vendor Bill", icon: "📋", page: "vendor-bill" as MenuPage },
    { label: "Record Payment", icon: "💰", page: "payment-receipt" as MenuPage },
    { label: "Bank Reconciliation", icon: "🔗", page: "bank-reconciliation" as MenuPage },
    { label: "Batch Payments", icon: "💳", page: "batch-payment" as MenuPage },
  ];

  return (
    <div className="p-6 bg-[#f5f6fa] min-h-full">
      <div className="max-w-6xl mx-auto">
        <div className="bg-[#1e2433] rounded-sm p-6 mb-6 text-white border border-[#2d3748] shadow-sm">
          <h1 className="text-[18px] font-semibold mb-1">Accounting Transaction Center</h1>
          <p className="text-gray-400 text-[12px]">Enterprise-grade double-entry bookkeeping · AR · AP · Bank Reconciliation · Period Management</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {stats.map((stat) => (
            <button key={stat.label} onClick={() => setPage(stat.click)} className={`bg-white border border-gray-200 rounded-sm p-4 text-left hover:border-[#1557b0] transition-colors`}>
              <div className="text-xl mb-2">{stat.icon}</div>
              <div className="text-xl font-bold text-gray-800 font-mono">{stat.value}</div>
              <div className="text-[12px] font-semibold text-gray-700">{stat.label}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{stat.sub}</div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => setPage(action.page)} className="bg-white border border-gray-300 text-gray-700 hover:bg-[#f5f6fa] hover:border-[#1557b0] hover:text-[#1557b0] rounded-sm py-2.5 px-4 flex items-center gap-2 text-[12px] font-medium transition-colors">
                <span>{action.icon}</span><span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
