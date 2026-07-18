/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { useStore } from "../../store/useStore";
import { PartyType } from "../../lib/types";
import { Combobox, type ComboboxOption } from "@/design-system";

interface PartySelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  partyType?: PartyType;
  /** Alias used by some consumers. */
  partyTypeFilter?: PartyType;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  id?: string;
}

const getPrefix = (type: string) => {
  if (type === "customer") return "[C]";
  if (type === "supplier") return "[S]";
  return "[B]";
};

/** Party picker on the design-system Combobox (IMPLEMENT_NOW §3.1 preset). */
const PartySelect: React.FC<PartySelectProps> = ({
  label,
  value,
  onChange,
  partyType,
  partyTypeFilter,
  required = false,
  disabled = false,
  error,
  placeholder = "Select supplier / customer",
  id,
}) => {
  const parties = useStore((state) => state.parties) as any[];
  const effectiveType = partyType || partyTypeFilter;

  const filtered = useMemo(
    () =>
      (parties || []).filter((p) => {
        if (effectiveType && p.type !== effectiveType) return false;
        if (!p.isActive) return false;
        return true;
      }),
    [parties, effectiveType],
  );

  const options = useMemo<ComboboxOption[]>(
    () =>
      filtered.map((p) => ({
        value: p.id,
        label: `${getPrefix(p.type)} ${p.name}`,
        description: [p.code, p.pan ? `PAN: ${p.pan}` : ""].filter(Boolean).join(" · ") || undefined,
      })),
    [filtered],
  );

  return (
    <div className="flex w-full flex-col gap-1" id={id}>
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
        disabled={disabled}
        invalid={Boolean(error)}
        placeholder={placeholder}
        emptyText="No matching parties"
      />
      {error && (
        <span className="mt-0.5 text-[10px] font-semibold text-[var(--ds-status-danger)]">
          {error}
        </span>
      )}
    </div>
  );
};

export default PartySelect;
