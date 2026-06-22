import React from "react";

interface Props {
  data: any;
  onChange: (data: any) => void;
}

export default function Step3AccountingSetup({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Accounting Setup</h2>
        <p className="text-sm text-gray-600 mt-1">Configure your accounting preferences</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Currency</label>
          <input
            type="text"
            value="NPR - Nepali Rupee"
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 focus:outline-none w-full"
            disabled
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Default Date Format *
          </label>
          <select
            value={data.dateFormat}
            onChange={(e) => onChange({ ...data, dateFormat: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
          >
            <option value="BS">BS (Bikram Sambat)</option>
            <option value="AD">AD (Anno Domini)</option>
          </select>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Stock Management</label>
              <p className="text-xs text-gray-500">Enable inventory tracking and stock journals</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.enableStock}
                onChange={(e) => onChange({ ...data, enableStock: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1557b0]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Cost Center</label>
              <p className="text-xs text-gray-500">Track expenses by department or project</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.enableCostCenter}
                onChange={(e) => onChange({ ...data, enableCostCenter: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1557b0]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Bill-wise Tracking</label>
              <p className="text-xs text-gray-500">Track receivables and payables by bill</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.enableBillWise}
                onChange={(e) => onChange({ ...data, enableBillWise: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1557b0]"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
