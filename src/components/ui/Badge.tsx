import React from "react";
import type { BadgeVariant } from "../../lib/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:   "bg-gray-100 text-gray-700 border border-gray-200",
  primary:   "bg-blue-100 text-blue-700 border border-blue-200",
  secondary: "bg-gray-100 text-gray-600 border border-gray-200",
  success:   "bg-green-100 text-green-700 border border-green-200",
  warning:   "bg-amber-100 text-amber-700 border border-amber-200",
  danger:    "bg-red-100 text-red-700 border border-red-200",
  info:      "bg-blue-50 text-blue-600 border border-blue-200",
  outline:   "bg-transparent text-gray-700 border border-gray-400",
  ghost:     "bg-transparent text-gray-600 border-transparent",
};

const Badge: React.FC<BadgeProps> = ({ children, variant = "default", className = "" }) => {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded
        text-[10px] font-semibold uppercase tracking-wide
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export { Badge };
export type { BadgeProps, BadgeVariant };
export default Badge;
