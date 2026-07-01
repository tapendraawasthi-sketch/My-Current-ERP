import React from "react";

export type ButtonVariant =
  | "success"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "destructive"; // alias kept for backward compatibility with existing call sites

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const HEIGHTS: Record<string, string> = {
  xs: "h-6 px-2 text-[11px]",
  sm: "h-7 px-3 text-[12px]",
  md: "h-8 px-3 text-[12px]",
  lg: "h-9 px-4 text-[13px]",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[#1557b0] hover:bg-[#0f4a96] text-white",
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300",
  outline: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300",
  ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
  success: "bg-[#059669] hover:bg-[#047857] text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  destructive: "bg-red-600 hover:bg-red-700 text-white", // maps to danger styling
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  loading,
  fullWidth,
  disabled,
  children,
  className = "",
  ...rest
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${HEIGHTS[size]} ${VARIANTS[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};

export default Button;
