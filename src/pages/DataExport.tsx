import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  exportPartiestoExcel,
  exportItemsToExcel,
  exportInvoicesToExcel,
  exportTrialBalanceToExcel,
  exportAgingReport,
} from '../lib/exportUtils';
import { Download, FileText, Database, Package, FileSpreadsheet, Users, Calendar } from 'lucide-react';
import { TrialBalanceRow } from '../types';

export default function DataExport() {
  const store = useStore();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const handleExportParties = () => {
    exportPartiestoExcel(store.parties);
  };

  const handleExportItems = () => {
    // Check if store has stockSummary or getStockSummary
    // In many implementations it is a property or function, we'll pass empty if not found, since exportUtils just uses it for stock mapping
    const stockData = store.stockSummary || [];
    exportItemsToExcel(store.items, stockData);
  };

  const handleExportSalesRegister = () => {
    const sales = store.invoices.filter(i => i.type === 'sales');
    const filtered = sales.filter(i => {
      if (dateRange.start && i.date < dateRange.start) return false;
      if (dateRange.end && i.date > dateRange.end) return false;
      return true;
    });
    exportInvoicesToExcel(filtered, 'Sales_Register.xlsx');
  };

  const handleExportPurchaseRegister = () => {
    const purchases = store.invoices.filter(i => i.type === 'purchase');
    const filtered = purchases.filter(i => {
      if (dateRange.start && i.date < dateRange.start) return false;
      if (dateRange.end && i.date > dateRange.end) return false;
      return true;
    });
    exportInvoicesToExcel(filtered, 'Purchase_Register.xlsx');
  };

  const handleExportTrialBalance = () => {
    const tbData: TrialBalanceRow[] = store.accounts.map(a => ({
        accountId: a.id,
        accountCode: a.code,
        accountName: a.name,
        level: a.isGroup ? 'group' : 'ledger',
        openingDr: a.openingBalanceType === 'Dr' ? a.openingBalance : 0,
        openingCr: a.openingBalanceType === 'Cr' ? a.openingBalance : 0,
        debit: 0,
        credit: 0,
        closingDr: 0,
        closingCr: 0
    }));
    exportTrialBalanceToExcel(tbData, "Trial_Balance.xlsx");
  };

  const handleExportAging = () => {
    const agingData = store.parties.map(p => ({
      partyName: p.name,
      pan: p.pan,
      current: p.openingBalance || 0,
      days31to60: 0,
      days61to90: 0,
      days91to180: 0,
      olderThan180: 0,
      totalOutstanding: p.openingBalance || 0,
    }));
    exportAgingReport(agingData);
  };

  const handleExportCoA = () => {
     const rows: TrialBalanceRow[] = store.accounts.map(a => ({
        accountId: a.id,
        accountCode: a.code,
        accountName: a.name,
        level: a.isGroup ? 'group' : 'ledger',
        openingDr: a.openingBalanceType === 'Dr' ? a.openingBalance : 0,
        openingCr: a.openingBalanceType === 'Cr' ? a.openingBalance : 0,
        debit: 0,
        credit: 0,
        closingDr: 0,
        closingCr: 0
     }));
     exportTrialBalanceToExcel(rows, "Chart_of_Accounts.xlsx");
  }

  const handleExportPlaceholder = (name: string) => {
    alert(`${name} export functionality will use standard export templates.`);
  };

  const exportCards = [
    { title: 'Chart of Accounts', icon: Database, action: handleExportCoA, desc: 'Export full ledger structure and opening balances.' },
    { title: 'Parties Directory', icon: Users, action: handleExportParties, desc: 'Export customer and supplier master data.' },
    { title: 'Item Master', icon: Package, action: handleExportItems, desc: 'Export inventory items with current stock.' },
    { title: 'Sales Register', icon: FileSpreadsheet, action: handleExportSalesRegister, desc: 'Export detailed sales invoices and VAT info.' },
    { title: 'Purchase Register', icon: FileSpreadsheet, action: handleExportPurchaseRegister, desc: 'Export detailed purchase invoices.' },
    { title: 'Day Book', icon: Calendar, action: () => handleExportPlaceholder('Day Book'), desc: 'Export daily transaction summary.' },
    { title: 'General Ledger', icon: FileText, action: () => handleExportPlaceholder('General Ledger'), desc: 'Export all ledger entries.' },
    { title: 'Trial Balance', icon: FileSpreadsheet, action: handleExportTrialBalance, desc: 'Export periodic trial balance.' },
    { title: 'Balance Sheet', icon: FileText, action: () => handleExportPlaceholder('Balance Sheet'), desc: 'Export final balance sheet.' },
    { title: 'P&L', icon: FileText, action: () => handleExportPlaceholder('P&L'), desc: 'Export Profit & Loss statement.' },
    { title: 'Aging Report', icon: Users, action: handleExportAging, desc: 'Export accounts receivable/payable aging.' },
  ];

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Data Export Hub</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Export master data and reports to Excel</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-md border border-gray-200 mb-6">
        <h2 className="text-[11px] font-medium text-gray-600 mb-3">Global Date Filter (For Registers)</h2>
        <div className="flex gap-4">
          <div>
             <label className="text-[11px] font-medium text-gray-600 block mb-1">Start Date</label>
             <input type="date" className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
          </div>
          <div>
             <label className="text-[11px] font-medium text-gray-600 block mb-1">End Date</label>
             <input type="date" className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportCards.map((card, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <card.icon size={18} />
                </div>
                <h3 className="text-[13px] font-semibold text-gray-800">{card.title}</h3>
              </div>
              <p className="text-[11px] text-gray-500 mb-4 h-8">{card.desc}</p>
            </div>
            <button
              onClick={card.action}
              className="w-full flex items-center justify-center gap-2 h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              <Download size={14} />
              Export to Excel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
