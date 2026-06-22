/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { AccountType } from "../../lib/types";
import QuickCreateAccountModal from "./QuickCreateAccountModal";
import { Plus, ChevronDown, Search } from "lucide-react";

interface AccountSelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  filterType?: AccountType;
  filterTypes?: AccountType[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  id?: string;
}

const AccountSelect: React.FC<AccountSelectProps> = ({
  label,
  value,
  onChange,
  filterType,
  filterTypes,
  required = false,
  disabled = false,
  error,
  placeholder = "Select account ledger",
  id,
}) => {
  const accounts = useStore((state) => state.accounts);
  const [modalOpen, setModalOpen] = useState(false);
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

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (filterType && acc.type !== filterType) return false;
      if (filterTypes && !filterTypes.includes(acc.type)) return false;
      if (!acc.isActive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          acc.name.toLowerCase().includes(q) ||
          acc.code.toLowerCase().includes(q) ||
          (acc.nameNepali && acc.nameNepali.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [accounts, filterType, filterTypes, search]);

  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === value);
  }, [accounts, value]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, typeof filteredAccounts> = {};
    filteredAccounts.forEach((acc) => {
      const typeStr = acc.type.toUpperCase().replace("_", " ");
      if (!groups[typeStr]) {
        groups[typeStr] = [];
      }
      groups[typeStr].push(acc);
    });
    return groups;
  }, [filteredAccounts]);

  return (
    <div className="flex flex-col gap-1 w-full relative" ref={containerRef} id={id}>
      {label && <label className="text-[11px] font-semibold text-gray-700">{label}</label>}

      <div className="flex items-center gap-1 w-full">
        {/* Custom Dropdown Trigger */}
        <div className="relative flex-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="w-full h-8 px-2.5 text-left text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] flex items-center justify-between disabled:bg-gray-50 disabled:cursor-not-allowed"
          >
            <span className="truncate">
              {selectedAccount
                ? `${selectedAccount.code ? selectedAccount.code + " · " : ""}${selectedAccount.name}`
                : placeholder}
            </span>
            <ChevronDown className="h-3 w-3 text-gray-400 shrink-0 ml-1" />
          </button>

          {/* Custom Dropdown List */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
              {/* Search Bar */}
              <div className="p-1 border-b border-gray-150 flex items-center gap-1 bg-slate-50 shrink-0">
                <Search className="h-3 w-3 text-gray-400 ml-1.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ledger..."
                  className="w-full h-7 px-1 text-[11px] bg-transparent border-none focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Options List */}
              <div className="overflow-y-auto max-h-52 py-1">
                {Object.keys(groupedAccounts).length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400 text-center font-bold">
                    No matching ledgers
                  </div>
                ) : (
                  Object.entries(groupedAccounts).map(([groupName, list]) => (
                    <div key={groupName}>
                      {/* Divider Header */}
                      <div className="px-2.5 py-1 text-[9px] font-bold text-[#1557b0] bg-blue-50/50 tracking-wider uppercase border-y border-gray-100">
                        {groupName}
                      </div>
                      {list.map((acc) => {
                        const isSelected = acc.id === value;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              onChange(acc.id);
                              setIsOpen(false);
                              setSearch("");
                            }}
                            className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex items-center justify-between ${
                              isSelected
                                ? "bg-blue-50 text-blue-700 font-semibold"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span>
                              {acc.code ? acc.code + " · " : ""}
                              {acc.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Add Button */}
        {!disabled && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            title="Create new accounting ledger"
            className="flex items-center justify-center border border-gray-300 w-8 h-8 text-gray-500 hover:text-[#1557b0] hover:border-[#1557b0] hover:bg-blue-50/50 rounded-md shrink-0 transition-all focus:outline-none cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <span className="text-[10px] text-red-500 font-semibold mt-0.5">{error}</span>}

      <QuickCreateAccountModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(newId) => onChange(newId)}
        suggestedType={filterType || (filterTypes && filterTypes[0]) || AccountType.EXPENSE}
      />
    </div>
  );
};

export default AccountSelect;
