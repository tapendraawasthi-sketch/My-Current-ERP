import React from "react";
import { X } from "lucide-react";

interface ReportOptionsModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onApply: () => void;
  children: React.ReactNode;
}

const ReportOptionsModal: React.FC<ReportOptionsModalProps> = ({
  open,
  title,
  onClose,
  onApply,
  children,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm no-print">
      <div className="w-full max-w-md bg-[#EBF5E2] rounded-md border border-black overflow-hidden">
        <div className="busy-orange-modal-header flex items-center justify-between px-3 py-1">
          <span className="font-bold text-[12px]">{title}</span>
          <button onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2 text-[12px]">{children}</div>

        <div className="px-3 py-2 border-t border-black bg-[#D4EABD] flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button onClick={onApply}>OK (F2)</button>
        </div>
      </div>
    </div>
  );
};

export default ReportOptionsModal;
