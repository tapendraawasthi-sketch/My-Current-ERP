/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";
import Spinner from "./Spinner";

interface ButtonProps {
  variant?:
    | "primary"
    | "secondary"
    | "danger"
    | "success"
    | "warning"
    | "ghost"
    | "outline"
    | "link";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
  id?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  type = "button",
  onClick,
  children,
  className = "",
  id,
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants = {
    primary:
      "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white border border-indigo-700 shadow-sm shadow-indigo-500/20 active:scale-[0.98]",
    secondary:
      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm active:scale-[0.98]",
    danger:
      "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border border-red-700 shadow-sm shadow-red-500/20 active:scale-[0.98]",
    success:
      "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white border border-emerald-700 shadow-sm shadow-emerald-500/20 active:scale-[0.98]",
    warning:
      "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border border-amber-600 shadow-sm shadow-amber-500/20 active:scale-[0.98]",
    ghost:
      "hover:bg-slate-100 text-slate-600 border border-transparent hover:border-slate-200 active:scale-[0.98]",
    outline:
      "border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 bg-white shadow-sm active:scale-[0.98]",
    link: "text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-2 bg-transparent border-0 p-0 focus:ring-0 disabled:no-underline",
  };

  const sizes = {
    xs: "h-6 px-2.5 text-[10px] rounded-md gap-1 tracking-wide",
    sm: "h-7 px-3 text-[11px] rounded-lg gap-1.5 tracking-wide",
    md: "h-8 px-3.5 text-[12px] rounded-lg gap-2",
    lg: "h-9 px-4 text-[13px] rounded-lg gap-2",
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      id={id}
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <Spinner
          size={size === "xs" ? "xs" : "sm"}
          className="mr-2"
          color={
            variant === "primary" ||
            variant === "danger" ||
            variant === "success" ||
            variant === "warning"
              ? "text-white"
              : "text-gray-500"
          }
        />
      )}
      {!loading && icon && iconPosition === "left" && (
        <span className="mr-2 inline-flex">{icon}</span>
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === "right" && (
        <span className="ml-2 inline-flex">{icon}</span>
      )}
    </button>
  );
};

export default Button;
