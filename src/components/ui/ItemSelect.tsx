/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { computeStockPosition } from "../../lib/stockUtils";
import { ChevronDown, Search, X } from "lucide-react";

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
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
          (item.code || "").toLowerCase().includes(q) ||
          (item.nameNepali && item.nameNepali.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, search]);

  useEffect(() => {
    setHighlight(0);
  }, [search, isOpen]);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === value);
  }, [items, value]);

  const stockPositions = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((item) => {
      const pos = computeStockPosition(stockMovements, item.id, null);
      map.set(item.id, pos.qty);
    });
    return map;
  }, [filteredItems, stockMovements]);

  const selectItem = (itemId: string) => {
    onChange(itemId);
    setIsOpen(false);
    setSearch("");
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filteredItems.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter" && filteredItems[highlight]) {
      e.preventDefault();
      selectItem(filteredItems[highlight].id);
    }
  };

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, isOpen]);

  return (
    <div
      className="relative flex w-full flex-col gap-1"
      ref={containerRef}
      id={id}
      data-testid="item-select"
    >
      {label && (
        <label className="text-[11px] font-medium text-[var(--ox-text-muted)]">
          {label}
          {required ? <span className="ml-0.5 text-[var(--ox-danger)]">*</span> : null}
        </label>
      )}

      <div className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={Boolean(error) || undefined}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={onKeyDown}
          className={`flex h-8 w-full items-center justify-between rounded-[var(--ox-radius-md)] border bg-[var(--ox-surface)] px-2.5 text-left text-[12px] text-[var(--ox-text)] focus:border-[var(--ox-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ox-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--ox-surface-muted)] disabled:opacity-60 ${
            error ? "border-[var(--ox-danger)]" : "border-[var(--ox-border-strong)]"
          }`}
        >
          <span className="min-w-0 flex-1 truncate">
            {selectedItem
              ? `${selectedItem.name}${selectedItem.code ? ` · ${selectedItem.code}` : ""}${
                  selectedItem.unit ? ` · ${selectedItem.unit}` : ""
                }`
              : placeholder}
          </span>
          <span className="ml-1 flex shrink-0 items-center gap-0.5">
            {selectedItem && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selected item"
                onClick={clearSelection}
                className="rounded p-0.5 text-[var(--ox-text-subtle)] hover:bg-[var(--ox-surface-muted)] hover:text-[var(--ox-text)]"
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
            <ChevronDown className="h-3 w-3 text-[var(--ox-text-subtle)]" />
          </span>
        </button>

        {isOpen && !disabled && (
          <div
            className="absolute z-50 mt-1 flex max-h-64 w-full flex-col overflow-hidden rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface-elevated)] shadow-[var(--ox-shadow-md)]"
            role="listbox"
          >
            <div className="flex shrink-0 items-center gap-1 border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)] p-1">
              <Search className="ml-1.5 h-3 w-3 text-[var(--ox-text-subtle)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search name or code…"
                aria-label="Search items"
                className="h-7 w-full border-none bg-transparent px-1 text-[11px] text-[var(--ox-text)] placeholder:text-[var(--ox-text-subtle)] focus:outline-none"
                autoFocus
              />
            </div>

            <div className="max-h-52 overflow-y-auto py-1" ref={listRef}>
              {filteredItems.length === 0 ? (
                <div className="px-3 py-2 text-center text-[11px] text-[var(--ox-text-muted)]">
                  No matching items
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = item.id === value;
                  const currentStock = stockPositions.get(item.id) ?? 0;
                  const active = idx === highlight;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-idx={idx}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => selectItem(item.id)}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
                        isSelected || active
                          ? "bg-[var(--ox-primary-soft)] text-[var(--ox-primary)]"
                          : "text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
                      } ${isSelected ? "font-semibold" : ""}`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{item.name}</span>
                        {item.code ? (
                          <span className="ml-1 text-[11px] text-[var(--ox-text-muted)]">
                            {item.code}
                          </span>
                        ) : null}
                        {item.unit ? (
                          <span className="ml-1 text-[10px] uppercase text-[var(--ox-text-subtle)]">
                            {item.unit}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--ox-text-muted)]">
                        {currentStock}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <span className="mt-0.5 text-[10px] font-semibold text-[var(--ox-danger)]">{error}</span>
      ) : null}
    </div>
  );
};

export default ItemSelect;
