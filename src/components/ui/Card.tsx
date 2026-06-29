import React from "react";

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  border?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}

const PADDING: Record<string, string> = {
  none: "",
  sm: "p-2",
  md: "p-4",
  lg: "p-6",
};

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  border,
  padding = "md",
  className = "",
}) => {
  return (
    <div
      style={{
        background: "#EBF5E2",
        border: border !== false ? "1px solid #000000" : "none",
        borderRadius: 4,
        overflow: "hidden",
        color: "#000000",
      }}
      className={className}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            padding: "10px 16px",
            background: "#D4EABD",
            borderBottom: "1px solid #000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            {title && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>{title}</span>
            )}
            {subtitle && <p style={{ fontSize: 11, color: "#000000", marginTop: 2 }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={PADDING[padding]}>{children}</div>
    </div>
  );
};

export default Card;
