// src/components/ui/Badge.tsx
import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "primary" | "secondary";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  default:   { background: "#D4EABD", color: "#000000", borderColor: "#9DC07A" },
  success:   { background: "#dcfce7", color: "#166534", borderColor: "#16a34a" },
  warning:   { background: "#fef9c3", color: "#854d0e", borderColor: "#ca8a04" },
  danger:    { background: "#fee2e2", color: "#991b1b", borderColor: "#dc2626" },
  info:      { background: "#dbeafe", color: "#1e3a8a", borderColor: "#3b82f6" },
  primary:   { background: "#D4EABD", color: "#000000", borderColor: "#000000" },
  secondary: { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" },
};

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  dot,
  className = "",
}) => {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  const padding = size === "sm" ? "1px 6px" : "2px 8px";
  const fontSize = size === "sm" ? 9 : 10;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding,
        fontSize,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderRadius: 3,
        border: `1px solid ${style.borderColor}`,
        background: style.background,
        color: style.color,
        whiteSpace: "nowrap",
      }}
      className={className}
    >
      {dot && (
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: style.color,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
