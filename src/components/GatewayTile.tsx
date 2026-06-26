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
      className="min-w-[150px] flex-1 text-left cursor-pointer hover:bg-[#B8D4A0] transition-colors"
      style={{
        background: "#D4EABD",
        border: "1px solid #000",
        color: "#000",
        padding: "8px 10px",
        borderRadius: 0,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{value}</div>
      {subtitle ? <div style={{ fontSize: 10, marginTop: 2 }}>{subtitle}</div> : null}
    </button>
  );
};

export default GatewayTile;
