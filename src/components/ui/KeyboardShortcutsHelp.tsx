import React, { useState, useEffect } from "react";
import { Keyboard, X, Search, Printer } from "lucide-react";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export default function KeyboardShortcutsHelp() {
  const { shortcuts, showHelp, setShowHelp } = useKeyboardShortcuts();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredShortcuts = shortcuts.filter(s => 
    s.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const navigationShortcuts = filteredShortcuts.filter(s => s.category === "navigation");
  const voucherShortcuts = filteredShortcuts.filter(s => s.category === "voucher");
  const globalShortcuts = filteredShortcuts.filter(s => s.category !== "navigation" && s.category !== "voucher");

  const handlePrint = () => {
    window.print();
  };

  if (!showHelp) {
    return (
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-6 right-6 bg-[#1557b0] text-white rounded-full p-3 shadow-lg hover:bg-[#0f4a96] z-40 outline-none"
        title="Keyboard Shortcuts (Press F1 to toggle)"
      >
        <Keyboard className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 no-print">
          <div className="flex items-center gap-4">
            <h2 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-[#1557b0]" /> Keyboard Shortcuts
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
              <input 
                type="text" 
                placeholder="Search shortcuts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-[12px] border border-gray-300 rounded focus:ring-1 focus:ring-[#1557b0] outline-none w-64"
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint}
              className="text-[12px] font-medium text-[#1557b0] hover:text-[#0f4a96] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print shortcuts
            </button>
            <button
              onClick={() => setShowHelp(false)}
              className="h-8 w-8 rounded flex items-center justify-center hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Print Header */}
        <div className="print-only hidden p-6 pb-2">
          <h1 className="text-xl font-bold">Sutra ERP - Keyboard Shortcuts</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Navigation */}
            <div>
              <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-1">Navigation & Menus</h3>
              <div className="space-y-2.5">
                {navigationShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-[12px] text-gray-700 font-medium">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[11px] font-bold text-gray-600 shadow-sm whitespace-nowrap min-w-[50px] text-center">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
                {navigationShortcuts.length === 0 && <div className="text-[11px] text-gray-400">No matching navigation shortcuts</div>}
              </div>

              <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-1 mt-8">Global</h3>
              <div className="space-y-2.5">
                {globalShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-[12px] text-gray-700 font-medium">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[11px] font-bold text-gray-600 shadow-sm whitespace-nowrap min-w-[50px] text-center">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
                {globalShortcuts.length === 0 && <div className="text-[11px] text-gray-400">No matching global shortcuts</div>}
              </div>
            </div>

            {/* Right Column: Voucher Entry */}
            <div>
              <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-1">Voucher Entry & Grids</h3>
              <div className="space-y-2.5">
                {voucherShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-[12px] text-gray-700 font-medium">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-[#f0f4ff] border border-[#c5cad8] rounded text-[11px] font-bold text-[#1557b0] shadow-sm whitespace-nowrap min-w-[50px] text-center">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
                {voucherShortcuts.length === 0 && <div className="text-[11px] text-gray-400">No matching voucher shortcuts</div>}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
