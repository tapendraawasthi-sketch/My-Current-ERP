import React, { useMemo } from "react";
import { useStore } from "../../store/useStore";
import toast from "@/lib/appToast";
import { Combobox, type ComboboxOption } from "@/design-system";

interface AccountSelectProps {
  value: string;
  onChange: (id: string, account?: any) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  /** Single account type filter (legacy consumer prop). */
  filterType?: string;
  /** Multiple account type filter (legacy consumer prop). */
  filterTypes?: string[];
  allowedTypes?: string[];
  allowedLevels?: string[];
  disabled?: boolean;
  className?: string;
}

/** Account picker on the design-system Combobox (IMPLEMENT_NOW §3.1 preset). */
const AccountSelect: React.FC<AccountSelectProps> = ({
  value,
  onChange,
  label,
  required = false,
  placeholder = "Select an account...",
  filterType,
  filterTypes,
  allowedTypes,
  allowedLevels,
  disabled = false,
  className = "",
}) => {
  const accounts = useStore((s) => s.accounts) as any[];

  const typeFilter = useMemo(() => {
    const set = new Set<string>();
    if (filterType) set.add(filterType);
    (filterTypes || []).forEach((t) => set.add(t));
    (allowedTypes || []).forEach((t) => set.add(t));
    return set;
  }, [filterType, filterTypes, allowedTypes]);

  const filtered = useMemo(
    () =>
      (accounts || []).filter((acc) => {
        const matchesType = typeFilter.size === 0 || typeFilter.has(acc.type);
        const matchesLevel = !allowedLevels || allowedLevels.includes(acc.level);
        return matchesType && matchesLevel;
      }),
    [accounts, typeFilter, allowedLevels],
  );

  const options = useMemo<ComboboxOption[]>(
    () =>
      filtered.map((acc) => ({
        value: acc.id,
        label: acc.code ? `${acc.code} | ${acc.name}` : acc.name,
        description: acc.alias ? `Alias: ${acc.alias}` : undefined,
      })),
    [filtered],
  );

  const control = (
    <Combobox
      className={className}
      aria-label={label || placeholder}
      options={options}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      emptyText="No accounts found"
      createNewLabel="+ Create New Account..."
      onCreateNew={() => toast.success("Please open Account Master to create a new account.")}
      onChange={(id) => {
        const account = filtered.find((a) => a.id === id);
        onChange(id, account);
      }}
    />
  );

  if (!label) return control;

  return (
    <div className="flex w-full flex-col gap-1">
      <label className="text-[11px] font-medium text-[var(--ds-text-muted)]">
        {label}
        {required ? <span className="ml-0.5 text-[var(--ds-status-danger)]">*</span> : null}
      </label>
      {control}
    </div>
  );
};

export default AccountSelect;
