import React from "react";

interface GatewayTileProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const GatewayTile: React.FC<GatewayTileProps> = ({ label, value, sub, color, icon, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-md p-3 text-left w-full hover:border-[#1557b0] hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 leading-tight">
          {label}
        </div>
        {icon && (
          <div className="text-gray-300 group-hover:text-[#1557b0] transition-colors">
            {icon}
          </div>
        )}
      </div>
      <div className={`text-[18px] font-bold font-mono leading-tight ${color || "text-gray-800"}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</div>
      )}
    </button>
  );
};

export default GatewayTile;
