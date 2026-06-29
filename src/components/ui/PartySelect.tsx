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
      {label && <label className="text-[11px] font-semibold text-[#000000]">{label}</label>}

      <div className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-8 px-2.5 text-left text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] flex items-center justify-between disabled:bg-[#EBF5E2] disabled:cursor-not-allowed"
        >
          <span className="truncate">
            {selectedParty ? `${getPrefix(selectedParty.type)} ${selectedParty.name}` : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 text-[#000000] shrink-0 ml-1" />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-[#9DC07A] rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
            {/* Search input */}
            <div className="p-1 border-b border-[#9DC07A] flex items-center gap-1 bg-[#EBF5E2] shrink-0">
              <Search className="h-3 w-3 text-[#000000] ml-1.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search party..."
                className="w-full h-7 px-1 text-[11px] bg-transparent border-none focus:outline-none"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-52 py-1">
              {filteredParties.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-[#000000] text-center font-bold">
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
                      className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-[#D4EABD] text-[#000000] font-semibold"
                          : "text-[#000000] hover:bg-[#EBF5E2]"
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
