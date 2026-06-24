/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface SutraLogoProps {
  collapsed?: boolean;
  className?: string;
}

const SutraLogo: React.FC<SutraLogoProps> = ({ collapsed = false, className = "" }) => {
  return (
    <div
      className={`flex items-center gap-2 select-none ${collapsed ? "justify-center" : ""} ${className}`}
    >
      {/* "S" inside a polished blue square */}
      <div className="flex items-center justify-center h-7 w-7 bg-[#1557b0] rounded-lg shrink-0 transition-colors">
        <span className="text-white font-bold text-[14px] leading-none">S</span>
      </div>

      {!collapsed && (
        <div className="flex flex-col animate-fadeIn">
          <span className="text-[13px] font-semibold text-white leading-none">Sutra ERP</span>
          <span className="text-[9px] text-slate-400 leading-none mt-0.5">Accounting</span>
        </div>
      )}
    </div>
  );
};

export default SutraLogo;
