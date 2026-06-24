import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "primary" | undefined;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant, size = "md", dot, className = "" }) => {
  const base =
    "inline-flex items-center gap-1 font-bold uppercase tracking-wide border border-black rounded " +
    (size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]") +
    " bg-[#D4EABD] text-black";

  return (
    <span className={`${base} ${className}`} style={{ background: "#D4EABD", color: "#000000", borderColor: "#000000" }}>
      {dot && (
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#000000",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
