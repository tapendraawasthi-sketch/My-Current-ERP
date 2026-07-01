import React from "react";

interface ActionToolbarProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  title,
  subtitle,
  children,
  className = "",
}) => {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        {title && <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>}
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};

export default ActionToolbar;
