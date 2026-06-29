import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, FileText, Users, Receipt, Package, Menu, TrendingUp } from "lucide-react";
import { useStore } from "../store/useStore";
import { useGlobalSearch } from "../hooks/useGlobalSearch";

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setCurrentPage } = useStore();

  const { results, isSearching } = useGlobalSearch(query);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, results]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, getTotalResults() - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(selectedIndex);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, results]);

  const flatResults = useMemo(() => {
    const list: Array<{ category: string; item: any }> = [];
    results.accounts.forEach((a) => list.push({ category: "accounts", item: a }));
    results.parties.forEach((p) => list.push({ category: "parties", item: p }));
    results.vouchers.forEach((v) => list.push({ category: "vouchers", item: v }));
    results.invoices.forEach((i) => list.push({ category: "billing", item: i }));
    results.items.forEach((i) => list.push({ category: "items", item: i }));
    results.pages.forEach((p) => list.push({ category: "page", item: p }));
    return list;
  }, [results]);

  const getTotalResults = () => flatResults.length;

  const handleSelect = (index: number) => {
    const selected = flatResults[index];
    if (!selected) return;

    if (selected.category === "page") {
      const page = selected.item.path.replace(/^\//, "");
      const mappedPage =
        page === "chart-of-accounts"
          ? "accounts"
          : page === "payment-voucher"
            ? "payment"
            : page === "receipt-voucher"
              ? "receipt"
              : page === "journal-voucher"
                ? "journal"
                : page === "contra-voucher"
                  ? "contra"
                  : page === "budget-actual"
                    ? "budget-vs-actual"
                    : page === "gst-report"
                      ? "vat-reports"
                      : page === "aging-analysis"
                        ? "aging-report"
                        : page;
      setCurrentPage(mappedPage);
    } else {
      setCurrentPage(selected.category);
    }
    onClose();
  };

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[600px] overflow-hidden">
        {/* Search Input Container */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b animate-fadeIn"
          style={{ borderColor: "var(--border)" }}
        >
          <Search className="h-4 w-4 text-[#1f2937] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search... (Ctrl+/)"
            autoFocus
            className="flex-1 bg-transparent text-[13px] text-[#1f2937] placeholder-gray-400 outline-none"
          />
          <kbd className="text-[10px] bg-[#f9fafb] border border-[#d1d5db] rounded px-1.5 py-0.5 text-[#1f2937] font-mono">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="text-[#1f2937] hover:text-[#1f2937] ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[500px]">
          {isSearching && <div className="p-8 text-center text-[#1f2937]">Searching...</div>}

          {!isSearching && query.length >= 2 && getTotalResults() === 0 && (
            <div className="flex flex-col items-center py-10 text-[#1f2937] gap-2">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-[12px] font-semibold">No results for "{query}"</p>
            </div>
          )}

          {!query && (
            <div className="p-8 text-center text-[#1f2937]">
              <p className="text-sm">
                Type to search across accounts, parties, vouchers, invoices, items, and pages
              </p>
              <div className="mt-4 text-xs space-y-1">
                <p>
                  <kbd className="px-2 py-1 bg-[#f9fafb] rounded">↑</kbd>{" "}
                  <kbd className="px-2 py-1 bg-[#f9fafb] rounded">↓</kbd> to navigate
                </p>
                <p>
                  <kbd className="px-2 py-1 bg-[#f9fafb] rounded">Enter</kbd> to select
                </p>
                <p>
                  <kbd className="px-2 py-1 bg-[#f9fafb] rounded">Esc</kbd> to close
                </p>
              </div>
            </div>
          )}

          {/* Accounts */}
          {results.accounts.length > 0 && (
            <div className="border-b border-[#d1d5db]">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#1f2937] bg-[#f9fafb]">
                ACCOUNTS
              </div>
              {results.accounts.map((item, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(itemIndex)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#e5e7eb] text-left transition-colors border-b border-[#d1d5db] last:border-0 cursor-pointer ${
                      selectedIndex === itemIndex ? "bg-[#e5e7eb]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-4 h-4 text-[#1f2937] shrink-0" />
                      <div>
                        <p className="font-semibold text-[12px] text-[#1f2937]">{item.name}</p>
                        <p className="text-[10px] text-[#1f2937]">{item.code}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[#1f2937] text-[12px]">
                      {item.balance?.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Parties */}
          {results.parties.length > 0 && (
            <div className="border-b border-[#d1d5db]">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#1f2937] bg-[#f9fafb]">
                PARTIES
              </div>
              {results.parties.map((item, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(itemIndex)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#e5e7eb] text-left transition-colors border-b border-[#d1d5db] last:border-0 cursor-pointer ${
                      selectedIndex === itemIndex ? "bg-[#e5e7eb]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-[#1f2937] shrink-0" />
                      <div>
                        <p className="font-semibold text-[12px] text-[#1f2937]">{item.name}</p>
                        <p className="text-[10px] text-[#1f2937]">{item.type}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[#1f2937] text-[12px]">
                      {item.balance?.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Vouchers */}
          {results.vouchers.length > 0 && (
            <div className="border-b border-[#d1d5db]">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#1f2937] bg-[#f9fafb]">
                VOUCHERS
              </div>
              {results.vouchers.map((item, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(itemIndex)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#e5e7eb] text-left transition-colors border-b border-[#d1d5db] last:border-0 cursor-pointer ${
                      selectedIndex === itemIndex ? "bg-[#e5e7eb]" : ""
                    }`}
                  >
                    <FileText className="w-4 h-4 text-[#1f2937] shrink-0" />
                    <div>
                      <p className="font-semibold text-[12px] text-[#1f2937]">
                        {item.voucherNo} - {item.type}
                      </p>
                      <p className="text-[10px] text-[#1f2937] truncate max-w-lg">
                        {item.narration}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Invoices */}
          {results.invoices.length > 0 && (
            <div className="border-b border-[#d1d5db]">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#1f2937] bg-[#f9fafb]">
                INVOICES
              </div>
              {results.invoices.map((item, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(itemIndex)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#e5e7eb] text-left transition-colors border-b border-[#d1d5db] last:border-0 cursor-pointer ${
                      selectedIndex === itemIndex ? "bg-[#e5e7eb]" : ""
                    }`}
                  >
                    <Receipt className="w-4 h-4 text-[#1f2937] shrink-0" />
                    <div>
                      <p className="font-semibold text-[12px] text-[#1f2937]">
                        {item.invoiceNo} - {item.partyName}
                      </p>
                      <p className="text-[10px] text-[#1f2937]">{item.date}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Items */}
          {results.items.length > 0 && (
            <div className="border-b border-[#d1d5db]">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#1f2937] bg-[#f9fafb]">
                ITEMS
              </div>
              {results.items.map((item, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(itemIndex)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#e5e7eb] text-left transition-colors border-b border-[#d1d5db] last:border-0 cursor-pointer ${
                      selectedIndex === itemIndex ? "bg-[#e5e7eb]" : ""
                    }`}
                  >
                    <Package className="w-4 h-4 text-[#1f2937] shrink-0" />
                    <div>
                      <p className="font-semibold text-[12px] text-[#1f2937]">{item.name}</p>
                      <p className="text-[10px] text-[#1f2937]">{item.code}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pages */}
          {results.pages.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#1f2937] bg-[#f9fafb]">
                PAGES
              </div>
              {results.pages.map((item, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleSelect(itemIndex)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#e5e7eb] text-left transition-colors border-b border-[#d1d5db] last:border-0 cursor-pointer ${
                      selectedIndex === itemIndex ? "bg-[#e5e7eb]" : ""
                    }`}
                  >
                    <Menu className="w-4 h-4 text-[#1f2937] shrink-0" />
                    <div>
                      <p className="font-semibold text-[12px] text-[#1f2937]">{item.name}</p>
                      <p className="text-[10px] text-[#1f2937]">{item.path}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
