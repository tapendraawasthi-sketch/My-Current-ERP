import React, { useMemo } from "react";
import Select from "./Select";
import { useStore } from "@/store/useStore";

interface CurrencySelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  onlyActive?: boolean;
}

const CurrencySelect: React.FC<CurrencySelectProps> = ({
  label = "Currency",
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Select currency",
  onlyActive = true,
}) => {
  const { currencies, getBaseCurrency } = useStore();

  const options = useMemo(() => {
    const filtered = onlyActive ? currencies.filter((c) => c.isActive) : currencies;
    return filtered.map((c) => ({
      value: c.code,
      label: `${c.code} - ${c.name} (${c.symbol})`,
    }));
  }, [currencies, onlyActive]);

  // Default to base currency if no value
  React.useEffect(() => {
    if (!value && currencies.length > 0) {
      const base = getBaseCurrency();
      if (base) {
        onChange(base.code);
      }
    }
  }, [value, currencies, getBaseCurrency, onChange]);

  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      searchable
    />
  );
};

export default CurrencySelect;
