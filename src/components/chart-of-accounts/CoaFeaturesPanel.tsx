import React from "react";
import type { FeatureConfig } from "./types";

export interface CoaFeaturesPanelProps {
  features: FeatureConfig;
  onChange: (next: FeatureConfig, meta: { key: keyof FeatureConfig; label: string; enabled: boolean }) => void;
  onBack: () => void;
}

export const CoaFeaturesPanel: React.FC<CoaFeaturesPanelProps> = ({ features, onChange, onBack }) => (
<div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-gray-800">Features / Options â€” Accounts Tab</h2>
        <button
          onClick={() => onBack()}
          className="h-7 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50"
        >
          â† Back
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {[
          {
            key: "multiCurrency",
            label: "Multi Currency",
            desc: "Enable foreign currency transactions, exchange rates.",
          },
          {
            key: "subLedgers",
            label: "Maintain Sub Ledgers",
            desc: "Create child accounts under a parent General Ledger.",
          },
          {
            key: "billByBill",
            label: "Bill-by-Bill Details",
            desc: "Track outstanding invoices individually. Enables AR/AP aging.",
          },
          {
            key: "autoRefSales",
            label: "â†³ Auto Create References in Sales",
            desc: "Auto-create bill reference on saving sales voucher.",
            indent: true,
          },
          {
            key: "autoRefPurchase",
            label: "â†³ Auto Create References in Purchase",
            desc: "Auto-create bill reference on saving purchase voucher.",
            indent: true,
          },
          {
            key: "bankInstruments",
            label: "Maintain Bank Instrument Details",
            desc: "Track cheque/DD/NEFT/UPI details in vouchers.",
          },
          {
            key: "ledgerReconciliation",
            label: "Ledger Reconciliation",
            desc: "Enable bank statement reconciliation.",
          },
          {
            key: "salesman",
            label: "Salesman / Broker Wise Reporting",
            desc: "Track sales by salesman. Enables commission calculation.",
          },
          {
            key: "costCenter",
            label: "Cost Center",
            desc: "Enable cost/profit center tracking in vouchers.",
          },
          {
            key: "budgeting",
            label: "Budgeting",
            desc: "Set budgets per account/group. Budget vs Actual reports.",
          },
          {
            key: "interestCalculation",
            label: "Interest Calculation",
            desc: "Auto-calculate interest on overdue party balances.",
          },
          {
            key: "tds",
            label: "TDS (Tax Deducted at Source)",
            desc: "TDS sections, rates, thresholds. Auto-deduct TDS in payments.",
          },
          {
            key: "tcs",
            label: "TCS (Tax Collected at Source)",
            desc: "Tax collection at source on sales.",
          },
          {
            key: "branchDivision",
            label: "Maintain Branch / Division",
            desc: "Multi-branch accounting. Branch-wise P&L and Balance Sheet.",
          },
          {
            key: "multiGodown",
            label: "Maintain Multiple Godowns",
            desc: "Multi-location inventory tracking.",
          },
        ].map(({ key, label, desc, indent }) => (
          <div
            key={key}
            className={`p-3 rounded border transition-colors ${features[key as keyof FeatureConfig] ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"} ${indent ? "ml-6" : ""}`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={features[key as keyof FeatureConfig] || false}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const updated = { ...features, [key]: enabled };
                  onChange(updated, { key: key as keyof FeatureConfig, label, enabled });
                }}
                className="h-4 w-4 mt-0.5 rounded accent-[var(--ds-action-primary)] shrink-0"
              />
              <div>
                <span className="text-[12px] font-semibold text-gray-800 block">{label}</span>
                <span className="text-[12px] text-gray-500">{desc}</span>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
);
