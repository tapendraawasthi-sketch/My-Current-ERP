// src/components/ui/ConfirmDialog.tsx
import React, { useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title?: string;
  message?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  open?: boolean; // alias for isOpen used in ChallanForm
  onCancel?: () => void; // alias for onClose used in ChallanForm
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  open,
  onClose,
  onCancel,
  onConfirm,
  title = "Confirm",
  message,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger,
  requireReason,
  reasonLabel = "Reason",
  reasonPlaceholder = "Enter reason...",
}) => {
  const [reason, setReason] = useState("");
  const visible = isOpen || open || false;
  const handleClose = onClose || onCancel || (() => {});

  if (!visible) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) return;
    onConfirm(reason.trim() || undefined);
    setReason("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: "#EBF5E2",
          border: "1px solid #000000",
          borderRadius: 4,
          padding: 24,
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#000000", marginBottom: 8 }}>
          {title}
        </h3>
        {(message || description) && (
          <p style={{ fontSize: 12, color: "#000000", marginBottom: requireReason ? 12 : 20, lineHeight: 1.5 }}>
            {message || description}
          </p>
        )}
        {requireReason && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#000000", display: "block", marginBottom: 4 }}>
              {reasonLabel} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              style={{
                width: "100%",
                padding: "6px 8px",
                fontSize: 12,
                border: "1px solid #000000",
                background: "#EBF5E2",
                color: "#000000",
                borderRadius: 3,
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={handleClose}
            style={{
              height: 32, padding: "0 16px", fontSize: 12,
              background: "#EBF5E2", border: "1px solid #000000",
              borderRadius: 4, cursor: "pointer", color: "#000000",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={requireReason && !reason.trim()}
            style={{
              height: 32, padding: "0 16px", fontSize: 12, fontWeight: 700,
              background: danger ? "#fee2e2" : "#C9DEB5",
              border: `1px solid ${danger ? "#dc2626" : "#000000"}`,
              borderRadius: 4, cursor: "pointer",
              color: danger ? "#dc2626" : "#000000",
              opacity: requireReason && !reason.trim() ? 0.5 : 1,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
