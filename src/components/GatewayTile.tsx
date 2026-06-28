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
      className="hover:bg-gray-50 transition-colors bg-white border border-gray-200 text-gray-800 rounded shadow-sm"
      style={{
        minWidth: 145,
        flex: "1 1 145px",
        padding: "10px 12px",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
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
