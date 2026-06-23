/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: boolean;
  border?: boolean;
  className?: string;
  accent?: string;
}

export const CardSection: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="border-t border-slate-100 px-5 py-3.5">
    {title && (
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2.5">
        {title}
      </div>
    )}
    {children}
  </div>
);

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  padding = "md",
  shadow = true,
  border = true,
  className = "",
  accent,
}) => {
  const paddingClasses = {
    none: "p-0",
    sm: "p-3",
    md: "p-5",
    lg: "p-8",
  };

  return (
    <div
      className={`
        bg-white rounded-xl overflow-hidden relative transition-all duration-150
        ${border ? "border border-slate-200" : ""}
        ${shadow ? "shadow-[0_2px_8px_rgba(15,23,42,0.06),_0_1px_2px_rgba(15,23,42,0.04)]" : ""}
        ${className}
      `}
    >
      {accent && (
        <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-r-full" style={{ background: accent }} />
      )}
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col gap-0.5">
            {title && <h4 className="text-[12.5px] font-bold leading-none text-slate-800 tracking-tight">{title}</h4>}
            {subtitle && <p className="text-[10.5px] mt-0.5 text-slate-400 font-medium">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}

      <div className={paddingClasses[padding]}>{children}</div>
    </div>
  );
};

export default React.memo(Card);
