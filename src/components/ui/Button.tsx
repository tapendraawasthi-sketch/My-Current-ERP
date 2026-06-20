/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";
import Spinner from "./Spinner";

interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "success" | "warning" | "ghost" | "outline" | "link";
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
    "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus:ring-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = { primary: "bg-[#1557b0] hover:bg-[#0f4a96] text-white border border-transparent shadow-sm", secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200", danger: "bg-red-600 hover:bg-red-700 text-white border border-transparent shadow-sm", success: "bg-green-700 hover:bg-green-800 text-white border border-transparent shadow-sm", warning: "bg-amber-600 hover:bg-amber-700 text-white border border-transparent shadow-sm", ghost: "hover:bg-gray-100 text-gray-600 border border-transparent", outline: "border text-gray-700 hover:bg-gray-50 bg-white", link: "text-[#1557b0] hover:underline bg-transparent border-0 p-0 focus:ring-0 disabled:no-underline" };

  const sizes = { xs: "h-6 px-2 text-[10px] rounded gap-1", sm: "h-7 px-2.5 text-[11px] rounded-md gap-1.5", md: "h-8 px-3 text-[12px] rounded-md gap-1.5", lg: "h-9 px-4 text-[13px] rounded-md gap-2" };

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
          color={variant === "primary" || variant === "danger" || variant === "success" || variant === "warning" ? "text-white" : "text-gray-500"}
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
