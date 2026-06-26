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
      className="hover:bg-[#B8D4A0] transition-colors"
      style={{
        minWidth: 145,
        flex: "1 1 145px",
        background: "#D4EABD",
        border: "1px solid #000",
        color: "#000",
        padding: "7px 9px",
        borderRadius: 0,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginTop: 3,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>

      {subtitle ? (
        <div
          style={{
            fontSize: 10,
            marginTop: 2,
            lineHeight: 1.2,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </button>
  );
};

export default GatewayTile;
