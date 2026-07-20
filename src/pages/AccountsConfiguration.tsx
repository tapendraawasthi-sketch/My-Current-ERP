import React, { useState, useEffect } from "react";

const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full";
const labelCls = "text-[11px] font-medium text-gray-600 block mb-1";

const AccountsConfiguration: React.FC = () => {
  const [stockUpdation, setStockUpdation] = useState(
    () => localStorage.getItem("cfg_bs_stock_updation") ?? "Automatic (from stock ledger)",
  );
  const [decimalPlaces, setDecimalPlaces] = useState(() =>
    parseInt(localStorage.getItem("cfg_decimal_places") ?? "2", 10),
  );
  const [gstNature, setGstNature] = useState(
    () => localStorage.getItem("cfg_gst_nature_journal") ?? "Not Applicable",
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("cfg_bs_stock_updation", stockUpdation);
    localStorage.setItem("cfg_decimal_places", String(decimalPlaces));
    localStorage.setItem("cfg_gst_nature_journal", gstNature);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Accounts setup</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Features &amp; Options — Accounts Settings
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-xl">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Accounts Tab
          </h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Balance Sheet Stock Updation */}
          <div>
            <label className={labelCls}>Balance Sheet Stock Updation</label>
            <select
              className={inputCls}
              value={stockUpdation}
              onChange={(e) => setStockUpdation(e.target.value)}
            >
              <option value="Automatic (from stock ledger)">Automatic (from stock ledger)</option>
              <option value="Manually">Manually</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              When set to "Manually", you can override the Closing Stock value directly on the
              Balance Sheet.
            </p>
          </div>

          {/* Decimal Places */}
          <div>
            <label className={labelCls}>Decimal Places for Profit Reports</label>
            <input
              type="number"
              min={0}
              max={6}
              className={inputCls}
              value={decimalPlaces}
              onChange={(e) =>
                setDecimalPlaces(Math.min(6, Math.max(0, parseInt(e.target.value) || 0)))
              }
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Controls decimal precision in Balance Sheet and P&amp;L amounts (0–6).
            </p>
          </div>

          {/* GST Nature Default */}
          <div>
            <label className={labelCls}>GST Nature Default for Journal Entries</label>
            <select
              className={inputCls}
              value={gstNature}
              onChange={(e) => setGstNature(e.target.value)}
            >
              <option value="Not Applicable">Not Applicable</option>
              <option value="Taxable">Taxable</option>
              <option value="Exempt">Exempt</option>
            </select>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
            >
              Save Settings
            </button>
            {saved && (
              <span className="text-[12px] text-green-600 font-medium">✓ Saved successfully</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountsConfiguration;
