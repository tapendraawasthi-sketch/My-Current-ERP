import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "destructive";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

const variantClass: Record<string, string> = {
  primary:
    "bg-[var(--ox-primary)] text-white border-[var(--ox-primary)] hover:bg-[var(--ox-primary-hover)]",
  secondary:
    "bg-[var(--ox-surface-muted)] text-[var(--ox-text)] border-[var(--ox-border)] hover:bg-[var(--ox-primary-soft)]",
  outline:
    "bg-[var(--ox-surface)] text-[var(--ox-text)] border-[var(--ox-border-strong)] hover:bg-[var(--ox-surface-muted)]",
  ghost:
    "bg-transparent text-[var(--ox-text)] border-transparent hover:bg-[var(--ox-surface-muted)]",
  danger:
    "bg-[var(--ox-danger)] text-white border-[var(--ox-danger)] hover:opacity-90",
  destructive:
    "bg-[var(--ox-danger)] text-white border-[var(--ox-danger)] hover:opacity-90",
  success:
    "bg-[var(--ox-success)] text-white border-[var(--ox-success)] hover:opacity-90",
};

const Button: React.FC<ButtonProps> = ({
  variant = "outline",
  size = "md",
  icon,
  fullWidth,
  loading,
  children,
  disabled,
  className = "",
  style,
  ...rest
}) => {
  const heights: Record<string, string> = {
    xs: "h-6 px-2 text-[10px]",
    sm: "h-7 px-2.5 text-[11px]",
    md: "h-8 px-3 text-[12px]",
    lg: "h-9 px-4 text-[13px]",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-1.5 rounded-[var(--ox-radius-md)] border font-medium transition-colors duration-150
        ${heights[size]}
        ${variantClass[variant] || variantClass.outline}
        ${fullWidth ? "w-full" : ""}
        ${disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ox-focus-ring)]
        ${className}
      `}
      style={style}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};

export default Button;
