import React, { useState, useEffect, useRef } from "react";
import { Search, X, FileText, Users, Receipt, Package, Menu, TrendingUp, History, CornerDownLeft } from "lucide-react";
import { useStore } from "../store/useStore";
import { useGlobalSearch, SearchResultItem } from "../hooks/useGlobalSearch";
import { RecentlyOpenedItem } from "../lib/types";

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { setCurrentPage, recentlyOpened, addRecentlyOpened } = useStore();
  const { results, isSearching } = useGlobalSearch(query);

  const displayResults: (SearchResultItem | RecentlyOpenedItem)[] = query.trim().length > 0 ? results : recentlyOpened;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
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
        setSelectedIndex((prev) => Math.min(prev + 1, displayResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (displayResults.length > 0 && displayResults[selectedIndex]) {
          handleSelect(displayResults[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, displayResults, onClose]);

  const handleSelect = (item: SearchResultItem | RecentlyOpenedItem) => {
    // Navigate
    setCurrentPage(item.page);

    // Add to recently opened
    addRecentlyOpened({
      id: item.id,
      type: item.type,
      label: item.label,
      subtitle: item.subtitle,
      page: item.page,
    });

    onClose();
  };

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch(type) {
      case 'page': return <Menu className="w-4 h-4 text-gray-500 shrink-0" />;
      case 'party': return <Users className="w-4 h-4 text-gray-500 shrink-0" />;
      case 'account': return <TrendingUp className="w-4 h-4 text-gray-500 shrink-0" />;
      case 'item': return <Package className="w-4 h-4 text-gray-500 shrink-0" />;
      case 'invoice': return <Receipt className="w-4 h-4 text-gray-500 shrink-0" />;
      case 'voucher': return <FileText className="w-4 h-4 text-gray-500 shrink-0" />;
      default: return <FileText className="w-4 h-4 text-gray-500 shrink-0" />;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[600px] overflow-hidden flex flex-col max-h-[80vh] border border-gray-200">
        
        {/* Search Input Container */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white relative">
          <Search className="h-5 w-5 text-[#1557b0] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, accounts, vouchers... (or use > for commands)"
            className="flex-1 bg-transparent text-[14px] text-gray-900 placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center text-[10px] bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 font-mono">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-1 cursor-pointer rounded-md p-1 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto bg-[#fcfcfc] p-2">
          {isSearching && (
            <div className="p-8 text-center text-gray-500 text-[12px] flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#1557b0] border-t-transparent rounded-full animate-spin"></span>
              Searching...
            </div>
          )}

          {!isSearching && query.trim().length > 0 && displayResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
              <Search className="h-10 w-10 opacity-20 text-[#1557b0]" />
              <p className="text-[13px] font-medium text-gray-600">No results found for "{query}"</p>
              <p className="text-[11px] text-gray-400">Try a different term or use &gt; for commands</p>
            </div>
          )}

          {!isSearching && query.trim().length === 0 && displayResults.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <div className="flex justify-center mb-4">
                 <History className="h-10 w-10 opacity-20 text-[#1557b0]" />
              </div>
              <p className="text-[13px] font-medium text-gray-600">No recent activity</p>
              <p className="text-[11px] text-gray-400 mt-1">Start typing to search across your workspace</p>
            </div>
          )}

          {!isSearching && displayResults.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                {query.trim().length === 0 ? <><History className="w-3 h-3" /> RECENTLY OPENED</> : "SEARCH RESULTS"}
              </div>
              
              {displayResults.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer group ${
                      isSelected ? "bg-[#1557b0] text-white" : "hover:bg-gray-100 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-md bg-white border shadow-sm shrink-0 ${isSelected ? "border-white/20" : "border-gray-200"}`}>
                         {React.cloneElement(getIcon(item.type) as React.ReactElement, { 
                           className: `w-4 h-4 ${isSelected ? "text-[#1557b0]" : "text-gray-500"}` 
                         })}
                      </div>
                      <div className="truncate">
                        <p className={`font-semibold text-[12.5px] truncate ${isSelected ? "text-white" : "text-gray-800"}`}>
                          {item.label}
                        </p>
                        <p className={`text-[10.5px] truncate ${isSelected ? "text-blue-100" : "text-gray-500"}`}>
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                       <span className="shrink-0 text-white flex items-center gap-1 text-[10px] font-medium opacity-80">
                         Jump <CornerDownLeft className="w-3 h-3" />
                       </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer shortcuts */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-500 font-medium">
           <div className="flex items-center gap-1.5">
             <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm">↑</kbd>
             <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm">↓</kbd>
             <span>Navigate</span>
           </div>
           <div className="flex items-center gap-1.5">
             <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm text-gray-600">Enter</kbd>
             <span>Select</span>
           </div>
           <div className="flex items-center gap-1.5 ml-auto">
             <span>Prefix <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm text-blue-600">&gt;</kbd> for pages</span>
           </div>
        </div>

      </div>
    </div>
  );
};
