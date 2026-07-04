import React from "react";

export interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  border?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

const PADDING_MAP: Record<string, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  actions,
  border = true,
  padding = "md",
  className = "",
  children,
}) => {
  const actionNode = action || actions;
  return (
    <div className={`bg-white rounded-lg ${border ? "border border-gray-200" : ""} ${className}`}>
      {(title || subtitle || actionNode) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#f9fafb] rounded-t-lg">
          <div>
            {title && <h3 className="text-[13px] font-semibold text-gray-800">{title}</h3>}
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actionNode && <div className="flex items-center gap-2">{actionNode}</div>}
        </div>
      )}
      <div className={PADDING_MAP[padding]}>{children}</div>
    </div>
  );
};

export default Card;
