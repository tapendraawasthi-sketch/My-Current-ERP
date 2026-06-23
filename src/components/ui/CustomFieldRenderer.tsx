import React from "react";
import { useStore } from "@/store/useStore";
import Input from "./Input";
import Select from "./Select";

interface Props {
  entityType: "party" | "item" | "invoice" | "voucher";
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
}

const CustomFieldRenderer: React.FC<Props> = ({ entityType, values, onChange }) => {
  const { customFieldDefs } = useStore();
  const fields = customFieldDefs
    .filter((f) => f.entity === entityType && f.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (fields.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-[10px] uppercase font-bold text-slate-400 mb-3">Custom Fields</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="text-xs font-medium text-slate-600">
              {f.label}
              {f.required && <span className="text-red-500">*</span>}
            </label>
            {f.fieldType === "text" && (
              <Input value={String(values[f.id] || "")} onChange={(v) => onChange(f.id, v)} />
            )}
            {f.fieldType === "number" && (
              <Input
                type="number"
                value={Number(values[f.id] || 0)}
                onChange={(v) => onChange(f.id, Number(v))}
              />
            )}
            {f.fieldType === "date" && (
              <Input
                type="date"
                value={String(values[f.id] || "")}
                onChange={(v) => onChange(f.id, v)}
              />
            )}
            {f.fieldType === "select" && (
              <Select
                value={String(values[f.id] || "")}
                onChange={(v) => onChange(f.id, v)}
                options={(f.options || []).map((o) => ({ value: o, label: o }))}
              />
            )}
            {f.fieldType === "checkbox" && (
              <input
                type="checkbox"
                checked={Boolean(values[f.id])}
                onChange={(e) => onChange(f.id, e.target.checked)}
                className="mt-1"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomFieldRenderer;
