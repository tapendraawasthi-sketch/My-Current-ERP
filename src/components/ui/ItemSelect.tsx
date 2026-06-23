/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { computeStockPosition } from "@/lib/stockUtils";
import { ChevronDown, Search } from "lucide-react";

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
  const items = useStore((state) => state.items);
  const stockMovements = useStore((state) => state.stockMovements);
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.isActive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          (item.nameNepali && item.nameNepali.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, search]);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === value);
  }, [items, value]);

  // Compute stock position map for filtered items to make rendering faster
  const stockPositions = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((item) => {
      const pos = computeStockPosition(stockMovements, item.id, null);
      map.set(item.id, pos.qty);
    });
    return map;
  }, [filteredItems, stockMovements]);

  return (
    <div className="flex flex-col gap-1 w-full relative" ref={containerRef} id={id}>
      {label && <label className="text-[11px] font-semibold text-gray-700">{label}</label>}

      <div className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-8 px-2.5 text-left text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] flex items-center justify-between disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
          <span className="truncate">
            {selectedItem
              ? `${selectedItem.name} [${selectedItem.code}]`
              : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0 ml-1" />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
            {/* Search input */}
            <div className="p-1 border-b border-gray-150 flex items-center gap-1 bg-slate-50 shrink-0">
              <Search className="h-3 w-3 text-gray-400 ml-1.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item..."
                className="w-full h-7 px-1 text-[11px] bg-transparent border-none focus:outline-none"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-52 py-1">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-gray-400 text-center font-bold">
                  No matching items
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = item.id === value;
                  const currentStock = stockPositions.get(item.id) ?? 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">
                        [{item.code || ""}] {item.name} | Stock: {currentStock}
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

export default ItemSelect;
