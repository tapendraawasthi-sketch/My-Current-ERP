import React, { ReactNode } from "react";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "primary";
  size?: "sm" | "md";
  children: ReactNode;
  dot?: boolean;
}

const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  size = "md",
  children,
  dot = false,
}) => {
  const baseStyles = "inline-flex items-center font-semibold uppercase rounded shrink-0";

  const variants = {
    default: "bg-[#EBF5E2] text-[#000000]",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-[#D4EABD] text-[#000000]",
    primary: "bg-[#dbeafe] text-[#1557b0]",
  };

  const dotColors = {
    default: "bg-[#EBF5E2]",
    success: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-[#D4EABD]",
    primary: "bg-[#3D6B25]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-[10px]",
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]}`}>
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full mr-1.5 shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};

export default React.memo(Badge);
