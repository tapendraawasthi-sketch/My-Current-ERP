import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { StandardNarration } from "../../lib/types";
import Modal from "./Modal";
import Input from "./Input";

interface NarrationInputProps {
  value: string;
  onChange: (value: string) => void;
  voucherType?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
}

const NarrationInput: React.FC<NarrationInputProps> = ({ value, onChange, voucherType = "general", className = "", rows = 2, disabled }) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "F4") {
      e.preventDefault();
      setPickerOpen(true);
    }
  };

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        disabled={disabled}
        className={`w-full p-2 text-[12px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500 ${className}`}
        placeholder="Enter narration..."
      />
      {!disabled && <span className="text-[10px] text-gray-400 mt-0.5 block">Press F4 to pick standard narration</span>}
      
      {pickerOpen && !disabled && (
        <NarrationPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(text) => {
            onChange(text);
            setPickerOpen(false);
          }}
          voucherType={voucherType}
        />
      )}
    </div>
  );
};

interface NarrationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (text: string) => void;
  voucherType: string;
}

const NarrationPickerModal: React.FC<NarrationPickerModalProps> = ({ isOpen, onClose, onSelect, voucherType }) => {
  const { standardNarrations, loadStandardNarrations, incrementNarrationUsage } = useStore();
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    loadStandardNarrations();
  }, [loadStandardNarrations]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    
    // Convert voucherType to category (rough mapping)
    let targetCategory = "general";
    if (voucherType.includes("payment")) targetCategory = "payment";
    else if (voucherType.includes("receipt")) targetCategory = "receipt";
    else if (voucherType.includes("journal") || voucherType.includes("contra")) targetCategory = "journal";
    else if (voucherType.includes("sales")) targetCategory = "sales";
    else if (voucherType.includes("purchase")) targetCategory = "purchase";

    return standardNarrations
      .filter((sn) => sn.isActive)
      .filter((sn) => {
        if (!q) return true;
        return sn.code.toLowerCase().includes(q) || sn.text.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Boost priority for matching category
        const aMatches = a.category === targetCategory ? 1 : 0;
        const bMatches = b.category === targetCategory ? 1 : 0;
        if (aMatches !== bMatches) return bMatches - aMatches;
        
        // Then boost general category
        const aGeneral = a.category === "general" ? 1 : 0;
        const bGeneral = b.category === "general" ? 1 : 0;
        if (aGeneral !== bGeneral) return bGeneral - aGeneral;

        // Finally sort by usageCount DESC
        return b.usageCount - a.usageCount;
      });
  }, [standardNarrations, search, voucherType]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleSelect = async (sn: StandardNarration) => {
    await incrementNarrationUsage(sn.id);
    onSelect(sn.text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-[15px] font-semibold text-gray-800">Select Standard Narration</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by code or text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 text-[12px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[400px]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-gray-500">
              No matching narrations found.
            </div>
          ) : (
            <table className="data-table w-full">
              <thead className="sticky-thead">
                <tr>
                  <th className="w-24">Code</th>
                  <th>Text</th>
                  <th className="w-24">Category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sn, idx) => (
                  <tr 
                    key={sn.id}
                    className={`cursor-pointer hover:bg-gray-50 ${idx === selectedIndex ? "bg-[#eef2ff]" : ""}`}
                    onClick={() => handleSelect(sn)}
                  >
                    <td className="font-medium text-[11px]">{sn.code}</td>
                    <td className="text-[12px]">{sn.text}</td>
                    <td className="capitalize text-[10px] text-gray-500">{sn.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-[10px] text-gray-500 flex justify-between">
          <span>Use <b>↑</b> <b>↓</b> arrows to navigate, <b>Enter</b> to select</span>
          <span><b>Esc</b> to close</span>
        </div>
      </div>
    </div>
  );
};

export default NarrationInput;
