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
  <div className="border-t border-gray-100 px-4 py-3">
    {title && (
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
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
        bg-white rounded-lg overflow-hidden relative transition-shadow
        ${border ? "border border-gray-200" : ""}
        ${shadow ? "shadow-sm" : ""}
        ${className}
      `}
    >
      {accent && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />}
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex flex-col gap-0.5">
            {title && <h4 className="text-[12px] font-bold leading-none text-gray-800">{title}</h4>}
            {subtitle && <p className="text-[10px] mt-0.5 text-gray-400">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}

      <div className={paddingClasses[padding]}>{children}</div>
    </div>
  );
};

export default React.memo(Card);
