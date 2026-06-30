import React from "react";

interface Props {
  data: any;
  onChange: (data: any) => void;
  errors?: Record<string, string>;
}

const labelClass = "block text-[11px] font-medium text-gray-600 mb-1";
const fieldClass =
  "w-full h-8 px-2.5 text-[12px] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/30 focus:border-[#1557b0]";

const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div
    className="flex items-center justify-between py-3"
    style={{ borderBottom: "1px solid #f3f4f6" }}
  >
    <div>
      <p className="text-[12px] font-medium text-gray-700">{label}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
      style={{
        background: checked ? "#1557b0" : "#d1d5db",
      }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  </div>
);

export default function Step3AccountingSetup({ data, onChange, errors = {} }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-bold text-gray-800">Accounting Setup</h2>
        <p className="text-[12px] text-gray-500 mt-1">Configure your accounting preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Currency (read-only) */}
        <div>
          <label className={labelClass}>Currency</label>
          <input
            type="text"
            value="Rs. - Nepali Rupee (Rs.)"
            readOnly
            className={fieldClass}
            style={{
              background: "#f9fafb",
              border: "1px solid #d1d5db",
              color: "#6b7280",
              cursor: "not-allowed",
            }}
          />
        </div>

        {/* Date Format */}
        <div>
          <label className={labelClass}>
            Default Date Format <span className="text-red-600">*</span>
          </label>
          <select
            value={data.dateFormat || "BS"}
            onChange={(e) => onChange({ ...data, dateFormat: e.target.value })}
            className={fieldClass}
            style={{
              background: "#ffffff",
              border: `1px solid ${errors.dateFormat ? "#dc2626" : "#d1d5db"}`,
              color: "#111827",
            }}
          >
            <option value="BS">BS (Bikram Sambat)</option>
            <option value="AD">AD (Anno Domini)</option>
          </select>
          {errors.dateFormat && (
            <p className="mt-1 text-[11px] text-red-600">! {errors.dateFormat}</p>
          )}
        </div>
      </div>

      {/* Feature toggles */}
      <div
        className="rounded-md p-4"
        style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
      >
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Module Features
        </p>
        <ToggleRow
          label="Stock Management"
          description="Enable inventory tracking and stock journals"
          checked={!!data.enableStock}
          onChange={(v) => onChange({ ...data, enableStock: v })}
        />
        <ToggleRow
          label="Cost Center"
          description="Track expenses by department or project"
          checked={!!data.enableCostCenter}
          onChange={(v) => onChange({ ...data, enableCostCenter: v })}
        />
        <ToggleRow
          label="Bill-wise Tracking"
          description="Track receivables and payables by individual bill"
          checked={!!data.enableBillWise}
          onChange={(v) => onChange({ ...data, enableBillWise: v })}
        />
      </div>
    </div>
  );
}
