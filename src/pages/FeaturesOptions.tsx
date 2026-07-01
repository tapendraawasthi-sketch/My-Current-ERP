// src/pages/FeaturesOptions.tsx
// BUSY Administration → Configuration → Features / Options
// Complete toggle panel for all accounting features

import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Save, Info, AlertTriangle, Check } from "lucide-react";

interface Feature {
  id: string;
  label: string;
  description: string;
  category: string;
  hasSubOptions?: SubOption[];
  warningOnEnable?: string;
  warningOnDisable?: string;
}

interface SubOption {
  id: string;
  label: string;
  description: string;
  parentId: string;
}

const FEATURES: Feature[] = [
  // ── Accounts Features ────────────────────────────────────────────────────
  {
    id: "multiCurrency",
    label: "Multi Currency",
    description: "Enable foreign currency transactions. Adds currency master, exchange rate tracking, and forex gain/loss.",
    category: "Accounts",
    warningOnEnable: "Enabling multi-currency will add currency fields to party accounts and vouchers.",
  },
  {
    id: "subLedgers",
    label: "Maintain Sub Ledgers",
    description: "Enable sub-ledger feature. Allows creating child accounts under a parent General Ledger.",
    category: "Accounts",
    warningOnDisable: "Disabling will hide sub-ledger fields but data will be preserved.",
  },
  {
    id: "billByBill",
    label: "Bill-by-Bill Details",
    description: "Track outstanding invoices individually. During payment/receipt, allocate against specific bills. Enables AR/AP aging reports.",
    category: "Accounts",
    hasSubOptions: [
      { id: "autoRefSales", label: "Auto Create Party References in Sales", description: "Automatically creates bill reference when saving a sales voucher.", parentId: "billByBill" },
      { id: "autoRefPurchase", label: "Auto Create Party References in Purchase", description: "Automatically creates bill reference when saving a purchase voucher.", parentId: "billByBill" },
    ],
  },
  {
    id: "bankInstruments",
    label: "Maintain Bank Instrument Details",
    description: "Track cheque/DD/NEFT/UPI details in payment and receipt vouchers. Enables cheque printing and bank reconciliation.",
    category: "Accounts",
  },
  {
    id: "ledgerReconciliation",
    label: "Ledger Reconciliation",
    description: "Enable bank statement reconciliation. Mark transactions as cleared and reconcile with bank statements.",
    category: "Accounts",
  },
  {
    id: "salesmanTracking",
    label: "Salesman / Broker Wise Reporting",
    description: "Track sales by salesman or broker. Adds Salesman master. Enables commission calculation and salesman-wise sales reports.",
    category: "Accounts",
    hasSubOptions: [
      { id: "salesmanAtItem", label: "Salesman at Item Level", description: "Assign a salesman to each individual line item in an invoice.", parentId: "salesmanTracking" },
      { id: "commissionPercent", label: "Commission as Percentage", description: "Calculate commission as a percentage of sale value (vs. fixed amount).", parentId: "salesmanTracking" },
    ],
  },
  {
    id: "costCenter",
    label: "Cost Center / Profit Center",
    description: "Enable cost and profit center tracking. Adds Cost Center master. Transactions require cost center allocation. Enables cost-center-wise P&L.",
    category: "Accounts",
  },
  {
    id: "budgeting",
    label: "Budgeting",
    description: "Enable budget vs actual tracking. Set budgets per account/group. Budget variance reports become available.",
    category: "Accounts",
  },
  {
    id: "interestCalc",
    label: "Interest Calculation",
    description: "Auto-calculate interest on overdue party balances. Configure interest rate and compounding period.",
    category: "Accounts",
  },
  {
    id: "tds",
    label: "TDS (Tax Deducted at Source)",
    description: "Enable TDS features. Adds TDS section master, rates, thresholds. Party accounts get TDS applicable flag. Auto-deducts TDS in payment vouchers.",
    category: "Accounts",
  },
  {
    id: "tcs",
    label: "TCS (Tax Collected at Source)",
    description: "Enable TCS collection features. Similar to TDS but applies on collections from sales.",
    category: "Accounts",
  },
  {
    id: "branchDivision",
    label: "Maintain Branch / Division",
    description: "Multi-branch accounting. Adds Branch master. Vouchers get branch field. Enables branch-wise P&L and Balance Sheet.",
    category: "Accounts",
  },

  // ── Inventory Features ────────────────────────────────────────────────────
  {
    id: "multiGodown",
    label: "Multiple Godowns / Warehouses",
    description: "Track stock across multiple storage locations. Enables godown-wise stock reports and inter-godown transfers.",
    category: "Inventory",
  },
  {
    id: "batchTracking",
    label: "Batch / Lot Tracking",
    description: "Track inventory by batch numbers. Includes manufacturing date, expiry date. Enables FIFO/FEFO for batch selection.",
    category: "Inventory",
  },
  {
    id: "serialTracking",
    label: "Serial Number Tracking",
    description: "Track individual items by unique serial numbers. Useful for electronics, machinery, durables.",
    category: "Inventory",
  },
  {
    id: "bom",
    label: "Bill of Materials (BOM)",
    description: "Define product recipes/formulas. Enables production/manufacturing vouchers. Auto-consumes raw materials.",
    category: "Inventory",
  },
  {
    id: "alternateUnit",
    label: "Alternate Units of Measure",
    description: "Use multiple units for the same item (e.g., Box and Pieces). Enables unit conversion in transactions.",
    category: "Inventory",
  },
  {
    id: "priceCategories",
    label: "Price Categories",
    description: "Define multiple price lists (Wholesale, Retail, Export). Assign a price category to parties for automatic rate application.",
    category: "Inventory",
  },
  {
    id: "mrp",
    label: "MRP / Maximum Retail Price",
    description: "Track MRP for items. Warning if selling price exceeds MRP.",
    category: "Inventory",
  },
  {
    id: "expiryTracking",
    label: "Expiry Date Tracking",
    description: "Track item expiry dates. Alerts for near-expiry stock. FEFO (First Expired First Out) inventory management.",
    category: "Inventory",
  },

  // ── GST / Taxation ────────────────────────────────────────────────────────
  {
    id: "gst",
    label: "GST (Goods & Services Tax)",
    description: "Enable full GST computation. Auto-calculate CGST, SGST, IGST based on party state. Enables GST returns (GSTR-1, GSTR-3B).",
    category: "GST & Taxation",
  },
  {
    id: "eInvoice",
    label: "e-Invoice",
    description: "Generate e-Invoices as per GST portal. Auto-generates IRN (Invoice Reference Number) and QR code. Required for businesses above threshold.",
    category: "GST & Taxation",
  },
  {
    id: "eWayBill",
    label: "e-Way Bill",
    description: "Generate e-Way Bills for goods transport above Rs. 50,000. Auto-populates from invoice data.",
    category: "GST & Taxation",
  },
  {
    id: "gstReconciliation",
    label: "GST Reconciliation (GSTR-2A/2B)",
    description: "Reconcile purchase invoices with GSTR-2A/2B data from GST portal. Identify mismatches for ITC claim.",
    category: "GST & Taxation",
  },
  {
    id: "reverseCharge",
    label: "Reverse Charge Mechanism (RCM)",
    description: "Handle GST payable on purchases under reverse charge. Auto-calculate RCM on applicable purchases.",
    category: "GST & Taxation",
  },
  {
    id: "composition",
    label: "Composition Scheme",
    description: "Handle composition scheme taxpayers. Simplified GST at flat rates. Separate invoicing format.",
    category: "GST & Taxation",
  },

  // ── Print & Communication ─────────────────────────────────────────────────
  {
    id: "emailInvoice",
    label: "Email Invoice / Statement",
    description: "Send invoices, statements, reminders via email directly from the software.",
    category: "Communication",
  },
  {
    id: "smsAlerts",
    label: "SMS Alerts",
    description: "Send SMS for invoice confirmations, payment reminders, and outstanding alerts.",
    category: "Communication",
  },
  {
    id: "whatsappShare",
    label: "WhatsApp Share",
    description: "Share invoices and statements via WhatsApp directly from the software.",
    category: "Communication",
  },

  // ── Additional Features ───────────────────────────────────────────────────
  {
    id: "discountStructure",
    label: "Discount Structure",
    description: "Define tiered discount structures. Automatic discount application based on quantity, party, or item group.",
    category: "Sales & Purchase",
  },
  {
    id: "schemesOffers",
    label: "Schemes & Offers",
    description: "Configure buy-X-get-Y schemes, flat rate offers, percentage discounts during specific periods.",
    category: "Sales & Purchase",
  },
  {
    id: "salesOrders",
    label: "Sales Orders",
    description: "Track sales orders before invoicing. Pending order reports. Auto-convert orders to invoices.",
    category: "Sales & Purchase",
  },
  {
    id: "purchaseOrders",
    label: "Purchase Orders",
    description: "Track purchase orders. GRN against PO. Pending PO reports.",
    category: "Sales & Purchase",
  },
  {
    id: "deliveryChallan",
    label: "Delivery Challan",
    description: "Generate delivery challans before invoicing. Convert challans to invoices.",
    category: "Sales & Purchase",
  },
  {
    id: "posMode",
    label: "Point of Sale (POS) Mode",
    description: "Fast retail billing. Barcode scanning, cash drawer, thermal receipt printing. Touch-friendly interface.",
    category: "Sales & Purchase",
  },
  {
    id: "payroll",
    label: "Payroll Module",
    description: "Employee payroll management. Salary structure, attendance, PF/ESI/TDS calculations. Pay slips.",
    category: "HR & Payroll",
  },
  {
    id: "fixedAssets",
    label: "Fixed Asset Management",
    description: "Track fixed assets with depreciation schedules. SLM/WDV methods. Asset register reports.",
    category: "HR & Payroll",
  },
];

const CATEGORIES = [...new Set(FEATURES.map(f => f.category))];

const FeaturesOptions: React.FC = () => {
  const { companySettings, updateCompanySettings } = useStore() as any;
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [hasChanges, setHasChanges] = useState(false);

  // Load from companySettings
  useEffect(() => {
    const stored = companySettings?.features || {};
    const enabled = new Set<string>(Object.entries(stored).filter(([, v]) => v).map(([k]) => k));
    // Default enable some features
    if (!stored.hasOwnProperty("gst")) enabled.add("gst");
    if (!stored.hasOwnProperty("salesOrders")) enabled.add("salesOrders");
    if (!stored.hasOwnProperty("purchaseOrders")) enabled.add("purchaseOrders");
    if (!stored.hasOwnProperty("deliveryChallan")) enabled.add("deliveryChallan");
    if (!stored.hasOwnProperty("posMode")) enabled.add("posMode");
    if (!stored.hasOwnProperty("multiGodown")) enabled.add("multiGodown");
    if (!stored.hasOwnProperty("batchTracking")) enabled.add("batchTracking");
    setEnabledFeatures(enabled);
  }, [companySettings]);

  function toggle(featureId: string) {
    setEnabledFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
    setHasChanges(true);
  }

  async function handleSave() {
    const features: Record<string, boolean> = {};
    FEATURES.forEach(f => { features[f.id] = enabledFeatures.has(f.id); });
    FEATURES.forEach(f => {
      f.hasSubOptions?.forEach(sub => { features[sub.id] = enabledFeatures.has(sub.id); });
    });
    try {
      await updateCompanySettings({ features });
      toast.success("Features / Options saved successfully.");
      setHasChanges(false);
    } catch { toast.error("Failed to save features."); }
  }

  const categoryFeatures = FEATURES.filter(f => f.category === activeCategory);

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Features / Options</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Administration → Configuration → Features / Options — Enable or disable accounting modules
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`h-8 px-4 text-white text-[12px] font-medium rounded flex items-center gap-1.5 transition-colors ${hasChanges ? "bg-[#1557b0] hover:bg-[#0f4a96]" : "bg-gray-400 cursor-not-allowed"}`}
          disabled={!hasChanges}
        >
          <Save className="h-3.5 w-3.5" /> Save (F2)
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Category sidebar */}
        <div className="w-44 bg-white border-r border-gray-200 overflow-y-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`w-full text-left px-4 py-2.5 text-[12px] font-medium border-l-4 transition-colors ${
                activeCategory === cat
                  ? "border-[#1557b0] bg-blue-50 text-[#1557b0]"
                  : "border-transparent text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Features list */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f5f6fa]">
          <div className="max-w-3xl bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">{activeCategory}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {categoryFeatures.map(f => {
                const isEnabled = enabledFeatures.has(f.id);
                return (
                  <div key={f.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4">
                      <div className="pt-0.5">
                        <label className="relative flex cursor-pointer items-center rounded-full p-1" htmlFor={f.id} data-ripple-dark="true">
                          <input
                            id={f.id}
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggle(f.id)}
                            className="before:content[''] peer relative h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-blue-500 before:opacity-0 before:transition-opacity checked:border-[#1557b0] checked:bg-[#1557b0] checked:before:bg-[#1557b0] hover:before:opacity-10"
                          />
                          <span className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                            <Check className="h-3 w-3" />
                          </span>
                        </label>
                      </div>
                      <div className="flex-1">
                        <label htmlFor={f.id} className="text-[13px] font-bold text-gray-800 cursor-pointer select-none">
                          {f.label}
                        </label>
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                          {f.description}
                        </p>
                        
                        {(f.warningOnEnable || f.warningOnDisable) && (
                          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 px-2 py-1.5 rounded border border-amber-100">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              {isEnabled ? f.warningOnDisable : f.warningOnEnable}
                            </span>
                          </div>
                        )}
                        
                        {/* Sub-options */}
                        {isEnabled && f.hasSubOptions && f.hasSubOptions.length > 0 && (
                          <div className="mt-4 pl-6 border-l-2 border-gray-200 space-y-3">
                            {f.hasSubOptions.map(sub => (
                              <div key={sub.id} className="flex gap-3">
                                <div className="pt-0.5">
                                  <input
                                    id={sub.id}
                                    type="checkbox"
                                    checked={enabledFeatures.has(sub.id)}
                                    onChange={() => toggle(sub.id)}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={sub.id} className="text-[12px] font-semibold text-gray-700 cursor-pointer select-none">
                                    {sub.label}
                                  </label>
                                  <p className="text-[10px] text-gray-500 mt-0.5">
                                    {sub.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturesOptions;
