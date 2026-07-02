// src/components/ui/Modal.tsx
// Standardised modal with dark header — consistent with balance sheet
// and trial balance options dialogs. All modals in the system should
// use this pattern.

import React, { useEffect } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class, e.g. "max-w-md" */
  max?: string;
  /** Optional footer content. If not provided, no footer is rendered. */
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  open,
  title,
  onClose,
  children,
  max = "max-w-lg",
  footer,
}) => {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${max}`}
        style={{
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "88vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark header — consistent across ALL modals */}
        <div style={{
          background: "#1e2433",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.3,
          }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 0 0 12px",
              transition: "color 100ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: 20,
          overflowY: "auto",
          flex: 1,
          background: "#ffffff",
        }}>
          {children}
        </div>

        {/* Footer — only rendered when provided */}
        {footer && (
          <div style={{
            padding: "12px 20px",
            background: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Canonical modal action buttons ────────────────────────────────────────────

/** Primary action button for modal footer */
export const ModalPrimaryBtn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, ...props }) => (
  <button
    {...props}
    style={{
      height: 32,
      padding: "0 16px",
      fontSize: 12,
      fontWeight: 500,
      color: "#ffffff",
      background: "#1557b0",
      border: "none",
      borderRadius: 6,
      cursor: "pointer",
      transition: "background 100ms ease",
      ...props.style,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background = "#0f4a96";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background = "#1557b0";
    }}
  >
    {children}
  </button>
);

/** Secondary/cancel button for modal footer */
export const ModalSecondaryBtn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, ...props }) => (
  <button
    {...props}
    style={{
      height: 32,
      padding: "0 14px",
      fontSize: 12,
      fontWeight: 500,
      color: "#374151",
      background: "transparent",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      cursor: "pointer",
      transition: "background 100ms ease, border-color 100ms ease",
      ...props.style,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
    }}
  >
    {children}
  </button>
);

export default Modal;
