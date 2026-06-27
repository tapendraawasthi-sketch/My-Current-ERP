// @ts-nocheck
import React, { useState } from 'react';
import { Settings, Info, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface F11State {
  // ACCOUNTING
  enableChequeprinting: boolean;
  enableBillWise: boolean;
  enableCostCentres: boolean;
  enableBudgets: boolean;
  enableCreditLimits: boolean;
  enableInterestCalc: boolean;
  enableMultiCurrency: boolean;
  enableScenarios: boolean;
  // INVENTORY
  enableInventory: boolean;
  enableMultiGodown: boolean;
  enableMultiUOM: boolean;
  enableBatches: boolean;
  enableSerialNumbers: boolean;
  enableMfgJournal: boolean;
  enableReorderLevels: boolean;
  enableRejections: boolean;
  // ORDER PROCESSING
  enableSalesOrders: boolean;
  enablePurchaseOrders: boolean;
  enableJobWorkOrders: boolean;
  // GST/TAX
  enableGST: boolean;
  enableEWayBill: boolean;
  enableEInvoice: boolean;
  enableCompositionScheme: boolean;
  enableTDS: boolean;
  enableTCS: boolean;
  enableVAT: boolean;
  // PAYROLL
  enablePayroll: boolean;
  enablePF: boolean;
  enableESI: boolean;
  enableProfessionalTax: boolean;
  enableGratuity: boolean;
  // ADVANCED
  enableJobCosting: boolean;
  enablePOS: boolean;
  enableTallyAudit: boolean;
  enableConsolidation: boolean;
  enableBankReconciliation: boolean;
  enableEPayments: boolean;
}

const DEFAULT_F11: F11State = {
  enableChequeprinting: true, enableBillWise: true, enableCostCentres: true, enableBudgets: true,
  enableCreditLimits: false, enableInterestCalc: false, enableMultiCurrency: false, enableScenarios: false,
  enableInventory: true, enableMultiGodown: true, enableMultiUOM: true, enableBatches: false,
  enableSerialNumbers: false, enableMfgJournal: false, enableReorderLevels: false, enableRejections: false,
  enableSalesOrders: true, enablePurchaseOrders: true, enableJobWorkOrders: false,
  enableGST: true, enableEWayBill: true, enableEInvoice: false, enableCompositionScheme: false,
  enableTDS: true, enableTCS: false, enableVAT: false,
  enablePayroll: false, enablePF: false, enableESI: false, enableProfessionalTax: false, enableGratuity: false,
  enableJobCosting: false, enablePOS: false, enableTallyAudit: true, enableConsolidation: false,
  enableBankReconciliation: true, enableEPayments: false,
};

const F11CompanyFeatures = () => {
  const [features, setFeatures] = useState<F11State>(() => {
    try {
      const s = localStorage.getItem('f11_features');
      return s ? { ...DEFAULT_F11, ...JSON.parse(s) } : DEFAULT_F11;
    } catch {
      return DEFAULT_F11;
    }
  });
  const [activeSection, setActiveSection] = useState<string>('accounting');
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const toggle = (key: keyof F11State) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem('f11_features', JSON.stringify(features));
    setHasChanges(false);
    toast.success('F11 Features saved! Changes will take effect immediately.');
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all features to default settings?')) {
      setFeatures(DEFAULT_F11);
      setHasChanges(true);
      toast.success('Reset to default settings (Not saved yet)');
    }
  };

  const renderFeatureRow = (key: keyof F11State, label: string, description: string, impact?: string) => {
    const isActive = features[key];
    return (
      <div className="flex items-start justify-between py-3 border-b border-gray-100 gap-4 last:border-b-0 hover:bg-gray-50/50 transition-colors px-2 -mx-2 rounded">
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-gray-800 leading-tight">{label}</div>
          <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">{description}</div>
          {impact && isActive && (
            <div className="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded-sm mt-1.5">
              <Info size={10} />
              <span className="font-semibold tracking-wide uppercase">Active Impact:</span> {impact}
            </div>
          )}
        </div>
        <div className="flex rounded-md shadow-sm shrink-0">
          <button
            onClick={() => { if(!isActive) toggle(key); }}
            className={`px-3 py-1 text-[11px] font-bold border transition-colors rounded-l-md ${
              isActive
                ? 'bg-[#059669] text-white border-[#059669] z-10'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => { if(isActive) toggle(key); }}
            className={`px-3 py-1 text-[11px] font-bold border-y border-r transition-colors rounded-r-md -ml-px ${
              !isActive
                ? 'bg-[#dc2626] text-white border-[#dc2626] z-10'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            No
          </button>
        </div>
      </div>
    );
  };

  const sections = {
    accounting: { icon: "📒", label: "Accounting" },
    inventory: { icon: "📦", label: "Inventory" },
    orders: { icon: "📋", label: "Order Processing" },
    tax: { icon: "🏛", label: "GST & Taxation" },
    payroll: { icon: "👥", label: "Payroll" },
    advanced: { icon: "⚙", label: "Advanced" }
  };

  const enabledCount = Object.values(features).filter(Boolean).length;
  const totalCount = Object.keys(features).length;

  return (
    <div className="max-w-[850px] mx-auto p-5 font-sans">
      {/* Page Header */}
      <div className="bg-[#1e2433] px-5 py-4 rounded-t-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={20} className="text-white" />
          <h1 className="text-[15px] font-semibold text-white tracking-wide">F11 — Company Features</h1>
        </div>
        <p className="text-[11px] text-gray-300 ml-7 leading-relaxed max-w-2xl">
          Feature flags control which modules appear in the application. Disabling a feature hides ALL related menus, buttons, and fields system-wide instantly.
        </p>
      </div>
      
      {/* Has Changes Banner */}
      {hasChanges && (
        <div className="bg-amber-50 border-x border-b border-amber-200 px-5 py-2.5 flex justify-between items-center animate-pulse">
          <div className="flex items-center gap-2 text-[12px] font-medium text-amber-800">
            <AlertTriangle size={16} className="text-amber-600" />
            You have unsaved changes. Save before navigating away.
          </div>
          <button
            onClick={handleSave}
            className="h-7 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Save size={12} /> Save Now
          </button>
        </div>
      )}
      
      {/* Two Column Layout */}
      <div className={`flex bg-white border-x ${!hasChanges ? 'border-t' : ''} border-gray-200 min-h-[500px] shadow-sm`}>
        {/* Left Sidebar */}
        <div className="w-[200px] bg-gray-50 border-r border-gray-200 shrink-0">
          <div className="py-2">
            {Object.entries(sections).map(([key, { icon, label }]) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`w-full text-left px-4 py-3 flex items-center gap-2 transition-colors border-l-2 ${
                  activeSection === key 
                    ? 'bg-blue-50/50 border-[#1557b0] text-[#1557b0]' 
                    : 'border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base">{icon}</span>
                <span className="text-[12px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Right Content */}
        <div className="flex-1 p-6 h-[500px] overflow-y-auto">
          {activeSection === 'accounting' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                Accounting Features
              </div>
              <div className="flex flex-col">
                {renderFeatureRow('enableChequeprinting', 'Enable Cheque Printing', 'Enables cheque printing for payment vouchers with customizable cheque format.', 'Cheque Printing menu and print format visible in Payment voucher')}
                {renderFeatureRow('enableBillWise', 'Maintain Bill-wise Details', 'Tracks individual bills for debtors and creditors — enables Receivables/Payables ageing reports.', 'Bill-wise entry in Sales/Purchase vouchers; Ageing report active')}
                {renderFeatureRow('enableCostCentres', 'Maintain Cost Centres', 'Allocate transactions to departments, projects, or profit centres for detailed reporting.', 'Cost Centre field visible in all vouchers; Cost Centre reports active')}
                {renderFeatureRow('enableBudgets', 'Use Budgets and Controls', 'Set budget limits per ledger/cost centre and receive alerts when vouchers exceed budget.', 'Budget Master active; Budget vs Actual report visible')}
                {renderFeatureRow('enableCreditLimits', 'Enable Credit Limits', 'Set maximum credit allowed per party — blocks invoices exceeding the limit.', 'Credit limit field in Ledger Master; alerts on invoice entry')}
                {renderFeatureRow('enableInterestCalc', 'Enable Interest Calculation', 'Automatically computes interest on overdue receivables/payables.', 'Interest Calculation report and Interest Voucher visible')}
                {renderFeatureRow('enableMultiCurrency', 'Maintain Multiple Currencies', 'Record transactions in foreign currencies with automatic forex gain/loss computation.', 'Currency field visible in vouchers; Forex Gain/Loss report active')}
                {renderFeatureRow('enableScenarios', 'Use Scenario Management', 'Create what-if scenarios using Optional/Reversing journals without affecting actual books.', 'Optional and Reversing voucher types visible')}
              </div>
            </div>
          )}
          
          {activeSection === 'inventory' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                Inventory Features
              </div>
              <div className="flex flex-col">
                {renderFeatureRow('enableInventory', 'Enable Inventory Management', 'Tracks stock quantities — enables all inventory vouchers, reports, and item masters.', 'Inventory menu, stock vouchers, and item masters visible')}
                {renderFeatureRow('enableMultiGodown', 'Maintain Multiple Godowns/Warehouses', 'Track stock separately per location (warehouse, shop, site).', 'Godown field visible in inventory vouchers and stock reports')}
                {renderFeatureRow('enableMultiUOM', 'Use Multiple Units of Measure', 'Define primary and alternate units (e.g. BOX with 12 PCS) with conversion factors.', 'Alternate unit column visible in inventory vouchers')}
                {renderFeatureRow('enableBatches', 'Enable Batch/Lot Number Tracking', 'Track stock by batch number — includes expiry date management.', 'Batch column visible in purchase/sales vouchers and stock reports')}
                {renderFeatureRow('enableSerialNumbers', 'Enable Serial Number Tracking', 'Track unique serial numbers per individual item unit (e.g. electronics, machinery).', 'Serial number field visible in vouchers; Serial-wise report active')}
                {renderFeatureRow('enableMfgJournal', 'Enable Manufacturing Journal (BOM/Production)', 'Use Bill of Materials to assemble/manufacture finished goods from raw materials.', 'Manufacturing Journal and BOM master visible')}
                {renderFeatureRow('enableReorderLevels', 'Enable Reorder Levels', 'Set minimum stock levels and receive alerts when items fall below threshold.', 'Reorder level in Item Master; Reorder Alerts report active')}
                {renderFeatureRow('enableRejections', 'Use Rejection Vouchers', 'Record goods rejected and returned (Rejection In / Rejection Out vouchers).', 'Rejection In and Rejection Out voucher types visible')}
              </div>
            </div>
          )}
          
          {activeSection === 'orders' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                Order Processing Features
              </div>
              <div className="flex flex-col">
                {renderFeatureRow('enableSalesOrders', 'Enable Sales Orders', 'Record customer orders before raising invoices — track order fulfillment.', 'Sales Order voucher type and Outstanding Orders report visible')}
                {renderFeatureRow('enablePurchaseOrders', 'Enable Purchase Orders', 'Raise purchase orders to suppliers before recording bills.', 'Purchase Order voucher type and PO Outstanding report visible')}
                {renderFeatureRow('enableJobWorkOrders', 'Enable Job Work (In/Out) Orders', 'Manage outsourcing — send raw materials out for processing and receive finished goods.', 'Job Order voucher types visible')}
              </div>
            </div>
          )}
          
          {activeSection === 'tax' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                GST & Taxation Features
              </div>
              
              <div className="flex flex-col">
                {renderFeatureRow('enableGST', 'Enable GST', 'Activates all GST fields, GSTR reports (1, 3B, 2A/2B), HSN codes, and GST computation in vouchers.', 'GSTIN fields, HSN column, GST breakup in vouchers; GSTR-1, 3B reports visible')}
                
                {features.enableGST && (
                  <div className="bg-blue-50 border border-blue-100 rounded-md p-3 my-3 ml-2 text-[11px] text-blue-800 flex items-start gap-2 shadow-sm">
                    <Info size={14} className="shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <strong className="font-semibold">When GST is enabled:</strong> all Sales/Purchase invoices show CGST/SGST/IGST columns. Ledger masters get GSTIN field. Item masters get HSN/SAC field.
                    </div>
                  </div>
                )}
                
                {renderFeatureRow('enableEWayBill', 'Enable e-Way Bill Generation', 'Integrate with NIC portal to generate e-Way Bills for goods movement above ₹50,000.', 'e-Way Bill button visible on Sales Invoice; e-WB register report active')}
                {renderFeatureRow('enableEInvoice', 'Enable e-Invoice Generation', 'Integrate with IRP (via GSP) to generate IRN and signed QR code for B2B invoices.', 'e-Invoice button on Sales Invoice; IRN/QR printed on invoice PDF')}
                {renderFeatureRow('enableCompositionScheme', 'Enable Composition Scheme', 'For composition dealers — generates CMP-08 instead of GSTR-1/3B.', 'CMP-08 report replaces GSTR-1 and GSTR-3B')}
                {renderFeatureRow('enableTDS', 'Enable TDS (Tax Deducted at Source)', 'Activates TDS deduction in payment/expense vouchers and TDS return reports.', 'TDS Nature of Payment master; TDS computation in vouchers; Form 26Q/27Q visible')}
                {renderFeatureRow('enableTCS', 'Enable TCS (Tax Collected at Source)', 'Activates TCS collection in sales vouchers.', 'TCS field in Sales Invoice; Form 27EQ report active')}
                {renderFeatureRow('enableVAT', 'Enable VAT', 'For petroleum products or states with pre-GST VAT regime.', 'VAT rate field in items; VAT return report visible')}
              </div>
            </div>
          )}
          
          {activeSection === 'payroll' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                Payroll Features
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-[11px] text-amber-800 flex items-start gap-2 shadow-sm">
                <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  Enabling individual components (PF, ESI etc.) requires Payroll to be enabled first.
                </div>
              </div>
              
              <div className="flex flex-col">
                {renderFeatureRow('enablePayroll', 'Enable Payroll', 'Complete employee payroll management — salary processing, pay slips, and statutory compliance.', 'Payroll menu, Employee Master, Payroll vouchers, and Pay Slip report visible')}
                {renderFeatureRow('enablePF', 'Enable Provident Fund (PF)', 'Compute Employee and Employer PF contributions with PF challan generation.', 'PF components in pay heads; PF Challan report visible')}
                {renderFeatureRow('enableESI', 'Enable ESI (Employee State Insurance)', 'Compute ESI contributions for eligible employees.', 'ESI components in pay heads; ESI Challan report visible')}
                {renderFeatureRow('enableProfessionalTax', 'Enable Professional Tax', 'Deduct Professional Tax as per state slabs.', 'PT slab in Employee Master; PT deduction in payroll vouchers')}
                {renderFeatureRow('enableGratuity', 'Enable Gratuity Computation', 'Track gratuity eligibility and compute gratuity payable.', 'Gratuity report and computation tool visible')}
              </div>
            </div>
          )}
          
          {activeSection === 'advanced' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                Advanced Features
              </div>
              
              <div className="flex flex-col">
                {renderFeatureRow('enableJobCosting', 'Enable Job Costing', 'Assign costs and revenues to specific projects/jobs for profitability analysis.', 'Job Cost Centre Master; Job P&L report visible')}
                {renderFeatureRow('enablePOS', 'Enable Point of Sale (POS)', 'Simplified cash billing interface for retail counter sales.', 'POS mode accessible from main menu')}
                {renderFeatureRow('enableTallyAudit', 'Enable Tally Audit', 'Maintain immutable log of every voucher creation, alteration, and deletion with user and timestamp.', 'Audit Trail report visible; all voucher changes logged permanently')}
                {renderFeatureRow('enableConsolidation', 'Enable Company Consolidation', 'Merge financial data from multiple companies into a consolidated balance sheet/P&L.', 'Consolidation wizard and Consolidated Balance Sheet visible')}
                {renderFeatureRow('enableBankReconciliation', 'Enable Bank Reconciliation', 'Reconcile bank statement with book entries — import bank CSV/OFX.', 'Bank Reconciliation, Bank Statement Import, Auto-Reconciliation visible')}
                {renderFeatureRow('enableEPayments', 'Enable E-Payments', 'Generate NEFT/RTGS/IMPS payment files for bulk bank uploads.', 'E-Payment menu; payment file generation for supported banks')}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Save Bar */}
      <div className="bg-[#f5f6fa] border border-t-0 border-gray-200 px-5 py-3 rounded-b-lg flex justify-between items-center shadow-sm">
        <div className="text-[11px] font-medium text-gray-600">
          <span className="font-bold text-gray-800">{enabledCount}</span> of {totalCount} features enabled
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <RefreshCw size={14} className="text-gray-500" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className="h-8 px-5 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Save size={14} />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default F11CompanyFeatures;
