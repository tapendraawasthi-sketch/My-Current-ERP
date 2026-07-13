/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { PartyType } from "../../lib/types";
import { ChevronDown, Search } from "lucide-react";

interface PartySelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  partyType?: PartyType;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  id?: string;
}

const PartySelect: React.FC<PartySelectProps> = ({
  label,
  value,
  onChange,
  partyType,
  required = false,
  disabled = false,
  error,
  placeholder = "Select supplier / customer",
  id,
}) => {
  const parties = useStore((state) => state.parties);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      if (partyType && p.type !== partyType) return false;
      if (!p.isActive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.pan && p.pan.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [parties, partyType, search]);

  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === value);
  }, [parties, value]);

  const getPrefix = (type: string) => {
    if (type === "customer") return "[C]";
    if (type === "supplier") return "[S]";
    return "[B]";
  };

  return (
    <div className="flex flex-col gap-1 w-full relative" ref={containerRef} id={id}>
      {label && (
        <label className="text-[11px] font-medium text-[var(--ox-text-muted)]">{label}</label>
      )}

      <div className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-8 w-full items-center justify-between rounded-[var(--ox-radius-md)] border border-[var(--ox-border-strong)] bg-[var(--ox-surface)] px-2.5 text-left text-[12px] text-[var(--ox-text)] focus:border-[var(--ox-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ox-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--ox-surface-muted)]"
        >
          <span className="truncate">
            {selectedParty ? `${getPrefix(selectedParty.type)} ${selectedParty.name}` : placeholder}
          </span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 text-[var(--ox-text-subtle)]" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 flex max-h-64 w-full flex-col overflow-hidden rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface-elevated)] shadow-[var(--ox-shadow-md)]">
            <div className="flex shrink-0 items-center gap-1 border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)] p-1">
              <Search className="ml-1.5 h-3 w-3 text-[var(--ox-text-subtle)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search party..."
                className="h-7 w-full border-none bg-transparent px-1 text-[11px] text-[var(--ox-text)] focus:outline-none"
                autoFocus
              />
            </div>

            <div className="max-h-52 overflow-y-auto py-1">
              {filteredParties.length === 0 ? (
                <div className="px-3 py-2 text-center text-[11px] text-[var(--ox-text-muted)]">
                  No matching parties
                </div>
              ) : (
                filteredParties.map((p) => {
                  const isSelected = p.id === value;
                  const prefix = getPrefix(p.type);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onChange(p.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors ${
                        isSelected
                          ? "bg-[var(--ox-primary-soft)] font-semibold text-[var(--ox-primary)]"
                          : "text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
                      }`}
                    >
                      <span className="truncate">
                        {prefix} {p.name} {p.pan ? `[PAN: ${p.pan}]` : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && <span className="text-[10px] text-red-500 font-semibold mt-0.5">{error}</span>}
    </div>
  );
};

export default PartySelect;
