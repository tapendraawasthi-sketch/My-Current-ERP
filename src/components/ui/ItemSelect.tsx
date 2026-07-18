/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { useStore } from "../../store/useStore";
import { computeStockPosition } from "../../lib/stockUtils";
import { Combobox, type ComboboxOption } from "@/design-system";

interface ItemSelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  id?: string;
}

/** Stock item picker on the design-system Combobox (IMPLEMENT_NOW §3.1 preset). */
const ItemSelect: React.FC<ItemSelectProps> = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  placeholder = "Select inventory stock item",
  id,
}) => {
  const items = useStore((state) => state.items) as any[];
  const stockMovements = useStore((state) => state.stockMovements);

  const activeItems = useMemo(() => (items || []).filter((i) => i.isActive), [items]);

  const stockPositions = useMemo(() => {
    const map = new Map<string, number>();
    activeItems.forEach((item) => {
      const pos = computeStockPosition(stockMovements, item.id, null);
      map.set(item.id, pos.qty);
    });
    return map;
  }, [activeItems, stockMovements]);

  const options = useMemo<ComboboxOption[]>(
    () =>
      activeItems.map((item) => ({
        value: item.id,
        label: [item.name, item.code, item.unit].filter(Boolean).join(" · "),
        description: item.nameNepali || undefined,
      })),
    [activeItems],
  );

  return (
    <div className="flex w-full flex-col gap-1" id={id} data-testid="item-select">
      {label && (
        <label className="text-[11px] font-medium text-[var(--ds-text-muted)]">
          {label}
          {required ? <span className="ml-0.5 text-[var(--ds-status-danger)]">*</span> : null}
        </label>
      )}
      <Combobox
        aria-label={label || placeholder}
        options={options}
        value={value}
        onChange={onChange}
        onClear={value ? () => onChange("") : undefined}
        disabled={disabled}
        invalid={Boolean(error)}
        placeholder={placeholder}
        emptyText="No matching items"
        renderOption={(opt) => (
          <span className="flex w-full min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate">{opt.label}</span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--ds-text-muted)]">
              {stockPositions.get(opt.value) ?? 0}
            </span>
          </span>
        )}
      />
      {error ? (
        <span className="mt-0.5 text-[10px] font-semibold text-[var(--ds-status-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
};

export default ItemSelect;
