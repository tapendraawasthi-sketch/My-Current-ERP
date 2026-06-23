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
  const baseStyles =
    "inline-flex items-center font-semibold uppercase rounded-full shrink-0 leading-none";

  const variants = {
    default: "bg-slate-100 text-slate-600 border border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    danger: "bg-red-50 text-red-700 border border-red-200",
    info: "bg-sky-50 text-sky-700 border border-sky-200",
    primary: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  };

  const dotColors = {
    default: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-sky-500",
    primary: "bg-indigo-500",
  };

  const sizes = {
    sm: "px-2.5 py-0.5 text-[9.5px] tracking-[0.06em]",
    md: "px-2.5 py-1 text-[10px] tracking-[0.06em]",
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
