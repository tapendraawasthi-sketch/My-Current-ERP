// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus, VoucherType } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const VatReports: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("vat-reports");
  
  const { invoices, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"computation" | "sales" | "purchases">("computation");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [quarter, setQuarter] = useState<string>("custom");
  
  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingQuarter, setPendingQuarter] = useState(quarter);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setQuarter(pendingQuarter);
    setOptionsOpen(false);
  };

  // Compute VAT data
  const vatData = useMemo(() => {
    if (!invoices) return {
      outputSales: { taxable: 0, exempt: 0, vat: 0 },
      inputPurchases: { taxable: 0, vat: 0 },
      salesRegister: [],
      purchaseRegister: [],
      netVat: 0
    };

    // Filter invoices for the period
    const periodInvoices = invoices.filter(inv => 
      inv.date >= startDate && 
      inv.date <= endDate
    );

    // Output VAT (Sales)
    const salesInvoices = periodInvoices.filter(inv => 
      inv.type === "sales-invoice" || inv.type === "sales-return"
    );
    
    let totalTaxableSales = 0;
    let totalExemptSales = 0;
    let totalOutputVat = 0;

    salesInvoices.forEach(inv => {
      const multiplier = inv.type === "sales-return" ? -1 : 1;
      totalTaxableSales += (inv.taxableAmount || 0) * multiplier;
      totalExemptSales += (inv.exemptAmount || 0) * multiplier;
      totalOutputVat += (inv.vatAmount || 0) * multiplier;
    });

    // Input VAT (Purchases)
    const purchaseInvoices = periodInvoices.filter(inv => 
      inv.type === "purchase-invoice" || inv.type === "purchase-return"
    );
    
    let totalTaxablePurchases = 0;
    let totalInputVat = 0;

    purchaseInvoices.forEach(inv => {
      const multiplier = inv.type === "purchase-return" ? -1 : 1;
      totalTaxablePurchases += (inv.taxableAmount || 0) * multiplier;
      totalInputVat += (inv.vatAmount || 0) * multiplier;
    });

    // Net VAT
    const netVat = totalOutputVat - totalInputVat;

    // Sales Register
    const salesRegister = salesInvoices.map(inv => ({
      id: inv.id,
      date: inv.date,
      invoiceNo: inv.invoiceNo || inv.voucherNo || "—",
      partyName: inv.partyName || "—",
      taxableAmt: inv.taxableAmount || 0,
      exemptAmt: inv.exemptAmount || 0,
      vatAmt: inv.vatAmount || 0,
      grandTotal: inv.grandTotal || 0,
      isExempt: (inv.exemptAmount || 0) > 0
    }));

    // Add total row to sales register
    if (salesRegister.length > 0) {
      salesRegister.push({
        id: "total",
        date: "",
        invoiceNo: "TOTAL",
        partyName: "",
        taxableAmt: totalTaxableSales,
        exemptAmt: totalExemptSales,
        vatAmt: totalOutputVat,
        grandTotal: salesInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
        isExempt: false,
        isTotal: true
      });
    }

    // Purchase Register
    const purchaseRegister = purchaseInvoices.map(inv => ({
      id: inv.id,
      date: inv.date,
      invoiceNo: inv.invoiceNo || inv.voucherNo || "—",
      supplierName: inv.partyName || "—",
      billNo: inv.referenceNo || "—",
      taxableAmt: inv.taxableAmount || 0,
      vatAmt: inv.vatAmount || 0,
      eligibleITC: inv.vatAmount || 0, // Assume all ITC eligible for now
      grandTotal: inv.grandTotal || 0
    }));

    // Add total row to purchase register
    if (purchaseRegister.length > 0) {
      purchaseRegister.push({
        id: "total",
        date: "",
        invoiceNo: "TOTAL",
        supplierName: "",
        billNo: "",
        taxableAmt: totalTaxablePurchases,
        vatAmt: totalInputVat,
        eligibleITC: totalInputVat,
        grandTotal: purchaseInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
        isTotal: true
      });
    }

    return {
      outputSales: { taxable: totalTaxableSales, exempt: totalExemptSales, vat: totalOutputVat },
      inputPurchases: { taxable: totalTaxablePurchases, vat: totalInputVat },
      salesRegister,
      purchaseRegister,
      netVat
    };
  }, [invoices, startDate, endDate]);

  // Quarter options
  const quarterOptions = [
    { value: "custom", label: "Custom Dates" },
    { value: "q1", label: "Q1 (Shrawan-Ashwin)" },
    { value: "q2", label: "Q2 (Kartik-Poush)" },
    { value: "q3", label: "Q3 (Magh-Chaitra)" },
    { value: "q4", label: "Q4 (Baisakh-Ashadh)" }
  ];

  // Handle quarter change
  const handleQuarterChange = (q: string) => {
    setQuarter(q);
    if (q === "custom") return;
    
    // Simple year extraction from fiscal year
    const year = currentFiscalYear?.startDate?.split("-")[0] || new Date().getFullYear().toString();
    
    // Set dates based on quarter (simple implementation)
    if (q === "q1") {
      setStartDate(`${year}-04-01`);
      setEndDate(`${year}-06-30`);
    } else if (q === "q2") {
      setStartDate(`${year}-07-01`);
      setEndDate(`${year}-09-30`);
    } else if (q === "q3") {
      setStartDate(`${year}-10-01`);
      setEndDate(`${year}-12-31`);
    } else if (q === "q4") {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-03-31`);
    }
  };

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "invoiceNo") {
        return <span className="font-bold text-gray-800">TOTAL</span>;
      }
      if (["taxableAmt", "exemptAmt", "vatAmt", "eligibleITC", "grandTotal"].includes(columnKey)) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (["taxableAmt", "exemptAmt", "vatAmt", "eligibleITC", "grandTotal"].includes(columnKey)) {
      if (value === 0) return "—";
      
      let colorClass = "text-gray-700";
      // Highlight VAT amounts slightly
      if (["vatAmt", "eligibleITC"].includes(columnKey)) {
        colorClass = "text-[#1557b0] font-medium";
      }
      
      return <span className={`font-mono ${colorClass}`}>{formatNumber(value)}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="VAT Reports"
      subtitle="Tax registers and computation summary"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingQuarter(quarter);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Quarter: 
            <select 
              value={quarter} 
              onChange={e => handleQuarterChange(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {quarterOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          
          <div className="h-4 w-px bg-gray-300 mx-1"></div>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From: 
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
              disabled={quarter !== "custom"}
            />
          </label>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 ml-1">
            To: 
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
              disabled={quarter !== "custom"}
            />
          </label>
        </div>
      }
    >
      {/* Tab navigation */}
      <div className="flex gap-6 border-b border-gray-200 mb-6 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab("computation")}
          className={`pb-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "computation" 
              ? "border-[#1557b0] text-[#1557b0]" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          VAT Computation
        </button>
        <button 
          onClick={() => setActiveTab("sales")}
          className={`pb-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "sales" 
              ? "border-[#1557b0] text-[#1557b0]" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Sales VAT Register
        </button>
        <button 
          onClick={() => setActiveTab("purchases")}
          className={`pb-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "purchases" 
              ? "border-[#1557b0] text-[#1557b0]" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Purchase VAT Register
        </button>
      </div>

      {/* Active tab content */}
      {activeTab === "computation" && (
        <div className="space-y-6 max-w-3xl">
          {/* Output VAT Section */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center">
              <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[12px] mr-3">A</div>
              <h3 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">OUTPUT TAX (SALES)</h3>
            </div>
            <div className="px-5 py-3 flex justify-between border-b border-gray-100 text-[12px] text-gray-700 hover:bg-gray-50">
              <span>Taxable Sales Value</span>
              <span className="font-mono text-gray-900">Rs. {formatNumber(vatData.outputSales.taxable)}</span>
            </div>
            <div className="px-5 py-3 flex justify-between border-b border-gray-100 text-[12px] text-gray-700 hover:bg-gray-50">
              <span>Exempt Sales Value</span>
              <span className="font-mono text-gray-900">Rs. {formatNumber(vatData.outputSales.exempt)}</span>
            </div>
            <div className="px-5 py-3 flex justify-between bg-blue-50/30 text-[12px]">
              <span className="font-medium text-gray-800">VAT @13% (Output)</span>
              <span className="font-mono font-bold text-[#1557b0]">
                Rs. {formatNumber(vatData.outputSales.vat)}
              </span>
            </div>
          </div>

          {/* Input VAT Section */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center">
              <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[12px] mr-3">B</div>
              <h3 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">INPUT TAX CREDIT (PURCHASES)</h3>
            </div>
            <div className="px-5 py-3 flex justify-between border-b border-gray-100 text-[12px] text-gray-700 hover:bg-gray-50">
              <span>Taxable Purchase Value</span>
              <span className="font-mono text-gray-900">Rs. {formatNumber(vatData.inputPurchases.taxable)}</span>
            </div>
            <div className="px-5 py-3 flex justify-between bg-amber-50/30 text-[12px]">
              <span className="font-medium text-gray-800">ITC Available @13%</span>
              <span className="font-mono font-bold text-amber-600">
                Rs. {formatNumber(vatData.inputPurchases.vat)}
              </span>
            </div>
          </div>

          {/* Net VAT Section */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="bg-[#f5f6fa] border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-6 h-6 rounded bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-[12px] mr-3">C</div>
                <h3 className="text-[11px] font-semibold text-gray-800 uppercase tracking-wide">NET TAX PAYABLE (A - B)</h3>
              </div>
            </div>
            
            <div className="px-5 py-5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-gray-800">Net VAT Liability</span>
                {vatData.netVat >= 0 ? (
                  <span className="text-[11px] text-[#1557b0] mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Payable to tax authority
                  </span>
                ) : (
                  <span className="text-[11px] text-[#059669] mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Refundable/Carry forward
                  </span>
                )}
              </div>
              
              <div className={`text-2xl font-bold font-mono tracking-tight ${vatData.netVat >= 0 ? "text-[#1557b0]" : "text-[#059669]"}`}>
                Rs. {formatNumber(Math.abs(vatData.netVat))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sales" && (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
          <ReportGrid 
            columns={[
              { key: "date", label: "Date" },
              { key: "invoiceNo", label: "Invoice No" },
              { key: "partyName", label: "Party Name" },
              { key: "taxableAmt", label: "Taxable Amt", align: "right" },
              { key: "exemptAmt", label: "Exempt Amt", align: "right" },
              { key: "vatAmt", label: "VAT Amount", align: "right" },
              { key: "grandTotal", label: "Grand Total", align: "right" }
            ]} 
            data={vatData.salesRegister} 
            getRowClassName={(row) => row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""}
            renderCell={renderCell}
          />
        </div>
      )}

      {activeTab === "purchases" && (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
          <ReportGrid 
            columns={[
              { key: "date", label: "Date" },
              { key: "invoiceNo", label: "Invoice No" },
              { key: "supplierName", label: "Supplier Name" },
              { key: "billNo", label: "Bill No" },
              { key: "taxableAmt", label: "Taxable Amt", align: "right" },
              { key: "vatAmt", label: "VAT Amount", align: "right" },
              { key: "eligibleITC", label: "Eligible ITC", align: "right" },
              { key: "grandTotal", label: "Grand Total", align: "right" }
            ]} 
            data={vatData.purchaseRegister} 
            getRowClassName={(row) => row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""}
            renderCell={renderCell}
          />
        </div>
      )}
      
      <ReportOptionsModal
        open={optionsOpen}
        title="VAT Reports Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Quarter 
            <select 
              value={pendingQuarter} 
              onChange={e => setPendingQuarter(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {quarterOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date 
            <input 
              type="date" 
              value={pendingStart} 
              onChange={e => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
              disabled={pendingQuarter !== "custom"}
            />
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date 
            <input 
              type="date" 
              value={pendingEnd} 
              onChange={e => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
              disabled={pendingQuarter !== "custom"}
            />
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default VatReports;
