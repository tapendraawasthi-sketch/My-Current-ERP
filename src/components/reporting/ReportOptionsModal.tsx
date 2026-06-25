import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ReportOptionsModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (options: any) => void;
  initial?: any;
}

const ReportOptionsModal: React.FC<ReportOptionsModalProps> = ({ open, onClose, onApply, initial = {} }) => {
  const [options, setOptions] = useState(initial);

  useEffect(() => {
    setOptions(initial);
  }, [initial, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm no-print">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="text-[13px] font-semibold text-gray-800">Report Options</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <p className="text-[11px] text-gray-500">Configure report filters.</p>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-600">Include zero balances</label>
            <select className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-8 px-3 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(options);
              onClose();
            }}
            className="h-8 px-3 text-[12px] font-medium text-white bg-[#1557b0] rounded-md hover:bg-[#0f4a96]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportOptionsModal;
