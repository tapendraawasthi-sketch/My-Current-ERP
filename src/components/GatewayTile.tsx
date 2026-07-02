// src/components/GatewayTile.tsx
import React, { useState } from "react";

interface GatewayTileProps {
  label: string;
  value: string;
  subtitle?: string;
  onClick: () => void;
  /** Optional: override the left accent stripe colour. Defaults to #1557b0. */
  accentColour?: string;
}

const GatewayTile: React.FC<GatewayTileProps> = ({
  label,
  value,
  subtitle,
  onClick,
  accentColour = "#1557b0",
}) => {
  const [hov, setHov] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        /* Layout */
        minWidth: 140,
        flex: "1 1 140px",
        padding: "10px 12px 10px 14px",
        textAlign: "left",
        cursor: "pointer",

        /* Colour system */
        background: "#ffffff",
        border: `1px solid ${hov ? "#1557b0" : "#e5e7eb"}`,
        borderLeft: `3px solid ${accentColour}`,
        borderRadius: 6,

        /* Typography */
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, " +
          "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",

        /* Transitions */
        transition: "border-color 100ms ease",

        /* Remove default button styles */
        boxShadow: "none",
        outline: "none",
      }}
    >
      {/* Label */}
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "#6b7280",
        lineHeight: 1.2,
        marginBottom: 4,
      }}>
        {label}
      </div>

      {/* Value */}
      <div style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 15,
        fontWeight: 700,
        color: "#1557b0",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontSize: 10,
          color: "#9ca3af",
          lineHeight: 1.3,
          marginTop: 3,
        }}>
          {subtitle}
        </div>
      )}
    </button>
  );
};

export default GatewayTile;
