import React from "react";

export type BadgeVariant =
  | "success"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "destructive"
  | "warning"
  | "info"
  | "default";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-700 border border-green-200",
  primary: "bg-blue-100 text-blue-700 border border-blue-200",
  secondary: "bg-gray-100 text-gray-700 border border-gray-200",
  outline: "bg-transparent text-gray-700 border border-gray-300",
  ghost: "bg-transparent text-gray-500",
  danger: "bg-red-100 text-red-700 border border-red-200",
  destructive: "bg-red-100 text-red-700 border border-red-200",
  warning: "bg-amber-100 text-amber-700 border border-amber-200",
  info: "bg-blue-50 text-blue-600 border border-blue-100",
  default: "bg-gray-100 text-gray-600 border border-gray-200",
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
