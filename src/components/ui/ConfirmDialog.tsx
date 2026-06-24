/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  confirmValidationText?: string;
  reasonLabel?: string;
  type?: "danger" | "warning" | "info";
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  requireReason = false,
  reasonPlaceholder = "Please enter a reason...",
  confirmValidationText,
  reasonLabel,
  type = danger ? "danger" : "warning",
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const isConfirmDisabled = confirmValidationText
    ? reason !== confirmValidationText
    : requireReason && !reason.trim();

  const handleConfirm = () => {
    if (confirmValidationText && reason !== confirmValidationText) {
      setError(`Please type "${confirmValidationText}" to confirm.`);
      return;
    }
    if (requireReason && !reason.trim()) {
      setError("A reason details statement is required to proceed.");
      return;
    }
    setError("");
    onConfirm(requireReason || confirmValidationText ? reason : undefined);
    setReason("");
    onClose();
  };

  const handleClose = () => {
    setReason("");
    setError("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {cancelText}
          </Button>
          <Button
            variant={type === "danger" ? "danger" : type === "warning" ? "warning" : "primary"}
            size="sm"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4 p-5">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${type === "danger" ? "bg-red-100" : "bg-amber-100"}`}>
          <AlertTriangle className={`h-5 w-5 ${type === "danger" ? "text-red-600" : "text-amber-600"}`} />
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <p className="text-[12px] text-[#000000] leading-relaxed">{message}</p>

          {(requireReason || confirmValidationText) && (
            <Input
              label={reasonLabel || "Cancellation/Modification Reason"}
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(val) => {
                setReason(val);
                if (val.trim()) setError("");
              }}
              error={error}
              required
              autoFocus
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
