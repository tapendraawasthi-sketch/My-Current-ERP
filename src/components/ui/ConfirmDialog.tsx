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
  open?: boolean;
  onCancel?: () => void;
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
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-[420px] rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-6 shadow-lg">
        <h3 className="mb-2 text-[14px] font-semibold text-[var(--ox-text)]">{title}</h3>
        {(message || description) && (
          <p
            className={`text-[12px] leading-relaxed text-[var(--ox-text-muted)] ${
              requireReason ? "mb-3" : "mb-5"
            }`}
          >
            {message || description}
          </p>
        )}
        {requireReason && (
          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-semibold text-[var(--ox-text)]">
              {reasonLabel} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              className="w-full resize-none rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2 py-1.5 text-[12px] text-[var(--ox-text)] outline-none focus:border-[var(--ox-primary)] focus:ring-2 focus:ring-[var(--ox-primary)]/20"
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-8 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-4 text-[12px] text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={requireReason && !reason.trim()}
            className={`h-8 rounded-md px-4 text-[12px] font-semibold disabled:opacity-50 ${
              danger
                ? "bg-[var(--ox-danger)] text-white hover:opacity-90"
                : "bg-[var(--ox-primary)] text-white hover:bg-[var(--ox-primary-hover)]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
