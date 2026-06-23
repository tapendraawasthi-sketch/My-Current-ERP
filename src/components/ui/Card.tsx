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
  <div
    style={{
      borderTop: "1px solid var(--color-border)",
      padding: "12px 16px",
    }}
  >
    {title && (
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "8px",
        }}
      >
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

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    borderRadius: "var(--radius-lg)",
    boxShadow: shadow ? "var(--shadow-card)" : "none",
    border: border ? "1px solid var(--color-border)" : "none",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div className={className} style={cardStyle}>
      {accent && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "3px",
            background: accent,
          }}
        />
      )}
      {(title || subtitle || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {title && (
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  lineHeight: 1,
                  color: "var(--color-text-primary)",
                }}
              >
                {title}
              </h4>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: "10px",
                  marginTop: "2px",
                  color: "var(--color-text-muted)",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div style={{ display: "flex", alignItems: "center" }}>{action}</div>}
        </div>
      )}

      <div className={paddingClasses[padding]}>{children}</div>
    </div>
  );
};

export default React.memo(Card);
