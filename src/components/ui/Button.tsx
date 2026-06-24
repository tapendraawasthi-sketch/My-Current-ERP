import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

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
        inline-flex items-center justify-center gap-1.5 font-medium rounded
        border border-black
        ${heights[size]}
        ${fullWidth ? "w-full" : ""}
        ${disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
      style={{
        background: "#D4EABD",
        color: "#000000",
        borderColor: "#000000",
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span
          style={{
            width: 12,
            height: 12,
            border: "2px solid #000000",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};

export default Button;
