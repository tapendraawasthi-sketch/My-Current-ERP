import React from "react";

interface GatewayTileProps {
  label: string;
  value: string;
  subtitle?: string;
  onClick: () => void;
}

const GatewayTile: React.FC<GatewayTileProps> = ({ label, value, subtitle, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[145px] flex-1 basis-[145px] p-3 text-left bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-gray-500 transition-colors leading-tight">
        {label}
      </div>
      <div className="text-[14px] font-bold text-gray-800 mt-1 leading-tight">{value}</div>
      {subtitle && (
        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{subtitle}</div>
      )}
    </button>
  );
};

export default GatewayTile;
