import React from "react";
import ErpReportModal from "./ErpReportModal";

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
  return (
    <ErpReportModal
      open={open}
      title={title}
      onClose={onClose}
      maxWidth="28rem"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 text-[12px] font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-8 px-4 text-[12px] font-medium rounded-md bg-[#1557b0] text-white hover:bg-[#0f4a96]"
          >
            OK (F2)
          </button>
        </>
      }
    >
      <div className="space-y-3 text-[12px] text-gray-800">{children}</div>
    </ErpReportModal>
  );
};

export default ReportOptionsModal;
