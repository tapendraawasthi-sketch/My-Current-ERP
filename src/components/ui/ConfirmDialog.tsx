import React from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger,
}) => {
  if (!isOpen) return null;

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
      }}
    >
      <div
        style={{
          background: "#EBF5E2",
          border: "1px solid #000000",
          borderRadius: 4,
          padding: 24,
          maxWidth: 400,
          width: "100%",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#000000", marginBottom: 8 }}>
          {title}
        </h3>
        <p style={{ fontSize: 12, color: "#000000", marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              height: 32,
              padding: "0 16px",
              fontSize: 12,
              background: "#EBF5E2",
              border: "1px solid #000000",
              borderRadius: 4,
              cursor: "pointer",
              color: "#000000",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              height: 32,
              padding: "0 16px",
              fontSize: 12,
              fontWeight: 700,
              background: "#C9DEB5",
              border: "1px solid #000000",
              borderRadius: 4,
              cursor: "pointer",
              color: "#000000",
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
