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
  const baseClasses = "inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none transition-colors";
  
  let variantClasses = "";
  let sizeClasses = "";
  
  // Style definitions based on requirements
  switch (variant) {
    case "primary":
      variantClasses = "bg-[var(--color-accent)] text-white border border-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)] font-semibold rounded-[var(--radius-md)]";
      break;
    case "secondary":
      variantClasses = "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-neutral-bg)] font-medium rounded-[var(--radius-md)]";
      break;
    case "outline":
      variantClasses = "bg-transparent text-[var(--color-accent)] border border-[var(--color-accent-border)] hover:bg-[var(--color-accent-subtle)] font-medium rounded-[var(--radius-md)]";
      break;
    case "ghost":
      variantClasses = "bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] font-normal rounded-[var(--radius-md)]";
      break;
    case "danger":
      variantClasses = "bg-[var(--color-negative-bg)] text-[var(--color-negative)] border border-[color-mix(in_srgb,var(--color-negative)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-negative-bg)_60%,white)] font-semibold rounded-[var(--radius-md)]";
      break;
    case "success":
      variantClasses = "bg-[var(--color-positive-bg)] text-[var(--color-positive)] border border-[color-mix(in_srgb,var(--color-positive)_30%,transparent)] font-semibold rounded-[var(--radius-md)]";
      break;
    case "warning":
      variantClasses = "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] font-semibold rounded-[var(--radius-md)]";
      break;
    case "link":
      variantClasses = "bg-transparent text-[var(--color-accent)] border-none underline font-medium hover:text-[var(--color-accent-hover)]";
      break;
    default:
      variantClasses = "bg-[var(--color-accent)] text-white border border-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)] font-semibold rounded-[var(--radius-md)]";
  }

  // Size mapping
  if (variant !== "link") {
    switch (size) {
      case "xs":
        sizeClasses = "h-[24px] px-[8px] text-[10px]";
        break;
      case "sm":
        sizeClasses = "h-[28px] px-[10px] text-[11px]";
        break;
      case "lg":
        sizeClasses = "h-[40px] px-[20px] text-[14px]";
        break;
      case "md":
      default:
        sizeClasses = "h-[34px] px-[14px] text-[13px]";
        break;
    }
  } else {
    sizeClasses = "p-0 text-[13px]";
  }

  return (
    <button
      id={id}
      type={type}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {loading && <Spinner size={size === "xs" ? "xs" : "sm"} className="mr-1.5" />}
      {!loading && icon && iconPosition === "left" && <span className="mr-1.5 flex items-center">{icon}</span>}
      <span>{children}</span>
      {!loading && icon && iconPosition === "right" && <span className="ml-1.5 flex items-center">{icon}</span>}
    </button>
  );
};

export default Button;
