import React from "react";

export type BadgeVariant =
  | "success"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "warning"
  | "info"
  | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-700 border border-green-200",
  warning: "bg-amber-100 text-amber-700 border border-amber-200",
  danger: "bg-red-100 text-red-700 border border-red-200",
  info: "bg-blue-100 text-blue-700 border border-blue-200",
  primary: "bg-[#1557b0] text-white border border-[#1557b0]",
  secondary: "bg-gray-100 text-gray-700 border border-gray-200",
  outline: "bg-white text-gray-700 border border-gray-300",
  ghost: "bg-transparent text-gray-600 border border-transparent",
  default: "bg-gray-100 text-gray-600 border border-gray-200",
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  size = "sm",
  children,
  className = "",
}) => {
  const sizeCls = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center rounded font-semibold uppercase ${sizeCls} ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.default} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
