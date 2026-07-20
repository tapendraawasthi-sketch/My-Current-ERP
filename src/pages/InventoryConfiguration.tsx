// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Settings, Save } from "lucide-react";
import toast from "@/lib/appToast";

const DEFAULT_CONFIG = {
  enableMultiGodown: false,
  enableBatches: false,
  enableSerials: false,
  enableBOM: false,
  enableProduction: false,
  enableSchemes: false,
  allowNegativeStock: false,
  stockValuationMethod: "FIFO" as const,
  defaultCostingMethod: "average" as const,
};

export default function InventoryConfiguration() {
  const store = useStore();
  const existing = (store as any).inventoryConfig || DEFAULT_CONFIG;

  const [cfg, setCfg] = useState({ ...DEFAULT_CONFIG, ...existing });

  useEffect(() => {
    if (store.loadItems) store.loadItems();
  }, []);

  const handleSave = async () => {
    try {
      if ((store as any).saveInventoryConfig) {
        await (store as any).saveInventoryConfig(cfg);
      } else {
        const { getDB } = await import("../lib/db");
        const db = getDB();
        await (db as any).table("inventoryConfig").put({ id: "global", ...cfg });
      }
      toast.success("Inventory configuration saved");
    } catch (e: any) {
      toast.error(e.message || "Error saving configuration");
    }
  };

  const toggle = (key: keyof typeof cfg) => setCfg((p) => ({ ...p, [key]: !p[key] }));

  const inp =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";

  const ToggleRow = ({
    label,
    desc,
    field,
  }: {
    label: string;
    desc: string;
    field: keyof typeof cfg;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <div className="text-[12px] font-medium text-gray-700">{label}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">{desc}</div>
      </div>
      <button
        onClick={() => toggle(field)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          cfg[field] ? "bg-[var(--ds-action-primary)]" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
            cfg[field] ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--ds-action-primary)]" />
            Inventory setup
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Configure inventory features and behavior
          </p>
        </div>
        <button
          onClick={handleSave}
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          Save Configuration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Feature Toggles */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Feature Toggles
          </h2>
          <ToggleRow
            label="Multi-Godown / Warehouse"
            desc="Enable tracking stock across multiple locations"
            field="enableMultiGodown"
          />
          <ToggleRow
            label="Batch Tracking"
            desc="Track items by batch / lot number"
            field="enableBatches"
          />
          <ToggleRow
            label="Serial Number Tracking"
            desc="Track individual items by serial number"
            field="enableSerials"
          />
          <ToggleRow
            label="Bill of Materials (BOM)"
            desc="Enable manufacturing BOMs and assemblies"
            field="enableBOM"
          />
          <ToggleRow
            label="Production Vouchers"
            desc="Enable production and assembly vouchers"
            field="enableProduction"
          />
          <ToggleRow
            label="Schemes & Offers"
            desc="Enable discount schemes and promotional offers"
            field="enableSchemes"
          />
          <ToggleRow
            label="Allow Negative Stock"
            desc="Allow stock to go below zero"
            field="allowNegativeStock"
          />
        </div>

        {/* Valuation Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Valuation Settings
          </h2>
          <div className="mb-4">
            <label className="text-[11px] font-medium text-gray-600 block mb-1">
              Stock Valuation Method
            </label>
            <select
              value={cfg.stockValuationMethod}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  stockValuationMethod: e.target.value as any,
                }))
              }
              className={`${inp} w-full`}
            >
              <option value="FIFO">FIFO (First In, First Out)</option>
              <option value="LIFO">LIFO (Last In, First Out)</option>
              <option value="average">Weighted Average</option>
              <option value="standard">Standard Cost</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">
              Default Costing Method
            </label>
            <select
              value={cfg.defaultCostingMethod}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  defaultCostingMethod: e.target.value as any,
                }))
              }
              className={`${inp} w-full`}
            >
              <option value="average">Average Cost</option>
              <option value="actual">Actual Cost</option>
              <option value="standard">Standard Cost</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
