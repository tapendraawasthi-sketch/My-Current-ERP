import React from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "default" | "outline";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  default: "bg-gray-100 text-gray-700",
  outline: "bg-white text-gray-600 border border-gray-300",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ variant = "default", children, className = "" }) => (
  <span
    className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${VARIANT_CLASSES[variant]} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
