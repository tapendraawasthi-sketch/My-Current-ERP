import React from "react";
import { useStore } from "../store/useStore";
import { getBSTodayLong, getBSToday } from "../lib/nepaliDate";

const FinancialDashboard: React.FC = () => {
  const { currentFiscalYear } = useStore();

  let bsDateStr = "";
  try {
    bsDateStr = getBSTodayLong();
  } catch {
    bsDateStr = getBSToday();
  }

  const fiscalYearName = currentFiscalYear?.name ?? "—";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Home</h1>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[12px] text-gray-700">{bsDateStr}</p>
          <p className="text-[12px] text-gray-700 mt-1">{fiscalYearName}</p>
          <p className="text-[12px] text-gray-400 mt-3">Use the menu above to get started.</p>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
