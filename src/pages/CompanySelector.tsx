// @ts-nocheck
import React from "react";
import { Loader2 } from "lucide-react";
import { useAccountingStore as useStore } from "../store/useStore";

function CompanySelector() {
  const { companySettings, isDbReady, setCurrentPage } = useStore();

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center text-[#000000] p-8">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#1557b0] animate-spin mx-auto mb-4" />
          <p className="text-[12px] text-[#000000]">Loading database settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 select-none">
      <div className="w-full max-w-md bg-white border border-[#9DC07A] p-8 rounded-lg shadow-md space-y-6">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 bg-[#3D6B25] rounded-md flex items-center justify-center shadow-md mx-auto">
            <span className="text-[#000000] font-bold text-xl font-sans leading-none">S</span>
          </div>
          <h2 className="text-xl font-bold text-[#000000] tracking-tight">
            SUTRA <span className="text-[#1557b0]">ERP</span>
          </h2>
          <p className="text-[10px] text-[#000000] font-semibold uppercase tracking-wider">
            Select Workspace
          </p>
        </div>

        <div
          onClick={() => setCurrentPage("dashboard")}
          className="p-4 bg-white border-2 border-[#1557b0] rounded-lg shadow-md cursor-pointer"
        >
          <h3 className="text-sm font-bold text-[#000000] mb-1 truncate">
            {companySettings?.name}
          </h3>
          <p className="text-xs text-[#000000] font-medium">
            PAN: <span className="font-mono text-[#000000]">{companySettings?.panNumber}</span>
          </p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage("dashboard");
            }}
            className="w-full mt-4 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white font-medium h-8 rounded-md text-[12px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Continue</span>
            <span className="mb-0.5">→</span>
          </button>
        </div>

        <div className="pt-2 text-center border-t border-[#9DC07A]">
          <button
            onClick={() => setCurrentPage("signup")}
            className="text-xs font-semibold text-[#1557b0] hover:text-[#0f4a96] transition-colors cursor-pointer"
          >
            Setup New Company
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompanySelector;
