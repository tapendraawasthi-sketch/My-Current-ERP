import React, { useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface ErpReportModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

const ErpReportModal: React.FC<ErpReportModalProps> = ({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "42rem",
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="erp-report-modal-overlay no-print"
      data-modal-open="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="erp-report-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="erp-report-modal"
        style={{ maxWidth }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="erp-report-modal-header flex items-center justify-between gap-3">
          <div>
            <h2 id="erp-report-modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="erp-report-modal-body">{children}</div>
        {footer && <div className="erp-report-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default ErpReportModal;
